# HANDOFF · Habibis

Documento de traspaso para cualquier persona o agente (Codex, Claude Code…) que continúe el proyecto.
Léelo completo antes de tocar código. Última actualización: 3 nov 2026.

> **TL;DR** — Web de pedidos de comida árabe + panel interno, en producción en
> **https://habibis-chi.vercel.app** (cliente) y **/panel** (personal). Next.js 14 + Supabase.
> Todo funciona de punta a punta. La rama que publica en producción es
> **`claude/jolly-bohr-xjbtui`** (no existe `main`). Cualquier push a esa rama sale en vivo en ~2 min.
> Ver la sección 12 ("Dónde quedamos") para lo pendiente.

---

## Índice

1. [Qué es Habibis](#1-qué-es-habibis)
2. [Infraestructura en producción](#2-infraestructura-en-producción)
3. [Stack y estructura del repo](#3-stack-y-estructura-del-repo)
4. [Cómo funciona la web del cliente](#4-cómo-funciona-la-web-del-cliente-)
5. [Cómo funciona el panel](#5-cómo-funciona-el-panel-panel)
6. [Base de datos (Supabase)](#6-base-de-datos-supabase)
7. [Monedas y precios](#7-monedas-y-precios)
8. [Tiempo real y notificaciones](#8-tiempo-real-y-notificaciones)
9. [Rutas API](#9-rutas-api)
10. [Diseño e identidad](#10-diseño-e-identidad)
11. [Trampas conocidas (leer antes de cambiar código)](#11-trampas-conocidas-leer-antes-de-cambiar-código)
12. [Dónde quedamos / pendientes](#12-dónde-quedamos--pendientes)
13. [Historial de cambios](#13-historial-de-cambios)
14. [Cómo trabajar en el repo](#14-cómo-trabajar-en-el-repo)

---

## 1. Qué es Habibis

- Negocio de **comida árabe en Venezuela** (shawarmas, falafel, cremas árabes…), en **La Grita** (Táchira).
  Creado en ene-2026, pausado 2 meses y relanzado en formato digital.
- Lo opera la **pareja del dueño** desde una **tablet Android 10** con el panel instalado como app (PWA).
  Por eso el panel debe ser **muy simple, móvil primero y en español sin tecnicismos**.
- Dueño / contacto del proyecto: samerbilalsangronis@gmail.com.
- Inspiración: monzasc.com (menú web + pedido + WhatsApp), pero aquí los pedidos entran a un **panel propio en tiempo real**.
- El prompt original pedía: menú con modificadores, precios en COP con conversión a USDT y Bs, checkout con
  delivery (mapa) o retiro, pagos Binance / Bolívares / Efectivo, seguimiento en vivo, panel con roles,
  alarma + push, comanda, pedido manual, CRUD de menú, configuración, reportes con cierre de caja, clientes.
  **Todo eso está implementado.** Decisiones tomadas sin preguntar: ver `DECISIONES.md`.

## 2. Infraestructura en producción

| Pieza | Valor |
|---|---|
| Web cliente | https://habibis-chi.vercel.app |
| Panel | https://habibis-chi.vercel.app/panel |
| Vercel | Proyecto importado desde GitHub, plan **Hobby**. Rama de producción: `claude/jolly-bohr-xjbtui`. Deploy automático en cada push. |
| GitHub | `samerbilalsangronis-netizen/habibis`. **Única rama: `claude/jolly-bohr-xjbtui`** (sin `main`, sin protección de rama). |
| Supabase | Proyecto `lotmndmgqmvwqacxixer` → `https://lotmndmgqmvwqacxixer.supabase.co` (plan gratis). |
| Clave pública Supabase | `sb_publishable_fy-alotOiux8oGeoFeOsow_2xArF2op` (es pública, va en el navegador) |
| Admin del panel | `admin@habibis.app` — contraseña de ejemplo `Habibis2026!` **(pendiente de cambiar, ver §12)** |

**Variables de entorno en Vercel** (nombres; los valores secretos NO están en el repo):

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente Supabase (navegador y servidor) |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor: crear pedidos, subir comprobantes, push, crear usuarios |
| `NEXT_PUBLIC_SITE_URL` | URL pública (OG, enlaces). Debe ser `https://habibis-chi.vercel.app` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web Push |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Respaldo; el número real se edita en el panel (`settings.whatsapp_phone`) |
| `IP_HASH_SALT` | Anonimiza IPs para el antispam |

Plantilla documentada en `.env.example`. **Nunca** subir `.env.local` ni claves secretas al repo.

Estado de datos en producción (al 3-nov): migraciones 1–4 aplicadas, `seed.sql` aplicado **una vez**
(no volver a ejecutarlo: falla por duplicados). El dueño ya editó en el panel ciudad (La Grita),
dirección y horario (17:00–23:00). Hubo al menos un pedido de prueba (HB-0001, efectivo). Se le
entregó un SQL para borrar pedidos de prueba (§12); no consta si lo ejecutó.

## 3. Stack y estructura del repo

- **Next.js 14.2 (App Router)**, React 18, TypeScript estricto, **Tailwind 3.4**.
- **Supabase**: Postgres + Auth + Realtime + Storage. Clientes `@supabase/supabase-js` y `@supabase/ssr` (sesión en cookies).
- **Leaflet + react-leaflet 4** con OpenStreetMap (sin clave de Google).
- **web-push** (VAPID) para notificaciones; service worker propio en `public/sw.js`.
- **zustand** (carrito/preferencias en localStorage), **zod** (validación), **@dnd-kit** (ordenar arrastrando).
- Fuentes: Reem Kufi (títulos) y Cairo (texto) vía `next/font/google`.

```
src/
  middleware.ts                 Refresca sesión; protege /panel (redirige a /panel/login). matcher: /panel y /api/push
  app/
    layout.tsx                  HTML raíz, fuentes, metadatos
    globals.css                 Tokens de color (CSS vars), componentes .btn/.card/.input, patrón árabe
    opengraph-image.tsx         Imagen al compartir el link (runtime edge, usa og-logo.png)
    (shop)/                     ZONA CLIENTE
      page.tsx                  Menú (server: loadMenu → MenuView)
      checkout/page.tsx         Checkout (server: loadMenu → CheckoutView)
      pedido/[token]/page.tsx   Seguimiento público por token
      layout.tsx                manifest cliente + registro del service worker
    panel/                      ZONA PERSONAL
      layout.tsx                manifest del panel (/panel.webmanifest)
      login/page.tsx            Login correo+contraseña
      imprimir/[id]/page.tsx    Comanda 58/80 mm (fuera del layout con menú)
      (app)/                    Todo lo que exige sesión de staff
        layout.tsx              requireStaff() + PanelProvider + PanelShell
        page.tsx                Tablero de pedidos (o "Mis entregas" si es repartidor)
        pedidos/[id]            Detalle de pedido
        pedidos/nuevo           Pedido manual
        menu/                   Categorías y productos; menu/producto/[id]; menu/modificadores
        configuracion/          Ajustes (tasas, horario, delivery, pagos, negocio, notificaciones, usuarios, cuenta)
        reportes/               Solo admin
        clientes/               Admin y operador
    api/                        Rutas del servidor (ver §9)
  components/
    shop/                       MenuView, Hero, ProductCard, ProductSheet, CartDrawer, CheckoutView,
                                TrackingView, PaymentInfo, ProofInput, CopyField, Price, CurrencyToggle, FloatingSocial…
    panel/                      PanelContext (estado global + realtime + alarma), PanelShell (navegación),
                                OrdersBoard, OrderDetail, DriverBoard, ManualOrder, MenuManager, ProductEditor,
                                ModifiersManager, SettingsPage, Reports, Customers, StoreToggle, useOrderAction
    map/                        LeafletMap (pin arrastrable / pines fijos) + index (carga sin SSR, distanceKm)
    ui/                         Sheet (modal/hoja inferior), Switch, Sortable, Icons (SVG en línea)
    pwa/RegisterSW.tsx          Registra /sw.js (solo en producción, o con ?sw=1 en dev)
  lib/
    types.ts                    Tipos de dominio (Settings, Order, MenuData…)
    menu.ts                     loadMenu(): trae todo lo público en paralelo
    money.ts                    Conversión COP→USDT→Bs y formatos
    hours.ts                    Zona horaria, abierto/cerrado, franjas para programar
    status.ts                   Etiquetas/colores de estados, pestañas del tablero, pasos del seguimiento
    whatsapp.ts                 Mensajes prellenados (resumen de pedido, avisos de estado), links Maps/Waze
    phone.ts                    Normaliza teléfonos VE/CO a E.164
    push.ts                     sendPush() con web-push (servidor)
    order-payload.ts            Esquema zod del pedido que manda el navegador
    orders.ts                   cashLine() (texto "Cobrar X · paga con Y")
    server-utils.ts             IP, hash de IP, subida de comprobantes, json()
    auth.ts                     getStaff()/requireStaff() (servidor)
    supabase/client.ts|server.ts  Clientes: navegador, servidor con sesión, público, admin (service role)
  store/cart.ts                 useCart, usePrefs (moneda, datos del cliente, última dirección), useRecent
supabase/
  migrations/0001_schema.sql    Tablas, tipos, triggers updated_at, fila única de settings
  migrations/0002_functions.sql Lógica de negocio (create_order, order_action, tracking, horario…)
  migrations/0003_rls_storage_realtime.sql  RLS, buckets, publicación realtime
  migrations/0004_views.sql     Vista customer_stats
  seed.sql                      Menú de ejemplo, tasas, horario, zonas, admin de ejemplo
  config.toml                   Supabase local (registro público desactivado)
scripts/                        generate-vapid.mjs, generate-icons.mjs, create-admin.mjs
public/                         sw.js, manifests, offline.html, pattern.svg, logo.png, logo-512.webp, icons/
.claude/skills/                 Skills de diseño (ui-ux-pro-max y otros) instaladas por el dueño. No tocar.
README.md                       Guía de instalación, despliegue y uso diario (para el dueño)
DECISIONES.md                   Todo lo que se asumió sin preguntar
```

## 4. Cómo funciona la web del cliente (`/`)

### Menú (`MenuView` + `Hero`)
- `loadMenu()` (servidor) trae settings, tasa vigente, horario, zonas, categorías, productos, grupos de
  opciones, combos. Solo productos/categorías **activos**. La página es dinámica (sin caché).
- **Encabezado fijo**: logo + nombre, selector de moneda **COP / USDT / Bs**, botón **🧾 Mis pedidos**
  (solo si ese navegador ya pidió) y carrito con contador. Debajo, barra horizontal de categorías que se
  resalta según el scroll (IntersectionObserver).
- **Portada (`Hero.tsx`)**: logo oficial grande con brillo dorado, titular "El sabor árabe que te abraza",
  tagline, estado **Abierto/Cerrado** + horario de hoy (o "Abrimos mañana a las…"), botones **Pedir ahora**
  y **Ver el menú**, franja de datos (tiempo estimado, costo delivery, retiro, ciudad/dirección) y fila
  **"Los favoritos"** (productos con etiqueta `mas_pedido`, luego `nuevo`, máx. 8).
- Buscador (sin acentos), tarjetas por categoría con foto o mosaico con la inicial, etiquetas
  (🌿 vegetariano, 🌶️ picante, ✨ nuevo, ★ más pedido). Agotado = gris, no se puede agregar.
  Un combo aparece agotado si se agota un componente.
- **Tiempo real**: escucha cambios en `products`, `modifier_options`, `settings`, `exchange_rates` y hace
  `router.refresh()` → agotados, precios, tasas y abrir/cerrar se reflejan sin recargar.
- Botones flotantes de Instagram y WhatsApp.
- Si está cerrado: se ve el menú; se puede pedir **solo programado** si `allow_scheduled_when_closed`.

### Producto (`ProductSheet`)
- Hoja inferior (modal en escritorio) con foto, descripción, componentes del combo, grupos de opciones:
  selección única o múltiple, obligatorio/opcional, mín./máx., precio extra por opción, opciones agotadas
  deshabilitadas. Nota libre ("sin cebolla"). Cantidad. Valida antes de agregar.
- Se reutiliza en el panel (pedido manual) con la prop `onAdd`.

### Carrito (`CartDrawer`, `store/cart.ts`)
- Persistente en localStorage (`habibis-cart-v1`). Misma combinación producto+opciones+nota se agrupa.
  Editar opciones, cambiar cantidad, quitar. Respeta pedido mínimo.

### Checkout (`CheckoutView`)
1. **Reconcilia** el carrito con el menú actual: quita agotados/borrados y actualiza precios (avisa).
2. **Tus datos**: nombre, teléfono VE/CO (se normaliza a `+58…`/`+57…`), cédula opcional. Se recuerdan.
3. **Entrega**: casilla grande **"Agregar delivery (+5.000 COP …)"**. Sin marcar = retiro en local.
   Con delivery: zona (si modo zonas), dirección, referencia, mapa con **"Usar mi ubicación actual"** (GPS)
   y pin arrastrable / toque en el mapa. La ubicación es **obligatoria** para delivery web.
4. **¿Para cuándo?**: "Lo antes posible" o "Programar" (franjas de 15 min dentro del horario, 3 días).
5. **Pago**:
   - **Binance (USDT)**: muestra Pay ID / correo / nombre con botón copiar y **monto exacto en USDT**;
     sube captura (se comprime en el teléfono) y/o ID de orden.
   - **Bolívares**: datos de pago móvil y transferencia + **monto exacto en Bs**; captura y referencia.
   - **Efectivo**: moneda (COP/USD/Bs según `cash_currencies`) y "¿con cuánto pagas?" con vuelto estimado.
   - Regla: digital se paga antes de preparar; efectivo al entregar/retirar.
6. Totales: subtotal, delivery, total COP + USDT + Bs y tasas usadas.
7. Envía `multipart/form-data` a `POST /api/orders` con `payload` (solo ids, cantidades y opciones;
   **nunca precios**) + `proof`. Incluye `expected_total_cop` y `expected_rate_id`: si cambió el precio o la
   tasa, el servidor responde **409** y la página se refresca para que el cliente no pague un monto viejo.
8. Al terminar: guarda el pedido en "Mis pedidos" (localStorage), vacía el carrito y va a `/pedido/<token>?nuevo=1`.

### Seguimiento (`/pedido/[token]`, `TrackingView`)
- Token aleatorio de 36 hex (no adivinable). Datos vía RPC `get_order_tracking(token)` (no expone IP,
  comprobante ni repartidor).
- Con `?nuevo=1`: confirmación con código grande (HB-0001) y botón **"Enviar copia por WhatsApp"**
  (resumen con productos, 3 monedas, link de Google Maps, método de pago, link de seguimiento).
- Línea de tiempo: Recibido → Pago verificado (o "Pago al recibir") → En preparación → Listo/En camino → Entregado.
  Cancelado muestra el motivo.
- Si el pago fue **rechazado** o falta: formulario para reenviar comprobante (`POST /api/orders/[token]/payment`).
- Tiempo real por **Broadcast** (canal `order:<token>`) + sondeo cada 20 s + al volver a la pestaña.

## 5. Cómo funciona el panel (`/panel`)

### Acceso y roles
- Login en `/panel/login` (Supabase Auth, correo+contraseña). **Sin registro público** (desactivado en Supabase).
- Perfil en `staff_profiles` (`role`: `admin` | `operador` | `repartidor`, `active`). Sin perfil activo → sin acceso.
- **Admin**: todo. **Operador**: pedidos, agotados, abrir/cerrar, clientes (sin gasto total), notificaciones;
  sin configuración ni reportes. **Repartidor**: solo "Mis entregas" (sus pedidos asignados) y "Entregado".
- Navegación: barra lateral (escritorio) / barra inferior (móvil) en `PanelShell`. Indicador **"En vivo" /
  "Reconectando"** del canal realtime. Campana para silenciar la alarma.

### `PanelContext` (corazón del panel)
- Carga pedidos de las últimas 36 h + todos los activos, con sus líneas y modificadores.
- Suscripción `postgres_changes` a `orders` (respeta RLS) → refetch del pedido cambiado. Re-sincroniza al
  reconectar, al volver a la pestaña y cada 60 s (respaldo).
- **Alarma**: WebAudio (sin archivos), suena cada 4 s **mientras haya pedidos en estado `nuevo`**. Los
  navegadores exigen un toque para habilitar audio → aviso flotante "Toca para activar el sonido".
  Solo suena con el panel abierto y en primer plano; con la app cerrada avisa la **notificación push**.
- Contador en el título de la pestaña y badge del ícono de la app.

### Tablero (`OrdersBoard`)
- Pestañas: **Nuevos · Por verificar pago · En preparación · Listos / En camino · Entregados · Cancelados**
  (mapeo en `lib/status.ts → boardTabOf`). Salta a "Nuevos" cuando llega uno.
- Tarjeta: código, estado, tiempo transcurrido con color (verde/ámbar/rojo según tiempo de preparación +
  entrega), cliente, tipo de entrega, productos, total, método y estado de pago, botón de acción principal.
- Botón **Abierto/Cerrado** (Cerrar ahora / Abrir ahora / Según horario), **+ Pedido manual**, alerta si la
  tasa tiene más de `rate_stale_hours` (12 h).

### Flujo de estados (RPC `order_action`)
```
nuevo ──aceptar──▶ aceptado ──(pago digital: verificar_pago / rechazar_pago)──▶
      ──preparar──▶ en_preparacion ──listo──▶ listo ──despachar (delivery, con repartidor)──▶ en_camino ──entregado──▶ entregado
cualquier estado no final ──cancelar (motivo obligatorio)──▶ cancelado
```
- `payment_status` va aparte: `por_verificar` | `verificado` | `rechazado` | `cobrar_en_entrega` | `pendiente`.
- No se puede preparar ni marcar listo sin pago verificado (salvo efectivo). Verificar o rechazar un pago
  también acepta el pedido (detiene la alarma). Al entregar un pedido en efectivo, el pago queda verificado.
- Repartidor solo puede `entregado` en sus pedidos. Todo queda en `order_status_history`.
- Tras cada acción aparece **"Avisar"** → WhatsApp al cliente con mensaje prellenado (`statusMessage`).

### Detalle (`OrderDetail`)
- Acciones según estado, productos con opciones y notas, totales en 3 monedas con tasas del pedido,
  comprobante (URL firmada 30 min, toque para ampliar), cliente (llamar / WhatsApp), mapa con local y
  cliente, distancia en línea recta, botones Google Maps / Waze, historial, imprimir comanda 58/80 mm.

### Otras pantallas
- **Pedido manual** (`ManualOrder`): selector de productos, cliente, retiro/delivery, pago, "pago ya verificado".
  Llama a `/api/orders` con `source: 'manual'` usando la sesión del staff.
- **Menú** (`MenuManager`): categorías arrastrables (crear, renombrar, ocultar, borrar si vacía), productos
  arrastrables con interruptor **Disponible/Agotado** (operador también), buscador. Admin edita productos en
  `ProductEditor` (foto a Storage comprimida a WebP, precio COP, etiquetas, visible, combo con componentes,
  grupos de opciones con orden). **Opciones y extras** (`ModifiersManager`): grupos reutilizables con opciones,
  precio extra y agotado por opción.
- **Ajustes** (`SettingsPage`, pestañas): 💱 Tasas (manual + "Actualizar desde Binance" + historial) ·
  🕒 Horario (por día; cierre < apertura = cruza medianoche; programados) · 🛵 Delivery (tarifa única 5.000 COP
  o zonas) · 💳 Pagos · 🏪 Negocio (nombre, logo, WhatsApp, Instagram, dirección, pin del local, mínimo,
  tiempos, redondeo, antispam) · 🔔 Notificaciones (activar push en este dispositivo, enviar prueba, sonido) ·
  👥 Usuarios (crear, rol, activar/desactivar, contraseña) · 🔑 Mi cuenta.
- **Reportes** (admin): resumen hoy/semana/mes, rango (hoy, ayer, semana, mes, personalizado), ventas en 3
  monedas, ticket promedio, por método de pago, más vendidos, por zona, delivery vs retiro,
  **cierre de caja** del día (efectivo por moneda vs Binance vs Bs) y **exportar CSV**.
- **Clientes**: lista automática por teléfono (pedidos, gasto, última compra, direcciones), vista `customer_stats`.
- **Comanda** `/panel/imprimir/[id]?w=58|80`: ticket monoespaciado, imprime solo al abrir.

## 6. Base de datos (Supabase)

### Tablas principales
`settings` (fila única id=1 con TODA la configuración) · `exchange_rates` (historial; vigente = la última) ·
`delivery_zones` · `business_hours` (0=domingo…6) · `categories` · `products` · `combo_items` ·
`modifier_groups` · `modifier_options` · `product_modifier_groups` · `staff_profiles` · `push_subscriptions` ·
`customers` (por teléfono, hasta 5 direcciones) · `orders` · `order_items` · `order_item_modifiers` ·
`order_status_history`. Vista `customer_stats` (security_invoker).

### Funciones (todas `SECURITY DEFINER`, en `0002_functions.sql`)
| Función | Quién la llama | Qué hace |
|---|---|---|
| `create_order(p jsonb)` | `/api/orders` con **service_role** (web) o sesión staff (manual) | Valida todo (horario, antispam por teléfono/IP, opciones, mín./máx., disponibilidad, delivery, pago), **recalcula precios y totales**, guarda foto de tasas, upsert de cliente, historial. Errores en español (los muestra la web). `HB409` = cambió total o tasa. |
| `order_action(id, action, note, driver)` | Panel (sesión) | Máquina de estados de §5, con control de rol |
| `get_order_tracking(token)` | Público (anon) | Datos seguros del pedido para el cliente |
| `resubmit_payment(token, path, ref)` | Solo service_role | Cliente reenvía comprobante |
| `set_product_available`, `set_option_available`, `set_open_override` | Admin/operador | Acciones rápidas |
| `is_within_hours`, `is_open_now`, `store_status`, `current_rate`, `round_cop` | Varios | Horario y utilidades |
| `is_staff`, `is_admin`, `is_manager`, `current_staff_role` | Políticas RLS | Roles |
| trigger `broadcast_order_change` | Automático | `realtime.send` al canal `order:<token>` en cada cambio de estado/pago/repartidor |

### Seguridad
- **RLS en todas las tablas.** Anónimo: lee menú, horario, zonas, tasas, settings (incluye datos de pago,
  que son públicos a propósito). **No** puede leer ni escribir `orders` directamente.
- Pedidos: managers ven todos; repartidor solo `driver_id = auth.uid()`. Cambios de estado solo por RPC.
- Configuración y menú: escritura solo admin.
- Storage: bucket **`productos`** público (fotos y `branding/` para logo; escribe admin) y **`comprobantes`**
  privado (sube el servidor; lee staff con URL firmada).
- Realtime publicado: `orders`, `products`, `modifier_options`, `settings`, `exchange_rates`.
- `revoke execute on all functions … from anon, authenticated` y luego grants explícitos (ver final de 0002).

### Numeración
Secuencia `order_number_seq` → código `HB-0001`. Si `create_order` falla después del `nextval`, queda un hueco (normal).

## 7. Monedas y precios

- Todo se carga en **COP** (enteros). Tasas del día en `exchange_rates`: `cop_per_usdt` y `bs_per_usdt`.
- `USDT = COP / cop_per_usdt` (2 dec.) · `Bs = COP / cop_per_usdt × bs_per_usdt` (2 dec., usando el USDT sin redondear).
- El **total COP** se redondea al múltiplo `settings.cop_rounding` (100 por defecto).
- Cada pedido guarda `rate_cop_usdt`, `rate_bs_usdt`, `rate_id` y los 3 totales: **nunca se recalculan**.
- La misma fórmula existe en SQL (`create_order`) y en TS (`lib/money.ts`): si cambias una, cambia la otra.
- Efectivo en USD: se cobra el monto en USDT (1 USD = 1 USDT).
- `/api/rates/binance`: consulta la API pública **no oficial** del P2P de Binance (mediana de anuncios
  USDT/COP y USDT/VES) y guarda la tasa como `source='binance'`. Si falla, queda la manual.

## 8. Tiempo real y notificaciones

- **Panel**: `postgres_changes` sobre `orders` (ver §5). **Cliente**: Broadcast `order:<token>` + sondeo.
- **Push (Web Push/VAPID)**:
  - El panel se suscribe en **Ajustes → Notificaciones** (`/api/push/subscribe`, tabla `push_subscriptions`).
  - Se envía push a admin+operador al crear un pedido web y al reenviar comprobante; al repartidor al despachar.
  - `public/sw.js` muestra la notificación (`requireInteraction`, vibración) y al tocarla abre el pedido.
  - En iPhone/iPad solo funciona con el panel **instalado** en pantalla de inicio (iOS 16.4+).
  - `lib/push.ts` limpia espacios/comillas de las variables y agrega `mailto:` a `VAPID_SUBJECT` si falta
    (ese error tumbaba todos los push; arreglado el 2-nov). Si falla, devuelve el motivo y
    Ajustes → Notificaciones → "Enviar prueba" lo muestra.
  - Verificado el 2-nov: push de prueba enviado a 2 dispositivos (tablet Android 10 y Mac).
- **Service worker** (`public/sw.js`, `VERSION = 'habibis-v2'`): caché de estáticos, red primero para páginas,
  `offline.html` sin conexión, nunca cachea `/api` ni `/panel`. Si cambias assets cacheados, **sube VERSION**.

## 9. Rutas API

| Ruta | Método | Auth | Qué hace |
|---|---|---|---|
| `/api/orders` | POST | Pública (web) / sesión staff (manual) | Valida con zod, normaliza teléfono, sube comprobante, llama `create_order`, envía push. 409 si cambió total/tasa. |
| `/api/orders/[token]/payment` | POST | Token | Reenviar comprobante → `resubmit_payment` + push |
| `/api/push/subscribe` | POST/DELETE | Sesión | Guardar/quitar suscripción del dispositivo |
| `/api/push/test` | POST | Sesión | Push de prueba a los dispositivos del usuario |
| `/api/push/driver` | POST | Admin/operador | Avisar al repartidor asignado |
| `/api/rates/binance` | POST | Admin | Tasa desde Binance P2P |
| `/api/staff` | POST/PATCH | Admin | Crear usuario / cambiar rol, nombre, estado, contraseña |

## 10. Diseño e identidad

- **Logo oficial**: círculo verde con borde dorado y "HABIBI'S" en dorado. Original en fondo de tela negra;
  se recortó a fondo transparente → `public/logo.png` (1024 px, fuente para íconos) y `public/logo-512.webp`
  (el que usa la web). `src/app/og-logo.png` para la imagen de compartir. `npm run icons` regenera
  `public/icons/*` (cliente: logo sobre verde oliva; panel: igual + etiqueta roja "PANEL").
  El logo también puede subirse desde Ajustes → Negocio (`settings.logo_url`), que tiene prioridad.
- **Colores** (CSS vars en `globals.css`, usadas por Tailwind como `ink-*`, `sand-*`, `gold-*`, `terra-*`):
  fondo **verde oliva oscuro** `#14201A` (elegido por el dueño), tarjetas `#1C2B23`, texto crema `#F5ECDC`,
  dorado `#D4A24C`, terracota `#C8553D` (botón principal). Patrón geométrico árabe suave (`public/pattern.svg`).
- Tipografía: **Reem Kufi** (títulos, `font-display`) y **Cairo** (texto).
- Mobile-first, botones grandes, textos en español sencillo (lo usa alguien no técnico).
- Hay skills de diseño en `.claude/skills/` (ui-ux-pro-max, design, brand…), instaladas a pedido del dueño.

## 11. Trampas conocidas (leer antes de cambiar código)

1. **Caché de Next 14**: `fetch` se cachea por defecto en el servidor. Los clientes Supabase de servidor usan
   `noStoreFetch` (`lib/supabase/server.ts`). Sin eso el checkout mostraba menú viejo. No lo quites.
2. **Variables `NEXT_PUBLIC_*` se incrustan al compilar**: cambiarlas en Vercel exige **Redeploy**.
3. **`.pattern-faint` está en `@layer components`** a propósito: fuera de la capa anulaba `fixed` y rompía la
   barra lateral del panel.
4. **Desbloqueo de audio con `click`, no `pointerdown`**: con `pointerdown` el aviso de sonido desaparecía en
   medio del toque, la página se movía y el primer clic del usuario se perdía. El aviso es flotante (no mueve nada).
5. **Nada de `Date.now()` en claves/dependencias de efectos** (Reportes recargaba infinitamente y parpadeaba).
   Usa límites por día (`startOfDayTz`).
6. **Runtime edge** (`opengraph-image.tsx`): no hay `Buffer`; se usa `btoa`.
7. **Funciones de un módulo `'use client'` no se pueden llamar desde un Server Component** (por eso `cashLine`
   vive en `lib/orders.ts`).
8. **Leaflet** usa `window`: importar siempre desde `@/components/map` (carga dinámica sin SSR).
9. **Precios**: el servidor es la fuente de verdad. Si agregas un concepto de precio, impleméntalo en
   `create_order` (SQL) y en la UI; nunca confíes en totales del navegador.
10. **Nuevas funciones SQL**: por defecto `anon/authenticated` NO pueden ejecutarlas (hay `alter default
    privileges … revoke`). Agrega el `grant execute` explícito.
11. **Migraciones**: crear un archivo nuevo en `supabase/migrations/` (no editar los ya aplicados en producción)
    y aplicarlo en Supabase → SQL Editor (o `supabase db push`). El dueño aplica SQL a mano en el editor.
12. **Horario y fechas**: zona `America/Caracas` (`settings.timezone`); usa los helpers de `lib/hours.ts`.
13. **Push**: un cambio de dominio invalida suscripciones y app instalada (hay que reinstalar y reactivar).
14. Textos de error de SQL (`raise exception`) se muestran tal cual al cliente: escríbelos en español claro.

## 12. Dónde quedamos / pendientes

**Estado**: en producción y funcionando. Último trabajo (2-nov): arreglo de notificaciones push con la app
cerrada (era `VAPID_SUBJECT` sin `mailto:`); push de prueba confirmado en la tablet.

Pendientes (por prioridad):

1. ⚠️ **Cambiar la contraseña del admin** (`Habibis2026!` estuvo pública en el README/historial).
   El dueño debe hacerlo en Ajustes → Mi cuenta. El README aún la menciona como la del seed de ejemplo.
2. **Confirmar en la tablet** que suena una notificación con la app cerrada (Android: notificaciones de la
   app en importancia Alta, sin optimización de batería para Chrome, sin "No molestar").
3. **Confirmar el indicador "En vivo"** del panel en un dispositivo real (en el navegador de pruebas del
   agente salía "Reconectando" por el proxy del entorno; un handshake WebSocket directo sí funcionó).
4. **`NEXT_PUBLIC_SITE_URL`** en Vercel = `https://habibis-chi.vercel.app` y Supabase → Auth → Site URL igual.
   Se le indicó al dueño; no confirmado.
5. **Borrar pedidos de prueba** antes de operar (SQL entregado; no confirmado si se ejecutó):
   ```sql
   begin;
   delete from public.orders;            -- cascada: líneas, opciones, historial
   delete from public.customers;
   alter sequence public.order_number_seq restart with 1;
   commit;
   ```
   Los comprobantes de prueba se borran a mano en Storage → `comprobantes`.
6. **Confirmar buckets** `productos` y `comprobantes` en Storage de producción (no verificable con la clave pública).
7. **Supabase gratis se pausa tras 7 días sin actividad**. Se ofreció un cron diario en Vercel
   (`vercel.json` + ruta que haga una consulta mínima); **no implementado**, esperando respuesta.
8. **Vercel Hobby** es para uso no comercial; se recomendó pasar a Pro cuando el negocio opere.
9. **Dominio propio**: no hay aún. Pasos: Vercel → Settings → Domains → Add (y DNS si se compró fuera),
   actualizar `NEXT_PUBLIC_SITE_URL` + Redeploy, Supabase → Auth → Site URL, reinstalar la PWA del panel y
   reactivar push en la tablet.
10. **Rama `main` + protección**: se explicó la opción (crear `main`, cambiar rama de producción en Vercel,
    proteger con PRs). El dueño no decidió aún.
11. **Fotos reales de productos** (hoy todos muestran la inicial) y **menú/precios reales** (el seed es de ejemplo).
12. Datos de pago (Binance Pay ID, pago móvil, transferencia), WhatsApp e Instagram: verificar que el dueño
    reemplazó los de ejemplo (`584120000000`, `123456789`…).
13. El dueño pidió quitar "pedidos recientes" de la portada → ahora es el botón discreto 🧾 "Mis pedidos" (hecho).

Ideas no pedidas (no implementar sin preguntar): cron keep-alive, sonido personalizado de notificación,
modo "por zonas" con polígonos en mapa, fotos con IA, reportes de márgenes.

## 13. Historial de cambios

| Commit | Qué |
|---|---|
| `b723705` | Skills de diseño UI/UX Pro Max en `.claude/skills/` |
| `0eaa780` | Implementación completa: esquema, RLS, funciones, web cliente, panel, PWA, push, docs |
| `c2a5b60` | Fix: caché de fetch en checkout, sidebar fijo, clic perdido en el panel |
| `934df57` | Tema verde oliva (elegido por el dueño), README, DECISIONES |
| `eb606d9` | "Pedidos recientes" → botón "Mis pedidos" en el encabezado |
| `2971405` | Nueva portada (Hero): titular, botones, datos rápidos, favoritos |
| `cd8cfb7` | Fix: Reportes recargaba sin parar (parpadeo) |
| `0530d4d` | Logo oficial en portada, encabezado, íconos PWA y OG |
| `1ed6b94` | Fix: push fallaba con `VAPID_SUBJECT` sin `mailto:`; muestra el motivo si falla |
| `1b5872b` | HANDOFF.md, AGENTS.md (lo lee Codex) y CLAUDE.md (lo lee Claude Code) |

Pruebas de punta a punta realizadas (Playwright + Supabase local en Docker): pedido delivery con Binance y
comprobante, pedido retiro en efectivo, cambios de estado vistos por el cliente en 50–120 ms, alarma y
contador en el panel, comprobante privado con URL firmada, agotado reflejado en la web, reportes, clientes.
No hay suite de tests en el repo (el script E2E vivió fuera del repo).

## 14. Cómo trabajar en el repo

```bash
npm install
cp .env.example .env.local     # rellenar (Supabase local o producción)
npm run dev                    # http://localhost:3000 y /panel
npm run typecheck && npm run lint && npm run build   # SIEMPRE antes de subir
```

- **Supabase local** (requiere Docker): `npx supabase start` aplica migraciones + seed y muestra URL/claves.
  `npx supabase db reset` para empezar de cero. Admin local: `admin@habibis.app` / `Habibis2026!`.
- Para pruebas contra producción en modo lectura basta la clave pública (§2); nunca escribas datos de prueba
  en producción sin avisar al dueño.
- **Publicar**: push a `claude/jolly-bohr-xjbtui` = deploy a producción. Valida antes (typecheck, lint, build).
  Si trabajas en otra rama, Vercel crea un *preview*; para salir en vivo hay que fusionar a esa rama.
- Commits en español, descriptivos. No subir secretos. No reejecutar `seed.sql` en producción.
- Comunicación con el dueño: **en español**, sin jerga, con pasos concretos (dónde tocar en Vercel/Supabase/panel).
- Al terminar una sesión de trabajo, **actualiza la sección 12 y 13 de este archivo**.
