import type { Metadata } from 'next';
import { FamBitLanding } from '@/components/FamBitLanding';

export const metadata: Metadata = {
  title: 'FamBit | 잔소리 대신 가격표를 붙이세요',
  description:
    '마감이 분명한 가족 루틴, 주간 퀘스트, 가족이 가격을 정하는 상점, 가족 캘린더까지 거실 공용 화면 하나에 모은 가족 대시보드입니다.',
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
