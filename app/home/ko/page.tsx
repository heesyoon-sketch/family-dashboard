import type { Metadata } from 'next';
import { FamBitLanding } from '@/components/FamBitLanding';

export const metadata: Metadata = {
  title: 'FamBit | 가족 습관 대시보드',
  description:
    '가족의 매일 루틴, 포인트, 보상, 따뜻한 선물, 부모용 관리 기능을 한곳에 모은 비공개 가족 습관 대시보드입니다.',
  alternates: {
    canonical: '/home/ko',
    languages: {
      en: '/home',
      ko: '/home/ko',
    },
  },
};

export default function KoreanHomeLandingPage() {
  return <FamBitLanding locale="ko" />;
}
