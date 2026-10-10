import { sendPush } from '@/lib/push';
import { json, uploadProof } from '@/lib/server-utils';
import { supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** El cliente reenvía comprobante/referencia cuando el pago fue rechazado o faltaba. */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  if (!params.token || params.token.length < 20) return json({ error: 'Pedido no encontrado' }, 404);
  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return json({ error: 'Solicitud inválida' }, 400);
  }
  const reference = String(fd.get('reference') || '').trim().slice(0, 120);
  const file = fd.get('proof');
  const admin = supabaseAdmin();

  let path: string | null = null;
  if (file && typeof file !== 'string' && file.size > 0) {
    try {
      path = await uploadProof(admin, file);
    } catch (e) {
      return json({ error: (e as Error).message }, 400);
    }
  }

  const { data, error } = await admin.rpc('resubmit_payment', {
    p_token: params.token,
    p_proof_path: path,
    p_reference: reference || null,
  });
  if (error) {
    if (path) await admin.storage.from('comprobantes').remove([path]);
    return json({ error: error.message }, 400);
  }

  const { data: order } = await admin.from('orders').select('id, code, customer_name').eq('tracking_token', params.token).single();
  if (order) {
    await sendPush({
      title: `💳 Nuevo comprobante ${order.code}`,
      body: `${order.customer_name} reenvió el pago. Revísalo.`,
      url: `/panel/pedidos/${order.id}`,
      tag: `pago-${order.id}`,
    }).catch(() => undefined);
  }
  return json({ ok: true, replaced: (data as { old_proof_path?: string })?.old_proof_path ? true : false });
}
