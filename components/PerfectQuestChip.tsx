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
  const questCompleteThisWeek = progress.rewardEarnedThisWeek;
  const weekendCompleteThisWeek = progress.weekendRewardEarnedThisWeek;
  const today = new Date().getDay();
  const isWeekendToday = today === 0 || today === 6;
  const nextMark = Math.min(progress.currentDay + 1, progress.weekdayGoal);
  const nextWeekendMark = Math.min(progress.weekendPerfectDays + 1, progress.weekendGoal);
  const label = lang === 'en'
    ? `Weekly Routine Quest: ${progress.weekPerfectDays} of 5 weekdays and ${progress.weekendPerfectDays} of 2 weekend days complete. Three perfect weekdays earn one pass; completing both Saturday and Sunday earns one bonus pass. ${availableCouponCount} passes available.`
    : `주간 루틴 챌린지: 평일 5일 중 ${progress.weekPerfectDays}일, 주말 2일 중 ${progress.weekendPerfectDays}일 완료. 평일 3일이면 1장, 토·일을 모두 완료하면 보너스 1장을 받아요. 사용 가능한 이용권 ${availableCouponCount}장.`;

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
          const active = !isWeekendToday && !questCompleteThisWeek && day === nextMark;
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
            </span>
          );
        })}
        <span className="mx-0.5 h-3 w-px bg-[#17151E]/25" />
        {[1, 2].map(day => {
          const complete = day <= progress.weekendPerfectDays;
          const active = isWeekendToday && !weekendCompleteThisWeek && day === nextWeekendMark;
          return (
            <span
              key={`weekend-${day}`}
              className="relative grid h-3.5 w-3.5 place-items-center overflow-hidden rounded-full border border-[#17151E]/25 bg-[#B78BFF]/22"
            >
              {active && (
                <span className="absolute inset-0 overflow-hidden rounded-full">
                  {morningComplete && <span className="absolute inset-y-0 left-0 w-1/2 bg-[#58BFD6]" />}
                  {eveningComplete && <span className="absolute inset-y-0 right-0 w-1/2 bg-[#E85E96]" />}
                </span>
              )}
              <span className="relative z-10 text-[7px] font-black leading-none">
                {complete ? <Check size={9} strokeWidth={3.2} /> : day}
              </span>
              {complete && <span className="absolute inset-0 bg-[#B78BFF]/75" />}
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
