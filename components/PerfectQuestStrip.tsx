'use client';

import { Check, Flame, Gift, TicketCheck, Trophy } from 'lucide-react';
import type { PerfectQuestProgress } from '@/lib/db';
import { useLanguage } from '@/contexts/LanguageContext';

export function PerfectQuestStrip({
  progress,
  morningComplete,
  eveningComplete,
  onOpenWallet,
}: {
  progress: PerfectQuestProgress;
  morningComplete: boolean;
  eveningComplete: boolean;
  onOpenWallet: () => void;
}) {
  const { lang } = useLanguage();
  const nextDay = progress.currentDay === 3 ? 3 : progress.currentDay + 1;
  const questCompleteToday = progress.currentDay === 3;
  const status = questCompleteToday
    ? (lang === 'en' ? 'Quest complete' : '퀘스트 완주')
    : lang === 'en'
      ? `Day ${nextDay} · ${progress.nextRewardCount} pass${progress.nextRewardCount === 2 ? 'es' : ''}`
      : `${nextDay}일차 · 이용권 ${progress.nextRewardCount}장`;

  return (
    <button
      type="button"
      onClick={onOpenWallet}
      className="mb-1.5 flex h-12 w-full items-center gap-2 overflow-hidden rounded-lg border border-[#FFE56B]/28 bg-[#FFE56B]/[0.055] px-2.5 text-left transition hover:border-[#FFE56B]/50 hover:bg-[#FFE56B]/10"
      aria-label={lang === 'en'
        ? `Perfect Quest, ${progress.currentDay} of 3 days complete, ${progress.completedQuests} quests finished`
        : `퍼펙트 퀘스트, 3일 중 ${progress.currentDay}일 완료, 총 ${progress.completedQuests}회 완주`}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#FFE56B] text-[#17151E]">
        <Flame size={17} strokeWidth={2.7} aria-hidden />
      </span>

      <span className="min-w-[74px] flex-1">
        <span className="block text-[9px] font-black uppercase text-[#FFE56B]">
          {lang === 'en' ? 'Perfect Quest' : '퍼펙트 퀘스트'}
        </span>
        <span className="block truncate text-[10px] font-bold text-[var(--fg-muted)]">{status}</span>
      </span>

      <span className="flex shrink-0 items-center gap-1" aria-hidden>
        {[1, 2, 3].map(day => {
          const complete = day <= progress.currentDay;
          const active = !questCompleteToday && day === nextDay;
          return (
            <span key={day} className="relative grid h-7 w-7 place-items-center overflow-visible rounded-md border border-white/12 bg-[var(--bg)]">
              {active && (
                <span className="absolute inset-0 overflow-hidden rounded-[5px]">
                  <span className={`absolute inset-y-0 left-0 w-1/2 ${morningComplete ? 'bg-[#58E6FF]/55' : 'bg-transparent'}`} />
                  <span className={`absolute inset-y-0 right-0 w-1/2 ${eveningComplete ? 'bg-[#FF7BAC]/55' : 'bg-transparent'}`} />
                </span>
              )}
              <span className={`relative z-10 text-[10px] font-black ${complete ? 'text-[#17151E]' : 'text-[var(--fg-muted)]'}`}>
                {complete ? <Check size={14} strokeWidth={3} /> : day}
              </span>
              {complete && <span className="absolute inset-0 z-0 rounded-[5px] bg-[#FFE56B]" />}
              {day === 3 && (
                <span className="absolute -right-1.5 -top-1.5 z-20 flex h-3.5 min-w-4 items-center justify-center rounded-full bg-[#FF7BAC] px-0.5 text-[7px] font-black text-[#17151E]">
                  x2
                </span>
              )}
            </span>
          );
        })}
      </span>

      <span className="ml-0.5 flex min-w-[34px] shrink-0 flex-col items-center justify-center text-[#FFE56B]">
        {progress.completedQuests > 0 ? <Trophy size={14} aria-hidden /> : <Gift size={14} aria-hidden />}
        <span className="mt-0.5 flex items-center gap-0.5 text-[8px] font-black tabular-nums">
          {progress.completedQuests > 0
            ? `x${progress.completedQuests}`
            : <TicketCheck size={10} aria-hidden />}
        </span>
      </span>
    </button>
  );
}
