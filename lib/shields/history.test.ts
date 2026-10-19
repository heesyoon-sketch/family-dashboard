import test from 'node:test';
import assert from 'node:assert/strict';
import { recentShieldWeeks } from './history';

const TZ = 'America/Toronto';

test('archive uses four completed calendar weeks, excluding active and older shields', () => {
  const awards = [
    { id: 'active', equipment_month: '2026-10-19', tier: 'gold' as const },
    { id: 'last', equipment_month: '2026-10-12', tier: 'silver' as const },
    { id: 'fourth', equipment_month: '2026-09-21', tier: 'epic' as const },
    { id: 'old', equipment_month: '2026-09-14', tier: 'legendary' as const },
    { id: 'future', equipment_month: '2026-10-26', tier: 'legendary' as const },
  ];
  const weeks = recentShieldWeeks(awards, [], '2026-10-19', TZ);
  assert.deepEqual(weeks.map(w => w.start), ['2026-10-12', '2026-09-21']);
  assert.deepEqual(weeks.flatMap(w => w.awards.map(a => a.id)), ['last', 'fourth']);
  assert.equal(awards.length, 5, 'past awards remain intact');
});

test('an archive row uses the equipment week and orders earned tiers without mutating data', () => {
  const awards = [
    { id: 'silver', evaluation_month: '2026-10-05', equipment_month: '2026-10-12', tier: 'silver' as const },
    { id: 'legendary', evaluation_month: '2026-10-05', equipment_month: '2026-10-12', tier: 'legendary' as const },
  ];
  const weeks = recentShieldWeeks(awards, [], '2026-10-19', TZ);
  assert.equal(weeks[0].start, '2026-10-12');
  assert.deepEqual(weeks[0].awards.map(a => a.id), ['legendary', 'silver']);
  assert.deepEqual(awards.map(a => a.id), ['silver', 'legendary']);
});

test('retired shields are grouped by the family-local date, including week boundaries', () => {
  const earlier = [
    { id: 'last-sunday', unlockedAt: '2026-10-19T03:59:00Z' },
    { id: 'this-monday', unlockedAt: '2026-10-19T04:00:00Z' },
    { id: 'fourth-monday', unlockedAt: '2026-09-21T04:00:00Z' },
    { id: 'too-old', unlockedAt: '2026-09-21T03:59:00Z' },
    { id: 'invalid', unlockedAt: 'bad-date' },
  ];
  const weeks = recentShieldWeeks([], earlier, '2026-10-19', TZ);
  assert.deepEqual(weeks.map(w => w.earlier.map(s => s.id)), [['last-sunday'], ['fourth-monday']]);
  assert.deepEqual(recentShieldWeeks([], [], '2026-10-19', TZ), []);
});
