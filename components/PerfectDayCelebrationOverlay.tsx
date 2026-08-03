'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Sparkles, TicketCheck } from 'lucide-react';
import type { PerfectDayAward } from '@/lib/store';
import type { User } from '@/lib/db';
import { useLanguage } from '@/contexts/LanguageContext';

export function PerfectDayCelebrationOverlay({
  award,
  user,
  onDismiss,
}: {
  award: PerfectDayAward;
  user: User;
  onDismiss: () => void;
}) {
  const { lang } = useLanguage();

  useEffect(() => {
    const colors = ['#FFE56B', '#FF7BAC', '#58E6FF', '#4EEDB0'];
    confetti({ particleCount: 110, spread: 82, startVelocity: 34, colors, origin: { y: 0.62 } });
    const timer = window.setTimeout(() => {
      confetti({ particleCount: 55, angle: 60, spread: 55, colors, origin: { x: 0, y: 0.7 } });
      confetti({ particleCount: 55, angle: 120, spread: 55, colors, origin: { x: 1, y: 0.7 } });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [award.coupon.id]);

  return (
    <motion.div
      className="fixed inset-0 z-[90] grid place-items-center bg-[#090A12]/92 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ y: 28, scale: 0.9, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 210, damping: 18 }}
        className="w-full max-w-md text-center"
      >
        <div className="mx-auto flex w-fit items-center gap-1.5 rounded-full border border-[#FFE56B]/40 bg-[#FFE56B]/10 px-3 py-1 text-xs font-black uppercase text-[#FFE56B]">
          <Sparkles size={14} />
          {lang === 'en' ? 'Every routine complete' : '모든 루틴 완료'}
        </div>
        <div className="mt-4 text-sm font-black text-[#58E6FF]">{user.name}</div>
        <h2 className="mt-1 text-4xl font-black text-white">
          {lang === 'en' ? 'Perfect Day!' : '퍼펙트 데이!'}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/58">
          {lang === 'en'
            ? 'You finished every morning and evening routine. This pass is yours.'
            : '오전과 저녁 루틴을 전부 끝냈어요. 이 이용권은 당신의 거예요.'}
        </p>

        <motion.div
          initial={{ rotate: -3, y: 18 }}
          animate={{ rotate: 0, y: 0 }}
          transition={{ type: 'spring', stiffness: 170, damping: 14, delay: 0.12 }}
          className="relative mx-auto mt-6 overflow-hidden rounded-lg border-2 border-[#17151E] bg-[#FFE56B] px-6 py-6 text-left text-[#17151E] shadow-[8px_8px_0_#FF7BAC]"
        >
          <span className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[#090A12]" />
          <span className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[#090A12]" />
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-black uppercase">Perfect Day Pass</div>
              <div className="mt-2 text-4xl font-black leading-none">30 MIN</div>
              <div className="mt-1 text-sm font-black">
                {lang === 'en' ? 'Game or media time' : '게임 또는 미디어 시간'}
              </div>
            </div>
            <TicketCheck size={54} strokeWidth={1.7} />
          </div>
        </motion.div>

        <button
          type="button"
          onClick={onDismiss}
          className="mt-7 h-12 min-w-48 rounded-lg bg-white px-6 text-sm font-black text-[#12131D] transition hover:bg-[#EAFBFF]"
        >
          {lang === 'en' ? 'Put it in my wallet' : '내 지갑에 넣기'}
        </button>
      </motion.div>
    </motion.div>
  );
}
