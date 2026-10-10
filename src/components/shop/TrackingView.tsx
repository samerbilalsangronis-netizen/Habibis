'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import PaymentInfo from './PaymentInfo';
import ProofInput from './ProofInput';
import { IconBack, IconCheck, IconWhatsApp } from '@/components/ui/Icons';
import { formatBs, formatCop, formatRate, formatUsd, formatUsdt } from '@/lib/money';
import { fmtClock, fmtDateTime } from '@/lib/hours';
import { METHOD_LABEL, PAYMENT_STATUS_LABEL, trackingStep } from '@/lib/status';
import { supabaseBrowser } from '@/lib/supabase/client';
import { orderSummaryText, waLink } from '@/lib/whatsapp';
import { FALLBACK_WHATSAPP } from '@/lib/env';
import type { Settings, TrackingOrder } from '@/lib/types';

export default function TrackingView({ token, initial, settings }: { token: string; initial: TrackingOrder; settings: Settings }) {
  const params = useSearchParams();
  const isNew = params.get('nuevo') === '1';
  const [order, setOrder] = useState<TrackingOrder>(initial);
  const [live, setLive] = useState(false);
  const [flash, setFlash] = useState(false);

  const refetch = useCallback(async () => {
    const { data } = await supabaseBrowser().rpc('get_order_tracking', { p_token: token });
    if (data) {
      setOrder((prev) => {
        const next = data as TrackingOrder;
        if (prev.status !== next.status || prev.payment_status !== next.payment_status) {
          setFlash(true);
          setTimeout(() => setFlash(false), 2500);
          if ('vibrate' in navigator) navigator.vibrate?.(200);
        }
        return next;
      });
    }
  }, [token]);

  // Tiempo real (Broadcast) + sondeo de respaldo
  useEffect(() => {
    const sb = supabaseBrowser();
    const ch = sb
      .channel(`order:${token}`)
      .on('broadcast', { event: 'order_update' }, () => refetch())
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));
    const final = order.status === 'entregado' || order.status === 'cancelado';
    const id = final ? undefined : setInterval(refetch, 20_000);
    const onVis = () => document.visibilityState === 'visible' && refetch();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      sb.removeChannel(ch);
      if (id) clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [token, refetch, order.status]);

  const step = trackingStep(order);
  const cash = order.payment_method === 'efectivo';
  const steps = [
    { label: 'Recibido', done: true },
    { label: cash ? 'Pago al recibir' : 'Pago verificado', done: step >= 1 || (cash && step >= 0 && order.status !== 'nuevo') },
    { label: 'En preparación', done: step >= 2 },
    { label: order.delivery_type === 'delivery' ? 'En camino' : 'Listo para retirar', done: step >= 3 },
    { label: 'Entregado', done: step >= 4 },
  ];
  const currentIdx = steps.findLastIndex((s) => s.done);
  const cancelled = order.status === 'cancelado';
  const rejected = order.payment_status === 'rechazado' && !cancelled;
  const trackingUrl = typeof window !== 'undefined' ? `${location.origin}/pedido/${token}` : undefined;
  const waNumber = settings.whatsapp_phone || FALLBACK_WHATSAPP;

  const headline = cancelled
    ? 'Pedido cancelado'
    : order.status === 'entregado'
      ? '¡Pedido entregado! Buen provecho 🙏'
      : order.status === 'en_camino'
        ? '¡Tu pedido va en camino! 🛵'
        : order.status === 'listo'
          ? order.delivery_type === 'pickup'
            ? '¡Listo para retirar! 🧆'
            : '¡Listo! Sale en breve'
          : order.status === 'en_preparacion'
            ? 'Estamos preparando tu pedido 🔥'
            : rejected
              ? 'No pudimos verificar tu pago'
              : order.payment_status === 'por_verificar'
                ? 'Verificando tu pago…'
                : 'Pedido recibido';

  return (
    <div className="min-h-dvh bg-pattern pb-16">
      <header className="sticky top-0 z-30 bg-ink-950/85 backdrop-blur-md border-b border-ink-800">
        <div className="max-w-2xl mx-auto flex items-center gap-2 px-4 h-14">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-ink-800" aria-label="Volver al menú">
            <IconBack />
          </Link>
          <h1 className="font-display text-xl text-gold-300">Pedido {order.code}</h1>
          <span className={`ml-auto inline-flex items-center gap-1.5 text-[11px] ${live ? 'text-emerald-300' : 'text-sand-500'}`}>
            <span className={`w-2 h-2 rounded-full ${live ? 'bg-emerald-400 animate-pulse2' : 'bg-sand-500'}`} />
            {live ? 'En vivo' : 'Actualizando'}
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-5 space-y-4">
        {isNew && !cancelled && (
          <section className="card p-5 text-center border-gold-500/50 shadow-glow pattern-faint">
            <div className="relative">
              <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500 grid place-items-center text-white">
                <IconCheck className="w-8 h-8" />
              </div>
              <h2 className="font-display text-2xl text-gold-300 mt-3">¡Gracias, {order.customer_name.split(' ')[0]}!</h2>
              <p className="text-sand-200 mt-1">Recibimos tu pedido</p>
              <p className="font-display text-5xl text-sand-50 mt-2 tracking-wider">{order.code}</p>
              <p className="text-xs text-sand-400 mt-2">Guarda este enlace para seguir tu pedido en tiempo real.</p>
              {waNumber && (
                <a
                  href={waLink(waNumber, orderSummaryText(order, trackingUrl, settings.timezone))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn mt-4 w-full bg-[#25D366] text-white text-base"
                >
                  <IconWhatsApp /> Enviar copia por WhatsApp
                </a>
              )}
            </div>
          </section>
        )}

        {/* Estado */}
        <section className={`card p-5 transition ${flash ? 'ring-2 ring-gold-400' : ''}`}>
          <p className="text-sm text-sand-400">Estado</p>
          <h2 className={`font-display text-2xl mt-0.5 ${cancelled || rejected ? 'text-terra-400' : 'text-gold-300'}`}>{headline}</h2>
          {order.scheduled_for && !cancelled && order.status !== 'entregado' && (
            <p className="text-sm text-sand-300 mt-1">⏰ Programado para {fmtDateTime(order.scheduled_for, settings.timezone)}</p>
          )}

          {cancelled ? (
            <p className="mt-3 text-sand-200">{order.cancel_reason ? `Motivo: ${order.cancel_reason}` : 'El local canceló el pedido.'}</p>
          ) : (
            <ol className="mt-5 relative">
              {steps.map((s, i) => {
                const isCurrent = i === currentIdx && order.status !== 'entregado';
                const ts = order.history.find((h) =>
                  i === 0
                    ? h.status === 'nuevo'
                    : i === 1
                      ? h.status === 'pago_verificado'
                      : i === 2
                        ? h.status === 'en_preparacion'
                        : i === 3
                          ? h.status === 'listo' || h.status === 'en_camino'
                          : h.status === 'entregado',
                );
                return (
                  <li key={s.label} className="flex gap-3 pb-5 last:pb-0 relative">
                    {i < steps.length - 1 && (
                      <span className={`absolute left-[13px] top-7 bottom-0 w-0.5 ${steps[i + 1].done ? 'bg-gold-500' : 'bg-ink-600'}`} />
                    )}
                    <span
                      className={`relative z-10 grid place-items-center w-7 h-7 rounded-full border-2 shrink-0 ${
                        s.done ? 'bg-gold-500 border-gold-500 text-ink-950' : 'border-ink-600 bg-ink-900'
                      } ${isCurrent ? 'ring-4 ring-gold-500/25' : ''}`}
                    >
                      {s.done ? <IconCheck className="w-4 h-4" /> : <span className="w-2 h-2 rounded-full bg-ink-600" />}
                    </span>
                    <div className="pt-0.5">
                      <p className={`font-semibold ${s.done ? 'text-sand-50' : 'text-sand-500'}`}>{s.label}</p>
                      {ts && <p className="text-xs text-sand-400">{fmtClock(ts.created_at, settings.timezone)}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {rejected && <ResubmitPayment token={token} order={order} settings={settings} onDone={refetch} />}

        {order.payment_status === 'pendiente' && !cancelled && (
          <ResubmitPayment token={token} order={order} settings={settings} onDone={refetch} pending />
        )}

        {/* Detalle */}
        <section className="card p-4 sm:p-5">
          <h3 className="font-semibold mb-3">Detalle</h3>
          <ul className="space-y-2 text-sm">
            {order.items.map((it, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>
                  <b>{it.quantity}×</b> {it.product_name}
                  {it.modifiers.length > 0 && (
                    <span className="block text-xs text-sand-400">{it.modifiers.map((m) => m.option_name).join(' · ')}</span>
                  )}
                  {it.notes && <span className="block text-xs text-gold-300/80">📝 {it.notes}</span>}
                </span>
                <span className="tabular-nums whitespace-nowrap">{formatCop(it.line_total_cop)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 pt-3 border-t border-ink-700 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-sand-300">Subtotal</dt>
              <dd className="tabular-nums">{formatCop(order.subtotal_cop)}</dd>
            </div>
            {order.delivery_type === 'delivery' && (
              <div className="flex justify-between">
                <dt className="text-sand-300">Delivery{order.zone_name ? ` (${order.zone_name})` : ''}</dt>
                <dd className="tabular-nums">{formatCop(order.delivery_fee_cop)}</dd>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-1">
              <dt>Total</dt>
              <dd className="tabular-nums text-gold-300">{formatCop(order.total_cop)}</dd>
            </div>
            <div className="flex justify-between text-sand-200">
              <dt>USDT</dt>
              <dd className="tabular-nums">{formatUsdt(Number(order.total_usdt))}</dd>
            </div>
            <div className="flex justify-between text-sand-200">
              <dt>Bolívares</dt>
              <dd className="tabular-nums">{formatBs(Number(order.total_bs))}</dd>
            </div>
            <p className="text-[11px] text-sand-500 pt-1">
              Tasas usadas: 1 USDT = {formatRate(order.rate_cop_usdt)} COP · Bs. {formatRate(order.rate_bs_usdt)}
            </p>
          </dl>
          <div className="mt-4 pt-3 border-t border-ink-700 text-sm space-y-1.5">
            <p>
              <span className="text-sand-400">Entrega: </span>
              {order.delivery_type === 'delivery' ? `Delivery · ${order.address ?? ''}` : 'Retiro en el local'}
            </p>
            {order.address_reference && (
              <p>
                <span className="text-sand-400">Referencia: </span>
                {order.address_reference}
              </p>
            )}
            <p>
              <span className="text-sand-400">Pago: </span>
              {METHOD_LABEL[order.payment_method]} · {PAYMENT_STATUS_LABEL[order.payment_status]}
            </p>
            {cash && order.cash_currency && (
              <p>
                <span className="text-sand-400">Pagas con: </span>
                {order.cash_amount
                  ? order.cash_currency === 'COP'
                    ? formatCop(Number(order.cash_amount))
                    : order.cash_currency === 'USD'
                      ? formatUsd(Number(order.cash_amount))
                      : formatBs(Number(order.cash_amount))
                  : order.cash_currency}
              </p>
            )}
            <p className="text-xs text-sand-500">Pedido hecho el {fmtDateTime(order.created_at, settings.timezone)}</p>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2">
          {waNumber && (
            <a
              href={waLink(waNumber, `Hola Habibis, les escribo por mi pedido ${order.code}.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost"
            >
              <IconWhatsApp /> Escribirnos
            </a>
          )}
          <Link href="/" className="btn-primary">
            Volver al menú
          </Link>
        </div>
      </main>
    </div>
  );
}

function ResubmitPayment({
  token,
  order,
  settings,
  onDone,
  pending = false,
}: {
  token: string;
  order: TrackingOrder;
  settings: Settings;
  onDone: () => void;
  pending?: boolean;
}) {
  const [proof, setProof] = useState<File | null>(null);
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const send = async () => {
    if (!proof && !reference.trim()) {
      setMsg('Sube la captura o escribe la referencia');
      return;
    }
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    if (proof) fd.append('proof', proof);
    fd.append('reference', reference.trim());
    const res = await fetch(`/api/orders/${token}/payment`, { method: 'POST', body: fd });
    const out = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(out.error || 'No se pudo enviar');
      return;
    }
    setProof(null);
    setReference('');
    onDone();
  };

  return (
    <section className="card p-4 sm:p-5 border-terra-500/50">
      <h3 className="font-semibold text-terra-400">{pending ? 'Falta confirmar tu pago' : 'Pago rechazado'}</h3>
      {order.payment_reject_reason && <p className="text-sm text-sand-200 mt-1">Motivo: {order.payment_reject_reason}</p>}
      <p className="text-sm text-sand-400 mt-1">Envía un nuevo comprobante para continuar con tu pedido.</p>
      <div className="mt-3 space-y-3">
        <PaymentInfo method={order.payment_method} settings={settings} totalUsdt={Number(order.total_usdt)} totalBs={Number(order.total_bs)} />
        <ProofInput file={proof} onChange={setProof} />
        <input className="input" placeholder="Referencia / ID de la orden" value={reference} onChange={(e) => setReference(e.target.value)} />
        {msg && <p className="text-sm text-terra-400">{msg}</p>}
        <button className="btn-primary w-full" disabled={busy} onClick={send}>
          {busy ? 'Enviando…' : 'Enviar comprobante'}
        </button>
      </div>
    </section>
  );
}
