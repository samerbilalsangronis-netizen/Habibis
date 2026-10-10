'use client';

import Link from 'next/link';
import MapView, { distanceKm } from '@/components/map';
import { usePanel } from './PanelContext';
import { useOrderAction } from './useOrderAction';
import { IconPhone, IconWhatsApp } from '@/components/ui/Icons';
import { formatCop, formatUsdt } from '@/lib/money';
import { cashLine } from '@/lib/orders';
import { mapsLink, wazeLink, waLink } from '@/lib/whatsapp';
import { METHOD_SHORT, PAYMENT_STATUS_LABEL } from '@/lib/status';

/** Vista del repartidor: solo sus pedidos asignados. */
export default function DriverBoard() {
  const { orders, settings, loading } = usePanel();
  const { run, busy, error, NotifyBar } = useOrderAction();
  const active = orders.filter((o) => ['listo', 'en_camino', 'en_preparacion', 'aceptado'].includes(o.status));
  const done = orders.filter((o) => o.status === 'entregado').slice(0, 10);
  const store = settings.store_lat != null && settings.store_lng != null ? { lat: settings.store_lat, lng: settings.store_lng } : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
      <h1 className="font-display text-2xl text-gold-300">Mis entregas</h1>
      {error && <p className="rounded-xl bg-red-600/15 border border-red-500/40 text-red-200 text-sm p-3">{error}</p>}
      {loading ? (
        <div className="card h-40 animate-pulse" />
      ) : active.length === 0 ? (
        <p className="text-center text-sand-500 py-12">No tienes entregas asignadas ahora. 🛵</p>
      ) : (
        active.map((o) => {
          const dist = store && o.lat != null && o.lng != null ? distanceKm(store, { lat: o.lat, lng: o.lng }) : null;
          return (
            <article key={o.id} className="card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-display text-xl text-gold-300">{o.code}</span>
                <span className="text-sm">{o.customer_name}</span>
                {dist != null && <span className="ml-auto text-xs text-sand-400">~{dist.toFixed(1)} km</span>}
              </div>
              <p className="text-sm">
                📍 {o.address}
                {o.address_reference && <span className="block text-sand-400">Ref.: {o.address_reference}</span>}
              </p>
              {o.lat != null && o.lng != null && (
                <MapView
                  center={[o.lat, o.lng]}
                  points={[
                    ...(store ? [{ ...store, label: 'Local', color: '#d4a24c' }] : []),
                    { lat: o.lat, lng: o.lng, label: o.customer_name.split(' ')[0], color: '#c8553d' },
                  ]}
                  className="h-48"
                />
              )}
              <div className="grid grid-cols-2 gap-2">
                <a href={`tel:${o.customer_phone}`} className="btn-ghost btn-sm">
                  <IconPhone className="w-4 h-4" /> Llamar
                </a>
                <a href={waLink(o.customer_phone, `Hola ${o.customer_name.split(' ')[0]}, soy el repartidor de Habibis con tu pedido ${o.code}.`)} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
                  <IconWhatsApp className="w-4 h-4" /> WhatsApp
                </a>
                {o.lat != null && o.lng != null && (
                  <>
                    <a href={mapsLink(o.lat, o.lng)} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
                      Google Maps
                    </a>
                    <a href={wazeLink(o.lat, o.lng)} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
                      Waze
                    </a>
                  </>
                )}
              </div>
              <div className="rounded-xl bg-ink-800 p-3 text-sm">
                <p className="font-semibold">
                  {METHOD_SHORT[o.payment_method]} · {PAYMENT_STATUS_LABEL[o.payment_status]}
                </p>
                <p className="text-gold-300 font-bold">{cashLine(o) ?? `Ya pagado · ${formatCop(o.total_cop)} (${formatUsdt(Number(o.total_usdt))})`}</p>
              </div>
              <button
                className="btn-success w-full text-base"
                disabled={!!busy || !['listo', 'en_camino'].includes(o.status)}
                onClick={() => run(o, 'entregado')}
              >
                {['listo', 'en_camino'].includes(o.status) ? '✓ Marcar entregado' : 'Aún en preparación'}
              </button>
            </article>
          );
        })
      )}
      {done.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-sand-400 mb-2">Entregados recientemente</h2>
          <ul className="card divide-y divide-ink-700">
            {done.map((o) => (
              <li key={o.id} className="p-3 flex justify-between text-sm">
                <Link href={`/panel/pedidos/${o.id}`} className="text-gold-300 font-semibold">
                  {o.code}
                </Link>
                <span>{o.customer_name}</span>
                <span className="tabular-nums">{formatCop(o.total_cop)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <NotifyBar />
    </div>
  );
}
