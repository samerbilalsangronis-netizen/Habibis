import type { Metadata, Viewport } from 'next';
import RegisterSW from '@/components/pwa/RegisterSW';

export const metadata: Metadata = {
  title: { default: 'Panel', template: '%s · Panel Habibis' },
  manifest: '/panel.webmanifest',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'Habibis Panel', statusBarStyle: 'black-translucent' },
  icons: { apple: '/icons/panel-192.png' },
};

export const viewport: Viewport = { themeColor: '#140f0b' };

export default function PanelRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <RegisterSW />
    </>
  );
}
