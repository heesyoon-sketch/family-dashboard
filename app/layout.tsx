import './globals.css';
import { SwInit } from '@/components/SwInit';
import { Toaster } from 'sonner';
import { LanguageProvider } from '@/contexts/LanguageContext';

export const metadata = {
  title: 'Family Habit Dashboard',
  manifest: '/manifest.webmanifest',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <LanguageProvider>
          <SwInit />
          <Toaster position="top-center" richColors />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
