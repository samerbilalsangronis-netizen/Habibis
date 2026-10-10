'use client';

/**
 * Reduce una imagen en el navegador antes de subirla (útil con datos móviles lentos).
 * Devuelve el archivo original si no es imagen o si falla.
 */
export async function compressImage(
  file: File,
  { maxSize = 1600, quality = 0.82, type = 'image/jpeg' }: { maxSize?: number; quality?: number; type?: string } = {},
): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, type, quality));
    if (!blob || blob.size >= file.size) return file;
    const ext = type === 'image/webp' ? 'webp' : 'jpg';
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.' + ext, { type });
  } catch {
    return file;
  }
}
