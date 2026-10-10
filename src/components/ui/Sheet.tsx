'use client';

import { useEffect } from 'react';
import { IconX } from './Icons';

/** Hoja inferior en móvil / modal centrado en escritorio. */
export default function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <button aria-label="Cerrar" className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        className={`relative w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'} max-h-[92dvh] flex flex-col bg-ink-900 border border-ink-700 rounded-t-3xl sm:rounded-3xl shadow-2xl animate-slide-up sm:animate-fade-in`}
      >
        {title !== undefined && (
          <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-ink-700/70">
            <div className="font-display text-lg text-gold-300 leading-tight">{title}</div>
            <button onClick={onClose} className="p-2 -mr-2 rounded-full hover:bg-ink-800" aria-label="Cerrar">
              <IconX />
            </button>
          </div>
        )}
        <div className="overflow-y-auto overscroll-contain flex-1">{children}</div>
        {footer && <div className="border-t border-ink-700/70 p-4 safe-bottom">{footer}</div>}
      </div>
    </div>
  );
}
