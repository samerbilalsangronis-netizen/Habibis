-- =====================================================================
-- Habibis · Row Level Security, Storage y Realtime
-- =====================================================================

alter table public.settings enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.business_hours enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.combo_items enable row level security;
alter table public.modifier_groups enable row level security;
alter table public.modifier_options enable row level security;
alter table public.product_modifier_groups enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_modifiers enable row level security;
alter table public.order_status_history enable row level security;

-- ---------------------------------------------------------------------
-- Lectura pública: menú, horarios, zonas, tasas y datos de pago
-- ---------------------------------------------------------------------
create policy "publico lee settings" on public.settings for select using (true);
create policy "publico lee tasas" on public.exchange_rates for select using (true);
create policy "publico lee horario" on public.business_hours for select using (true);
create policy "publico lee zonas activas" on public.delivery_zones for select
  using (active or public.is_staff());
create policy "publico lee categorias activas" on public.categories for select
  using (active or public.is_staff());
create policy "publico lee productos activos" on public.products for select
  using (active or public.is_staff());
create policy "publico lee combos" on public.combo_items for select using (true);
create policy "publico lee grupos" on public.modifier_groups for select using (true);
create policy "publico lee opciones" on public.modifier_options for select using (true);
create policy "publico lee producto-grupos" on public.product_modifier_groups for select using (true);

-- ---------------------------------------------------------------------
-- Escritura de configuración y menú: solo admin
-- (el operador cambia disponibilidad y abre/cierra con funciones dedicadas)
-- ---------------------------------------------------------------------
create policy "admin edita settings" on public.settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "admin crea tasas" on public.exchange_rates for insert to authenticated
  with check (public.is_admin());

create policy "admin gestiona horario" on public.business_hours for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin gestiona zonas" on public.delivery_zones for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin gestiona categorias" on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin gestiona productos" on public.products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin gestiona combos" on public.combo_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin gestiona grupos" on public.modifier_groups for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin gestiona opciones" on public.modifier_options for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin gestiona producto-grupos" on public.product_modifier_groups for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Personal
-- ---------------------------------------------------------------------
create policy "staff se ve a si mismo y admin a todos" on public.staff_profiles for select to authenticated
  using (user_id = auth.uid() or public.is_manager());
create policy "admin gestiona personal" on public.staff_profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "cada usuario gestiona sus suscripciones push" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_staff());

-- ---------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------
create policy "manager lee clientes" on public.customers for select to authenticated
  using (public.is_manager());
create policy "admin edita clientes" on public.customers for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Pedidos: sin acceso anónimo directo. Se crean con create_order() vía la
-- ruta API y el cliente los lee con get_order_tracking(token).
-- Los cambios de estado pasan por order_action().
-- ---------------------------------------------------------------------
create policy "staff lee pedidos segun rol" on public.orders for select to authenticated
  using (public.is_manager() or (driver_id = auth.uid() and public.is_staff()));

create policy "admin corrige pedidos" on public.orders for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "staff lee lineas" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));
create policy "staff lee modificadores de lineas" on public.order_item_modifiers for select to authenticated
  using (exists (select 1 from public.order_items i where i.id = order_item_id));
create policy "staff lee historial" on public.order_status_history for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

-- ---------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('productos', 'productos', true, 5242880,
   array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml']),
  ('comprobantes', 'comprobantes', false, 8388608,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do nothing;

-- Fotos de productos / logo: lectura pública (bucket público), escritura admin
create policy "admin sube fotos" on storage.objects for insert to authenticated
  with check (bucket_id = 'productos' and public.is_admin());
create policy "admin actualiza fotos" on storage.objects for update to authenticated
  using (bucket_id = 'productos' and public.is_admin());
create policy "admin borra fotos" on storage.objects for delete to authenticated
  using (bucket_id = 'productos' and public.is_admin());

-- Comprobantes: privados. Los sube el servidor (service_role); solo el personal
-- (admin/operador) puede verlos mediante URLs firmadas.
create policy "staff ve comprobantes" on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes' and public.is_manager());

-- ---------------------------------------------------------------------
-- Realtime: el panel escucha cambios en pedidos (respeta RLS)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.orders;
    alter publication supabase_realtime add table public.products;
    alter publication supabase_realtime add table public.modifier_options;
    alter publication supabase_realtime add table public.settings;
    alter publication supabase_realtime add table public.exchange_rates;
  end if;
end $$;
