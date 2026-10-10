import { getStaff } from '@/lib/auth';
import { sendPush } from '@/lib/push';
import { json } from '@/lib/server-utils';

export const runtime = 'nodejs';

/** Envía una notificación de prueba a los dispositivos del usuario actual. */
export async function POST() {
  const staff = await getStaff();
  if (!staff) return json({ error: 'No autorizado' }, 401);
  const r = await sendPush(
    { title: '🔔 Prueba de Habibis', body: '¡Las notificaciones funcionan en este dispositivo!', url: '/panel', tag: 'prueba' },
    { userIds: [staff.profile.user_id] },
  );
  return json(r);
}
