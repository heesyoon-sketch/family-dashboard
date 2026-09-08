import type { PerfectDayCoupon, PerfectQuestProgress, Task } from './db';
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
  coupons: PerfectDayCoupon[];
  quest: (PerfectQuestProgress & { couponsAwarded: 0 | 1 | 2 }) | null;
}

export function schoolWeekRewardCount(perfectWeekdays: number): 0 | 1 {
  return perfectWeekdays >= 3 ? 1 : 0;
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
    questDay: parseQuestDay(raw.questDay ?? raw.quest_day),
    chainLength: positiveInteger(raw.chainLength ?? raw.chain_length),
    rewardSlot: parseRewardSlot(raw.rewardSlot ?? raw.reward_slot),
  };
}

export function mapPerfectQuestProgress(raw: Record<string, unknown>): PerfectQuestProgress {
  const currentDay = Number(raw.currentDay ?? raw.current_day);
  const safeCurrentDay = currentDay === 1 || currentDay === 2 || currentDay === 3 ? currentDay : 0;
  return {
    userId: String(raw.userId ?? raw.user_id),
    currentDay: safeCurrentDay,
    currentStreak: nonNegativeInteger(raw.currentStreak ?? raw.current_streak),
    bestStreak: nonNegativeInteger(raw.bestStreak ?? raw.best_streak),
    completedQuests: nonNegativeInteger(raw.completedQuests ?? raw.completed_quests),
    lastPerfectDay: String(raw.lastPerfectDay ?? raw.last_perfect_day ?? '') || undefined,
    nextRewardCount: 1,
    weekPerfectDays: nonNegativeInteger(
      raw.weekPerfectDays ?? raw.week_perfect_days ?? raw.currentStreak ?? raw.current_streak,
    ),
    weekdayGoal: 3,
    weekdayTotal: 5,
    rewardEarnedThisWeek: Boolean(
      raw.rewardEarnedThisWeek ?? raw.reward_earned_this_week ?? safeCurrentDay === 3,
    ),
  };
}

function parseQuestDay(value: unknown): 1 | 2 | 3 | undefined {
  const day = Number(value);
  return day === 1 || day === 2 || day === 3 ? day : undefined;
}

function parseRewardSlot(value: unknown): 1 | 2 | undefined {
  const slot = Number(value);
  return slot === 1 || slot === 2 ? slot : undefined;
}

function positiveInteger(value: unknown): number | undefined {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function nonNegativeInteger(value: unknown): number {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}
