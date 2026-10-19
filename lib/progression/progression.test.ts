import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMomentum } from './momentum';

test('momentum ignores unscheduled days instead of punishing them', () => {
  const result = calculateMomentum({
    dailyDone: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    dailyDue:  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  });

  assert.equal(result.score, 100);
  assert.equal(result.state, 'overflowing');
});

test('momentum is visual only: no point bonus at any state', async () => {
  const { MOMENTUM_STATES } = await import('./momentum');
  for (const s of MOMENTUM_STATES) assert.equal('bonusPercent' in s, false, s.state);
});
