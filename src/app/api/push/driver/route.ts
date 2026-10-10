import { getStaff } from '@/lib/auth';
import { sendPush } from '@/lib/push';
import { json } from '@/lib/server-utils';
import { supabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/** Avisa al repartidor asignado que tiene una entrega. */
export async function POST(req: Request) {
  const staff = await getStaff();
  if (!staff || staff.profile.role === 'repartidor') return json({ error: 'No autorizado' }, 401);
  const { orderId } = await req.json().catch(() => ({}));
  if (!orderId) return json({ error: 'Falta el pedido' }, 400);
  const { data: o } = await supabaseServer()
    .from('orders')
    .select('id, code, driver_id, customer_name, address')
    .eq('id', orderId)
    .maybeSingle();
  if (!o?.driver_id) return json({ sent: 0 });
  const r = await sendPush(
    { title: `🛵 Entrega ${o.code}`, body: `${o.customer_name} · ${o.address ?? ''}`, url: `/panel`, tag: `entrega-${o.id}` },
    { userIds: [o.driver_id] },
  );
  return json(r);
}
