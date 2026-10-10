import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Habibis · Comida árabe';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at 50% 35%, #2e241b 0%, #0c0907 70%)',
          color: '#faf4e9',
          fontFamily: 'serif',
        }}
      >
        <div
          style={{
            width: 190,
            height: 190,
            borderRadius: 48,
            background: '#c8553d',
            border: '8px solid #d4a24c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 120,
            fontWeight: 700,
            transform: 'rotate(45deg)',
          }}
        >
          <span style={{ transform: 'rotate(-45deg)' }}>H</span>
        </div>
        <div style={{ marginTop: 70, fontSize: 104, color: '#f0c879', letterSpacing: 4 }}>Habibis</div>
        <div style={{ marginTop: 8, fontSize: 40, color: '#e8dac4' }}>Shawarmas · Falafel · Cremas árabes</div>
        <div
          style={{
            marginTop: 34,
            fontSize: 30,
            padding: '12px 30px',
            borderRadius: 999,
            background: '#d4a24c',
            color: '#0c0907',
            fontFamily: 'sans-serif',
            fontWeight: 700,
          }}
        >
          Pide en línea · Delivery o retiro
        </div>
      </div>
    ),
    size,
  );
}
