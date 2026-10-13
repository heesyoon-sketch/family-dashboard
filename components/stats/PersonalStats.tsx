'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, CalendarDays, CheckCircle2, Flame, Lightbulb, TrendingUp } from 'lucide-react';
import { useFamilyStore } from '@/lib/store';
import { useShieldSnapshot } from '@/lib/achievements/useShieldSnapshot';
import { ACHIEVEMENTS } from '@/lib/achievements/definitions';
import { computeLevelProgress } from '@/lib/progression';
import {
  PERIODS,
  activeDayRun,
  buildMemberHistory,
  comparePeriod,
  dayKey,
  habitPerformance,
  heatmapWeeks,
  longestActiveDayRun,
  periodRange,
  trendSeries,
  type PeriodId,
} from '@/lib/analytics/history';
import { growthInsights, journeyEvents, type Localized, type ShieldUnlock } from '@/lib/analytics/insights';
import { shieldTitle } from '@/lib/analytics/shieldCopy';
import { useMinuteClock, type FamilyAnalyticsState } from '@/lib/analytics/useFamilyAnalytics';
import { EmptyNote, ErrorBanner, LoadingBlock, MEMBER_TONES, MemberAvatar, PointDelta, Section, Segmented, pctText, useCopy } from '@/components/analytics/ui';
import { TrendChart } from './TrendChart';
import { ConsistencyHeatmap } from './ConsistencyHeatmap';
import { HabitPerformanceList } from './HabitPerformanceList';
import { ShieldCollection } from './ShieldCollection';
import { PersonalJourney } from './PersonalJourney';

const PERIOD_LABEL: Record<PeriodId, Localized> = {
  '7d': { en: '7 days', ko: '7일' },
  '30d': { en: '30 days', ko: '30일' },
  '90d': { en: '90 days', ko: '90일' },
  year: { en: 'This year', ko: '올해' },
  all: { en: 'All time', ko: '전체' },
};
const COMPARE_LABEL: Record<PeriodId, Localized> = {
  '7d': { en: 'vs previous 7 days', ko: '직전 7일 대비' },
  '30d': { en: 'vs previous 30 days', ko: '직전 30일 대비' },
  '90d': { en: 'vs previous 90 days', ko: '직전 90일 대비' },
  year: { en: 'vs same point last year', ko: '작년 같은 기간 대비' },
  all: { en: 'Since your first record', ko: '첫 기록부터' },
};
const MOMENTUM_LABEL: Record<string, Localized> = {
  spark: { en: 'Spark', ko: '불씨' },
  warm: { en: 'Warm', ko: '따뜻함' },
  bright: { en: 'Bright', ko: '환하게' },
  blazing: { en: 'Blazing', ko: '활활' },
  overflowing: { en: 'Overflowing', ko: '넘쳐흘러요' },
};

export function PersonalStats({ analytics, initialMemberId }: { analytics: FamilyAnalyticsState; initialMemberId: string | null }) {
  const { en, t } = useCopy();
  const { members, records, timezone, error, refresh, familyId } = analytics;
  const users = useFamilyStore(s => s.users);
  const momentumByUser = useFamilyStore(s => s.momentumByUser);
  const levelsByUser = useFamilyStore(s => s.levelsByUser);
  const snapshot = useShieldSnapshot(familyId);
  const now = useMinuteClock();
  const [selected, setSelected] = useState<string | null>(initialMemberId);
  const [period, setPeriod] = useState<PeriodId>('30d');
  const memberId = members.some(m => m.id === selected) ? selected! : members[0]?.id ?? null;
  const member = members.find(m => m.id === memberId) ?? null;

  const view = useMemo(() => {
    if (!records || !member) return null;
    const history = buildMemberHistory({ member, tasks: records.tasks, completions: records.completions, now, timezone });
    const range = periodRange(period, history.today, history.firstDay);
    const memberTasks = records.tasks.filter(task => task.userId === member.id);
    return {
      history,
      range,
      comparison: comparePeriod(history, range),
      series: trendSeries(history, range),
      heatmap: heatmapWeeks(history, 26),
      habits: habitPerformance(history, memberTasks, range),
      insights: growthInsights(history, memberTasks, range),
      run: activeDayRun(history),
      bestRun: longestActiveDayRun(history),
    };
  }, [records, member, now, timezone, period]);

  const journey = useMemo(() => {
    if (!view || !member || !records) return [];
    const badges = snapshot?.achievementsByChild?.[member.id] ?? [];
    const defs = new Map(ACHIEVEMENTS.map(def => [def.achievementId, def]));
    // Commons are frequent; the journey keeps the first one and rarer ones.
    const unlocked = badges.filter(b => b.isUnlocked && b.unlockedAt).sort((a, b) => a.unlockedAt!.localeCompare(b.unlockedAt!));
    const shields: ShieldUnlock[] = unlocked
      .filter((b, i) => i === 0 || b.rarity !== 'common')
      .map(b => {
        const def = defs.get(b.achievementId);
        return { id: b.achievementId, title: def ? shieldTitle(def) : { en: b.title, ko: b.title }, rarity: b.rarity, unlockedAt: b.unlockedAt!, day: dayKey(new Date(b.unlockedAt!), timezone) };
      });
    return journeyEvents(view.history, records.tasks, shields);
  }, [view, member, records, snapshot, timezone]);

  useEffect(() => {
    if (!view || typeof window === 'undefined' || window.location.hash !== '#shields') return;
    document.getElementById('shields')?.scrollIntoView({ block: 'start' });
  }, [view]);

  if (!records) {
    return error ? <div className="p-4"><ErrorBanner onRetry={refresh} stale={false} /></div> : <LoadingBlock label={en ? 'Loading stats' : '통계를 불러오는 중'} />;
  }
  if (!member || !view) return <div className="p-4"><EmptyNote>{en ? 'Add a family member to start tracking.' : '가족 구성원을 추가하면 기록이 시작돼요.'}</EmptyNote></div>;

  const user = users.find(u => u.id === member.id);
  const momentum = momentumByUser[member.id];
  const levelProgress = computeLevelProgress(levelsByUser[member.id]?.totalPoints ?? 0);
  const { comparison } = view;
  const hasHistory = view.history.firstDay !== null;

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-4 sm:px-6 sm:py-6">
      {error && <ErrorBanner onRetry={refresh} stale />}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="group" aria-label={en ? 'Family member' : '가족 구성원'} className="flex max-w-full gap-2 overflow-x-auto pb-1">
          {members.map((m, i) => {
            const u = users.find(x => x.id === m.id);
            return (
              <button key={m.id} type="button" aria-pressed={m.id === member.id} onClick={() => setSelected(m.id)} className={`flex min-h-12 shrink-0 items-center gap-2 rounded-xl border px-2.5 pr-3.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-[#A5A6FF] ${m.id === member.id ? 'border-[#A5A6FF]/60 bg-[#A5A6FF]/15 text-white' : 'border-white/10 text-[#B3B7CE] hover:bg-white/[0.05]'}`}>
                <MemberAvatar name={m.name} avatarUrl={u?.avatarUrl} tone={MEMBER_TONES[i % MEMBER_TONES.length]} size={32} />{m.name}
              </button>
            );
          })}
        </div>
        <Segmented label={en ? 'Reporting period' : '기간'} value={period} onChange={setPeriod} options={PERIODS.map(p => ({ value: p, label: t(PERIOD_LABEL[p]) }))} />
      </div>

      <section aria-labelledby="overview-title" className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[radial-gradient(ellipse_at_top_left,rgba(165,166,255,0.16),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(121,232,189,0.10),transparent_60%),#151a2e] p-5 sm:p-7">
        <div className="flex items-center gap-3">
          <MemberAvatar name={member.name} avatarUrl={user?.avatarUrl} tone={MEMBER_TONES[Math.max(0, members.indexOf(member)) % MEMBER_TONES.length]} size={44} />
          <div className="min-w-0">
            <h2 id="overview-title" className="truncate text-lg font-bold text-white">{en ? `${member.name}'s growth` : `${member.name}의 성장`}</h2>
            <p className="text-xs text-[#A9AECB]">Lv.{levelProgress.level} · {t(PERIOD_LABEL[period])}</p>
          </div>
        </div>
        {!hasHistory ? (
          <p className="mt-6 text-sm leading-relaxed text-[#C9CCE0]">{en ? 'No completed habits yet. Once habits are scheduled and completed, your growth appears here — nothing is estimated.' : '아직 완료한 습관이 없어요. 습관을 완료하면 이곳에 실제 기록으로 성장이 보여요.'}</p>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-2">
              <div>
                <p className="text-xs font-semibold text-[#A9AECB]">{en ? 'Completion rate' : '완료율'}</p>
                <p className="text-5xl font-bold tracking-tight text-white sm:text-6xl">{pctText(comparison.current.rate)}</p>
              </div>
              <div className="pb-2">
                <PointDelta points={comparison.pointChange} className="text-sm" />
                <p className="text-xs text-[#8E94B4]">{t(COMPARE_LABEL[period])}{comparison.comparable && comparison.previous?.rate !== null && comparison.previous ? (en ? ` (${pctText(comparison.previous.rate)})` : ` (${pctText(comparison.previous.rate)})`) : ''}</p>
              </div>
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { icon: CalendarDays, label: en ? 'Active days' : '실천한 날', value: `${comparison.current.activeDays}`, sub: en ? `of ${comparison.current.scheduledDays} with habits` : `습관 있던 ${comparison.current.scheduledDays}일 중` },
                { icon: CheckCircle2, label: en ? 'Completed' : '완료한 습관', value: `${comparison.current.completed}`, sub: en ? `of ${comparison.current.eligible} scheduled` : `예정 ${comparison.current.eligible}회 중` },
                { icon: Flame, label: en ? 'Active-day run' : '연속 실천', value: en ? `${view.run} days` : `${view.run}일`, sub: en ? `Best ${view.bestRun}` : `최고 ${view.bestRun}일` },
                { icon: Activity, label: en ? 'Momentum' : '모멘텀', value: momentum ? t(MOMENTUM_LABEL[momentum.state] ?? { en: momentum.meta.label, ko: momentum.meta.label }) : '—', sub: momentum ? (en ? `Score ${momentum.score} · last 14 days` : `점수 ${momentum.score} · 최근 14일`) : '' },
              ].map(item => (
                <div key={item.label} className="rounded-2xl bg-black/20 p-3">
                  <dt className="flex items-center gap-1.5 text-xs text-[#A9AECB]"><item.icon size={13} aria-hidden />{item.label}</dt>
                  <dd className="mt-1 text-xl font-bold text-white">{item.value}</dd>
                  <dd className="text-[11px] text-[#8E94B4]">{item.sub}</dd>
                </div>
              ))}
            </dl>
            {view.insights.length > 0 && (
              <ul className="mt-5 space-y-2" aria-label={en ? 'Growth insights' : '성장 인사이트'}>
                {view.insights.map(insight => (
                  <li key={insight.id} className="flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm leading-relaxed text-[#E1E3F0]">
                    {insight.tone === 'up' ? <TrendingUp size={16} className="mt-0.5 shrink-0 text-[#79E8BD]" aria-hidden /> : <Lightbulb size={16} className="mt-0.5 shrink-0 text-[#E8C77B]" aria-hidden />}
                    {t(insight.text)}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {hasHistory && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title={en ? 'Progress over time' : '시간에 따른 변화'} subtitle={view.series.granularity === 'day' ? (en ? 'Daily completion rate' : '일별 완료율') : (en ? 'Weekly completion rate' : '주별 완료율')}>
            <TrendChart series={view.series} />
          </Section>
          <Section title={en ? 'Consistency' : '꾸준함 지도'} subtitle={en ? 'Each square is a day. Brighter means more of that day’s habits were done.' : '한 칸이 하루예요. 밝을수록 그날 해야 할 습관을 많이 했어요.'}>
            <ConsistencyHeatmap weeks={view.heatmap} />
          </Section>
        </div>
      )}

      {hasHistory && (
        <Section title={en ? 'Habit by habit' : '습관별 기록'} subtitle={t(COMPARE_LABEL[period])}>
          <HabitPerformanceList habits={view.habits} />
        </Section>
      )}

      <Section id="shields" title={en ? 'Shield collection' : '쉴드 컬렉션'} subtitle={en ? 'Achievements earned from real habit records.' : '실제 습관 기록으로 얻은 업적이에요.'}>
        <ShieldCollection memberId={member.id} />
      </Section>

      <Section title={en ? 'Personal journey' : '나의 발자취'} subtitle={en ? 'Moments taken from your records.' : '기록에서 찾은 순간들이에요.'}>
        <PersonalJourney events={journey} />
      </Section>

      <p className="px-1 pb-4 text-[11px] leading-relaxed text-[#7F86A8]">
        {en
          ? `Rates use each habit's scheduled times that have already ended, in ${timezone}. Days with nothing scheduled are rest days and never count against you. Completions on days no longer scheduled still count.`
          : `완료율은 이미 지난 예정 시간만 계산해요 (${timezone} 기준). 예정된 습관이 없는 날은 쉬는 날로 빠지고, 일정이 바뀌어도 이전에 완료한 기록은 그대로 인정돼요.`}
      </p>
    </div>
  );
}
