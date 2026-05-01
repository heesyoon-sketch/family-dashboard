import type { Metadata } from 'next';
import { FamBitLanding } from '@/components/FamBitLanding';

export const metadata: Metadata = {
  title: 'Fambit — The family currency your kids want to earn',
  description:
    'Stop nagging. Set the prices once, and your kids run the system. A family habit and reward app where every family designs its own rules.',
  openGraph: {
    title: "Nagging doesn't work. Price tags do.",
    description: 'Fambit is the family currency your kids actually want to earn.',
  },
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
