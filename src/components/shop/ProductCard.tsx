'use client';

import ProductImage from './ProductImage';
import Price from './Price';
import type { MenuProduct, Rates } from '@/lib/types';

export const TAGS: Record<string, { label: string; cls: string }> = {
  vegetariano: { label: '🌿 Vegetariano', cls: 'bg-olive-500/20 text-olive-400' },
  picante: { label: '🌶️ Picante', cls: 'bg-terra-500/20 text-terra-400' },
  nuevo: { label: '✨ Nuevo', cls: 'bg-sky-500/15 text-sky-300' },
  mas_pedido: { label: '★ Más pedido', cls: 'bg-gold-500/20 text-gold-300' },
};

export function TagChips({ tags, className = '' }: { tags: string[]; className?: string }) {
  if (!tags?.length) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {tags.map((t) => (
        <span key={t} className={`chip ${TAGS[t]?.cls ?? 'bg-ink-700 text-sand-200'}`}>
          {TAGS[t]?.label ?? t}
        </span>
      ))}
    </div>
  );
}

export function productSoldOut(p: MenuProduct) {
  return !p.available || p.combo.some((c) => !c.available);
}

export default function ProductCard({
  product,
  rates,
  onOpen,
  priority,
}: {
  product: MenuProduct;
  rates: Rates | null;
  onOpen: (p: MenuProduct) => void;
  priority?: boolean;
}) {
  const soldOut = productSoldOut(product);
  return (
    <button
      type="button"
      disabled={soldOut}
      onClick={() => onOpen(product)}
      className={`group card w-full text-left flex gap-3 p-3 transition hover:border-gold-500/50 hover:shadow-glow ${
        soldOut ? 'opacity-55 grayscale cursor-not-allowed' : ''
      }`}
    >
      <div className="flex-1 min-w-0 flex flex-col">
        <h3 className="font-semibold text-[15px] leading-snug text-sand-50">{product.name}</h3>
        {product.description && <p className="mt-1 text-[13px] text-sand-400 line-clamp-2 leading-snug">{product.description}</p>}
        <TagChips tags={product.tags} className="mt-2" />
        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
          <Price cop={product.price_cop} rates={rates} className="font-bold text-gold-300 tabular-nums" />
          {soldOut ? (
            <span className="chip bg-ink-700 text-sand-200">Agotado</span>
          ) : (
            <span className="grid place-items-center w-8 h-8 rounded-full bg-gold-500 text-ink-950 font-bold text-lg leading-none group-hover:scale-105 transition" aria-hidden>
              +
            </span>
          )}
        </div>
      </div>
      <ProductImage src={product.image_url} alt={product.name} className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl shrink-0" priority={priority} />
    </button>
  );
}
