'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { CheckCircle2, Sparkles } from 'lucide-react';
import type { PerfectDayAward } from '@/lib/store';
import type { User } from '@/lib/db';
import { useLanguage } from '@/contexts/LanguageContext';
import { PerfectDayTicket } from './PerfectDayTicket';

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
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
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
      role="dialog"
      aria-modal="true"
      aria-labelledby="perfect-day-title"
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
        <h2 id="perfect-day-title" className="mt-1 text-4xl font-black text-white">
          {lang === 'en' ? 'Perfect Day!' : '퍼펙트 데이!'}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/58">
          {lang === 'en'
            ? 'You finished every morning and evening routine. This pass is yours.'
            : '오전과 저녁 루틴을 전부 끝냈어요. 이 이용권은 당신의 거예요.'}
        </p>

        <div className="mt-4 flex items-center justify-center gap-2 text-[11px] font-black text-white/72">
          <span className="flex items-center gap-1 rounded-lg border border-white/12 bg-white/6 px-2 py-1">
            <CheckCircle2 size={13} className="text-[#4EEDB0]" />
            {lang === 'en' ? 'Morning complete' : '오전 완료'}
          </span>
          <span className="flex items-center gap-1 rounded-lg border border-white/12 bg-white/6 px-2 py-1">
            <CheckCircle2 size={13} className="text-[#4EEDB0]" />
            {lang === 'en' ? 'Evening complete' : '오후 완료'}
          </span>
        </div>

        <motion.div
          initial={{ rotate: -3, y: 18 }}
          animate={{ rotate: 0, y: 0 }}
          transition={{ type: 'spring', stiffness: 170, damping: 14, delay: 0.12 }}
          className="mx-auto mt-5"
        >
          <PerfectDayTicket
            coupon={award.coupon}
            lang={lang}
            state="awarded"
            cutoutColor="#090A12"
            className="px-6 py-6 shadow-[8px_8px_0_#FF7BAC]"
          />
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
