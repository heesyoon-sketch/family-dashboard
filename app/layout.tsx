import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { SyncBootstrap } from '@/components/SyncBootstrap';

export const metadata: Metadata = {
  title: 'FamBit',
  description: 'A family habit dashboard for tasks, rewards, XP, and coins.',
  applicationName: 'FamBit',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'FamBit',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/fambit-icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0D0E1C',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <SyncBootstrap />
          <Toaster position="top-center" richColors />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
