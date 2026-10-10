import { getStaff } from '@/lib/auth';
import { json } from '@/lib/server-utils';
import { supabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Consulta el P2P de Binance (anuncios de VENTA de USDT, lo que paga un comprador)
 * y toma la mediana de los primeros anuncios. Es una API pública no oficial:
 * si falla, el panel conserva la tasa manual.
 */
async function p2pPrice(fiat: 'COP' | 'VES'): Promise<number> {
  const res = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Habibis)' },
    body: JSON.stringify({
      asset: 'USDT',
      fiat,
      tradeType: 'BUY',
      page: 1,
      rows: 10,
      payTypes: [],
      publisherType: null,
      merchantCheck: false,
    }),
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Binance respondió ${res.status}`);
  const body = (await res.json()) as { data?: { adv?: { price?: string } }[] };
  const prices = (body.data ?? [])
    .map((d) => Number(d.adv?.price))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  if (prices.length < 3) throw new Error(`Pocos anuncios de USDT/${fiat}`);
  const top = prices.slice(0, 7);
  return top[Math.floor(top.length / 2)];
}

export async function POST() {
  const staff = await getStaff();
  if (!staff || staff.profile.role !== 'admin') return json({ error: 'Solo el administrador puede actualizar tasas' }, 403);

  let cop: number, bs: number;
  try {
    [cop, bs] = await Promise.all([p2pPrice('COP'), p2pPrice('VES')]);
  } catch (e) {
    return json({ error: `No se pudo consultar Binance (${(e as Error).message}). Se mantiene la tasa manual.` }, 502);
  }

  const { data, error } = await supabaseServer()
    .from('exchange_rates')
    .insert({ cop_per_usdt: cop, bs_per_usdt: bs, source: 'binance', created_by: staff.profile.user_id })
    .select()
    .single();
  if (error) return json({ error: error.message }, 400);
  return json(data);
}
