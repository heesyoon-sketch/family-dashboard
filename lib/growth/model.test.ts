import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGrowth, dayInZone, mondayOf, shiftDay, type GrowthCompletion } from './model';
const members = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
const tasks = [{ id: 't', user_id: 'a', title: '가족 성경읽기' }, { id: 'u', user_id: 'b', title: '가족 성경읽기' }];
const now = new Date('2026-10-14T20:00:00Z');
const row = (id: string, at: string, user = 'a', task = 't'): GrowthCompletion => ({ id, user_id: user, task_id: task, completed_at: at });
test('family calendar handles midnight, DST and Monday boundaries', () => {
  assert.equal(dayInZone(new Date('2026-10-13T02:00:00Z'), 'America/Toronto'), '2026-10-12');
  assert.equal(mondayOf('2026-11-01'), '2026-10-26');
  assert.equal(shiftDay('2026-03-08', 1), '2026-03-09');
});
test('counts complete records once and compares matching weekdays', () => {
  const first = row('1', '2026-10-12T15:00:00Z');
  const result = buildGrowth(members, tasks, [first, first, row('2', '2026-10-05T15:00:00Z'), row('3', '2026-10-09T15:00:00Z'), { ...row('4', '2026-10-13T15:00:00Z'), partial: true }, row('5', '2026-10-15T15:00:00Z'), row('6', '2026-10-12T15:00:00Z', 'outsider')], now, 'America/Toronto');
  assert.equal(result.total, 3); assert.equal(result.people[0].week, 1); assert.equal(result.people[0].previous, 1);
});
test('shared records require distinct members on same family-local day', () => {
  const result = buildGrowth(members, tasks, [row('1', '2026-10-12T15:00:00Z'), row('2', '2026-10-12T20:00:00Z'), row('3', '2026-10-13T02:00:00Z', 'b', 'u')], now, 'America/Toronto');
  assert.equal(result.familyMoments.length, 1); assert.equal(result.familyMoments[0].memberIds.size, 2);
});
test('ordinary matching habits do not imply togetherness', () => {
  const result = buildGrowth(members, tasks.map(t => ({ ...t, title: '운동하기' })), [row('1', '2026-10-12T15:00:00Z'), row('2', '2026-10-12T15:00:00Z', 'b', 'u')], now, 'America/Toronto');
  assert.equal(result.familyMoments.length, 0);
});
test('milestones survive breaks; undo removes an unearned milestone', () => {
  const rows = Array.from({ length: 10 }, (_, i) => row(String(i), `2026-10-${String(i + 1).padStart(2, '0')}T15:00:00Z`));
  assert.equal(buildGrowth(members, tasks, rows, now, 'America/Toronto').people[0].moments.filter(m => m.kind === 'milestone').length, 1);
  assert.equal(buildGrowth(members, tasks, rows.slice(0, 9), now, 'America/Toronto').people[0].moments.filter(m => m.kind === 'milestone').length, 0);
});
test('return requires three full missing days and empty members remain visible', () => {
  const result = buildGrowth(members, tasks, [row('1', '2026-10-05T15:00:00Z'), row('2', '2026-10-09T15:00:00Z')], now, 'America/Toronto');
  assert.equal(result.people[0].moments.filter(m => m.kind === 'return').length, 1);
  assert.equal(result.people[1].total, 0); assert.equal(result.people[1].moments.length, 0);
});
