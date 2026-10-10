import { formatBs, formatCop, formatUsdt, formatUsd } from './money';
import { METHOD_SHORT } from './status';
import { prettyPhone, waDigits } from './phone';
import type { CashCurrency, DeliveryType, OrderItem, OrderStatus, PaymentMethod } from './types';

export function waLink(phone: string, text: string): string {
  return `https://wa.me/${waDigits(phone)}?text=${encodeURIComponent(text)}`;
}

export function mapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function wazeLink(lat: number, lng: number): string {
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}

interface SummaryOrder {
  code: string;
  customer_name: string;
  customer_phone: string;
  delivery_type: DeliveryType;
  address: string | null;
  address_reference: string | null;
  lat: number | null;
  lng: number | null;
  subtotal_cop: number;
  delivery_fee_cop: number;
  total_cop: number;
  total_usdt: number;
  total_bs: number;
  payment_method: PaymentMethod;
  payment_reference: string | null;
  cash_currency: CashCurrency | null;
  cash_amount: number | null;
  scheduled_for: string | null;
  notes: string | null;
  items: OrderItem[];
}

function cashText(currency: CashCurrency, amount: number) {
  if (currency === 'COP') return formatCop(amount);
  if (currency === 'USD') return formatUsd(amount);
  return formatBs(amount);
}

/** Resumen que el cliente envía al negocio por WhatsApp. */
export function orderSummaryText(o: SummaryOrder, trackingUrl?: string, timeZone = 'America/Caracas'): string {
  const lines: string[] = [];
  lines.push(`🧆 *Pedido ${o.code}* — Habibis`);
  lines.push('');
  lines.push(`👤 ${o.customer_name} · ${prettyPhone(o.customer_phone)}`);
  lines.push('');
  for (const it of o.items) {
    lines.push(`• ${it.quantity}× ${it.product_name} — ${formatCop(it.line_total_cop)}`);
    for (const m of it.modifiers ?? []) lines.push(`   ◦ ${m.group_name}: ${m.option_name}`);
    if (it.notes) lines.push(`   📝 ${it.notes}`);
  }
  lines.push('');
  lines.push(`Subtotal: ${formatCop(o.subtotal_cop)}`);
  if (o.delivery_type === 'delivery') lines.push(`Delivery: ${formatCop(o.delivery_fee_cop)}`);
  lines.push(`*Total: ${formatCop(o.total_cop)}*`);
  lines.push(`        ${formatUsdt(Number(o.total_usdt))} · ${formatBs(Number(o.total_bs))}`);
  lines.push('');
  if (o.delivery_type === 'delivery') {
    lines.push(`🛵 *Delivery*`);
    if (o.address) lines.push(`📍 ${o.address}`);
    if (o.address_reference) lines.push(`   Ref.: ${o.address_reference}`);
    if (o.lat != null && o.lng != null) lines.push(`   ${mapsLink(o.lat, o.lng)}`);
  } else {
    lines.push('🏪 *Retiro en el local*');
  }
  if (o.scheduled_for) {
    lines.push(
      `⏰ Programado: ${new Intl.DateTimeFormat('es-VE', {
        timeZone,
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(o.scheduled_for))}`,
    );
  }
  lines.push('');
  let pay = `💳 Pago: ${METHOD_SHORT[o.payment_method]}`;
  if (o.payment_method === 'efectivo' && o.cash_currency) {
    pay += ` (${o.cash_currency}${o.cash_amount ? `, paga con ${cashText(o.cash_currency, Number(o.cash_amount))}` : ''})`;
  }
  if (o.payment_reference) pay += ` · Ref. ${o.payment_reference}`;
  lines.push(pay);
  if (o.notes) lines.push(`🗒️ ${o.notes}`);
  if (trackingUrl) {
    lines.push('');
    lines.push(`Seguimiento: ${trackingUrl}`);
  }
  return lines.join('\n');
}

/** Mensaje prellenado que el local envía al cliente al cambiar el estado. */
export function statusMessage(
  o: { code: string; customer_name: string; delivery_type: DeliveryType; payment_reject_reason?: string | null; cancel_reason?: string | null },
  event: OrderStatus | 'pago_verificado' | 'pago_rechazado',
  trackingUrl?: string,
): string {
  const name = o.customer_name.split(' ')[0];
  const tail = trackingUrl ? `\n\nSigue tu pedido aquí: ${trackingUrl}` : '';
  switch (event) {
    case 'aceptado':
      return `¡Hola ${name}! 👋 Recibimos tu pedido *${o.code}* en Habibis. Ya lo estamos revisando.${tail}`;
    case 'pago_verificado':
      return `¡Hola ${name}! ✅ Confirmamos el pago de tu pedido *${o.code}*. Pronto empezamos a prepararlo.${tail}`;
    case 'pago_rechazado':
      return `Hola ${name}, no pudimos verificar el pago del pedido *${o.code}*${
        o.payment_reject_reason ? `: ${o.payment_reject_reason}` : ''
      }. Puedes enviar un nuevo comprobante desde el enlace de seguimiento.${tail}`;
    case 'en_preparacion':
      return `¡${name}, tu pedido *${o.code}* ya está en preparación! 🔥${tail}`;
    case 'listo':
      return o.delivery_type === 'pickup'
        ? `¡${name}, tu pedido *${o.code}* está listo para retirar! 🧆 Te esperamos.${tail}`
        : `¡${name}, tu pedido *${o.code}* está listo y sale en breve! 🛵${tail}`;
    case 'en_camino':
      return `¡${name}, tu pedido *${o.code}* va en camino! 🛵 Ten a mano el pago si es en efectivo.${tail}`;
    case 'entregado':
      return `¡Gracias por pedir en Habibis, ${name}! 🙏 Esperamos que disfrutes tu pedido *${o.code}*. ¡Shukran!`;
    case 'cancelado':
      return `Hola ${name}, lamentablemente tu pedido *${o.code}* fue cancelado${
        o.cancel_reason ? `: ${o.cancel_reason}` : ''
      }. Disculpa las molestias.`;
    default:
      return `Hola ${name}, te escribimos de Habibis por tu pedido *${o.code}*.${tail}`;
  }
}
