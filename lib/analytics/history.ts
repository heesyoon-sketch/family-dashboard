// FamBit analytics — the single source of truth for completion statistics.
//
// Stats and Shield Wall both read these functions, so the same records always
// produce the same numbers. Everything here is pure and deterministic.
//
// Definitions
// -----------
// Family day        A calendar date in the family's timezone (YYYY-MM-DD).
//                   Never the viewer's timezone.
// Slot              One chance to complete a habit. Morning-only and evening-
//                   only habits have one slot per scheduled day; habits that
//                   run in both windows have two (morning before 12:00,
//                   afternoon/evening after), matching the dashboard.
// Scheduled slot    The habit's current weekdays include that day, and the
//                   day lies inside the habit's lifetime (see below).
// Eligible slot     A scheduled slot whose window has already closed, or any
//                   slot that was actually completed. Open slots today are
//                   not counted yet, so unfinished habits are never failures
//                   before their time is up. Future days are never eligible.
// Completed slot    A slot with at least one completion record (duplicates
//                   collapse; partial completions count, as they do for
//                   points and momentum).
// Habit lifetime    From the earlier of the habit's `created_at` and its first
//                   completion, until the day before it was deleted (or, for a
//                   paused habit, its last completion). FamBit stores only a
//                   habit's current weekdays, so completions on days that are
//                   no longer scheduled still count as eligible + completed:
//                   editing a schedule never turns past effort into misses.
// Completion rate   completed ÷ eligible over a range. `null` when nothing
//                   was eligible — never 0%.
// Active day        A day with at least one completed slot.
// Excused / rest    FamBit has no per-habit excuse records. Days with nothing
//                   scheduled are rest days and are excluded from rates.
//                   Vacation mode pauses routine point penalties only; it
//                   does not change completion statistics.

import type { DayOfWeek } from '@/lib/db';
import { isOptionalTask, type TaskType } from '@/lib/taskType';

export type Slot = 'morning' | 'evening';
export type HabitWindow = Slot | 'both';

export interface AnalyticsMember {
  id: string;
  name: string;
  role: 'PARENT' | 'CHILD';
  /** ISO timestamp the member joined. */
  createdAt: string;
}

export interface AnalyticsTask {
  id: string;
  userId: string;
  title: string;
  icon: string;
  daysOfWeek: DayOfWeek[];
  timeWindow: HabitWindow;
  /** Optional (bonus) habits are never eligible slots. Missing = required. */
  taskType?: TaskType;
  active: boolean;
  createdAt: string | null;
  deletedAt: string | null;
  streakCount: number;
}

export interface AnalyticsCompletion {
  id: string;
  userId: string;
  taskId: string;
  completedAt: string;
  partial: boolean;
}

export interface Tally {
  eligible: number;
  completed: number;
}

export interface DayRecord extends Tally {
  day: string;
  /** Completed slots split by window, for morning/evening insights. */
  bySlot: Record<Slot, Tally>;
}

export interface MemberHistory {
  memberId: string;
  today: string;
  /** First day with an eligible slot or a completion; null for no history. */
  firstDay: string | null;
  days: Map<string, DayRecord>;
  /** Per-habit, per-day tallies. */
  byTask: Map<string, Map<string, Tally>>;
  /** Unique completed slots in chronological order. */
  completedSlots: Array<{ taskId: string; day: string; slot: Slot; at: string }>;
}

export const AFTERNOON_START_HOUR = 12;
const DOW_BY_UTC_INDEX: DayOfWeek[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// ---------------------------------------------------------------------------
// Calendar helpers (family timezone)
// ---------------------------------------------------------------------------

const partsFormatters = new Map<string, Intl.DateTimeFormat>();
function formatterFor(timezone: string): Intl.DateTimeFormat {
  let formatter = partsFormatters.get(timezone);
  if (!formatter) {
    try {
      formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
    } catch {
      formatter = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
    }
    partsFormatters.set(timezone, formatter);
  }
  return formatter;
}

/** Family-local calendar date and hour for an instant. */
export function zonedDayHour(date: Date, timezone: string): { day: string; hour: number } {
  const parts = Object.fromEntries(formatterFor(timezone).formatToParts(date).map(p => [p.type, p.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) % 24 };
}

export function dayKey(date: Date, timezone: string): string {
  return zonedDayHour(date, timezone).day;
}

function utcNoon(day: string): Date {
  return new Date(`${day}T12:00:00Z`);
}

export function addDays(day: string, amount: number): string {
  const d = utcNoon(day);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}

export function diffDays(from: string, to: string): number {
  return Math.round((utcNoon(to).getTime() - utcNoon(from).getTime()) / 86_400_000);
}

export function weekdayOf(day: string): DayOfWeek {
  return DOW_BY_UTC_INDEX[utcNoon(day).getUTCDay()];
}

/** Monday of the ISO week containing `day`. */
export function mondayOf(day: string): string {
  return addDays(day, -((utcNoon(day).getUTCDay() + 6) % 7));
}

export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function slotsFor(window: HabitWindow): Slot[] {
  return window === 'both' ? ['morning', 'evening'] : [window];
}

export function rateOf(t: Tally): number | null {
  return t.eligible > 0 ? Math.min(1, t.completed / t.eligible) : null;
}

/** Percentage points between two rates, rounded. */
export function pointChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  return Math.round(current * 100) - Math.round(previous * 100);
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export interface HistoryInput {
  member: AnalyticsMember;
  tasks: AnalyticsTask[];
  completions: AnalyticsCompletion[];
  now: Date;
  timezone: string;
}

/** Window of a completion: single-window habits always use their window;
 *  habits that run in both windows split at noon, like the dashboard. */
function slotForCompletion(task: AnalyticsTask, hour: number): Slot {
  if (task.timeWindow !== 'both') return task.timeWindow;
  return hour < AFTERNOON_START_HOUR ? 'morning' : 'evening';
}

function emptyDay(day: string): DayRecord {
  return { day, eligible: 0, completed: 0, bySlot: { morning: { eligible: 0, completed: 0 }, evening: { eligible: 0, completed: 0 } } };
}

export function buildMemberHistory({ member, tasks, completions, now, timezone }: HistoryInput): MemberHistory {
  const { day: today, hour: nowHour } = zonedDayHour(now, timezone);
  // Bonus habits have no eligible slots; dropping them here also drops their
  // completions, so they can never lift or lower a rate.
  const memberTasks = tasks.filter(task => task.userId === member.id && !isOptionalTask(task));
  const taskById = new Map(memberTasks.map(task => [task.id, task]));
  const joinDay = dayKey(new Date(member.createdAt), timezone);

  // Unique completed slots. Duplicate rows (retries, multi-device races)
  // collapse onto one slot so they can never inflate a rate.
  const seenIds = new Set<string>();
  const completedSlotKeys = new Set<string>();
  const completedSlots: MemberHistory['completedSlots'] = [];
  const firstCompletionDay = new Map<string, string>();
  const lastCompletionDay = new Map<string, string>();
  const sorted = completions
    .filter(c => c.userId === member.id && taskById.has(c.taskId) && Number.isFinite(Date.parse(c.completedAt)) && Date.parse(c.completedAt) <= now.getTime())
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt) || a.id.localeCompare(b.id));
  for (const completion of sorted) {
    if (seenIds.has(completion.id)) continue;
    seenIds.add(completion.id);
    const task = taskById.get(completion.taskId)!;
    const { day, hour } = zonedDayHour(new Date(completion.completedAt), timezone);
    const slot = slotForCompletion(task, hour);
    const key = `${task.id}|${day}|${slot}`;
    if (completedSlotKeys.has(key)) continue;
    completedSlotKeys.add(key);
    completedSlots.push({ taskId: task.id, day, slot, at: completion.completedAt });
    if (!firstCompletionDay.has(task.id)) firstCompletionDay.set(task.id, day);
    lastCompletionDay.set(task.id, day);
  }

  const days = new Map<string, DayRecord>();
  const byTask = new Map<string, Map<string, Tally>>();
  const count = (taskId: string, day: string, slot: Slot, completed: boolean) => {
    const record = days.get(day) ?? emptyDay(day);
    record.eligible += 1;
    record.bySlot[slot].eligible += 1;
    if (completed) {
      record.completed += 1;
      record.bySlot[slot].completed += 1;
    }
    days.set(day, record);
    const perTask = byTask.get(taskId) ?? new Map<string, Tally>();
    const tally = perTask.get(day) ?? { eligible: 0, completed: 0 };
    tally.eligible += 1;
    if (completed) tally.completed += 1;
    perTask.set(day, tally);
    byTask.set(taskId, perTask);
  };

  const countedKeys = new Set<string>();
  for (const task of memberTasks) {
    const firstDone = firstCompletionDay.get(task.id);
    const created = task.createdAt ? dayKey(new Date(task.createdAt), timezone) : null;
    let start = [created, firstDone].filter((d): d is string => Boolean(d)).sort()[0];
    if (!start) continue;
    // Without completion evidence, a habit cannot predate its member.
    if (!firstDone || start < firstDone) start = start < joinDay ? joinDay : start;
    let end = today;
    if (task.deletedAt) end = addDays(dayKey(new Date(task.deletedAt), timezone), -1);
    else if (!task.active) end = lastCompletionDay.get(task.id) ?? addDays(start, -1);
    if (end > today) end = today;

    for (let day = start; day <= end; day = addDays(day, 1)) {
      if (!task.daysOfWeek.includes(weekdayOf(day))) continue;
      for (const slot of slotsFor(task.timeWindow)) {
        const key = `${task.id}|${day}|${slot}`;
        const done = completedSlotKeys.has(key);
        // Today's open windows are not eligible until they close.
        if (day === today && !done && (slot === 'evening' || nowHour < AFTERNOON_START_HOUR)) continue;
        countedKeys.add(key);
        count(task.id, day, slot, done);
      }
    }
  }
  // Completions outside the current schedule are evidence the slot existed.
  for (const slot of completedSlots) {
    const key = `${slot.taskId}|${slot.day}|${slot.slot}`;
    if (!countedKeys.has(key)) count(slot.taskId, slot.day, slot.slot, true);
  }

  const firstDay = [...days.keys()].sort()[0] ?? null;
  return { memberId: member.id, today, firstDay, days, byTask, completedSlots };
}

// ---------------------------------------------------------------------------
// Ranges and periods
// ---------------------------------------------------------------------------

export interface RangeSummary extends Tally {
  from: string;
  to: string;
  rate: number | null;
  activeDays: number;
  scheduledDays: number;
  /** Days of the range on or after the member's first recorded day. */
  coveredDays: number;
}

export function summarizeRange(history: MemberHistory, from: string, to: string, taskId?: string): RangeSummary {
  let eligible = 0;
  let completed = 0;
  let activeDays = 0;
  let scheduledDays = 0;
  const source = taskId ? history.byTask.get(taskId) : history.days;
  if (source) {
    for (const [day, tally] of source) {
      if (day < from || day > to) continue;
      eligible += tally.eligible;
      completed += tally.completed;
      if (tally.eligible > 0) scheduledDays += 1;
      if (tally.completed > 0) activeDays += 1;
    }
  }
  const coverStart = history.firstDay && history.firstDay > from ? history.firstDay : from;
  const coveredDays = history.firstDay && coverStart <= to ? diffDays(coverStart, to) + 1 : 0;
  return { from, to, eligible, completed, rate: eligible > 0 ? Math.min(1, completed / eligible) : null, activeDays, scheduledDays, coveredDays };
}

export type PeriodId = '7d' | '30d' | '90d' | 'year' | 'all';
export const PERIODS: PeriodId[] = ['7d', '30d', '90d', 'year', 'all'];

export interface PeriodRange {
  id: PeriodId;
  from: string;
  to: string;
  previous: { from: string; to: string } | null;
  spanDays: number;
}

export function periodRange(id: PeriodId, today: string, firstDay: string | null): PeriodRange {
  const span = (n: number): PeriodRange => {
    const from = addDays(today, -(n - 1));
    return { id, from, to: today, previous: { from: addDays(from, -n), to: addDays(from, -1) }, spanDays: n };
  };
  if (id === '7d') return span(7);
  if (id === '30d') return span(30);
  if (id === '90d') return span(90);
  if (id === 'year') {
    const from = `${today.slice(0, 4)}-01-01`;
    const lastYear = String(Number(today.slice(0, 4)) - 1);
    // Feb 29 has no same date last year; compare against Feb 28.
    const sameDay = today.slice(5) === '02-29' ? '02-28' : today.slice(5);
    return { id, from, to: today, previous: { from: `${lastYear}-01-01`, to: `${lastYear}-${sameDay}` }, spanDays: diffDays(from, today) + 1 };
  }
  const from = firstDay ?? today;
  return { id, from, to: today, previous: null, spanDays: diffDays(from, today) + 1 };
}

/** Minimum evidence before we compare two periods. Below this the UI says
 *  "Not enough data" instead of showing a noisy trend. */
export const MIN_COMPARISON_ELIGIBLE = 5;

export interface PeriodComparison {
  current: RangeSummary;
  previous: RangeSummary | null;
  /** Percentage-point difference (e.g. 72% → 80% = +8). */
  pointChange: number | null;
  comparable: boolean;
}

export function comparePeriod(history: MemberHistory, period: PeriodRange, taskId?: string): PeriodComparison {
  const current = summarizeRange(history, period.from, period.to, taskId);
  if (!period.previous) return { current, previous: null, pointChange: null, comparable: false };
  const previous = summarizeRange(history, period.previous.from, period.previous.to, taskId);
  const previousSpan = diffDays(period.previous.from, period.previous.to) + 1;
  // The previous period must be at least half covered by real history and
  // hold enough eligible habits to mean something.
  const comparable = previous.eligible >= MIN_COMPARISON_ELIGIBLE
    && current.eligible >= MIN_COMPARISON_ELIGIBLE
    && previous.coveredDays * 2 >= previousSpan;
  return { current, previous, pointChange: comparable ? pointChange(current.rate, previous.rate) : null, comparable };
}

// ---------------------------------------------------------------------------
// Trend series and heatmap
// ---------------------------------------------------------------------------

export interface TrendPoint extends Tally {
  from: string;
  to: string;
  rate: number | null;
}

export interface TrendSeries {
  granularity: 'day' | 'week';
  points: TrendPoint[];
  /** Same-length series for the previous period (daily periods only). */
  previous: TrendPoint[] | null;
}

function bucket(history: MemberHistory, from: string, to: string): TrendPoint {
  const s = summarizeRange(history, from, to);
  return { from, to, eligible: s.eligible, completed: s.completed, rate: s.rate };
}

export function trendSeries(history: MemberHistory, period: PeriodRange): TrendSeries {
  if (period.spanDays <= 31) {
    const points = eachDay(period.from, period.to).map(day => bucket(history, day, day));
    const previous = period.previous
      ? eachDay(period.previous.from, period.previous.to).map(day => bucket(history, day, day))
      : null;
    const hasPrevious = previous?.some(p => p.eligible > 0) ?? false;
    return { granularity: 'day', points, previous: hasPrevious ? previous : null };
  }
  const points: TrendPoint[] = [];
  for (let week = mondayOf(period.from); week <= period.to; week = addDays(week, 7)) {
    const from = week < period.from ? period.from : week;
    const end = addDays(week, 6);
    points.push(bucket(history, from, end > period.to ? period.to : end));
  }
  return { granularity: 'week', points, previous: null };
}

export type HeatLevel = 'future' | 'rest' | 0 | 1 | 2 | 3 | 4;

export interface HeatCell extends Tally {
  day: string;
  rate: number | null;
  level: HeatLevel;
}

/** Calendar weeks (Mon–Sun columns) ending with the current week. */
export function heatmapWeeks(history: MemberHistory, weeks: number): HeatCell[][] {
  const start = addDays(mondayOf(history.today), -7 * (weeks - 1));
  const out: HeatCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const column: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const day = addDays(start, w * 7 + d);
      const record = history.days.get(day);
      const eligible = record?.eligible ?? 0;
      const completed = record?.completed ?? 0;
      const rate = eligible > 0 ? Math.min(1, completed / eligible) : null;
      let level: HeatLevel;
      if (day > history.today) level = 'future';
      else if (rate === null) level = 'rest';
      else if (rate === 0) level = 0;
      else if (rate < 0.5) level = 1;
      else if (rate < 0.8) level = 2;
      else if (rate < 1) level = 3;
      else level = 4;
      column.push({ day, eligible, completed, rate, level });
    }
    out.push(column);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Habit performance
// ---------------------------------------------------------------------------

export type HabitGroup = 'strong' | 'improving' | 'attention' | 'steady' | 'new';

/** Thresholds behind habit groups, shown to users in the UI legend. */
export const HABIT_RULES = {
  /** Fewer eligible slots than this in the period → "just getting started". */
  minEligible: 4,
  /** Rate at or above this → strong habit. */
  strongRate: 0.8,
  /** A change of at least this many percentage points vs the previous
   *  period → improving / needs attention. */
  trendPoints: 10,
  /** Below this rate with enough evidence → room to grow. */
  attentionRate: 0.5,
} as const;

export interface HabitPerformance {
  task: AnalyticsTask;
  current: RangeSummary;
  previous: RangeSummary | null;
  pointChange: number | null;
  group: HabitGroup;
  /** Weekly rates for the last 6 weeks, oldest first (null = not scheduled). */
  recentWeeks: Array<number | null>;
  /** Most recent eligible outcomes, newest last (true = completed). */
  recentOutcomes: boolean[];
}

export function habitPerformance(history: MemberHistory, tasks: AnalyticsTask[], period: PeriodRange): HabitPerformance[] {
  const out: HabitPerformance[] = [];
  for (const task of tasks) {
    if (task.userId !== history.memberId) continue;
    const comparison = comparePeriod(history, period, task.id);
    const current = comparison.current;
    if (current.eligible === 0) continue;
    const previous = comparison.previous && comparison.previous.eligible >= HABIT_RULES.minEligible ? comparison.previous : null;
    const change = previous ? pointChange(current.rate, previous.rate) : null;
    let group: HabitGroup;
    if (current.eligible < HABIT_RULES.minEligible) group = 'new';
    else if ((current.rate ?? 0) >= HABIT_RULES.strongRate) group = 'strong';
    else if (change !== null && change >= HABIT_RULES.trendPoints) group = 'improving';
    else if ((change !== null && change <= -HABIT_RULES.trendPoints) || (current.rate ?? 0) < HABIT_RULES.attentionRate) group = 'attention';
    else group = 'steady';

    const thisMonday = mondayOf(history.today);
    const recentWeeks = Array.from({ length: 6 }, (_, i) => {
      const from = addDays(thisMonday, -7 * (5 - i));
      return summarizeRange(history, from, addDays(from, 6), task.id).rate;
    });
    const perDay = history.byTask.get(task.id);
    const recentOutcomes: boolean[] = [];
    if (perDay) {
      const daysDesc = [...perDay.keys()].filter(d => d <= period.to).sort().reverse();
      for (const day of daysDesc) {
        const tally = perDay.get(day)!;
        for (let i = 0; i < tally.eligible && recentOutcomes.length < 10; i++) recentOutcomes.push(i < tally.completed);
        if (recentOutcomes.length >= 10) break;
      }
      recentOutcomes.reverse();
    }
    out.push({ task, current, previous, pointChange: change, group, recentWeeks, recentOutcomes });
  }
  const order: Record<HabitGroup, number> = { strong: 0, improving: 1, attention: 2, steady: 3, new: 4 };
  return out.sort((a, b) => order[a.group] - order[b.group] || (b.current.rate ?? 0) - (a.current.rate ?? 0) || a.task.title.localeCompare(b.task.title));
}

// ---------------------------------------------------------------------------
// Streaks
// ---------------------------------------------------------------------------

/** Consecutive scheduled days with at least one completion, ending today (or
 *  yesterday when today has no completion yet). Rest days neither break nor
 *  extend the run. */
export function activeDayRun(history: MemberHistory): number {
  let run = 0;
  let day = history.today;
  const todayRecord = history.days.get(day);
  if (!todayRecord || todayRecord.completed === 0) day = addDays(day, -1);
  for (let guard = 0; guard < 1000 && history.firstDay && day >= history.firstDay; guard++, day = addDays(day, -1)) {
    const record = history.days.get(day);
    if (!record || record.eligible === 0) continue;
    if (record.completed === 0) break;
    run += 1;
  }
  return run;
}

/** Longest such run across all history. */
export function longestActiveDayRun(history: MemberHistory): number {
  let best = 0;
  let run = 0;
  if (!history.firstDay) return 0;
  for (const day of eachDay(history.firstDay, history.today)) {
    const record = history.days.get(day);
    if (!record || record.eligible === 0) continue;
    run = record.completed > 0 ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}
