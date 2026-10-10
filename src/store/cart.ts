'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DisplayCurrency } from '@/lib/types';

export interface CartOption {
  id: string;
  name: string;
  groupName: string;
  price: number;
}

export interface CartLine {
  key: string;
  productId: string;
  name: string;
  image: string | null;
  basePrice: number;
  options: CartOption[];
  quantity: number;
  notes: string;
}

export const lineUnit = (l: Pick<CartLine, 'basePrice' | 'options'>) =>
  l.basePrice + l.options.reduce((s, o) => s + o.price, 0);
export const lineTotal = (l: CartLine) => lineUnit(l) * l.quantity;

/** Misma combinación de producto + opciones + nota se agrupa en una sola línea. */
const signature = (l: Pick<CartLine, 'productId' | 'options' | 'notes'>) =>
  `${l.productId}|${l.options.map((o) => o.id).sort().join(',')}|${l.notes.trim().toLowerCase()}`;

interface CartState {
  lines: CartLine[];
  open: boolean;
  add: (line: Omit<CartLine, 'key'>) => void;
  update: (key: string, line: Omit<CartLine, 'key'>) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  replaceAll: (lines: CartLine[]) => void;
  setOpen: (open: boolean) => void;
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      open: false,
      add: (line) => {
        const sig = signature(line);
        const existing = get().lines.find((l) => signature(l) === sig);
        if (existing) {
          set({
            lines: get().lines.map((l) =>
              l.key === existing.key ? { ...l, quantity: Math.min(50, l.quantity + line.quantity) } : l,
            ),
          });
        } else {
          set({ lines: [...get().lines, { ...line, key: uid() }] });
        }
      },
      update: (key, line) => set({ lines: get().lines.map((l) => (l.key === key ? { ...line, key } : l)) }),
      setQty: (key, qty) =>
        set({
          lines:
            qty <= 0
              ? get().lines.filter((l) => l.key !== key)
              : get().lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(50, qty) } : l)),
        }),
      remove: (key) => set({ lines: get().lines.filter((l) => l.key !== key) }),
      clear: () => set({ lines: [] }),
      replaceAll: (lines) => set({ lines }),
      setOpen: (open) => set({ open }),
    }),
    {
      name: 'habibis-cart-v1',
      partialize: (s) => ({ lines: s.lines }),
    },
  ),
);

interface PrefsState {
  currency: DisplayCurrency;
  setCurrency: (c: DisplayCurrency) => void;
  customer: { name: string; phone: string; cedula: string };
  setCustomer: (c: { name: string; phone: string; cedula: string }) => void;
  lastAddress: { address: string; reference: string; lat: number | null; lng: number | null } | null;
  setLastAddress: (a: PrefsState['lastAddress']) => void;
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      currency: 'COP',
      setCurrency: (currency) => set({ currency }),
      customer: { name: '', phone: '', cedula: '' },
      setCustomer: (customer) => set({ customer }),
      lastAddress: null,
      setLastAddress: (lastAddress) => set({ lastAddress }),
    }),
    { name: 'habibis-prefs-v1' },
  ),
);

export interface RecentOrder {
  token: string;
  code: string;
  createdAt: string;
  totalCop: number;
  items: { productId: string; name: string; quantity: number; optionIds: string[]; notes: string }[];
}

interface RecentState {
  orders: RecentOrder[];
  addOrder: (o: RecentOrder) => void;
  removeOrder: (token: string) => void;
}

export const useRecent = create<RecentState>()(
  persist(
    (set, get) => ({
      orders: [],
      addOrder: (o) => set({ orders: [o, ...get().orders.filter((x) => x.token !== o.token)].slice(0, 10) }),
      removeOrder: (token) => set({ orders: get().orders.filter((x) => x.token !== token) }),
    }),
    { name: 'habibis-recent-v1' },
  ),
);
