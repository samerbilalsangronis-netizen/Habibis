import { orderPayloadSchema } from '@/lib/order-payload';
import { normalizePhone } from '@/lib/phone';
import { sendPush } from '@/lib/push';
import { clientIp, hashIp, json, uploadProof } from '@/lib/server-utils';
import { supabaseAdmin, supabaseServer } from '@/lib/supabase/server';
import { formatCop } from '@/lib/money';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Crea un pedido. Acepta multipart/form-data con:
 *   payload: JSON (ver orderPayloadSchema)
 *   proof:   archivo opcional (comprobante de pago)
 * El total se recalcula en la base (create_order) con precios y tasas actuales.
 */
export async function POST(req: Request) {
  let raw: unknown;
  let proof: File | null = null;
  try {
    const ct = req.headers.get('content-type') || '';
    if (ct.includes('multipart/form-data')) {
      const fd = await req.formData();
      raw = JSON.parse(String(fd.get('payload') || '{}'));
      const f = fd.get('proof');
      if (f && typeof f !== 'string' && f.size > 0) proof = f;
    } else {
      raw = await req.json();
    }
  } catch {
    return json({ error: 'Solicitud inválida' }, 400);
  }

  const parsed = orderPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, 400);
  }
  const p = parsed.data;
  const phone = normalizePhone(p.customer.phone);
  if (!phone) return json({ error: 'Teléfono inválido. Usa un número de Venezuela o Colombia.' }, 400);

  const admin = supabaseAdmin();
  let caller = admin;
  if (p.source === 'manual') {
    // Pedido creado por el personal: se ejecuta con su sesión (la base verifica el rol)
    const sb = supabaseServer();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return json({ error: 'Sesión vencida. Vuelve a entrar al panel.' }, 401);
    caller = sb;
  }

  let proofPath: string | null = null;
  if (proof && p.payment_method !== 'efectivo') {
    try {
      proofPath = await uploadProof(admin, proof);
    } catch (e) {
      return json({ error: (e as Error).message }, 400);
    }
  }

  const { data, error } = await caller.rpc('create_order', {
    p: {
      ...p,
      customer: { ...p.customer, phone },
      proof_path: proofPath,
      ip_hash: p.source === 'web' ? hashIp(clientIp(req)) : null,
    },
  });

  if (error) {
    if (proofPath) await admin.storage.from('comprobantes').remove([proofPath]);
    const status = error.code === 'HB409' ? 409 : 400;
    return json({ error: error.message, code: error.code }, status);
  }

  const order = data as { id: string; code: string; token: string; total_cop: number };

  if (p.source === 'web') try {
    await sendPush({
      title: `🧆 Nuevo pedido ${order.code}`,
      body: `${p.customer.name} · ${p.delivery_type === 'delivery' ? 'Delivery' : 'Retiro'} · ${formatCop(order.total_cop)}`,
      url: `/panel/pedidos/${order.id}`,
      tag: `pedido-${order.id}`,
    });
  } catch (e) {
    console.error('[push] no se pudo notificar', e);
  }

  return json(order, 201);
}
