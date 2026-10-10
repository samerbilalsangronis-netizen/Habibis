'use client';

import { useEffect, useState } from 'react';

/** Evita desajustes de hidratación con estado guardado en localStorage. */
export function useHydrated() {
  const [h, setH] = useState(false);
  useEffect(() => setH(true), []);
  return h;
}

/** Re-render cada `ms` (relojes, tiempos transcurridos). */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
