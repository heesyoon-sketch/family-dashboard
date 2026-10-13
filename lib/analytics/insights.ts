// Rules-based growth insights and personal journey events. Every sentence is
// computed from MemberHistory — no causation, predictions, or external AI.

import {
  addDays,
  comparePeriod,
  eachDay,
  habitPerformance,
  mondayOf,
  rateOf,
  summarizeRange,
  weekdayOf,
  type AnalyticsTask,
  type MemberHistory,
  type PeriodRange,
} from './history';
import type { DayOfWeek } from '@/lib/db';

export type Localized = { en: string; ko: string };

export interface Insight {
  id: string;
  /** Higher = more useful. */
  score: number;
  text: Localized;
  tone: 'up' | 'steady' | 'gentle';
}

/** Korean particle by final consonant: josa('독서', '을', '를') → '독서를'. */
export function josa(word: string, withBatchim: string, without: string): string {
  const last = word.replace(/[^가-힣A-Za-z0-9]+$/, '').slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return `${word}${withBatchim}(${without})`;
  return `${word}${code % 28 ? withBatchim : without}`;
}

const pct = (rate: number) => `${Math.round(rate * 100)}%`;
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const periodName = (period: PeriodRange): Localized => {
  switch (period.id) {
    case '7d': return { en: 'previous 7 days', ko: '직전 7일' };
    case '30d': return { en: 'previous 30 days', ko: '직전 30일' };
    case '90d': return { en: 'previous 90 days', ko: '직전 90일' };
    case 'year': return { en: 'same point last year', ko: '작년 같은 기간' };
    default: return { en: 'previous period', ko: '이전 기간' };
  }
};

const WEEKDAY: Record<DayOfWeek, Localized> = {
  MON: { en: 'Monday', ko: '월요일' }, TUE: { en: 'Tuesday', ko: '화요일' }, WED: { en: 'Wednesday', ko: '수요일' },
  THU: { en: 'Thursday', ko: '목요일' }, FRI: { en: 'Friday', ko: '금요일' }, SAT: { en: 'Saturday', ko: '토요일' }, SUN: { en: 'Sunday', ko: '일요일' },
};

export function growthInsights(history: MemberHistory, tasks: AnalyticsTask[], period: PeriodRange, limit = 3): Insight[] {
  const candidates: Insight[] = [];
  const overall = comparePeriod(history, period);
  const name = periodName(period);

  if (overall.comparable && overall.pointChange !== null && Math.abs(overall.pointChange) >= 5) {
    const up = overall.pointChange > 0;
    candidates.push({
      id: 'period-change',
      score: 60 + Math.abs(overall.pointChange),
      tone: up ? 'up' : 'gentle',
      text: up
        ? { en: `Your completion rate is ${overall.pointChange} percentage points higher than the ${name.en}.`, ko: `완료율이 ${name.ko}보다 ${overall.pointChange}%p 올랐어요.` }
        : { en: `Your completion rate is ${-overall.pointChange} percentage points below the ${name.en}.`, ko: `완료율이 ${name.ko}보다 ${-overall.pointChange}%p 낮아요. 한 걸음씩 다시 쌓으면 돼요.` },
    });
  }

  // Recovery after a slower week: the last 7 days vs the 7 before.
  const last7 = summarizeRange(history, addDays(history.today, -6), history.today);
  const prior7 = summarizeRange(history, addDays(history.today, -13), addDays(history.today, -7));
  if (last7.rate !== null && prior7.rate !== null && last7.eligible >= 5 && prior7.eligible >= 5
      && prior7.rate < 0.6 && last7.rate - prior7.rate >= 0.15) {
    candidates.push({
      id: 'recovery',
      score: 75,
      tone: 'up',
      text: { en: `Your consistency is picking up after a slower week (${pct(prior7.rate)} → ${pct(last7.rate)}).`, ko: `조금 느렸던 주가 지나고 다시 꾸준해지고 있어요 (${pct(prior7.rate)} → ${pct(last7.rate)}).` },
    });
  }

  const habits = habitPerformance(history, tasks, period);
  const improving = habits.filter(h => h.pointChange !== null && h.pointChange >= 15).sort((a, b) => (b.pointChange ?? 0) - (a.pointChange ?? 0))[0];
  if (improving && improving.previous && improving.current.rate !== null && improving.previous.rate !== null) {
    candidates.push({
      id: 'habit-improving',
      score: 55 + (improving.pointChange ?? 0) / 2,
      tone: 'up',
      text: {
        en: `“${improving.task.title}” rose from ${pct(improving.previous.rate)} to ${pct(improving.current.rate)} (${signed(improving.pointChange!)} percentage points).`,
        ko: `${josa(`‘${improving.task.title}’`, '이', '가')} ${pct(improving.previous.rate)}에서 ${pct(improving.current.rate)}로 올랐어요 (${signed(improving.pointChange!)}%p).`,
      },
    });
  }

  // A recent run on one habit: X of the last N eligible occurrences.
  // Prefer a habit that is not already labelled strong, so the insight adds
  // information the habit list doesn't show.
  const run = habits
    .filter(h => h.recentOutcomes.length >= 5)
    .map(h => ({ h, done: h.recentOutcomes.filter(Boolean).length, n: h.recentOutcomes.length }))
    .filter(r => r.done / r.n >= 0.8)
    .sort((a, b) => Number(a.h.group === 'strong') - Number(b.h.group === 'strong') || b.done / b.n - a.done / a.n)[0];
  if (run) {
    candidates.push({
      id: 'habit-run',
      score: 50 + (run.done / run.n) * 10,
      tone: 'steady',
      text: { en: `You completed ${run.done} of your last ${run.n} scheduled “${run.h.task.title}” sessions.`, ko: `${josa(`‘${run.h.task.title}’`, '을', '를')} 최근 ${run.n}번 중 ${run.done}번 해냈어요.` },
    });
  }

  // Strongest weekday, only when the spread is meaningful.
  const byWeekday = new Map<DayOfWeek, { eligible: number; completed: number; days: number }>();
  for (const day of eachDay(period.from, period.to)) {
    const record = history.days.get(day);
    if (!record || record.eligible === 0) continue;
    const key = weekdayOf(day);
    const agg = byWeekday.get(key) ?? { eligible: 0, completed: 0, days: 0 };
    agg.eligible += record.eligible; agg.completed += record.completed; agg.days += 1;
    byWeekday.set(key, agg);
  }
  const weekdayRates = [...byWeekday.entries()].filter(([, a]) => a.days >= 3).map(([day, a]) => ({ day, rate: a.completed / a.eligible }));
  if (weekdayRates.length >= 4) {
    weekdayRates.sort((a, b) => b.rate - a.rate);
    const best = weekdayRates[0];
    const worst = weekdayRates[weekdayRates.length - 1];
    if (best.rate - worst.rate >= 0.2) {
      candidates.push({
        id: 'best-weekday',
        score: 40,
        tone: 'steady',
        text: { en: `Your most consistent day is ${WEEKDAY[best.day].en} (${pct(best.rate)}).`, ko: `가장 꾸준한 요일은 ${WEEKDAY[best.day].ko}이에요 (${pct(best.rate)}).` },
      });
    }
  }

  // Morning vs evening, when both have enough evidence.
  let morning = { eligible: 0, completed: 0 };
  let evening = { eligible: 0, completed: 0 };
  for (const day of eachDay(period.from, period.to)) {
    const record = history.days.get(day);
    if (!record) continue;
    morning = { eligible: morning.eligible + record.bySlot.morning.eligible, completed: morning.completed + record.bySlot.morning.completed };
    evening = { eligible: evening.eligible + record.bySlot.evening.eligible, completed: evening.completed + record.bySlot.evening.completed };
  }
  const mRate = rateOf(morning);
  const eRate = rateOf(evening);
  if (mRate !== null && eRate !== null && morning.eligible >= 10 && evening.eligible >= 10 && Math.abs(mRate - eRate) >= 0.2) {
    candidates.push({
      id: 'windows',
      score: 35,
      tone: 'steady',
      text: { en: `Morning habits: ${pct(mRate)} · Afternoon/evening habits: ${pct(eRate)}.`, ko: `오전 습관 ${pct(mRate)} · 오후·저녁 습관 ${pct(eRate)}.` },
    });
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Personal journey
// ---------------------------------------------------------------------------

export type JourneyKind = 'first' | 'full-week' | 'best-week' | 'comeback' | 'milestone' | 'shield';

export interface JourneyEvent {
  id: string;
  day: string;
  kind: JourneyKind;
  text: Localized;
  detail?: Localized;
}

export const COMPLETION_MILESTONES = [100, 250, 500, 1000, 2000, 5000];

export interface ShieldUnlock {
  id: string;
  title: Localized;
  rarity: string;
  unlockedAt: string;
  day: string;
}

export function journeyEvents(history: MemberHistory, tasks: AnalyticsTask[], shields: ShieldUnlock[]): JourneyEvent[] {
  const events: JourneyEvent[] = [];
  const titleOf = (taskId: string) => tasks.find(t => t.id === taskId)?.title ?? '';
  const slots = history.completedSlots;
  if (slots.length > 0) {
    const first = slots[0];
    const title = titleOf(first.taskId);
    events.push({ id: 'first', day: first.day, kind: 'first', text: { en: 'First completed habit', ko: '첫 번째 습관 완료' }, detail: title ? { en: title, ko: title } : undefined });
  }

  // Completion milestones (unique completed slots).
  COMPLETION_MILESTONES.forEach(n => {
    const slot = slots[n - 1];
    if (slot) events.push({ id: `milestone-${n}`, day: slot.day, kind: 'milestone', text: { en: `${n.toLocaleString('en')} habits completed`, ko: `누적 ${n.toLocaleString('ko')}번 완료` } });
  });

  if (history.firstDay) {
    // First week (Mon–Sun, already finished) with activity on all 7 days.
    // Best completed week: only the latest record, from week 2 on.
    let bestRate = -1;
    let weekIndex = 0;
    let fullWeekFound = false;
    let latestRecord: JourneyEvent | null = null;
    const lastFinishedWeek = addDays(mondayOf(history.today), -7);
    for (let week = mondayOf(history.firstDay); week <= lastFinishedWeek; week = addDays(week, 7), weekIndex++) {
      const summary = summarizeRange(history, week, addDays(week, 6));
      if (!fullWeekFound && summary.activeDays === 7) {
        fullWeekFound = true;
        events.push({ id: `full-week-${week}`, day: addDays(week, 6), kind: 'full-week', text: { en: 'First week with a habit every day', ko: '일주일 내내 습관을 실천한 첫 주' } });
      }
      if (summary.rate === null || summary.eligible < 10) continue;
      if (summary.rate > bestRate) {
        if (weekIndex > 0 && bestRate >= 0) {
          latestRecord = { id: 'best-week', day: addDays(week, 6), kind: 'best-week', text: { en: `New personal best week: ${pct(summary.rate)}`, ko: `주간 최고 기록 경신: ${pct(summary.rate)}` } };
        }
        bestRate = summary.rate;
      }
    }
    if (latestRecord) events.push(latestRecord);

    // Comebacks: a completion after 3+ scheduled days without one.
    let gap = 0;
    for (const day of eachDay(history.firstDay, history.today)) {
      const record = history.days.get(day);
      if (!record || record.eligible === 0) continue;
      if (record.completed === 0) { gap += 1; continue; }
      if (gap >= 3) events.push({ id: `comeback-${day}`, day, kind: 'comeback', text: { en: 'Came back after a pause', ko: '쉬었다가 다시 시작한 날' }, detail: { en: `${gap} quiet scheduled days before`, ko: `그전 ${gap}일은 쉬어 갔어요` } });
      gap = 0;
    }
  }

  for (const shield of shields) {
    events.push({ id: `shield-${shield.id}`, day: shield.day, kind: 'shield', text: { en: `Shield earned: ${shield.title.en}`, ko: `쉴드 획득: ${shield.title.ko}` } });
  }

  return events.sort((a, b) => b.day.localeCompare(a.day) || a.id.localeCompare(b.id));
}
