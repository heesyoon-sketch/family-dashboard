import test from 'node:test';
import assert from 'node:assert/strict';
import { completionReward, shieldCreditMessage } from './completionReward';

test('popup total includes the separately credited shield points', () => {
  const result = completionReward({ pointsAwarded: 10, shieldBonus: { bonusPoints: 2, tier: 'gold' } });
  assert.equal(result.basePoints, 10);
  assert.equal(result.pointsAwarded, 12);
  assert.deepEqual(result.shieldBonus, { points: 2, tier: 'gold' });
  assert.equal(shieldCreditMessage(10, result.shieldBonus!, 'ko'), '10포인트 + 골드 쉴드 추가 포인트 2pt');
});

test('all paid tiers are named in Korean and English', () => {
  for (const [tier, name, points] of [['silver', '실버', 1], ['gold', '골드', 2], ['epic', '에픽', 3], ['legendary', '레전더리', 4]] as const) {
    const result = completionReward({ pointsAwarded: 10, shieldBonus: { bonusPoints: points, tier } });
    assert.equal(result.pointsAwarded, 10 + points);
    assert.equal(shieldCreditMessage(10, result.shieldBonus!, 'ko'), `10포인트 + ${name} 쉴드 추가 포인트 ${points}pt`);
    assert.match(shieldCreditMessage(10, result.shieldBonus!, 'en'), /Shield bonus/);
  }
});

test('no bonus, duplicate, shadow and clock mismatch responses do not invent a credit', () => {
  for (const raw of [{ pointsAwarded: 10 }, { pointsAwarded: 0 }, { pointsAwarded: 10, shieldBonus: { bonusPoints: 0 } }]) {
    assert.equal(completionReward(raw).pointsAwarded, raw.pointsAwarded);
    assert.equal(completionReward(raw).shieldBonus, null);
  }
  // A client deployed before the database migration can still describe an old credit.
  const old = completionReward({ pointsAwarded: 10, shieldBonus: { bonusPoints: 1 } });
  assert.equal(shieldCreditMessage(10, old.shieldBonus!, 'ko'), '10포인트 + 쉴드 추가 포인트 1pt');
});
