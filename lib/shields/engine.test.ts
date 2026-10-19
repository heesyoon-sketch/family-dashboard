import test from 'node:test';
import assert from 'node:assert/strict';
import {
  completedSlotKeys,
  periodContaining,
  previousPeriod,
  rateAtLeast,
  tallyPeriod,
  zonedDayHour,
  type DailySchedule,
} from './engine';

const week = periodContaining('week', '2026-10-21');

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

test('exact rate comparisons use integer math', () => {
  assert.ok(rateAtLeast({ completed: 7, eligible: 10 }, 70));
  assert.ok(!rateAtLeast({ completed: 69, eligible: 100 }, 70));
  assert.ok(rateAtLeast({ completed: 1, eligible: 3 }, 33) && !rateAtLeast({ completed: 1, eligible: 3 }, 34));
  assert.ok(!rateAtLeast({ completed: 0, eligible: 0 }, 0), 'nothing scheduled is never a pass');
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
  // Live view: evening slots on "today" are not misses yet.
  const live = tallyPeriod('u', week, schedules, new Set(), { today: '2026-10-20', nowHour: 9 });
  assert.equal(live.eligible, 3);
});
