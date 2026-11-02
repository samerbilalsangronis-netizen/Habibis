import 'server-only';
import webpush from 'web-push';
import { supabaseAdmin } from './supabase/server';

/** Limpia espacios, comillas y saltos de línea que suelen colarse al pegar en Vercel. */
const clean = (v: string | undefined) => (v ?? '').trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '');

let configured = false;
/** Devuelve null si quedó listo, o el motivo por el que no se puede enviar. */
function configure(): string | null {
  if (configured) return null;
  const pub = clean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
  const priv = clean(process.env.VAPID_PRIVATE_KEY);
  if (!pub || !priv) return 'Faltan las claves VAPID en las variables de entorno';
  let subject = (process.env.VAPID_SUBJECT ?? '').trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '');
  if (subject && !/^(mailto:|https:\/\/)/.test(subject)) subject = subject.includes('@') ? `mailto:${subject}` : `https://${subject}`;
  try {
    webpush.setVapidDetails(subject || 'mailto:admin@habibis.app', pub, priv);
  } catch (e) {
    return `Claves VAPID inválidas: ${(e as Error).message}`;
  }
  configured = true;
  return null;
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
  const problem = configure();
  if (problem) {
    console.error('[push]', problem);
    return { sent: 0, error: problem };
  }
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
  if (!userIds.length) return { sent: 0, error: 'No hay personal activo para avisar' };

  const { data: subs } = await admin.from('push_subscriptions').select('*').in('user_id', userIds);
  let sent = 0;
  const failures: string[] = [];
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
          const body = (err as { body?: string }).body;
          console.error('[push] error', code, (err as Error).message, body);
          failures.push(`${code ?? ''} ${body || (err as Error).message}`.trim());
        }
      }
    }),
  );
  return { sent, devices: (subs ?? []).length, ...(failures.length ? { error: failures.join(' · ').slice(0, 300) } : {}) };
}
