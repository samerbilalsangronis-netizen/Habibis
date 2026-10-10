# Decisiones tomadas

Lo que asumí o decidí sin preguntar. Todo se puede cambiar.

## Arquitectura

- **Next.js 14.2 (App Router)**, React 18, Tailwind 3. Elegí 14 en lugar de 15 por estabilidad con `@supabase/ssr` y `react-leaflet` 4.
- **Un solo proyecto**: `/` (cliente) y `/panel` (personal). Cada zona tiene su propio manifiesto PWA (`/manifest.webmanifest` y `/panel.webmanifest`) y comparten un único service worker (`/sw.js`), así cada una se instala como app distinta.
- **No usé Edge Functions**: todo lo de servidor (crear pedidos, push, Binance, usuarios) son rutas API de Next.js en Vercel. Menos piezas que mantener.
- Los clientes de Supabase en el servidor usan `fetch` **sin caché** (`cache: 'no-store'`): sin esto, Next.js mostraba menús/precios viejos en el checkout.

## Pedidos y seguridad

- **El navegador nunca manda precios.** Solo envía ids de productos, cantidades y opciones. La función SQL `create_order` valida (producto activo y disponible, opciones que pertenecen al producto, mínimo/máximo por grupo, horario, delivery, método de pago) y calcula subtotal, delivery, total y conversión con los datos de la base.
- Los pedidos web se crean **solo a través de la ruta API** `/api/orders` (con la clave de servidor) para aplicar el antispam por IP. Los pedidos manuales del panel usan la sesión del personal y la base comprueba el rol.
- **Si cambia la tasa o un precio mientras el cliente está pagando**, el pedido no se guarda: se le avisa (error 409) y se recarga el total, para que no pague un monto desactualizado.
- Cada pedido guarda **una foto de las tasas** (`rate_cop_usdt`, `rate_bs_usdt`) y los totales en las 3 monedas. Nunca se recalculan.
- **Antispam**: por defecto máx. 3 pedidos por teléfono y 6 por conexión (IP anonimizada con hash + `IP_HASH_SALT`) cada 10 minutos. Se puede cambiar en Ajustes → Negocio.
- **Numeración**: secuencia `HB-0001`, `HB-0002`… Si un pedido falla al validarse puede quedar un número saltado (comportamiento normal de las secuencias en Postgres).
- **Seguimiento del cliente**: `/pedido/<token>` con un token aleatorio de 36 caracteres hexadecimales. Los clientes no pueden leer la tabla de pedidos; solo la función `get_order_tracking(token)`, que no expone datos internos (IP, comprobante, repartidor).
- **Tiempo real del cliente**: cada cambio de estado se emite por *Realtime Broadcast* en el canal `order:<token>` desde un trigger de la base (`realtime.send`). Como respaldo, la página consulta cada 20 s. En las pruebas el cliente vio cada cambio en ~50–120 ms.
- **Tiempo real del panel**: *postgres_changes* sobre `orders` (respeta RLS: el repartidor solo recibe lo suyo), más re-sincronización al reconectar o volver a la pestaña, y consulta cada 60 s como respaldo.
- **Comprobantes**: bucket privado `comprobantes`. Los sube el servidor; el personal (admin/operador) los ve con URLs firmadas de 30 minutos. Las imágenes se comprimen en el teléfono antes de subirse (máx. 1600 px) para conexiones lentas. Se aceptan JPG, PNG, WEBP, HEIC y PDF (máx. 8 MB).
- **Pago rechazado**: el cliente puede subir un nuevo comprobante desde su página de seguimiento y el panel recibe una notificación.

## Estados

- Pedido: `nuevo → aceptado → en_preparacion → listo → en_camino → entregado` (o `cancelado` con motivo).
- Pago (separado): `por_verificar`, `verificado`, `rechazado`, `cobrar_en_entrega` (efectivo), `pendiente`.
- **No se puede pasar a preparación sin pago verificado** (excepto efectivo). Al marcar *Entregado* un pedido en efectivo, el pago queda como cobrado.
- Pestañas del panel: *Nuevos* = sin aceptar · *Por verificar pago* = aceptado, pago digital sin verificar · *En preparación* = aceptado y pagado, o en preparación · *Listos / En camino* · *Entregados* · *Cancelados*.
- La **alarma** suena mientras haya pedidos en *Nuevos*. Verificar o rechazar un pago también cuenta como aceptarlo.

## Monedas

- Base **COP** (enteros). `USDT = COP / tasa_cop_usdt` y `Bs = COP / tasa_cop_usdt × tasa_bs_usdt`; para Bs se usa el USDT **sin redondear** y al final se redondea a 2 decimales.
- **Redondeo COP**: se aplica al **total** del pedido (subtotal + delivery) al múltiplo configurado (100 por defecto). Los precios y opciones se cargan ya redondos.
- Formato: `22.000 COP`, `5,64 USDT`, `Bs. 2.143,59`.
- **Efectivo en USD**: lo que debe pagar el cliente en dólares se toma igual al monto en USDT (1 USD = 1 USDT).
- **Botón Binance**: consulta la API pública (no oficial) del P2P de Binance (anuncios de venta de USDT, mediana de los mejores precios) para COP y VES, y guarda la tasa como origen "binance". Si falla, se queda la manual. Solo el administrador puede usarlo.

## Horarios

- Zona horaria por defecto **America/Caracas** (configurable en la tabla `settings`).
- Si la hora de cierre es menor que la de apertura, el horario cruza la medianoche.
- "Cerrar ahora / Abrir ahora / Según horario" lo pueden usar el administrador y el operador.
- **Pedidos programados**: franjas de 15 minutos dentro del horario, desde *tiempo de preparación* (mín. 30 min) hasta 3 días. Con el local cerrado, por defecto **sí** se aceptan pedidos programados (configurable).
- Horario de ejemplo: todos los días 11:00–23:00, lunes cerrado.

## Delivery

- Tarifa única por defecto: **5.000 COP**. El modo "por zonas" ya funciona (3 zonas de ejemplo) pero viene **desactivado**.
- La ubicación en el mapa es **obligatoria** para delivery web (GPS o mover el pin). En pedidos manuales es opcional.
- La distancia del panel es en **línea recta** (Haversine), no por calles.
- Los mapas usan los servidores públicos de OpenStreetMap. Si el volumen crece mucho, conviene un proveedor de mapas (p. ej. MapTiler o Stadia, con plan gratuito).

## Roles y permisos (RLS)

- **Admin**: todo. **Operador**: pedidos, disponibilidad (con funciones dedicadas `set_product_available` y `set_option_available`), abrir/cerrar y clientes. No ve reportes ni configuración (ni el gasto total de los clientes). **Repartidor**: solo los pedidos donde `driver_id` es él; solo puede marcar *Entregado*.
- Se puede asignar como repartidor a cualquier usuario activo (útil si el operador también reparte).
- Sin registro público: los usuarios los crea el admin (con la clave de servidor). En `supabase/config.toml` (local) el registro está desactivado; en el proyecto real hay que desactivarlo a mano (ver README).
- Un usuario desactivado pierde acceso a todo (las políticas exigen perfil activo) y se borran sus suscripciones push.

## Notificaciones push

- Al crear un pedido web se avisa a todos los dispositivos de admin y operador; al reenviar un comprobante, igual; al despachar con repartidor, al repartidor.
- En iPhone solo funcionan con el panel **instalado** en la pantalla de inicio (iOS 16.4+), limitación de Apple.

## Clientes

- Se crean/actualizan automáticamente por teléfono al pedir (nombre, cédula y hasta 5 direcciones recientes). Los totales se calculan con la vista `customer_stats` (sin contar cancelados).
- Teléfonos aceptados: Venezuela (`0412…`, `+58…`) y Colombia (`3xx…`, `+57…`), guardados en formato internacional (`+58412…`).

## Cliente (web)

- Carrito, moneda elegida, datos del cliente, última dirección y los **últimos 10 pedidos** (para "Repetir pedido") se guardan en `localStorage` del navegador.
- Al llegar al checkout, el carrito se compara con el menú actual: se quitan los productos agotados y se actualizan los precios, avisando al cliente.
- Si el local está cerrado y no se aceptan programados, se puede ver el menú pero no agregar al carrito.
- La web se actualiza sola cuando el panel marca agotados, cambia precios, tasas o abre/cierra (Realtime).
- Un combo aparece agotado si se agota alguno de sus componentes.

## Diseño

- Tema oscuro **verde oliva** (`#14201A`) con dorado y terracota, y patrón geométrico árabe (estrella de 8 puntas) muy suave. Tipografías **Reem Kufi** (títulos) y **Cairo** (texto).
- **Logo provisional** (`public/logo.svg`): monograma "H" sobre una estrella de 8 puntas. Pendiente el logo real.
- Si un producto no tiene foto, se muestra un mosaico con su inicial.
- Imagen para compartir (Open Graph) generada automáticamente (`src/app/opengraph-image.tsx`).

## Pendiente / valores de ejemplo a reemplazar

- Ciudad, dirección y ubicación del local (Ajustes → Negocio).
- WhatsApp (`584120000000`), Instagram, datos de Binance, pago móvil y transferencia: **son de ejemplo**.
- Menú real con precios y fotos (el seed trae un menú de ejemplo).
- Logo y colores definitivos.
- Dominio (por ahora el de Vercel).
- Contraseña del admin de ejemplo.
