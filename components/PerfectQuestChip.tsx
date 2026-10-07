'use client';

import { Check, TicketCheck } from 'lucide-react';
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
      className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-[#5B8EFF]/20 bg-[#5B8EFF]/[0.06] px-2.5 text-[#8EAFFF] transition-colors hover:bg-[#5B8EFF]/12 max-[380px]:gap-1.5 max-[380px]:px-2"
      title={label}
      aria-label={label}
    >
      <TicketCheck size={17} className="shrink-0" aria-hidden />
      <span className="flex flex-col gap-1">
        <span className="flex items-center justify-between gap-2 text-[10px] font-semibold leading-none">
          <span>{lang === 'en' ? 'Passes' : '이용권'}</span>
          <span className="text-xs font-bold tabular-nums">{availableCouponCount}</span>
        </span>

        <span className="flex shrink-0 items-center gap-0.5" aria-hidden>
          {[1, 2, 3].map(day => {
            const complete = day <= progress.currentDay;
            const active = !isWeekendToday && !questCompleteThisWeek && day === nextMark;
            return (
              <span
                key={day}
                className="relative grid h-2 w-2 place-items-center overflow-visible rounded-[3px] border border-[#5B8EFF]/25 bg-[#5B8EFF]/5"
              >
                {active && (
                  <span className="absolute inset-0 overflow-hidden rounded-[2px]">
                    {morningComplete && <span className="absolute inset-y-0 left-0 w-1/2 bg-[#5B8EFF]/70" />}
                    {eveningComplete && <span className="absolute inset-y-0 right-0 w-1/2 bg-[#5B8EFF]" />}
                  </span>
                )}
                <span className="relative z-10 leading-none">
                  {complete ? <Check size={7} strokeWidth={3} className="text-[#0D0E1C]" /> : null}
                </span>
                {complete && <span className="absolute inset-0 rounded-[2px] bg-[#5B8EFF]" />}
              </span>
            );
          })}
          <span className="mx-0.5 h-2 w-px bg-[#5B8EFF]/25" />
          {[1, 2].map(day => {
            const complete = day <= progress.weekendPerfectDays;
            const active = isWeekendToday && !weekendCompleteThisWeek && day === nextWeekendMark;
            return (
              <span
                key={`weekend-${day}`}
                className="relative grid h-2 w-2 place-items-center overflow-hidden rounded-full border border-[#5B8EFF]/25 bg-[#5B8EFF]/5"
              >
                {active && (
                  <span className="absolute inset-0 overflow-hidden rounded-full">
                    {morningComplete && <span className="absolute inset-y-0 left-0 w-1/2 bg-[#5B8EFF]/70" />}
                    {eveningComplete && <span className="absolute inset-y-0 right-0 w-1/2 bg-[#5B8EFF]" />}
                  </span>
                )}
                <span className="relative z-10 leading-none">
                  {complete ? <Check size={7} strokeWidth={3} className="text-[#0D0E1C]" /> : null}
                </span>
                {complete && <span className="absolute inset-0 bg-[#5B8EFF]" />}
              </span>
            );
          })}
        </span>

      </span>
    </button>
  );
}
