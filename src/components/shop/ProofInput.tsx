'use client';

import { useEffect, useState } from 'react';
import { IconUpload, IconX } from '@/components/ui/Icons';
import { compressImage } from '@/lib/image';

/** Selector de comprobante (imagen o PDF) con vista previa y compresión. */
export default function ProofInput({ file, onChange }: { file: File | null; onChange: (f: File | null) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div>
      {file ? (
        <div className="flex items-center gap-3 rounded-xl bg-ink-800 border border-ink-700 p-2.5">
          {preview ? (
            <img src={preview} alt="Comprobante" className="w-14 h-14 rounded-lg object-cover" />
          ) : (
            <span className="w-14 h-14 rounded-lg bg-ink-700 grid place-items-center text-xs">PDF</span>
          )}
          <span className="flex-1 min-w-0 text-sm truncate">{file.name}</span>
          <button type="button" className="p-2 text-terra-400" onClick={() => onChange(null)} aria-label="Quitar comprobante">
            <IconX />
          </button>
        </div>
      ) : (
        <label className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-600 hover:border-gold-500 p-4 cursor-pointer text-sand-200">
          <IconUpload />
          <span className="font-semibold">{busy ? 'Procesando…' : 'Subir captura del pago'}</span>
          <input
            type="file"
            accept="image/*,application/pdf"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setBusy(true);
              const out = f.type === 'application/pdf' ? f : await compressImage(f);
              setBusy(false);
              onChange(out);
            }}
          />
        </label>
      )}
    </div>
  );
}
