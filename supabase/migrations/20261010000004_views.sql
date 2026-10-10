-- =====================================================================
-- Habibis · Vistas para el panel (respetan RLS del usuario que consulta)
-- =====================================================================

create or replace view public.customer_stats
with (security_invoker = true) as
select
  c.id,
  c.phone,
  c.name,
  c.cedula,
  c.addresses,
  c.created_at,
  count(o.id) filter (where o.status <> 'cancelado') as orders_count,
  coalesce(sum(o.total_cop) filter (where o.status <> 'cancelado'), 0)::bigint as total_spent_cop,
  coalesce(sum(o.total_usdt) filter (where o.status <> 'cancelado'), 0) as total_spent_usdt,
  max(o.created_at) as last_order_at
from public.customers c
left join public.orders o on o.customer_phone = c.phone
group by c.id;

grant select on public.customer_stats to authenticated;
revoke all on public.customer_stats from anon;
