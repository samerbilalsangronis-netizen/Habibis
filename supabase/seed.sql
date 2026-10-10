-- =====================================================================
-- Habibis · Datos de ejemplo
-- Menú árabe con precios de ejemplo en COP, tasas, horario y un admin.
-- Ejecutar UNA vez sobre un proyecto recién migrado.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Configuración del negocio (valores de ejemplo, editar desde el panel)
-- ---------------------------------------------------------------------
update public.settings set
  business_name = 'Habibis',
  tagline = 'Shawarmas, falafel y cremas árabes',
  whatsapp_phone = '584120000000',
  instagram = 'habibis',
  address = 'Av. Principal, local 1 (por definir)',
  city = 'Ciudad por definir',
  store_lat = 10.4806,
  store_lng = -66.9036,
  delivery_fee_cop = 5000,
  delivery_mode = 'flat',
  min_order_cop = 0,
  binance_pay_id = '123456789',
  binance_email = 'pagos@habibis.com',
  binance_name = 'Habibis',
  pago_movil_bank = 'Banco de Venezuela (0102)',
  pago_movil_phone = '0412-0000000',
  pago_movil_id = 'V-00000000',
  transfer_bank = 'Banesco',
  transfer_account = '0134-0000-00-0000000000',
  transfer_holder = 'Habibis C.A.',
  transfer_id = 'J-00000000-0'
where id = 1;

insert into public.exchange_rates (cop_per_usdt, bs_per_usdt, source)
values (3900, 380, 'manual');

update public.business_hours set is_open = true, open_time = '11:00', close_time = '23:00';
update public.business_hours set is_open = false where day_of_week = 1; -- lunes cerrado (ejemplo)

insert into public.delivery_zones (name, fee_cop, active, sort) values
  ('Zona centro', 5000, true, 1),
  ('Zona norte', 7000, true, 2),
  ('Zona sur', 8000, true, 3);

-- ---------------------------------------------------------------------
-- Categorías
-- ---------------------------------------------------------------------
insert into public.categories (name, slug, sort) values
  ('Shawarmas', 'shawarmas', 1),
  ('Platos', 'platos', 2),
  ('Falafel', 'falafel', 3),
  ('Cremas y dips', 'cremas-y-dips', 4),
  ('Combos', 'combos', 5),
  ('Bebidas', 'bebidas', 6),
  ('Postres', 'postres', 7);

-- ---------------------------------------------------------------------
-- Productos
-- ---------------------------------------------------------------------
insert into public.products (category_id, name, description, price_cop, tags, sort, is_combo)
select c.id, p.name, p.description, p.price, p.tags, p.sort, p.is_combo
from (values
  ('shawarmas', 'Shawarma de pollo', 'Pollo marinado con especias árabes, toum, papas y pepinillos en pan árabe.', 22000, array['mas_pedido'], 1, false),
  ('shawarmas', 'Shawarma de carne', 'Carne de res a la plancha, tahini, tomate, cebolla y perejil.', 25000, array[]::text[], 2, false),
  ('shawarmas', 'Shawarma mixto', 'Pollo y carne, toum, tahini y vegetales frescos.', 26000, array['nuevo'], 3, false),
  ('shawarmas', 'Shawarma picante', 'Pollo con salsa de ají casera, pimentón y cebolla morada.', 23000, array['picante'], 4, false),
  ('platos', 'Plato de shawarma', 'Shawarma servido en plato con arroz, ensalada, hummus y pan árabe.', 32000, array['mas_pedido'], 1, false),
  ('platos', 'Kibbe frito (3 und.)', 'Kibbe crujiente relleno de carne, cebolla y piñones.', 18000, array[]::text[], 2, false),
  ('platos', 'Kibbe horneado', 'Porción de kibbe al horno con yogurt de la casa.', 20000, array[]::text[], 3, false),
  ('platos', 'Tabule', 'Ensalada de perejil, trigo, tomate, menta y limón.', 15000, array['vegetariano'], 4, false),
  ('platos', 'Plato mixto árabe', 'Para compartir: shawarma, kibbe, falafel, hummus, tabule y pan.', 45000, array['nuevo'], 5, false),
  ('falafel', 'Falafel (6 und.)', 'Croquetas de garbanzo con tahini.', 16000, array['vegetariano'], 1, false),
  ('falafel', 'Wrap de falafel', 'Falafel, hummus, tomate, lechuga y pepinillos en pan árabe.', 20000, array['vegetariano'], 2, false),
  ('cremas-y-dips', 'Hummus (crema de garbanzo)', 'Crema de garbanzo con tahini, limón y aceite de oliva. Incluye pan.', 14000, array['vegetariano', 'mas_pedido'], 1, false),
  ('cremas-y-dips', 'Babaganoush', 'Crema de berenjena ahumada con tahini. Incluye pan.', 15000, array['vegetariano'], 2, false),
  ('cremas-y-dips', 'Labneh', 'Yogurt árabe con zaatar y aceite de oliva. Incluye pan.', 14000, array['vegetariano'], 3, false),
  ('cremas-y-dips', 'Toum (salsa de ajo)', 'Porción de nuestra salsa de ajo.', 4000, array['vegetariano'], 4, false),
  ('cremas-y-dips', 'Pan árabe extra', '2 panes árabes.', 3000, array['vegetariano'], 5, false),
  ('combos', 'Combo Habibi', 'Shawarma de pollo + papas fritas + bebida.', 30000, array['mas_pedido'], 1, true),
  ('combos', 'Combo pareja', '2 shawarmas de pollo + hummus + 2 bebidas.', 58000, array[]::text[], 2, true),
  ('bebidas', 'Limonada con hierbabuena', 'Natural, bien fría.', 7000, array[]::text[], 1, false),
  ('bebidas', 'Refresco', 'Lata 355 ml.', 5000, array[]::text[], 2, false),
  ('bebidas', 'Té árabe', 'Té negro con cardamomo.', 6000, array[]::text[], 3, false),
  ('bebidas', 'Agua', 'Botella 600 ml.', 3000, array[]::text[], 4, false),
  ('postres', 'Baklava (2 und.)', 'Hojaldre con nueces y almíbar.', 9000, array['vegetariano'], 1, false),
  ('postres', 'Knafeh', 'Postre de queso con masa kataifi y almíbar de azahar.', 14000, array['nuevo'], 2, false),
  ('postres', 'Mamul (3 und.)', 'Galletas rellenas de dátil.', 7000, array['vegetariano'], 3, false)
) as p(cat, name, description, price, tags, sort, is_combo)
join public.categories c on c.slug = p.cat;

-- Componentes de combos
insert into public.combo_items (combo_id, product_id, quantity)
select (select id from public.products where name = 'Combo Habibi'), id, 1
from public.products where name in ('Shawarma de pollo', 'Refresco');
insert into public.combo_items (combo_id, product_id, quantity)
select (select id from public.products where name = 'Combo pareja'), id, q
from (values ('Shawarma de pollo', 2), ('Hummus (crema de garbanzo)', 1), ('Refresco', 2)) v(n, q)
join public.products on name = v.n;

-- ---------------------------------------------------------------------
-- Modificadores
-- ---------------------------------------------------------------------
insert into public.modifier_groups (name, internal_name, selection_type, is_required, min_select, max_select, sort) values
  ('Tamaño', 'Tamaño shawarma', 'single', true, 1, 1, 1),
  ('Tipo de pan', null, 'single', true, 1, 1, 2),
  ('Proteína', null, 'single', true, 1, 1, 3),
  ('Salsas extra', null, 'multiple', false, 0, 3, 4),
  ('Quitar ingredientes', null, 'multiple', false, 0, 5, 5),
  ('Extras', null, 'multiple', false, 0, 4, 6),
  ('Sabor del refresco', null, 'single', true, 1, 1, 7),
  ('Bebida del combo', null, 'single', true, 1, 1, 8);

insert into public.modifier_options (group_id, name, price_cop, sort)
select g.id, o.name, o.price, o.sort
from (values
  ('Tamaño', 'Normal', 0, 1),
  ('Tamaño', 'Grande', 6000, 2),
  ('Tipo de pan', 'Pan árabe', 0, 1),
  ('Tipo de pan', 'Pan pita tostado', 0, 2),
  ('Tipo de pan', 'Lavash (pan fino)', 2000, 3),
  ('Proteína', 'Pollo', 0, 1),
  ('Proteína', 'Carne', 3000, 2),
  ('Proteína', 'Mixto', 4000, 3),
  ('Salsas extra', 'Toum (ajo)', 1000, 1),
  ('Salsas extra', 'Tahini', 1000, 2),
  ('Salsas extra', 'Picante de la casa', 1000, 3),
  ('Salsas extra', 'Yogurt', 1000, 4),
  ('Quitar ingredientes', 'Sin cebolla', 0, 1),
  ('Quitar ingredientes', 'Sin tomate', 0, 2),
  ('Quitar ingredientes', 'Sin pepinillos', 0, 3),
  ('Quitar ingredientes', 'Sin papas', 0, 4),
  ('Quitar ingredientes', 'Sin perejil', 0, 5),
  ('Extras', 'Extra queso', 3000, 1),
  ('Extras', 'Extra carne / pollo', 6000, 2),
  ('Extras', 'Papas fritas', 5000, 3),
  ('Extras', 'Hummus pequeño', 5000, 4),
  ('Sabor del refresco', 'Coca-Cola', 0, 1),
  ('Sabor del refresco', 'Pepsi', 0, 2),
  ('Sabor del refresco', 'Frescolita', 0, 3),
  ('Sabor del refresco', '7up', 0, 4),
  ('Bebida del combo', 'Refresco', 0, 1),
  ('Bebida del combo', 'Limonada con hierbabuena', 2000, 2),
  ('Bebida del combo', 'Agua', 0, 3)
) as o(grp, name, price, sort)
join public.modifier_groups g on g.name = o.grp;

-- Asignación de grupos a productos
insert into public.product_modifier_groups (product_id, group_id, sort)
select p.id, g.id, g.sort
from (values
  ('Shawarma de pollo', array['Tamaño', 'Tipo de pan', 'Salsas extra', 'Quitar ingredientes', 'Extras']),
  ('Shawarma de carne', array['Tamaño', 'Tipo de pan', 'Salsas extra', 'Quitar ingredientes', 'Extras']),
  ('Shawarma mixto', array['Tamaño', 'Tipo de pan', 'Salsas extra', 'Quitar ingredientes', 'Extras']),
  ('Shawarma picante', array['Tamaño', 'Tipo de pan', 'Salsas extra', 'Quitar ingredientes', 'Extras']),
  ('Plato de shawarma', array['Proteína', 'Salsas extra', 'Extras']),
  ('Wrap de falafel', array['Tipo de pan', 'Salsas extra', 'Quitar ingredientes']),
  ('Falafel (6 und.)', array['Salsas extra']),
  ('Refresco', array['Sabor del refresco']),
  ('Combo Habibi', array['Tipo de pan', 'Bebida del combo', 'Quitar ingredientes']),
  ('Combo pareja', array['Salsas extra'])
) as m(product, groups)
join public.products p on p.name = m.product
join public.modifier_groups g on g.name = any (m.groups);

-- ---------------------------------------------------------------------
-- Usuario admin de ejemplo
--   correo:     admin@habibis.app
--   contraseña: Habibis2026!
-- ¡CÁMBIALA en cuanto entres al panel (Configuración → Usuarios)!
-- ---------------------------------------------------------------------
do $$
declare
  v_uid uuid := gen_random_uuid();
  v_email text := 'admin@habibis.app';
begin
  if exists (select 1 from auth.users where email = v_email) then
    select id into v_uid from auth.users where email = v_email;
  else
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
      extensions.crypt('Habibis2026!', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{"full_name":"Administrador"}', now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_uid, v_uid::text,
            jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
            'email', now(), now(), now());
  end if;

  insert into public.staff_profiles (user_id, full_name, email, role)
  values (v_uid, 'Administrador', v_email, 'admin')
  on conflict (user_id) do update set role = 'admin', active = true;
end $$;
