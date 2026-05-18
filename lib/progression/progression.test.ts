import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateHarmony } from './harmony';
import { calculateMomentum } from './momentum';
import { composeBonusPercent } from './loadout';

test('momentum ignores unscheduled days instead of punishing them', () => {
  const result = calculateMomentum({
    dailyDone: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    dailyDue:  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  });

  assert.equal(result.score, 100);
  assert.equal(result.state, 'overflowing');
});

test('harmony rewards side-by-side family activity', () => {
  const result = calculateHarmony({
    memberIds: ['a', 'b'],
    dailyByMember: {
      a: { done: [1, 1, 0, 0, 0, 0, 0], due: [1, 1, 1, 1, 1, 1, 1] },
      b: { done: [1, 0, 0, 0, 0, 0, 0], due: [1, 1, 1, 1, 1, 1, 1] },
    },
  });

  assert.equal(result.sideBySideDays, 1);
  assert.equal(result.activeTodayCount, 2);
  assert.ok(result.score > 0);
});

test('composed bonuses never exceed the global cap', () => {
  const bonus = composeBonusPercent({
    momentumPercent: 20,
    harmonyPercent: 20,
    loadoutPercent: 50,
  });

  assert.equal(bonus.totalPercent, 50);
});
