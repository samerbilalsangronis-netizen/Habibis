'use client';

import { useCallback, useEffect, useState } from 'react';
import MapView from '@/components/map';
import Switch from '@/components/ui/Switch';
import { IconTrash, IconUpload } from '@/components/ui/Icons';
import StoreToggle from './StoreToggle';
import { usePanel } from './PanelContext';
import { ROLE_LABEL } from './PanelShell';
import { compressImage } from '@/lib/image';
import { DAY_NAMES, fmtDateTime } from '@/lib/hours';
import { copToBs, copToUsdt, formatBs, formatCop, formatRate, formatUsdt } from '@/lib/money';
import { supabaseBrowser } from '@/lib/supabase/client';
import { VAPID_PUBLIC_KEY } from '@/lib/env';
import type { BusinessHour, CashCurrency, DeliveryZone, ExchangeRate, Settings, StaffProfile, StaffRole } from '@/lib/types';

type Tab = 'tasas' | 'horario' | 'delivery' | 'pagos' | 'negocio' | 'notificaciones' | 'usuarios' | 'cuenta';
const TABS: { id: Tab; label: string; admin: boolean }[] = [
  { id: 'tasas', label: '💱 Tasas', admin: true },
  { id: 'horario', label: '🕒 Horario', admin: true },
  { id: 'delivery', label: '🛵 Delivery', admin: true },
  { id: 'pagos', label: '💳 Pagos', admin: true },
  { id: 'negocio', label: '🏪 Negocio', admin: true },
  { id: 'notificaciones', label: '🔔 Notificaciones', admin: false },
  { id: 'usuarios', label: '👥 Usuarios', admin: true },
  { id: 'cuenta', label: '🔑 Mi cuenta', admin: false },
];

function useSaver() {
  const { settings, setSettings } = usePanel();
  const [state, setState] = useState<{ busy: boolean; msg: string | null; ok: boolean }>({ busy: false, msg: null, ok: false });
  const save = async (patch: Partial<Settings>) => {
    setState({ busy: true, msg: null, ok: false });
    const { data, error } = await supabaseBrowser().from('settings').update(patch).eq('id', 1).select().single();
    if (error) return setState({ busy: false, msg: error.message, ok: false });
    setSettings(data as Settings);
    setState({ busy: false, msg: 'Guardado ✓', ok: true });
    setTimeout(() => setState((s) => ({ ...s, msg: null })), 2500);
  };
  return { settings, save, ...state };
}

function SaveBar({ busy, msg, ok, onSave, label = 'Guardar cambios' }: { busy: boolean; msg: string | null; ok: boolean; onSave: () => void; label?: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <button className="btn-primary" disabled={busy} onClick={onSave}>
        {busy ? 'Guardando…' : label}
      </button>
      {msg && <span className={`text-sm ${ok ? 'text-emerald-300' : 'text-terra-400'}`}>{msg}</span>}
    </div>
  );
}

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div>
    <label className="label">{label}</label>
    {children}
    {hint && <p className="text-xs text-sand-500 mt-1">{hint}</p>}
  </div>
);

const num = (v: string) => Number(v.replace(/\./g, '').replace(',', '.')) || 0;

/* ============================== Tasas ============================== */
function RatesTab() {
  const { settings } = usePanel();
  const sb = supabaseBrowser();
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [cop, setCop] = useState('');
  const [bs, setBs] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data } = await sb.from('exchange_rates').select('*').order('created_at', { ascending: false }).limit(20);
    setRates((data ?? []) as ExchangeRate[]);
  }, [sb]);
  useEffect(() => {
    load();
  }, [load]);

  const current = rates[0];
  const ageH = current ? (Date.now() - new Date(current.created_at).getTime()) / 3600_000 : Infinity;
  const stale = ageH > settings.rate_stale_hours;

  const saveManual = async () => {
    const c = num(cop);
    const b = num(bs);
    if (!(c > 0) || !(b > 0)) return setMsg({ ok: false, text: 'Escribe las dos tasas' });
    setBusy('manual');
    const { error } = await sb.from('exchange_rates').insert({ cop_per_usdt: c, bs_per_usdt: b, source: 'manual' });
    setBusy(null);
    if (error) return setMsg({ ok: false, text: error.message });
    setCop('');
    setBs('');
    setMsg({ ok: true, text: 'Tasas actualizadas ✓' });
    load();
  };

  const fromBinance = async () => {
    setBusy('binance');
    setMsg(null);
    const res = await fetch('/api/rates/binance', { method: 'POST' });
    const out = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setMsg({ ok: false, text: out.error || 'No se pudo consultar Binance' });
    setMsg({ ok: true, text: `Desde Binance: 1 USDT = ${formatRate(out.cop_per_usdt)} COP · Bs. ${formatRate(out.bs_per_usdt)}` });
    load();
  };

  const sample = 22000;
  return (
    <div className="space-y-4">
      <section className={`card p-4 ${stale ? 'border-amber-500/60' : ''}`}>
        <h2 className="font-semibold">Tasa vigente</h2>
        {current ? (
          <>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="rounded-xl bg-ink-800 p-3">
                <p className="text-xs text-sand-400">COP por 1 USDT</p>
                <p className="text-2xl font-bold text-gold-300 tabular-nums">{formatRate(current.cop_per_usdt)}</p>
              </div>
              <div className="rounded-xl bg-ink-800 p-3">
                <p className="text-xs text-sand-400">Bs por 1 USDT</p>
                <p className="text-2xl font-bold text-gold-300 tabular-nums">{formatRate(current.bs_per_usdt)}</p>
              </div>
            </div>
            <p className={`text-sm mt-2 ${stale ? 'text-amber-300 font-semibold' : 'text-sand-400'}`}>
              {stale ? '⚠️ ' : ''}Actualizada {fmtDateTime(current.created_at, settings.timezone)} ({current.source === 'binance' ? 'Binance' : 'manual'})
              {stale && ` · tiene más de ${settings.rate_stale_hours} h`}
            </p>
            <p className="text-xs text-sand-500 mt-1">
              Ejemplo: {formatCop(sample)} = {formatUsdt(copToUsdt(sample, current))} = {formatBs(copToBs(sample, current))}
            </p>
          </>
        ) : (
          <p className="text-amber-300 mt-2">No hay tasas cargadas. Los clientes no podrán pagar en USDT ni Bs.</p>
        )}
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Actualizar tasas del día</h2>
        <p className="text-sm text-sand-400">Busca en Binance P2P el precio del USDT en pesos y en bolívares y escríbelo aquí.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="COP por 1 USDT">
            <input className="input text-lg" inputMode="decimal" placeholder={current ? String(current.cop_per_usdt) : '3900'} value={cop} onChange={(e) => setCop(e.target.value)} />
          </Field>
          <Field label="Bs por 1 USDT">
            <input className="input text-lg" inputMode="decimal" placeholder={current ? String(current.bs_per_usdt) : '380'} value={bs} onChange={(e) => setBs(e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={!!busy} onClick={saveManual}>
            {busy === 'manual' ? 'Guardando…' : 'Guardar tasas'}
          </button>
          <button className="btn-ghost" disabled={!!busy} onClick={fromBinance}>
            {busy === 'binance' ? 'Consultando…' : '🟡 Actualizar desde Binance'}
          </button>
        </div>
        {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-300' : 'text-terra-400'}`}>{msg.text}</p>}
        <p className="text-xs text-sand-500">Los pedidos ya hechos guardan la tasa de su momento; cambiarla no los afecta.</p>
      </section>

      <section className="card p-4">
        <h2 className="font-semibold mb-2">Historial</h2>
        <table className="w-full text-sm">
          <thead className="text-sand-400 text-xs text-left">
            <tr>
              <th className="py-1">Fecha</th>
              <th>COP/USDT</th>
              <th>Bs/USDT</th>
              <th>Origen</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => (
              <tr key={r.id} className="border-t border-ink-700">
                <td className="py-1.5">{fmtDateTime(r.created_at, settings.timezone)}</td>
                <td className="tabular-nums">{formatRate(r.cop_per_usdt)}</td>
                <td className="tabular-nums">{formatRate(r.bs_per_usdt)}</td>
                <td>{r.source === 'binance' ? 'Binance' : 'Manual'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

/* ============================== Horario ============================== */
function HoursTab() {
  const { settings, save, busy, msg, ok } = useSaver();
  const sb = supabaseBrowser();
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [hmsg, setHmsg] = useState<string | null>(null);
  const [flags, setFlags] = useState({
    allow_scheduled: settings.allow_scheduled,
    allow_scheduled_when_closed: settings.allow_scheduled_when_closed,
  });
  useEffect(() => {
    sb.from('business_hours')
      .select('*')
      .order('day_of_week')
      .then(({ data }) => setHours((data ?? []) as BusinessHour[]));
  }, [sb]);

  const saveHours = async () => {
    setHmsg(null);
    const { error } = await sb.from('business_hours').upsert(hours.map((h) => ({ ...h, open_time: h.open_time.slice(0, 5), close_time: h.close_time.slice(0, 5) })));
    if (error) return setHmsg(error.message);
    await save(flags);
    setHmsg('Horario guardado ✓');
  };
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div className="space-y-4">
      <section className="card p-4 flex items-center gap-3 flex-wrap">
        <div className="flex-1">
          <h2 className="font-semibold">Abrir / cerrar ahora</h2>
          <p className="text-sm text-sand-400">Para cerrar antes por un imprevisto o abrir fuera de horario.</p>
        </div>
        <StoreToggle />
      </section>
      <section className="card p-4 space-y-2">
        <h2 className="font-semibold mb-1">Horario semanal</h2>
        {order.map((d) => {
          const h = hours.find((x) => x.day_of_week === d);
          if (!h) return null;
          const upd = (patch: Partial<BusinessHour>) => setHours((hs) => hs.map((x) => (x.day_of_week === d ? { ...x, ...patch } : x)));
          return (
            <div key={d} className="flex items-center gap-2 rounded-xl bg-ink-800 p-2.5">
              <span className="w-24 font-semibold text-sm">{DAY_NAMES[d]}</span>
              <Switch size="sm" checked={h.is_open} onChange={(v) => upd({ is_open: v })} label="Abierto" />
              {h.is_open ? (
                <>
                  <input type="time" className="input py-1.5 w-28" value={h.open_time.slice(0, 5)} onChange={(e) => upd({ open_time: e.target.value })} />
                  <span className="text-sand-500">a</span>
                  <input type="time" className="input py-1.5 w-28" value={h.close_time.slice(0, 5)} onChange={(e) => upd({ close_time: e.target.value })} />
                </>
              ) : (
                <span className="text-sm text-sand-500">Cerrado</span>
              )}
            </div>
          );
        })}
        <p className="text-xs text-sand-500">Si la hora de cierre es menor que la de apertura (ej. 6:00 p. m. a 2:00 a. m.) se entiende que cierra al día siguiente.</p>
      </section>
      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Pedidos programados</h2>
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm">Permitir programar pedidos para más tarde</span>
          <Switch checked={flags.allow_scheduled} onChange={(v) => setFlags((f) => ({ ...f, allow_scheduled: v }))} />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm">Aceptar pedidos programados aunque estemos cerrados</span>
          <Switch checked={flags.allow_scheduled_when_closed} onChange={(v) => setFlags((f) => ({ ...f, allow_scheduled_when_closed: v }))} />
        </label>
      </section>
      <SaveBar busy={busy} msg={hmsg ?? msg} ok={ok || !!hmsg?.includes('✓')} onSave={saveHours} label="Guardar horario" />
    </div>
  );
}

/* ============================== Delivery ============================== */
function DeliveryTab() {
  const { settings, save, busy, msg, ok } = useSaver();
  const sb = supabaseBrowser();
  const [f, setF] = useState({
    delivery_enabled: settings.delivery_enabled,
    pickup_enabled: settings.pickup_enabled,
    delivery_mode: settings.delivery_mode,
    delivery_fee_cop: settings.delivery_fee_cop,
    delivery_time_min: settings.delivery_time_min,
  });
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const loadZones = useCallback(() => {
    sb.from('delivery_zones')
      .select('*')
      .order('sort')
      .then(({ data }) => setZones((data ?? []) as DeliveryZone[]));
  }, [sb]);
  useEffect(() => loadZones(), [loadZones]);

  const saveZone = async (z: DeliveryZone) => {
    await sb.from('delivery_zones').update({ name: z.name, fee_cop: z.fee_cop, active: z.active }).eq('id', z.id);
  };
  const addZone = async () => {
    await sb.from('delivery_zones').insert({ name: 'Nueva zona', fee_cop: settings.delivery_fee_cop, sort: zones.length + 1 });
    loadZones();
  };
  const delZone = async (z: DeliveryZone) => {
    if (!confirm(`¿Borrar la zona "${z.name}"?`)) return;
    await sb.from('delivery_zones').delete().eq('id', z.id);
    loadZones();
  };

  return (
    <div className="space-y-4">
      <section className="card p-4 space-y-3">
        <label className="flex items-center justify-between">
          <span className="font-semibold">Ofrecer delivery</span>
          <Switch checked={f.delivery_enabled} onChange={(v) => setF({ ...f, delivery_enabled: v })} />
        </label>
        <label className="flex items-center justify-between">
          <span className="font-semibold">Ofrecer retiro en el local</span>
          <Switch checked={f.pickup_enabled} onChange={(v) => setF({ ...f, pickup_enabled: v })} />
        </label>
        <Field label="Tarifa de delivery" hint={formatCop(f.delivery_fee_cop)}>
          <div className="flex rounded-xl bg-ink-800 border border-ink-600 p-1 mb-2">
            <button className={`flex-1 rounded-lg py-2 text-sm font-semibold ${f.delivery_mode === 'flat' ? 'bg-gold-500 text-ink-950' : ''}`} onClick={() => setF({ ...f, delivery_mode: 'flat' })}>
              Tarifa única
            </button>
            <button className={`flex-1 rounded-lg py-2 text-sm font-semibold ${f.delivery_mode === 'zones' ? 'bg-gold-500 text-ink-950' : ''}`} onClick={() => setF({ ...f, delivery_mode: 'zones' })}>
              Por zonas
            </button>
          </div>
          {f.delivery_mode === 'flat' && (
            <input className="input" inputMode="numeric" value={f.delivery_fee_cop} onChange={(e) => setF({ ...f, delivery_fee_cop: num(e.target.value) })} />
          )}
        </Field>
        <Field label="Tiempo estimado de entrega (min)">
          <input className="input" inputMode="numeric" value={f.delivery_time_min} onChange={(e) => setF({ ...f, delivery_time_min: num(e.target.value) })} />
        </Field>
        <SaveBar busy={busy} msg={msg} ok={ok} onSave={() => save(f)} />
      </section>

      <section className={`card p-4 space-y-2 ${f.delivery_mode !== 'zones' ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Zonas {f.delivery_mode !== 'zones' && <span className="text-xs text-sand-400">(inactivas: se usa tarifa única)</span>}</h2>
          <button className="btn-ghost btn-sm" onClick={addZone}>
            + Zona
          </button>
        </div>
        {zones.map((z) => (
          <div key={z.id} className="flex items-center gap-2">
            <input
              className="input py-2 flex-1"
              value={z.name}
              onChange={(e) => setZones((zs) => zs.map((x) => (x.id === z.id ? { ...x, name: e.target.value } : x)))}
              onBlur={() => saveZone(z)}
            />
            <input
              className="input py-2 w-28"
              inputMode="numeric"
              value={z.fee_cop}
              onChange={(e) => setZones((zs) => zs.map((x) => (x.id === z.id ? { ...x, fee_cop: num(e.target.value) } : x)))}
              onBlur={() => saveZone(z)}
            />
            <Switch
              size="sm"
              checked={z.active}
              onChange={(v) => {
                const nz = { ...z, active: v };
                setZones((zs) => zs.map((x) => (x.id === z.id ? nz : x)));
                saveZone(nz);
              }}
            />
            <button className="p-1.5 text-terra-400" onClick={() => delZone(z)} aria-label="Borrar zona">
              <IconTrash className="w-4 h-4" />
            </button>
          </div>
        ))}
        <p className="text-xs text-sand-500">Los cambios de zonas se guardan al salir de cada campo. Activa “Por zonas” arriba para usarlas.</p>
      </section>
    </div>
  );
}

/* ============================== Pagos ============================== */
function PaymentsTab() {
  const { settings, save, busy, msg, ok } = useSaver();
  const keys = [
    'accept_binance',
    'accept_bolivares',
    'accept_cash',
    'binance_pay_id',
    'binance_email',
    'binance_name',
    'pago_movil_bank',
    'pago_movil_phone',
    'pago_movil_id',
    'transfer_bank',
    'transfer_account',
    'transfer_holder',
    'transfer_id',
    'cash_currencies',
  ] as const;
  const [f, setF] = useState(() => Object.fromEntries(keys.map((k) => [k, settings[k]])) as Pick<Settings, (typeof keys)[number]>);
  const txt = (k: keyof typeof f, label: string, ph = '') => (
    <Field label={label}>
      <input className="input" value={(f[k] as string) ?? ''} placeholder={ph} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </Field>
  );
  const toggleCur = (c: CashCurrency) =>
    setF({ ...f, cash_currencies: f.cash_currencies.includes(c) ? f.cash_currencies.filter((x) => x !== c) : [...f.cash_currencies, c] });
  return (
    <div className="space-y-4">
      <section className="card p-4 space-y-3">
        <label className="flex items-center justify-between">
          <span className="font-semibold">🟡 Binance (USDT)</span>
          <Switch checked={f.accept_binance} onChange={(v) => setF({ ...f, accept_binance: v })} />
        </label>
        {txt('binance_pay_id', 'Binance Pay ID', '123456789')}
        {txt('binance_email', 'Correo de Binance')}
        {txt('binance_name', 'Nombre de la cuenta')}
      </section>
      <section className="card p-4 space-y-3">
        <label className="flex items-center justify-between">
          <span className="font-semibold">🏦 Bolívares</span>
          <Switch checked={f.accept_bolivares} onChange={(v) => setF({ ...f, accept_bolivares: v })} />
        </label>
        <p className="text-sm font-semibold text-gold-300">Pago móvil</p>
        <div className="grid sm:grid-cols-3 gap-2">
          {txt('pago_movil_bank', 'Banco', 'Banco de Venezuela (0102)')}
          {txt('pago_movil_phone', 'Teléfono', '0412-0000000')}
          {txt('pago_movil_id', 'Cédula / RIF', 'V-00000000')}
        </div>
        <p className="text-sm font-semibold text-gold-300">Transferencia (opcional)</p>
        <div className="grid sm:grid-cols-2 gap-2">
          {txt('transfer_bank', 'Banco')}
          {txt('transfer_account', 'Número de cuenta')}
          {txt('transfer_holder', 'Titular')}
          {txt('transfer_id', 'Cédula / RIF')}
        </div>
      </section>
      <section className="card p-4 space-y-3">
        <label className="flex items-center justify-between">
          <span className="font-semibold">💵 Efectivo</span>
          <Switch checked={f.accept_cash} onChange={(v) => setF({ ...f, accept_cash: v })} />
        </label>
        <p className="text-sm text-sand-400">Monedas que aceptas en efectivo:</p>
        <div className="flex gap-2">
          {(['COP', 'USD', 'BS'] as CashCurrency[]).map((c) => (
            <button
              key={c}
              onClick={() => toggleCur(c)}
              className={`rounded-xl border-2 px-4 py-2 font-bold ${f.cash_currencies.includes(c) ? 'border-gold-500 bg-gold-500/15 text-gold-300' : 'border-ink-600 text-sand-400'}`}
            >
              {c === 'BS' ? 'Bs' : c}
            </button>
          ))}
        </div>
      </section>
      <SaveBar busy={busy} msg={msg} ok={ok} onSave={() => save(f)} />
    </div>
  );
}

/* ============================== Negocio ============================== */
function BusinessTab() {
  const { settings, save, busy, msg, ok } = useSaver();
  const sb = supabaseBrowser();
  const keys = [
    'business_name',
    'tagline',
    'logo_url',
    'whatsapp_phone',
    'instagram',
    'address',
    'city',
    'store_lat',
    'store_lng',
    'min_order_cop',
    'prep_time_min',
    'cop_rounding',
    'rate_stale_hours',
    'rate_limit_phone',
    'rate_limit_ip',
    'rate_limit_window_min',
  ] as const;
  const [f, setF] = useState(() => Object.fromEntries(keys.map((k) => [k, settings[k]])) as Pick<Settings, (typeof keys)[number]>);
  const [uploading, setUploading] = useState(false);

  const uploadLogo = async (file: File) => {
    setUploading(true);
    const img = file.type === 'image/svg+xml' ? file : await compressImage(file, { maxSize: 512, type: 'image/png', quality: 0.92 });
    const ext = img.type === 'image/svg+xml' ? 'svg' : img.type === 'image/png' ? 'png' : 'jpg';
    const path = `branding/logo-${Date.now()}.${ext}`;
    const { error } = await sb.storage.from('productos').upload(path, img, { contentType: img.type, cacheControl: '31536000' });
    setUploading(false);
    if (error) return alert(error.message);
    setF({ ...f, logo_url: sb.storage.from('productos').getPublicUrl(path).data.publicUrl });
  };

  const t = (k: keyof typeof f, label: string, hint?: string, numeric = false) => (
    <Field label={label} hint={hint}>
      <input
        className="input"
        inputMode={numeric ? 'numeric' : undefined}
        value={(f[k] as string | number | null) ?? ''}
        onChange={(e) => setF({ ...f, [k]: numeric ? num(e.target.value) : e.target.value })}
      />
    </Field>
  );

  return (
    <div className="space-y-4">
      <section className="card p-4 space-y-3">
        <div className="flex items-center gap-4">
          <label className="relative w-20 h-20 rounded-2xl overflow-hidden bg-ink-800 border-2 border-dashed border-ink-600 grid place-items-center cursor-pointer shrink-0">
            <img src={f.logo_url || '/logo.svg'} alt="Logo" className="absolute inset-0 w-full h-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 bg-black/60 text-[10px] text-center py-0.5">
              <IconUpload className="w-3 h-3 inline" /> {uploading ? '…' : 'Cambiar'}
            </span>
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
          </label>
          <div className="flex-1 grid gap-2">
            {t('business_name', 'Nombre del negocio')}
            {t('tagline', 'Frase corta')}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          {t('whatsapp_phone', 'WhatsApp del negocio', 'Solo números con código de país. Ej.: 584121234567')}
          {t('instagram', 'Instagram', 'Usuario sin @')}
          {t('address', 'Dirección del local')}
          {t('city', 'Ciudad')}
        </div>
        <Field label="Ubicación del local" hint="Arrastra el pin o toca el mapa. Se usa para el retiro y para calcular la distancia del delivery.">
          <MapView
            center={[f.store_lat ?? 10.48, f.store_lng ?? -66.9]}
            draggable
            onChange={(lat, lng) => setF((x) => ({ ...x, store_lat: lat, store_lng: lng }))}
            className="h-64"
          />
        </Field>
      </section>
      <section className="card p-4 grid sm:grid-cols-2 gap-3">
        {t('min_order_cop', 'Pedido mínimo (COP)', '0 = sin mínimo', true)}
        {t('prep_time_min', 'Tiempo de preparación (min)', undefined, true)}
        {t('cop_rounding', 'Redondeo del total en COP', '100 = a la centena; 1 = sin redondeo', true)}
        {t('rate_stale_hours', 'Alertar si la tasa tiene más de (horas)', undefined, true)}
      </section>
      <section className="card p-4 grid sm:grid-cols-3 gap-3">
        <p className="sm:col-span-3 font-semibold">Antispam</p>
        {t('rate_limit_phone', 'Pedidos por teléfono', undefined, true)}
        {t('rate_limit_ip', 'Pedidos por conexión', undefined, true)}
        {t('rate_limit_window_min', 'En (minutos)', undefined, true)}
      </section>
      <SaveBar busy={busy} msg={msg} ok={ok} onSave={() => save({ ...f, whatsapp_phone: String(f.whatsapp_phone).replace(/\D/g, ''), instagram: (f.instagram ?? '').replace(/^@/, '') })} />
    </div>
  );
}

/* ============================== Notificaciones ============================== */
function urlB64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function NotificationsTab() {
  const { soundOn, toggleSound, enableSound } = usePanel();
  const [status, setStatus] = useState<'cargando' | 'no-soportado' | 'activo' | 'inactivo' | 'bloqueado'>('cargando');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;

  const check = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return setStatus('no-soportado');
    if (Notification.permission === 'denied') return setStatus('bloqueado');
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    setStatus(sub ? 'activo' : 'inactivo');
  }, []);
  useEffect(() => {
    check();
  }, [check]);

  const enable = async () => {
    setBusy(true);
    setMsg(null);
    try {
      if (!VAPID_PUBLIC_KEY) throw new Error('Falta configurar NEXT_PUBLIC_VAPID_PUBLIC_KEY');
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setStatus(perm === 'denied' ? 'bloqueado' : 'inactivo');
        throw new Error('No diste permiso para notificaciones');
      }
      const reg = (await navigator.serviceWorker.getRegistration('/')) ?? (await navigator.serviceWorker.register('/sw.js', { scope: '/' }));
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY) }));
      const res = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'No se pudo guardar');
      setStatus('activo');
      setMsg('Notificaciones activadas en este dispositivo ✓');
    } catch (e) {
      setMsg((e as Error).message);
    }
    setBusy(false);
  };

  const disable = async () => {
    setBusy(true);
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch('/api/push/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setStatus('inactivo');
    setBusy(false);
  };

  const test = async () => {
    setMsg(null);
    const res = await fetch('/api/push/test', { method: 'POST' });
    const out = await res.json().catch(() => ({}));
    setMsg(res.ok ? (out.sent ? 'Enviada. Debería llegarte en unos segundos.' : `No se envió (${out.skipped || 'sin dispositivos'})`) : out.error);
  };

  return (
    <div className="space-y-4">
      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Notificaciones push en este dispositivo</h2>
        <p className="text-sm text-sand-400">Te avisan de cada pedido nuevo aunque el panel esté cerrado.</p>
        {isIOS && !standalone && (
          <p className="text-sm rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-200 p-3">
            En iPhone primero instala el panel: botón Compartir → “Agregar a pantalla de inicio”, ábrelo desde el ícono y vuelve aquí.
          </p>
        )}
        <p className="text-sm">
          Estado:{' '}
          <b className={status === 'activo' ? 'text-emerald-300' : 'text-amber-300'}>
            {
              {
                cargando: '…',
                'no-soportado': 'Este navegador no soporta notificaciones',
                activo: 'Activadas',
                inactivo: 'Desactivadas',
                bloqueado: 'Bloqueadas (actívalas en los ajustes del navegador)',
              }[status]
            }
          </b>
        </p>
        <div className="flex flex-wrap gap-2">
          {status !== 'activo' ? (
            <button className="btn-primary" disabled={busy || status === 'no-soportado' || status === 'bloqueado'} onClick={enable}>
              🔔 Activar notificaciones
            </button>
          ) : (
            <>
              <button className="btn-ghost" disabled={busy} onClick={test}>
                Enviar prueba
              </button>
              <button className="btn-ghost" disabled={busy} onClick={disable}>
                Desactivar
              </button>
            </>
          )}
        </div>
        {msg && <p className="text-sm text-sand-200">{msg}</p>}
      </section>
      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Alarma con sonido</h2>
        <p className="text-sm text-sand-400">Suena cada pocos segundos mientras haya pedidos sin aceptar y el panel esté abierto.</p>
        <label className="flex items-center justify-between">
          <span>Sonido activado</span>
          <Switch checked={soundOn} onChange={toggleSound} />
        </label>
        <button className="btn-ghost btn-sm" onClick={enableSound}>
          ▶️ Probar sonido
        </button>
      </section>
    </div>
  );
}

/* ============================== Usuarios ============================== */
function UsersTab() {
  const { staff } = usePanel();
  const [users, setUsers] = useState<StaffProfile[]>([]);
  const [form, setForm] = useState({ email: '', full_name: '', phone: '', role: 'operador' as StaffRole, password: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabaseBrowser().from('staff_profiles').select('*').order('created_at');
    setUsers((data ?? []) as StaffProfile[]);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const call = async (method: 'POST' | 'PATCH', body: object) => {
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/staff', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const out = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(out.error || 'Error');
      return false;
    }
    load();
    return true;
  };

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <h2 className="font-semibold mb-2">Personal</h2>
        <ul className="divide-y divide-ink-700">
          {users.map((u) => (
            <li key={u.user_id} className={`py-3 flex flex-wrap items-center gap-2 ${!u.active ? 'opacity-50' : ''}`}>
              <div className="flex-1 min-w-[160px]">
                <p className="font-semibold">
                  {u.full_name} {u.user_id === staff.user_id && <span className="text-xs text-sand-400">(tú)</span>}
                </p>
                <p className="text-xs text-sand-400">{u.email}</p>
              </div>
              <select
                className="input py-1.5 w-36 text-sm"
                value={u.role}
                disabled={u.user_id === staff.user_id}
                onChange={(e) => call('PATCH', { user_id: u.user_id, role: e.target.value })}
              >
                {(['admin', 'operador', 'repartidor'] as StaffRole[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
              <button
                className="btn-ghost btn-sm"
                onClick={() => {
                  const p = prompt(`Nueva contraseña para ${u.full_name} (mínimo 8 caracteres):`);
                  if (p) call('PATCH', { user_id: u.user_id, password: p }).then((okk) => okk && setMsg('Contraseña cambiada ✓'));
                }}
              >
                Contraseña
              </button>
              {u.user_id !== staff.user_id && (
                <Switch size="sm" checked={u.active} onChange={(v) => call('PATCH', { user_id: u.user_id, active: v })} label="Activo" />
              )}
            </li>
          ))}
        </ul>
        <p className="text-xs text-sand-500 mt-2">
          <b>Administrador</b>: todo. <b>Operador</b>: pedidos, disponibilidad y abrir/cerrar (sin configuración ni reportes de dinero). <b>Repartidor</b>: solo
          sus entregas asignadas.
        </p>
      </section>
      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Agregar usuario</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          <input className="input" placeholder="Nombre" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <input className="input" placeholder="Correo" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="input" placeholder="Teléfono (opcional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}>
            {(['operador', 'repartidor', 'admin'] as StaffRole[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <input
            className="input sm:col-span-2"
            placeholder="Contraseña inicial (mín. 8)"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        <button
          className="btn-primary"
          disabled={busy}
          onClick={async () => {
            if (await call('POST', form)) {
              setForm({ email: '', full_name: '', phone: '', role: 'operador', password: '' });
              setMsg('Usuario creado ✓ Comparte el correo y la contraseña con la persona.');
            }
          }}
        >
          Crear usuario
        </button>
        {msg && <p className="text-sm text-sand-200">{msg}</p>}
      </section>
    </div>
  );
}

/* ============================== Mi cuenta ============================== */
function AccountTab() {
  const { staff } = usePanel();
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const change = async () => {
    if (p1.length < 8) return setMsg('Mínimo 8 caracteres');
    if (p1 !== p2) return setMsg('Las contraseñas no coinciden');
    const { error } = await supabaseBrowser().auth.updateUser({ password: p1 });
    setMsg(error ? error.message : 'Contraseña actualizada ✓');
    if (!error) {
      setP1('');
      setP2('');
    }
  };
  return (
    <section className="card p-4 space-y-3 max-w-md">
      <p className="text-sm">
        {staff.full_name} · {staff.email} · <b>{ROLE_LABEL[staff.role]}</b>
      </p>
      <h2 className="font-semibold">Cambiar mi contraseña</h2>
      <input className="input" type="password" placeholder="Nueva contraseña" value={p1} onChange={(e) => setP1(e.target.value)} autoComplete="new-password" />
      <input className="input" type="password" placeholder="Repite la contraseña" value={p2} onChange={(e) => setP2(e.target.value)} autoComplete="new-password" />
      <button className="btn-primary" onClick={change}>
        Cambiar contraseña
      </button>
      {msg && <p className="text-sm text-sand-200">{msg}</p>}
    </section>
  );
}

export default function SettingsPage() {
  const { staff } = usePanel();
  const isAdmin = staff.role === 'admin';
  const tabs = TABS.filter((t) => isAdmin || !t.admin);
  const [tab, setTab] = useState<Tab>(isAdmin ? 'tasas' : 'notificaciones');

  useEffect(() => {
    const h = location.hash.replace('#', '') as Tab;
    if (tabs.some((t) => t.id === h)) setTab(h);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
      <h1 className="font-display text-2xl text-gold-300">Ajustes</h1>
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              history.replaceState(null, '', `#${t.id}`);
            }}
            className={`whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold border ${tab === t.id ? 'bg-gold-500 text-ink-950 border-gold-500' : 'bg-ink-900 border-ink-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'tasas' && <RatesTab />}
      {tab === 'horario' && <HoursTab />}
      {tab === 'delivery' && <DeliveryTab />}
      {tab === 'pagos' && <PaymentsTab />}
      {tab === 'negocio' && <BusinessTab />}
      {tab === 'notificaciones' && <NotificationsTab />}
      {tab === 'usuarios' && <UsersTab />}
      {tab === 'cuenta' && <AccountTab />}
    </div>
  );
}
