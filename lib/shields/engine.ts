// Shield primitives (pure): family-local calendar, schedule snapshots, and
// exact tallies. Weekly Shield rules live in ./weekly.ts; the authoritative
// weekly evaluation runs in Postgres (finalize_shield_week) on these same
// definitions.
//
// Inputs are normalized records (no React, no Supabase), so every rule is
// deterministic and unit-testable. All rate comparisons use integer cross-
// multiplication — no floating-point boundary errors.
//
// Occurrence definitions
// ----------------------
// Eligible occurrence  One slot in a member's daily schedule snapshot
//                      (shield_daily_schedules). Snapshots are captured after
//                      local midnight and never change, so later habit edits,
//                      deletions, or schedule changes cannot move the
//                      denominator. Bonus (optional) tasks are never in a
//                      snapshot. Habits added mid-day are not counted that day.
// Completed occurrence A snapshot slot with at least one completion of that
//                      habit on that family-local day (and, for habits with
//                      both a morning and an evening slot, in that window:
//                      before 12:00 = morning). Duplicates collapse.
// Day without snapshot Not evaluated. It counts toward neither side.

import type { DayOfWeek } from '@/lib/db';
import { categorizeTask, type HabitCategory } from '@/lib/achievements/definitions';

export type PeriodType = 'week' | 'month';
/** One Shield per routine window plus one for bonus tasks. */
export type ShieldType = 'morning' | 'evening' | 'bonus';
export type ShieldTier = 'silver' | 'gold' | 'epic' | 'legendary';
export type Slot = 'morning' | 'evening';

export const SHIELD_TYPES: ShieldType[] = ['morning', 'evening', 'bonus'];
export const TIERS: ShieldTier[] = ['silver', 'gold', 'epic', 'legendary'];
export const TIER_RANK: Record<ShieldTier, number> = { silver: 1, gold: 2, epic: 3, legendary: 4 };

// ---------------------------------------------------------------------------
// Calendar (family-local dates as YYYY-MM-DD)
// ---------------------------------------------------------------------------

const noon = (day: string) => new Date(`${day}T12:00:00Z`);
export function addDays(day: string, n: number): string {
  const d = noon(day); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
export function daysBetween(from: string, to: string): number {
  return Math.round((noon(to).getTime() - noon(from).getTime()) / 86_400_000);
}
export function eachDay(from: string, to: string): string[] {
  const out: string[] = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out;
}
const DOW: DayOfWeek[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export function weekdayOf(day: string): DayOfWeek { return DOW[noon(day).getUTCDay()]; }

export interface Period { type: PeriodType; start: string; end: string }

export function periodContaining(type: PeriodType, day: string): Period {
  if (type === 'week') {
    const start = addDays(day, -((noon(day).getUTCDay() + 6) % 7));
    return { type, start, end: addDays(start, 6) };
  }
  const [y, m] = day.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); // handles leap years
  return { type, start, end: `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}` };
}
export function previousPeriod(p: Period): Period { return periodContaining(p.type, addDays(p.start, -1)); }
export function nextPeriod(p: Period): Period { return periodContaining(p.type, addDays(p.end, 1)); }

const dayHourFormatters = new Map<string, Intl.DateTimeFormat>();
export function zonedDayHour(at: Date, timezone: string): { day: string; hour: number } {
  let f = dayHourFormatters.get(timezone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
    dayHourFormatters.set(timezone, f);
  }
  const p = Object.fromEntries(f.formatToParts(at).map(x => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24 };
}

// ---------------------------------------------------------------------------
// Normalized inputs
// ---------------------------------------------------------------------------

export interface SnapshotSlot { taskId: string; title: string; icon: string; window: Slot }
export interface DailySchedule { userId: string; day: string; slots: SnapshotSlot[] }
export interface ShieldCompletion { id: string; userId: string; taskId: string; completedAt: string }

// ---------------------------------------------------------------------------
// Tallies
// ---------------------------------------------------------------------------

export interface Tally {
  eligible: number;
  completed: number;
  /** Distinct days with at least one eligible occurrence. */
  days: number;
  /** Days of the period that have a snapshot. */
  coveredDays: number;
  periodDays: number;
}

export interface PeriodTally extends Tally {
  byCategory: Partial<Record<HabitCategory, Tally>>;
}

const emptyTally = (periodDays = 0): Tally => ({ eligible: 0, completed: 0, days: 0, coveredDays: 0, periodDays });

/** Categories using the existing achievement taxonomy, without the
 *  "responsibility" fallback categorizeTask applies to unmatched habits —
 *  only genuinely mapped habits count toward Dedication. */
export function strictCategories(slot: Pick<SnapshotSlot, 'title' | 'icon' | 'window'>): HabitCategory[] {
  const cats = categorizeTask({ title: slot.title, icon: slot.icon, timeWindow: slot.window });
  const genuine = categorizeTask({ title: slot.title, icon: slot.icon, timeWindow: undefined });
  const fallbackOnly = genuine.length === 1 && genuine[0] === 'responsibility'
    && !/clean|cleanup|laundry|room|toy|bed|pajama|정리|빨래|장난감|침구|잠옷/i.test(`${slot.title} ${slot.icon}`);
  return cats.filter(c => !(fallbackOnly && c === 'responsibility'));
}

/** Completed slot keys for a member: `${taskId}|${day}|${window}`. */
export function completedSlotKeys(
  userId: string,
  completions: ShieldCompletion[],
  schedules: DailySchedule[],
  timezone: string,
): Set<string> {
  const slotsByTaskDay = new Map<string, Slot[]>();
  for (const s of schedules) {
    if (s.userId !== userId) continue;
    for (const slot of s.slots) {
      const key = `${slot.taskId}|${s.day}`;
      slotsByTaskDay.set(key, [...(slotsByTaskDay.get(key) ?? []), slot.window]);
    }
  }
  const out = new Set<string>();
  for (const c of completions) {
    if (c.userId !== userId) continue;
    const at = Date.parse(c.completedAt);
    if (!Number.isFinite(at)) continue;
    const { day, hour } = zonedDayHour(new Date(at), timezone);
    const windows = slotsByTaskDay.get(`${c.taskId}|${day}`);
    if (!windows) continue; // not scheduled in the snapshot → never counts
    const window: Slot = windows.length === 1 ? windows[0] : hour < 12 ? 'morning' : 'evening';
    out.add(`${c.taskId}|${day}|${window}`);
  }
  return out;
}

export interface TallyOptions {
  /** For live progress: today's family-local date and hour. Open windows on
   *  `today` are not counted as missed. Omit for finalized periods. */
  today?: string;
  nowHour?: number;
}

export function tallyPeriod(
  userId: string,
  period: Period,
  schedules: DailySchedule[],
  done: Set<string>,
  options: TallyOptions = {},
): PeriodTally {
  const periodDays = daysBetween(period.start, period.end) + 1;
  const total: Tally = emptyTally(periodDays);
  const byCategory: Partial<Record<HabitCategory, Tally>> = {};
  const catDays = new Map<HabitCategory, Set<string>>();
  for (const s of schedules) {
    if (s.userId !== userId || s.day < period.start || s.day > period.end) continue;
    if (options.today && s.day > options.today) continue;
    total.coveredDays += 1;
    let dayHasEligible = false;
    const dayCats = new Set<HabitCategory>();
    for (const slot of s.slots) {
      const completed = done.has(`${slot.taskId}|${s.day}|${slot.window}`);
      const open = options.today === s.day && !completed
        && (slot.window === 'evening' || (options.nowHour ?? 0) < 12);
      if (open) continue;
      total.eligible += 1;
      if (completed) total.completed += 1;
      dayHasEligible = true;
      for (const cat of strictCategories(slot)) {
        const t = (byCategory[cat] ??= emptyTally(periodDays));
        t.eligible += 1;
        if (completed) t.completed += 1;
        dayCats.add(cat);
      }
    }
    if (dayHasEligible) total.days += 1;
    for (const cat of dayCats) {
      const set = catDays.get(cat) ?? new Set<string>();
      set.add(s.day);
      catDays.set(cat, set);
    }
  }
  for (const [cat, set] of catDays) byCategory[cat]!.days = set.size;
  return { ...total, byCategory };
}

// ---------------------------------------------------------------------------
// Exact rate helpers
// ---------------------------------------------------------------------------

/** completed / eligible ≥ pct% */
export function rateAtLeast(t: Pick<Tally, 'completed' | 'eligible'>, pct: number): boolean {
  return t.eligible > 0 && t.completed * 100 >= pct * t.eligible;
}
/** Rounded display values (never used for classification). */
export function ratePct(t: Pick<Tally, 'completed' | 'eligible'>): number | null {
  return t.eligible > 0 ? Math.round((t.completed / t.eligible) * 1000) / 10 : null;
}
