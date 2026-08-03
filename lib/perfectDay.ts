import type { PerfectDayCoupon, Task } from './db';
import {
  getCompletionWindowEnd,
  getCompletionWindowStart,
  isTaskActiveInTimeWindow,
  type TimeWindow,
} from './timeWindows';

export interface CompletionWindowRow {
  task_id: string;
  completed_at: string;
}

export interface WindowCompletions {
  morning: string[];
  evening: string[];
}

export interface PerfectDayClaimResult {
  awarded: boolean;
  coupon: PerfectDayCoupon | null;
}

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function splitCompletionsByWindow(
  tasks: Task[],
  completions: CompletionWindowRow[],
  dayStart: Date,
): WindowCompletions {
  const taskMap = new Map(tasks.map(task => [task.id, task]));
  const byWindow: Record<TimeWindow, Set<string>> = {
    morning: new Set<string>(),
    evening: new Set<string>(),
  };

  for (const completion of completions) {
    const task = taskMap.get(completion.task_id);
    if (!task) continue;
    const completedAt = new Date(completion.completed_at);
    if (Number.isNaN(completedAt.getTime())) continue;

    for (const window of ['morning', 'evening'] as const) {
      if (!isTaskActiveInTimeWindow(task.timeWindow, window)) continue;
      const start = getCompletionWindowStart(dayStart, task.timeWindow, window);
      const end = getCompletionWindowEnd(dayStart, task.timeWindow, window);
      if (completedAt >= start && completedAt < end) {
        byWindow[window].add(task.id);
      }
    }
  }

  return {
    morning: [...byWindow.morning],
    evening: [...byWindow.evening],
  };
}

export function isPerfectRoutineDay(
  tasks: Task[],
  completions: WindowCompletions,
): boolean {
  const morning = tasks.filter(task => isTaskActiveInTimeWindow(task.timeWindow, 'morning'));
  const evening = tasks.filter(task => isTaskActiveInTimeWindow(task.timeWindow, 'evening'));
  if (morning.length === 0 || evening.length === 0) return false;

  const morningDone = new Set(completions.morning);
  const eveningDone = new Set(completions.evening);
  return morning.every(task => morningDone.has(task.id))
    && evening.every(task => eveningDone.has(task.id));
}

export function mapPerfectDayCoupon(raw: Record<string, unknown>): PerfectDayCoupon {
  const redeemedFor = raw.redeemedFor ?? raw.redeemed_for;
  const redeemedAt = raw.redeemedAt ?? raw.redeemed_at;
  return {
    id: raw.id as string,
    familyId: (raw.familyId ?? raw.family_id) as string,
    userId: (raw.userId ?? raw.user_id) as string,
    earnedForDay: String(raw.earnedForDay ?? raw.earned_for_day),
    status: raw.status as PerfectDayCoupon['status'],
    redeemedFor: redeemedFor === 'game' || redeemedFor === 'media' ? redeemedFor : undefined,
    awardedAt: new Date((raw.awardedAt ?? raw.awarded_at) as string),
    redeemedAt: redeemedAt ? new Date(redeemedAt as string) : undefined,
  };
}
