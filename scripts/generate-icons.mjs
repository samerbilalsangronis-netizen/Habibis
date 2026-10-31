// Genera los íconos PNG de las PWA a partir de public/logo.png (logo oficial, fondo transparente).
// Uso: npm run icons   (vuelve a ejecutarlo si cambias el logo)
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const LOGO = 'public/logo.png';
const OLIVE = { r: 20, g: 32, b: 26, alpha: 1 };
await mkdir('public/icons', { recursive: true });

/** Logo centrado sobre fondo sólido. `scale` = fracción del lado que ocupa el logo. */
async function icon(size, out, { scale = 0.92, bg = OLIVE, panel = false } = {}) {
  const inner = Math.round(size * scale);
  const logo = await sharp(LOGO).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const top = Math.round((size - inner) / 2 - (panel ? size * 0.05 : 0));
  const layers = [{ input: logo, left: Math.round((size - inner) / 2), top }];
  if (panel) {
    const w = Math.round(size * 0.5);
    const h = Math.round(size * 0.13);
    const tag = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${h / 2}" fill="#c8553d"/><text x="50%" y="70%" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="${Math.round(h * 0.55)}" letter-spacing="${Math.round(h * 0.08)}" fill="#fff">PANEL</text></svg>`,
    );
    layers.push({ input: tag, left: Math.round((size - w) / 2), top: Math.round(size * 0.82) });
  }
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } }).composite(layers).png().toFile(out);
  console.log('✓', out);
}

await icon(192, 'public/icons/icon-192.png');
await icon(512, 'public/icons/icon-512.png');
await icon(512, 'public/icons/maskable-512.png', { scale: 0.74 });
await icon(180, 'public/icons/apple-touch-icon.png', { scale: 0.88 });
await icon(72, 'public/icons/badge-72.png', { scale: 1, bg: { r: 0, g: 0, b: 0, alpha: 0 } });
await icon(192, 'public/icons/panel-192.png', { scale: 0.8, panel: true });
await icon(512, 'public/icons/panel-512.png', { scale: 0.8, panel: true });
await icon(512, 'public/icons/panel-maskable-512.png', { scale: 0.62, panel: true });
