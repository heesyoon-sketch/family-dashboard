'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { InsigniaBadge } from '@/components/InsigniaBadge';
import { useFamilyStore } from '@/lib/store';
import { useShieldSnapshot } from '@/lib/achievements/useShieldSnapshot';
import { ACHIEVEMENTS } from '@/lib/achievements/definitions';
import type { AchievementProgress } from '@/lib/achievements/engine';
import { insigniaSlotsForLevel, loadoutBonusFromIds } from '@/lib/progression';
import { RARITY_COPY, SHIELD_THEMES, THEME_COPY, shieldDescription, shieldTheme, shieldTitle, type ShieldTheme } from '@/lib/analytics/shieldCopy';
import { legacyInsigniaBonusActive } from '@/lib/shields/transition';
import { useMinuteClock } from '@/lib/analytics/useFamilyAnalytics';
import { EmptyNote, Segmented, formatDay, useCopy } from '@/components/analytics/ui';

const DEFS = new Map(ACHIEVEMENTS.map(def => [def.achievementId, def]));
const RARITY_RANK = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 } as const;

function useShieldCopy() {
  const { en, t } = useCopy();
  return {
    en,
    title: (b: AchievementProgress) => { const def = DEFS.get(b.achievementId); return def ? t(shieldTitle(def)) : b.title; },
    description: (b: AchievementProgress) => { const def = DEFS.get(b.achievementId); return def ? t(shieldDescription(def)) : b.description; },
  };
}


function ShieldDetail({ badge, onClose }: { badge: AchievementProgress; onClose: () => void }) {
  const { en, title, description } = useShieldCopy();
  const { t } = useCopy();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="shield-detail-title" onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-t-3xl border border-white/10 bg-[#171c33] p-6 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <InsigniaBadge rarity={badge.rarity} icon={badge.icon} seed={badge.achievementId} size={84} ariaLabel="" />
          <button ref={closeRef} type="button" onClick={onClose} aria-label={en ? 'Close' : '닫기'} className="grid h-11 w-11 place-items-center rounded-full text-[#B3B7CE] hover:bg-white/10"><X size={18} /></button>
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-[#E8C77B]">{t(RARITY_COPY[badge.rarity])} · {t(THEME_COPY[shieldTheme(badge)])}</p>
        <h3 id="shield-detail-title" className="mt-1 text-xl font-bold text-white">{title(badge)}</h3>
        <p className="mt-2 text-sm leading-relaxed text-[#C9CCE0]">{description(badge)}</p>
        <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-[#79E8BD]"><Check size={16} aria-hidden />{badge.unlockedAt ? (en ? `Earned ${formatDay(badge.unlockedAt.slice(0, 10), true, { year: 'numeric', month: 'short', day: 'numeric' })}` : `${formatDay(badge.unlockedAt.slice(0, 10), false, { year: 'numeric', month: 'short', day: 'numeric' })} 획득`) : (en ? 'Earned' : '획득')}</p>
        <p className="mt-4 border-t border-white/10 pt-4 text-xs leading-relaxed text-[#A9AECB]">{en ? 'Insignias are now a record of what you achieved before Shields. They are kept forever; new achievements come as monthly Shields.' : '인시그니아는 이제 쉴드 이전에 이룬 것을 담은 기록이에요. 영원히 남고, 새로운 성취는 매달 쉴드로 받아요.'}</p>
      </div>
    </div>
  );
}

/** Read-only archive of lifetime insignias (frozen when Shields replaced
 *  them). Until the insignia bonus ends, the equipped three are shown with
 *  the bonus they still give. */
export function ShieldCollection({ memberId }: { memberId: string }) {
  const { en, title } = useShieldCopy();
  const { t } = useCopy();
  const familyId = useFamilyStore(s => s.familyId);
  const level = useFamilyStore(s => s.levelsByUser[memberId]?.currentLevel ?? 1);
  const timezone = useFamilyStore(s => s.automaticSaleConfig.timezone) || 'America/Toronto';
  const snapshot = useShieldSnapshot(familyId);
  const now = useMinuteClock();
  const [theme, setTheme] = useState<ShieldTheme | 'all'>('all');
  const [detailId, setDetailId] = useState<string | null>(null);

  if (!snapshot || snapshot.familyId !== familyId) {
    return <div role="status" className="h-40 animate-pulse rounded-xl bg-white/[0.04] motion-reduce:animate-none"><span className="sr-only">{en ? 'Loading insignias' : '인시그니아를 불러오는 중'}</span></div>;
  }
  const badges = snapshot.achievementsByChild?.[memberId] ?? [];
  const child = snapshot.state.children[memberId];
  const slotCapacity = insigniaSlotsForLevel(level);
  const equippedIds = (child?.equippedInsigniaIds ?? []).slice(0, slotCapacity);
  const earned = badges.filter(b => b.isUnlocked);
  const featured = equippedIds.map(id => earned.find(b => b.achievementId === id)).filter((b): b is AchievementProgress => Boolean(b));
  const bonus = loadoutBonusFromIds(equippedIds, new Set(earned.map(b => b.achievementId)));
  const bonusActive = legacyInsigniaBonusActive(now, timezone);
  const visible = earned
    .filter(b => theme === 'all' || shieldTheme(b) === theme)
    .sort((a, b) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] || (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? ''));
  const detail = earned.find(b => b.achievementId === detailId) ?? null;

  const tile = (b: AchievementProgress, size = 56) => (
    <button
      key={b.achievementId}
      type="button"
      onClick={() => setDetailId(b.achievementId)}
      aria-label={title(b)}
      className="group flex min-w-0 flex-col items-center gap-1.5 rounded-xl p-2 text-center transition hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-[#A5A6FF]"
    >
      <span className="transition group-hover:-translate-y-0.5 motion-reduce:transition-none">
        <InsigniaBadge rarity={b.rarity} icon={b.icon} seed={b.achievementId} size={size} ariaLabel="" />
      </span>
      <span className="line-clamp-2 text-[11px] leading-tight text-[#E7E9F5]">{title(b)}</span>
    </button>
  );

  return (
    <div className="space-y-5">
      {bonusActive && featured.length > 0 && (
        <div className="rounded-2xl border border-[#E8C77B]/20 bg-[radial-gradient(ellipse_at_top,rgba(232,199,123,0.12),transparent_70%)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[#F3E3BC]">{en ? 'Equipped insignias' : '장착 중인 인시그니아'}</h3>
            <span className="text-xs text-[#C9B98F]">{en ? `+${bonus}% bonus until Nov 30` : `11월 30일까지 보너스 +${bonus}%`}</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:max-w-md">
            {featured.map(b => <div key={b.achievementId} className="rounded-xl bg-black/20">{tile(b, 60)}</div>)}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[#C9B98F]">{en ? 'This bonus stays as it is until November 30. From December 1, the monthly Shields above take over.' : '이 보너스는 11월 30일까지 그대로 유지돼요. 12월 1일부터는 위의 월간 쉴드가 이어받아요.'}</p>
        </div>
      )}

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white">{en ? `Earned insignias · ${earned.length}` : `얻은 인시그니아 · ${earned.length}개`}</h3>
          {earned.length > 0 && <Segmented size="sm" label={en ? 'Insignia theme' : '인시그니아 테마'} value={theme} onChange={setTheme} options={[{ value: 'all' as const, label: en ? 'All' : '전체' }, ...SHIELD_THEMES.map(th => ({ value: th, label: t(THEME_COPY[th]) }))]} />}
        </div>
        {earned.length === 0
          ? <EmptyNote>{en ? 'No insignias were earned before Shields replaced them.' : '쉴드로 바뀌기 전에 얻은 인시그니아가 없어요.'}</EmptyNote>
          : <div className="grid grid-cols-3 gap-1 min-[420px]:grid-cols-4 sm:grid-cols-6 lg:grid-cols-8">{visible.map(b => tile(b))}</div>}
      </div>

      {detail && <ShieldDetail badge={detail} onClose={() => setDetailId(null)} />}
    </div>
  );
}
