/**
 * Normaliza teléfonos de Venezuela y Colombia a formato E.164.
 *  VE: 0412-123-4567 · 412 1234567 · +58 412 1234567  → +584121234567
 *  CO: 300 123 4567  · +57 300 1234567                → +573001234567
 * Devuelve null si no parece válido.
 */
export function normalizePhone(raw: string): string | null {
  const trimmed = (raw || '').trim();
  const hasPlus = trimmed.startsWith('+');
  let d = trimmed.replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);

  // Ya trae código de país
  if (hasPlus || d.startsWith('58') || d.startsWith('57')) {
    if (/^58[24]\d{9}$/.test(d)) return `+${d}`; // VE móvil (4xx) o fijo (2xx)
    if (/^57[36]\d{9}$/.test(d)) return `+${d}`; // CO móvil (3xx) o fijo (60x)
    if (hasPlus && /^\d{10,15}$/.test(d)) return `+${d}`; // otro país
  }
  // Venezuela local: 0412xxxxxxx / 412xxxxxxx / 02xxxxxxxxx
  if (/^0[24]\d{9}$/.test(d)) return `+58${d.slice(1)}`;
  if (/^4(1[246]|2[46])\d{7}$/.test(d)) return `+58${d}`;
  // Colombia local: 3xxxxxxxxx (10 dígitos) o fijo 60xxxxxxxx
  if (/^3\d{9}$/.test(d)) return `+57${d}`;
  if (/^60\d{8}$/.test(d)) return `+57${d}`;
  return null;
}

export function prettyPhone(e164: string): string {
  const d = e164.replace(/\D/g, '');
  if (d.startsWith('58') && d.length === 12) return `+58 ${d.slice(2, 5)}-${d.slice(5, 8)}-${d.slice(8)}`;
  if (d.startsWith('57') && d.length === 12) return `+57 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  return `+${d}`;
}

/** Solo dígitos, para wa.me */
export function waDigits(phone: string): string {
  return (phone || '').replace(/\D/g, '');
}
