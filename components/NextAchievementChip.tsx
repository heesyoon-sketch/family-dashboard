'use client';

import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { InsigniaBadge } from '@/components/InsigniaBadge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFamilyStore } from '@/lib/store';
import { useShieldSnapshot } from '@/lib/achievements/useShieldSnapshot';
import {
  achievementRemaining,
  selectNextAchievementGoals,
} from '@/lib/achievements/recommendations';

export function NextAchievementChip({ userId }: { userId: string }) {
  const { lang } = useLanguage();
  const familyId = useFamilyStore(state => state.familyId);
  const snapshot = useShieldSnapshot(familyId);
  const achievements = snapshot?.achievementsByChild?.[userId] ?? [];
  const next = selectNextAchievementGoals(achievements, 1)[0];

  if (achievements.length === 0) return null;

  return (
    <Link
      href={`/stats?view=shield&member=${userId}`}
      className="flex h-8 min-w-0 max-w-[104px] items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-1.5 transition hover:border-[var(--accent)]/55 hover:bg-[var(--accent-glow)] max-[420px]:max-w-[74px] max-[380px]:h-7"
      title={next
        ? `${next.title}: ${achievementRemaining(next)} ${lang === 'en' ? 'to go' : '개 남음'}`
        : (lang === 'en' ? 'All current goals complete' : '현재 목표 모두 완료')}
      aria-label={next
        ? `${lang === 'en' ? 'Next shield' : '다음 방패'} ${next.title}, ${achievementRemaining(next)} ${lang === 'en' ? 'to go' : '개 남음'}`
        : (lang === 'en' ? 'All current shield goals complete' : '현재 방패 목표 모두 완료')}
    >
      {next ? (
        <InsigniaBadge
          rarity={next.rarity}
          icon={next.icon}
          seed={next.achievementId}
          locked
          size={25}
          ariaLabel={next.title}
        />
      ) : (
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-amber-300 text-amber-950">
          <Trophy size={13} aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[8px] font-bold leading-none text-[var(--fg-muted)]">
          {lang === 'en' ? 'NEXT' : '다음'}
        </span>
        <span className="mt-0.5 block truncate text-[10px] font-black leading-none text-[var(--fg)] tabular-nums">
          {next ? `${achievementRemaining(next)} ${lang === 'en' ? 'left' : '남음'}` : (lang === 'en' ? 'Done' : '완료')}
        </span>
      </span>
    </Link>
  );
}
