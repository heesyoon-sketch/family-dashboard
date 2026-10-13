import test from 'node:test';
import assert from 'node:assert/strict';
import {
  completedSlotKeys,
  consistencyCandidate,
  comebackCandidate,
  dedicationCandidate,
  evaluatePeriod,
  gainAtLeast,
  growthCandidate,
  periodContaining,
  previousPeriod,
  projectConsistency,
  rateAtLeast,
  selectWinningShield,
  tallyPeriod,
  teamworkCandidate,
  zonedDayHour,
  type DailySchedule,
  type EvaluationInput,
  type PeriodTally,
  type ShieldCandidate,
} from './engine';

const week = periodContaining('week', '2026-10-21');
const T = (completed: number, eligible: number, days = 7, byCategory: PeriodTally['byCategory'] = {}): PeriodTally =>
  ({ completed, eligible, days, coveredDays: 7, periodDays: 7, byCategory });
const input = (current: PeriodTally, extra: Partial<EvaluationInput> = {}): EvaluationInput =>
  ({ userId: 'u', period: week, current, previous: null, beforePrevious: null, missions: [], pastAwards: [], ...extra });

test('periods: Monday–Sunday weeks, calendar months, leap years', () => {
  assert.deepEqual(periodContaining('week', '2026-10-18'), { type: 'week', start: '2026-10-12', end: '2026-10-18' });
  assert.deepEqual(periodContaining('week', '2026-10-19'), { type: 'week', start: '2026-10-19', end: '2026-10-25' });
  assert.deepEqual(periodContaining('month', '2028-02-10'), { type: 'month', start: '2028-02-01', end: '2028-02-29' });
  assert.deepEqual(periodContaining('month', '2027-02-10').end, '2027-02-28');
  assert.deepEqual(previousPeriod(periodContaining('month', '2026-01-15')), { type: 'month', start: '2025-12-01', end: '2025-12-31' });
  assert.deepEqual(previousPeriod(periodContaining('week', '2026-01-01')).start, '2025-12-22');
});

test('family-local days survive daylight-saving transitions', () => {
  // Toronto springs forward 2026-03-08 02:00 → 03:00.
  assert.deepEqual(zonedDayHour(new Date('2026-03-08T06:30:00Z'), 'America/Toronto'), { day: '2026-03-08', hour: 1 });
  assert.deepEqual(zonedDayHour(new Date('2026-03-08T07:30:00Z'), 'America/Toronto'), { day: '2026-03-08', hour: 3 });
  // 23:30 local on Sunday Nov 1 (fall back day) is still that Sunday.
  assert.equal(zonedDayHour(new Date('2026-11-02T04:30:00Z'), 'America/Toronto').day, '2026-11-01');
});

test('exact rate comparisons at every consistency boundary', () => {
  // 7/10 = 70% exactly; 69/100 just below; 85/100 exact gold; 19/20 = 95% epic.
  const tier = (c: number, e: number) => consistencyCandidate(input(T(c, e))).tier;
  assert.equal(tier(69, 100), null);
  assert.equal(tier(7, 10), 'silver');
  assert.equal(tier(84, 100), 'silver');
  assert.equal(tier(85, 100), 'gold');
  assert.equal(tier(9499, 10000), 'gold');
  assert.equal(tier(19, 20), 'epic');
  assert.equal(tier(99, 100), 'epic');
  assert.equal(tier(27, 27), 'legendary');
  assert.ok(rateAtLeast({ completed: 1, eligible: 3 }, 33) && !rateAtLeast({ completed: 1, eligible: 3 }, 34));
});

test('minimum eligibility: no tasks, too few, too few days', () => {
  assert.equal(consistencyCandidate(input(T(0, 0, 0))).status, 'insufficient_data');
  assert.equal(consistencyCandidate(input(T(4, 4, 4))).status, 'insufficient_data', '4 occurrences < 5');
  assert.equal(consistencyCandidate(input(T(6, 6, 2))).status, 'insufficient_data', '2 days < 3');
  assert.equal(consistencyCandidate(input(T(5, 5, 3))).tier, 'legendary');
  const month = periodContaining('month', '2026-11-10');
  const m = (c: number, e: number, d: number) => consistencyCandidate({ ...input(T(c, e, d)), period: month }).tier;
  assert.equal(m(20, 20, 9), null);
  assert.equal(m(15, 20, 10), 'silver');
  assert.equal(m(14, 20, 10), null, '70% is below monthly silver (75%)');
});

test('growth uses exact percentage points and guards baselines', () => {
  const g = (cur: PeriodTally, prev: PeriodTally, before: PeriodTally | null = null) =>
    growthCandidate(input(cur, { previous: prev, beforePrevious: before }));
  // 55% → 85%: +30pp and ≥80% → legendary.
  assert.equal(g(T(17, 20), T(11, 20)).tier, 'legendary');
  // +30pp but current only 75% → legendary blocked, epic (≥20) instead.
  assert.equal(g(T(15, 20), T(9, 20)).tier, 'epic');
  // Exactly +5pp at 60% → silver; +4.99 → none.
  assert.equal(g(T(60, 100), T(55, 100)).tier, 'silver');
  assert.equal(g(T(6000, 10000), T(5501, 10000)).tier, null);
  assert.equal(g(T(59, 100), T(40, 100)).reason, 'current_below_60');
  // Workloads that differ by more than 2× are not comparable.
  assert.equal(g(T(9, 10), T(10, 25)).reason, 'workload_not_comparable');
  // Missing previous data → insufficient, never an award.
  assert.equal(g(T(17, 20), T(2, 2, 2)).status, 'insufficient_data');
  // A previous week observed on only 4 of 7 days is not comparable.
  assert.equal(g(T(17, 20), { ...T(11, 20, 4), coveredDays: 4 }).status, 'insufficient_data');
  // A deliberate dip (90% → 50% → 90%) is measured from the pre-dip baseline.
  const dip = g(T(18, 20), T(10, 20), T(18, 20));
  assert.equal(dip.metrics.baselineKind, 'before_dip');
  assert.equal(dip.tier, null);
  assert.ok(gainAtLeast({ completed: 17, eligible: 20 }, { completed: 11, eligible: 20 }, 30));
});

test('comeback needs a decline, prior activity, real recovery, and a cooldown', () => {
  const c = (cur: PeriodTally, prev: PeriodTally, extra: Partial<EvaluationInput> = {}) =>
    comebackCandidate(input(cur, { previous: prev, ...extra }));
  assert.equal(c(T(14, 20), T(10, 20)).tier, 'silver', '50% → 70%: reaches 70% with +20pp');
  assert.equal(c(T(13, 20), T(8, 20)).tier, null, '65% has not recovered to 70%');
  assert.equal(c(T(14, 20), T(11, 20)).tier, 'silver', '55% → 70%: +15pp');
  assert.equal(c(T(16, 20), T(12, 20)).tier, 'gold', '60% → 80%: +20pp');
  assert.equal(c(T(18, 20), T(13, 20)).tier, 'epic', '65% → 90%: +25pp');
  // 50% → 95% with 20 occurrences: legendary needs ≥ 2× the weekly minimum (10) → ok.
  assert.equal(c(T(19, 20), T(10, 20)).tier, 'legendary');
  // Same recovery on a tiny sample cannot be legendary.
  assert.equal(c(T(6, 6, 3), T(2, 6, 3)).tier, 'epic');
  assert.equal(c(T(18, 20), T(14, 20)).reason, 'no_decline', 'previous ≥ 70% is not a decline');
  assert.equal(c(T(18, 20), T(10, 20), { beforePrevious: T(6, 20) }).reason, 'no_prior_activity');
  const lastWeek = previousPeriod(week).start;
  assert.equal(c(T(18, 20), T(10, 20), { pastAwards: [{ periodType: 'week', periodStart: lastWeek, shieldType: 'comeback' }] }).reason, 'cooldown');
});

test('dedication counts only genuinely mapped categories', () => {
  const d = (byCategory: PeriodTally['byCategory']) => dedicationCandidate(input(T(10, 10, 7, byCategory)));
  assert.equal(d({ learning: { eligible: 4, completed: 4, days: 3, coveredDays: 7, periodDays: 7 } }).tier, 'legendary');
  assert.equal(d({ learning: { eligible: 4, completed: 4, days: 2, coveredDays: 7, periodDays: 7 } }).status, 'insufficient_data');
  const both = d({
    learning: { eligible: 8, completed: 7, days: 5, coveredDays: 7, periodDays: 7 },
    exercise: { eligible: 5, completed: 5, days: 5, coveredDays: 7, periodDays: 7 },
  });
  assert.equal(both.category, 'exercise');
  assert.equal(both.tier, 'legendary');
});

test('teamwork comes only from finalized family missions', () => {
  const t = (missions: Parameters<typeof teamworkCandidate>[0]['missions'], period = week) => teamworkCandidate({ ...input(T(10, 10)), period, missions });
  assert.equal(t([]).status, 'unavailable');
  assert.equal(t([{ weekStart: week.start, missionId: 'all-together', status: 'active', metMemberIds: ['u'] }]).status, 'unavailable');
  assert.equal(t([{ weekStart: week.start, missionId: 'all-together', status: 'completed', metMemberIds: ['u'] }]).tier, 'silver');
  assert.equal(t([{ weekStart: week.start, missionId: 'all-together', status: 'completed', metMemberIds: ['x'] }]).tier, null);
  assert.equal(t([{ weekStart: week.start, missionId: 'all-together', status: 'missed', metMemberIds: ['u'] }]).tier, null);
  const nov = periodContaining('month', '2026-11-15');
  const weeks = ['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23'];
  const ids = ['all-together', 'strong-week', 'family-harmony', 'comeback-crew', 'all-together'];
  const all = weeks.map((w, i) => ({ weekStart: w, missionId: ids[i], status: 'completed' as const, metMemberIds: ['u'] }));
  // The Oct 26 week ends Nov 1 → belongs to November; the Nov 30 week ends in December.
  assert.equal(t(all, nov).metrics.finalizedMissions, 5);
  assert.equal(t(all, nov).tier, 'legendary');
  assert.equal(t(all.slice(0, 2), nov).tier, 'gold');
});

test('selection: higher tier wins, equal tiers follow the preference order', () => {
  const cand = (type: ShieldCandidate['type'], tier: ShieldCandidate['tier']): ShieldCandidate => ({ type, tier, status: tier ? 'qualified' : 'not_qualified', category: null, reason: '', metrics: {} });
  assert.equal(selectWinningShield([cand('consistency', 'epic'), cand('growth', 'gold'), cand('comeback', 'silver')])?.type, 'consistency');
  assert.equal(selectWinningShield([cand('consistency', 'gold'), cand('dedication', 'gold'), cand('growth', 'gold'), cand('comeback', 'gold')])?.type, 'comeback');
  assert.equal(selectWinningShield([cand('consistency', 'gold'), cand('dedication', 'gold')])?.type, 'dedication');
  assert.equal(selectWinningShield([cand('consistency', null)]), null);
});

test('evaluation is reproducible and distinguishes no award from insufficient data', () => {
  const a = evaluatePeriod(input(T(13, 20)));
  assert.equal(a.status, 'no_award');
  assert.deepEqual(evaluatePeriod(input(T(13, 20))), a);
  assert.equal(evaluatePeriod(input(T(1, 1, 1))).status, 'insufficient_data');
  assert.equal(evaluatePeriod(input(T(20, 20))).winner?.tier, 'legendary');
});

test('snapshots freeze the denominator; unscheduled completions never count', () => {
  const schedules: DailySchedule[] = [
    { userId: 'u', day: '2026-10-19', slots: [{ taskId: 'read', title: '독서', icon: '📚', window: 'evening' }, { taskId: 'teeth', title: '양치', icon: '🪥', window: 'morning' }, { taskId: 'teeth', title: '양치', icon: '🪥', window: 'evening' }] },
    { userId: 'u', day: '2026-10-20', slots: [{ taskId: 'read', title: '독서', icon: '📚', window: 'evening' }] },
  ];
  const tz = 'America/Toronto';
  const done = completedSlotKeys('u', [
    { id: '1', userId: 'u', taskId: 'read', completedAt: '2026-10-19T23:00:00Z' },     // 19:00 local
    { id: '2', userId: 'u', taskId: 'read', completedAt: '2026-10-19T23:05:00Z' },     // duplicate
    { id: '3', userId: 'u', taskId: 'teeth', completedAt: '2026-10-19T12:00:00Z' },    // 08:00 → morning slot
    { id: '4', userId: 'u', taskId: 'trivial', completedAt: '2026-10-19T13:00:00Z' },  // not in snapshot
    { id: '5', userId: 'u', taskId: 'read', completedAt: '2026-10-22T23:00:00Z' },     // no snapshot that day
  ], schedules, tz);
  const t = tallyPeriod('u', week, schedules, done);
  assert.equal(t.eligible, 4);
  assert.equal(t.completed, 2);
  assert.equal(t.coveredDays, 2);
  assert.equal(t.byCategory.learning?.eligible, 2);
  assert.equal(t.byCategory.health?.completed, 1);
  // Live view: evening slots on "today" are not misses yet.
  const live = tallyPeriod('u', week, schedules, new Set(), { today: '2026-10-20', nowHour: 9 });
  assert.equal(live.eligible, 3);
});

test('projection: early perfection is not a guaranteed legendary', () => {
  // Mon–Tue: 6/6 done, 15 occurrences still ahead.
  const p = projectConsistency('week', { completed: 6, eligible: 6, days: 2, coveredDays: 2, periodDays: 7 }, 15, 5);
  assert.equal(p.paceTier, 'legendary');
  assert.equal(p.bestPossibleTier, 'legendary');
  assert.equal(p.remaining, 15);
  // One miss makes 100% unreachable: best possible drops below legendary.
  const miss = projectConsistency('week', { completed: 5, eligible: 6, days: 2, coveredDays: 2, periodDays: 7 }, 15, 5);
  assert.equal(miss.bestPossibleTier, 'epic');
  // 10/20 so far, 10 left: gold (85% of 30 = 25.5 → 26) needs 16 > 10 → unreachable; silver needs 11 > 10.
  const behind = projectConsistency('week', { completed: 10, eligible: 20, days: 4, coveredDays: 4, periodDays: 7 }, 10, 3);
  assert.equal(behind.next, null);
  // 14/20 so far, 20 left: gold needs 85% of 40 = 34 → 20 more, exactly reachable.
  const close = projectConsistency('week', { completed: 14, eligible: 20, days: 4, coveredDays: 4, periodDays: 7 }, 20, 3);
  assert.equal(close.paceTier, 'silver');
  assert.deepEqual(close.next, { tier: 'gold', needed: 20 });
});
