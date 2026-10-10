'use client';

import { useEffect, useMemo, useState } from 'react';
import Sheet from '@/components/ui/Sheet';
import ProductImage from './ProductImage';
import Price from './Price';
import { IconMinus, IconPlus } from '@/components/ui/Icons';
import { lineUnit, useCart, type CartLine } from '@/store/cart';
import type { MenuProduct, ModifierGroup, Rates } from '@/lib/types';
import { TagChips } from './ProductCard';

function groupRule(g: ModifierGroup): string {
  const min = g.is_required ? Math.max(1, g.min_select) : g.min_select;
  if (g.selection_type === 'single') return g.is_required ? 'Obligatorio · elige 1' : 'Opcional · elige 1';
  if (min > 0 && g.max_select > 1) return `Obligatorio · ${min === g.max_select ? `elige ${min}` : `${min} a ${g.max_select}`}`;
  return `Opcional · hasta ${g.max_select}`;
}

export function validateSelection(groups: ModifierGroup[], sel: Record<string, string[]>): string | null {
  for (const g of groups) {
    const n = (sel[g.id] ?? []).length;
    const min = g.is_required ? Math.max(1, g.min_select) : n > 0 ? g.min_select : 0;
    if (n < min) return g.selection_type === 'single' ? `Elige ${g.name.toLowerCase()}` : `Elige al menos ${min} en ${g.name}`;
    if (n > g.max_select) return `Máximo ${g.max_select} en ${g.name}`;
  }
  return null;
}

export default function ProductSheet({
  product,
  rates,
  onClose,
  editLine,
  canOrder = true,
  onAdd,
}: {
  product: MenuProduct | null;
  rates: Rates | null;
  onClose: () => void;
  editLine?: CartLine | null;
  canOrder?: boolean;
  /** Si se pasa, se usa en lugar del carrito del cliente (p. ej. pedido manual del panel). */
  onAdd?: (line: Omit<CartLine, 'key'>) => void;
}) {
  const add = useCart((s) => s.add);
  const update = useCart((s) => s.update);
  const setOpen = useCart((s) => s.setOpen);
  const [sel, setSel] = useState<Record<string, string[]>>({});
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!product) return;
    setTouched(false);
    if (editLine) {
      const init: Record<string, string[]> = {};
      for (const g of product.groups) {
        init[g.id] = g.options.filter((o) => editLine.options.some((x) => x.id === o.id)).map((o) => o.id);
      }
      setSel(init);
      setQty(editLine.quantity);
      setNotes(editLine.notes);
    } else {
      // Preselecciona la primera opción disponible de grupos obligatorios de selección única
      const init: Record<string, string[]> = {};
      for (const g of product.groups) {
        const first = g.options.find((o) => o.available);
        init[g.id] = g.selection_type === 'single' && g.is_required && first && first.price_cop === 0 ? [first.id] : [];
      }
      setSel(init);
      setQty(1);
      setNotes('');
    }
  }, [product, editLine]);

  const options = useMemo(() => {
    if (!product) return [];
    return product.groups.flatMap((g) =>
      g.options
        .filter((o) => (sel[g.id] ?? []).includes(o.id))
        .map((o) => ({ id: o.id, name: o.name, groupName: g.name, price: o.price_cop })),
    );
  }, [product, sel]);

  if (!product) return null;
  const error = validateSelection(product.groups, sel);
  const unit = lineUnit({ basePrice: product.price_cop, options });

  const toggle = (g: ModifierGroup, optionId: string) => {
    setSel((prev) => {
      const cur = prev[g.id] ?? [];
      if (g.selection_type === 'single') {
        if (cur[0] === optionId) return g.is_required ? prev : { ...prev, [g.id]: [] };
        return { ...prev, [g.id]: [optionId] };
      }
      if (cur.includes(optionId)) return { ...prev, [g.id]: cur.filter((x) => x !== optionId) };
      if (cur.length >= g.max_select) return prev;
      return { ...prev, [g.id]: [...cur, optionId] };
    });
  };

  const submit = () => {
    setTouched(true);
    if (error || !canOrder) return;
    const line = {
      productId: product.id,
      name: product.name,
      image: product.image_url,
      basePrice: product.price_cop,
      options,
      quantity: qty,
      notes: notes.trim().slice(0, 200),
    };
    if (onAdd) onAdd(line);
    else if (editLine) update(editLine.key, line);
    else add(line);
    onClose();
    if (editLine && !onAdd) setOpen(true);
  };

  return (
    <Sheet
      open={!!product}
      onClose={onClose}
      title={undefined}
      footer={
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-xl bg-ink-800 border border-ink-700">
            <button className="p-3" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Menos">
              <IconMinus />
            </button>
            <span className="w-8 text-center font-bold tabular-nums">{qty}</span>
            <button className="p-3" onClick={() => setQty((q) => Math.min(50, q + 1))} aria-label="Más">
              <IconPlus />
            </button>
          </div>
          <button className="btn-primary flex-1 text-base" onClick={submit} disabled={!product.available || !canOrder}>
            {editLine ? 'Guardar' : 'Agregar'} · <Price cop={unit * qty} rates={rates} />
          </button>
        </div>
      }
    >
      <ProductImage src={product.image_url} alt={product.name} className="h-56 sm:h-64 w-full" sizes="(max-width: 640px) 100vw, 512px" priority />
      <div className="p-5 space-y-5">
        <div>
          <h2 className="font-display text-2xl text-sand-50">{product.name}</h2>
          <TagChips tags={product.tags} className="mt-2" />
          {product.description && <p className="mt-2 text-sand-200/90 leading-relaxed">{product.description}</p>}
          {product.combo.length > 0 && (
            <p className="mt-2 text-sm text-sand-400">
              Incluye: {product.combo.map((c) => `${c.quantity > 1 ? `${c.quantity}× ` : ''}${c.name}`).join(' + ')}
            </p>
          )}
          <p className="mt-3 text-gold-300 font-bold text-lg">
            <Price cop={product.price_cop} rates={rates} />
          </p>
        </div>

        {product.groups.map((g) => {
          const chosen = sel[g.id] ?? [];
          const missing = touched && validateSelection([g], sel);
          return (
            <section key={g.id} className={`rounded-2xl border ${missing ? 'border-terra-500' : 'border-ink-700'} overflow-hidden`}>
              <header className="flex items-center justify-between px-4 py-3 bg-ink-800/70">
                <h3 className="font-semibold">{g.name}</h3>
                <span className={`text-[11px] font-semibold ${g.is_required ? 'text-terra-400' : 'text-sand-400'}`}>{groupRule(g)}</span>
              </header>
              <ul className="divide-y divide-ink-700/70">
                {g.options.map((o) => {
                  const active = chosen.includes(o.id);
                  const blocked = !o.available || (!active && g.selection_type === 'multiple' && chosen.length >= g.max_select);
                  return (
                    <li key={o.id}>
                      <button
                        type="button"
                        disabled={blocked}
                        onClick={() => toggle(g, o.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left disabled:opacity-40"
                      >
                        <span
                          className={`grid place-items-center w-5 h-5 shrink-0 border-2 ${
                            g.selection_type === 'single' ? 'rounded-full' : 'rounded-md'
                          } ${active ? 'border-gold-500 bg-gold-500' : 'border-sand-500'}`}
                        >
                          {active && <span className={`${g.selection_type === 'single' ? 'w-2 h-2 rounded-full' : 'w-2.5 h-2.5 rounded-sm'} bg-ink-950`} />}
                        </span>
                        <span className="flex-1">{o.name}</span>
                        {!o.available ? (
                          <span className="text-xs text-sand-400">Agotado</span>
                        ) : o.price_cop !== 0 ? (
                          <span className="text-sm text-gold-300 tabular-nums">
                            {o.price_cop > 0 ? '+' : ''}
                            <Price cop={o.price_cop} rates={rates} />
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

        <div>
          <label className="label" htmlFor="notes">
            Nota para la cocina <span className="text-sand-500 font-normal">(opcional)</span>
          </label>
          <textarea
            id="notes"
            rows={2}
            maxLength={200}
            className="input resize-none"
            placeholder="Ej.: sin cebolla, bien tostado…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        {touched && error && <p className="text-terra-400 text-sm font-semibold">{error}</p>}
        {!canOrder && <p className="text-sand-400 text-sm">Estamos cerrados: puedes ver el menú, pero no agregar al pedido ahora.</p>}
      </div>
    </Sheet>
  );
}
