'use client';

import { formatIn } from '@/lib/money';
import { useHydrated } from '@/lib/hooks';
import { usePrefs } from '@/store/cart';
import type { Rates } from '@/lib/types';

/** Precio en la moneda elegida por el cliente (COP por defecto). */
export default function Price({ cop, rates, className }: { cop: number; rates: Rates | null; className?: string }) {
  const hydrated = useHydrated();
  const currency = usePrefs((s) => s.currency);
  return <span className={className}>{formatIn(cop, hydrated ? currency : 'COP', rates)}</span>;
}
