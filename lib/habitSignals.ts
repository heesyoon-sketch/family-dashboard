// Per-habit signals for the task card: a small flame when a habit is on a
// roll, a gentle sprout when a required habit keeps getting missed.
//
// Only scheduled days count (a Wed/Thu habit isn't "missed" on Monday), days
// before the habit existed are ignored, and today never counts as a miss
// while it is still open. Purely visual — no points.

import type { DayOfWeek } from './db';

export type HabitSignalState = 'blazing' | 'hot' | 'cold';

export interface HabitSignal {
  /** Scheduled days in a row completed, most recent first. */
  streak: number;
  /** Misses among the last five scheduled days. */
  recentMisses: number;
  state: HabitSignalState | null;
}

export const HABIT_SIGNAL_RULES = {
  lookbackDays: 14,
  hotStreak: 5,
  blazingStreak: 14,
  recentWindow: 5,
  coldMisses: 3,
} as const;

const DOW: DayOfWeek[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function shift(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d + n);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function weekday(day: string): DayOfWeek {
  const [y, m, d] = day.split('-').map(Number);
  return DOW[new Date(y, m - 1, d).getDay()];
}

export function habitSignal(params: {
  daysOfWeek: readonly DayOfWeek[];
  /** Bonus tasks can glow but are never "missed". */
  optional: boolean;
  /** Local YYYY-MM-DD the habit was created, if known. */
  createdDay?: string | null;
  /** Local YYYY-MM-DD days with at least one completion. */
  doneDays: ReadonlySet<string>;
  today: string;
  /** The server's running streak for a daily habit, counted beyond the
   *  lookback window. Trusted only when it was extended today or yesterday. */
  serverStreak?: number;
  lastCompletedDay?: string | null;
}): HabitSignal {
  const R = HABIT_SIGNAL_RULES;
  const outcomes: boolean[] = [];
  for (let i = 0; i < R.lookbackDays; i++) {
    const day = shift(params.today, -i);
    if (params.createdDay && day < params.createdDay) break;
    if (!params.daysOfWeek.includes(weekday(day))) continue;
    const done = params.doneDays.has(day);
    if (day === params.today && !done) continue; // still open
    outcomes.push(done);
  }
  let streak = 0;
  while (streak < outcomes.length && outcomes[streak]) streak++;
  // A daily habit unbroken across the whole lookback can be longer than it.
  const daily = params.daysOfWeek.length === 7;
  const recent = params.lastCompletedDay === params.today || params.lastCompletedDay === shift(params.today, -1);
  if (daily && recent && streak === outcomes.length && (params.serverStreak ?? 0) > streak) streak = params.serverStreak!;
  const recentMisses = outcomes.slice(0, R.recentWindow).filter(done => !done).length;
  const state: HabitSignalState | null = streak >= R.blazingStreak ? 'blazing'
    : streak >= R.hotStreak ? 'hot'
      : !params.optional && recentMisses >= R.coldMisses ? 'cold'
        : null;
  return { streak, recentMisses, state };
}
