import type { Metadata } from 'next';
import { FamBitLanding } from '@/components/FamBitLanding';

export const metadata: Metadata = {
  title: 'FamBit | Family Habit Dashboard',
  description:
    'A private family habit dashboard for daily routines, points, rewards, warm gifts, and parent-friendly admin tools.',
  alternates: {
    canonical: '/home',
    languages: {
      en: '/home',
      ko: '/home/ko',
    },
  },
};

export default function HomeLandingPage() {
  return <FamBitLanding locale="en" />;
}
