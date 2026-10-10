'use client';

import Price from './Price';
import ProductImage from './ProductImage';
import { productSoldOut } from './ProductCard';
import { IconBike, IconClock, IconPin, IconStore } from '@/components/ui/Icons';
import { fmtTime, zonedParts } from '@/lib/hours';
import type { BusinessHour, MenuProduct, Rates, Settings } from '@/lib/types';

function todayHours(hours: BusinessHour[], tz: string): string {
  const h = hours.find((x) => x.day_of_week === zonedParts(new Date(), tz).dow);
  if (!h || !h.is_open) return 'Hoy cerrado';
  return `Hoy ${fmtTime(h.open_time)} – ${fmtTime(h.close_time)}`;
}

/** Portada: arco árabe con el logo, titular, llamada a la acción y favoritos. */
export default function Hero({
  settings,
  hours,
  rate,
  open,
  canOrder,
  next,
  firstCategoryId,
  favorites,
  onOpenProduct,
}: {
  settings: Settings;
  hours: BusinessHour[];
  rate: Rates | null;
  open: boolean;
  canOrder: boolean;
  next: string | null;
  firstCategoryId: string;
  favorites: MenuProduct[];
  onOpenProduct: (p: MenuProduct) => void;
}) {
  const logo = settings.logo_url || '/logo.svg';

  return (
    <section className="pt-5 pb-8">
      <div className="relative overflow-hidden rounded-[2rem] border border-gold-500/25 bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950 shadow-2xl">
        {/* Patrón y brillos */}
        <div className="absolute inset-0 opacity-[0.07] bg-[url('/pattern.svg')] bg-[length:64px_64px]" aria-hidden />
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-gold-500/15 blur-3xl" aria-hidden />
        <div className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-terra-500/15 blur-3xl" aria-hidden />

        <div className="relative grid md:grid-cols-[1.15fr,1fr] items-center gap-6 md:gap-4 p-6 sm:p-10">
          {/* Arco con el logo */}
          <div className="order-first md:order-last flex justify-center">
            <div className="relative">
              <div className="relative w-48 h-60 sm:w-60 sm:h-72 rounded-t-full rounded-b-3xl p-[3px] bg-gradient-to-b from-gold-300 via-gold-500 to-gold-600/40 shadow-glow">
                <div className="relative h-full w-full rounded-t-full rounded-b-[1.35rem] bg-ink-950 overflow-hidden">
                  <div className="absolute inset-0 opacity-[0.12] bg-[url('/pattern.svg')] bg-[length:48px_48px]" aria-hidden />
                  <div className="absolute inset-3 rounded-t-full rounded-b-2xl border border-gold-500/30" aria-hidden />
                  <div className="relative h-full flex flex-col items-center justify-center gap-3 pt-6">
                    <img src={logo} alt={settings.business_name} className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl object-cover drop-shadow-2xl" />
                    <span className="font-display text-2xl sm:text-3xl text-gold-300 tracking-wide">{settings.business_name}</span>
                    <span className="flex items-center gap-2 text-gold-500/70 text-xs" aria-hidden>
                      <span className="w-6 h-px bg-gold-500/50" />✦<span className="w-6 h-px bg-gold-500/50" />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Texto */}
          <div className="text-center md:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold-400">Cocina árabe · Delivery y retiro</p>
            <h1 className="mt-3 font-display text-4xl sm:text-5xl lg:text-6xl leading-[1.05] text-sand-50">
              El sabor árabe
              <br />
              <span className="text-gold-300">que te abraza</span>
            </h1>
            {settings.tagline && <p className="mt-3 text-base sm:text-lg text-sand-200">{settings.tagline}</p>}

            <div className="mt-5 flex flex-wrap items-center justify-center md:justify-start gap-2">
              <span
                className={`chip text-xs px-3 py-1.5 ${
                  open ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40' : 'bg-red-500/15 text-red-300 border border-red-500/40'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${open ? 'bg-emerald-400 animate-pulse2' : 'bg-red-400'}`} />
                {open ? 'Abierto ahora' : 'Cerrado'}
              </span>
              <span className="text-xs text-sand-400">{next ?? todayHours(hours, settings.timezone)}</span>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <a href={`#cat-${firstCategoryId}`} className="btn-terra px-8 py-3.5 text-base shadow-lg shadow-terra-500/25">
                {open ? 'Pedir ahora' : canOrder ? 'Programar pedido' : 'Ver menú'}
              </a>
              <a href={`#cat-${firstCategoryId}`} className="btn-ghost px-6 py-3.5 text-base bg-transparent border-gold-500/40 text-gold-300 hover:bg-gold-500/10">
                Ver el menú
              </a>
            </div>
            {!open && (
              <p className="mt-3 text-sm text-sand-400">
                {canOrder ? 'Puedes dejar tu pedido programado para cuando abramos.' : 'Los pedidos se reciben en horario de atención.'}
              </p>
            )}
          </div>
        </div>

        {/* Datos rápidos */}
        <div className="relative grid grid-cols-2 sm:grid-cols-4 border-t border-gold-500/15 bg-ink-950/40 text-xs">
          <div className="flex items-center gap-2 p-3 sm:p-4 sm:justify-center">
            <IconClock className="w-5 h-5 text-gold-400 shrink-0" />
            <span>
              <b className="block text-sand-50 text-sm">
                {settings.prep_time_min}–{settings.prep_time_min + settings.delivery_time_min} min
              </b>
              <span className="text-sand-400">Tiempo estimado</span>
            </span>
          </div>
          <div className="flex items-center gap-2 p-3 sm:p-4 sm:justify-center border-l border-gold-500/15">
            <IconBike className="w-5 h-5 text-gold-400 shrink-0" />
            <span>
              <b className="block text-sand-50 text-sm">
                {!settings.delivery_enabled ? 'No disponible' : settings.delivery_mode === 'flat' ? <Price cop={settings.delivery_fee_cop} rates={rate} /> : 'Por zona'}
              </b>
              <span className="text-sand-400">Delivery</span>
            </span>
          </div>
          <div className="flex items-center gap-2 p-3 sm:p-4 sm:justify-center border-t sm:border-t-0 sm:border-l border-gold-500/15">
            <IconStore className="w-5 h-5 text-gold-400 shrink-0" />
            <span>
              <b className="block text-sand-50 text-sm">{settings.pickup_enabled ? 'Disponible' : 'No disponible'}</b>
              <span className="text-sand-400">Retiro en local</span>
            </span>
          </div>
          <div className="flex items-center gap-2 p-3 sm:p-4 sm:justify-center border-t border-l sm:border-t-0 border-gold-500/15 min-w-0">
            <IconPin className="w-5 h-5 text-gold-400 shrink-0" />
            <span className="min-w-0">
              <b className="block text-sand-50 text-sm truncate">{settings.city || 'Ubicación'}</b>
              <span className="block text-sand-400 truncate">{settings.address}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Favoritos */}
      {favorites.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="font-display text-2xl text-gold-300">Los favoritos</h2>
            <span className="flex-1 h-px bg-gradient-to-r from-gold-500/40 to-transparent" />
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1 snap-x">
            {favorites.map((p) => {
              const out = productSoldOut(p);
              return (
                <button
                  key={p.id}
                  disabled={out}
                  onClick={() => onOpenProduct(p)}
                  className={`snap-start shrink-0 w-40 sm:w-48 text-left card overflow-hidden hover:border-gold-500/50 transition ${out ? 'opacity-50 grayscale' : ''}`}
                >
                  <ProductImage src={p.image_url} alt={p.name} className="h-28 sm:h-32 w-full" sizes="200px" />
                  <div className="p-3">
                    <p className="font-semibold text-sm leading-tight line-clamp-2">{p.name}</p>
                    <Price cop={p.price_cop} rates={rate} className="mt-1 block text-sm font-bold text-gold-300" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
