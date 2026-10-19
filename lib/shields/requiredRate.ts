// This week's required-routine rate, computed exactly like weekly Shield
// evaluation: from the daily schedule snapshots (required tasks only), with
// today's still-open windows left out until they close.

import { completedSlotKeys, periodContaining, tallyPeriod, zonedDayHour, type DailySchedule, type ShieldCompletion } from './engine';

export interface RequiredRate {
  /** Monday of the week, family time. */
  weekStart: string;
  completed: number;
  eligible: number;
  /** null until at least one required slot has closed this week. */
  rate: number | null;
}

export function weeklyRequiredRate(params: {
  userId: string;
  schedules: DailySchedule[];
  completions: ShieldCompletion[];
  timezone: string;
  now: Date;
}): RequiredRate {
  const { day: today, hour } = zonedDayHour(params.now, params.timezone);
  const period = periodContaining('week', today);
  const done = completedSlotKeys(params.userId, params.completions, params.schedules, params.timezone);
  const tally = tallyPeriod(params.userId, period, params.schedules, done, { today, nowHour: hour });
  return {
    weekStart: period.start,
    completed: tally.completed,
    eligible: tally.eligible,
    rate: tally.eligible > 0 ? tally.completed / tally.eligible : null,
  };
}
