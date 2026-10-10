'use client';

import { useEffect } from 'react';

export default function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <button className="no-print" onClick={() => window.print()} style={{ position: 'fixed', top: 8, right: 8, padding: '8px 14px', fontWeight: 700 }}>
      Imprimir
    </button>
  );
}
