import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  rewardRedemptionStatus,
  type RewardRedemption,
} from './adminHelpers';

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8');
}

test('login, admin, and store route wiring stays intact', () => {
  assert.match(read('app/login/page.tsx'), /signInWithOAuth|FamBitAuthShell/);

  const adminPage = read('app/admin/page.tsx');
  assert.match(adminPage, /AdminSettingsPanel/);
  assert.match(adminPage, /AdminFamilyPanel/);
  assert.match(adminPage, /AdminTasksPanel/);
  assert.match(adminPage, /AdminStorePanel/);

  const storePanel = read('components/admin/AdminStorePanel.tsx');
  assert.match(storePanel, /RewardHistoryPanel/);
  assert.match(storePanel, /markRewardProcessed/);

  const migration = read('supabase/migrations/085_reward_processing_status.sql');
  assert.match(migration, /processed_at/);
  assert.match(migration, /processed_by/);
  assert.match(migration, /admin_mark_reward_redemption_processed/);
});

test('logout/session cleanup does not wipe local shield storage', () => {
  const files = [
    'app/page.tsx',
    'app/admin/page.tsx',
    'app/setup/page.tsx',
    'app/setup/set-pin/page.tsx',
  ];

  for (const file of files) {
    assert.doesNotMatch(read(file), /localStorage\\.clear\\(\\)/, `${file} should not clear all localStorage`);
  }
});

test('reward purchase handling status is pending, processed, or refunded', () => {
  const base: RewardRedemption = {
    id: 'redemption',
    user_id: 'user',
    user_name: 'Kid',
    reward_id: 'reward',
    reward_title: 'Reward',
    reward_icon: 'gift',
    cost_charged: 10,
    redeemed_at: '2026-05-18T00:00:00.000Z',
    is_joint_purchase: false,
    joint_user1_amount: 0,
    joint_user2_amount: 0,
  };

  assert.equal(rewardRedemptionStatus(base), 'pending');
  assert.equal(rewardRedemptionStatus({ ...base, processed_at: '2026-05-18T00:01:00.000Z' }), 'processed');
  assert.equal(
    rewardRedemptionStatus({
      ...base,
      processed_at: '2026-05-18T00:01:00.000Z',
      refunded_at: '2026-05-18T00:02:00.000Z',
    }),
    'refunded',
  );
});
