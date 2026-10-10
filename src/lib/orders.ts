import { formatBs, formatCop, formatUsd } from './money';
import type { Order } from './types';

/** "Cobrar X · paga con Y" para pedidos en efectivo. */
export function cashLine(o: Pick<Order, 'payment_method' | 'cash_currency' | 'cash_amount' | 'total_cop' | 'total_usdt' | 'total_bs'>) {
  if (o.payment_method !== 'efectivo') return null;
  const cur = o.cash_currency ?? 'COP';
  const fmt = (n: number) => (cur === 'COP' ? formatCop(n) : cur === 'USD' ? formatUsd(n) : formatBs(n));
  const due = cur === 'COP' ? o.total_cop : cur === 'USD' ? Number(o.total_usdt) : Number(o.total_bs);
  return `Cobrar ${fmt(due)}${o.cash_amount ? ` · paga con ${fmt(Number(o.cash_amount))}` : ''}`;
}
