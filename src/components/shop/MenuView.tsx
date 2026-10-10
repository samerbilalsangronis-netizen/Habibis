'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CartDrawer from './CartDrawer';
import CurrencyToggle from './CurrencyToggle';
import Price from './Price';
import ProductCard, { productSoldOut } from './ProductCard';
import ProductSheet, { validateSelection } from './ProductSheet';
import FloatingSocial from './FloatingSocial';
import Sheet from '@/components/ui/Sheet';
import { IconBike, IconCart, IconClock, IconPin, IconRepeat, IconSearch, IconStore, IconX } from '@/components/ui/Icons';
import { isOpenNow, nextOpeningText } from '@/lib/hours';
import { useHydrated } from '@/lib/hooks';
import { supabaseBrowser } from '@/lib/supabase/client';
import { lineTotal, useCart, useRecent, type CartLine } from '@/store/cart';
import type { MenuData, MenuProduct } from '@/lib/types';

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export default function MenuView({ data }: { data: MenuData }) {
  const { settings, rate, hours, categories } = data;
  const router = useRouter();
  const hydrated = useHydrated();
  const [open, setOpenState] = useState(data.isOpen);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(categories[0]?.id ?? '');
  const [product, setProduct] = useState<MenuProduct | null>(null);
  const [editLine, setEditLine] = useState<CartLine | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [mine, setMine] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const { lines, setOpen, add } = useCart();
  const recent = useRecent((s) => s.orders);

  const canOrder = open || (settings.allow_scheduled && settings.allow_scheduled_when_closed);
  const allProducts = useMemo(() => categories.flatMap((c) => c.products), [categories]);
  const productById = useMemo(() => new Map(allProducts.map((p) => [p.id, p])), [allProducts]);
  const count = lines.reduce((s, l) => s + l.quantity, 0);
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);

  // Abierto/Cerrado se recalcula cada minuto
  useEffect(() => {
    const tick = () => setOpenState(isOpenNow(settings, hours));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [settings, hours]);

  // Cambios del panel (agotados, precios, tasas, abrir/cerrar) se reflejan sin recargar
  useEffect(() => {
    const sb = supabaseBrowser();
    let t: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(t);
      t = setTimeout(() => router.refresh(), 800);
    };
    const ch = sb
      .channel('menu-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'modifier_options' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, refresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'exchange_rates' }, refresh)
      .subscribe();
    return () => {
      clearTimeout(t);
      sb.removeChannel(ch);
    };
  }, [router]);

  // Categoría activa según el scroll
  useEffect(() => {
    if (query) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id.replace('cat-', ''));
      },
      { rootMargin: '-140px 0px -60% 0px' },
    );
    categories.forEach((c) => {
      const el = document.getElementById(`cat-${c.id}`);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [categories, query]);

  useEffect(() => {
    const el = barRef.current?.querySelector<HTMLElement>(`[data-cat="${active}"]`);
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [active]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return null;
    return allProducts.filter((p) => normalize(`${p.name} ${p.description} ${p.tags.join(' ')}`).includes(q));
  }, [query, allProducts]);

  const openProduct = useCallback((p: MenuProduct) => {
    setEditLine(null);
    setProduct(p);
  }, []);

  const repeat = (token: string) => {
    const o = recent.find((r) => r.token === token);
    if (!o) return;
    let added = 0;
    const skipped: string[] = [];
    for (const it of o.items) {
      const p = productById.get(it.productId);
      if (!p || productSoldOut(p)) {
        skipped.push(it.name);
        continue;
      }
      const sel: Record<string, string[]> = {};
      const opts = p.groups.flatMap((g) => {
        const chosen = g.options.filter((x) => x.available && it.optionIds.includes(x.id));
        sel[g.id] = chosen.map((x) => x.id);
        return chosen.map((x) => ({ id: x.id, name: x.name, groupName: g.name, price: x.price_cop }));
      });
      if (validateSelection(p.groups, sel)) {
        skipped.push(it.name);
        continue;
      }
      add({ productId: p.id, name: p.name, image: p.image_url, basePrice: p.price_cop, options: opts, quantity: it.quantity, notes: it.notes });
      added++;
    }
    setToast(
      added === 0
        ? 'Esos productos ya no están disponibles.'
        : skipped.length
          ? `Agregado. No disponibles: ${skipped.join(', ')}`
          : '¡Listo! Agregamos tu pedido anterior al carrito.',
    );
    if (added) setOpen(true);
  };

  const next = !open ? nextOpeningText(hours, settings.timezone) : null;
  const rateOk = !!rate;

  return (
    <div className="min-h-dvh bg-pattern">
      {/* Encabezado */}
      <header className="sticky top-0 z-30 bg-ink-950/85 backdrop-blur-md border-b border-ink-800">
        <div className="max-w-5xl mx-auto flex items-center gap-3 px-4 h-14">
          <Link href="/" className="flex items-center gap-2 min-w-0">
            <img src={settings.logo_url || '/logo.svg'} alt="" className="w-9 h-9 rounded-xl object-cover" />
            <span className="font-display text-xl text-gold-300 truncate">{settings.business_name}</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {hydrated && recent.length > 0 && (
              <button
                onClick={() => setMine(true)}
                className="hidden sm:inline-flex btn-ghost btn-sm rounded-full"
                aria-label="Mis pedidos"
              >
                🧾 Mis pedidos
              </button>
            )}
            <CurrencyToggle disabled={!rateOk} />
            {hydrated && recent.length > 0 && (
              <button onClick={() => setMine(true)} className="sm:hidden p-2 rounded-full bg-ink-800 border border-ink-700" aria-label="Mis pedidos">
                🧾
              </button>
            )}
            <button onClick={() => setOpen(true)} className="relative p-2 rounded-full bg-ink-800 border border-ink-700" aria-label="Ver carrito">
              <IconCart />
              {hydrated && count > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-terra-500 text-[11px] font-bold grid place-items-center">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Barra de categorías */}
        <div ref={barRef} className="max-w-5xl mx-auto flex gap-2 overflow-x-auto no-scrollbar px-4 pb-2.5">
          {categories.map((c) => (
            <a
              key={c.id}
              data-cat={c.id}
              href={`#cat-${c.id}`}
              onClick={() => {
                setQuery('');
                setActive(c.id);
              }}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold border transition ${
                active === c.id && !query
                  ? 'bg-gold-500 text-ink-950 border-gold-500'
                  : 'bg-ink-900 text-sand-200 border-ink-700 hover:border-gold-500/60'
              }`}
            >
              {c.name}
            </a>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pb-36">
        {/* Portada */}
        <section className="pt-8 pb-6 text-center">
          <img
            src={settings.logo_url || '/logo.svg'}
            alt={settings.business_name}
            className="mx-auto w-24 h-24 rounded-3xl shadow-glow object-cover"
          />
          <h1 className="mt-4 font-display text-4xl sm:text-5xl text-gold-300">{settings.business_name}</h1>
          {settings.tagline && <p className="mt-1 text-sand-200">{settings.tagline}</p>}
          <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
            <span
              className={`chip text-xs px-3 py-1.5 ${
                open ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40' : 'bg-red-500/15 text-red-300 border border-red-500/40'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${open ? 'bg-emerald-400 animate-pulse2' : 'bg-red-400'}`} />
              {open ? 'Abierto ahora' : 'Cerrado'}
            </span>
            {next && <span className="text-xs text-sand-400">{next}</span>}
          </div>
          <div className="mt-4 flex justify-center gap-4 text-xs text-sand-400 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <IconClock className="w-4 h-4" /> {settings.prep_time_min}–{settings.prep_time_min + settings.delivery_time_min} min
            </span>
            {settings.delivery_enabled && (
              <span className="inline-flex items-center gap-1">
                <IconBike className="w-4 h-4" />
                {settings.delivery_mode === 'flat' ? (
                  <>
                    Delivery <Price cop={settings.delivery_fee_cop} rates={rate} />
                  </>
                ) : (
                  'Delivery por zonas'
                )}
              </span>
            )}
            {settings.pickup_enabled && (
              <span className="inline-flex items-center gap-1">
                <IconStore className="w-4 h-4" /> Retiro en local
              </span>
            )}
            {settings.address && (
              <span className="inline-flex items-center gap-1">
                <IconPin className="w-4 h-4" /> {settings.address}
                {settings.city ? `, ${settings.city}` : ''}
              </span>
            )}
          </div>
          <a href={`#cat-${categories[0]?.id ?? ''}`} className="btn-terra mt-6 px-8 text-base shadow-lg shadow-terra-500/20">
            {open ? 'Pedir ahora' : canOrder ? 'Programar pedido' : 'Ver menú'}
          </a>
          {!open && (
            <p className="mt-3 text-sm text-sand-400">
              {canOrder
                ? 'Estamos cerrados, pero puedes dejar tu pedido programado para cuando abramos.'
                : 'Estamos cerrados. Puedes ver el menú; los pedidos se reciben en horario de atención.'}
            </p>
          )}
          {!rateOk && <p className="mt-2 text-xs text-sand-500">Precios en COP. Las tasas del día aún no están cargadas.</p>}
        </section>

        {/* Buscador */}
        <div className="relative mb-6">
          <IconSearch className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-sand-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar shawarma, falafel, hummus…"
            className="input pl-11 pr-10"
            aria-label="Buscar productos"
          />
          {query && (
            <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2" onClick={() => setQuery('')} aria-label="Limpiar">
              <IconX className="w-4 h-4" />
            </button>
          )}
        </div>

        {results ? (
          <section>
            <h2 className="font-display text-2xl text-gold-300 mb-3">
              {results.length} resultado{results.length === 1 ? '' : 's'}
            </h2>
            {results.length === 0 ? (
              <p className="text-sand-400">No encontramos productos con “{query}”.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {results.map((p) => (
                  <ProductCard key={p.id} product={p} rates={rate} onOpen={openProduct} />
                ))}
              </div>
            )}
          </section>
        ) : (
          categories.map((c, ci) => (
            <section key={c.id} id={`cat-${c.id}`} className="mb-8 scroll-mt-32">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="font-display text-2xl text-gold-300">{c.name}</h2>
                <span className="flex-1 h-px bg-gradient-to-r from-gold-500/40 to-transparent" />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {c.products.map((p, i) => (
                  <ProductCard key={p.id} product={p} rates={rate} onOpen={openProduct} priority={ci === 0 && i < 2} />
                ))}
              </div>
            </section>
          ))
        )}

        <footer className="mt-10 text-center text-xs text-sand-500 space-y-1">
          <p>
            {settings.business_name} · {settings.city}
          </p>
          {rate && (
            <p>
              Tasa del día: 1 USDT = {rate.cop_per_usdt.toLocaleString('es-CO')} COP = Bs. {rate.bs_per_usdt.toLocaleString('es-VE')}
            </p>
          )}
          <p>
            <Link href="/panel" className="hover:text-sand-300">
              Acceso del personal
            </Link>
          </p>
        </footer>
      </main>

      {/* Barra inferior del carrito */}
      {hydrated && count > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 px-4 safe-bottom pt-3 bg-gradient-to-t from-ink-950 via-ink-950/95 to-transparent">
          <button onClick={() => setOpen(true)} className="btn-primary w-full max-w-xl mx-auto flex text-base py-3.5 shadow-glow">
            <span className="grid place-items-center min-w-7 h-7 rounded-full bg-ink-950/90 text-gold-300 text-sm">{count}</span>
            <span className="flex-1 text-left">Ver pedido</span>
            <Price cop={subtotal} rates={rate} className="tabular-nums" />
          </button>
        </div>
      )}

      <FloatingSocial whatsapp={settings.whatsapp_phone} instagram={settings.instagram} raised={hydrated && count > 0} />

      <ProductSheet
        product={product}
        rates={rate}
        editLine={editLine}
        canOrder={canOrder}
        onClose={() => {
          setProduct(null);
          setEditLine(null);
        }}
      />
      <CartDrawer
        rates={rate}
        minOrderCop={settings.min_order_cop}
        onEdit={(l) => {
          const p = productById.get(l.productId);
          if (!p) return;
          setOpen(false);
          setEditLine(l);
          setProduct(p);
        }}
      />

      <Sheet open={mine} onClose={() => setMine(false)} title="Mis pedidos">
        <p className="px-5 pt-3 text-xs text-sand-500">Solo se guardan en este teléfono.</p>
        <ul className="divide-y divide-ink-700/70">
          {recent.map((r) => (
            <li key={r.token} className="p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-bold text-gold-300">{r.code}</span>
                <span className="text-sand-400">{new Date(r.createdAt).toLocaleDateString('es-VE')}</span>
              </div>
              <p className="text-xs text-sand-200">{r.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</p>
              <div className="flex gap-2">
                <Link href={`/pedido/${r.token}`} className="btn-ghost btn-sm flex-1">
                  Ver estado
                </Link>
                <button
                  className="btn-primary btn-sm flex-1"
                  disabled={!canOrder}
                  onClick={() => {
                    setMine(false);
                    repeat(r.token);
                  }}
                >
                  <IconRepeat className="w-4 h-4" /> Repetir
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Sheet>

      {toast && (
        <div className="fixed top-20 inset-x-0 z-50 flex justify-center px-4 animate-fade-in">
          <div className="card px-4 py-3 text-sm shadow-xl border-gold-500/40">{toast}</div>
        </div>
      )}
    </div>
  );
}
