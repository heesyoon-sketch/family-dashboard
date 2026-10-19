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


test('larger tasks display their actual table credit and total', () => {
  const result = completionReward({ pointsAwarded: 50, shieldBonus: { bonusPoints: 8, tier: 'legendary' } });
  assert.equal(result.pointsAwarded, 58);
  assert.equal(shieldCreditMessage(result.basePoints, result.shieldBonus!, 'ko'), '50포인트 + 레전더리 쉴드 추가 포인트 8pt');
});


test('updated table payouts appear in the popup total and breakdown', () => {
  for (const [base, tier, points, name] of [[30, 'silver', 2, '실버'], [30, 'gold', 3, '골드'], [30, 'epic', 4, '에픽'], [30, 'legendary', 6, '레전더리'], [50, 'silver', 3, '실버'], [50, 'gold', 4, '골드'], [50, 'epic', 6, '에픽']] as const) {
    const result = completionReward({ pointsAwarded: base, shieldBonus: { bonusPoints: points, tier } });
    assert.equal(result.pointsAwarded, base + points);
    assert.equal(shieldCreditMessage(base, result.shieldBonus!, 'ko'), `${base}포인트 + ${name} 쉴드 추가 포인트 ${points}pt`);
  }
});
