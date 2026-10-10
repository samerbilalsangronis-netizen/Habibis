'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePanel } from './PanelContext';
import { formatBs, formatCop, formatUsd, formatUsdt } from '@/lib/money';
import { startOfDayTz, zonedParts, zonedToUtc } from '@/lib/hours';
import { supabaseBrowser } from '@/lib/supabase/client';
import { METHOD_SHORT, PAYMENT_STATUS_LABEL, STATUS_LABEL } from '@/lib/status';
import type { Order } from '@/lib/types';

type Preset = 'hoy' | 'ayer' | 'semana' | 'mes' | 'custom';
type ROrder = Order & { order_items: { product_name: string; quantity: number; line_total_cop: number }[] };

const DAY = 24 * 3600_000;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const r2 = (n: number) => Math.round(n * 100) / 100;

function toInputDate(d: Date, tz: string) {
  const p = zonedParts(d, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}
function fromInputDate(s: string, tz: string) {
  const [y, m, d] = s.split('-').map(Number);
  return zonedToUtc(y, m, d, 0, 0, tz);
}

function totals(list: ROrder[]) {
  const ok = list.filter((o) => o.status !== 'cancelado');
  return {
    count: ok.length,
    cop: sum(ok.map((o) => o.total_cop)),
    usdt: r2(sum(ok.map((o) => Number(o.total_usdt)))),
    bs: r2(sum(ok.map((o) => Number(o.total_bs)))),
    cancelled: list.length - ok.length,
  };
}

function csvEscape(v: unknown) {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function Reports() {
  const { settings } = usePanel();
  const tz = settings.timezone;
  const [preset, setPreset] = useState<Preset>('hoy');
  const [from, setFrom] = useState(() => toInputDate(new Date(), tz));
  const [to, setTo] = useState(() => toInputDate(new Date(), tz));
  const [orders, setOrders] = useState<ROrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [cashDay, setCashDay] = useState(() => toInputDate(new Date(), tz));

  // Rango seleccionado
  const range = useMemo(() => {
    const now = new Date();
    const today = startOfDayTz(now, tz);
    const p = zonedParts(now, tz);
    if (preset === 'hoy') return { start: today, end: new Date(today.getTime() + DAY) };
    if (preset === 'ayer') return { start: new Date(today.getTime() - DAY), end: today };
    if (preset === 'semana') {
      const dow = (p.dow + 6) % 7; // lunes = 0
      return { start: new Date(today.getTime() - dow * DAY), end: new Date(today.getTime() + DAY) };
    }
    if (preset === 'mes') return { start: zonedToUtc(p.year, p.month, 1, 0, 0, tz), end: new Date(today.getTime() + DAY) };
    return { start: fromInputDate(from, tz), end: new Date(fromInputDate(to, tz).getTime() + DAY) };
  }, [preset, from, to, tz]);

  // Se carga desde el inicio del mes (o del rango si es anterior) para los resúmenes
  const monthStart = useMemo(() => {
    const p = zonedParts(new Date(), tz);
    return zonedToUtc(p.year, p.month, 1, 0, 0, tz);
  }, [tz]);
  const cashStart = useMemo(() => fromInputDate(cashDay, tz), [cashDay, tz]);
  const loadFrom = new Date(Math.min(range.start.getTime(), monthStart.getTime(), cashStart.getTime(), startOfDayTz(new Date(), tz).getTime() - 7 * DAY));
  // Fin estable (inicio de hoy + 2 días): usar Date.now() aquí cambiaba en cada render y recargaba sin parar
  const loadTo = new Date(Math.max(range.end.getTime(), startOfDayTz(new Date(), tz).getTime() + 2 * DAY));
  const loadKey = `${loadFrom.toISOString()}|${loadTo.toISOString()}`;

  useEffect(() => {
    setLoading(true);
    const [a, b] = loadKey.split('|');
    (async () => {
      const all: ROrder[] = [];
      for (let page = 0; page < 20; page++) {
        const { data, error } = await supabaseBrowser()
          .from('orders')
          .select('*, order_items(product_name, quantity, line_total_cop)')
          .gte('created_at', a)
          .lt('created_at', b)
          .order('created_at', { ascending: false })
          .range(page * 1000, page * 1000 + 999);
        if (error || !data) break;
        all.push(...(data as ROrder[]));
        if (data.length < 1000) break;
      }
      setOrders(all);
      setLoading(false);
    })();
  }, [loadKey]);

  const inRange = (o: ROrder, s: Date, e: Date) => {
    const t = new Date(o.created_at).getTime();
    return t >= s.getTime() && t < e.getTime();
  };
  const sel = orders.filter((o) => inRange(o, range.start, range.end));
  const ok = sel.filter((o) => o.status !== 'cancelado');
  const T = totals(sel);

  const now = new Date();
  const today = startOfDayTz(now, tz);
  const pNow = zonedParts(now, tz);
  const weekStart = new Date(today.getTime() - ((pNow.dow + 6) % 7) * DAY);
  const summary = [
    { label: 'Hoy', t: totals(orders.filter((o) => inRange(o, today, new Date(today.getTime() + DAY)))) },
    { label: 'Esta semana', t: totals(orders.filter((o) => inRange(o, weekStart, new Date(today.getTime() + DAY)))) },
    { label: 'Este mes', t: totals(orders.filter((o) => inRange(o, monthStart, new Date(today.getTime() + DAY)))) },
  ];

  const byMethod = (['efectivo', 'binance', 'bolivares'] as const).map((m) => {
    const l = ok.filter((o) => o.payment_method === m);
    return { m, ...totals(l) };
  });

  const products = useMemo(() => {
    const map = new Map<string, { qty: number; cop: number }>();
    for (const o of ok) for (const i of o.order_items ?? []) {
      const x = map.get(i.product_name) ?? { qty: 0, cop: 0 };
      x.qty += i.quantity;
      x.cop += i.line_total_cop;
      map.set(i.product_name, x);
    }
    return [...map.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 15);
  }, [ok]);

  const zones = useMemo(() => {
    const map = new Map<string, { count: number; cop: number; fees: number }>();
    for (const o of ok) {
      const k = o.delivery_type === 'pickup' ? 'Retiro en local' : o.zone_name || 'Delivery (tarifa única)';
      const x = map.get(k) ?? { count: 0, cop: 0, fees: 0 };
      x.count++;
      x.cop += o.total_cop;
      x.fees += o.delivery_fee_cop;
      map.set(k, x);
    }
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [ok]);

  const delivery = ok.filter((o) => o.delivery_type === 'delivery');
  const pickup = ok.filter((o) => o.delivery_type === 'pickup');

  // Cierre de caja del día elegido
  const dayOrders = orders.filter((o) => inRange(o, cashStart, new Date(cashStart.getTime() + DAY)) && o.status !== 'cancelado');
  const delivered = dayOrders.filter((o) => o.status === 'entregado');
  const pendingDay = dayOrders.filter((o) => o.status !== 'entregado');
  const cash = delivered.filter((o) => o.payment_method === 'efectivo');
  const cashCop = sum(cash.filter((o) => (o.cash_currency ?? 'COP') === 'COP').map((o) => o.total_cop));
  const cashUsd = r2(sum(cash.filter((o) => o.cash_currency === 'USD').map((o) => Number(o.total_usdt))));
  const cashBs = r2(sum(cash.filter((o) => o.cash_currency === 'BS').map((o) => Number(o.total_bs))));
  const digUsdt = r2(sum(delivered.filter((o) => o.payment_method === 'binance').map((o) => Number(o.total_usdt))));
  const digBs = r2(sum(delivered.filter((o) => o.payment_method === 'bolivares').map((o) => Number(o.total_bs))));

  const exportCsv = () => {
    const head = [
      'codigo', 'fecha', 'estado', 'cliente', 'telefono', 'entrega', 'zona', 'subtotal_cop', 'delivery_cop', 'total_cop', 'total_usdt', 'total_bs',
      'tasa_cop_usdt', 'tasa_bs_usdt', 'metodo_pago', 'estado_pago', 'moneda_efectivo', 'referencia', 'productos',
    ];
    const rows = sel.map((o) => [
      o.code,
      new Intl.DateTimeFormat('es-VE', { timeZone: tz, dateStyle: 'short', timeStyle: 'short' }).format(new Date(o.created_at)),
      STATUS_LABEL[o.status],
      o.customer_name,
      o.customer_phone,
      o.delivery_type === 'delivery' ? 'Delivery' : 'Retiro',
      o.zone_name ?? '',
      o.subtotal_cop,
      o.delivery_fee_cop,
      o.total_cop,
      o.total_usdt,
      o.total_bs,
      o.rate_cop_usdt,
      o.rate_bs_usdt,
      METHOD_SHORT[o.payment_method],
      PAYMENT_STATUS_LABEL[o.payment_status],
      o.cash_currency ?? '',
      o.payment_reference ?? '',
      (o.order_items ?? []).map((i) => `${i.quantity}x ${i.product_name}`).join(' | '),
    ]);
    const csv = '﻿' + [head, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `habibis-pedidos-${toInputDate(range.start, tz)}_${toInputDate(new Date(range.end.getTime() - 1), tz)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const Card = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="card p-4">
      <p className="text-xs text-sand-400">{label}</p>
      {children}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-2xl text-gold-300 mr-auto">Reportes</h1>
        <button className="btn-ghost btn-sm" onClick={exportCsv} disabled={loading || !sel.length}>
          ⬇️ Exportar CSV
        </button>
      </div>

      {/* Resumen día / semana / mes */}
      <div className="grid sm:grid-cols-3 gap-3">
        {summary.map((s) => (
          <Card key={s.label} label={s.label}>
            <p className="text-2xl font-bold text-gold-300 tabular-nums">{formatCop(s.t.cop)}</p>
            <p className="text-sm text-sand-300 tabular-nums">
              {formatUsdt(s.t.usdt)} · {formatBs(s.t.bs)}
            </p>
            <p className="text-xs text-sand-500 mt-1">{s.t.count} pedidos</p>
          </Card>
        ))}
      </div>

      {/* Selector de rango */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ['hoy', 'Hoy'],
            ['ayer', 'Ayer'],
            ['semana', 'Semana'],
            ['mes', 'Mes'],
            ['custom', 'Personalizado'],
          ] as [Preset, string][]
        ).map(([id, l]) => (
          <button
            key={id}
            onClick={() => setPreset(id)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold border ${preset === id ? 'bg-gold-500 text-ink-950 border-gold-500' : 'border-ink-600'}`}
          >
            {l}
          </button>
        ))}
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" className="input py-1.5" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span>a</span>
            <input type="date" className="input py-1.5" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        )}
      </div>

      {loading ? (
        <div className="card h-48 animate-pulse" />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card label="Ventas">
              <p className="text-xl font-bold text-gold-300 tabular-nums">{formatCop(T.cop)}</p>
              <p className="text-xs text-sand-300">
                {formatUsdt(T.usdt)} · {formatBs(T.bs)}
              </p>
            </Card>
            <Card label="Pedidos">
              <p className="text-xl font-bold tabular-nums">{T.count}</p>
              <p className="text-xs text-sand-400">{T.cancelled} cancelados</p>
            </Card>
            <Card label="Ticket promedio">
              <p className="text-xl font-bold tabular-nums">{formatCop(T.count ? Math.round(T.cop / T.count) : 0)}</p>
              <p className="text-xs text-sand-400">{formatUsdt(T.count ? r2(T.usdt / T.count) : 0)}</p>
            </Card>
            <Card label="Delivery vs retiro">
              <p className="text-xl font-bold tabular-nums">
                {delivery.length} / {pickup.length}
              </p>
              <p className="text-xs text-sand-400">Cobrado en delivery: {formatCop(sum(delivery.map((o) => o.delivery_fee_cop)))}</p>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <section className="card p-4">
              <h2 className="font-semibold mb-2">Por método de pago</h2>
              <table className="w-full text-sm">
                <thead className="text-xs text-sand-400 text-left">
                  <tr>
                    <th className="py-1">Método</th>
                    <th>Pedidos</th>
                    <th className="text-right">COP</th>
                    <th className="text-right">USDT</th>
                    <th className="text-right">Bs</th>
                  </tr>
                </thead>
                <tbody>
                  {byMethod.map((r) => (
                    <tr key={r.m} className="border-t border-ink-700">
                      <td className="py-2 font-semibold">{METHOD_SHORT[r.m]}</td>
                      <td>{r.count}</td>
                      <td className="text-right tabular-nums">{formatCop(r.cop).replace(' COP', '')}</td>
                      <td className="text-right tabular-nums">{r.usdt.toFixed(2)}</td>
                      <td className="text-right tabular-nums">{r.bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="card p-4">
              <h2 className="font-semibold mb-2">Por zona / tipo de entrega</h2>
              <table className="w-full text-sm">
                <tbody>
                  {zones.map(([k, v]) => (
                    <tr key={k} className="border-t border-ink-700 first:border-0">
                      <td className="py-2">{k}</td>
                      <td className="text-right">{v.count} ped.</td>
                      <td className="text-right tabular-nums">{formatCop(v.cop)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="card p-4">
              <h2 className="font-semibold mb-2">Productos más vendidos</h2>
              <ol className="space-y-1.5 text-sm">
                {products.map(([name, v], i) => {
                  const max = products[0]?.[1].qty || 1;
                  return (
                    <li key={name}>
                      <div className="flex justify-between">
                        <span>
                          {i + 1}. {name}
                        </span>
                        <span className="tabular-nums text-sand-300">
                          {v.qty} · {formatCop(v.cop)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-ink-800 mt-1">
                        <div className="h-full rounded-full bg-gold-500" style={{ width: `${(v.qty / max) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
                {!products.length && <p className="text-sand-500">Sin ventas en el rango.</p>}
              </ol>
            </section>

            {/* Cierre de caja */}
            <section className="card p-4 space-y-3 border-gold-500/40">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">Cierre de caja</h2>
                <input type="date" className="input py-1.5 w-auto" value={cashDay} onChange={(e) => setCashDay(e.target.value)} />
              </div>
              <p className="text-xs text-sand-400">Pedidos entregados del día (no incluye cancelados). Compara con lo que hay físicamente en caja y en las cuentas.</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-ink-800 p-2">
                  <p className="text-[11px] text-sand-400">Efectivo COP</p>
                  <p className="font-bold tabular-nums">{formatCop(cashCop)}</p>
                </div>
                <div className="rounded-xl bg-ink-800 p-2">
                  <p className="text-[11px] text-sand-400">Efectivo USD</p>
                  <p className="font-bold tabular-nums">{formatUsd(cashUsd)}</p>
                </div>
                <div className="rounded-xl bg-ink-800 p-2">
                  <p className="text-[11px] text-sand-400">Efectivo Bs</p>
                  <p className="font-bold tabular-nums">{formatBs(cashBs)}</p>
                </div>
                <div className="rounded-xl bg-ink-800 p-2 col-span-3 sm:col-span-1">
                  <p className="text-[11px] text-sand-400">Binance</p>
                  <p className="font-bold tabular-nums">{formatUsdt(digUsdt)}</p>
                </div>
                <div className="rounded-xl bg-ink-800 p-2 col-span-3 sm:col-span-2">
                  <p className="text-[11px] text-sand-400">Bolívares (pago móvil / transf.)</p>
                  <p className="font-bold tabular-nums">{formatBs(digBs)}</p>
                </div>
              </div>
              <p className="text-sm">
                Total entregado: <b className="text-gold-300">{formatCop(sum(delivered.map((o) => o.total_cop)))}</b> en {delivered.length} pedidos
              </p>
              {pendingDay.length > 0 && <p className="text-xs text-amber-300">⚠️ {pendingDay.length} pedido(s) del día aún no están marcados como entregados.</p>}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
