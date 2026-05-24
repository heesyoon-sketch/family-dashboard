import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRefundPrompt,
  mapReward,
  mapRewardRedemption,
  normaliseSalePercentage,
  rewardRedemptionStatus,
  type RewardRedemption,
} from './adminHelpers';

test('normaliseSalePercentage clamps to 0–100 and ignores NaN', () => {
  assert.equal(normaliseSalePercentage(50), 50);
  assert.equal(normaliseSalePercentage('25'), 25);
  assert.equal(normaliseSalePercentage(120), 100);
  assert.equal(normaliseSalePercentage(-5), 0);
  assert.equal(normaliseSalePercentage(null), 0);
  assert.equal(normaliseSalePercentage(undefined), 0);
  assert.equal(normaliseSalePercentage('not-a-number'), 0);
  // 49.6 should round to 50, matching display
  assert.equal(normaliseSalePercentage(49.6), 50);
});

test('mapReward falls back to name when title is missing', () => {
  const row = { id: 'r1', name: 'Legacy Title', cost_points: 100 };
  const reward = mapReward(row);
  assert.equal(reward.title, 'Legacy Title');
  assert.equal(reward.icon, 'gift');
  assert.equal(reward.sale_enabled, false);
  assert.equal(reward.sale_percentage, 0);
  assert.equal(reward.sale_price, undefined);
});

test('mapReward preserves explicit sale_price but drops NaN', () => {
  const ok = mapReward({ id: 'r1', title: 't', cost_points: 100, sale_enabled: true, sale_price: 80, sale_percentage: 20 });
  assert.equal(ok.sale_price, 80);
  assert.equal(ok.sale_percentage, 20);
  assert.equal(ok.sale_enabled, true);

  const bad = mapReward({ id: 'r1', title: 't', cost_points: 100, sale_price: 'abc' });
  assert.equal(bad.sale_price, undefined, 'non-numeric sale_price should not produce NaN');

  const negative = mapReward({ id: 'r1', title: 't', cost_points: 100, sale_price: -10 });
  assert.equal(negative.sale_price, 0, 'sale_price floor at zero');
});

test('mapReward trims sale_name and treats whitespace as undefined', () => {
  const trimmed = mapReward({ id: 'r1', title: 't', cost_points: 100, sale_name: '  Spring Sale  ' });
  assert.equal(trimmed.sale_name, 'Spring Sale');

  const empty = mapReward({ id: 'r1', title: 't', cost_points: 100, sale_name: '   ' });
  assert.equal(empty.sale_name, undefined);
});

test('mapRewardRedemption preserves nulls and coerces joint amounts', () => {
  const row = {
    id: 'red-1',
    user_id: 'user-1',
    user_name: '준서',
    reward_id: 'reward-1',
    reward_title: '간식',
    reward_icon: 'cookie',
    cost_charged: '50', // strings happen on JSON casts
    redeemed_at: '2026-05-22T12:00:00.000Z',
    is_joint_purchase: true,
    joint_user1_id: 'user-1',
    joint_user1_name: '준서',
    joint_user1_amount: '30',
    joint_user2_id: 'user-2',
    joint_user2_name: '지우',
    joint_user2_amount: '20',
  };
  const r = mapRewardRedemption(row);
  assert.equal(r.cost_charged, 50);
  assert.equal(r.joint_user1_amount, 30);
  assert.equal(r.joint_user2_amount, 20);
  assert.equal(r.processed_at, null);
  assert.equal(r.refunded_at, null);
  assert.equal(r.is_joint_purchase, true);
});

test('rewardRedemptionStatus prioritises refunded over processed over pending', () => {
  const base: RewardRedemption = {
    id: 'r',
    user_id: 'u',
    user_name: 'kid',
    reward_id: 'rw',
    reward_title: 'snack',
    reward_icon: 'gift',
    cost_charged: 10,
    redeemed_at: '2026-05-22T00:00:00.000Z',
    is_joint_purchase: false,
    joint_user1_amount: 0,
    joint_user2_amount: 0,
  };
  assert.equal(rewardRedemptionStatus(base), 'pending');
  assert.equal(rewardRedemptionStatus({ ...base, processed_at: '2026-05-22T00:01:00.000Z' }), 'processed');
  assert.equal(
    rewardRedemptionStatus({
      ...base,
      processed_at: '2026-05-22T00:01:00.000Z',
      refunded_at: '2026-05-22T00:02:00.000Z',
    }),
    'refunded',
    'refunded must win even if processed_at is set',
  );
});

test('buildRefundPrompt handles solo and joint flows in both languages', () => {
  const solo: RewardRedemption = {
    id: 'r',
    user_id: 'u',
    user_name: '준서',
    reward_id: 'rw',
    reward_title: '간식',
    reward_icon: 'gift',
    cost_charged: 50,
    redeemed_at: '2026-05-22T00:00:00.000Z',
    is_joint_purchase: false,
    joint_user1_amount: 0,
    joint_user2_amount: 0,
  };
  assert.match(buildRefundPrompt(solo, 'ko'), /준서/);
  assert.match(buildRefundPrompt(solo, 'ko'), /50pt/);
  assert.match(buildRefundPrompt(solo, 'en'), /Refund 준서's "간식"/);
  assert.match(buildRefundPrompt(solo, 'en'), /50pt will be returned/);

  const joint: RewardRedemption = {
    ...solo,
    is_joint_purchase: true,
    joint_user1_name: '준서',
    joint_user1_amount: 30,
    joint_user2_name: '지우',
    joint_user2_amount: 20,
  };
  const koJoint = buildRefundPrompt(joint, 'ko');
  assert.match(koJoint, /같이 결제/);
  assert.match(koJoint, /준서님에게 30pt/);
  assert.match(koJoint, /지우님에게 20pt/);

  const enJoint = buildRefundPrompt(joint, 'en');
  assert.match(enJoint, /shared purchase/);
  assert.match(enJoint, /준서 will be refunded 30pt/);
  assert.match(enJoint, /지우 will be refunded 20pt/);
});
