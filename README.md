# Habibis · Web de pedidos + Panel de gestión

Web de pedidos de comida árabe (`/`) y panel interno (`/panel`) en un solo proyecto.

- **Next.js 14** (App Router) + TypeScript + Tailwind, desplegado en **Vercel**
- **Supabase**: base de datos, usuarios, tiempo real y archivos
- Mapas con **Leaflet + OpenStreetMap** (sin clave de Google)
- **Notificaciones push** (Web Push/VAPID) y las dos zonas instalables como app (PWA)

---

## 1. Crear el proyecto en Supabase

1. Entra a <https://supabase.com> con la **cuenta nueva** y crea un proyecto (región: la más cercana, p. ej. *East US*). Guarda la contraseña de la base de datos.
2. En **Project Settings → API** copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` (o *publishable*) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` (o *secret*) → `SUPABASE_SERVICE_ROLE_KEY` (¡secreta!)
3. En **Authentication → Sign In / Providers** desactiva **"Allow new users to sign up"** (no hay registro público).

### Aplicar migraciones y datos de ejemplo

**Opción A — desde el navegador (más fácil):** abre **SQL Editor** y ejecuta, en este orden, el contenido de:

1. `supabase/migrations/20261010000001_schema.sql`
2. `supabase/migrations/20261010000002_functions.sql`
3. `supabase/migrations/20261010000003_rls_storage_realtime.sql`
4. `supabase/migrations/20261010000004_views.sql`
5. `supabase/seed.sql` (menú de ejemplo, tasas, horario y usuario admin)

**Opción B — con la CLI:**

```bash
npx supabase login
npx supabase link --project-ref TU_REF      # el código que aparece en la URL del proyecto
npx supabase db push                        # aplica las migraciones
# luego ejecuta supabase/seed.sql en el SQL Editor
```

## 2. Primer usuario administrador

El `seed.sql` crea uno de ejemplo:

- correo: `admin@habibis.app`
- contraseña: `Habibis2026!`

**Cámbiala al entrar** (Ajustes → Mi cuenta). Si prefieres crear tu propio admin:

```bash
cp .env.example .env.local        # y rellena las variables
node --env-file=.env.local scripts/create-admin.mjs tucorreo@gmail.com "ContraseñaSegura123" "Tu nombre"
```

Los demás usuarios (operador, repartidor) se crean desde **Panel → Ajustes → Usuarios**.

## 3. Claves para notificaciones (VAPID)

```bash
npm install
npm run vapid
```

Copia las dos líneas que imprime (`NEXT_PUBLIC_VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY`). Genéralas **una sola vez**: si las cambias, cada teléfono debe volver a activar las notificaciones.

## 4. Probar en tu computadora

```bash
cp .env.example .env.local   # rellena las variables
npm install
npm run dev                  # http://localhost:3000  y  http://localhost:3000/panel
```

Con Docker puedes usar Supabase local: `npx supabase start` (aplica migraciones y seed automáticamente) y poner en `.env.local` la URL y claves que imprime.

## 5. Desplegar en Vercel

1. Sube el repositorio a GitHub y en <https://vercel.com> → **Add New → Project** → importa el repo (Vercel detecta Next.js).
2. En **Environment Variables** agrega todas las de `.env.example`:

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clave anon/publishable |
| `SUPABASE_SERVICE_ROLE_KEY` | clave service_role (secreta) |
| `NEXT_PUBLIC_SITE_URL` | `https://tu-proyecto.vercel.app` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | de `npm run vapid` |
| `VAPID_SUBJECT` | `mailto:tucorreo@...` |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | `58412…` (respaldo; el principal se edita en el panel) |
| `IP_HASH_SALT` | cualquier texto largo aleatorio |

3. **Deploy**. Después, en Supabase → **Authentication → URL Configuration**, pon la URL de Vercel como *Site URL*.
4. Cuando tengas dominio propio: agrégalo en Vercel → Domains y actualiza `NEXT_PUBLIC_SITE_URL`.

## 6. Instalar el panel en el teléfono y activar notificaciones

**Android (Chrome):**
1. Abre `https://tu-sitio/panel` e inicia sesión.
2. Menú ⋮ → **Instalar aplicación** (o "Agregar a pantalla de inicio"). Aparece el ícono **Habibis Panel**.
3. Ábrelo desde el ícono → **Ajustes → Notificaciones → Activar notificaciones** → Permitir.
4. Toca **Enviar prueba** para comprobar.

**iPhone (iOS 16.4 o superior, Safari):**
1. Abre `https://tu-sitio/panel` en Safari → botón **Compartir** → **Agregar a pantalla de inicio**.
2. Abre la app **desde el ícono** (no desde Safari), inicia sesión.
3. **Ajustes → Notificaciones → Activar notificaciones** → Permitir.

> Con el panel abierto, además suena una **alarma** que se repite hasta que alguien acepta el pedido. La primera vez toca el aviso rojo "Toca para activar el sonido" (los navegadores exigen un toque para reproducir sonido).

Los clientes también pueden instalar la web (`/`) como app desde el navegador.

## 7. Uso diario del panel (guía rápida)

**Al abrir el local**
1. **Ajustes → 💱 Tasas**: escribe cuántos COP y cuántos Bs vale 1 USDT hoy (míralo en Binance P2P) y toca **Guardar tasas**. También puedes probar **Actualizar desde Binance**. Si la tasa tiene más de 12 h, verás un aviso amarillo en Pedidos.
2. Revisa que arriba diga **Abierto**. Si necesitas cerrar antes o abrir fuera de horario, toca ese botón → *Cerrar ahora / Abrir ahora / Según horario*.

**Cuando llega un pedido** (suena la alarma y llega la notificación)
1. Pestaña **Nuevos** → toca el pedido.
2. Si pagó por **Binance o bolívares**: mira el comprobante (tócalo para ampliarlo), revisa que llegó el dinero y toca **Verificar pago** (o **Rechazar pago** con el motivo; el cliente podrá enviar otro comprobante).
3. Si es en **efectivo**: toca **Aceptar pedido**.
4. **En preparación** → **Listo** → (delivery) elige repartidor y **Despachar** → **Entregado**.
5. Después de cada paso aparece **Avisar** para mandarle al cliente un WhatsApp ya escrito.
6. **58mm / 80mm** imprime la comanda para la cocina.

El color del tiempo te avisa: **verde** a tiempo, **amarillo** se está demorando, **rojo** atrasado.

**Se acabó un producto**: **Menú** → apaga el interruptor (queda *Agotado* al instante en la web). Para opciones (p. ej. un tipo de pan): **Menú → Opciones y extras**.

**Pedido por teléfono o en el local**: **Pedidos → + Pedido manual**.

**Al cerrar**: **Reportes → Cierre de caja**: muestra cuánto efectivo debería haber en COP, USD y Bs, y cuánto entró por Binance y bolívares. Marca como *Entregado* todos los pedidos antes de cuadrar.

## Roles

| Rol | Puede |
|---|---|
| Administrador | Todo: menú, precios, tasas, configuración, usuarios, reportes |
| Operador | Pedidos, marcar agotados, abrir/cerrar, clientes. Sin configuración ni reportes de dinero |
| Repartidor | Solo sus entregas asignadas: mapa, llamar, Google Maps/Waze y "Entregado" |

## Estructura

```
src/app/(shop)/        Web del cliente: menú, checkout, seguimiento /pedido/[token]
src/app/panel/         Panel: login, pedidos, menú, ajustes, reportes, clientes, comanda
src/app/api/           Crear pedidos, reenviar comprobante, push, tasas Binance, usuarios
src/components/        Componentes de la web (shop), del panel y mapas
src/lib/               Monedas, horarios, teléfonos, WhatsApp, Supabase, push
supabase/migrations/   Esquema, funciones, seguridad (RLS), storage, realtime
supabase/seed.sql      Datos de ejemplo
public/                Logo, íconos PWA, service worker (sw.js), manifiestos
```

## Cambiar logo y colores

- **Logo**: Panel → Ajustes → Negocio → toca el logo y sube el tuyo (se usa en la web). Para los íconos de la app instalada, reemplaza `public/logo.svg` (o pon tu PNG cuadrado) y ejecuta `npm run icons`.
- **Colores**: están en `src/app/globals.css` (variables `--ink-*` fondo, `--gold-*` dorado, `--terra-*` terracota).

## Comandos

| Comando | Para qué |
|---|---|
| `npm run dev` | Desarrollo local |
| `npm run build` | Compilar para producción |
| `npm run vapid` | Generar claves de notificaciones |
| `npm run icons` | Regenerar íconos PWA desde `public/logo.svg` |
| `npm run create-admin` | Crear/promover un administrador |
