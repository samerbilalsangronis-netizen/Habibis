-- =====================================================================
-- Habibis · Funciones de negocio
-- Todas las operaciones sensibles (crear pedido, cambiar estado) pasan por
-- funciones SECURITY DEFINER que validan rol y recalculan montos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Roles del personal
-- ---------------------------------------------------------------------
create or replace function public.current_staff_role() returns public.staff_role
language sql stable security definer set search_path = public as $$
  select role from public.staff_profiles where user_id = auth.uid() and active
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_profiles where user_id = auth.uid() and active)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_profiles where user_id = auth.uid() and active and role = 'admin')
$$;

-- admin u operador (gestionan pedidos y disponibilidad)
create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_profiles
                 where user_id = auth.uid() and active and role in ('admin', 'operador'))
$$;

-- ---------------------------------------------------------------------
-- Horario
-- ---------------------------------------------------------------------
-- ¿El instante p_ts cae dentro del horario configurado? (ignora el botón manual)
create or replace function public.is_within_hours(p_ts timestamptz) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_tz text;
  v_local timestamp;
  v_dow int;
  v_t time;
begin
  select timezone into v_tz from public.settings where id = 1;
  v_local := p_ts at time zone coalesce(v_tz, 'America/Caracas');
  v_dow := extract(dow from v_local)::int;
  v_t := v_local::time;

  return exists (
    select 1 from public.business_hours h
    where h.is_open and (
      -- mismo día
      (h.day_of_week = v_dow and (
        (h.open_time < h.close_time and v_t >= h.open_time and v_t < h.close_time)
        or (h.open_time > h.close_time and v_t >= h.open_time)
        or (h.open_time = h.close_time)  -- abierto 24 h
      ))
      -- horario del día anterior que cruza medianoche
      or (h.day_of_week = (v_dow + 6) % 7 and h.open_time > h.close_time and v_t < h.close_time)
    )
  );
end $$;

-- ¿Está abierto ahora? (considera "Cerrar ahora / Abrir ahora")
create or replace function public.is_open_now() returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_override text;
begin
  select open_override into v_override from public.settings where id = 1;
  if v_override = 'open' then return true; end if;
  if v_override = 'closed' then return false; end if;
  return public.is_within_hours(now());
end $$;

-- ---------------------------------------------------------------------
-- Tasa vigente
-- ---------------------------------------------------------------------
create or replace function public.current_rate() returns public.exchange_rates
language sql stable security definer set search_path = public as $$
  select * from public.exchange_rates order by created_at desc, id desc limit 1
$$;

-- Redondeo de COP al múltiplo configurado (100 = a la centena)
create or replace function public.round_cop(p_amount numeric, p_step integer) returns integer
language sql immutable as $$
  select (round(p_amount / greatest(p_step, 1)) * greatest(p_step, 1))::integer
$$;

-- ---------------------------------------------------------------------
-- Crear pedido
-- El navegador envía SOLO ids y cantidades: precios, delivery, tasas y
-- totales se calculan aquí con los datos de la base.
-- ---------------------------------------------------------------------
create or replace function public.create_order(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  s public.settings%rowtype;
  r public.exchange_rates%rowtype;
  v_source text := coalesce(nullif(p ->> 'source', ''), 'web');
  v_is_manager boolean := public.is_manager();
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p -> 'customer' ->> 'name', ''));
  v_phone text := btrim(coalesce(p -> 'customer' ->> 'phone', ''));
  v_cedula text := nullif(btrim(coalesce(p -> 'customer' ->> 'cedula', '')), '');
  v_delivery public.delivery_type;
  v_method public.payment_method;
  v_pay_status public.payment_status;
  v_sched timestamptz := nullif(p ->> 'scheduled_for', '')::timestamptz;
  v_address text := nullif(btrim(coalesce(p ->> 'address', '')), '');
  v_reference text := nullif(btrim(coalesce(p ->> 'address_reference', '')), '');
  v_lat double precision := nullif(p ->> 'lat', '')::double precision;
  v_lng double precision := nullif(p ->> 'lng', '')::double precision;
  v_zone public.delivery_zones%rowtype;
  v_proof text := nullif(p ->> 'proof_path', '');
  v_pay_ref text := nullif(btrim(coalesce(p ->> 'payment_reference', '')), '');
  v_cash_currency text := nullif(p ->> 'cash_currency', '');
  v_cash_amount numeric := nullif(p ->> 'cash_amount', '')::numeric;
  v_ip text := nullif(p ->> 'ip_hash', '');
  v_notes text := nullif(btrim(coalesce(p ->> 'notes', '')), '');
  v_order_id uuid := gen_random_uuid();
  v_number integer;
  v_code text;
  v_token text;
  v_item jsonb;
  v_prod public.products%rowtype;
  v_qty integer;
  v_unit integer;
  v_sub integer := 0;
  v_fee integer := 0;
  v_total integer;
  v_item_id uuid;
  v_opt_ids uuid[];
  v_grp record;
  v_cnt integer;
  v_bad text;
  v_sort integer := 0;
  v_customer_id uuid;
begin
  if v_source not in ('web', 'manual') then
    raise exception 'Origen de pedido inválido';
  end if;
  if v_source = 'manual' and not v_is_manager then
    raise exception 'Solo el personal puede crear pedidos manuales';
  end if;

  select * into s from public.settings where id = 1;
  select * into r from public.exchange_rates order by created_at desc, id desc limit 1;
  if r.id is null then
    raise exception 'El local aún no ha configurado la tasa del día. Intenta más tarde.';
  end if;

  -- Cliente
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Escribe tu nombre (2 a 80 caracteres)';
  end if;
  if v_phone !~ '^\+[0-9]{10,15}$' then
    raise exception 'Teléfono inválido';
  end if;
  if v_cedula is not null and v_cedula !~ '^[VEJPGvejpg]?-?[0-9.]{5,12}$' then
    raise exception 'Cédula inválida';
  end if;

  begin
    v_delivery := (p ->> 'delivery_type')::public.delivery_type;
    v_method := (p ->> 'payment_method')::public.payment_method;
  exception when others then
    raise exception 'Tipo de entrega o método de pago inválido';
  end;
  if v_delivery is null or v_method is null then
    raise exception 'Tipo de entrega o método de pago inválido';
  end if;

  -- Reglas solo para pedidos web
  if v_source = 'web' then
    -- Horario
    if v_sched is not null then
      if not s.allow_scheduled then
        raise exception 'Por ahora no aceptamos pedidos programados';
      end if;
      if v_sched < now() + interval '20 minutes' or v_sched > now() + interval '7 days' then
        raise exception 'La hora programada debe ser al menos 20 minutos después de ahora y dentro de 7 días';
      end if;
      if not public.is_within_hours(v_sched) then
        raise exception 'La hora programada está fuera del horario de atención';
      end if;
      if not public.is_open_now() and not s.allow_scheduled_when_closed then
        raise exception 'El local está cerrado en este momento';
      end if;
    elsif not public.is_open_now() then
      raise exception 'El local está cerrado en este momento. Puedes ver el menú o programar tu pedido.';
    end if;

    -- Antispam
    select count(*) into v_cnt from public.orders
      where customer_phone = v_phone
        and created_at > now() - make_interval(mins => s.rate_limit_window_min);
    if v_cnt >= s.rate_limit_phone then
      raise exception 'Has hecho varios pedidos seguidos. Espera unos minutos o escríbenos por WhatsApp.';
    end if;
    if v_ip is not null then
      select count(*) into v_cnt from public.orders
        where ip_hash = v_ip
          and created_at > now() - make_interval(mins => s.rate_limit_window_min);
      if v_cnt >= s.rate_limit_ip then
        raise exception 'Demasiados pedidos desde esta conexión. Espera unos minutos.';
      end if;
    end if;

    -- Método de pago habilitado
    if (v_method = 'binance' and not s.accept_binance)
       or (v_method = 'bolivares' and not s.accept_bolivares)
       or (v_method = 'efectivo' and not s.accept_cash) then
      raise exception 'Ese método de pago no está disponible';
    end if;
  end if;

  -- Entrega
  if v_delivery = 'pickup' then
    if not s.pickup_enabled and v_source = 'web' then
      raise exception 'El retiro en local no está disponible';
    end if;
    v_address := null; v_reference := null; v_lat := null; v_lng := null;
  else
    if not s.delivery_enabled and v_source = 'web' then
      raise exception 'El delivery no está disponible en este momento';
    end if;
    if v_address is null or char_length(v_address) < 5 then
      raise exception 'Escribe la dirección de entrega';
    end if;
    if v_source = 'web' and (v_lat is null or v_lng is null) then
      raise exception 'Marca tu ubicación en el mapa';
    end if;
    if v_lat is not null and (v_lat not between -90 and 90 or v_lng not between -180 and 180) then
      raise exception 'Ubicación inválida';
    end if;
    if s.delivery_mode = 'zones' then
      select * into v_zone from public.delivery_zones
        where id = nullif(p ->> 'zone_id', '')::uuid and active;
      if v_zone.id is null then
        raise exception 'Selecciona una zona de delivery válida';
      end if;
      v_fee := v_zone.fee_cop;
    else
      v_fee := s.delivery_fee_cop;
    end if;
  end if;

  -- Pago
  if v_method = 'efectivo' then
    v_pay_status := 'cobrar_en_entrega';
    v_proof := null; v_pay_ref := null;
    if v_cash_currency is not null and v_cash_currency not in ('COP', 'USD', 'BS') then
      raise exception 'Moneda de efectivo inválida';
    end if;
    if v_cash_currency is not null and v_source = 'web'
       and not (v_cash_currency = any (s.cash_currencies)) then
      raise exception 'No aceptamos efectivo en esa moneda';
    end if;
    if v_cash_amount is not null and v_cash_amount < 0 then
      raise exception 'Monto de efectivo inválido';
    end if;
  else
    v_cash_currency := null; v_cash_amount := null;
    if v_source = 'manual' and coalesce((p ->> 'payment_verified')::boolean, false) then
      v_pay_status := 'verificado';
    elsif v_proof is not null or v_pay_ref is not null then
      v_pay_status := 'por_verificar';
    elsif v_source = 'web' then
      raise exception 'Sube el comprobante o escribe la referencia del pago';
    else
      v_pay_status := 'pendiente';
    end if;
  end if;

  if jsonb_typeof(p -> 'items') <> 'array' or jsonb_array_length(p -> 'items') = 0 then
    raise exception 'El carrito está vacío';
  end if;
  if jsonb_array_length(p -> 'items') > 60 then
    raise exception 'Demasiados productos en un solo pedido';
  end if;

  -- Cabecera del pedido (montos se completan abajo)
  v_number := nextval('public.order_number_seq');
  v_code := 'HB-' || lpad(v_number::text, 4, '0');

  insert into public.orders (
    id, number, code, source, customer_name, customer_phone, customer_cedula,
    delivery_type, address, address_reference, lat, lng, zone_id, zone_name,
    rate_cop_usdt, rate_bs_usdt, rate_id,
    payment_method, payment_status, payment_reference, proof_path,
    cash_currency, cash_amount, scheduled_for, notes, ip_hash, created_by,
    payment_verified_at, payment_verified_by
  ) values (
    v_order_id, v_number, v_code, v_source, v_name, v_phone, v_cedula,
    v_delivery, v_address, v_reference, v_lat, v_lng, v_zone.id, v_zone.name,
    r.cop_per_usdt, r.bs_per_usdt, r.id,
    v_method, v_pay_status, v_pay_ref, v_proof,
    v_cash_currency, v_cash_amount, v_sched, v_notes, v_ip, v_uid,
    case when v_pay_status = 'verificado' then now() end,
    case when v_pay_status = 'verificado' then v_uid end
  ) returning tracking_token into v_token;

  -- Líneas
  for v_item in select * from jsonb_array_elements(p -> 'items') loop
    v_sort := v_sort + 1;
    select * into v_prod from public.products
      where id = nullif(v_item ->> 'product_id', '')::uuid and active;
    if v_prod.id is null then
      raise exception 'Uno de los productos ya no está en el menú. Actualiza la página.';
    end if;
    if not v_prod.available then
      raise exception '"%" está agotado', v_prod.name;
    end if;
    if v_prod.is_combo then
      select string_agg(cp.name, ', ') into v_bad
        from public.combo_items ci join public.products cp on cp.id = ci.product_id
        where ci.combo_id = v_prod.id and (not cp.available or not cp.active);
      if v_bad is not null then
        raise exception '"%" no está disponible (agotado: %)', v_prod.name, v_bad;
      end if;
    end if;

    v_qty := coalesce((v_item ->> 'quantity')::integer, 0);
    if v_qty < 1 or v_qty > 50 then
      raise exception 'Cantidad inválida para "%"', v_prod.name;
    end if;

    select coalesce(array_agg(distinct x::uuid), '{}') into v_opt_ids
      from jsonb_array_elements_text(coalesce(v_item -> 'option_ids', '[]'::jsonb)) x;

    -- Todas las opciones deben pertenecer a grupos del producto
    select string_agg(coalesce(o.name, '?'), ', ') into v_bad
      from unnest(v_opt_ids) oid
      left join public.modifier_options o on o.id = oid
      where o.id is null or not exists (
        select 1 from public.product_modifier_groups pmg
        where pmg.product_id = v_prod.id and pmg.group_id = o.group_id);
    if v_bad is not null then
      raise exception 'Opciones inválidas para "%". Actualiza la página.', v_prod.name;
    end if;

    select string_agg(o.name, ', ') into v_bad
      from public.modifier_options o where o.id = any (v_opt_ids) and not o.available;
    if v_bad is not null then
      raise exception 'Opción agotada en "%": %', v_prod.name, v_bad;
    end if;

    -- Reglas de cada grupo
    for v_grp in
      select g.* from public.modifier_groups g
      join public.product_modifier_groups pmg on pmg.group_id = g.id
      where pmg.product_id = v_prod.id
    loop
      select count(*) into v_cnt from public.modifier_options o
        where o.group_id = v_grp.id and o.id = any (v_opt_ids);
      if v_grp.is_required and v_cnt < greatest(v_grp.min_select, 1) then
        raise exception 'Elige "%" en "%"', v_grp.name, v_prod.name;
      end if;
      if v_cnt > 0 and v_cnt < v_grp.min_select then
        raise exception 'Elige al menos % en "%" (%)', v_grp.min_select, v_grp.name, v_prod.name;
      end if;
      if v_grp.selection_type = 'single' and v_cnt > 1 then
        raise exception 'Solo puedes elegir una opción en "%" (%)', v_grp.name, v_prod.name;
      end if;
      if v_cnt > v_grp.max_select then
        raise exception 'Máximo % opciones en "%" (%)', v_grp.max_select, v_grp.name, v_prod.name;
      end if;
    end loop;

    select v_prod.price_cop + coalesce(sum(o.price_cop), 0) into v_unit
      from public.modifier_options o where o.id = any (v_opt_ids);
    v_unit := greatest(v_unit, 0);

    insert into public.order_items (order_id, product_id, product_name, base_price_cop,
                                    unit_price_cop, quantity, line_total_cop, notes, sort)
    values (v_order_id, v_prod.id, v_prod.name, v_prod.price_cop, v_unit, v_qty,
            v_unit * v_qty, nullif(left(btrim(coalesce(v_item ->> 'notes', '')), 200), ''), v_sort)
    returning id into v_item_id;

    insert into public.order_item_modifiers (order_item_id, option_id, group_name, option_name, price_cop)
    select v_item_id, o.id, g.name, o.name, o.price_cop
      from public.modifier_options o join public.modifier_groups g on g.id = o.group_id
      where o.id = any (v_opt_ids)
      order by g.sort, o.sort;

    v_sub := v_sub + v_unit * v_qty;
  end loop;

  if v_source = 'web' and v_sub < s.min_order_cop then
    raise exception 'El pedido mínimo es de % COP', to_char(s.min_order_cop, 'FM999G999G999');
  end if;

  v_total := public.round_cop(v_sub + v_fee, s.cop_rounding);

  -- Si el cliente vio otro total u otra tasa (cambió mientras pedía), se avisa
  -- antes de guardar para que no pague un monto desactualizado.
  if v_source = 'web' then
    if nullif(p ->> 'expected_rate_id', '') is not null and (p ->> 'expected_rate_id')::bigint <> r.id then
      raise exception 'La tasa del día se actualizó mientras hacías tu pedido. Revisa el nuevo total antes de pagar.'
        using errcode = 'HB409';
    end if;
    if nullif(p ->> 'expected_total_cop', '') is not null and (p ->> 'expected_total_cop')::integer <> v_total then
      raise exception 'Algunos precios cambiaron mientras hacías tu pedido. Revisa el nuevo total antes de pagar.'
        using errcode = 'HB409';
    end if;
  end if;

  update public.orders set
    subtotal_cop = v_sub,
    delivery_fee_cop = v_fee,
    total_cop = v_total,
    total_usdt = round(v_total / r.cop_per_usdt, 2),
    total_bs = round(v_total / r.cop_per_usdt * r.bs_per_usdt, 2)
  where id = v_order_id;

  -- Cliente (lista automática por teléfono)
  insert into public.customers (phone, name, cedula, addresses)
  values (v_phone, v_name, v_cedula,
          case when v_address is not null then jsonb_build_array(jsonb_build_object(
            'address', v_address, 'reference', v_reference, 'lat', v_lat, 'lng', v_lng,
            'used_at', now())) else '[]'::jsonb end)
  on conflict (phone) do update set
    name = excluded.name,
    cedula = coalesce(excluded.cedula, public.customers.cedula),
    addresses = case
      when v_address is null then public.customers.addresses
      else (
        select coalesce(jsonb_agg(a), '[]'::jsonb) from (
          select a from (
            select excluded.addresses -> 0 as a, 0 as ord
            union all
            select e, row_number() over () as ord
              from jsonb_array_elements(public.customers.addresses) e
              where lower(e ->> 'address') <> lower(v_address)
          ) t order by ord limit 5
        ) t2
      ) end
  returning id into v_customer_id;

  update public.orders set customer_id = v_customer_id where id = v_order_id;

  insert into public.order_status_history (order_id, status, note, changed_by)
  values (v_order_id, 'nuevo',
          case when v_source = 'manual' then 'Pedido creado desde el panel' end, v_uid);

  return jsonb_build_object(
    'id', v_order_id,
    'code', v_code,
    'token', v_token,
    'subtotal_cop', v_sub,
    'delivery_fee_cop', v_fee,
    'total_cop', v_total,
    'total_usdt', round(v_total / r.cop_per_usdt, 2),
    'total_bs', round(v_total / r.cop_per_usdt * r.bs_per_usdt, 2)
  );
end $$;

-- ---------------------------------------------------------------------
-- Cambiar estado de un pedido (panel)
-- ---------------------------------------------------------------------
create or replace function public.order_action(
  p_order_id uuid,
  p_action text,
  p_note text default null,
  p_driver uuid default null
) returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  v_role public.staff_role := public.current_staff_role();
  v_uid uuid := auth.uid();
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_event text := p_action;
begin
  if v_role is null then
    raise exception 'No autorizado';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then
    raise exception 'Pedido no encontrado';
  end if;

  if v_role = 'repartidor' then
    if o.driver_id is distinct from v_uid or p_action <> 'entregado' then
      raise exception 'No autorizado';
    end if;
  end if;

  if o.status in ('entregado', 'cancelado') and p_action <> 'nota' then
    raise exception 'El pedido ya está %', o.status;
  end if;

  case p_action
    when 'aceptar' then
      if o.status <> 'nuevo' then raise exception 'El pedido ya fue aceptado'; end if;
      update public.orders set status = 'aceptado', accepted_at = now(), accepted_by = v_uid
        where id = o.id;
      v_event := 'aceptado';

    when 'verificar_pago' then
      if o.payment_method = 'efectivo' then raise exception 'El efectivo se cobra al entregar'; end if;
      update public.orders set
        payment_status = 'verificado', payment_verified_at = now(), payment_verified_by = v_uid,
        payment_reject_reason = null,
        status = case when status = 'nuevo' then 'aceptado'::public.order_status else status end,
        accepted_at = coalesce(accepted_at, now()), accepted_by = coalesce(accepted_by, v_uid)
        where id = o.id;
      v_event := 'pago_verificado';

    when 'rechazar_pago' then
      if o.payment_method = 'efectivo' then raise exception 'El efectivo se cobra al entregar'; end if;
      if v_note is null then raise exception 'Escribe el motivo del rechazo'; end if;
      update public.orders set
        payment_status = 'rechazado', payment_reject_reason = v_note,
        status = case when status = 'nuevo' then 'aceptado'::public.order_status else status end,
        accepted_at = coalesce(accepted_at, now()), accepted_by = coalesce(accepted_by, v_uid)
        where id = o.id;
      v_event := 'pago_rechazado';

    when 'preparar' then
      if o.status not in ('nuevo', 'aceptado') then raise exception 'No se puede pasar a preparación'; end if;
      if o.payment_status not in ('verificado', 'cobrar_en_entrega') then
        raise exception 'Primero verifica el pago';
      end if;
      update public.orders set status = 'en_preparacion',
        accepted_at = coalesce(accepted_at, now()), accepted_by = coalesce(accepted_by, v_uid)
        where id = o.id;
      v_event := 'en_preparacion';

    when 'listo' then
      if o.status not in ('aceptado', 'en_preparacion') then raise exception 'No se puede marcar listo'; end if;
      if o.payment_status not in ('verificado', 'cobrar_en_entrega') then
        raise exception 'Primero verifica el pago';
      end if;
      update public.orders set status = 'listo', ready_at = now(),
        accepted_at = coalesce(accepted_at, now())
        where id = o.id;
      v_event := 'listo';

    when 'despachar' then
      if o.delivery_type <> 'delivery' then raise exception 'Este pedido es para retirar'; end if;
      if o.status not in ('en_preparacion', 'listo') then raise exception 'No se puede despachar todavía'; end if;
      if p_driver is not null and not exists (
        select 1 from public.staff_profiles where user_id = p_driver and active) then
        raise exception 'Repartidor inválido';
      end if;
      update public.orders set status = 'en_camino', dispatched_at = now(),
        ready_at = coalesce(ready_at, now()),
        driver_id = coalesce(p_driver, driver_id)
        where id = o.id;
      v_event := 'en_camino';

    when 'asignar_repartidor' then
      if p_driver is not null and not exists (
        select 1 from public.staff_profiles where user_id = p_driver and active) then
        raise exception 'Repartidor inválido';
      end if;
      update public.orders set driver_id = p_driver where id = o.id;
      v_event := 'repartidor_asignado';

    when 'entregado' then
      if o.status not in ('listo', 'en_camino', 'en_preparacion') then
        raise exception 'No se puede marcar entregado todavía';
      end if;
      if o.payment_status not in ('verificado', 'cobrar_en_entrega') then
        raise exception 'El pago no está verificado';
      end if;
      update public.orders set status = 'entregado', delivered_at = now(),
        payment_status = 'verificado',
        payment_verified_at = coalesce(payment_verified_at, now()),
        payment_verified_by = coalesce(payment_verified_by, v_uid)
        where id = o.id;
      v_event := 'entregado';

    when 'cancelar' then
      if v_note is null then raise exception 'Escribe el motivo de la cancelación'; end if;
      update public.orders set status = 'cancelado', cancel_reason = v_note, cancelled_at = now(),
        accepted_at = coalesce(accepted_at, now())
        where id = o.id;
      v_event := 'cancelado';

    when 'nota' then
      if v_note is null then raise exception 'Nota vacía'; end if;
      v_event := 'nota';

    else
      raise exception 'Acción desconocida: %', p_action;
  end case;

  insert into public.order_status_history (order_id, status, note, changed_by)
  values (o.id, v_event, v_note, v_uid);

  select * into o from public.orders where id = p_order_id;
  return o;
end $$;

-- ---------------------------------------------------------------------
-- Seguimiento público por token (no expone datos internos)
-- ---------------------------------------------------------------------
create or replace function public.get_order_tracking(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  o public.orders%rowtype;
begin
  if p_token is null or char_length(p_token) < 20 then
    return null;
  end if;
  select * into o from public.orders where tracking_token = p_token;
  if o.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'id', o.id,
    'code', o.code,
    'status', o.status,
    'payment_status', o.payment_status,
    'payment_method', o.payment_method,
    'payment_reference', o.payment_reference,
    'has_proof', o.proof_path is not null,
    'payment_reject_reason', o.payment_reject_reason,
    'cancel_reason', o.cancel_reason,
    'customer_name', o.customer_name,
    'customer_phone', o.customer_phone,
    'delivery_type', o.delivery_type,
    'address', o.address,
    'address_reference', o.address_reference,
    'lat', o.lat,
    'lng', o.lng,
    'zone_name', o.zone_name,
    'subtotal_cop', o.subtotal_cop,
    'delivery_fee_cop', o.delivery_fee_cop,
    'total_cop', o.total_cop,
    'total_usdt', o.total_usdt,
    'total_bs', o.total_bs,
    'rate_cop_usdt', o.rate_cop_usdt,
    'rate_bs_usdt', o.rate_bs_usdt,
    'cash_currency', o.cash_currency,
    'cash_amount', o.cash_amount,
    'scheduled_for', o.scheduled_for,
    'notes', o.notes,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'product_id', i.product_id,
        'product_name', i.product_name,
        'quantity', i.quantity,
        'unit_price_cop', i.unit_price_cop,
        'line_total_cop', i.line_total_cop,
        'notes', i.notes,
        'modifiers', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'option_id', m.option_id, 'group_name', m.group_name,
            'option_name', m.option_name, 'price_cop', m.price_cop)), '[]'::jsonb)
          from public.order_item_modifiers m where m.order_item_id = i.id)
      ) order by i.sort), '[]'::jsonb)
      from public.order_items i where i.order_id = o.id
    ),
    'history', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'status', h.status,
        'note', case when h.status in ('pago_rechazado', 'cancelado') then h.note end,
        'created_at', h.created_at) order by h.created_at), '[]'::jsonb)
      from public.order_status_history h
      where h.order_id = o.id and h.status not in ('nota', 'repartidor_asignado')
    )
  );
end $$;

-- ---------------------------------------------------------------------
-- El cliente reenvía el comprobante (cuando fue rechazado o faltaba)
-- Solo lo llama el servidor (service_role) después de subir el archivo.
-- ---------------------------------------------------------------------
create or replace function public.resubmit_payment(p_token text, p_proof_path text, p_reference text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
begin
  select * into o from public.orders where tracking_token = p_token for update;
  if o.id is null then raise exception 'Pedido no encontrado'; end if;
  if o.payment_method = 'efectivo' then raise exception 'Este pedido se paga en efectivo'; end if;
  if o.status in ('entregado', 'cancelado') then raise exception 'El pedido ya está cerrado'; end if;
  if o.payment_status not in ('rechazado', 'pendiente', 'por_verificar') then
    raise exception 'El pago ya fue verificado';
  end if;
  if nullif(p_proof_path, '') is null and nullif(btrim(coalesce(p_reference, '')), '') is null then
    raise exception 'Sube el comprobante o escribe la referencia';
  end if;

  update public.orders set
    proof_path = coalesce(nullif(p_proof_path, ''), proof_path),
    payment_reference = coalesce(nullif(btrim(p_reference), ''), payment_reference),
    payment_status = 'por_verificar',
    payment_reject_reason = null
  where id = o.id;

  insert into public.order_status_history (order_id, status, note)
  values (o.id, 'pago_reenviado', 'El cliente envió un nuevo comprobante');

  return jsonb_build_object('ok', true, 'old_proof_path', o.proof_path);
end $$;

-- ---------------------------------------------------------------------
-- Acciones rápidas permitidas al operador
-- ---------------------------------------------------------------------
create or replace function public.set_product_available(p_id uuid, p_available boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then raise exception 'No autorizado'; end if;
  update public.products set available = p_available where id = p_id;
end $$;

create or replace function public.set_option_available(p_id uuid, p_available boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then raise exception 'No autorizado'; end if;
  update public.modifier_options set available = p_available where id = p_id;
end $$;

create or replace function public.set_open_override(p_value text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then raise exception 'No autorizado'; end if;
  if p_value not in ('auto', 'open', 'closed') then raise exception 'Valor inválido'; end if;
  update public.settings set open_override = p_value where id = 1;
end $$;

-- Estado público de la tienda (abierto/cerrado) para la web
create or replace function public.store_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'open', public.is_open_now(),
    'override', (select open_override from public.settings where id = 1),
    'server_time', now()
  )
$$;

-- ---------------------------------------------------------------------
-- Tiempo real para el seguimiento del cliente:
-- cada cambio del pedido se emite por Realtime Broadcast en el canal
-- "order:<token>" (token no adivinable). Si la función realtime.send no
-- existe, la página de seguimiento igual se actualiza por sondeo.
-- ---------------------------------------------------------------------
create or replace function public.broadcast_order_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform realtime.send(
      jsonb_build_object(
        'status', new.status,
        'payment_status', new.payment_status,
        'updated_at', new.updated_at
      ),
      'order_update',
      'order:' || new.tracking_token,
      false
    );
  exception when others then
    null;
  end;
  return new;
end $$;

create trigger orders_broadcast
  after update on public.orders
  for each row
  when (old.status is distinct from new.status
        or old.payment_status is distinct from new.payment_status
        or old.driver_id is distinct from new.driver_id)
  execute function public.broadcast_order_change();

-- ---------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.current_staff_role() to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_manager() to anon, authenticated;
grant execute on function public.is_within_hours(timestamptz) to anon, authenticated;
grant execute on function public.is_open_now() to anon, authenticated;
grant execute on function public.store_status() to anon, authenticated;
grant execute on function public.current_rate() to anon, authenticated;
grant execute on function public.round_cop(numeric, integer) to anon, authenticated;
grant execute on function public.get_order_tracking(text) to anon, authenticated;
-- Pedidos web: solo vía la ruta API del servidor (service_role) para aplicar antispam por IP.
-- Pedidos manuales: personal autenticado.
grant execute on function public.create_order(jsonb) to authenticated, service_role;
grant execute on function public.resubmit_payment(text, text, text) to service_role;
grant execute on function public.order_action(uuid, text, text, uuid) to authenticated;
grant execute on function public.set_product_available(uuid, boolean) to authenticated;
grant execute on function public.set_option_available(uuid, boolean) to authenticated;
grant execute on function public.set_open_override(text) to authenticated;

alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
