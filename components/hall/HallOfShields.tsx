'use client';

import { useMemo, useState } from 'react';
import { CalendarClock, Hourglass, Info, Sparkles } from 'lucide-react';
import { useFamilyStore } from '@/lib/store';
import { josa } from '@/lib/analytics/insights';
import { useMinuteClock, type FamilyAnalyticsState } from '@/lib/analytics/useFamilyAnalytics';
import {
  RULES,
  SHIELD_TYPES,
  TIERS,
  TIER_RANK,
  addDays,
  periodContaining,
  previousPeriod,
  zonedDayHour,
  type MissionWeekResult,
  type PastAward,
  type PeriodType,
  type ShieldCompletion,
  type ShieldTier,
  type ShieldType,
} from '@/lib/shields/engine';
import { liveProgress, type LiveProgress } from '@/lib/shields/live';
import { TIER_COPY, TYPE_COPY, shieldName } from '@/lib/shields/copy';
import { EmptyNote, ErrorBanner, LoadingBlock, MEMBER_TONES, MemberAvatar, Segmented, formatDay, useCopy } from '@/components/analytics/ui';
import { EmptyShield, ShieldEmblem } from './ShieldEmblem';
import { ShieldDetail } from './ShieldDetail';
import { periodLabel } from './periodLabel';
import { useHallData, type AwardRow, type EvaluationRow } from './useHallData';

type View = 'week' | 'month' | 'history';
type L = { en: string; ko: string };

function minTier(a: ShieldTier | null, b: ShieldTier | null): ShieldTier | null {
  if (!a || !b) return null;
  return TIER_RANK[a] <= TIER_RANK[b] ? a : b;
}

/** Status of the most recent finished period for one member. */
function finishedStatus(award: AwardRow | undefined, evaluation: EvaluationRow | undefined, official: boolean): 'earned' | 'none' | 'insufficient' | 'pending' | 'not_started' {
  if (award) return 'earned';
  if (evaluation?.evaluation_status === 'no_award') return 'none';
  if (evaluation?.evaluation_status === 'insufficient_data') return 'insufficient';
  return official ? 'pending' : 'not_started';
}

function MemberHonorCard(props: {
  name: string;
  avatarUrl?: string;
  tone: string;
  type: PeriodType;
  lastPeriod: { start: string; end: string };
  lastStatus: ReturnType<typeof finishedStatus>;
  lastAward?: AwardRow;
  live: LiveProgress;
  firstOfficial: string | null;
  onOpen: (award: AwardRow) => void;
}) {
  const { en, t } = useCopy();
  const { live, lastAward } = props;
  const unit = props.type === 'week' ? (en ? 'week' : '주') : (en ? 'month' : '달');
  const proj = live.consistency;
  const leading = live.leading;
  // Never show more than is still mathematically attainable.
  const leadingTier = leading ? (leading.type === 'consistency' ? minTier(leading.tier, proj.bestPossibleTier) : leading.tier) : null;
  const lastLabel = periodLabel(props.type, props.lastPeriod.start, props.lastPeriod.end);

  return (
    <article className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[radial-gradient(ellipse_at_30%_0%,rgba(165,166,255,0.12),transparent_60%),#141a31] p-4 sm:p-5">
      <header className="flex items-center gap-3">
        <MemberAvatar name={props.name} avatarUrl={props.avatarUrl} tone={props.tone} size={36} />
        <h3 className="min-w-0 flex-1 truncate text-lg font-bold text-white">{props.name}</h3>
      </header>

      <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
        {/* Last finalized period */}
        <div className="flex flex-col items-center text-center sm:w-40">
          {props.lastStatus === 'earned' && lastAward ? (
            <button type="button" onClick={() => props.onOpen(lastAward)} className="rounded-2xl p-1 transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-[#A5A6FF] motion-reduce:transition-none" aria-label={`${t(shieldName(lastAward.shield_type, lastAward.tier, lastAward.category))} — ${en ? 'details' : '자세히'}`}>
              <ShieldEmblem type={lastAward.shield_type} tier={lastAward.tier} size={112} />
            </button>
          ) : <EmptyShield size={96} />}
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-[#8E94B4]">{en ? `Last ${unit}` : `지난${unit}`} · {t(lastLabel)}</p>
          <p className="mt-0.5 text-sm font-semibold text-white">
            {props.lastStatus === 'earned' && lastAward ? t(shieldName(lastAward.shield_type, lastAward.tier, lastAward.category))
              : props.lastStatus === 'none' ? (props.type === 'week' ? (en ? 'Every new week is another chance.' : '새로운 한 주는 또 다른 기회예요.') : (en ? 'Every new month is another chance.' : '새로운 한 달도 또 다른 기회예요.'))
              : props.lastStatus === 'insufficient' ? (en ? 'Not enough scheduled habits to judge.' : '판단할 만큼 습관이 많지 않았어요.')
              : props.lastStatus === 'pending' ? (en ? 'Evaluation pending' : '평가 대기 중')
              : (en ? `Official shields start ${props.firstOfficial ? formatDay(props.firstOfficial, true) : 'soon'}` : `공식 쉴드는 ${props.firstOfficial ? formatDay(props.firstOfficial, false) : '곧'}부터 시작해요`)}
          </p>
          {props.lastStatus === 'earned' && <span className="mt-1 rounded-full bg-[#79E8BD]/15 px-2 py-0.5 text-[11px] font-semibold text-[#9FF0CE]">{en ? 'Award earned' : '획득'}</span>}
        </div>

        {/* Ongoing period — progress only, never an award */}
        <div className="rounded-2xl border border-dashed border-white/12 bg-black/20 p-3.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-[#A5A6FF]"><Hourglass size={13} aria-hidden />{en ? `This ${unit} · in progress` : `이번 ${unit} · 진행 중`}{!live.official && <span className="font-normal text-[#8E94B4]">{en ? ' (practice — not official)' : ' (연습 — 공식 아님)'}</span>}</p>
          {live.soFar.eligible === 0 && live.remaining === 0 ? (
            <p className="mt-2 text-sm text-[#C9CCE0]">{en ? 'No habits scheduled this period.' : '이번 기간에 예정된 습관이 없어요.'}</p>
          ) : (
            <>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div>
                  <p className="text-3xl font-bold text-white">{proj.paceRate === null ? '—' : `${Math.round(proj.paceRate)}%`}</p>
                  <p className="text-xs text-[#A9AECB]">{en ? `${proj.completed}/${proj.eligibleSoFar} so far · ${proj.remaining} still ahead` : `지금까지 ${proj.eligibleSoFar}개 중 ${proj.completed}개 · 앞으로 ${proj.remaining}개`}</p>
                </div>
                {leading && leadingTier && (
                  <div className="flex items-center gap-2 text-right">
                    <div>
                      <p className="text-[11px] text-[#8E94B4]">{en ? 'Currently qualifying' : '현재 페이스'}</p>
                      <p className="text-sm font-semibold text-white">{t(shieldName(leading.type, leadingTier, leading.category))}</p>
                      <p className="text-[11px] text-[#8E94B4]">{en ? 'Projected — not earned yet' : '예상일 뿐, 아직 획득 아님'}</p>
                    </div>
                    <ShieldEmblem type={leading.type} tier={leadingTier} size={44} projected />
                  </div>
                )}
              </div>
              <p className="mt-2.5 text-xs leading-relaxed text-[#C9CCE0]">
                {!proj.eligibilityReachable
                  ? (en ? `A ${unit} needs at least ${RULES[props.type].minOccurrences} scheduled habits on ${RULES[props.type].minDays} days to earn a shield.` : `쉴드를 받으려면 ${RULES[props.type].minDays}일 이상, 습관 ${RULES[props.type].minOccurrences}개 이상이 필요해요.`)
                  : proj.next
                    ? (en ? `Complete ${proj.next.needed} of the ${proj.remaining} remaining to reach ${TIER_COPY[proj.next.tier].en} Consistency.` : `남은 ${proj.remaining}개 중 ${proj.next.needed}개를 더 하면 ${TIER_COPY[proj.next.tier].ko} 꾸준함까지 갈 수 있어요.`)
                    : proj.bestPossibleTier === 'legendary'
                      ? (en ? 'Keep every remaining habit to stay on track for Legendary.' : '남은 습관을 모두 하면 레전더리를 지킬 수 있어요.')
                      : proj.bestPossibleTier
                        ? (en ? `Best possible: ${TIER_COPY[proj.bestPossibleTier].en} Consistency.` : `최대 ${TIER_COPY[proj.bestPossibleTier].ko} 꾸준함까지 가능해요.`)
                        : (en ? 'Consistency is out of reach this time — growth, dedication, and teamwork can still count.' : '이번엔 꾸준함은 어렵지만, 성장·몰입·협력 쉴드는 아직 가능해요.')}
              </p>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

export function HallOfShields({ analytics }: { analytics: FamilyAnalyticsState }) {
  const { en, t } = useCopy();
  const { members, records, familyId } = analytics;
  const users = useFamilyStore(s => s.users);
  const now = useMinuteClock();
  const [view, setView] = useState<View>('week');
  const [detail, setDetail] = useState<AwardRow | null>(null);
  const [memberFilter, setMemberFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<ShieldType | 'all'>('all');
  const [tierFilter, setTierFilter] = useState<ShieldTier | 'all'>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodType | 'all'>('all');
  const { data, error, reload } = useHallData(familyId, records?.loadedAt);

  const nameOf = (id: string) => members.find(m => m.id === id)?.name ?? '';
  const toneOf = (id: string) => MEMBER_TONES[Math.max(0, members.findIndex(m => m.id === id)) % MEMBER_TONES.length];

  const showcase = useMemo(() => {
    if (!data || !records || view === 'history') return null;
    const type: PeriodType = view;
    const { day: today, hour } = zonedDayHour(now, data.timezone);
    const current = periodContaining(type, today);
    const last = previousPeriod(current);
    const completions: ShieldCompletion[] = records.completions.map(c => ({ id: c.id, userId: c.userId, taskId: c.taskId, completedAt: c.completedAt }));
    const missions: MissionWeekResult[] = records.missions.map(r => ({
      weekStart: r.week_start,
      missionId: r.mission_id,
      status: r.status,
      metMemberIds: (r.result?.participants ?? []).filter(p => p.met === true).map(p => p.id),
    }));
    const lastOfficial = data.firstSnapshotDay !== null && last.start >= data.firstSnapshotDay;
    const firstOfficial = data.firstSnapshotDay
      ? (periodContaining(type, data.firstSnapshotDay).start >= data.firstSnapshotDay ? periodContaining(type, data.firstSnapshotDay).start : addDays(periodContaining(type, data.firstSnapshotDay).end, 1))
      : null;
    return {
      type,
      last,
      firstOfficial,
      cards: members.map(m => {
        const pastAwards: PastAward[] = data.awards.filter(a => a.user_id === m.id).map(a => ({ periodType: a.period_type, periodStart: a.period_start, shieldType: a.shield_type }));
        const award = data.awards.find(a => a.user_id === m.id && a.period_type === type && a.period_start === last.start);
        const evaluation = data.evaluations.find(e => e.user_id === m.id && e.period_type === type && e.period_start === last.start);
        return {
          member: m,
          award,
          status: finishedStatus(award, evaluation, lastOfficial),
          live: liveProgress({ userId: m.id, period: current, today, nowHour: hour, firstSnapshotDay: data.firstSnapshotDay, schedules: data.schedules, completions, tasks: records.tasks, missions, pastAwards, timezone: data.timezone }),
        };
      }),
    };
  }, [data, records, members, now, view]);

  // Highlights only from finalized award records.
  const highlights = useMemo(() => {
    if (!data || !showcase) return [] as L[];
    const out: L[] = [];
    const lastAwards = data.awards.filter(a => a.period_type === showcase.type && a.period_start === showcase.last.start);
    const unit = showcase.type === 'week' ? { en: 'last week', ko: '지난주' } : { en: 'last month', ko: '지난달' };
    if (lastAwards.length >= 2) out.push({ en: `${lastAwards.length} family members earned a Shield ${unit.en}.`, ko: `${unit.ko} 가족 ${lastAwards.length}명이 쉴드를 받았어요.` });
    for (const a of lastAwards) {
      const name = nameOf(a.user_id);
      const earlierSameOrBetter = data.awards.some(b => b.user_id === a.user_id && b.id !== a.id && b.period_end < a.period_end && TIER_RANK[b.tier] >= TIER_RANK[a.tier]);
      if (!earlierSameOrBetter && TIER_RANK[a.tier] >= TIER_RANK.epic) out.push({ en: `${name} earned their first ${TIER_COPY[a.tier].en} Shield.`, ko: `${name}의 첫 ${TIER_COPY[a.tier].ko} 쉴드예요.` });
      else if (a.shield_type === 'growth' || a.shield_type === 'comeback') out.push({ en: `${name} received a ${TYPE_COPY[a.shield_type].name.en}.`, ko: `${josa(name, '이', '가')} ${TYPE_COPY[a.shield_type].name.ko}를 받았어요.` });
      else if (!data.awards.some(b => b.user_id === a.user_id && b.id !== a.id)) out.push({ en: `${name} earned a first Shield.`, ko: `${name}의 첫 쉴드예요.` });
    }
    return out.slice(0, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, showcase]);

  const history = useMemo(() => {
    if (!data) return [];
    return data.awards
      .filter(a => (memberFilter === 'all' || a.user_id === memberFilter) && (typeFilter === 'all' || a.shield_type === typeFilter) && (tierFilter === 'all' || a.tier === tierFilter) && (periodFilter === 'all' || a.period_type === periodFilter))
      .sort((a, b) => b.period_end.localeCompare(a.period_end)
        || (a.period_type === b.period_type ? 0 : a.period_type === 'month' ? -1 : 1)
        || nameOf(a.user_id).localeCompare(nameOf(b.user_id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, memberFilter, typeFilter, tierFilter, periodFilter]);

  if (error && !data) return <div className="p-4"><ErrorBanner onRetry={reload} stale={false} /></div>;
  if (!data || !records) return <LoadingBlock label={en ? 'Loading the Hall of Shields' : '쉴드 명예의 전당을 불러오는 중'} />;

  const historyGroups: Array<{ key: string; label: L; items: AwardRow[] }> = [];
  for (const a of history) {
    const key = `${a.period_type}|${a.period_start}`;
    let group = historyGroups.find(g => g.key === key);
    if (!group) { group = { key, label: periodLabel(a.period_type, a.period_start, a.period_end), items: [] }; historyGroups.push(group); }
    group.items.push(a);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-6 sm:py-7">
      {error && <ErrorBanner onRetry={reload} stale />}
      <section className="relative overflow-hidden rounded-3xl border border-[#E8C77B]/15 bg-[radial-gradient(ellipse_at_50%_0%,rgba(232,199,123,0.16),transparent_60%),radial-gradient(ellipse_at_0%_100%,rgba(165,166,255,0.14),transparent_55%),#11162b] px-5 py-6 text-center sm:py-8">
        <div className="flex justify-center gap-2" aria-hidden>
          {(['consistency', 'growth', 'comeback', 'teamwork', 'dedication'] as ShieldType[]).map((type, i) => (
            <span key={type} className={i === 2 ? '' : 'mt-3 opacity-80'}><ShieldEmblem type={type} tier={(['silver', 'gold', 'legendary', 'epic', 'gold'] as ShieldTier[])[i]} size={i === 2 ? 56 : 40} /></span>
          ))}
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{en ? 'Hall of Shields' : '쉴드 명예의 전당'}</h1>
        <p className="mt-1.5 text-sm text-[#C9CCE0] sm:text-base">{en ? 'Every week tells a different story.' : '매주 다른 이야기가 쓰여요.'}</p>
        <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-[#8E94B4]">{en ? 'You don’t collect Shields. You earn them — at most one each week and each month, and they stay forever. Shields are honors, not points.' : '쉴드는 모으는 게 아니라 얻는 거예요. 주마다, 달마다 최대 하나씩 받고 영원히 남아요. 포인트가 아니라 명예예요.'}</p>
        <div className="mt-4 flex justify-center">
          <Segmented label={en ? 'Period' : '기간'} value={view} onChange={setView} options={[{ value: 'week', label: en ? 'This Week' : '이번 주' }, { value: 'month', label: en ? 'This Month' : '이번 달' }, { value: 'history', label: en ? 'History' : '기록' }]} />
        </div>
      </section>

      {showcase && (
        <>
          {showcase.firstOfficial && showcase.firstOfficial > zonedDayHour(now, data.timezone).day && (
            <p className="flex items-start gap-2 rounded-2xl border border-[#A5A6FF]/20 bg-[#A5A6FF]/[0.07] p-3 text-sm text-[#D7DAF5]">
              <CalendarClock size={16} className="mt-0.5 shrink-0" aria-hidden />
              {showcase.type === 'week'
                ? (en ? `The first official week starts ${formatDay(showcase.firstOfficial, true)}. Until then, progress here is practice — earlier weeks can’t be judged fairly, so no past shields are handed out.` : `첫 공식 주간은 ${formatDay(showcase.firstOfficial, false)}에 시작해요. 그 전까지는 연습이에요. 지난 기간은 공정하게 판단할 수 없어서 소급해서 주지 않아요.`)
                : (en ? `The first official month starts ${formatDay(showcase.firstOfficial, true)}.` : `첫 공식 월간은 ${formatDay(showcase.firstOfficial, false)}에 시작해요.`)}
            </p>
          )}
          {highlights.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label={en ? 'Family highlights' : '가족 하이라이트'}>
              {highlights.map((h, i) => <li key={i} className="inline-flex items-center gap-1.5 rounded-full border border-[#E8C77B]/25 bg-[#E8C77B]/[0.08] px-3 py-1.5 text-sm text-[#F3E3BC]"><Sparkles size={14} aria-hidden />{t(h)}</li>)}
            </ul>
          )}
          {members.length === 0 ? <EmptyNote>{en ? 'No family members yet.' : '아직 가족 구성원이 없어요.'}</EmptyNote> : (
            <div className={`grid gap-4 ${members.length === 1 ? '' : 'md:grid-cols-2'}`}>
              {showcase.cards.map(card => (
                <MemberHonorCard
                  key={card.member.id}
                  name={card.member.name}
                  avatarUrl={users.find(u => u.id === card.member.id)?.avatarUrl}
                  tone={toneOf(card.member.id)}
                  type={showcase.type}
                  lastPeriod={showcase.last}
                  lastStatus={card.status}
                  lastAward={card.award}
                  live={card.live}
                  firstOfficial={showcase.firstOfficial}
                  onOpen={setDetail}
                />
              ))}
            </div>
          )}
          <details className="rounded-2xl border border-white/[0.07] bg-[#141a31] p-4 text-sm text-[#C9CCE0]">
            <summary className="flex min-h-9 cursor-pointer items-center gap-2 font-semibold text-white"><Info size={15} aria-hidden />{en ? 'The five shields and how they are chosen' : '다섯 가지 쉴드와 고르는 방법'}</summary>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {SHIELD_TYPES.map(type => (
                <li key={type} className="flex gap-3">
                  <ShieldEmblem type={type} tier="gold" size={40} />
                  <span><strong className="text-white">{t(TYPE_COPY[type].name)}</strong> — {t(TYPE_COPY[type].theme)}<br /><span className="text-xs text-[#A9AECB]">{t(TYPE_COPY[type].how(showcase.type))}</span></span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-[#A9AECB]">{en ? 'If several shields qualify, the highest tier wins. At the same tier: Comeback, then Growth, Teamwork, Dedication, Consistency. Only habits on each day’s schedule (recorded just after midnight) count, so editing habits later doesn’t change anything. Rest days simply don’t count.' : '여러 쉴드에 해당하면 가장 높은 등급이 선택돼요. 같은 등급이면 재도전 → 성장 → 협력 → 몰입 → 꾸준함 순서예요. 매일 자정 직후 기록된 그날의 일정만 계산하므로 나중에 습관을 고쳐도 결과가 바뀌지 않아요. 쉬는 날은 계산에서 빠져요.'}</p>
          </details>
        </>
      )}

      {view === 'history' && (
        <section aria-labelledby="history-title" className="space-y-4">
          <h2 id="history-title" className="sr-only">{en ? 'Shield history' : '쉴드 기록'}</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { label: en ? 'Member' : '구성원', value: memberFilter, set: setMemberFilter, options: [['all', en ? 'Everyone' : '모두'], ...members.map(m => [m.id, m.name])] },
              { label: en ? 'Type' : '종류', value: typeFilter, set: (v: string) => setTypeFilter(v as ShieldType | 'all'), options: [['all', en ? 'All types' : '모든 종류'], ...SHIELD_TYPES.map(s => [s, t(TYPE_COPY[s].name)])] },
              { label: en ? 'Tier' : '등급', value: tierFilter, set: (v: string) => setTierFilter(v as ShieldTier | 'all'), options: [['all', en ? 'All tiers' : '모든 등급'], ...TIERS.map(s => [s, t(TIER_COPY[s])])] },
              { label: en ? 'Period' : '기간', value: periodFilter, set: (v: string) => setPeriodFilter(v as PeriodType | 'all'), options: [['all', en ? 'Weekly & monthly' : '주간·월간'], ['week', en ? 'Weekly Honors' : '주간 명예'], ['month', en ? 'Monthly Honors' : '월간 명예']] },
            ].map(f => (
              <label key={f.label} className="flex items-center gap-2 text-xs text-[#A9AECB]">
                <span className="sr-only">{f.label}</span>
                <select value={f.value} onChange={e => f.set(e.target.value)} aria-label={f.label} className="min-h-11 rounded-xl border border-white/12 bg-[#1a2040] px-3 text-sm text-white">
                  {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
            ))}
          </div>
          {historyGroups.length === 0 ? (
            <EmptyNote>{data.awards.length === 0
              ? (en ? 'No shields have been awarded yet. The first official results arrive after the first fully recorded week ends.' : '아직 수여된 쉴드가 없어요. 첫 공식 주간이 끝나면 첫 결과가 나와요.')
              : (en ? 'No shields match these filters.' : '조건에 맞는 쉴드가 없어요.')}</EmptyNote>
          ) : (
            <ol className="space-y-5">
              {historyGroups.map(group => (
                <li key={group.key}>
                  <h3 className="mb-2 text-sm font-semibold text-[#C9CCE0]">{group.key.startsWith('month') ? (en ? 'Monthly Honors · ' : '월간 명예 · ') : (en ? 'Weekly Honors · ' : '주간 명예 · ')}{t(group.label)}</h3>
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {group.items.map(a => (
                      <li key={a.id}>
                        <button type="button" onClick={() => setDetail(a)} className="flex w-full flex-col items-center gap-1.5 rounded-2xl border border-white/[0.07] bg-[#141a31] p-3 text-center transition hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-[#A5A6FF]">
                          <ShieldEmblem type={a.shield_type} tier={a.tier} size={72} />
                          <span className="text-sm font-semibold text-white">{nameOf(a.user_id)}</span>
                          <span className="text-xs text-[#A9AECB]">{t(shieldName(a.shield_type, a.tier, a.category))}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {detail && <ShieldDetail award={detail} recipient={nameOf(detail.user_id)} onClose={() => setDetail(null)} />}
    </div>
  );
}
