'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import MapView, { distanceKm } from '@/components/map';
import Sheet from '@/components/ui/Sheet';
import { ORDER_LIST_SELECT, usePanel } from './PanelContext';
import { useOrderAction, type OrderActionName } from './useOrderAction';
import { elapsedClass } from './OrdersBoard';
import { cashLine } from '@/lib/orders';
import { IconBack, IconPhone, IconPrint, IconWhatsApp } from '@/components/ui/Icons';
import { formatBs, formatCop, formatRate, formatUsdt } from '@/lib/money';
import { fmtClock, fmtDateTime, minutesSince } from '@/lib/hours';
import { useNow } from '@/lib/hooks';
import { prettyPhone } from '@/lib/phone';
import { supabaseBrowser } from '@/lib/supabase/client';
import { HISTORY_LABEL, METHOD_LABEL, PAYMENT_STATUS_COLOR, PAYMENT_STATUS_LABEL, STATUS_COLOR, STATUS_LABEL } from '@/lib/status';
import { mapsLink, statusMessage, waLink, wazeLink } from '@/lib/whatsapp';
import type { Order, StaffProfile } from '@/lib/types';

const REJECT_REASONS = ['El monto no coincide', 'No recibimos el pago', 'La captura no es legible', 'Referencia inválida'];
const CANCEL_REASONS = ['El cliente lo pidió', 'Producto agotado', 'Fuera de zona de delivery', 'Pago no recibido', 'Pedido duplicado'];

export default function OrderDetail({ id }: { id: string }) {
  const { orders, settings, staff, upsertOrder } = usePanel();
  const fromList = orders.find((o) => o.id === id);
  const [order, setOrder] = useState<Order | null>(fromList ?? null);
  const [history, setHistory] = useState<{ status: string; note: string | null; created_at: string; changed_by: string | null }[]>([]);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const [drivers, setDrivers] = useState<StaffProfile[]>([]);
  const [driver, setDriver] = useState<string>('');
  const [reason, setReason] = useState<{ action: 'rechazar_pago' | 'cancelar'; text: string } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const { run, busy, error, setError, NotifyBar } = useOrderAction();
  const now = useNow(30_000);
  const isManager = staff.role !== 'repartidor';

  useEffect(() => {
    if (fromList) setOrder((prev) => ({ ...(prev ?? {}), ...fromList }) as Order);
  }, [fromList]);

  useEffect(() => {
    const sb = supabaseBrowser();
    sb.from('orders')
      .select(ORDER_LIST_SELECT)
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setOrder(data as Order);
          upsertOrder(data as Order);
        } else setNotFound(true);
      });
    if (isManager) {
      sb.from('staff_profiles')
        .select('*')
        .eq('active', true)
        .order('role', { ascending: false })
        .then(({ data }) => setDrivers((data ?? []) as StaffProfile[]));
    }
  }, [id, isManager, upsertOrder]);

  const updatedAt = order?.updated_at;
  useEffect(() => {
    supabaseBrowser()
      .from('order_status_history')
      .select('status, note, created_at, changed_by')
      .eq('order_id', id)
      .order('created_at')
      .then(({ data }) => setHistory(data ?? []));
  }, [id, updatedAt]);

  const proofPath = order?.proof_path;
  useEffect(() => {
    if (!proofPath || !isManager) return setProofUrl(null);
    supabaseBrowser()
      .storage.from('comprobantes')
      .createSignedUrl(proofPath, 60 * 30)
      .then(({ data }) => setProofUrl(data?.signedUrl ?? null));
  }, [proofPath, isManager]);

  useEffect(() => {
    if (order?.driver_id) setDriver(order.driver_id);
  }, [order?.driver_id]);

  if (notFound) {
    return (
      <div className="p-8 text-center text-sand-400">
        Pedido no encontrado.{' '}
        <Link href="/panel" className="text-gold-300">
          Volver
        </Link>
      </div>
    );
  }
  if (!order) return <div className="p-8 text-center text-sand-400">Cargando pedido…</div>;

  const act = async (a: OrderActionName, note?: string, drv?: string | null) => {
    const u = await run(order, a, note, drv);
    if (u) setOrder(u);
  };

  const active = !['entregado', 'cancelado'].includes(order.status);
  const paid = order.payment_status === 'verificado' || order.payment_status === 'cobrar_en_entrega';
  const digital = order.payment_method !== 'efectivo';
  const mins = minutesSince(order.created_at, now);
  const target = settings.prep_time_min + (order.delivery_type === 'delivery' ? settings.delivery_time_min : 0);
  const store = settings.store_lat != null && settings.store_lng != null ? { lat: settings.store_lat, lng: settings.store_lng } : null;
  const hasPin = order.lat != null && order.lng != null;
  const dist = store && hasPin ? distanceKm(store, { lat: order.lat!, lng: order.lng! }) : null;
  const trackingUrl = typeof window !== 'undefined' ? `${location.origin}/pedido/${order.tracking_token}` : '';
  const items = (order.order_items ?? []).slice().sort((a, b) => ((a as { sort?: number }).sort ?? 0) - ((b as { sort?: number }).sort ?? 0));
  const staffName = (uid: string | null) => drivers.find((d) => d.user_id === uid)?.full_name || drivers.find((d) => d.user_id === uid)?.email || '';

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/panel" className="p-2 -ml-2 rounded-full hover:bg-ink-800" aria-label="Volver">
          <IconBack />
        </Link>
        <h1 className="font-display text-3xl text-gold-300">{order.code}</h1>
        <span className={`chip ${STATUS_COLOR[order.status]}`}>{STATUS_LABEL[order.status]}</span>
        <span className={`chip ${PAYMENT_STATUS_COLOR[order.payment_status]}`}>{PAYMENT_STATUS_LABEL[order.payment_status]}</span>
        {active && <span className={`chip border ${elapsedClass(mins, target)}`}>{mins} min</span>}
        {isManager && (
          <div className="ml-auto flex gap-1">
            <a href={`/panel/imprimir/${order.id}?w=58`} target="_blank" className="btn-ghost btn-sm">
              <IconPrint className="w-4 h-4" /> 58mm
            </a>
            <a href={`/panel/imprimir/${order.id}?w=80`} target="_blank" className="btn-ghost btn-sm">
              <IconPrint className="w-4 h-4" /> 80mm
            </a>
          </div>
        )}
      </div>
      <p className="text-sm text-sand-400 -mt-2">
        {fmtDateTime(order.created_at, settings.timezone)} · {order.source === 'manual' ? 'Pedido manual' : 'Pedido web'}
        {order.scheduled_for && <b className="text-sky-300"> · ⏰ Programado: {fmtDateTime(order.scheduled_for, settings.timezone)}</b>}
      </p>

      {error && (
        <button onClick={() => setError(null)} className="w-full text-left rounded-xl bg-red-600/15 border border-red-500/40 text-red-200 text-sm p-3">
          {error}
        </button>
      )}

      {/* Acciones */}
      {active && (
        <section className="card p-3 flex flex-wrap gap-2">
          {isManager && order.status === 'nuevo' && (
            <button className="btn-terra flex-1 min-w-[140px]" disabled={!!busy} onClick={() => act('aceptar')}>
              ✓ Aceptar pedido
            </button>
          )}
          {isManager && digital && order.payment_status !== 'verificado' && (
            <>
              <button className="btn-success flex-1 min-w-[140px]" disabled={!!busy} onClick={() => act('verificar_pago')}>
                💳 Verificar pago
              </button>
              <button className="btn-ghost flex-1 min-w-[140px]" disabled={!!busy} onClick={() => setReason({ action: 'rechazar_pago', text: '' })}>
                Rechazar pago
              </button>
            </>
          )}
          {isManager && ['nuevo', 'aceptado'].includes(order.status) && paid && (
            <button className="btn-primary flex-1 min-w-[140px]" disabled={!!busy} onClick={() => act('preparar')}>
              🔥 En preparación
            </button>
          )}
          {isManager && ['aceptado', 'en_preparacion'].includes(order.status) && paid && (
            <button className="btn-success flex-1 min-w-[140px]" disabled={!!busy} onClick={() => act('listo')}>
              ✅ Listo
            </button>
          )}
          {isManager && order.delivery_type === 'delivery' && ['en_preparacion', 'listo'].includes(order.status) && paid && (
            <div className="flex gap-2 flex-1 min-w-[260px]">
              <select className="input py-2 flex-1" value={driver} onChange={(e) => setDriver(e.target.value)}>
                <option value="">Sin repartidor asignado</option>
                {drivers.map((d) => (
                  <option key={d.user_id} value={d.user_id}>
                    {d.full_name || d.email} {d.role === 'repartidor' ? '🛵' : ''}
                  </option>
                ))}
              </select>
              <button className="btn bg-indigo-500 text-white hover:bg-indigo-400" disabled={!!busy} onClick={() => act('despachar', undefined, driver || null)}>
                🛵 Despachar
              </button>
            </div>
          )}
          {order.status === 'en_camino' && isManager && (
            <div className="flex gap-2 flex-1 min-w-[260px]">
              <select className="input py-2 flex-1" value={driver} onChange={(e) => setDriver(e.target.value)}>
                <option value="">Sin repartidor</option>
                {drivers.map((d) => (
                  <option key={d.user_id} value={d.user_id}>
                    {d.full_name || d.email}
                  </option>
                ))}
              </select>
              <button className="btn-ghost" disabled={!!busy || driver === (order.driver_id ?? '')} onClick={() => act('asignar_repartidor', undefined, driver || null)}>
                Reasignar
              </button>
            </div>
          )}
          {(['listo', 'en_camino'].includes(order.status) || (order.status === 'en_preparacion' && order.delivery_type === 'pickup')) && paid && (
            <button className="btn-success flex-1 min-w-[140px]" disabled={!!busy} onClick={() => act('entregado')}>
              🎉 Entregado
            </button>
          )}
          {isManager && (
            <button className="btn-danger flex-1 min-w-[120px]" disabled={!!busy} onClick={() => setReason({ action: 'cancelar', text: '' })}>
              Cancelar
            </button>
          )}
        </section>
      )}

      <div className="grid lg:grid-cols-[1fr,380px] gap-4 items-start">
        <div className="space-y-4">
          {/* Productos */}
          <section className="card p-4">
            <h2 className="font-semibold mb-3">Productos</h2>
            <ul className="divide-y divide-ink-700">
              {items.map((it) => (
                <li key={it.id} className="py-2.5 flex gap-3">
                  <span className="font-display text-xl text-gold-300 w-8 shrink-0">{it.quantity}×</span>
                  <div className="flex-1">
                    <p className="font-semibold">{it.product_name}</p>
                    {(it.order_item_modifiers ?? []).map((m, i) => (
                      <p key={i} className="text-sm text-sand-300">
                        <span className="text-sand-500">{m.group_name}:</span> {m.option_name}
                        {m.price_cop ? <span className="text-sand-500"> (+{formatCop(m.price_cop)})</span> : null}
                      </p>
                    ))}
                    {it.notes && <p className="text-sm font-semibold text-amber-300 mt-0.5">📝 {it.notes}</p>}
                  </div>
                  <span className="tabular-nums text-sm">{formatCop(it.line_total_cop)}</span>
                </li>
              ))}
            </ul>
            {order.notes && <p className="mt-3 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-sm text-amber-200">🗒️ {order.notes}</p>}
            <dl className="mt-3 pt-3 border-t border-ink-700 text-sm space-y-1">
              <div className="flex justify-between">
                <dt className="text-sand-400">Subtotal</dt>
                <dd className="tabular-nums">{formatCop(order.subtotal_cop)}</dd>
              </div>
              {order.delivery_type === 'delivery' && (
                <div className="flex justify-between">
                  <dt className="text-sand-400">Delivery{order.zone_name ? ` (${order.zone_name})` : ''}</dt>
                  <dd className="tabular-nums">{formatCop(order.delivery_fee_cop)}</dd>
                </div>
              )}
              <div className="flex justify-between text-base font-bold">
                <dt>Total</dt>
                <dd className="tabular-nums text-gold-300">{formatCop(order.total_cop)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sand-400">USDT</dt>
                <dd className="tabular-nums font-semibold">{formatUsdt(Number(order.total_usdt))}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sand-400">Bolívares</dt>
                <dd className="tabular-nums font-semibold">{formatBs(Number(order.total_bs))}</dd>
              </div>
              <p className="text-xs text-sand-500">
                Tasas del pedido: 1 USDT = {formatRate(order.rate_cop_usdt)} COP · Bs. {formatRate(order.rate_bs_usdt)}
              </p>
            </dl>
          </section>

          {/* Pago */}
          <section className="card p-4 space-y-2">
            <h2 className="font-semibold">Pago</h2>
            <p className="text-sm">
              {METHOD_LABEL[order.payment_method]} · <span className={`chip ${PAYMENT_STATUS_COLOR[order.payment_status]}`}>{PAYMENT_STATUS_LABEL[order.payment_status]}</span>
            </p>
            {order.payment_method === 'binance' && <p className="text-sm">Monto esperado: <b className="text-gold-300">{formatUsdt(Number(order.total_usdt))}</b></p>}
            {order.payment_method === 'bolivares' && <p className="text-sm">Monto esperado: <b className="text-gold-300">{formatBs(Number(order.total_bs))}</b></p>}
            {order.payment_method === 'efectivo' && <p className="text-sm font-semibold text-gold-300">{cashLine(order)}</p>}
            {order.payment_reference && (
              <p className="text-sm">
                Referencia / ID: <b className="select-all">{order.payment_reference}</b>
              </p>
            )}
            {order.payment_reject_reason && <p className="text-sm text-red-300">Rechazado: {order.payment_reject_reason}</p>}
            {proofUrl &&
              (order.proof_path?.endsWith('.pdf') ? (
                <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
                  Ver comprobante (PDF)
                </a>
              ) : (
                <button onClick={() => setZoom(true)} className="block">
                  <img src={proofUrl} alt="Comprobante" className="max-h-72 rounded-xl border border-ink-600" />
                  <span className="text-xs text-sand-400">Toca para ampliar</span>
                </button>
              ))}
            {digital && !order.proof_path && !order.payment_reference && <p className="text-sm text-sand-400">Sin comprobante.</p>}
          </section>
        </div>

        <div className="space-y-4">
          {/* Cliente */}
          <section className="card p-4 space-y-2">
            <h2 className="font-semibold">Cliente</h2>
            <p className="text-lg font-semibold">{order.customer_name}</p>
            <p className="text-sm text-sand-300">
              {prettyPhone(order.customer_phone)}
              {order.customer_cedula && ` · ${order.customer_cedula}`}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <a href={`tel:${order.customer_phone}`} className="btn-ghost btn-sm">
                <IconPhone className="w-4 h-4" /> Llamar
              </a>
              <a
                href={waLink(order.customer_phone, statusMessage(order, order.status, trackingUrl))}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm bg-[#25D366] text-white"
              >
                <IconWhatsApp className="w-4 h-4" /> WhatsApp
              </a>
            </div>
          </section>

          {/* Entrega */}
          <section className="card p-4 space-y-2">
            <h2 className="font-semibold">{order.delivery_type === 'delivery' ? '🛵 Delivery' : '🏪 Retiro en local'}</h2>
            {order.delivery_type === 'delivery' && (
              <>
                <p className="text-sm">{order.address}</p>
                {order.address_reference && <p className="text-sm text-sand-400">Ref.: {order.address_reference}</p>}
                {order.driver_id && <p className="text-sm">Repartidor: <b>{staffName(order.driver_id) || 'Asignado'}</b></p>}
                {hasPin && (
                  <>
                    <MapView
                      center={[order.lat!, order.lng!]}
                      points={[
                        ...(store ? [{ ...store, label: 'Local', color: '#d4a24c' }] : []),
                        { lat: order.lat!, lng: order.lng!, label: 'Cliente', color: '#c8553d' },
                      ]}
                      className="h-56"
                    />
                    {dist != null && <p className="text-sm text-sand-300">Distancia aproximada (línea recta): <b>{dist.toFixed(1)} km</b></p>}
                    <div className="grid grid-cols-2 gap-2">
                      <a href={mapsLink(order.lat!, order.lng!)} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
                        Abrir en Google Maps
                      </a>
                      <a href={wazeLink(order.lat!, order.lng!)} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
                        Abrir en Waze
                      </a>
                    </div>
                  </>
                )}
              </>
            )}
          </section>

          {/* Historial */}
          <section className="card p-4">
            <h2 className="font-semibold mb-2">Historial</h2>
            <ol className="space-y-2 text-sm">
              {history.map((h, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-sand-500 tabular-nums w-16 shrink-0">{fmtClock(h.created_at, settings.timezone)}</span>
                  <span>
                    {HISTORY_LABEL[h.status] ?? h.status}
                    {h.note && <span className="block text-xs text-sand-400">{h.note}</span>}
                  </span>
                </li>
              ))}
            </ol>
            {order.cancel_reason && <p className="mt-2 text-sm text-red-300">Motivo de cancelación: {order.cancel_reason}</p>}
          </section>
        </div>
      </div>

      {/* Motivo (rechazo / cancelación) */}
      <Sheet
        open={!!reason}
        onClose={() => setReason(null)}
        title={reason?.action === 'cancelar' ? 'Cancelar pedido' : 'Rechazar pago'}
        footer={
          <button
            className="btn-danger w-full"
            disabled={!reason?.text.trim() || !!busy}
            onClick={async () => {
              if (!reason) return;
              await act(reason.action, reason.text.trim());
              setReason(null);
            }}
          >
            Confirmar
          </button>
        }
      >
        <div className="p-5 space-y-3">
          <div className="flex flex-wrap gap-2">
            {(reason?.action === 'cancelar' ? CANCEL_REASONS : REJECT_REASONS).map((r) => (
              <button key={r} className="chip bg-ink-800 border border-ink-600 text-sm py-1.5" onClick={() => setReason((x) => (x ? { ...x, text: r } : x))}>
                {r}
              </button>
            ))}
          </div>
          <textarea
            className="input"
            rows={3}
            placeholder="Escribe el motivo (el cliente lo verá)"
            value={reason?.text ?? ''}
            onChange={(e) => setReason((x) => (x ? { ...x, text: e.target.value } : x))}
          />
        </div>
      </Sheet>

      {zoom && proofUrl && (
        <button className="fixed inset-0 z-50 bg-black/90 grid place-items-center p-2" onClick={() => setZoom(false)} aria-label="Cerrar">
          <img src={proofUrl} alt="Comprobante ampliado" className="max-w-full max-h-full object-contain" />
        </button>
      )}
      <NotifyBar />
    </div>
  );
}
