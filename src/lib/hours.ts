import type { BusinessHour, Settings } from './types';

export const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** Fecha/hora "de pared" en la zona horaria del local. */
export function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0';
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  const hour = Number(get('hour')) % 24;
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour,
    minute: Number(get('minute')),
    second: Number(get('second')),
    dow: wd,
  };
}

/** Diferencia (ms) entre la hora de pared en tz y UTC para un instante dado. */
export function tzOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Instante UTC correspondiente a una fecha/hora de pared en tz. */
export function zonedToUtc(y: number, m: number, d: number, hh: number, mm: number, timeZone: string): Date {
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const off = tzOffsetMs(guess, timeZone);
  return new Date(guess.getTime() - off);
}

/** Inicio del día (00:00 en tz) que contiene `date`. */
export function startOfDayTz(date: Date, timeZone: string): Date {
  const p = zonedParts(date, timeZone);
  return zonedToUtc(p.year, p.month, p.day, 0, 0, timeZone);
}

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

export function isWithinHours(hours: BusinessHour[], date: Date, timeZone: string): boolean {
  const p = zonedParts(date, timeZone);
  const t = p.hour * 60 + p.minute;
  const prevDow = (p.dow + 6) % 7;
  return hours.some((h) => {
    if (!h.is_open) return false;
    const o = toMin(h.open_time);
    const c = toMin(h.close_time);
    if (h.day_of_week === p.dow) {
      if (o === c) return true;
      if (o < c) return t >= o && t < c;
      return t >= o;
    }
    if (h.day_of_week === prevDow && o > c) return t < c;
    return false;
  });
}

export function isOpenNow(settings: Pick<Settings, 'open_override' | 'timezone'>, hours: BusinessHour[], now = new Date()) {
  if (settings.open_override === 'open') return true;
  if (settings.open_override === 'closed') return false;
  return isWithinHours(hours, now, settings.timezone);
}

export function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'p. m.' : 'a. m.';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Texto corto para el próximo horario de apertura. */
export function nextOpeningText(hours: BusinessHour[], timeZone: string, now = new Date()): string | null {
  const p = zonedParts(now, timeZone);
  const t = p.hour * 60 + p.minute;
  for (let i = 0; i < 8; i++) {
    const dow = (p.dow + i) % 7;
    const h = hours.find((x) => x.day_of_week === dow);
    if (!h || !h.is_open) continue;
    const o = toMin(h.open_time);
    if (i === 0 && o <= t) continue;
    const when = i === 0 ? 'hoy' : i === 1 ? 'mañana' : `el ${DAY_NAMES[dow].toLowerCase()}`;
    return `Abrimos ${when} a las ${fmtTime(h.open_time)}`;
  }
  return null;
}

/** Franjas de 15 min disponibles para programar (próximos `days` días). */
export function scheduleSlots(
  hours: BusinessHour[],
  timeZone: string,
  minLeadMin = 30,
  days = 2,
  now = new Date(),
): Date[] {
  const slots: Date[] = [];
  const start = new Date(now.getTime() + minLeadMin * 60_000);
  const step = 15 * 60_000;
  const first = new Date(Math.ceil(start.getTime() / step) * step);
  const end = new Date(now.getTime() + days * 24 * 3600_000);
  for (let t = first.getTime(); t <= end.getTime(); t += step) {
    const d = new Date(t);
    if (isWithinHours(hours, d, timeZone)) slots.push(d);
  }
  return slots;
}

export function fmtDateTime(iso: string | Date, timeZone = 'America/Caracas'): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('es-VE', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

export function fmtClock(iso: string | Date, timeZone = 'America/Caracas'): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('es-VE', { timeZone, hour: 'numeric', minute: '2-digit' }).format(d);
}

export function minutesSince(iso: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
}
