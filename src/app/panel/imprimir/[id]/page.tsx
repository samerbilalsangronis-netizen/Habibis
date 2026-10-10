import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { formatBs, formatCop, formatUsdt } from '@/lib/money';
import { METHOD_SHORT, PAYMENT_STATUS_LABEL } from '@/lib/status';
import { prettyPhone } from '@/lib/phone';
import { cashLine } from '@/lib/orders';
import AutoPrint from '@/components/panel/AutoPrint';
import type { Order, Settings } from '@/lib/types';

export const metadata = { title: 'Comanda' };
export const dynamic = 'force-dynamic';

/** Comanda para impresora térmica de 58 u 80 mm. */
export default async function PrintPage({ params, searchParams }: { params: { id: string }; searchParams: { w?: string } }) {
  await requireStaff(['admin', 'operador']);
  const sb = supabaseServer();
  const [{ data: order }, { data: settings }] = await Promise.all([
    sb
      .from('orders')
      .select('*, order_items(*, order_item_modifiers(*))')
      .eq('id', params.id)
      .maybeSingle(),
    sb.from('settings').select('*').eq('id', 1).single(),
  ]);
  if (!order) notFound();
  const o = order as Order;
  const s = settings as Settings;
  const width = searchParams.w === '58' ? 58 : 80;
  const fmt = (d: string) =>
    new Intl.DateTimeFormat('es-VE', { timeZone: s.timezone, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
  const items = (o.order_items ?? []).slice().sort((a, b) => ((a as { sort?: number }).sort ?? 0) - ((b as { sort?: number }).sort ?? 0));

  return (
    <div className="ticket-root">
      <style>{`
        @page { size: ${width}mm auto; margin: 0; }
        html, body { background: #fff !important; color: #000 !important; }
        .ticket-root { width: ${width}mm; padding: 3mm ${width === 58 ? 2 : 4}mm; font-family: 'Courier New', ui-monospace, monospace;
          font-size: ${width === 58 ? 11 : 13}px; line-height: 1.3; color: #000; background: #fff; margin: 0 auto; }
        .c { text-align: center } .b { font-weight: 700 } .big { font-size: 1.6em } .sep { border-top: 1px dashed #000; margin: 4px 0 }
        .row { display: flex; justify-content: space-between; gap: 6px } .mod { padding-left: 1.6em } .note { padding-left: 1.6em; font-weight: 700 }
        @media screen { body { background: #ddd !important } .ticket-root { margin: 16px auto; box-shadow: 0 2px 10px rgba(0,0,0,.2) } }
      `}</style>
      <AutoPrint />
      <div className="c b">{s.business_name.toUpperCase()}</div>
      <div className="c">COMANDA</div>
      <div className="c b big">{o.code}</div>
      <div className="c">{fmt(o.created_at)}</div>
      {o.scheduled_for && <div className="c b">PROGRAMADO: {fmt(o.scheduled_for)}</div>}
      <div className="sep" />
      <div className="b">{o.delivery_type === 'delivery' ? '*** DELIVERY ***' : '*** RETIRO EN LOCAL ***'}</div>
      <div>{o.customer_name}</div>
      <div>{prettyPhone(o.customer_phone)}</div>
      {o.delivery_type === 'delivery' && (
        <>
          <div>{o.address}</div>
          {o.address_reference && <div>Ref: {o.address_reference}</div>}
        </>
      )}
      <div className="sep" />
      {items.map((it) => (
        <div key={it.id} style={{ marginBottom: 4 }}>
          <div className="row b">
            <span>
              {it.quantity}x {it.product_name}
            </span>
            <span>{formatCop(it.line_total_cop).replace(' COP', '')}</span>
          </div>
          {(it.order_item_modifiers ?? []).map((m, i) => (
            <div key={i} className="mod">
              - {m.option_name}
            </div>
          ))}
          {it.notes && <div className="note">&gt;&gt; {it.notes}</div>}
        </div>
      ))}
      {o.notes && (
        <>
          <div className="sep" />
          <div className="b">NOTA: {o.notes}</div>
        </>
      )}
      <div className="sep" />
      <div className="row">
        <span>Subtotal</span>
        <span>{formatCop(o.subtotal_cop)}</span>
      </div>
      {o.delivery_type === 'delivery' && (
        <div className="row">
          <span>Delivery</span>
          <span>{formatCop(o.delivery_fee_cop)}</span>
        </div>
      )}
      <div className="row b">
        <span>TOTAL</span>
        <span>{formatCop(o.total_cop)}</span>
      </div>
      <div className="row">
        <span></span>
        <span>{formatUsdt(Number(o.total_usdt))}</span>
      </div>
      <div className="row">
        <span></span>
        <span>{formatBs(Number(o.total_bs))}</span>
      </div>
      <div className="sep" />
      <div>
        Pago: {METHOD_SHORT[o.payment_method]} ({PAYMENT_STATUS_LABEL[o.payment_status]})
      </div>
      {cashLine(o) && <div className="b">{cashLine(o)}</div>}
      <div className="sep" />
      <div className="c">¡Shukran! 🧆</div>
    </div>
  );
}
