'use client';

export default function Switch({
  checked,
  onChange,
  disabled,
  label,
  size = 'md',
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
  size?: 'sm' | 'md';
}) {
  const w = size === 'sm' ? 'w-10 h-6' : 'w-12 h-7';
  const k = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const tx = size === 'sm' ? 'translate-x-4' : 'translate-x-5';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex shrink-0 items-center rounded-full transition ${w} ${checked ? 'bg-emerald-500' : 'bg-ink-600'} disabled:opacity-50`}
    >
      <span className={`inline-block ${k} rounded-full bg-white shadow transition translate-x-1 ${checked ? tx : ''}`} />
    </button>
  );
}
