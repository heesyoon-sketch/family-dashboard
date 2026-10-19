// Live, never-awarding view of the ongoing period. Past days and today come
// from schedule snapshots; remaining days use the current schedule, because
// they have not been snapshotted yet. Nothing here is written anywhere.

import type { AnalyticsTask } from '@/lib/analytics/history';
import { isOptionalTask } from '@/lib/taskType';
import {
  addDays,
  completedSlotKeys,
  eachDay,
  evaluateShieldCandidates,
  previousPeriod,
  projectConsistency,
  selectWinningShield,
  tallyPeriod,
  weekdayOf,
  type ConsistencyProjection,
  type DailySchedule,
  type MissionWeekResult,
  type PastAward,
  type Period,
  type PeriodTally,
  type ShieldCandidate,
  type ShieldCompletion,
} from './engine';

export interface LiveProgress {
  period: Period;
  /** Period started on/after the first snapshot → its result will be official. */
  official: boolean;
  soFar: PeriodTally;
  remaining: number;
  remainingDays: number;
  consistency: ConsistencyProjection;
  /** Best candidate at the current pace (not a guarantee). */
  leading: ShieldCandidate | null;
  candidates: ShieldCandidate[];
}

export function liveProgress(params: {
  userId: string;
  period: Period;
  today: string;
  nowHour: number;
  firstSnapshotDay: string | null;
  schedules: DailySchedule[];
  completions: ShieldCompletion[];
  tasks: AnalyticsTask[];
  missions: MissionWeekResult[];
  pastAwards: PastAward[];
  timezone: string;
}): LiveProgress {
  const { userId, period, today, nowHour, schedules } = params;
  const done = completedSlotKeys(userId, params.completions, schedules, params.timezone);
  const soFar = tallyPeriod(userId, period, schedules, done, { today, nowHour });

  // Remaining: today's still-open snapshot slots + future scheduled slots.
  let remaining = 0;
  let remainingDays = 0;
  const todaySnap = schedules.find(s => s.userId === userId && s.day === today);
  if (todaySnap && today >= period.start && today <= period.end) {
    const open = todaySnap.slots.filter(slot => !done.has(`${slot.taskId}|${today}|${slot.window}`) && (slot.window === 'evening' || nowHour < 12)).length;
    remaining += open;
    if (open > 0) remainingDays += 1;
  }
  const futureStart = addDays(today > period.start ? today : addDays(period.start, -1), 1);
  if (futureStart <= period.end) {
    const tasks = params.tasks.filter(t => t.userId === userId && t.active && !t.deletedAt && !isOptionalTask(t));
    for (const day of eachDay(futureStart, period.end)) {
      const count = tasks.filter(t => t.daysOfWeek.includes(weekdayOf(day))).reduce((n, t) => n + (t.timeWindow === 'both' ? 2 : 1), 0);
      remaining += count;
      if (count > 0) remainingDays += 1;
    }
  }

  const prev = previousPeriod(period);
  const candidates = evaluateShieldCandidates({
    userId,
    period,
    current: soFar,
    previous: tallyPeriod(userId, prev, schedules, done),
    beforePrevious: tallyPeriod(userId, previousPeriod(prev), schedules, done),
    missions: params.missions,
    pastAwards: params.pastAwards,
  });
  const consistency = projectConsistency(period.type, soFar, remaining, remainingDays);
  return {
    period,
    official: params.firstSnapshotDay !== null && period.start >= params.firstSnapshotDay,
    soFar,
    remaining,
    remainingDays,
    consistency,
    leading: consistency.eligibilityReachable ? selectWinningShield(candidates) : null,
    candidates,
  };
}
