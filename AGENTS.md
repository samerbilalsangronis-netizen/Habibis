# AGENTS.md · Habibis

Instrucciones para agentes de código (Codex, Claude Code, etc.). **Lee `HANDOFF.md` completo antes de
cambiar nada**: explica el negocio, cómo funciona la web y el panel, la base de datos, las trampas conocidas
y dónde quedó el trabajo (sección 12).

## Proyecto en una línea
Web de pedidos de comida árabe (`/`) + panel interno (`/panel`) para Habibis (Venezuela).
Next.js 14 App Router + TypeScript + Tailwind 3 + Supabase (Postgres, Auth, Realtime, Storage) en Vercel.
Producción: https://habibis-chi.vercel.app

## Reglas
- **La rama `claude/jolly-bohr-xjbtui` es producción** (no hay `main`). Un push ahí se publica en vivo en ~2 min.
  Para cambios grandes o dudosos, usa otra rama (Vercel genera un preview) y pide confirmación al dueño.
- Antes de cada commit: `npm run typecheck && npm run lint && npm run build`. Las tres deben pasar.
- **El servidor es la fuente de verdad de precios**: el navegador solo envía ids y cantidades. Cualquier
  cambio de precios/totales va en `create_order` (SQL) y en `src/lib/money.ts` a la vez.
- **SQL**: nunca edites migraciones ya aplicadas; crea `supabase/migrations/<fecha>_<nombre>.sql` nuevo.
  Las funciones nuevas necesitan `grant execute` explícito. El dueño aplica el SQL en Supabase → SQL Editor:
  dile exactamente qué pegar. **No reejecutar `supabase/seed.sql` en producción.**
- RLS activo en todas las tablas: respeta los roles admin / operador / repartidor.
- No subas secretos (`.env.local`, service role key, VAPID privada). `.env.example` documenta los nombres.
- Si cambias assets que cachea `public/sw.js`, incrementa su `VERSION`.
- Textos de UI y mensajes de error en **español sencillo** (lo usa una persona no técnica desde una tablet).
- Mobile-first; mantén la identidad visual (verde oliva `#14201A`, dorado, terracota, logo oficial).
- No toques `.claude/skills/` (skills de diseño instaladas por el dueño).
- Al terminar, **actualiza `HANDOFF.md` §12 (pendientes) y §13 (historial)**.

## Comandos
```bash
npm install
npm run dev          # http://localhost:3000  ·  /panel
npm run typecheck
npm run lint
npm run build
npm run vapid        # generar claves Web Push
npm run icons        # regenerar íconos PWA desde public/logo.png
npx supabase start   # Supabase local (Docker): migraciones + seed; admin@habibis.app / Habibis2026!
```

## Mapa rápido
- Cliente: `src/app/(shop)/`, `src/components/shop/` (MenuView, Hero, ProductSheet, CheckoutView, TrackingView)
- Panel: `src/app/panel/`, `src/components/panel/` (PanelContext = realtime + alarma; OrdersBoard; OrderDetail; SettingsPage)
- API: `src/app/api/` (orders, push, rates/binance, staff)
- Lógica compartida: `src/lib/` (money, hours, status, whatsapp, push, supabase/*)
- Base de datos: `supabase/migrations/` (0002_functions.sql = reglas de negocio)
- Documentos: `HANDOFF.md` (contexto técnico), `README.md` (guía del dueño), `DECISIONES.md` (supuestos)
