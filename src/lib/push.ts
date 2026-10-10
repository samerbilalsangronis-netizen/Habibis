import 'server-only';
import webpush from 'web-push';
import { supabaseAdmin } from './supabase/server';

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@habibis.app', pub, priv);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Envía una notificación a los dispositivos suscritos.
 * - roles: a qué roles del personal (por defecto admin y operador)
 * - userIds: o a usuarios concretos (p. ej. el repartidor asignado)
 * Borra automáticamente las suscripciones vencidas.
 */
export async function sendPush(payload: PushPayload, opts: { roles?: string[]; userIds?: string[] } = {}) {
  if (!configure()) return { sent: 0, skipped: 'sin claves VAPID' };
  const admin = supabaseAdmin();

  let userIds = opts.userIds;
  if (!userIds) {
    const { data: staff } = await admin
      .from('staff_profiles')
      .select('user_id')
      .eq('active', true)
      .in('role', opts.roles ?? ['admin', 'operador']);
    userIds = (staff ?? []).map((s) => s.user_id);
  }
  if (!userIds.length) return { sent: 0 };

  const { data: subs } = await admin.from('push_subscriptions').select('*').in('user_id', userIds);
  let sent = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 30, urgency: 'high' },
        );
        sent++;
      } catch (err: unknown) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await admin.from('push_subscriptions').delete().eq('id', s.id);
        } else {
          console.error('[push] error', code, (err as Error).message);
        }
      }
    }),
  );
  return { sent };
}
