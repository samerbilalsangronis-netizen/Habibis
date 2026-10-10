// Genera los íconos PNG de las PWA a partir de public/logo.svg.
// Uso: npm run icons   (vuelve a ejecutarlo si cambias el logo)
import sharp from 'sharp';
import { readFile, mkdir } from 'node:fs/promises';

const logo = await readFile('public/logo.svg');
await mkdir('public/icons', { recursive: true });

const panelSvg = Buffer.from(
  logo
    .toString()
    .replace('fill="#140f0b"', 'fill="#c8553d"')
    .replace('fill="#c8553d"/>\n  <text', 'fill="#140f0b"/>\n  <text')
    .replace('</svg>', `<rect x="136" y="410" width="240" height="56" rx="28" fill="#140f0b"/><text x="256" y="449" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#f0c879" letter-spacing="4">PANEL</text></svg>`),
);

async function png(src, size, out, { pad = 0, bg = null } = {}) {
  const inner = size - pad * 2;
  let img = sharp(src, { density: 384 }).resize(inner, inner);
  if (pad) {
    img = sharp({
      create: { width: size, height: size, channels: 4, background: bg ?? { r: 20, g: 15, b: 11, alpha: 1 } },
    }).composite([{ input: await img.png().toBuffer(), left: pad, top: pad }]);
  }
  await img.png().toFile(out);
  console.log('✓', out);
}

await png(logo, 192, 'public/icons/icon-192.png');
await png(logo, 512, 'public/icons/icon-512.png');
await png(logo, 512, 'public/icons/maskable-512.png', { pad: 56 });
await png(logo, 180, 'public/icons/apple-touch-icon.png');
await png(logo, 72, 'public/icons/badge-72.png');
await png(panelSvg, 192, 'public/icons/panel-192.png');
await png(panelSvg, 512, 'public/icons/panel-512.png');
await png(panelSvg, 512, 'public/icons/panel-maskable-512.png', { pad: 56, bg: { r: 200, g: 85, b: 61, alpha: 1 } });
