'use client';

import { useMemo, useState } from 'react';
import { FlaskConical, Wand2, X } from 'lucide-react';
import { useFamilyStore } from '@/lib/store';
import { useShieldSnapshot } from '@/lib/achievements/useShieldSnapshot';
import { ACHIEVEMENTS, type HabitCategory } from '@/lib/achievements/definitions';
import type { AchievementProgress } from '@/lib/achievements/engine';
import { insigniaSlotsForLevel, loadoutBonusFromIds } from '@/lib/progression';
import { shieldTitle } from '@/lib/analytics/shieldCopy';
import { useMinuteClock, type FamilyAnalyticsState } from '@/lib/analytics/useFamilyAnalytics';
import {
  SHIELD_TYPES,
  TIER_RANK,
  addDays,
  nextPeriod,
  periodContaining,
  zonedDayHour,
  type MissionWeekResult,
  type PastAward,
  type ShieldCompletion,
} from '@/lib/shields/engine';
import { MAX_EQUIPPED, RATE_BP, autoEquip, formatBp, summarizeLoadout } from '@/lib/shields/equipment';
import { liveProgress } from '@/lib/shields/live';
import { LEGACY_INSIGNIA_BONUS_END, legacyInsigniaBonusActive } from '@/lib/shields/transition';
import { CATEGORY_COPY, TIER_COPY, TYPE_COPY, scopeLabel, shieldName } from '@/lib/shields/copy';
import { InsigniaBadge } from '@/components/InsigniaBadge';
import { EmptyNote, ErrorBanner, LoadingBlock, formatDay, useCopy } from '@/components/analytics/ui';
import { EmptyShield, ShieldEmblem } from './ShieldEmblem';
import { ShieldDetail } from './ShieldDetail';
import { periodLabel } from './periodLabel';
import { toEquippable, useShieldWallData, type MonthlyAwardRow } from './useShieldWallData';

const DEFS = new Map(ACHIEVEMENTS.map(def => [def.achievementId, def]));

const monthText = (month: string, en: boolean) => {
  const p = periodContaining('month', month);
  const l = periodLabel('month', p.start, p.end);
  return en ? l.en : l.ko;
};

/** One member's Shields: equipped, ready to equip, this month's progress,
 *  and history. Shields are earned from last month's record and equipped
 *  this month; earlier lifetime shields (formerly insignias) are history. */
export function ShieldWall({ analytics, memberId }: { analytics: FamilyAnalyticsState; memberId: string }) {
  const { en, t } = useCopy();
  const { members, records, familyId } = analytics;
  const level = useFamilyStore(s => s.levelsByUser[memberId]?.currentLevel ?? 1);
  const snapshot = useShieldSnapshot(familyId);
  const now = useMinuteClock();
  const { data, error, reload, setLoadout } = useShieldWallData(familyId, records?.loadedAt);
  const [detail, setDetail] = useState<MonthlyAwardRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const memberName = members.find(m => m.id === memberId)?.name ?? '';

  const view = useMemo(() => {
    if (!data) return null;
    const mine = data.awards.filter(a => a.user_id === memberId);
    const available = mine.filter(a => a.equipment_month === data.month);
    const equipped = data.equipment.filter(e => e.user_id === memberId).sort((a, b) => a.slot_number - b.slot_number)
      .map(e => data.awards.find(a => a.id === e.award_id)).filter((a): a is MonthlyAwardRow => !!a);
    return { mine, available, equipped, best: autoEquip(available.map(toEquippable), data.month), summary: summarizeLoadout(equipped.map(toEquippable)) };
  }, [data, memberId]);

  // Earlier shields (lifetime, frozen) and the three still paying until Nov 30.
  const earlier = useMemo(() => {
    const badges = (snapshot?.achievementsByChild?.[memberId] ?? []).filter(b => b.isUnlocked);
    const ids = (snapshot?.state.children[memberId]?.equippedInsigniaIds ?? []).slice(0, insigniaSlotsForLevel(level));
    const equipped = ids.map(id => badges.find(b => b.achievementId === id)).filter((b): b is AchievementProgress => !!b);
    return {
      badges: badges.sort((a, b) => (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? '')),
      equipped,
      bonus: loadoutBonusFromIds(ids, new Set(badges.map(b => b.achievementId))),
    };
  }, [snapshot, memberId, level]);

  const progress = useMemo(() => {
    if (!data || !records) return null;
    const { day: today, hour } = zonedDayHour(now, data.timezone);
    const period = periodContaining('month', today);
    const completions: ShieldCompletion[] = records.completions.map(c => ({ id: c.id, userId: c.userId, taskId: c.taskId, completedAt: c.completedAt }));
    const missions: MissionWeekResult[] = records.missions.map(r => ({ weekStart: r.week_start, missionId: r.mission_id, status: r.status, metMemberIds: (r.result?.participants ?? []).filter(p => p.met === true).map(p => p.id) }));
    const pastAwards: PastAward[] = data.awards.filter(a => a.user_id === memberId).map(a => ({ periodType: 'month', periodStart: a.evaluation_month, shieldType: a.shield_type }));
    return liveProgress({ userId: memberId, period, today, nowHour: hour, firstSnapshotDay: data.firstSnapshotDay, schedules: data.schedules, completions, tasks: records.tasks, missions, pastAwards, timezone: data.timezone });
  }, [data, records, memberId, now]);

  if (error && !data) return <ErrorBanner onRetry={reload} stale={false} />;
  if (!data || !view) return <LoadingBlock label={en ? 'Loading shields' : '쉴드를 불러오는 중'} />;

  const equippedIds = view.equipped.map(a => a.id);
  const isBest = view.best.length === equippedIds.length && view.best.every(id => equippedIds.includes(id));
  const legacyActive = view.equipped.length === 0 && legacyInsigniaBonusActive(now, data.timezone) && earlier.equipped.length > 0;
  // Shields come from the first official (fully recorded) month onwards.
  const firstOfficial = data.firstSnapshotDay
    ? (() => { const p = periodContaining('month', data.firstSnapshotDay); return p.start >= data.firstSnapshotDay ? p.start : addDays(p.end, 1); })()
    : null;
  const source = firstOfficial && firstOfficial > data.month ? firstOfficial : data.month;
  const nextArrival = nextPeriod(periodContaining('month', source)).start;
  const historyMonths = [...new Set(view.mine.map(a => a.evaluation_month))].sort().reverse();

  const change = async (ids: string[]) => {
    setBusy(true); setActionError(null);
    try { await setLoadout(memberId, ids); }
    catch (err) { setActionError(err instanceof Error ? err.message : 'failed'); }
    finally { setBusy(false); }
  };

  const bonusChips: string[] = legacyActive
    ? [en ? `+${earlier.bonus}% on every habit until ${formatDay(addDays(LEGACY_INSIGNIA_BONUS_END, -1), true)}` : `모든 습관 +${earlier.bonus}% · ${formatDay(addDays(LEGACY_INSIGNIA_BONUS_END, -1), false)}까지`]
    : [
      ...(view.summary.universalBp ? [en ? `All habits +${formatBp(view.summary.universalBp)}` : `모든 습관 +${formatBp(view.summary.universalBp)}`] : []),
      ...(Object.entries(view.summary.categoryBp) as Array<[HabitCategory, number]>).map(([c, bp]) => `${t(CATEGORY_COPY[c])} +${formatBp(bp)}`),
      ...(view.summary.missionBp ? [en ? `Mission habits +${formatBp(view.summary.missionBp)}` : `미션 습관 +${formatBp(view.summary.missionBp)}`] : []),
    ];

  return (
    <section id="shield-wall" aria-labelledby="shield-wall-title" className="scroll-mt-20 rounded-3xl border border-[#E8C77B]/15 bg-[radial-gradient(ellipse_at_50%_0%,rgba(232,199,123,0.10),transparent_60%),#141a31] p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="shield-wall-title" className="text-lg font-bold text-white sm:text-xl">{en ? `${memberName}’s shields` : `${memberName}의 쉴드`}</h2>
          <p className="mt-0.5 text-sm text-[#C9CCE0]">{en ? 'Earn last month. Equip this month.' : '지난달에 얻고, 이번 달에 장착해요.'}</p>
        </div>
        {data.mode !== 'live' && (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#7FD3F7]/30 px-2.5 py-1 text-xs text-[#D4EEFB]"><FlaskConical size={13} aria-hidden />{data.mode === 'simulate' ? (en ? 'Preview — no points yet' : '미리보기 — 포인트 미적용') : (en ? 'Bonuses paused' : '보너스 멈춤')}</span>
        )}
      </header>
      {error && <div className="mt-3"><ErrorBanner onRetry={reload} stale /></div>}
      {actionError && <p role="alert" className="mt-3 rounded-xl bg-[#F2A7C3]/10 p-3 text-sm text-[#F8D3E1]">{en ? 'Couldn’t change shields: ' : '쉴드를 바꾸지 못했어요: '}{actionError}</p>}

      {/* Equipped */}
      <ul className="mt-4 grid grid-cols-3 gap-2 sm:gap-3" aria-label={en ? 'Equipped shields' : '장착한 쉴드'}>
        {Array.from({ length: MAX_EQUIPPED }, (_, i) => i).map(i => {
          const award = view.equipped[i];
          const legacy = legacyActive ? earlier.equipped[i] : undefined;
          return (
            <li key={i} className="flex min-h-36 flex-col items-center justify-center gap-1 rounded-2xl border border-white/[0.07] bg-black/20 p-2 text-center">
              {award ? (
                <>
                  <button type="button" onClick={() => setDetail(award)} className="rounded-xl transition hover:-translate-y-0.5 motion-reduce:transition-none" aria-label={`${t(shieldName(award.shield_type, award.tier, award.category))} — ${en ? 'details' : '자세히'}`}>
                    <ShieldEmblem type={award.shield_type} tier={award.tier} category={award.category} size={76} />
                  </button>
                  <span className="text-xs font-semibold leading-tight text-white">{t(shieldName(award.shield_type, award.tier, award.category))}</span>
                  <span className="text-[11px] text-[#9FF0CE]">+{formatBp(award.bonus_rate_bp)} · {t(scopeLabel(award.scope))}</span>
                  <button type="button" disabled={busy} onClick={() => change(equippedIds.filter(id => id !== award.id))} className="mt-0.5 inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[11px] text-[#A9AECB] hover:bg-white/10 disabled:opacity-50"><X size={12} aria-hidden />{en ? 'Unequip' : '해제'}</button>
                </>
              ) : legacy ? (
                <>
                  <InsigniaBadge rarity={legacy.rarity} icon={legacy.icon} seed={legacy.achievementId} size={76} ariaLabel="" />
                  <span className="text-xs font-semibold leading-tight text-white">{DEFS.get(legacy.achievementId) ? t(shieldTitle(DEFS.get(legacy.achievementId)!)) : legacy.title}</span>
                </>
              ) : (
                <>
                  <EmptyShield size={56} />
                  <span className="text-[11px] text-[#8E94B4]">{en ? 'Empty' : '빈 칸'}</span>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 flex flex-wrap items-center gap-1.5 text-sm">
        {bonusChips.length > 0
          ? bonusChips.map(c => <span key={c} className="rounded-full bg-[#79E8BD]/12 px-2.5 py-1 font-semibold text-[#9FF0CE]">{c}</span>)
          : <span className="text-[#A9AECB]">{en ? 'No bonus right now.' : '지금은 보너스가 없어요.'}</span>}
        {view.summary.capped && <span className="text-xs text-[#E8C77B]">{en ? 'capped at 30% per habit' : '한 습관 최대 30%'}</span>}
      </p>
      {legacyActive && <p className="mt-1.5 text-xs text-[#A9AECB]">{en ? 'These earlier shields keep their bonus until Nov 30. From Dec 1, shields earned in November take their place.' : '지금 장착한 예전 쉴드는 11월 30일까지 보너스를 줘요. 12월 1일부터는 11월에 얻은 쉴드로 바뀌어요.'}</p>}

      {/* Ready to equip */}
      {view.available.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-white">{en ? `Earned in ${monthText(addDays(data.month, -1), true)} — equip until ${formatDay(periodContaining('month', data.month).end, true)}` : `${monthText(addDays(data.month, -1), false)}에 얻은 쉴드 — ${formatDay(periodContaining('month', data.month).end, false)}까지 장착`}</h3>
            {!isBest && <button type="button" disabled={busy} onClick={() => change(view.best)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#A5A6FF]/20 px-3 text-sm font-semibold text-white hover:bg-[#A5A6FF]/30 disabled:opacity-50"><Wand2 size={14} aria-hidden />{en ? 'Best combination' : '최고 조합'}</button>}
          </div>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {view.available.map(a => {
              const on = equippedIds.includes(a.id);
              const full = !on && equippedIds.length >= MAX_EQUIPPED;
              return (
                <li key={a.id} className="flex flex-col items-center gap-1 rounded-2xl border border-white/[0.07] bg-black/15 p-2 text-center">
                  <button type="button" onClick={() => setDetail(a)} className="rounded-xl" aria-label={`${t(shieldName(a.shield_type, a.tier, a.category))} — ${en ? 'details' : '자세히'}`}><ShieldEmblem type={a.shield_type} tier={a.tier} category={a.category} size={60} /></button>
                  <span className="text-[11px] font-semibold leading-tight text-white">{t(shieldName(a.shield_type, a.tier, a.category))}</span>
                  <span className="text-[11px] text-[#9FF0CE]">+{formatBp(a.bonus_rate_bp)}</span>
                  {on
                    ? <span className="min-h-9 text-[11px] leading-9 text-[#9FF0CE]">{en ? 'Equipped' : '장착 중'}</span>
                    : <button type="button" disabled={busy || full} onClick={() => change([...equippedIds, a.id])} className="min-h-9 rounded-lg bg-[#A5A6FF]/20 px-3 text-[11px] font-semibold text-white hover:bg-[#A5A6FF]/30 disabled:opacity-40">{full ? (en ? 'Slots full' : '칸이 꽉 참') : (en ? 'Equip' : '장착')}</button>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* This month */}
      {progress && (
        <div className="mt-5 rounded-2xl bg-black/20 p-3.5">
          <p className="text-sm text-[#E1E3F0]">
            <strong className="text-white">{en ? 'This month' : '이번 달'} {progress.consistency.paceRate === null ? '—' : `${Math.round(progress.consistency.paceRate)}%`}</strong>
            <span className="text-[#A9AECB]"> · {progress.official
              ? (en ? `shields earned now arrive ${formatDay(nextArrival, true)}` : `지금 얻는 쉴드는 ${formatDay(nextArrival, false)}에 도착해요`)
              : (en ? `practice month — official shields start with ${monthText(source, true)} and arrive ${formatDay(nextArrival, true)}` : `연습 달이에요 — 공식 쉴드는 ${monthText(source, false)} 기록부터, ${formatDay(nextArrival, false)}에 도착해요`)}</span>
          </p>
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {progress.candidates.map(c => {
              const tier = c.status === 'qualified' ? c.tier : null;
              return (
                <li key={c.type} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] py-1 pl-1 pr-3 text-xs">
                  {tier ? <ShieldEmblem type={c.type} tier={tier} category={c.category} size={26} projected /> : <EmptyShield size={22} />}
                  <span className={tier ? 'text-white' : 'text-[#8E94B4]'}>{t(TYPE_COPY[c.type].name)}{tier ? ` · ${t(TIER_COPY[tier])} +${formatBp(RATE_BP[tier])}` : ''}</span>
                </li>
              );
            })}
          </ul>
          {progress.consistency.next && progress.consistency.eligibilityReachable && (
            <p className="mt-2 text-xs text-[#A9AECB]">{en ? `${progress.consistency.next.needed} more habits → ${TIER_COPY[progress.consistency.next.tier].en} Consistency` : `습관 ${progress.consistency.next.needed}개 더 → ${TIER_COPY[progress.consistency.next.tier].ko} 꾸준함`}</p>
          )}
        </div>
      )}

      {/* History */}
      <details className="mt-4 rounded-2xl border border-white/[0.06] p-3.5">
        <summary className="min-h-9 cursor-pointer text-sm font-semibold text-white">{en ? `Shield history · ${view.mine.length + earlier.badges.length}` : `쉴드 기록 · ${view.mine.length + earlier.badges.length}개`}</summary>
        <div className="mt-3 space-y-4">
          {historyMonths.map(month => (
            <div key={month}>
              <h3 className="mb-2 text-xs font-semibold text-[#C9CCE0]">{monthText(month, en)}</h3>
              <ul className="flex flex-wrap gap-2">
                {view.mine.filter(a => a.evaluation_month === month).sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier]).map(a => (
                  <li key={a.id}><button type="button" onClick={() => setDetail(a)} className="flex w-24 flex-col items-center gap-1 rounded-xl p-1.5 text-center hover:bg-white/[0.05]"><ShieldEmblem type={a.shield_type} tier={a.tier} category={a.category} size={52} /><span className="text-[11px] leading-tight text-[#E7E9F5]">{t(shieldName(a.shield_type, a.tier, a.category))}</span></button></li>
                ))}
              </ul>
            </div>
          ))}
          {earlier.badges.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold text-[#C9CCE0]">{en ? 'Earlier shields' : '예전 쉴드'}</h3>
              <ul className="grid grid-cols-4 gap-1 sm:grid-cols-8">
                {earlier.badges.map(b => {
                  const def = DEFS.get(b.achievementId);
                  const name = def ? t(shieldTitle(def)) : b.title;
                  return (
                    <li key={b.achievementId} className="flex flex-col items-center gap-1 p-1 text-center" title={b.unlockedAt ? `${name} · ${formatDay(b.unlockedAt.slice(0, 10), en, { year: 'numeric', month: 'short', day: 'numeric' })}` : name}>
                      <InsigniaBadge rarity={b.rarity} icon={b.icon} seed={b.achievementId} size={44} ariaLabel="" />
                      <span className="line-clamp-2 text-[10px] leading-tight text-[#C9CCE0]">{name}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {historyMonths.length === 0 && earlier.badges.length === 0 && <EmptyNote>{en ? 'No shields yet.' : '아직 쉴드가 없어요.'}</EmptyNote>}
        </div>
      </details>

      <details className="mt-2 rounded-2xl border border-white/[0.06] p-3.5 text-sm text-[#C9CCE0]">
        <summary className="min-h-9 cursor-pointer font-semibold text-white">{en ? 'How shields work' : '쉴드는 이렇게 받아요'}</summary>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {SHIELD_TYPES.map(type => (
            <li key={type} className="flex gap-3">
              <ShieldEmblem type={type} tier="gold" size={40} />
              <span><strong className="text-white">{t(TYPE_COPY[type].name)}</strong> — {t(TYPE_COPY[type].theme)}<br /><span className="text-xs text-[#A9AECB]">{t(TYPE_COPY[type].how('month'))}</span></span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-[#A9AECB]">{en
          ? 'Each month’s record earns shields for the next month. Equip up to three (one per type). Silver +2% · Gold +5% · Epic +10% · Legendary +15% of base points, at most 30% per habit, rounded down, taken back if a completion is undone. Consistency boosts every habit; Dedication its habit area; Growth and Comeback the areas that improved (or every habit at half rate); Teamwork this week’s mission habits. A new month starts with the best combination equipped.'
          : '매달의 기록으로 다음 달에 쓸 쉴드를 얻어요. 종류별로 하나씩 최대 3개 장착해요. 기본 포인트에 실버 +2% · 골드 +5% · 에픽 +10% · 레전더리 +15%, 한 습관 최대 30%, 내림 계산이고 완료를 취소하면 함께 돌려받아요. 꾸준함은 모든 습관, 몰입은 그 분야, 성장·재도전은 좋아진 분야(확인이 안 되면 모든 습관에 절반), 협력은 이번 주 미션 습관에 적용돼요. 새 달이 되면 최고 조합이 자동으로 장착돼요.'}</p>
      </details>

      {detail && <ShieldDetail award={detail} recipient={memberName} onClose={() => setDetail(null)} />}
    </section>
  );
}
