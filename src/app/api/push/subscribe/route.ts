import { z } from 'zod';
import { json } from '@/lib/server-utils';
import { supabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const schema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(10), auth: z.string().min(5) }),
});

/** Guarda la suscripción push de este dispositivo para el usuario del panel. */
export async function POST(req: Request) {
  const sb = supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return json({ error: 'No autorizado' }, 401);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Suscripción inválida' }, 400);
  const { endpoint, keys } = parsed.data;
  // Si el mismo navegador estaba ligado a otro usuario, se reemplaza
  await sb.from('push_subscriptions').delete().eq('endpoint', endpoint);
  const { error } = await sb.from('push_subscriptions').insert({
    user_id: user.id,
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    user_agent: req.headers.get('user-agent')?.slice(0, 200) ?? null,
  });
  if (error) {
    // El endpoint puede pertenecer a otro usuario (RLS no deja borrarlo): usar service role
    const { supabaseAdmin } = await import('@/lib/supabase/server');
    const admin = supabaseAdmin();
    await admin.from('push_subscriptions').delete().eq('endpoint', endpoint);
    const retry = await admin.from('push_subscriptions').insert({
      user_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: req.headers.get('user-agent')?.slice(0, 200) ?? null,
    });
    if (retry.error) return json({ error: retry.error.message }, 400);
  }
  return json({ ok: true });
}

export async function DELETE(req: Request) {
  const sb = supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return json({ error: 'No autorizado' }, 401);
  const body = await req.json().catch(() => ({}));
  if (body?.endpoint) await sb.from('push_subscriptions').delete().eq('endpoint', body.endpoint);
  return json({ ok: true });
}
