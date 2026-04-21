import './globals.css';
import { SwInit } from '@/components/SwInit';
import { Toaster } from 'sonner';

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
        <SwInit />
        <Toaster position="top-center" richColors />
        {children}
      </body>
    </html>
  );
}
