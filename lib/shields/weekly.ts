// Weekly Shields (pure mirror of finalize_shield_week).
//
// EARN LAST WEEK. EQUIP THIS WEEK. Each member can earn one Shield of each
// kind per week (Mon–Sun, family time):
//
//   Morning  required morning slots completed     → boosts morning required tasks
//   Evening  required evening slots completed     → boosts evening required tasks
//   Bonus    days with a bonus-task completion,   → boosts bonus tasks
//            only when ≥70% of required slots were done
//
// The scopes never overlap, so one completion gets at most one Shield's rate.
// The database evaluates and awards; this module only shows progress, and a
// test keeps these numbers equal to shield_config.rules.

import {
  completedSlotKeys,
  periodContaining,
  zonedDayHour,
  type DailySchedule,
  type Period,
  type ShieldCompletion,
  type ShieldTier,
  type ShieldType,
  type Slot,
} from './engine';

export const WEEKLY_RULES = {
  minCoveredDays: 6,
  window: { minSlots: 5, minDays: 3, silver: 70, gold: 85, epic: 95, legendary: 100 },
  bonus: { silver: 3, gold: 4, epic: 5, legendary: 7, minRequiredRate: 70 },
} as const;

/** Basis points: 100 bp = 1%. Mirrors shield_config.rules.rateBp. */
export const RATE_BP: Record<ShieldTier, number> = { silver: 200, gold: 500, epic: 1000, legendary: 1500 };
export const CAP_BP = 1500;
export const SLOT_OF: Record<ShieldType, 1 | 2 | 3> = { morning: 1, evening: 2, bonus: 3 };

export type BonusScope = { kind: 'window'; window: Slot } | { kind: 'bonus' };

const ORDER: ShieldTier[] = ['legendary', 'epic', 'gold', 'silver'];

/** Highest tier whose threshold `value` meets (shield_tier_for). */
export function tierFor(value: number | null, thresholds: Record<ShieldTier, number>): ShieldTier | null {
  if (value === null) return null;
  return ORDER.find(tier => value >= thresholds[tier]) ?? null;
}

export interface WindowProgress {
  type: 'morning' | 'evening';
  completed: number;
  eligible: number;
  days: number;
  /** One decimal, like the database. */
  rate: number | null;
  tier: ShieldTier | null;
  /** Next tier up and how many more completed slots reach it at the current
   *  number of slots; null at Legendary or when out of reach. */
  next: { tier: ShieldTier; needed: number } | null;
}

export interface BonusProgress {
  type: 'bonus';
  bonusDays: number;
  requiredRate: number | null;
  /** Required routine below 70%: no Bonus Shield however many bonus days. */
  gated: boolean;
  tier: ShieldTier | null;
  next: { tier: ShieldTier; needed: number } | null;
}

export interface WeekProgress {
  week: Period;
  coveredDays: number;
  morning: WindowProgress;
  evening: WindowProgress;
  bonus: BonusProgress;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function nextWindowTier(tier: ShieldTier | null, completed: number, eligible: number): WindowProgress['next'] {
  const up = tier === null ? 'silver' : tier === 'silver' ? 'gold' : tier === 'gold' ? 'epic' : tier === 'epic' ? 'legendary' : null;
  if (!up || eligible === 0) return null;
  const needed = Math.ceil((WEEKLY_RULES.window[up] * eligible) / 100) - completed;
  return needed > 0 && needed <= eligible - completed ? { tier: up, needed } : null;
}

/**
 * A member's week. Without `today`, the week is treated as finished (the
 * database's finalization). With `today`/`nowHour`, today's still-open
 * windows are left out, so live progress is never shown as a miss.
 */
export function weekProgress(params: {
  userId: string;
  weekStart: string;
  schedules: DailySchedule[];
  completions: ShieldCompletion[];
  /** Tasks that are bonus (optional) tasks now. */
  bonusTaskIds: ReadonlySet<string>;
  timezone: string;
  today?: string;
  nowHour?: number;
}): WeekProgress {
  const week = periodContaining('week', params.weekStart);
  const mine = params.schedules.filter(s => s.userId === params.userId && s.day >= week.start && s.day <= week.end
    && (!params.today || s.day <= params.today));
  const done = completedSlotKeys(params.userId, params.completions, mine, params.timezone);

  const tallies = { morning: { completed: 0, eligible: 0, days: new Set<string>() }, evening: { completed: 0, eligible: 0, days: new Set<string>() } };
  for (const s of mine) {
    for (const slot of s.slots) {
      const completed = done.has(`${slot.taskId}|${s.day}|${slot.window}`);
      const open = params.today === s.day && !completed && (slot.window === 'evening' || (params.nowHour ?? 0) < 12);
      if (open) continue;
      const t = tallies[slot.window];
      t.eligible += 1;
      if (completed) t.completed += 1;
      t.days.add(s.day);
    }
  }

  const windowProgress = (type: 'morning' | 'evening'): WindowProgress => {
    const t = tallies[type];
    const enough = t.eligible >= WEEKLY_RULES.window.minSlots && t.days.size >= WEEKLY_RULES.window.minDays;
    const tier = enough ? tierFor((t.completed * 100) / t.eligible, WEEKLY_RULES.window) : null;
    return {
      type,
      completed: t.completed,
      eligible: t.eligible,
      days: t.days.size,
      rate: t.eligible > 0 ? round1((t.completed * 100) / t.eligible) : null,
      tier,
      next: nextWindowTier(tier, t.completed, t.eligible),
    };
  };

  // Bonus days: a bonus-task completion on a snapshot day where that task
  // was not a required slot.
  const snapshotByDay = new Map(mine.map(s => [s.day, new Set(s.slots.map(slot => slot.taskId))]));
  const bonusDays = new Set<string>();
  for (const c of params.completions) {
    if (c.userId !== params.userId || !params.bonusTaskIds.has(c.taskId)) continue;
    const at = Date.parse(c.completedAt);
    if (!Number.isFinite(at)) continue;
    const { day } = zonedDayHour(new Date(at), params.timezone);
    const required = snapshotByDay.get(day);
    if (!required || required.has(c.taskId)) continue;
    bonusDays.add(day);
  }
  const reqDone = tallies.morning.completed + tallies.evening.completed;
  const reqAll = tallies.morning.eligible + tallies.evening.eligible;
  const requiredRate = reqAll > 0 ? round1((reqDone * 100) / reqAll) : null;
  const gated = (requiredRate ?? 0) < WEEKLY_RULES.bonus.minRequiredRate;
  const bonusTier = gated ? null : tierFor(bonusDays.size, WEEKLY_RULES.bonus);
  const bonusUp = bonusTier === null ? 'silver' : bonusTier === 'silver' ? 'gold' : bonusTier === 'gold' ? 'epic' : bonusTier === 'epic' ? 'legendary' : null;

  return {
    week,
    coveredDays: mine.length,
    morning: windowProgress('morning'),
    evening: windowProgress('evening'),
    bonus: {
      type: 'bonus',
      bonusDays: bonusDays.size,
      requiredRate,
      gated,
      tier: bonusTier,
      next: bonusUp ? { tier: bonusUp, needed: WEEKLY_RULES.bonus[bonusUp] - bonusDays.size } : null,
    },
  };
}

/** Whether an equipped Shield boosts a completion (shield_bonus_quote). */
export function scopeApplies(scope: BonusScope, completion: { optional: boolean; window: Slot }): boolean {
  return scope.kind === 'bonus' ? completion.optional : !completion.optional && scope.window === completion.window;
}

/** floor(base × rate), integer math like the database. */
export function bonusPoints(basePoints: number, rateBp: number): number {
  return Math.floor((Math.max(0, basePoints) * Math.min(rateBp, CAP_BP)) / 10000);
}

export const formatBp = (bp: number) => `${bp % 100 === 0 ? bp / 100 : (bp / 100).toFixed(1)}%`;
