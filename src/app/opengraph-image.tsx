import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Habibis · Comida árabe';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Vista previa al compartir el link (WhatsApp, Instagram…), con el logo oficial. */
export default async function OgImage() {
  const logo = await fetch(new URL('./og-logo.png', import.meta.url)).then((r) => r.arrayBuffer());
  // Base64 sin Buffer (no existe en el runtime edge)
  const bytes = new Uint8Array(logo);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const src = `data:image/png;base64,${btoa(bin)}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 56,
          background: 'radial-gradient(circle at 30% 50%, #2b4234 0%, #14201a 70%)',
          color: '#f5ecdc',
          fontFamily: 'serif',
        }}
      >
        <img src={src} width={420} height={420} alt="" />
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 560 }}>
          <div style={{ fontSize: 30, letterSpacing: 6, color: '#e1b35c', fontFamily: 'sans-serif' }}>COCINA ÁRABE</div>
          <div style={{ marginTop: 12, fontSize: 64, lineHeight: 1.05 }}>Shawarmas, falafel y cremas árabes</div>
          <div
            style={{
              marginTop: 30,
              alignSelf: 'flex-start',
              fontSize: 30,
              padding: '12px 30px',
              borderRadius: 999,
              background: '#c8553d',
              color: '#fff',
              fontFamily: 'sans-serif',
              fontWeight: 700,
            }}
          >
            Pide en línea · Delivery o retiro
          </div>
        </div>
      </div>
    ),
    size,
  );
}
