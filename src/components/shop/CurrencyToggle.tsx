'use client';

import { useHydrated } from '@/lib/hooks';
import { usePrefs } from '@/store/cart';
import type { DisplayCurrency } from '@/lib/types';

const OPTIONS: { id: DisplayCurrency; label: string }[] = [
  { id: 'COP', label: 'COP' },
  { id: 'USDT', label: 'USDT' },
  { id: 'BS', label: 'Bs' },
];

export default function CurrencyToggle({ disabled }: { disabled?: boolean }) {
  const hydrated = useHydrated();
  const { currency, setCurrency } = usePrefs();
  const current = hydrated ? currency : 'COP';
  return (
    <div className="inline-flex rounded-full bg-ink-800 border border-ink-700 p-0.5 text-xs font-bold" role="radiogroup" aria-label="Moneda">
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={current === o.id}
          disabled={disabled && o.id !== 'COP'}
          onClick={() => setCurrency(o.id)}
          className={`px-2.5 py-1.5 rounded-full transition ${
            current === o.id ? 'bg-gold-500 text-ink-950' : 'text-sand-200 hover:text-gold-300'
          } disabled:opacity-40`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
