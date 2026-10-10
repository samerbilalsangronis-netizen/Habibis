'use client';

import { useState } from 'react';
import { IconCheck, IconCopy } from '@/components/ui/Icons';

export default function CopyField({ label, value, big = false }: { label: string; value: string; big?: boolean }) {
  const [ok, setOk] = useState(false);
  if (!value) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setOk(true);
    setTimeout(() => setOk(false), 1500);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="w-full flex items-center justify-between gap-3 rounded-xl bg-ink-800 border border-ink-700 px-3.5 py-2.5 text-left hover:border-gold-500/60"
    >
      <span className="min-w-0">
        <span className="block text-[11px] uppercase tracking-wide text-sand-500">{label}</span>
        <span className={`block font-semibold break-all ${big ? 'text-xl text-gold-300 tabular-nums' : ''}`}>{value}</span>
      </span>
      <span className={`shrink-0 text-xs font-semibold inline-flex items-center gap-1 ${ok ? 'text-emerald-400' : 'text-sand-400'}`}>
        {ok ? <IconCheck className="w-4 h-4" /> : <IconCopy className="w-4 h-4" />}
        {ok ? 'Copiado' : 'Copiar'}
      </span>
    </button>
  );
}
