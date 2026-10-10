'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import ProductSheet from '@/components/shop/ProductSheet';
import { productSoldOut } from '@/components/shop/ProductCard';
import MapView from '@/components/map';
import { IconMinus, IconPlus, IconSearch, IconTrash } from '@/components/ui/Icons';
import { copToBs, copToUsdt, formatBs, formatCop, formatUsdt, roundCop } from '@/lib/money';
import { normalizePhone } from '@/lib/phone';
import { lineTotal, type CartLine } from '@/store/cart';
import type { CashCurrency, MenuData, MenuProduct, PaymentMethod } from '@/lib/types';

const uid = () => Math.random().toString(36).slice(2);

export default function ManualOrder({ data }: { data: MenuData }) {
  const { settings, rate, zones, categories } = data;
  const router = useRouter();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [product, setProduct] = useState<MenuProduct | null>(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(categories[0]?.id ?? '');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [delivery, setDelivery] = useState(false);
  const [zoneId, setZoneId] = useState('');
  const [address, setAddress] = useState('');
  const [reference, setReference] = useState('');
  const [pin, setPin] = useState<[number, number] | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('efectivo');
  const [verified, setVerified] = useState(false);
  const [payRef, setPayRef] = useState('');
  const [cashCurrency, setCashCurrency] = useState<CashCurrency>('COP');
  const [cashAmount, setCashAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const products = useMemo(() => {
    const all = categories.flatMap((c) => c.products);
    const query = q.trim().toLowerCase();
    if (query) return all.filter((p) => p.name.toLowerCase().includes(query));
    return categories.find((c) => c.id === cat)?.products ?? [];
  }, [categories, q, cat]);

  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const zone = zones.find((z) => z.id === zoneId);
  const fee = delivery ? (settings.delivery_mode === 'zones' ? (zone?.fee_cop ?? 0) : settings.delivery_fee_cop) : 0;
  const total = roundCop(subtotal + fee, settings.cop_rounding);

  const quickAdd = (p: MenuProduct) => {
    if (productSoldOut(p)) return;
    if (p.groups.length) return setProduct(p);
    setLines((ls) => [...ls, { key: uid(), productId: p.id, name: p.name, image: null, basePrice: p.price_cop, options: [], quantity: 1, notes: '' }]);
  };

  const submit = async () => {
    setError(null);
    const ph = normalizePhone(phone);
    if (!lines.length) return setError('Agrega productos');
    if (name.trim().length < 2) return setError('Escribe el nombre del cliente');
    if (!ph) return setError('Teléfono inválido');
    if (delivery && address.trim().length < 5) return setError('Escribe la dirección');
    if (delivery && settings.delivery_mode === 'zones' && !zone) return setError('Elige la zona');
    setBusy(true);
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'manual',
        customer: { name: name.trim(), phone: ph, cedula: '' },
        delivery_type: delivery ? 'delivery' : 'pickup',
        address: delivery ? address.trim() : null,
        address_reference: delivery ? reference.trim() : null,
        lat: delivery && pin ? pin[0] : null,
        lng: delivery && pin ? pin[1] : null,
        zone_id: delivery && settings.delivery_mode === 'zones' ? zoneId : null,
        payment_method: method,
        payment_verified: method !== 'efectivo' && verified,
        payment_reference: method !== 'efectivo' ? payRef.trim() || null : null,
        cash_currency: method === 'efectivo' ? cashCurrency : null,
        cash_amount: method === 'efectivo' && cashAmount ? Number(cashAmount.replace(/\./g, '').replace(',', '.')) : null,
        notes: notes.trim() || null,
        items: lines.map((l) => ({ product_id: l.productId, quantity: l.quantity, option_ids: l.options.map((o) => o.id), notes: l.notes })),
      }),
    });
    const out = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(out.error || 'No se pudo crear el pedido');
    router.replace(`/panel/pedidos/${out.id}`);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-4">
      <h1 className="font-display text-2xl text-gold-300 mb-4">Nuevo pedido manual</h1>
      <div className="grid lg:grid-cols-[1fr,400px] gap-4 items-start">
        {/* Selector de productos */}
        <section className="card p-3 space-y-3">
          <div className="relative">
            <IconSearch className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-sand-500" />
            <input className="input pl-10" placeholder="Buscar producto" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {!q && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCat(c.id)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold border ${cat === c.id ? 'bg-gold-500 text-ink-950 border-gold-500' : 'border-ink-600'}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {products.map((p) => {
              const out = productSoldOut(p);
              return (
                <button
                  key={p.id}
                  disabled={out}
                  onClick={() => quickAdd(p)}
                  className="rounded-xl bg-ink-800 border border-ink-700 p-3 text-left hover:border-gold-500 disabled:opacity-40"
                >
                  <span className="block font-semibold text-sm leading-tight">{p.name}</span>
                  <span className="block text-xs text-gold-300 mt-1">{out ? 'Agotado' : formatCop(p.price_cop)}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Resumen y datos */}
        <section className="card p-4 space-y-4 lg:sticky lg:top-20">
          <div>
            <h2 className="font-semibold mb-2">Productos</h2>
            {lines.length === 0 ? (
              <p className="text-sm text-sand-500">Toca productos para agregarlos.</p>
            ) : (
              <ul className="space-y-2">
                {lines.map((l) => (
                  <li key={l.key} className="flex items-start gap-2 text-sm">
                    <div className="flex items-center rounded-lg bg-ink-800 border border-ink-700">
                      <button className="p-1.5" onClick={() => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x)))}>
                        <IconMinus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-5 text-center font-bold">{l.quantity}</span>
                      <button className="p-1.5" onClick={() => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, quantity: Math.min(50, x.quantity + 1) } : x)))}>
                        <IconPlus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{l.name}</p>
                      {l.options.length > 0 && <p className="text-xs text-sand-400">{l.options.map((o) => o.name).join(' · ')}</p>}
                      {l.notes && <p className="text-xs text-amber-300">📝 {l.notes}</p>}
                    </div>
                    <span className="tabular-nums">{formatCop(lineTotal(l))}</span>
                    <button className="p-1 text-terra-400" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label="Quitar">
                      <IconTrash className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="input" placeholder="Teléfono" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div className="flex rounded-xl bg-ink-800 border border-ink-600 p-1">
            <button onClick={() => setDelivery(false)} className={`flex-1 rounded-lg py-2 text-sm font-semibold ${!delivery ? 'bg-gold-500 text-ink-950' : ''}`}>
              🏪 Retiro / en local
            </button>
            <button onClick={() => setDelivery(true)} className={`flex-1 rounded-lg py-2 text-sm font-semibold ${delivery ? 'bg-gold-500 text-ink-950' : ''}`}>
              🛵 Delivery
            </button>
          </div>
          {delivery && (
            <div className="space-y-2">
              {settings.delivery_mode === 'zones' && (
                <select className="input" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
                  <option value="">Zona…</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} — {formatCop(z.fee_cop)}
                    </option>
                  ))}
                </select>
              )}
              <input className="input" placeholder="Dirección" value={address} onChange={(e) => setAddress(e.target.value)} />
              <input className="input" placeholder="Referencia" value={reference} onChange={(e) => setReference(e.target.value)} />
              <details>
                <summary className="text-sm text-gold-300 cursor-pointer">Marcar ubicación en el mapa (opcional)</summary>
                <div className="mt-2">
                  <MapView
                    center={pin ?? [settings.store_lat ?? 10.48, settings.store_lng ?? -66.9]}
                    draggable
                    onChange={(lat, lng) => setPin([lat, lng])}
                    className="h-56"
                  />
                </div>
              </details>
            </div>
          )}

          <div className="grid grid-cols-3 gap-1.5">
            {(['efectivo', 'binance', 'bolivares'] as PaymentMethod[]).map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`rounded-lg border py-2 text-sm font-semibold ${method === m ? 'border-gold-500 bg-gold-500/15 text-gold-300' : 'border-ink-600'}`}
              >
                {m === 'efectivo' ? '💵 Efectivo' : m === 'binance' ? '🟡 Binance' : '🏦 Bs'}
              </button>
            ))}
          </div>
          {method === 'efectivo' ? (
            <div className="flex gap-2">
              <select className="input w-28" value={cashCurrency} onChange={(e) => setCashCurrency(e.target.value as CashCurrency)}>
                <option value="COP">COP</option>
                <option value="USD">USD</option>
                <option value="BS">Bs</option>
              </select>
              <input className="input" placeholder="¿Con cuánto paga? (opcional)" inputMode="decimal" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} />
            </div>
          ) : (
            <div className="space-y-2">
              <input className="input" placeholder="Referencia (opcional)" value={payRef} onChange={(e) => setPayRef(e.target.value)} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="w-5 h-5 accent-amber-500" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
                El pago ya fue recibido y verificado
              </label>
            </div>
          )}
          <textarea className="input" rows={2} placeholder="Notas del pedido" value={notes} onChange={(e) => setNotes(e.target.value)} />

          <dl className="text-sm space-y-1 border-t border-ink-700 pt-3">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd className="tabular-nums">{formatCop(subtotal)}</dd>
            </div>
            {delivery && (
              <div className="flex justify-between">
                <dt>Delivery</dt>
                <dd className="tabular-nums">{formatCop(fee)}</dd>
              </div>
            )}
            <div className="flex justify-between font-bold text-base">
              <dt>Total</dt>
              <dd className="tabular-nums text-gold-300">{formatCop(total)}</dd>
            </div>
            {rate && (
              <p className="text-xs text-sand-400 text-right">
                {formatUsdt(copToUsdt(total, rate))} · {formatBs(copToBs(total, rate))}
              </p>
            )}
          </dl>
          {error && <p className="text-sm text-terra-400">{error}</p>}
          <button className="btn-primary w-full text-base" disabled={busy} onClick={submit}>
            {busy ? 'Creando…' : 'Crear pedido'}
          </button>
        </section>
      </div>

      <ProductSheet
        product={product}
        rates={rate}
        onClose={() => setProduct(null)}
        onAdd={(line) => setLines((ls) => [...ls, { ...line, key: uid() }])}
      />
    </div>
  );
}
