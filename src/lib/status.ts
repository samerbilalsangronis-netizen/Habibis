import type { OrderStatus, PaymentMethod, PaymentStatus } from './types';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  nuevo: 'Nuevo',
  aceptado: 'Aceptado',
  en_preparacion: 'En preparación',
  listo: 'Listo',
  en_camino: 'En camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

export const STATUS_COLOR: Record<OrderStatus, string> = {
  nuevo: 'bg-terra-500 text-white',
  aceptado: 'bg-sky-600 text-white',
  en_preparacion: 'bg-amber-500 text-ink-950',
  listo: 'bg-emerald-600 text-white',
  en_camino: 'bg-indigo-500 text-white',
  entregado: 'bg-ink-600 text-sand-200',
  cancelado: 'bg-red-900 text-red-100',
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pendiente: 'Pago pendiente',
  por_verificar: 'Por verificar',
  verificado: 'Pago verificado',
  rechazado: 'Pago rechazado',
  cobrar_en_entrega: 'Cobrar al entregar',
};

export const PAYMENT_STATUS_COLOR: Record<PaymentStatus, string> = {
  pendiente: 'bg-ink-700 text-sand-200',
  por_verificar: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
  verificado: 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40',
  rechazado: 'bg-red-600/20 text-red-300 border border-red-500/40',
  cobrar_en_entrega: 'bg-sky-600/20 text-sky-300 border border-sky-500/40',
};

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  binance: 'Binance (USDT)',
  bolivares: 'Bolívares (pago móvil / transferencia)',
  efectivo: 'Efectivo',
};

export const METHOD_SHORT: Record<PaymentMethod, string> = {
  binance: 'Binance',
  bolivares: 'Bolívares',
  efectivo: 'Efectivo',
};

export const HISTORY_LABEL: Record<string, string> = {
  nuevo: 'Pedido recibido',
  aceptado: 'Pedido aceptado',
  pago_verificado: 'Pago verificado',
  pago_rechazado: 'Pago rechazado',
  pago_reenviado: 'Nuevo comprobante enviado',
  en_preparacion: 'En preparación',
  listo: 'Listo',
  en_camino: 'En camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  repartidor_asignado: 'Repartidor asignado',
  nota: 'Nota',
};

/** Pestañas del tablero del panel */
export type BoardTab = 'nuevos' | 'verificar' | 'preparacion' | 'listos' | 'entregados' | 'cancelados';

export const BOARD_TABS: { id: BoardTab; label: string }[] = [
  { id: 'nuevos', label: 'Nuevos' },
  { id: 'verificar', label: 'Por verificar pago' },
  { id: 'preparacion', label: 'En preparación' },
  { id: 'listos', label: 'Listos / En camino' },
  { id: 'entregados', label: 'Entregados' },
  { id: 'cancelados', label: 'Cancelados' },
];

export function boardTabOf(o: { status: OrderStatus; payment_status: PaymentStatus }): BoardTab {
  switch (o.status) {
    case 'nuevo':
      return 'nuevos';
    case 'aceptado':
      return o.payment_status === 'verificado' || o.payment_status === 'cobrar_en_entrega'
        ? 'preparacion'
        : 'verificar';
    case 'en_preparacion':
      return 'preparacion';
    case 'listo':
    case 'en_camino':
      return 'listos';
    case 'entregado':
      return 'entregados';
    case 'cancelado':
      return 'cancelados';
  }
}

/** Paso del seguimiento del cliente (0..4) */
export function trackingStep(o: { status: OrderStatus; payment_status: PaymentStatus }): number {
  if (o.status === 'entregado') return 4;
  if (o.status === 'listo' || o.status === 'en_camino') return 3;
  if (o.status === 'en_preparacion') return 2;
  if (o.payment_status === 'verificado') return 1;
  return 0;
}
