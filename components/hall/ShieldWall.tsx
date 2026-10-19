'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, FlaskConical, Lock, ShieldCheck } from 'lucide-react';
import { useEarlierShields } from '@/lib/achievements/earlierShields';
import { shieldTitle } from '@/lib/analytics/shieldCopy';
import { useMinuteClock, type FamilyAnalyticsState } from '@/lib/analytics/useFamilyAnalytics';
import { SHIELD_TYPES, addDays, zonedDayHour, type ShieldCompletion, type ShieldType } from '@/lib/shields/engine';
import { recentShieldWeeks } from '@/lib/shields/history';
import { shieldBonusLabel, WEEKLY_RULES, weekProgress, type BonusProgress, type WindowProgress } from '@/lib/shields/weekly';
import { TIER_COPY, TYPE_COPY, scopeLabel, shieldName } from '@/lib/shields/copy';
import { ShieldPointGuide } from './ShieldPointGuide';
import { ShieldBonusTable } from './ShieldBonusTable';
import { InsigniaBadge } from '@/components/InsigniaBadge';
import { EmptyNote, ErrorBanner, LoadingBlock, formatDay, useCopy } from '@/components/analytics/ui';
import { EmptyShield, ShieldEmblem } from './ShieldEmblem';
import { ShieldDetail } from './ShieldDetail';
import { periodLabel } from './periodLabel';
import { useShieldWallData, type WeeklyAwardRow } from './useShieldWallData';

/** One member's Shields: this week's three slots (earned last week), live
 *  progress toward next week's, and history. */
export function ShieldWall({ analytics, memberId }: { analytics: FamilyAnalyticsState; memberId: string }) {
  const { en, t } = useCopy();
  const { members, records, familyId } = analytics;
  const earlier = useEarlierShields(familyId, memberId);
  const now = useMinuteClock();
  const { data, error, reload } = useShieldWallData(familyId, records?.loadedAt, memberId);
  const [detail, setDetail] = useState<WeeklyAwardRow | null>(null);
  const memberName = members.find(m => m.id === memberId)?.name ?? '';

  const view = useMemo(() => {
    if (!data) return null;
    const mine = data.awards.filter(a => a.user_id === memberId);
    const equippedIds = new Set(data.equipment.filter(e => e.user_id === memberId).map(e => e.award_id));
    const equipped = Object.fromEntries(SHIELD_TYPES.map(type => [type, mine.find(a => equippedIds.has(a.id) && a.shield_type === type) ?? null])) as Record<ShieldType, WeeklyAwardRow | null>;
    return { mine, equipped };
  }, [data, memberId]);

  const progress = useMemo(() => {
    if (!data || !records) return null;
    const { day: today, hour } = zonedDayHour(now, data.timezone);
    const completions: ShieldCompletion[] = records.completions.map(c => ({ id: c.id, userId: c.userId, taskId: c.taskId, completedAt: c.completedAt }));
    const bonusTaskIds = new Set(records.tasks.filter(task => task.userId === memberId && task.taskType === 'optional').map(task => task.id));
    return weekProgress({ userId: memberId, weekStart: data.week, schedules: data.schedules, completions, bonusTaskIds, timezone: data.timezone, today, nowHour: hour });
  }, [data, records, memberId, now]);

  if (error && !data) return <ErrorBanner onRetry={reload} stale={false} />;
  if (!data || !view) return <LoadingBlock label={en ? 'Loading shields' : '쉴드를 불러오는 중'} />;

  const weekEnd = addDays(data.week, 6);
  const nextMonday = addDays(data.week, 7);
  const historyWeeks = recentShieldWeeks(view.mine, earlier, data.week, data.timezone);
  const legendaryCount = data.lifetimeLegendary.userId === memberId
    ? data.lifetimeLegendary.count + earlier.filter(s => s.definition.rarity === 'legendary').length
    : null;
  const earnedThisWeek = data.bonusThisWeek[memberId] ?? 0;
  const weekText = (start: string) => {
    const l = periodLabel('week', start, addDays(start, 6));
    return en ? l.en : l.ko;
  };

  return (
    <section id="shield-wall" aria-labelledby="shield-wall-title" className="scroll-mt-20 rounded-3xl border border-[#E8C77B]/15 bg-[radial-gradient(ellipse_at_50%_0%,rgba(232,199,123,0.10),transparent_60%),#141a31] p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="shield-wall-title" className="text-lg font-bold text-white sm:text-xl">{en ? `${memberName}’s shields` : `${memberName}의 쉴드`}</h2>
          <p className="mt-0.5 text-sm text-[#C9CCE0]">{en ? 'Earn last week. Equipped this week, automatically.' : '지난주에 얻고, 이번 주에 자동으로 장착돼요.'}</p>
        </div>
        {data.mode !== 'live' && (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#7FD3F7]/30 px-2.5 py-1 text-xs text-[#D4EEFB]"><FlaskConical size={13} aria-hidden />{data.mode === 'simulate' ? (en ? 'Preview — no points yet' : '미리보기 — 포인트 미적용') : (en ? 'Bonuses paused' : '보너스 멈춤')}</span>
        )}
      </header>
      {error && <div className="mt-3"><ErrorBanner onRetry={reload} stale /></div>}

      {/* This week: one slot per kind */}
      <ul className="mt-4 grid grid-cols-3 gap-2 sm:gap-3" aria-label={en ? 'This week’s shields' : '이번 주 쉴드'}>
        {SHIELD_TYPES.map(type => {
          const award = view.equipped[type];
          return (
            <li key={type} className="flex min-h-36 flex-col items-center justify-center gap-1 rounded-2xl border border-white/[0.07] bg-black/20 p-2 text-center">
              <span className="text-[11px] font-semibold text-[#A9AECB]">{t(TYPE_COPY[type].name)}</span>
              {award ? (
                <>
                  <button type="button" onClick={() => setDetail(award)} className="rounded-xl transition hover:-translate-y-0.5 motion-reduce:transition-none" aria-label={`${t(shieldName(award.shield_type, award.tier))} — ${en ? 'details' : '자세히'}`}>
                    <ShieldEmblem type={award.shield_type} tier={award.tier} size={72} />
                  </button>
                  <span className="text-xs font-semibold leading-tight text-white">{t(TIER_COPY[award.tier])}</span>
                  {award.tier !== 'bronze'
                    ? <div className="w-full"><p className="mb-1.5 text-[10px] text-[#A9AECB]">{t(scopeLabel(award.scope))}</p><ShieldPointGuide tier={award.tier} en={en} compact /></div>
                    : <span className="text-[11px] text-[#C9A27E]">{en ? 'No bonus · Silver adds points' : '보너스 없음 · 실버부터 보너스'}</span>}
                </>
              ) : (
                <>
                  <EmptyShield size={52} />
                  <span className="text-[11px] text-[#8E94B4]">{en ? 'Not this week' : '이번 주엔 없어요'}</span>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2.5 text-xs text-[#A9AECB]">
        {en ? `Active until ${formatDay(weekEnd, true)}.` : `${formatDay(weekEnd, false)}까지 적용돼요.`}
        {earnedThisWeek > 0 && <span className="ml-1.5 font-semibold text-[#9FF0CE]">{en ? `+${earnedThisWeek} shield points so far` : `지금까지 쉴드 보너스 +${earnedThisWeek}pt`}</span>}
      </p>

      {/* Progress toward next week's shields */}
      {progress && (
        <div className="mt-5 rounded-2xl bg-black/20 p-3.5">
          <p className="text-sm font-semibold text-white">
            {en ? `This week → shields for ${formatDay(nextMonday, true)}` : `이번 주 기록 → ${formatDay(nextMonday, false)}부터 쓸 쉴드`}
          </p>
          <ul className="mt-2.5 space-y-2">
            <WindowRow p={progress.morning} />
            <WindowRow p={progress.evening} />
            <BonusRow p={progress.bonus} />
          </ul>
        </div>
      )}

      {/* Compact archive: four completed weeks, with a lifetime achievement count. */}
      <details key={memberId} className="group/history mt-4 rounded-2xl border border-white/[0.06] p-3.5">
        <summary className="flex min-h-10 cursor-pointer list-none flex-wrap items-center gap-2 text-sm font-semibold text-white [&::-webkit-details-marker]:hidden">
          <ChevronDown size={15} aria-hidden className="text-[#8E94B4] transition-transform group-open/history:rotate-180 motion-reduce:transition-none" />
          <span>{en ? 'Past shields' : '지난 쉴드'}</span>
          <span className="text-[11px] font-normal text-[#8E94B4]">{en ? 'Last 4 weeks' : '최근 4주'}</span>
          {legendaryCount !== null && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#FFB18D]/[0.08] px-2 py-1 text-[11px] text-[#FFB18D]" title={en ? 'Lifetime Legendary shields earned' : '지금까지 받은 레전더리 쉴드'}>
            <ShieldCheck size={12} aria-hidden />{en ? `Legendary ×${legendaryCount}` : `레전더리 ${legendaryCount}회`}
          </span>}
        </summary>
        <div className="mt-3 divide-y divide-white/[0.06]">
          {historyWeeks.map(week => (
            <div key={week.start} className="py-3 first:pt-0 last:pb-0">
              <h3 className="mb-2 text-xs font-semibold text-[#A9AECB]">{weekText(week.start)}</h3>
              <ul className="flex flex-wrap gap-2">
                {week.awards.map(a => (
                  <li key={a.id}><button type="button" onClick={() => setDetail(a)} className="flex min-h-11 items-center gap-1.5 rounded-xl bg-white/[0.02] py-1 pl-1 pr-2.5 text-left hover:bg-white/[0.05]" aria-label={`${t(shieldName(a.shield_type, a.tier))} — ${en ? 'details' : '자세히'}`}>
                    <ShieldEmblem type={a.shield_type} tier={a.tier} size={34} />
                    <span className="text-[11px] leading-tight text-[#E7E9F5]">{t(shieldName(a.shield_type, a.tier))}</span>
                  </button></li>
                ))}
                {week.earlier.map(({ definition: def }) => (
                  <li key={def.achievementId} className="flex min-h-11 items-center gap-1.5 rounded-xl bg-white/[0.02] py-1 pl-1 pr-2.5">
                    <InsigniaBadge rarity={def.rarity} icon={def.icon} seed={def.achievementId} size={34} ariaLabel="" />
                    <span className="text-[11px] leading-tight text-[#C9CCE0]">{t(shieldTitle(def))}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {historyWeeks.length === 0 && <EmptyNote>{en ? 'No shields in the past 4 weeks yet. This week’s shields are shown above.' : '최근 4주에 받은 쉴드가 없어요. 이번 주 쉴드는 위에서 확인할 수 있어요.'}</EmptyNote>}
        </div>
      </details>

      <details className="mt-2 rounded-2xl border border-white/[0.06] p-3.5 text-sm text-[#C9CCE0]">
        <summary className="min-h-9 cursor-pointer font-semibold text-white">{en ? 'How shields work' : '쉴드는 이렇게 받아요'}</summary>
        <ul className="mt-3 grid gap-3">
          {SHIELD_TYPES.map(type => (
            <li key={type} className="flex gap-3">
              <ShieldEmblem type={type} tier="gold" size={40} />
              <span><strong className="text-white">{t(TYPE_COPY[type].name)}</strong> — {t(TYPE_COPY[type].theme)}<br /><span className="text-xs text-[#A9AECB]">{t(TYPE_COPY[type].how)}</span></span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-[#A9AECB]">{en
          ? `Every Monday, last week’s record (Mon–Sun) earns up to three shields, equipped automatically for the new week. Each completed task earns the extra points shown below, only in its shield’s area. Undoing a completion also removes its bonus. Bronze has no bonus. A week needs at least ${WEEKLY_RULES.minCoveredDays} recorded days.`
          : `매주 월요일, 지난주(월~일) 기록으로 쉴드를 최대 3개 얻고 새 주에 자동으로 장착돼요. 해당 영역의 과제를 완료하면 아래 표의 추가 포인트를 받아요. 완료를 취소하면 추가 포인트도 함께 회수돼요. 브론즈는 보너스가 없어요. 한 주에 기록된 날이 ${WEEKLY_RULES.minCoveredDays}일 이상이어야 해요.`}</p>
        <ShieldBonusTable en={en} />
      </details>

      {detail && <ShieldDetail award={detail} recipient={memberName} onClose={() => setDetail(null)} />}
    </section>
  );
}

function WindowRow({ p }: { p: WindowProgress }) {
  const { en, t } = useCopy();
  return (
    <li className="flex items-center gap-2.5 text-xs">
      {p.tier ? <ShieldEmblem type={p.type} tier={p.tier} size={30} projected /> : <EmptyShield size={26} />}
      <span className="min-w-0 flex-1">
        <span className="font-semibold text-white">{t(TYPE_COPY[p.type].name)}</span>
        <span className="ml-1.5 tabular-nums text-[#C9CCE0]">{p.eligible > 0 ? `${p.completed}/${p.eligible} · ${p.rate}%` : (en ? 'nothing closed yet' : '아직 마감된 루틴 없음')}</span>
        {p.tier && <TierBadge tier={p.tier} />}
        {p.next && <span className="block text-[11px] text-[#A9AECB]">{en ? `${p.next.needed} more → ${TIER_COPY[p.next.tier].en}` : `${p.next.needed}개 더 → ${TIER_COPY[p.next.tier].ko}`}</span>}
      </span>
    </li>
  );
}

function BonusRow({ p }: { p: BonusProgress }) {
  const { en, t } = useCopy();
  return (
    <li className="flex items-center gap-2.5 text-xs">
      {p.tier ? <ShieldEmblem type="bonus" tier={p.tier} size={30} projected /> : <EmptyShield size={26} />}
      <span className="min-w-0 flex-1">
        <span className="font-semibold text-white">{t(TYPE_COPY.bonus.name)}</span>
        <span className="ml-1.5 tabular-nums text-[#C9CCE0]">{en ? `${p.bonusDays} bonus day${p.bonusDays === 1 ? '' : 's'}` : `보너스 한 날 ${p.bonusDays}일`}</span>
        <span className="block text-[11px] text-[#8E94B4]">{en ? 'Any one bonus task counts for the day.' : '아무 보너스 과제나 하나면 그날로 인정돼요.'}</span>
        {p.tier && <TierBadge tier={p.tier} />}
        {p.gated
          ? <span className="mt-0.5 flex items-center gap-1 text-[11px] text-[#E8C77B]"><Lock size={11} aria-hidden />{en ? `Needs ${WEEKLY_RULES.bonus.minRequiredRate}% of the required routine first` : `필수 루틴 ${WEEKLY_RULES.bonus.minRequiredRate}% 이상부터 받을 수 있어요`}</span>
          : p.next && <span className="block text-[11px] text-[#A9AECB]">{en ? `${p.next.needed} more day${p.next.needed === 1 ? '' : 's'} → ${TIER_COPY[p.next.tier].en}` : `${p.next.needed}일 더 → ${TIER_COPY[p.next.tier].ko}`}</span>}
      </span>
    </li>
  );
}

function TierBadge({ tier }: { tier: NonNullable<WindowProgress['tier']> }) {
  const { en, t } = useCopy();
  return tier !== 'bronze'
    ? <span className="ml-1.5 text-[#9FF0CE]">{t(TIER_COPY[tier])} {shieldBonusLabel(tier, en)}</span>
    : <span className="ml-1.5 text-[#C9A27E]">{t(TIER_COPY[tier])} · {en ? 'no bonus' : '보너스 없음'}</span>;
}
