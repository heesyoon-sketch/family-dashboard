import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activeDayRun,
  buildMemberHistory,
  comparePeriod,
  habitPerformance,
  heatmapWeeks,
  periodRange,
  pointChange,
  summarizeRange,
  zonedDayHour,
  type AnalyticsCompletion,
  type AnalyticsMember,
  type AnalyticsTask,
} from './history';
import { protectionStatus } from './family';
import { growthInsights, journeyEvents } from './insights';
import { shieldDescription, shieldTheme, shieldTitle } from './shieldCopy';
import { ACHIEVEMENTS } from '@/lib/achievements/definitions';
import type { DayOfWeek } from '@/lib/db';

const TZ = 'Asia/Seoul';
const ALL: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const member = (id: string, createdAt = '2026-01-01T00:00:00+09:00'): AnalyticsMember => ({ id, name: id, role: 'CHILD', createdAt });
const task = (id: string, userId: string, extra: Partial<AnalyticsTask> = {}): AnalyticsTask => ({
  id, userId, title: id, icon: '', daysOfWeek: ALL, timeWindow: 'evening', active: true,
  createdAt: '2026-01-01T00:00:00+09:00', deletedAt: null, streakCount: 0, ...extra,
});
let n = 0;
const done = (userId: string, taskId: string, at: string, id = `c${n++}`): AnalyticsCompletion => ({ id, userId, taskId, completedAt: at, partial: false });
// 2026-10-14 is a Wednesday. 15:00 KST: morning closed, evening open.
const NOW = new Date('2026-10-14T15:00:00+09:00');

test('family-local day ignores the viewer timezone', () => {
  assert.equal(zonedDayHour(new Date('2026-10-13T16:30:00Z'), TZ).day, '2026-10-14');
  assert.equal(zonedDayHour(new Date('2026-10-13T16:30:00Z'), TZ).hour, 1);
});

test('duplicate completions never inflate a rate', () => {
  const h = buildMemberHistory({
    member: member('a'), tasks: [task('t', 'a', { createdAt: '2026-10-13T00:00:00+09:00' })], now: NOW, timezone: TZ,
    completions: [done('a', 't', '2026-10-13T19:00:00+09:00', 'x'), done('a', 't', '2026-10-13T19:00:00+09:00', 'x'), done('a', 't', '2026-10-13T20:00:00+09:00')],
  });
  assert.deepEqual(summarizeRange(h, '2026-10-13', '2026-10-13'), { ...summarizeRange(h, '2026-10-13', '2026-10-13'), eligible: 1, completed: 1, rate: 1 });
});

test('open windows today are not failures; closed ones are', () => {
  const h = buildMemberHistory({
    member: member('a'),
    tasks: [task('m', 'a', { timeWindow: 'morning', createdAt: '2026-10-14T00:00:00+09:00' }), task('e', 'a', { createdAt: '2026-10-14T00:00:00+09:00' })],
    completions: [], now: NOW, timezone: TZ,
  });
  const today = summarizeRange(h, '2026-10-14', '2026-10-14');
  assert.equal(today.eligible, 1, 'morning closed at noon, evening still open');
  assert.equal(today.completed, 0);
});

test('habits running in both windows have two slots per day', () => {
  const h = buildMemberHistory({
    member: member('a'), tasks: [task('b', 'a', { timeWindow: 'both', createdAt: '2026-10-13T00:00:00+09:00' })], now: NOW, timezone: TZ,
    completions: [done('a', 'b', '2026-10-13T08:00:00+09:00'), done('a', 'b', '2026-10-13T09:00:00+09:00')],
  });
  const day = summarizeRange(h, '2026-10-13', '2026-10-13');
  assert.equal(day.eligible, 2);
  assert.equal(day.completed, 1, 'two morning taps fill one slot');
});

test('schedule edits never turn past completions into misses', () => {
  // Now scheduled only on weekends, but it was completed on a Tuesday.
  const h = buildMemberHistory({
    member: member('a'), tasks: [task('t', 'a', { daysOfWeek: ['SAT', 'SUN'], createdAt: '2026-10-12T00:00:00+09:00' })], now: NOW, timezone: TZ,
    completions: [done('a', 't', '2026-10-13T19:00:00+09:00')],
  });
  assert.equal(summarizeRange(h, '2026-10-13', '2026-10-13').rate, 1);
  assert.equal(summarizeRange(h, '2026-10-12', '2026-10-12').eligible, 0, 'Monday is no longer scheduled and had no completion');
});

test('habit lifetime starts at first evidence and ends before deletion', () => {
  const h = buildMemberHistory({
    member: member('a'),
    tasks: [
      task('old', 'a', { createdAt: '2026-10-14T00:00:00+09:00', deletedAt: '2026-10-11T10:00:00+09:00' }),
      task('fresh', 'a', { createdAt: '2026-10-14T00:00:00+09:00' }),
    ],
    completions: [done('a', 'old', '2026-10-08T19:00:00+09:00')],
    now: NOW, timezone: TZ,
  });
  // old: Oct 8 (first completion) .. Oct 10 (day before deletion) = 3 days.
  assert.equal(summarizeRange(h, '2026-10-01', '2026-10-14', 'old').eligible, 3);
  assert.equal(summarizeRange(h, '2026-10-01', '2026-10-13', 'fresh').eligible, 0, 'a habit created today has no history');
  assert.equal(h.firstDay, '2026-10-08');
});

test('period comparison reports percentage points and refuses thin data', () => {
  const tasks = [task('t', 'a', { createdAt: '2026-09-01T00:00:00+09:00' })];
  const completions: AnalyticsCompletion[] = [];
  // Previous 7 days (Oct 1–7): 3 of 7. Current (Oct 8–14, today's evening open): 6 of 6.
  for (const d of ['01', '03', '05']) completions.push(done('a', 't', `2026-10-${d}T19:00:00+09:00`));
  for (const d of ['08', '09', '10', '11', '12', '13']) completions.push(done('a', 't', `2026-10-${d}T19:00:00+09:00`));
  const h = buildMemberHistory({ member: member('a'), tasks, completions, now: NOW, timezone: TZ });
  const cmp = comparePeriod(h, periodRange('7d', h.today, h.firstDay));
  assert.equal(cmp.current.rate, 1);
  assert.equal(cmp.comparable, true);
  assert.equal(cmp.pointChange, 100 - 43);

  const thin = buildMemberHistory({ member: member('b'), tasks: [task('t2', 'b', { createdAt: '2026-10-12T00:00:00+09:00' })], completions: [], now: NOW, timezone: TZ });
  const thinCmp = comparePeriod(thin, periodRange('7d', thin.today, thin.firstDay));
  assert.equal(thinCmp.comparable, false);
  assert.equal(thinCmp.pointChange, null);
  assert.equal(pointChange(0.725, 0.5), 23);
});

test('year period compares against the same span last year', () => {
  const p = periodRange('year', '2028-02-29', null);
  assert.deepEqual(p.previous, { from: '2027-01-01', to: '2027-02-28' });
});

test('heatmap separates rest days, zero days, and future days', () => {
  const h = buildMemberHistory({
    member: member('a'), tasks: [task('t', 'a', { daysOfWeek: ['MON', 'TUE'], createdAt: '2026-10-05T00:00:00+09:00' })], now: NOW, timezone: TZ,
    completions: [done('a', 't', '2026-10-06T19:00:00+09:00')],
  });
  const weeks = heatmapWeeks(h, 2);
  const cell = (day: string) => weeks.flat().find(c => c.day === day)!;
  assert.equal(cell('2026-10-05').level, 0);
  assert.equal(cell('2026-10-06').level, 4);
  assert.equal(cell('2026-10-07').level, 'rest');
  assert.equal(cell('2026-10-15').level, 'future');
});

test('habit groups follow the documented thresholds', () => {
  const tasks = [task('strong', 'a', { createdAt: '2026-09-01T00:00:00+09:00' }), task('weak', 'a', { createdAt: '2026-09-01T00:00:00+09:00' })];
  const completions = ['08', '09', '10', '11', '12', '13'].map(d => done('a', 'strong', `2026-10-${d}T19:00:00+09:00`));
  completions.push(done('a', 'weak', '2026-10-09T19:00:00+09:00'), done('a', 'weak', '2026-10-02T19:00:00+09:00'));
  const h = buildMemberHistory({ member: member('a'), tasks, completions, now: NOW, timezone: TZ });
  const perf = habitPerformance(h, tasks, periodRange('7d', h.today, h.firstDay));
  assert.equal(perf.find(p => p.task.id === 'strong')?.group, 'strong');
  assert.equal(perf.find(p => p.task.id === 'weak')?.group, 'attention');
});

test('active-day run skips rest days and waits for today', () => {
  const h = buildMemberHistory({
    member: member('a'), tasks: [task('t', 'a', { daysOfWeek: ['MON', 'TUE', 'THU'], createdAt: '2026-10-01T00:00:00+09:00' })], now: NOW, timezone: TZ,
    completions: ['01', '05', '06', '08', '12', '13'].map(d => done('a', 't', `2026-10-${d}T19:00:00+09:00`)),
  });
  assert.equal(activeDayRun(h), 6);
});

test('insights and journey are grounded in records', () => {
  const tasks = [task('t', 'a', { createdAt: '2026-09-01T00:00:00+09:00' })];
  const completions = ['01', '03', '05', '08', '09', '10', '11', '12', '13'].map(d => done('a', 't', `2026-10-${d}T19:00:00+09:00`));
  const h = buildMemberHistory({ member: member('a'), tasks, completions, now: NOW, timezone: TZ });
  const insights = growthInsights(h, tasks, periodRange('7d', h.today, h.firstDay));
  assert.ok(insights.length <= 3);
  assert.ok(insights.some(i => i.id === 'period-change'));
  const journey = journeyEvents(h, tasks, []);
  assert.equal(journey.at(-1)?.kind, 'first');
  assert.equal(journey.at(-1)?.day, '2026-10-01');
  assert.equal(growthInsights(buildMemberHistory({ member: member('z'), tasks: [], completions: [], now: NOW, timezone: TZ }), [], periodRange('30d', '2026-10-14', null)).length, 0);
});

test('protection status follows existing exemptions and deadlines', () => {
  const base = { members: [{ id: 'a' }], todayTasksByUser: { a: [{ id: 'm', timeWindow: 'morning' }, { id: 'e', timeWindow: 'evening' }] }, todayCompletionsByWindow: { a: { morning: ['m'], evening: [] } }, penaltiesToday: 0 };
  assert.equal(protectionStatus({ ...base, nowHour: 15, penaltyEnabled: false, vacation: true, saleDay: false }).state, 'penalty-off');
  assert.equal(protectionStatus({ ...base, nowHour: 15, vacation: true, saleDay: false }).state, 'vacation');
  assert.equal(protectionStatus({ ...base, nowHour: 15, vacation: false, saleDay: true }).state, 'sale-day');
  assert.equal(protectionStatus({ ...base, nowHour: 15, vacation: false, saleDay: false }).state, 'open');
  assert.equal(protectionStatus({ ...base, nowHour: 23, vacation: false, saleDay: false }).state, 'secured');
  assert.equal(protectionStatus({ ...base, nowHour: 23, vacation: false, saleDay: false, penaltiesToday: 1 }).state, 'missed');
});

test('every shield has Korean copy and a theme', () => {
  for (const def of ACHIEVEMENTS) {
    assert.ok(shieldTitle(def).ko && !/^[A-Za-z]/.test(shieldTitle(def).ko), `${def.achievementId} title`);
    assert.ok(/[가-힣]/.test(shieldDescription(def).ko), `${def.achievementId} description`);
    assert.ok(shieldTheme(def));
  }
});

test('Korean particles follow the final consonant, ignoring quotes', async () => {
  const { josa } = await import('./insights');
  assert.equal(josa('‘일기쓰기’', '을', '를'), '‘일기쓰기’를');
  assert.equal(josa('‘문제집 4장 풀기’', '이', '가'), '‘문제집 4장 풀기’가');
  assert.equal(josa('‘샤워 + 양치 + 로션’', '을', '를'), '‘샤워 + 양치 + 로션’을');
});
