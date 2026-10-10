'use client';

import Link from 'next/link';
import Sheet from '@/components/ui/Sheet';
import Price from './Price';
import ProductImage from './ProductImage';
import { IconEdit, IconMinus, IconPlus, IconTrash } from '@/components/ui/Icons';
import { lineTotal, lineUnit, useCart, type CartLine } from '@/store/cart';
import { useHydrated } from '@/lib/hooks';
import type { Rates } from '@/lib/types';

export default function CartDrawer({
  rates,
  onEdit,
  minOrderCop,
}: {
  rates: Rates | null;
  onEdit: (line: CartLine) => void;
  minOrderCop: number;
}) {
  const hydrated = useHydrated();
  const { lines, open, setOpen, setQty, remove } = useCart();
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const belowMin = minOrderCop > 0 && subtotal < minOrderCop;

  if (!hydrated) return null;
  return (
    <Sheet
      open={open}
      onClose={() => setOpen(false)}
      title="Tu pedido"
      footer={
        lines.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sand-200">Subtotal</span>
              <Price cop={subtotal} rates={rates} className="text-xl font-bold text-gold-300 tabular-nums" />
            </div>
            {belowMin && (
              <p className="text-sm text-terra-400">
                El pedido mínimo es <Price cop={minOrderCop} rates={rates} />.
              </p>
            )}
            <Link
              href="/checkout"
              onClick={() => setOpen(false)}
              aria-disabled={belowMin}
              className={`btn-primary w-full text-base ${belowMin ? 'pointer-events-none opacity-50' : ''}`}
            >
              Continuar
            </Link>
          </div>
        )
      }
    >
      {lines.length === 0 ? (
        <div className="p-10 text-center text-sand-400">
          <p className="text-4xl mb-3">🧆</p>
          Tu carrito está vacío.
        </div>
      ) : (
        <ul className="divide-y divide-ink-700/70">
          {lines.map((l) => (
            <li key={l.key} className="flex gap-3 p-4">
              <ProductImage src={l.image} alt={l.name} className="w-16 h-16 rounded-xl shrink-0" sizes="64px" />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-2">
                  <p className="font-semibold leading-tight">{l.name}</p>
                  <Price cop={lineTotal(l)} rates={rates} className="font-semibold tabular-nums text-sm whitespace-nowrap" />
                </div>
                {l.options.length > 0 && (
                  <p className="text-xs text-sand-400 mt-1">{l.options.map((o) => o.name).join(' · ')}</p>
                )}
                {l.notes && <p className="text-xs text-gold-300/80 mt-1">📝 {l.notes}</p>}
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex items-center rounded-lg bg-ink-800 border border-ink-700">
                    <button className="p-2" onClick={() => setQty(l.key, l.quantity - 1)} aria-label="Menos">
                      <IconMinus className="w-4 h-4" />
                    </button>
                    <span className="w-6 text-center text-sm font-bold tabular-nums">{l.quantity}</span>
                    <button className="p-2" onClick={() => setQty(l.key, l.quantity + 1)} aria-label="Más">
                      <IconPlus className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="text-[11px] text-sand-500">
                    <Price cop={lineUnit(l)} rates={rates} /> c/u
                  </span>
                  <div className="ml-auto flex gap-1">
                    <button className="p-2 rounded-lg hover:bg-ink-800 text-sand-200" onClick={() => onEdit(l)} aria-label="Editar">
                      <IconEdit className="w-4 h-4" />
                    </button>
                    <button className="p-2 rounded-lg hover:bg-ink-800 text-terra-400" onClick={() => remove(l.key)} aria-label="Quitar">
                      <IconTrash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
