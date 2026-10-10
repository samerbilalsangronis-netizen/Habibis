import type { DisplayCurrency, Rates } from './types';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** monto_usdt = monto_cop / tasa_cop_usdt (2 decimales) */
export function copToUsdt(cop: number, rates: Rates): number {
  return round2(cop / Number(rates.cop_per_usdt));
}

/** monto_bs = monto_usdt * tasa_bs_usdt (2 decimales; se usa el USDT sin redondear) */
export function copToBs(cop: number, rates: Rates): number {
  return round2((cop / Number(rates.cop_per_usdt)) * Number(rates.bs_per_usdt));
}

export function roundCop(cop: number, step = 100): number {
  const s = Math.max(1, step);
  return Math.round(cop / s) * s;
}

const fmtCop = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const fmt2 = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatCop(n: number): string {
  return `${fmtCop.format(Math.round(n))} COP`;
}
export function formatUsdt(n: number): string {
  return `${fmt2.format(n)} USDT`;
}
export function formatBs(n: number): string {
  return `Bs. ${fmt2.format(n)}`;
}
export function formatUsd(n: number): string {
  return `$${fmt2.format(n)}`;
}

/** Formatea un monto en COP en la moneda elegida para mostrar. */
export function formatIn(cop: number, currency: DisplayCurrency, rates: Rates | null): string {
  if (currency === 'COP' || !rates) return formatCop(cop);
  if (currency === 'USDT') return formatUsdt(copToUsdt(cop, rates));
  return formatBs(copToBs(cop, rates));
}

export function formatAll(cop: number, rates: Rates | null) {
  return {
    cop: formatCop(cop),
    usdt: rates ? formatUsdt(copToUsdt(cop, rates)) : '—',
    bs: rates ? formatBs(copToBs(cop, rates)) : '—',
  };
}

export function formatRate(n: number): string {
  return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 4 }).format(Number(n));
}

/** Convierte lo que el cliente dice que paga en efectivo a COP (para calcular el cambio). */
export function cashToCop(amount: number, currency: 'COP' | 'USD' | 'BS', rates: Rates): number {
  if (currency === 'COP') return amount;
  if (currency === 'USD') return amount * Number(rates.cop_per_usdt);
  return (amount / Number(rates.bs_per_usdt)) * Number(rates.cop_per_usdt);
}
