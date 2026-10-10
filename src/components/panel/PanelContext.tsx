'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { Order, Settings, StaffProfile } from '@/lib/types';

export const ORDER_LIST_SELECT =
  '*, order_items(id, product_name, quantity, unit_price_cop, line_total_cop, notes, sort, order_item_modifiers(group_name, option_name, price_cop))';

interface PanelCtx {
  staff: StaffProfile;
  settings: Settings;
  orders: Order[];
  loading: boolean;
  connected: boolean;
  refresh: () => Promise<void>;
  upsertOrder: (o: Order) => void;
  newCount: number;
  soundOn: boolean;
  soundBlocked: boolean;
  enableSound: () => void;
  toggleSound: () => void;
  setSettings: (s: Settings) => void;
}

const Ctx = createContext<PanelCtx | null>(null);

export function usePanel() {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePanel fuera de PanelProvider');
  return c;
}

/* ------------------------- Alarma sonora ------------------------- */
class Alarm {
  ctx: AudioContext | null = null;
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    return this.ctx;
  }
  get blocked() {
    return !this.ctx || this.ctx.state !== 'running';
  }
  async unlock() {
    const c = this.ensure();
    if (c && c.state !== 'running') await c.resume().catch(() => undefined);
  }
  ring() {
    const c = this.ensure();
    if (!c || c.state !== 'running') return;
    const notes = [880, 1175, 1568, 1175, 1568];
    notes.forEach((f, i) => {
      const t = c.currentTime + i * 0.18;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g).connect(c.destination);
      o.start(t);
      o.stop(t + 0.17);
    });
  }
}

export function PanelProvider({
  staff,
  initialSettings,
  children,
}: {
  staff: StaffProfile;
  initialSettings: Settings;
  children: React.ReactNode;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState(initialSettings);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [soundBlocked, setSoundBlocked] = useState(true);
  const alarm = useRef<Alarm | null>(null);
  const baseTitle = useRef<string>('');

  const refresh = useCallback(async () => {
    const sb = supabaseBrowser();
    const since = new Date(Date.now() - 36 * 3600_000).toISOString();
    const { data, error } = await sb
      .from('orders')
      .select(ORDER_LIST_SELECT)
      .or(`created_at.gte.${since},status.in.(nuevo,aceptado,en_preparacion,listo,en_camino)`)
      .order('created_at', { ascending: false })
      .limit(300);
    if (!error && data) setOrders(data as Order[]);
    setLoading(false);
  }, []);

  const upsertOrder = useCallback((o: Order) => {
    setOrders((prev) => {
      const i = prev.findIndex((x) => x.id === o.id);
      if (i === -1) return [o, ...prev].sort((a, b) => b.created_at.localeCompare(a.created_at));
      const next = prev.slice();
      next[i] = { ...prev[i], ...o };
      return next;
    });
  }, []);

  // Carga inicial + tiempo real
  useEffect(() => {
    refresh();
    const sb = supabaseBrowser();
    const fetchOne = async (id: string) => {
      const { data } = await sb.from('orders').select(ORDER_LIST_SELECT).eq('id', id).maybeSingle();
      if (data) upsertOrder(data as Order);
    };
    const ch = sb
      .channel('panel-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        const row = (payload.new ?? payload.old) as { id?: string };
        if (row?.id) fetchOne(row.id);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'settings' }, (payload) => {
        setSettings((s) => ({ ...s, ...(payload.new as Settings) }));
      })
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') refresh(); // re-sincroniza al reconectar
      });
    const onVis = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVis);
    const poll = setInterval(refresh, 60_000); // respaldo por si se cae el socket
    return () => {
      sb.removeChannel(ch);
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(poll);
    };
  }, [refresh, upsertOrder]);

  // Sonido
  useEffect(() => {
    alarm.current = new Alarm();
    try {
      setSoundOn(localStorage.getItem('habibis-sound') !== 'off');
    } catch {}
    const unlock = async () => {
      await alarm.current?.unlock();
      setSoundBlocked(!!alarm.current?.blocked);
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, []);

  const relevant = staff.role === 'repartidor' ? orders.filter((o) => o.driver_id === staff.user_id) : orders;
  const newCount =
    staff.role === 'repartidor'
      ? relevant.filter((o) => o.status === 'en_camino' || o.status === 'listo').length
      : orders.filter((o) => o.status === 'nuevo').length;
  const pendingProof = orders.filter((o) => o.status !== 'cancelado' && o.payment_status === 'por_verificar').length;

  // La alarma se repite hasta que alguien acepte (solo admin/operador)
  useEffect(() => {
    if (staff.role === 'repartidor' || !soundOn || newCount === 0) return;
    alarm.current?.ring();
    const id = setInterval(() => alarm.current?.ring(), 4000);
    return () => clearInterval(id);
  }, [newCount, soundOn, staff.role]);

  // Contador en la pestaña
  useEffect(() => {
    if (!baseTitle.current) baseTitle.current = 'Pedidos · Habibis';
    const n = staff.role === 'repartidor' ? newCount : newCount + pendingProof;
    document.title = n > 0 ? `(${n}) ${newCount > 0 && staff.role !== 'repartidor' ? '🔔 ' : ''}${baseTitle.current}` : baseTitle.current;
    if ('setAppBadge' in navigator) {
      const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
      (n > 0 ? nav.setAppBadge?.(n) : nav.clearAppBadge?.())?.catch(() => undefined);
    }
  }, [newCount, pendingProof, staff.role]);

  const value = useMemo<PanelCtx>(
    () => ({
      staff,
      settings,
      orders: relevant,
      loading,
      connected,
      refresh,
      upsertOrder,
      newCount,
      soundOn,
      soundBlocked,
      enableSound: () => {
        alarm.current?.unlock().then(() => {
          setSoundBlocked(!!alarm.current?.blocked);
          alarm.current?.ring();
        });
      },
      toggleSound: () => {
        setSoundOn((v) => {
          try {
            localStorage.setItem('habibis-sound', v ? 'off' : 'on');
          } catch {}
          return !v;
        });
      },
      setSettings,
    }),
    [staff, settings, relevant, loading, connected, refresh, upsertOrder, newCount, soundOn, soundBlocked],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
