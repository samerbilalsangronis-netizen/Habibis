import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MAX_PROOF_BYTES, PROOF_TYPES } from './order-payload';

export function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get('x-real-ip') ||
    h.get('x-forwarded-for')?.split(',')[0].trim() ||
    h.get('cf-connecting-ip') ||
    'desconocida'
  );
}

export function hashIp(ip: string): string {
  return createHash('sha256')
    .update(`${process.env.IP_HASH_SALT || 'habibis'}:${ip}`)
    .digest('hex')
    .slice(0, 32);
}

/** Sube un comprobante al bucket privado. Devuelve la ruta o lanza un Error legible. */
export async function uploadProof(admin: SupabaseClient, file: File): Promise<string> {
  const ext = PROOF_TYPES[file.type];
  if (!ext) throw new Error('El comprobante debe ser una imagen (JPG, PNG, WEBP) o PDF');
  if (file.size > MAX_PROOF_BYTES) throw new Error('El comprobante pesa demasiado (máx. 8 MB)');
  const now = new Date();
  const path = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.${ext}`;
  const { error } = await admin.storage
    .from('comprobantes')
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (error) throw new Error(`No se pudo subir el comprobante: ${error.message}`);
  return path;
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}
