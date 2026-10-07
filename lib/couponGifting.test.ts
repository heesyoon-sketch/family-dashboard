import assert from 'node:assert/strict';
import test from 'node:test';
import { mapPerfectDayCoupon, mergeCouponWallets } from './perfectDay';

const rawCoupon = {
  id: 'pass-1', family_id: 'family', user_id: 'earner', owner_id: 'recipient',
  earned_for_day: '2026-10-06', status: 'available', awarded_at: '2026-10-06T12:00:00Z',
  quest_day: 3, chain_length: 3, reward_slot: 1,
};

test('gifted passes belong to the recipient while retaining the earning member', () => {
  const coupon = mapPerfectDayCoupon(rawCoupon);
  assert.equal(coupon.userId, 'recipient');
  assert.equal(coupon.earnedByUserId, 'earner');
  assert.equal(coupon.questDay, 3);
  const claimed = mapPerfectDayCoupon({ ...rawCoupon, owner_id: undefined, ownerId: 'recipient' });
  assert.equal(claimed.userId, 'recipient');
  const legacy = mapPerfectDayCoupon({ ...rawCoupon, owner_id: undefined });
  assert.equal(legacy.userId, 'earner');
});

test('claim reconciliation cannot duplicate or take back a gifted pass', () => {
  const original = mapPerfectDayCoupon({ ...rawCoupon, owner_id: 'earner' });
  const gift = mapPerfectDayCoupon(rawCoupon);
  const other = { ...original, id: 'pass-2' };
  const before = { earner: [original, other], recipient: [gift] };
  const result = mergeCouponWallets(before, [gift]);
  assert.deepEqual(result.earner, [other]);
  assert.deepEqual(result.recipient, [gift]);
  assert.deepEqual(mergeCouponWallets(result, [gift]), result);
  assert.equal(before.earner.length, 2);
});

test('a recipient can pass a gift along and redeemed state follows the current owner', () => {
  const gift = mapPerfectDayCoupon(rawCoupon);
  const forwarded = mapPerfectDayCoupon({ ...rawCoupon, owner_id: 'third-member' });
  const wallets = mergeCouponWallets({ recipient: [gift] }, [forwarded]);
  assert.deepEqual(wallets.recipient, []);
  const redeemed = mapPerfectDayCoupon({
    ...rawCoupon, owner_id: 'third-member', status: 'redeemed',
    redeemed_for: 'media', redeemed_at: '2026-10-06T18:00:00Z',
  });
  const updated = mergeCouponWallets(wallets, [redeemed]);
  assert.equal(updated['third-member'].length, 1);
  assert.equal(updated['third-member'][0].redeemedFor, 'media');
  assert.equal(updated['third-member'][0].earnedByUserId, 'earner');
});
