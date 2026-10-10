'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePanel } from './PanelContext';
import { useOrderAction, type OrderActionName } from './useOrderAction';
import StoreToggle from './StoreToggle';
import DriverBoard from './DriverBoard';
import { IconBike, IconStore } from '@/components/ui/Icons';
import { formatCop, formatUsdt } from '@/lib/money';
import { fmtClock, fmtDateTime, minutesSince } from '@/lib/hours';
import { useNow } from '@/lib/hooks';
import { supabaseBrowser } from '@/lib/supabase/client';
import {
  BOARD_TABS,
  METHOD_SHORT,
  PAYMENT_STATUS_COLOR,
  PAYMENT_STATUS_LABEL,
  STATUS_COLOR,
  STATUS_LABEL,
  boardTabOf,
  type BoardTab,
} from '@/lib/status';
import type { Order } from '@/lib/types';

export function elapsedClass(mins: number, target: number) {
  if (mins <= target) return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30';
  if (mins <= target * 1.5) return 'text-amber-300 bg-amber-500/10 border-amber-500/30';
  return 'text-red-300 bg-red-500/15 border-red-500/40 animate-pulse2';
}

function primaryAction(o: Order): { action: OrderActionName; label: string; cls: string } | null {
  const paid = o.payment_status === 'verificado' || o.payment_status === 'cobrar_en_entrega';
  switch (o.status) {
    case 'nuevo':
      return { action: 'aceptar', label: 'Aceptar', cls: 'btn-terra' };
    case 'aceptado':
      return paid ? { action: 'preparar', label: 'Preparar', cls: 'btn-primary' } : null;
    case 'en_preparacion':
      return paid ? { action: 'listo', label: 'Listo', cls: 'btn-success' } : null;
    case 'listo':
      return o.delivery_type === 'pickup' ? { action: 'entregado', label: 'Entregado', cls: 'btn-success' } : null;
    case 'en_camino':
      return { action: 'entregado', label: 'Entregado', cls: 'btn-success' };
    default:
      return null;
  }
}

export function OrderCard({ order, onAction, busy }: { order: Order; onAction: (o: Order, a: OrderActionName) => void; busy: boolean }) {
  const { settings } = usePanel();
  const now = useNow(30_000);
  const active = !['entregado', 'cancelado'].includes(order.status);
  const start = order.scheduled_for && new Date(order.scheduled_for).getTime() > new Date(order.created_at).getTime() ? order.scheduled_for : order.created_at;
  const mins = minutesSince(start, now);
  const waiting = order.scheduled_for && new Date(order.scheduled_for).getTime() > now;
  const target = settings.prep_time_min + (order.delivery_type === 'delivery' ? settings.delivery_time_min : 0);
  const items = order.order_items ?? [];
  const pa = primaryAction(order);

  return (
    <article className={`card p-3.5 flex flex-col gap-2.5 ${order.status === 'nuevo' ? 'border-terra-500 shadow-[0_0_0_1px_rgb(var(--terra-500))]' : ''}`}>
      <Link href={`/panel/pedidos/${order.id}`} className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <span className="font-display text-xl text-gold-300">{order.code}</span>
          <span className={`chip ${STATUS_COLOR[order.status]}`}>{STATUS_LABEL[order.status]}</span>
          {order.source === 'manual' && <span className="chip bg-ink-700 text-sand-200">Manual</span>}
          <span className="ml-auto">
            {active ? (
              waiting ? (
                <span className="chip border bg-sky-500/10 text-sky-300 border-sky-500/30">⏰ {fmtDateTime(order.scheduled_for!, settings.timezone)}</span>
              ) : (
                <span className={`chip border ${elapsedClass(mins, target)}`}>{mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${mins % 60} min`}</span>
              )
            ) : (
              <span className="text-xs text-sand-500">{fmtClock(order.created_at, settings.timezone)}</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {order.delivery_type === 'delivery' ? <IconBike className="w-4 h-4 text-gold-300" /> : <IconStore className="w-4 h-4 text-gold-300" />}
          <span className="font-semibold truncate">{order.customer_name}</span>
          <span className="text-sand-400 text-xs">{order.delivery_type === 'delivery' ? 'Delivery' : 'Retiro'}</span>
        </div>
        <p className="text-xs text-sand-300 line-clamp-2">
          {items
            .slice()
            .sort((a, b) => ((a as { sort?: number }).sort ?? 0) - ((b as { sort?: number }).sort ?? 0))
            .map((i) => `${i.quantity}× ${i.product_name}`)
            .join(' · ')}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold tabular-nums">{formatCop(order.total_cop)}</span>
          <span className="text-xs text-sand-400 tabular-nums">{formatUsdt(Number(order.total_usdt))}</span>
          <span className="ml-auto chip bg-ink-800 text-sand-200 border border-ink-600">{METHOD_SHORT[order.payment_method]}</span>
          <span className={`chip ${PAYMENT_STATUS_COLOR[order.payment_status]}`}>{PAYMENT_STATUS_LABEL[order.payment_status]}</span>
        </div>
      </Link>
      {active && (
        <div className="flex gap-2">
          <Link href={`/panel/pedidos/${order.id}`} className="btn-ghost btn-sm flex-1">
            {order.payment_status === 'por_verificar' ? 'Ver comprobante' : order.status === 'listo' && order.delivery_type === 'delivery' ? 'Despachar' : 'Ver detalle'}
          </Link>
          {pa && (
            <button className={`${pa.cls} btn-sm flex-1`} disabled={busy} onClick={() => onAction(order, pa.action)}>
              {pa.label}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

export default function OrdersBoard() {
  const { staff, orders, loading, settings } = usePanel();
  const [tab, setTab] = useState<BoardTab>('nuevos');
  const { run, busy, error, setError, NotifyBar } = useOrderAction();
  const [rateAge, setRateAge] = useState<number | null>(null);

  useEffect(() => {
    if (staff.role === 'repartidor') return;
    supabaseBrowser()
      .from('exchange_rates')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => setRateAge(data?.[0] ? (Date.now() - new Date(data[0].created_at).getTime()) / 3600_000 : Infinity));
  }, [staff.role]);

  const grouped = useMemo(() => {
    const g: Record<BoardTab, Order[]> = { nuevos: [], verificar: [], preparacion: [], listos: [], entregados: [], cancelados: [] };
    for (const o of orders) g[boardTabOf(o)].push(o);
    // Activos: el más antiguo primero; cerrados: el más reciente primero
    (['nuevos', 'verificar', 'preparacion', 'listos'] as BoardTab[]).forEach((k) => g[k].sort((a, b) => a.created_at.localeCompare(b.created_at)));
    return g;
  }, [orders]);

  // Cuando llega un pedido nuevo, saltar a "Nuevos"
  const prevNew = useRef(0);
  useEffect(() => {
    if (grouped.nuevos.length > prevNew.current) setTab('nuevos');
    prevNew.current = grouped.nuevos.length;
  }, [grouped.nuevos.length]);

  if (staff.role === 'repartidor') return <DriverBoard />;

  const list = grouped[tab];

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-2xl text-gold-300 mr-auto">Pedidos</h1>
        <StoreToggle />
        <Link href="/panel/pedidos/nuevo" className="btn-primary btn-sm">
          + Pedido manual
        </Link>
      </div>

      {rateAge != null && rateAge > settings.rate_stale_hours && (
        <Link
          href="/panel/configuracion#tasas"
          className="block rounded-xl border border-amber-500/50 bg-amber-500/10 text-amber-200 p-3 text-sm font-semibold"
        >
          ⚠️ {rateAge === Infinity ? 'No hay tasas cargadas.' : `Las tasas tienen más de ${Math.floor(rateAge)} h.`} Toca aquí para actualizarlas.
        </Link>
      )}

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
        {BOARD_TABS.map((t) => {
          const n = grouped[t.id].length;
          const hot = (t.id === 'nuevos' || t.id === 'verificar') && n > 0;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold border flex items-center gap-2 ${
                tab === t.id ? 'bg-gold-500 text-ink-950 border-gold-500' : 'bg-ink-900 border-ink-700 text-sand-200'
              }`}
            >
              {t.label}
              <span
                className={`min-w-6 h-6 px-1.5 rounded-full text-xs grid place-items-center ${
                  hot ? 'bg-terra-500 text-white' : tab === t.id ? 'bg-ink-950/20' : 'bg-ink-700'
                }`}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <button onClick={() => setError(null)} className="w-full text-left rounded-xl bg-red-600/15 border border-red-500/40 text-red-200 text-sm p-3">
          {error}
        </button>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card h-40 animate-pulse" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="text-center text-sand-500 py-16">
          <p className="text-4xl mb-2">🧆</p>
          No hay pedidos en “{BOARD_TABS.find((t) => t.id === tab)?.label}”.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {list.map((o) => (
            <OrderCard key={o.id} order={o} busy={!!busy} onAction={(ord, a) => run(ord, a)} />
          ))}
        </div>
      )}
      <NotifyBar />
    </div>
  );
}
