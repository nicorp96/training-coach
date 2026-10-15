import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';

const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', weight: ['400', '500', '600', '700'] });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], variable: '--font-plex-mono', weight: ['400', '500'] });

export const metadata: Metadata = {
  title: 'Tempo · Training Coach',
  description: 'Your multi-sport personal training coach.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Tempo', statusBarStyle: 'default' },
};

// viewportFit 'cover' makes env(safe-area-inset-*) work on notched iPhones.
export const viewport: Viewport = { themeColor: '#F0F0E8', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${plexMono.variable}`}>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
