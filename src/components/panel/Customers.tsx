'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePanel } from './PanelContext';
import { IconPhone, IconWhatsApp } from '@/components/ui/Icons';
import { formatCop, formatUsdt } from '@/lib/money';
import { fmtDateTime } from '@/lib/hours';
import { prettyPhone } from '@/lib/phone';
import { supabaseBrowser } from '@/lib/supabase/client';
import { mapsLink, waLink } from '@/lib/whatsapp';

interface CustomerRow {
  id: string;
  phone: string;
  name: string;
  cedula: string | null;
  addresses: { address: string; reference: string | null; lat: number | null; lng: number | null; used_at: string }[];
  orders_count: number;
  total_spent_cop: number;
  total_spent_usdt: number;
  last_order_at: string | null;
}

type Sort = 'recientes' | 'pedidos' | 'gasto';

export default function Customers() {
  const { settings, staff } = usePanel();
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('recientes');
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const showMoney = staff.role === 'admin';

  useEffect(() => {
    supabaseBrowser()
      .from('customer_stats')
      .select('*')
      .limit(2000)
      .then(({ data }) => {
        setRows((data ?? []) as CustomerRow[]);
        setLoading(false);
      });
  }, []);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const digits = s.replace(/\D/g, '');
    return rows
      .filter((r) => !s || r.name.toLowerCase().includes(s) || (digits && r.phone.includes(digits)))
      .sort((a, b) =>
        sort === 'pedidos'
          ? b.orders_count - a.orders_count
          : sort === 'gasto'
            ? b.total_spent_cop - a.total_spent_cop
            : (b.last_order_at ?? '').localeCompare(a.last_order_at ?? ''),
      );
  }, [rows, q, sort]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="font-display text-2xl text-gold-300 mr-auto">Clientes</h1>
        <span className="text-sm text-sand-400">{rows.length} en total</span>
      </div>
      <div className="flex gap-2 flex-wrap">
        <input className="input flex-1 min-w-[200px]" placeholder="Buscar por nombre o teléfono" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="recientes">Compra más reciente</option>
          <option value="pedidos">Más pedidos</option>
          {showMoney && <option value="gasto">Mayor gasto</option>}
        </select>
      </div>
      {loading ? (
        <div className="card h-40 animate-pulse" />
      ) : (
        <ul className="space-y-2">
          {list.map((c) => (
            <li key={c.id} className="card">
              <button className="w-full p-3.5 flex items-center gap-3 text-left" onClick={() => setOpen(open === c.id ? null : c.id)}>
                <span className="w-10 h-10 rounded-full bg-terra-500/20 text-terra-400 grid place-items-center font-bold">{c.name[0]?.toUpperCase()}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold truncate">{c.name}</span>
                  <span className="block text-xs text-sand-400">{prettyPhone(c.phone)}</span>
                </span>
                <span className="text-right text-sm">
                  <span className="block font-semibold">{c.orders_count} pedidos</span>
                  {showMoney && <span className="block text-xs text-gold-300 tabular-nums">{formatCop(c.total_spent_cop)}</span>}
                </span>
              </button>
              {open === c.id && (
                <div className="px-4 pb-4 space-y-2 text-sm border-t border-ink-700 pt-3">
                  {c.cedula && <p>Cédula: {c.cedula}</p>}
                  {c.last_order_at && <p>Última compra: {fmtDateTime(c.last_order_at, settings.timezone)}</p>}
                  {showMoney && <p>Total gastado: {formatCop(c.total_spent_cop)} · {formatUsdt(Number(c.total_spent_usdt))}</p>}
                  {c.addresses?.length > 0 && (
                    <div>
                      <p className="text-sand-400">Direcciones usadas:</p>
                      <ul className="mt-1 space-y-1">
                        {c.addresses.map((a, i) => (
                          <li key={i} className="rounded-lg bg-ink-800 px-3 py-2">
                            {a.address}
                            {a.reference && <span className="text-sand-400"> · {a.reference}</span>}
                            {a.lat != null && a.lng != null && (
                              <a className="ml-2 text-gold-300" href={mapsLink(a.lat, a.lng)} target="_blank" rel="noopener noreferrer">
                                Mapa
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <a className="btn-ghost btn-sm" href={`tel:${c.phone}`}>
                      <IconPhone className="w-4 h-4" /> Llamar
                    </a>
                    <a className="btn btn-sm bg-[#25D366] text-white" href={waLink(c.phone, `¡Hola ${c.name.split(' ')[0]}! Te escribimos de Habibis 🧆`)} target="_blank" rel="noopener noreferrer">
                      <IconWhatsApp className="w-4 h-4" /> WhatsApp
                    </a>
                  </div>
                </div>
              )}
            </li>
          ))}
          {!list.length && <p className="text-center text-sand-500 py-10">Sin clientes todavía.</p>}
        </ul>
      )}
    </div>
  );
}
