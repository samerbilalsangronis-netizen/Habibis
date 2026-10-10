'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { usePanel } from './PanelContext';
import { IconBell, IconLogout } from '@/components/ui/Icons';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { StaffRole } from '@/lib/types';

const NAV: { href: string; label: string; icon: string; roles: StaffRole[] }[] = [
  { href: '/panel', label: 'Pedidos', icon: '🧾', roles: ['admin', 'operador'] },
  { href: '/panel', label: 'Mis entregas', icon: '🛵', roles: ['repartidor'] },
  { href: '/panel/menu', label: 'Menú', icon: '🧆', roles: ['admin', 'operador'] },
  { href: '/panel/clientes', label: 'Clientes', icon: '👥', roles: ['admin', 'operador'] },
  { href: '/panel/reportes', label: 'Reportes', icon: '📊', roles: ['admin'] },
  { href: '/panel/configuracion', label: 'Ajustes', icon: '⚙️', roles: ['admin', 'operador', 'repartidor'] },
];

export const ROLE_LABEL: Record<StaffRole, string> = { admin: 'Administrador', operador: 'Operador', repartidor: 'Repartidor' };

export default function PanelShell({ children }: { children: React.ReactNode }) {
  const { staff, newCount, soundOn, soundBlocked, enableSound, toggleSound, connected } = usePanel();
  const path = usePathname();
  const router = useRouter();
  const items = NAV.filter((n) => n.roles.includes(staff.role));
  const isActive = (href: string) => (href === '/panel' ? path === '/panel' || path.startsWith('/panel/pedidos') : path.startsWith(href));

  const logout = async () => {
    await supabaseBrowser().auth.signOut();
    router.replace('/panel/login');
    router.refresh();
  };

  return (
    <div className="min-h-dvh bg-ink-950 lg:pl-60">
      {/* Barra lateral (escritorio) */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-ink-800 bg-ink-900 pattern-faint">
        <div className="relative p-5 flex items-center gap-3">
          <img src="/icons/panel-192.png" alt="" className="w-10 h-10 rounded-xl" />
          <div>
            <p className="font-display text-lg text-gold-300 leading-tight">Habibis</p>
            <p className="text-xs text-sand-400">{ROLE_LABEL[staff.role]}</p>
          </div>
        </div>
        <nav className="relative flex-1 px-3 space-y-1">
          {items.map((n) => (
            <Link
              key={n.label}
              href={n.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-semibold ${
                isActive(n.href) ? 'bg-gold-500 text-ink-950' : 'text-sand-200 hover:bg-ink-800'
              }`}
            >
              <span>{n.icon}</span>
              {n.label}
              {n.href === '/panel' && newCount > 0 && (
                <span className="ml-auto min-w-6 h-6 px-1.5 rounded-full bg-terra-500 text-white text-xs grid place-items-center">{newCount}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="relative p-4 border-t border-ink-800 text-sm">
          <p className="truncate font-semibold">{staff.full_name || staff.email}</p>
          <button onClick={logout} className="mt-2 inline-flex items-center gap-2 text-sand-400 hover:text-sand-50">
            <IconLogout className="w-4 h-4" /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Encabezado móvil */}
      <header className="sticky top-0 z-30 bg-ink-950/90 backdrop-blur border-b border-ink-800">
        <div className="flex items-center gap-2 px-4 h-14">
          <img src="/icons/panel-192.png" alt="" className="w-8 h-8 rounded-lg lg:hidden" />
          <span className="font-display text-lg text-gold-300 lg:hidden">Panel</span>
          <span
            className={`ml-2 inline-flex items-center gap-1.5 text-[11px] ${connected ? 'text-emerald-300' : 'text-amber-300'}`}
            title={connected ? 'Conectado en tiempo real' : 'Reconectando…'}
          >
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse2'}`} />
            {connected ? 'En vivo' : 'Reconectando'}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {staff.role !== 'repartidor' && (
              <button
                onClick={toggleSound}
                className={`p-2 rounded-full ${soundOn ? 'text-gold-300' : 'text-sand-500'}`}
                aria-label={soundOn ? 'Silenciar alarma' : 'Activar alarma'}
                title={soundOn ? 'Alarma activada' : 'Alarma silenciada'}
              >
                <IconBell />
              </button>
            )}
            <button onClick={logout} className="p-2 rounded-full text-sand-400 lg:hidden" aria-label="Cerrar sesión">
              <IconLogout />
            </button>
          </div>
        </div>
      </header>

      {/* Aviso flotante (no desplaza el contenido al desaparecer) */}
      {staff.role !== 'repartidor' && soundOn && soundBlocked && (
        <button
          onClick={enableSound}
          className="fixed z-40 left-1/2 -translate-x-1/2 bottom-24 lg:bottom-6 rounded-full bg-terra-500 text-white text-sm font-semibold px-4 py-2.5 shadow-2xl animate-pulse2 whitespace-nowrap"
        >
          🔔 Toca para activar el sonido de pedidos
        </button>
      )}

      <div className="pb-24 lg:pb-8">{children}</div>

      {/* Barra inferior (móvil) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-ink-900/95 backdrop-blur border-t border-ink-800 safe-bottom pt-1.5">
        <ul className="flex justify-around">
          {items.map((n) => (
            <li key={n.label}>
              <Link
                href={n.href}
                className={`relative flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-semibold ${
                  isActive(n.href) ? 'text-gold-300' : 'text-sand-400'
                }`}
              >
                <span className="text-xl leading-none">{n.icon}</span>
                {n.label}
                {n.href === '/panel' && newCount > 0 && (
                  <span className="absolute -top-0.5 right-1 min-w-5 h-5 px-1 rounded-full bg-terra-500 text-white text-[10px] grid place-items-center">
                    {newCount}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
