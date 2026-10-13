// Hall of Shields — pure evaluation engine.
//
// "You don't collect Shields. You earn them." A Shield is a periodic honor:
// at most one per member per completed week and per completed month. It is
// not a currency, grants no points or XP, and never expires.
//
// Inputs are normalized records (no React, no Supabase), so every rule is
// deterministic and unit-testable. All rate comparisons use integer cross-
// multiplication — no floating-point boundary errors.
//
// Occurrence definitions (official evaluation)
// --------------------------------------------
// Eligible occurrence  One slot in a member's daily schedule snapshot
//                      (shield_daily_schedules). Snapshots are captured after
//                      local midnight and never change, so later habit edits,
//                      deletions, or schedule changes cannot move the
//                      denominator. Habits added mid-day are not counted that
//                      day, so they cannot inflate a rate either.
// Completed occurrence A snapshot slot with at least one completion of that
//                      habit on that family-local day (and, for habits with
//                      both a morning and an evening slot, in that window:
//                      before 12:00 = morning). Duplicates collapse.
// Day without snapshot Not evaluated. It counts toward neither side.

import type { DayOfWeek } from '@/lib/db';
import { HABIT_CATEGORIES, categorizeTask, type HabitCategory } from '@/lib/achievements/definitions';

export const EVALUATION_VERSION = 'hall-v1';

export type PeriodType = 'week' | 'month';
export type ShieldType = 'consistency' | 'growth' | 'comeback' | 'teamwork' | 'dedication';
export type ShieldTier = 'silver' | 'gold' | 'epic' | 'legendary';
export type Slot = 'morning' | 'evening';

export const SHIELD_TYPES: ShieldType[] = ['consistency', 'growth', 'comeback', 'teamwork', 'dedication'];
export const TIERS: ShieldTier[] = ['silver', 'gold', 'epic', 'legendary'];
export const TIER_RANK: Record<ShieldTier, number> = { silver: 1, gold: 2, epic: 3, legendary: 4 };
/** Equal-tier tie-breaker: recognise change before maintenance. */
export const TYPE_PREFERENCE: ShieldType[] = ['comeback', 'growth', 'teamwork', 'dedication', 'consistency'];

// ---------------------------------------------------------------------------
// Rules (version hall-v1)
// ---------------------------------------------------------------------------

export const RULES = {
  week: {
    minOccurrences: 5,
    minDays: 3,
    consistency: { silver: 70, gold: 85, epic: 95, legendary: 100 },
    growth: { silver: 5, gold: 10, epic: 20, legendary: 30 },
    dedication: { minOccurrences: 4, minDays: 3 },
    comebackCooldownPeriods: 3,
    /** Snapshot days a period needs before it can be compared. */
    minCoveredDays: 6,
  },
  month: {
    minOccurrences: 20,
    minDays: 10,
    consistency: { silver: 75, gold: 85, epic: 95, legendary: 100 },
    growth: { silver: 5, gold: 10, epic: 15, legendary: 25 },
    dedication: { minOccurrences: 12, minDays: 8 },
    comebackCooldownPeriods: 2,
    minCoveredDays: 25,
  },
  growth: { silverMinRate: 60, legendaryMinRate: 80, maxWorkloadRatio: 2, dipPoints: 15 },
  comeback: {
    previousBelow: 70,
    tiers: [
      { tier: 'legendary' as const, minRate: 95, minGain: 35 },
      { tier: 'epic' as const, minRate: 90, minGain: 25 },
      { tier: 'gold' as const, minRate: 80, minGain: 20 },
      { tier: 'silver' as const, minRate: 70, minGain: 15 },
    ],
    /** "Positive activity before": the period before the dip, when known. */
    baselineMinRate: 50,
    /** Legendary needs at least this multiple of the minimum sample. */
    legendarySampleMultiple: 2,
  },
  dedication: { silver: 75, gold: 85, epic: 95, legendary: 100 },
} as const;

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
export interface MissionWeekResult {
  weekStart: string;
  missionId: string;
  status: 'active' | 'completed' | 'missed';
  /** Members whose part was met, from the finalized mission result. */
  metMemberIds: string[];
}
export interface PastAward { periodType: PeriodType; periodStart: string; shieldType: ShieldType }

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
/** rate(cur) − rate(prev) ≥ points (percentage points), exactly. */
export function gainAtLeast(cur: Pick<Tally, 'completed' | 'eligible'>, prev: Pick<Tally, 'completed' | 'eligible'>, points: number): boolean {
  if (cur.eligible === 0 || prev.eligible === 0) return false;
  return 100 * (cur.completed * prev.eligible - prev.completed * cur.eligible) >= points * cur.eligible * prev.eligible;
}
/** Rounded display values (never used for classification). */
export function ratePct(t: Pick<Tally, 'completed' | 'eligible'>): number | null {
  return t.eligible > 0 ? Math.round((t.completed / t.eligible) * 1000) / 10 : null;
}
export function gainPoints(cur: Pick<Tally, 'completed' | 'eligible'>, prev: Pick<Tally, 'completed' | 'eligible'>): number | null {
  const a = ratePct(cur); const b = ratePct(prev);
  return a === null || b === null ? null : Math.round((a - b) * 10) / 10;
}

function sufficient(t: Tally, type: PeriodType): boolean {
  return t.eligible >= RULES[type].minOccurrences && t.days >= RULES[type].minDays;
}

/** Comparisons need both periods observed almost entirely. */
function comparable(t: Tally, type: PeriodType): boolean {
  return sufficient(t, type) && t.coveredDays >= Math.min(RULES[type].minCoveredDays, t.periodDays);
}

function tierFromThresholds(t: Tally, thresholds: Record<ShieldTier, number>): ShieldTier | null {
  for (const tier of [...TIERS].reverse()) if (rateAtLeast(t, thresholds[tier])) return tier;
  return null;
}

// ---------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------

export type CandidateStatus = 'qualified' | 'not_qualified' | 'insufficient_data' | 'unavailable';

export interface ShieldCandidate {
  type: ShieldType;
  status: CandidateStatus;
  tier: ShieldTier | null;
  category: HabitCategory | null;
  /** Machine-readable reason code for UI copy. */
  reason: string;
  metrics: Record<string, number | string | boolean | null>;
}

export interface EvaluationInput {
  userId: string;
  period: Period;
  current: PeriodTally;
  previous: PeriodTally | null;
  /** The period before `previous`, for dip/baseline checks. */
  beforePrevious: PeriodTally | null;
  missions: MissionWeekResult[];
  pastAwards: PastAward[];
}

const tallyMetrics = (prefix: string, t: Tally) => ({
  [`${prefix}Eligible`]: t.eligible,
  [`${prefix}Completed`]: t.completed,
  [`${prefix}Rate`]: ratePct(t),
  [`${prefix}Days`]: t.days,
});

export function consistencyCandidate(input: EvaluationInput): ShieldCandidate {
  const { current, period } = input;
  const base = { type: 'consistency' as const, category: null, metrics: { ...tallyMetrics('current', current), coveredDays: current.coveredDays, periodDays: current.periodDays } };
  if (!sufficient(current, period.type)) return { ...base, status: 'insufficient_data', tier: null, reason: 'min_occurrences' };
  const tier = tierFromThresholds(current, RULES[period.type].consistency);
  return { ...base, status: tier ? 'qualified' : 'not_qualified', tier, reason: tier ? 'rate' : 'below_silver' };
}

export function growthCandidate(input: EvaluationInput): ShieldCandidate {
  const { current, previous, beforePrevious, period } = input;
  const base = { type: 'growth' as const, category: null };
  if (!previous || !comparable(current, period.type) || !comparable(previous, period.type)) {
    return { ...base, status: 'insufficient_data', tier: null, reason: 'no_comparable_previous', metrics: { ...tallyMetrics('current', current), ...(previous ? tallyMetrics('previous', previous) : {}) } };
  }
  const ratio = Math.max(current.eligible, previous.eligible) / Math.min(current.eligible, previous.eligible);
  // Anti-farming: if the previous period was itself a dip from the one before
  // it, measure growth from the higher baseline. Recovering from a dip is
  // what Comeback recognises.
  let baseline: Tally = previous;
  let baselineKind = 'previous';
  if (beforePrevious && comparable(beforePrevious, period.type) && gainAtLeast(beforePrevious, previous, RULES.growth.dipPoints)) {
    baseline = beforePrevious;
    baselineKind = 'before_dip';
  }
  const metrics = { ...tallyMetrics('current', current), ...tallyMetrics('previous', previous), baselineKind, baselineRate: ratePct(baseline), gainPoints: gainPoints(current, baseline), workloadRatio: Math.round(ratio * 100) / 100 };
  if (ratio > RULES.growth.maxWorkloadRatio) return { ...base, status: 'insufficient_data', tier: null, reason: 'workload_not_comparable', metrics };
  if (!rateAtLeast(current, RULES.growth.silverMinRate)) return { ...base, status: 'not_qualified', tier: null, reason: 'current_below_60', metrics };
  const thresholds = RULES[period.type].growth;
  let tier: ShieldTier | null = null;
  for (const t of [...TIERS].reverse()) {
    if (!gainAtLeast(current, baseline, thresholds[t])) continue;
    if (t === 'legendary' && !rateAtLeast(current, RULES.growth.legendaryMinRate)) continue;
    tier = t; break;
  }
  return { ...base, status: tier ? 'qualified' : 'not_qualified', tier, reason: tier ? 'gain' : 'gain_below_silver', metrics };
}

export function comebackCandidate(input: EvaluationInput): ShieldCandidate {
  const { current, previous, beforePrevious, period, pastAwards } = input;
  const base = { type: 'comeback' as const, category: null };
  if (!previous || !comparable(current, period.type) || !comparable(previous, period.type)) {
    return { ...base, status: 'insufficient_data', tier: null, reason: 'no_comparable_previous', metrics: tallyMetrics('current', current) };
  }
  const metrics: ShieldCandidate['metrics'] = { ...tallyMetrics('current', current), ...tallyMetrics('previous', previous), gainPoints: gainPoints(current, previous), baselineRate: beforePrevious ? ratePct(beforePrevious) : null };
  // A recovery needs an objectively lower previous period…
  if (rateAtLeast(previous, RULES.comeback.previousBelow)) return { ...base, status: 'not_qualified', tier: null, reason: 'no_decline', metrics };
  // …and positive activity before the decline, when that period is known.
  if (beforePrevious && comparable(beforePrevious, period.type) && !rateAtLeast(beforePrevious, RULES.comeback.baselineMinRate)) {
    return { ...base, status: 'not_qualified', tier: null, reason: 'no_prior_activity', metrics };
  }
  // Cooldown: no back-to-back comebacks (prevents dip-and-recover cycles).
  const cooldown = RULES[period.type].comebackCooldownPeriods;
  let p = period;
  for (let i = 0; i < cooldown; i++) {
    p = previousPeriod(p);
    const start = p.start;
    if (pastAwards.some(a => a.periodType === period.type && a.periodStart === start && a.shieldType === 'comeback')) {
      return { ...base, status: 'not_qualified', tier: null, reason: 'cooldown', metrics };
    }
  }
  let tier: ShieldTier | null = null;
  for (const rule of RULES.comeback.tiers) {
    if (!rateAtLeast(current, rule.minRate) || !gainAtLeast(current, previous, rule.minGain)) continue;
    if (rule.tier === 'legendary' && current.eligible < RULES[period.type].minOccurrences * RULES.comeback.legendarySampleMultiple) continue;
    tier = rule.tier; break;
  }
  return { ...base, status: tier ? 'qualified' : 'not_qualified', tier, reason: tier ? 'recovery' : 'recovery_too_small', metrics };
}

export function dedicationCandidate(input: EvaluationInput): ShieldCandidate {
  const { current, period } = input;
  const min = RULES[period.type].dedication;
  let best: { cat: HabitCategory; tier: ShieldTier; t: Tally } | null = null;
  let anyEligible = false;
  for (const cat of HABIT_CATEGORIES) {
    const t = current.byCategory[cat];
    if (!t || t.eligible < min.minOccurrences || t.days < min.minDays) continue;
    anyEligible = true;
    const tier = tierFromThresholds(t, RULES.dedication);
    if (!tier) continue;
    // Highest tier, then more occurrences, then taxonomy order.
    if (!best || TIER_RANK[tier] > TIER_RANK[best.tier] || (TIER_RANK[tier] === TIER_RANK[best.tier] && t.eligible > best.t.eligible)) best = { cat, tier, t };
  }
  if (!best) {
    return { type: 'dedication', status: anyEligible ? 'not_qualified' : 'insufficient_data', tier: null, category: null, reason: anyEligible ? 'below_silver' : 'min_category_occurrences', metrics: {} };
  }
  return { type: 'dedication', status: 'qualified', tier: best.tier, category: best.cat, reason: 'category_rate', metrics: { category: best.cat, ...tallyMetrics('category', best.t) } };
}

/** Teamwork comes only from finalized Family Missions (explicit, auditable
 *  cooperative goals). Weekly missions are a single pass/fail objective, so a
 *  week can earn at most Silver; higher tiers need several missions in a
 *  month. Ordinary completions never count as teamwork. */
export function teamworkCandidate(input: EvaluationInput): ShieldCandidate {
  const { period, missions, userId } = input;
  const inPeriod = missions.filter(m => {
    const end = addDays(m.weekStart, 6);
    return period.type === 'week' ? m.weekStart === period.start : end >= period.start && end <= period.end;
  });
  const finalized = inPeriod.filter(m => m.status !== 'active');
  const contributed = finalized.filter(m => m.status === 'completed' && m.metMemberIds.includes(userId));
  const kinds = new Set(contributed.map(m => m.missionId)).size;
  const metrics = { missionWeeks: inPeriod.length, finalizedMissions: finalized.length, contributedMissions: contributed.length, distinctMissionTypes: kinds };
  if (finalized.length === 0) return { type: 'teamwork', status: 'unavailable', tier: null, category: null, reason: 'no_finalized_mission', metrics };
  let tier: ShieldTier | null = null;
  if (period.type === 'week') tier = contributed.length > 0 ? 'silver' : null;
  else if (contributed.length >= 4 && contributed.length === finalized.length && kinds >= 3) tier = 'legendary';
  else if (contributed.length >= 3 && kinds >= 2) tier = 'epic';
  else if (contributed.length >= 2) tier = 'gold';
  else if (contributed.length >= 1) tier = 'silver';
  return { type: 'teamwork', status: tier ? 'qualified' : 'not_qualified', tier, category: null, reason: tier ? 'mission_contribution' : 'no_contribution', metrics };
}

export function evaluateShieldCandidates(input: EvaluationInput): ShieldCandidate[] {
  return [consistencyCandidate(input), growthCandidate(input), comebackCandidate(input), teamworkCandidate(input), dedicationCandidate(input)];
}

/** Highest tier wins; equal tiers use TYPE_PREFERENCE. */
export function selectWinningShield(candidates: ShieldCandidate[]): ShieldCandidate | null {
  const qualified = candidates.filter(c => c.status === 'qualified' && c.tier);
  if (!qualified.length) return null;
  return qualified.sort((a, b) => TIER_RANK[b.tier!] - TIER_RANK[a.tier!] || TYPE_PREFERENCE.indexOf(a.type) - TYPE_PREFERENCE.indexOf(b.type))[0];
}

export type EvaluationStatus = 'awarded' | 'no_award' | 'insufficient_data';

export interface FinalEvaluation {
  status: EvaluationStatus;
  candidates: ShieldCandidate[];
  winner: ShieldCandidate | null;
  eligibility: { eligible: number; completed: number; days: number; coveredDays: number; periodDays: number; sufficient: boolean };
}

export function evaluatePeriod(input: EvaluationInput): FinalEvaluation {
  const candidates = evaluateShieldCandidates(input);
  const winner = selectWinningShield(candidates);
  const isSufficient = sufficient(input.current, input.period.type);
  return {
    status: winner ? 'awarded' : isSufficient ? 'no_award' : 'insufficient_data',
    candidates,
    winner,
    eligibility: { eligible: input.current.eligible, completed: input.current.completed, days: input.current.days, coveredDays: input.current.coveredDays, periodDays: input.current.periodDays, sufficient: isSufficient },
  };
}

// ---------------------------------------------------------------------------
// Live progress (ongoing period) — never an award
// ---------------------------------------------------------------------------

export interface ConsistencyProjection {
  completed: number;
  eligibleSoFar: number;
  /** Open slots today + scheduled slots on the remaining days. */
  remaining: number;
  paceRate: number | null;
  /** Rate if every remaining occurrence is completed. */
  bestPossibleRate: number | null;
  paceTier: ShieldTier | null;
  bestPossibleTier: ShieldTier | null;
  /** Next tier above the pace tier that is still reachable, with how many of
   *  the remaining occurrences must be completed. */
  next: { tier: ShieldTier; needed: number } | null;
  eligibilityReachable: boolean;
}

export function projectConsistency(type: PeriodType, soFar: Tally, remaining: number, remainingDays: number): ConsistencyProjection {
  const thresholds = RULES[type].consistency;
  const totalEligible = soFar.eligible + remaining;
  const best = { completed: soFar.completed + remaining, eligible: totalEligible };
  const eligibilityReachable = totalEligible >= RULES[type].minOccurrences && soFar.days + remainingDays >= RULES[type].minDays;
  const tierOf = (t: { completed: number; eligible: number }) => {
    for (const tier of [...TIERS].reverse()) if (rateAtLeast(t, thresholds[tier])) return tier;
    return null;
  };
  // Pace assumes the remaining occurrences go at the current rate, so it is
  // the tier the member is "currently qualifying" for — not a guarantee.
  const paceTier = soFar.eligible > 0 && eligibilityReachable ? tierOf(soFar) : null;
  const bestTier = eligibilityReachable ? tierOf(best) : null;
  let next: ConsistencyProjection['next'] = null;
  for (const tier of TIERS) {
    if (paceTier && TIER_RANK[tier] <= TIER_RANK[paceTier]) continue;
    // Smallest k with (c + k) * 100 ≥ pct * total, k ≤ remaining.
    const needed = Math.max(0, Math.ceil((thresholds[tier] * totalEligible - 100 * soFar.completed) / 100));
    if (needed <= remaining && eligibilityReachable) { next = { tier, needed }; break; }
  }
  return {
    completed: soFar.completed,
    eligibleSoFar: soFar.eligible,
    remaining,
    paceRate: ratePct(soFar),
    bestPossibleRate: ratePct(best),
    paceTier,
    bestPossibleTier: bestTier,
    next,
    eligibilityReachable,
  };
}
