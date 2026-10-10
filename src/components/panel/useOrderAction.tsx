'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { statusMessage, waLink } from '@/lib/whatsapp';
import { IconWhatsApp, IconX } from '@/components/ui/Icons';
import type { Order } from '@/lib/types';
import { usePanel } from './PanelContext';

export type OrderActionName =
  | 'aceptar'
  | 'verificar_pago'
  | 'rechazar_pago'
  | 'preparar'
  | 'listo'
  | 'despachar'
  | 'asignar_repartidor'
  | 'entregado'
  | 'cancelar';

const EVENT_FOR: Partial<Record<OrderActionName, Parameters<typeof statusMessage>[1]>> = {
  aceptar: 'aceptado',
  verificar_pago: 'pago_verificado',
  rechazar_pago: 'pago_rechazado',
  preparar: 'en_preparacion',
  listo: 'listo',
  despachar: 'en_camino',
  entregado: 'entregado',
  cancelar: 'cancelado',
};

/** Ejecuta una acción sobre un pedido y ofrece avisar al cliente por WhatsApp. */
export function useOrderAction() {
  const { upsertOrder } = usePanel();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notify, setNotify] = useState<{ order: Order; text: string } | null>(null);

  const run = async (order: Order, action: OrderActionName, note?: string, driver?: string | null) => {
    setBusy(action);
    setError(null);
    const { data, error } = await supabaseBrowser().rpc('order_action', {
      p_order_id: order.id,
      p_action: action,
      p_note: note ?? null,
      p_driver: driver ?? null,
    });
    setBusy(null);
    if (error) {
      setError(error.message);
      return null;
    }
    const updated = { ...order, ...(data as Order) };
    upsertOrder(updated);
    if ((action === 'despachar' || action === 'asignar_repartidor') && updated.driver_id) {
      fetch('/api/push/driver', { method: 'POST', body: JSON.stringify({ orderId: order.id }) }).catch(() => undefined);
    }
    const ev = EVENT_FOR[action];
    if (ev) {
      const url = `${location.origin}/pedido/${order.tracking_token}`;
      setNotify({ order: updated, text: statusMessage(updated, ev, ev === 'entregado' || ev === 'cancelado' ? undefined : url) });
    }
    return updated;
  };

  const NotifyBar = () =>
    notify ? (
      <div className="fixed bottom-20 lg:bottom-6 inset-x-0 z-40 flex justify-center px-4 animate-fade-in">
        <div className="card shadow-2xl flex items-center gap-2 p-2 pl-4 border-emerald-500/40 max-w-md w-full">
          <span className="text-sm flex-1">
            Pedido <b>{notify.order.code}</b> actualizado. ¿Avisar al cliente?
          </span>
          <a
            href={waLink(notify.order.customer_phone, notify.text)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setNotify(null)}
            className="btn btn-sm bg-[#25D366] text-white"
          >
            <IconWhatsApp className="w-4 h-4" /> Avisar
          </a>
          <button className="p-2 text-sand-400" onClick={() => setNotify(null)} aria-label="Cerrar">
            <IconX className="w-4 h-4" />
          </button>
        </div>
      </div>
    ) : null;

  return { run, busy, error, setError, NotifyBar, notify };
}
