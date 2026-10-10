import type { Metadata } from 'next';
import RegisterSW from '@/components/pwa/RegisterSW';

export const metadata: Metadata = {
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Habibis', statusBarStyle: 'black-translucent' },
  openGraph: {
    type: 'website',
    locale: 'es_VE',
    siteName: 'Habibis',
    title: 'Habibis · Comida árabe',
    description: 'Shawarmas, falafel, cremas árabes y más. Pide en línea: delivery o retiro en el local.',
  },
  twitter: { card: 'summary_large_image' },
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <RegisterSW />
    </>
  );
}
