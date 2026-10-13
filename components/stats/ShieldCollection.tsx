'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Lock, Sparkles, X } from 'lucide-react';
import { InsigniaBadge } from '@/components/InsigniaBadge';
import { useFamilyStore } from '@/lib/store';
import { useShieldSnapshot } from '@/lib/achievements/useShieldSnapshot';
import { setEquippedInsignia } from '@/lib/achievements/storage';
import { ACHIEVEMENTS } from '@/lib/achievements/definitions';
import type { AchievementProgress } from '@/lib/achievements/engine';
import { achievementRemaining, selectNextAchievementGoals } from '@/lib/achievements/recommendations';
import { insigniaSlotsForLevel, loadoutBonusFromIds } from '@/lib/progression';
import { RARITY_COPY, SHIELD_THEMES, THEME_COPY, shieldDescription, shieldTheme, shieldTitle, type ShieldTheme } from '@/lib/analytics/shieldCopy';
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

function ProgressBar({ value }: { value: number }) {
  return (
    <span className="block h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
      <span className="block h-full rounded-full bg-gradient-to-r from-[#A5A6FF] to-[#79E8BD]" style={{ width: `${Math.round(Math.min(1, value) * 100)}%` }} />
    </span>
  );
}

function ShieldDetail({ badge, equipped, canEquip, slotCapacity, onToggle, onClose }: {
  badge: AchievementProgress;
  equipped: boolean;
  canEquip: boolean;
  slotCapacity: number;
  onToggle: () => void;
  onClose: () => void;
}) {
  const { en, title, description } = useShieldCopy();
  const { t } = useCopy();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const hidden = badge.isSecret && !badge.isUnlocked;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="shield-detail-title" onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-t-3xl border border-white/10 bg-[#171c33] p-6 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <InsigniaBadge rarity={badge.rarity} icon={hidden ? '❔' : badge.icon} seed={badge.achievementId} locked={!badge.isUnlocked} size={84} ariaLabel={hidden ? '?' : title(badge)} />
          <button ref={closeRef} type="button" onClick={onClose} aria-label={en ? 'Close' : '닫기'} className="grid h-11 w-11 place-items-center rounded-full text-[#B3B7CE] hover:bg-white/10"><X size={18} /></button>
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-[#E8C77B]">{t(RARITY_COPY[badge.rarity])} · {t(THEME_COPY[shieldTheme(badge)])}</p>
        <h3 id="shield-detail-title" className="mt-1 text-xl font-bold text-white">{hidden ? (en ? 'Secret insignia' : '비밀 인시그니아') : title(badge)}</h3>
        <p className="mt-2 text-sm leading-relaxed text-[#C9CCE0]">{hidden ? (en ? 'Keep going — this one reveals itself when you earn it.' : '계속 실천하면 얻는 순간 모습이 드러나요.') : description(badge)}</p>
        {badge.isUnlocked ? (
          <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-[#79E8BD]"><Check size={16} aria-hidden />{badge.unlockedAt ? (en ? `Earned ${formatDay(badge.unlockedAt.slice(0, 10), true, { year: 'numeric', month: 'short', day: 'numeric' })}` : `${formatDay(badge.unlockedAt.slice(0, 10), false, { year: 'numeric', month: 'short', day: 'numeric' })} 획득`) : (en ? 'Earned' : '획득')}</p>
        ) : !hidden && (
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-xs text-[#A9AECB]"><span>{badge.progressCurrent}/{badge.progressTarget}</span><span>{en ? `${achievementRemaining(badge)} to go` : `${achievementRemaining(badge)} 남음`}</span></div>
            <ProgressBar value={badge.progressTarget ? badge.progressCurrent / badge.progressTarget : 0} />
          </div>
        )}
        {badge.isUnlocked && (
          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="mb-3 text-xs leading-relaxed text-[#A9AECB]">{en ? `Featured insignias (up to ${slotCapacity} at your level) add a small, capped bonus to completion points.` : `대표 인시그니아(현재 레벨에서 최대 ${slotCapacity}개)는 완료 포인트에 작은 보너스를 더해요. 보너스에는 상한이 있어요.`}</p>
            <button type="button" onClick={onToggle} disabled={!equipped && !canEquip} className={`min-h-11 w-full rounded-xl font-semibold transition disabled:opacity-40 ${equipped ? 'border border-white/15 text-white hover:bg-white/10' : 'bg-[#A5A6FF] text-[#141733] hover:bg-[#b8b9ff]'}`}>
              {equipped ? (en ? 'Remove from featured' : '대표 인시그니아에서 빼기') : canEquip ? (en ? 'Feature this insignia' : '대표 인시그니아로 장착') : (en ? 'All featured slots are full' : '대표 인시그니아 칸이 모두 찼어요')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ShieldCollection({ memberId }: { memberId: string }) {
  const { en, title } = useShieldCopy();
  const { t } = useCopy();
  const familyId = useFamilyStore(s => s.familyId);
  const users = useFamilyStore(s => s.users);
  const level = useFamilyStore(s => s.levelsByUser[memberId]?.currentLevel ?? 1);
  const snapshot = useShieldSnapshot(familyId);
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
  const recent = earned.slice().sort((a, b) => (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? '')).slice(0, 4);
  const next = selectNextAchievementGoals(badges, 3);
  const featured = equippedIds.map(id => badges.find(b => b.achievementId === id)).filter((b): b is AchievementProgress => Boolean(b));
  const unlockedIds = new Set(earned.map(b => b.achievementId));
  const bonus = loadoutBonusFromIds(equippedIds, unlockedIds);
  const visible = badges
    .filter(b => theme === 'all' || shieldTheme(b) === theme)
    .sort((a, b) => Number(b.isUnlocked) - Number(a.isUnlocked) || RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity] || a.displayOrder - b.displayOrder);
  const detail = badges.find(b => b.achievementId === detailId) ?? null;

  const toggle = (badge: AchievementProgress) => {
    if (!familyId) return;
    setEquippedInsignia(familyId, users, memberId, badge.achievementId, !equippedIds.includes(badge.achievementId), slotCapacity);
  };

  const tile = (b: AchievementProgress, size = 56) => {
    const hidden = b.isSecret && !b.isUnlocked;
    const name = hidden ? (en ? 'Secret insignia' : '비밀 인시그니아') : title(b);
    return (
      <button
        key={b.achievementId}
        type="button"
        onClick={() => setDetailId(b.achievementId)}
        aria-label={`${name}, ${b.isUnlocked ? (en ? 'earned' : '획득함') : `${en ? 'locked' : '잠김'} ${b.progressCurrent}/${b.progressTarget}`}`}
        className="group flex min-w-0 flex-col items-center gap-1.5 rounded-xl p-2 text-center transition hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-[#A5A6FF]"
      >
        <span className="transition group-hover:-translate-y-0.5 motion-reduce:transition-none">
          <InsigniaBadge rarity={b.rarity} icon={hidden ? '❔' : b.icon} seed={b.achievementId} locked={!b.isUnlocked} size={size} ariaLabel="" />
        </span>
        <span className={`line-clamp-2 text-[11px] leading-tight ${b.isUnlocked ? 'text-[#E7E9F5]' : 'text-[#8E94B4]'}`}>{name}</span>
        {!b.isUnlocked && !hidden && <span className="w-full max-w-14"><ProgressBar value={b.progressTarget ? b.progressCurrent / b.progressTarget : 0} /></span>}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl border border-[#E8C77B]/20 bg-[radial-gradient(ellipse_at_top,rgba(232,199,123,0.12),transparent_70%)] p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[#F3E3BC]">{en ? 'Featured insignias' : '대표 인시그니아'}</h3>
            <span className="text-xs text-[#C9B98F]">{en ? `Lv.${level} · ${featured.length}/${slotCapacity} slots · +${bonus}% bonus` : `Lv.${level} · ${featured.length}/${slotCapacity}칸 · 보너스 +${bonus}%`}</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => {
              const b = featured[i];
              if (b) return <div key={b.achievementId} className="rounded-xl bg-black/20">{tile(b, 64)}</div>;
              const locked = i >= slotCapacity;
              return (
                <div key={i} className="grid min-h-28 place-items-center rounded-xl border border-dashed border-white/12 text-center text-[11px] text-[#8E94B4]">
                  {locked ? <span className="inline-flex flex-col items-center gap-1"><Lock size={14} aria-hidden />Lv.{i === 1 ? 5 : 10}</span> : (en ? 'Pick an earned insignia' : '획득한 인시그니아를 골라요')}
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-4">
          <h3 className="text-sm font-bold text-white">{en ? 'Closest next insignias' : '곧 받을 수 있는 인시그니아'}</h3>
          {next.length === 0 ? <p className="mt-3 text-sm text-[#A9AECB]">{en ? 'Every visible insignia is earned. Amazing.' : '보이는 인시그니아를 모두 모았어요. 대단해요!'}</p> : (
            <ul className="mt-3 space-y-3">
              {next.map(b => (
                <li key={b.achievementId}>
                  <button type="button" onClick={() => setDetailId(b.achievementId)} className="flex w-full items-center gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-[#A5A6FF]">
                    <InsigniaBadge rarity={b.rarity} icon={b.icon} seed={b.achievementId} locked size={40} ariaLabel="" />
                    <span className="min-w-0 flex-1">
                      <span className="flex justify-between gap-2 text-sm"><span className="truncate font-semibold text-[#F4F5FA]">{title(b)}</span><span className="shrink-0 text-xs text-[#A9AECB]">{b.progressCurrent}/{b.progressTarget}</span></span>
                      <span className="mt-1.5 block"><ProgressBar value={b.progressTarget ? b.progressCurrent / b.progressTarget : 0} /></span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {recent.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-white"><Sparkles size={15} className="text-[#E8C77B]" aria-hidden />{en ? 'Recently earned' : '최근 획득'}</h3>
          <div className="grid grid-cols-4 gap-1 sm:max-w-md">{recent.map(b => tile(b, 52))}</div>
        </div>
      )}

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white">{en ? `Collection · ${earned.length}/${badges.length}` : `컬렉션 · ${earned.length}/${badges.length}`}</h3>
          <Segmented size="sm" label={en ? 'Insignia theme' : '인시그니아 테마'} value={theme} onChange={setTheme} options={[{ value: 'all' as const, label: en ? 'All' : '전체' }, ...SHIELD_THEMES.map(th => ({ value: th, label: t(THEME_COPY[th]) }))]} />
        </div>
        {earned.length === 0 && <div className="mb-3"><EmptyNote>{en ? 'No insignias yet. Your first one comes from your very first completed habit.' : '아직 인시그니아가 없어요. 첫 습관을 완료하면 첫 인시그니아를 받아요.'}</EmptyNote></div>}
        <div className="grid grid-cols-3 gap-1 min-[420px]:grid-cols-4 sm:grid-cols-6 lg:grid-cols-8">{visible.map(b => tile(b))}</div>
      </div>

      {detail && (
        <ShieldDetail
          badge={detail}
          equipped={equippedIds.includes(detail.achievementId)}
          canEquip={equippedIds.length < slotCapacity}
          slotCapacity={slotCapacity}
          onToggle={() => toggle(detail)}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}
