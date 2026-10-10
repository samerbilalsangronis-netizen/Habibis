'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import MapView from '@/components/map';
import PaymentInfo from './PaymentInfo';
import ProofInput from './ProofInput';
import { productSoldOut } from './ProductCard';
import { validateSelection } from './ProductSheet';
import { IconBack, IconBike, IconCheck, IconGps, IconStore } from '@/components/ui/Icons';
import { cashToCop, copToBs, copToUsdt, formatBs, formatCop, formatRate, formatUsdt, roundCop } from '@/lib/money';
import { fmtDateTime, isOpenNow, scheduleSlots } from '@/lib/hours';
import { useHydrated } from '@/lib/hooks';
import { normalizePhone } from '@/lib/phone';
import { lineTotal, lineUnit, useCart, usePrefs, useRecent, type CartLine } from '@/store/cart';
import type { CashCurrency, MenuData, MenuProduct, PaymentMethod } from '@/lib/types';

/** Ajusta el carrito al menú actual: quita agotados y actualiza precios. */
function reconcile(lines: CartLine[], byId: Map<string, MenuProduct>) {
  const removed: string[] = [];
  let changed = false;
  const next: CartLine[] = [];
  for (const l of lines) {
    const p = byId.get(l.productId);
    if (!p || productSoldOut(p)) {
      removed.push(l.name);
      continue;
    }
    const sel: Record<string, string[]> = {};
    const opts = p.groups.flatMap((g) => {
      const chosen = g.options.filter((o) => o.available && l.options.some((x) => x.id === o.id));
      sel[g.id] = chosen.map((o) => o.id);
      return chosen.map((o) => ({ id: o.id, name: o.name, groupName: g.name, price: o.price_cop }));
    });
    if (validateSelection(p.groups, sel)) {
      removed.push(l.name);
      continue;
    }
    const updated = { ...l, name: p.name, image: p.image_url, basePrice: p.price_cop, options: opts };
    if (lineUnit(updated) !== lineUnit(l) || opts.length !== l.options.length) changed = true;
    next.push(updated);
  }
  return { next, removed, changed: changed || removed.length > 0 };
}

const Section = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <section className="card p-4 sm:p-5">
    <h2 className="flex items-center gap-2.5 font-display text-xl text-gold-300 mb-4">
      <span className="grid place-items-center w-7 h-7 rounded-full bg-gold-500 text-ink-950 text-sm font-sans font-bold">{n}</span>
      {title}
    </h2>
    {children}
  </section>
);

export default function CheckoutView({ data }: { data: MenuData }) {
  const { settings, rate, hours, zones, categories } = data;
  const router = useRouter();
  const hydrated = useHydrated();
  const { lines, replaceAll, clear } = useCart();
  const prefs = usePrefs();
  const addRecent = useRecent((s) => s.addOrder);

  const byId = useMemo(() => new Map(categories.flatMap((c) => c.products).map((p) => [p.id, p])), [categories]);
  const [notice, setNotice] = useState<string | null>(null);

  // Cliente
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [cedula, setCedula] = useState('');
  // Entrega
  const [delivery, setDelivery] = useState(!settings.pickup_enabled && settings.delivery_enabled);
  const [zoneId, setZoneId] = useState('');
  const [address, setAddress] = useState('');
  const [reference, setReference] = useState('');
  const storeCenter: [number, number] = [settings.store_lat ?? 10.4806, settings.store_lng ?? -66.9036];
  const [pos, setPos] = useState<[number, number]>(storeCenter);
  const [posSet, setPosSet] = useState(false);
  const [gpsMsg, setGpsMsg] = useState<string | null>(null);
  // Cuándo
  const open = isOpenNow(settings, hours);
  const [when, setWhen] = useState<'asap' | 'later'>(open ? 'asap' : 'later');
  const [slot, setSlot] = useState('');
  // Pago
  const methods = (
    [
      settings.accept_binance && 'binance',
      settings.accept_bolivares && 'bolivares',
      settings.accept_cash && 'efectivo',
    ].filter(Boolean) as PaymentMethod[]
  ).filter((m) => m === 'efectivo' || rate);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [proof, setProof] = useState<File | null>(null);
  const [payRef, setPayRef] = useState('');
  const [cashCurrency, setCashCurrency] = useState<CashCurrency>(settings.cash_currencies[0] ?? 'COP');
  const [cashAmount, setCashAmount] = useState('');
  const [notes, setNotes] = useState('');
  // Envío
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Datos guardados del cliente
  useEffect(() => {
    if (!hydrated) return;
    setName((v) => v || prefs.customer.name);
    setPhone((v) => v || prefs.customer.phone);
    setCedula((v) => v || prefs.customer.cedula);
    if (prefs.lastAddress) {
      setAddress((v) => v || prefs.lastAddress!.address);
      setReference((v) => v || prefs.lastAddress!.reference);
      if (prefs.lastAddress.lat != null && prefs.lastAddress.lng != null) {
        setPos([prefs.lastAddress.lat, prefs.lastAddress.lng]);
        setPosSet(true);
      }
    }
  }, [hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reconciliar carrito una vez hidratado
  useEffect(() => {
    if (!hydrated) return;
    const r = reconcile(useCart.getState().lines, byId);
    if (r.changed) {
      replaceAll(r.next);
      setNotice(
        r.removed.length
          ? `Quitamos del carrito productos que ya no están disponibles: ${r.removed.join(', ')}.`
          : 'Actualizamos algunos precios del carrito.',
      );
    }
  }, [hydrated, byId, replaceAll]);

  const slots = useMemo(
    () => (settings.allow_scheduled ? scheduleSlots(hours, settings.timezone, Math.max(30, settings.prep_time_min), 3) : []),
    [hours, settings],
  );

  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const zone = zones.find((z) => z.id === zoneId);
  const fee = delivery ? (settings.delivery_mode === 'zones' ? (zone?.fee_cop ?? 0) : settings.delivery_fee_cop) : 0;
  const total = roundCop(subtotal + fee, settings.cop_rounding);
  const totalUsdt = rate ? copToUsdt(total, rate) : 0;
  const totalBs = rate ? copToBs(total, rate) : 0;
  const cashNum = Number(cashAmount.replace(/\./g, '').replace(',', '.')) || 0;
  const changeCop = rate && cashNum ? cashToCop(cashNum, cashCurrency, rate) - total : null;

  const useGps = () => {
    if (!('geolocation' in navigator)) {
      setGpsMsg('Tu navegador no permite obtener la ubicación. Mueve el pin manualmente.');
      return;
    }
    setGpsMsg('Buscando tu ubicación…');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos([p.coords.latitude, p.coords.longitude]);
        setPosSet(true);
        setGpsMsg(`Ubicación encontrada (precisión ~${Math.round(p.coords.accuracy)} m). Ajusta el pin si hace falta.`);
      },
      (err) =>
        setGpsMsg(
          err.code === err.PERMISSION_DENIED
            ? 'No diste permiso de ubicación. Mueve el pin hasta tu casa.'
            : 'No pudimos obtener tu ubicación. Mueve el pin manualmente.',
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  const validate = (): string | null => {
    if (!lines.length) return 'Tu carrito está vacío';
    if (name.trim().length < 2) return 'Escribe tu nombre';
    if (!normalizePhone(phone)) return 'Escribe un teléfono válido de Venezuela o Colombia';
    if (delivery) {
      if (settings.delivery_mode === 'zones' && !zone) return 'Elige tu zona de delivery';
      if (address.trim().length < 5) return 'Escribe la dirección de entrega';
      if (!posSet) return 'Marca tu ubicación en el mapa (usa “Usar mi ubicación” o mueve el pin)';
    }
    if (when === 'later' && !slot) return 'Elige la hora para tu pedido programado';
    if (!method) return 'Elige el método de pago';
    if (method !== 'efectivo' && !proof && !payRef.trim()) return 'Sube la captura del pago o escribe la referencia';
    if (settings.min_order_cop > 0 && subtotal < settings.min_order_cop) return `El pedido mínimo es ${formatCop(settings.min_order_cop)}`;
    return null;
  };

  const submit = async () => {
    const v = validate();
    setError(v);
    if (v) return;
    setSending(true);
    const normalized = normalizePhone(phone)!;
    const payload = {
      source: 'web',
      customer: { name: name.trim(), phone: normalized, cedula: cedula.trim() },
      delivery_type: delivery ? 'delivery' : 'pickup',
      address: delivery ? address.trim() : null,
      address_reference: delivery ? reference.trim() : null,
      lat: delivery ? pos[0] : null,
      lng: delivery ? pos[1] : null,
      zone_id: delivery && settings.delivery_mode === 'zones' ? zoneId : null,
      payment_method: method,
      payment_reference: method !== 'efectivo' ? payRef.trim() || null : null,
      cash_currency: method === 'efectivo' ? cashCurrency : null,
      cash_amount: method === 'efectivo' && cashNum ? cashNum : null,
      scheduled_for: when === 'later' ? slot : null,
      notes: notes.trim() || null,
      expected_total_cop: total,
      expected_rate_id: data.rateId,
      items: lines.map((l) => ({
        product_id: l.productId,
        quantity: l.quantity,
        option_ids: l.options.map((o) => o.id),
        notes: l.notes,
      })),
    };
    const fd = new FormData();
    fd.append('payload', JSON.stringify(payload));
    if (proof && method !== 'efectivo') fd.append('proof', proof);
    try {
      const res = await fetch('/api/orders', { method: 'POST', body: fd });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(out.error || 'No pudimos enviar tu pedido. Intenta de nuevo.');
        if (res.status === 409) router.refresh();
        setSending(false);
        return;
      }
      prefs.setCustomer({ name: name.trim(), phone: normalized, cedula: cedula.trim() });
      if (delivery) prefs.setLastAddress({ address: address.trim(), reference: reference.trim(), lat: pos[0], lng: pos[1] });
      addRecent({
        token: out.token,
        code: out.code,
        createdAt: new Date().toISOString(),
        totalCop: out.total_cop,
        items: lines.map((l) => ({
          productId: l.productId,
          name: l.name,
          quantity: l.quantity,
          optionIds: l.options.map((o) => o.id),
          notes: l.notes,
        })),
      });
      clear();
      router.replace(`/pedido/${out.token}?nuevo=1`);
    } catch {
      setError('Sin conexión. Revisa tu internet e intenta de nuevo.');
      setSending(false);
    }
  };

  if (!hydrated) {
    return <div className="min-h-dvh grid place-items-center text-sand-400">Cargando…</div>;
  }

  if (!lines.length && !sending) {
    return (
      <div className="min-h-dvh grid place-items-center p-6 text-center bg-pattern">
        <div>
          <p className="text-5xl">🧆</p>
          <p className="mt-3 text-sand-200">{notice ?? 'Tu carrito está vacío.'}</p>
          <Link href="/" className="btn-primary mt-5">
            Ver el menú
          </Link>
        </div>
      </div>
    );
  }

  const canSchedule = settings.allow_scheduled && slots.length > 0;
  const closedNoSchedule = !open && !(canSchedule && settings.allow_scheduled_when_closed);

  return (
    <div className="min-h-dvh bg-pattern pb-40">
      <header className="sticky top-0 z-30 bg-ink-950/85 backdrop-blur-md border-b border-ink-800">
        <div className="max-w-2xl mx-auto flex items-center gap-2 px-4 h-14">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-ink-800" aria-label="Volver al menú">
            <IconBack />
          </Link>
          <h1 className="font-display text-xl text-gold-300">Finalizar pedido</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {notice && <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-200 p-3 text-sm">{notice}</div>}
        {closedNoSchedule && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 text-red-200 p-3 text-sm">
            Estamos cerrados en este momento. Vuelve en nuestro horario de atención.
          </div>
        )}

        {/* Resumen */}
        <section className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Tu pedido</h2>
            <Link href="/" className="text-sm text-gold-300 font-semibold">
              Editar
            </Link>
          </div>
          <ul className="space-y-2 text-sm">
            {lines.map((l) => (
              <li key={l.key} className="flex justify-between gap-3">
                <span>
                  <b>{l.quantity}×</b> {l.name}
                  {l.options.length > 0 && <span className="block text-xs text-sand-400">{l.options.map((o) => o.name).join(' · ')}</span>}
                  {l.notes && <span className="block text-xs text-gold-300/80">📝 {l.notes}</span>}
                </span>
                <span className="tabular-nums whitespace-nowrap">{formatCop(lineTotal(l))}</span>
              </li>
            ))}
          </ul>
        </section>

        <Section n={1} title="Tus datos">
          <div className="space-y-3">
            <div>
              <label className="label" htmlFor="name">
                Nombre
              </label>
              <input id="name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="¿A nombre de quién?" />
            </div>
            <div>
              <label className="label" htmlFor="phone">
                Teléfono (WhatsApp)
              </label>
              <input
                id="phone"
                className="input"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0412 123 4567 · +57 300 123 4567"
              />
              {phone && !normalizePhone(phone) && <p className="text-xs text-terra-400 mt-1">Número de Venezuela (04xx…) o Colombia (3xx…)</p>}
            </div>
            <div>
              <label className="label" htmlFor="cedula">
                Cédula <span className="text-sand-500 font-normal">(opcional)</span>
              </label>
              <input id="cedula" className="input" inputMode="numeric" value={cedula} onChange={(e) => setCedula(e.target.value)} placeholder="V-12345678" />
            </div>
          </div>
        </Section>

        <Section n={2} title="Entrega">
          <div className="space-y-3">
            {settings.delivery_enabled ? (
              <label
                className={`flex items-center gap-3 rounded-2xl border-2 p-4 cursor-pointer transition ${
                  delivery ? 'border-gold-500 bg-gold-500/10' : 'border-ink-600 bg-ink-800'
                } ${!settings.pickup_enabled ? 'pointer-events-none' : ''}`}
              >
                <input type="checkbox" className="sr-only" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} />
                <span className={`grid place-items-center w-7 h-7 rounded-lg border-2 shrink-0 ${delivery ? 'bg-gold-500 border-gold-500 text-ink-950' : 'border-sand-500'}`}>
                  {delivery && <IconCheck className="w-5 h-5" />}
                </span>
                <IconBike className="w-7 h-7 text-gold-300 shrink-0" />
                <span className="flex-1">
                  <span className="block font-bold text-base">Agregar delivery</span>
                  <span className="block text-sm text-sand-300">
                    {settings.delivery_mode === 'zones'
                      ? '+ costo según tu zona'
                      : `+ ${formatCop(settings.delivery_fee_cop)}${rate ? ` (${formatUsdt(copToUsdt(settings.delivery_fee_cop, rate))} · ${formatBs(copToBs(settings.delivery_fee_cop, rate))})` : ''}`}
                  </span>
                </span>
              </label>
            ) : null}
            {!delivery && settings.pickup_enabled && (
              <div className="flex items-start gap-3 rounded-2xl bg-ink-800 border border-ink-700 p-4">
                <IconStore className="w-6 h-6 text-gold-300 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-base">Retiro en el local</p>
                  <p className="text-sand-300">
                    {settings.address}
                    {settings.city ? `, ${settings.city}` : ''}
                  </p>
                  {settings.store_lat != null && settings.store_lng != null && (
                    <a
                      className="text-gold-300 font-semibold"
                      href={`https://www.google.com/maps?q=${settings.store_lat},${settings.store_lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Ver en Google Maps
                    </a>
                  )}
                </div>
              </div>
            )}

            {delivery && (
              <div className="space-y-3 pt-1">
                {settings.delivery_mode === 'zones' && (
                  <div>
                    <label className="label" htmlFor="zone">
                      Zona
                    </label>
                    <select id="zone" className="input" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
                      <option value="">Elige tu zona…</option>
                      {zones.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name} — {formatCop(z.fee_cop)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="label" htmlFor="address">
                    Dirección
                  </label>
                  <textarea
                    id="address"
                    rows={2}
                    className="input resize-none"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Urbanización, calle, casa / edificio, piso, apto."
                  />
                </div>
                <div>
                  <label className="label" htmlFor="ref">
                    Punto de referencia
                  </label>
                  <input id="ref" className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ej.: frente a la panadería, portón negro" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="label mb-0">Ubicación en el mapa</span>
                    <button type="button" onClick={useGps} className="btn-ghost btn-sm">
                      <IconGps className="w-4 h-4" /> Usar mi ubicación actual
                    </button>
                  </div>
                  <MapView
                    center={pos}
                    zoom={posSet ? 17 : 14}
                    draggable
                    onChange={(lat, lng) => {
                      setPos([lat, lng]);
                      setPosSet(true);
                    }}
                    className="h-72"
                  />
                  <p className={`text-xs ${posSet ? 'text-emerald-300' : 'text-sand-400'}`}>
                    {gpsMsg ?? (posSet ? '✓ Ubicación marcada. Puedes arrastrar el pin para ajustarla.' : 'Toca el mapa o arrastra el pin hasta tu ubicación.')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </Section>

        <Section n={3} title="¿Para cuándo?">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!open}
              onClick={() => setWhen('asap')}
              className={`rounded-xl border-2 p-3 text-left disabled:opacity-40 ${when === 'asap' ? 'border-gold-500 bg-gold-500/10' : 'border-ink-600'}`}
            >
              <span className="block font-semibold">Lo antes posible</span>
              <span className="text-xs text-sand-400">
                ~{settings.prep_time_min + (delivery ? settings.delivery_time_min : 0)} min
              </span>
            </button>
            <button
              type="button"
              disabled={!canSchedule || (!open && !settings.allow_scheduled_when_closed)}
              onClick={() => setWhen('later')}
              className={`rounded-xl border-2 p-3 text-left disabled:opacity-40 ${when === 'later' ? 'border-gold-500 bg-gold-500/10' : 'border-ink-600'}`}
            >
              <span className="block font-semibold">Programar</span>
              <span className="text-xs text-sand-400">{canSchedule ? 'Elige día y hora' : 'No disponible'}</span>
            </button>
          </div>
          {when === 'later' && canSchedule && (
            <select className="input mt-3" value={slot} onChange={(e) => setSlot(e.target.value)}>
              <option value="">Elige la hora…</option>
              {slots.map((s) => (
                <option key={s.toISOString()} value={s.toISOString()}>
                  {fmtDateTime(s, settings.timezone)}
                </option>
              ))}
            </select>
          )}
        </Section>

        <Section n={4} title="Pago">
          <div className="space-y-2">
            {methods.length === 0 && <p className="text-sm text-sand-400">No hay métodos de pago disponibles en este momento.</p>}
            {methods.map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => setMethod(m)}
                className={`w-full flex items-center gap-3 rounded-2xl border-2 p-3.5 text-left ${method === m ? 'border-gold-500 bg-gold-500/10' : 'border-ink-600'}`}
              >
                <span className="text-2xl w-8 text-center">{m === 'binance' ? '🟡' : m === 'bolivares' ? '🏦' : '💵'}</span>
                <span className="flex-1">
                  <span className="block font-semibold">
                    {m === 'binance' ? 'Binance (USDT)' : m === 'bolivares' ? 'Bolívares' : 'Efectivo'}
                  </span>
                  <span className="block text-xs text-sand-400">
                    {m === 'binance'
                      ? `Binance Pay · ${formatUsdt(totalUsdt)}`
                      : m === 'bolivares'
                        ? `Pago móvil o transferencia · ${formatBs(totalBs)}`
                        : delivery
                          ? 'Pagas al repartidor (pedido + delivery)'
                          : 'Pagas al retirar en el local'}
                  </span>
                </span>
                <span className={`w-5 h-5 rounded-full border-2 ${method === m ? 'border-gold-500 bg-gold-500' : 'border-sand-500'}`} />
              </button>
            ))}
          </div>

          {method && method !== 'efectivo' && rate && (
            <div className="mt-4 space-y-3">
              <PaymentInfo method={method} settings={settings} totalUsdt={totalUsdt} totalBs={totalBs} />
              <div className="rounded-xl bg-ink-800/60 border border-ink-700 p-3 space-y-3">
                <p className="text-sm font-semibold">Confirma tu pago</p>
                <ProofInput file={proof} onChange={setProof} />
                <input
                  className="input"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder={method === 'binance' ? 'ID de la orden de Binance (opcional si subes captura)' : 'Número de referencia'}
                />
                <p className="text-xs text-sand-400">Preparamos tu pedido en cuanto verifiquemos el pago.</p>
              </div>
            </div>
          )}

          {method === 'efectivo' && (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-[auto,1fr] gap-2 items-end">
                <div>
                  <label className="label">Moneda</label>
                  <div className="flex rounded-xl bg-ink-800 border border-ink-600 p-1">
                    {settings.cash_currencies.map((c) => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setCashCurrency(c)}
                        className={`px-3 py-2 rounded-lg text-sm font-bold ${cashCurrency === c ? 'bg-gold-500 text-ink-950' : 'text-sand-200'}`}
                      >
                        {c === 'BS' ? 'Bs' : c}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="cash">
                    ¿Con cuánto pagas?
                  </label>
                  <input
                    id="cash"
                    className="input"
                    inputMode="decimal"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    placeholder={cashCurrency === 'COP' ? '50.000' : cashCurrency === 'USD' ? '20' : '5000'}
                  />
                </div>
              </div>
              <p className="text-sm text-sand-300">
                Debes pagar:{' '}
                <b className="text-gold-300">
                  {cashCurrency === 'COP' ? formatCop(total) : cashCurrency === 'USD' ? `$${totalUsdt.toFixed(2)}` : formatBs(totalBs)}
                </b>
                {changeCop != null && changeCop >= 0 && (
                  <span className="block text-xs text-sand-400 mt-1">
                    Vuelto aproximado: {formatCop(roundCop(changeCop, 100))}
                    {rate && ` (${formatUsdt(copToUsdt(changeCop, rate))} · ${formatBs(copToBs(changeCop, rate))})`}
                  </span>
                )}
                {changeCop != null && changeCop < 0 && <span className="block text-xs text-terra-400 mt-1">El monto no alcanza para el total.</span>}
              </p>
            </div>
          )}
        </Section>

        <section className="card p-4">
          <label className="label" htmlFor="gnotes">
            Comentarios del pedido <span className="text-sand-500 font-normal">(opcional)</span>
          </label>
          <textarea id="gnotes" rows={2} maxLength={300} className="input resize-none" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Algo más que debamos saber" />
        </section>

        {/* Totales */}
        <section className="card p-4 sm:p-5 pattern-faint">
          <dl className="space-y-1.5 text-sm relative">
            <div className="flex justify-between">
              <dt className="text-sand-300">Subtotal</dt>
              <dd className="tabular-nums">{formatCop(subtotal)}</dd>
            </div>
            {delivery && (
              <div className="flex justify-between">
                <dt className="text-sand-300">Delivery{zone ? ` (${zone.name})` : ''}</dt>
                <dd className="tabular-nums">{formatCop(fee)}</dd>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-2 border-t border-ink-700 mt-2">
              <dt className="font-bold text-base">Total</dt>
              <dd className="font-bold text-2xl text-gold-300 tabular-nums">{formatCop(total)}</dd>
            </div>
            {rate && (
              <>
                <div className="flex justify-between text-sand-200">
                  <dt>En USDT</dt>
                  <dd className="tabular-nums font-semibold">{formatUsdt(totalUsdt)}</dd>
                </div>
                <div className="flex justify-between text-sand-200">
                  <dt>En bolívares</dt>
                  <dd className="tabular-nums font-semibold">{formatBs(totalBs)}</dd>
                </div>
                <p className="text-[11px] text-sand-500 pt-1">
                  Tasa: 1 USDT = {formatRate(rate.cop_per_usdt)} COP · 1 USDT = Bs. {formatRate(rate.bs_per_usdt)}
                </p>
              </>
            )}
          </dl>
        </section>
      </main>

      <div className="fixed bottom-0 inset-x-0 z-30 px-4 pt-3 safe-bottom bg-gradient-to-t from-ink-950 via-ink-950/95 to-transparent">
        <div className="max-w-2xl mx-auto">
          {error && <p className="mb-2 rounded-xl bg-red-600/15 border border-red-500/40 text-red-200 text-sm p-3">{error}</p>}
          <button className="btn-primary w-full text-base py-4 shadow-glow" onClick={submit} disabled={sending || closedNoSchedule}>
            {sending ? 'Enviando pedido…' : `Confirmar pedido · ${formatCop(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
