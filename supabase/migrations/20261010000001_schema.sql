-- =====================================================================
-- Habibis · Esquema base
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.staff_role as enum ('admin', 'operador', 'repartidor');

create type public.order_status as enum (
  'nuevo',          -- recién recibido, nadie lo ha aceptado (suena la alarma)
  'aceptado',       -- aceptado por el local; si es pago digital, espera verificación
  'en_preparacion',
  'listo',          -- listo para retirar / despachar
  'en_camino',      -- despachado con repartidor
  'entregado',
  'cancelado'
);

create type public.payment_status as enum (
  'pendiente',          -- pago digital sin comprobante todavía
  'por_verificar',      -- el cliente envió comprobante/referencia
  'verificado',         -- el local confirmó el pago (o se cobró el efectivo)
  'rechazado',          -- el comprobante no es válido
  'cobrar_en_entrega'   -- efectivo: se cobra al entregar/retirar
);

create type public.payment_method as enum ('binance', 'bolivares', 'efectivo');
create type public.delivery_type as enum ('pickup', 'delivery');

-- ---------------------------------------------------------------------
-- Configuración general (una sola fila, id = 1)
-- ---------------------------------------------------------------------
create table public.settings (
  id smallint primary key default 1 check (id = 1),

  -- Negocio
  business_name text not null default 'Habibis',
  tagline text default 'Comida árabe hecha con cariño',
  logo_url text,
  whatsapp_phone text not null default '584120000000',   -- solo dígitos, con código de país
  instagram text default 'habibis',
  address text default 'Dirección por definir',
  city text default 'Ciudad por definir',
  store_lat double precision default 10.4806,
  store_lng double precision default -66.9036,
  timezone text not null default 'America/Caracas',

  -- Operación
  min_order_cop integer not null default 0 check (min_order_cop >= 0),
  prep_time_min integer not null default 25 check (prep_time_min >= 0),
  delivery_time_min integer not null default 30 check (delivery_time_min >= 0),
  open_override text not null default 'auto' check (open_override in ('auto', 'open', 'closed')),
  allow_scheduled boolean not null default true,
  allow_scheduled_when_closed boolean not null default true,
  pickup_enabled boolean not null default true,
  delivery_enabled boolean not null default true,

  -- Delivery
  delivery_mode text not null default 'flat' check (delivery_mode in ('flat', 'zones')),
  delivery_fee_cop integer not null default 5000 check (delivery_fee_cop >= 0),

  -- Moneda
  cop_rounding integer not null default 100 check (cop_rounding >= 1),
  rate_stale_hours integer not null default 12 check (rate_stale_hours > 0),

  -- Pagos
  binance_pay_id text default '',
  binance_email text default '',
  binance_name text default '',
  pago_movil_bank text default '',
  pago_movil_phone text default '',
  pago_movil_id text default '',
  transfer_bank text default '',
  transfer_account text default '',
  transfer_holder text default '',
  transfer_id text default '',
  cash_currencies text[] not null default array['COP', 'USD', 'BS'],
  accept_binance boolean not null default true,
  accept_bolivares boolean not null default true,
  accept_cash boolean not null default true,

  -- Antispam
  rate_limit_phone integer not null default 3,
  rate_limit_ip integer not null default 6,
  rate_limit_window_min integer not null default 10,

  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Tasas del día (historial; la vigente es la más reciente)
-- ---------------------------------------------------------------------
create table public.exchange_rates (
  id bigint generated always as identity primary key,
  cop_per_usdt numeric(14, 4) not null check (cop_per_usdt > 0),
  bs_per_usdt numeric(14, 4) not null check (bs_per_usdt > 0),
  source text not null default 'manual' check (source in ('manual', 'binance')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index exchange_rates_created_at_idx on public.exchange_rates (created_at desc);

-- ---------------------------------------------------------------------
-- Zonas de delivery (modo opcional "por zonas")
-- ---------------------------------------------------------------------
create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  fee_cop integer not null check (fee_cop >= 0),
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Horario (0 = domingo … 6 = sábado). Si close_time < open_time cruza medianoche.
-- ---------------------------------------------------------------------
create table public.business_hours (
  day_of_week smallint primary key check (day_of_week between 0 and 6),
  is_open boolean not null default true,
  open_time time not null default '11:00',
  close_time time not null default '22:00'
);

-- ---------------------------------------------------------------------
-- Menú
-- ---------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  name text not null,
  description text not null default '',
  price_cop integer not null check (price_cop >= 0),
  image_url text,
  tags text[] not null default '{}',   -- vegetariano | picante | nuevo | mas_pedido
  available boolean not null default true,  -- false = "Agotado"
  active boolean not null default true,     -- false = oculto del menú
  is_combo boolean not null default false,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_idx on public.products (category_id, sort);

-- Componentes de un combo (informativo + validación de disponibilidad)
create table public.combo_items (
  combo_id uuid not null references public.products (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  primary key (combo_id, product_id),
  check (combo_id <> product_id)
);

create table public.modifier_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,                 -- lo que ve el cliente: "Tipo de pan"
  internal_name text,                 -- opcional, para distinguir grupos parecidos en el panel
  selection_type text not null default 'single' check (selection_type in ('single', 'multiple')),
  is_required boolean not null default false,
  min_select integer not null default 0 check (min_select >= 0),
  max_select integer not null default 1 check (max_select >= 1),
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  check (min_select <= max_select)
);

create table public.modifier_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.modifier_groups (id) on delete cascade,
  name text not null,
  price_cop integer not null default 0,   -- puede ser 0 ("Sin cebolla")
  available boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
create index modifier_options_group_idx on public.modifier_options (group_id, sort);

create table public.product_modifier_groups (
  product_id uuid not null references public.products (id) on delete cascade,
  group_id uuid not null references public.modifier_groups (id) on delete cascade,
  sort integer not null default 0,
  primary key (product_id, group_id)
);

-- ---------------------------------------------------------------------
-- Personal del panel
-- ---------------------------------------------------------------------
create table public.staff_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  role public.staff_role not null default 'operador',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Clientes (se crean/actualizan automáticamente al pedir)
-- ---------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  name text not null,
  cedula text,
  addresses jsonb not null default '[]'::jsonb,  -- [{address, reference, lat, lng, used_at}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------
create sequence public.order_number_seq start 1;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number integer not null unique default nextval('public.order_number_seq'),
  code text not null unique,
  tracking_token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  source text not null default 'web' check (source in ('web', 'manual')),

  customer_id uuid references public.customers (id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  customer_cedula text,

  delivery_type public.delivery_type not null,
  address text,
  address_reference text,
  lat double precision,
  lng double precision,
  zone_id uuid references public.delivery_zones (id) on delete set null,
  zone_name text,

  -- Montos (COP es la moneda base)
  subtotal_cop integer not null default 0,
  delivery_fee_cop integer not null default 0,
  total_cop integer not null default 0,
  total_usdt numeric(14, 2) not null default 0,
  total_bs numeric(16, 2) not null default 0,
  -- Foto de las tasas usadas (no se recalcula después)
  rate_cop_usdt numeric(14, 4) not null,
  rate_bs_usdt numeric(14, 4) not null,
  rate_id bigint references public.exchange_rates (id) on delete set null,

  payment_method public.payment_method not null,
  payment_status public.payment_status not null,
  payment_reference text,
  proof_path text,
  payment_reject_reason text,
  payment_verified_at timestamptz,
  payment_verified_by uuid references auth.users (id) on delete set null,
  cash_currency text check (cash_currency in ('COP', 'USD', 'BS')),
  cash_amount numeric(16, 2),

  status public.order_status not null default 'nuevo',
  cancel_reason text,
  notes text,
  scheduled_for timestamptz,

  driver_id uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  ready_at timestamptz,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,

  ip_hash text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_status_idx on public.orders (status, created_at desc);
create index orders_created_idx on public.orders (created_at desc);
create index orders_phone_idx on public.orders (customer_phone, created_at desc);
create index orders_ip_idx on public.orders (ip_hash, created_at desc);
create index orders_driver_idx on public.orders (driver_id) where driver_id is not null;

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  base_price_cop integer not null,
  unit_price_cop integer not null,   -- base + modificadores
  quantity integer not null check (quantity > 0),
  line_total_cop integer not null,
  notes text,
  sort integer not null default 0
);
create index order_items_order_idx on public.order_items (order_id);

create table public.order_item_modifiers (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  option_id uuid references public.modifier_options (id) on delete set null,
  group_name text not null,
  option_name text not null,
  price_cop integer not null default 0
);
create index order_item_modifiers_item_idx on public.order_item_modifiers (order_item_id);

create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  status text not null,     -- estado o evento (pago_verificado, pago_rechazado, …)
  note text,
  changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

-- ---------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
create trigger customers_touch before update on public.customers
  for each row execute function public.touch_updated_at();
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- Fila única de configuración y horario por defecto
insert into public.settings (id) values (1) on conflict do nothing;
insert into public.business_hours (day_of_week)
  select generate_series(0, 6) on conflict do nothing;
