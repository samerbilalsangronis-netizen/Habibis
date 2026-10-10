import type { Metadata, Viewport } from 'next';
import { Cairo, Reem_Kufi } from 'next/font/google';
import { SITE_URL } from '@/lib/env';
import './globals.css';

const display = Reem_Kufi({ subsets: ['latin', 'arabic'], weight: ['500', '600', '700'], variable: '--font-display' });
const sans = Cairo({ subsets: ['latin', 'arabic'], weight: ['400', '500', '600', '700'], variable: '--font-sans' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Habibis · Comida árabe', template: '%s · Habibis' },
  description: 'Shawarmas, falafel, cremas árabes y más. Pide en línea con delivery o retiro en el local.',
  applicationName: 'Habibis',
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { url: '/logo.svg', type: 'image/svg+xml' }],
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0c0907',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
