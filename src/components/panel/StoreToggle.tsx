'use client';

import { useState } from 'react';
import { usePanel } from './PanelContext';
import { supabaseBrowser } from '@/lib/supabase/client';
import { isOpenNow } from '@/lib/hours';
import { useNow } from '@/lib/hooks';
import type { BusinessHour } from '@/lib/types';
import { useEffect } from 'react';

/** Botón "Cerrar ahora / Abrir ahora / Automático". */
export default function StoreToggle() {
  const { settings, setSettings } = usePanel();
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  useNow(60_000);

  useEffect(() => {
    supabaseBrowser()
      .from('business_hours')
      .select('*')
      .then(({ data }) => setHours((data ?? []) as BusinessHour[]));
  }, []);

  const open = isOpenNow(settings, hours);
  const set = async (v: 'auto' | 'open' | 'closed') => {
    setBusy(true);
    setMenu(false);
    const { error } = await supabaseBrowser().rpc('set_open_override', { p_value: v });
    setBusy(false);
    if (!error) setSettings({ ...settings, open_override: v });
    else alert(error.message);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setMenu((m) => !m)}
        disabled={busy}
        className={`btn-sm btn border ${open ? 'bg-emerald-600/15 text-emerald-300 border-emerald-500/40' : 'bg-red-600/15 text-red-300 border-red-500/40'}`}
      >
        <span className={`w-2 h-2 rounded-full ${open ? 'bg-emerald-400' : 'bg-red-400'}`} />
        {open ? 'Abierto' : 'Cerrado'}
        <span className="text-[10px] opacity-70">{settings.open_override === 'auto' ? '(horario)' : '(manual)'}</span>
      </button>
      {menu && (
        <div className="absolute right-0 mt-2 z-40 w-56 card p-1.5 shadow-2xl">
          <button className="w-full text-left rounded-lg px-3 py-2.5 hover:bg-ink-800 text-sm" onClick={() => set('closed')}>
            🔴 <b>Cerrar ahora</b>
            <span className="block text-xs text-sand-400">No recibe pedidos inmediatos</span>
          </button>
          <button className="w-full text-left rounded-lg px-3 py-2.5 hover:bg-ink-800 text-sm" onClick={() => set('open')}>
            🟢 <b>Abrir ahora</b>
            <span className="block text-xs text-sand-400">Ignora el horario</span>
          </button>
          <button className="w-full text-left rounded-lg px-3 py-2.5 hover:bg-ink-800 text-sm" onClick={() => set('auto')}>
            🕒 <b>Según horario</b>
            <span className="block text-xs text-sand-400">Abre y cierra solo</span>
          </button>
        </div>
      )}
    </div>
  );
}
