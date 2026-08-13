'use client';

import { Check, Flame, TicketCheck } from 'lucide-react';
import type { PerfectQuestProgress } from '@/lib/db';
import { useLanguage } from '@/contexts/LanguageContext';

export function PerfectQuestChip({
  progress,
  morningComplete,
  eveningComplete,
  availableCouponCount,
  onOpenWallet,
}: {
  progress: PerfectQuestProgress;
  morningComplete: boolean;
  eveningComplete: boolean;
  availableCouponCount: number;
  onOpenWallet: () => void;
}) {
  const { lang } = useLanguage();
  const questCompleteToday = progress.currentDay === 3;
  const nextDay = questCompleteToday ? 3 : progress.currentDay + 1;
  const rewardCount = questCompleteToday ? 2 : progress.nextRewardCount;
  const label = lang === 'en'
    ? `Perfect Quest: ${progress.currentDay} of 3 days complete. Day ${nextDay} earns ${rewardCount} pass${rewardCount === 2 ? 'es' : ''}. ${availableCouponCount} passes available.`
    : `퍼펙트 퀘스트: 3일 중 ${progress.currentDay}일 완료. ${nextDay}일차 보상 이용권 ${rewardCount}장. 사용 가능한 이용권 ${availableCouponCount}장.`;

  return (
    <button
      type="button"
      onClick={onOpenWallet}
      className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[#D8B72D] bg-[#FFE56B] px-1.5 text-[#17151E] shadow-[2px_2px_0_#FF7BAC] transition hover:-translate-y-px hover:bg-[#FFF09C] max-[380px]:h-7 max-[380px]:px-1"
      title={label}
      aria-label={label}
    >
      <Flame size={13} strokeWidth={2.8} className="shrink-0 max-[380px]:hidden" aria-hidden />

      <span className="flex shrink-0 items-center gap-0.5" aria-hidden>
        {[1, 2, 3].map(day => {
          const complete = day <= progress.currentDay;
          const active = !questCompleteToday && day === nextDay;
          return (
            <span
              key={day}
              className="relative grid h-3.5 w-3.5 place-items-center overflow-visible rounded-[3px] border border-[#17151E]/25 bg-[#17151E]/8"
            >
              {active && (
                <span className="absolute inset-0 overflow-hidden rounded-[2px]">
                  {morningComplete && <span className="absolute inset-y-0 left-0 w-1/2 bg-[#58BFD6]" />}
                  {eveningComplete && <span className="absolute inset-y-0 right-0 w-1/2 bg-[#E85E96]" />}
                </span>
              )}
              <span className="relative z-10 text-[7px] font-black leading-none">
                {complete ? <Check size={9} strokeWidth={3.2} /> : day}
              </span>
              {complete && <span className="absolute inset-0 rounded-[2px] bg-white/75" />}
              {day === 3 && (
                <span className="absolute -right-1.5 -top-1.5 z-20 rounded-full bg-[#FF7BAC] px-0.5 text-[6px] font-black leading-3">
                  2
                </span>
              )}
            </span>
          );
        })}
      </span>

      <span className="ml-0.5 h-4 w-px bg-[#17151E]/20 max-[380px]:hidden" aria-hidden />
      <span className="flex items-center gap-0.5 text-[9px] font-black tabular-nums">
        <TicketCheck size={11} strokeWidth={2.7} className="max-[380px]:hidden" aria-hidden />
        {availableCouponCount}
      </span>
    </button>
  );
}
