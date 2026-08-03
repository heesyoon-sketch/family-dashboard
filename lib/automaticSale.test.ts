import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import type { AutomaticSaleConfig, Reward } from './db';
import {
  automaticSaleStatus,
  rewardEffectiveCost,
  rewardEffectiveSaleLabel,
  rewardHasEffectiveSale,
  withAutomaticSale,
} from './automaticSale';
import { publicHolidayDates } from './holidayCalendar';

const baseConfig: AutomaticSaleConfig = {
  weekendEnabled: false,
  holidayEnabled: false,
  percentage: 25,
  countryCode: 'CA',
  subdivisionCode: 'ON',
  timezone: 'America/Toronto',
  holidayDates: [],
  generatedThrough: 2036,
};

const reward: Reward = {
  id: 'reward',
  title: 'Game time',
  cost_points: 100,
  icon: 'gamepad-2',
};

test('automatic weekend sale follows the configured timezone', () => {
  const config = { ...baseConfig, weekendEnabled: true };
  const beforeMidnight = automaticSaleStatus(config, new Date('2026-08-03T03:30:00Z'));
  assert.equal(beforeMidnight.localDate, '2026-08-02');
  assert.equal(beforeMidnight.reason, 'weekend');
  assert.equal(beforeMidnight.active, true);

  const afterMidnight = automaticSaleStatus(config, new Date('2026-08-03T04:30:00Z'));
  assert.equal(afterMidnight.localDate, '2026-08-03');
  assert.equal(afterMidnight.active, false);
});

test('automatic holiday sale uses only stored local date keys', () => {
  const status = automaticSaleStatus({
    ...baseConfig,
    holidayEnabled: true,
    holidayDates: ['2026-12-25'],
  }, new Date('2026-12-25T17:00:00Z'));
  assert.equal(status.reason, 'holiday');
  assert.equal(status.percentage, 25);
});

test('the lower manual or automatic sale price wins without stacking', () => {
  const automaticReward = withAutomaticSale(reward, {
    active: true,
    percentage: 25,
    reason: 'weekend',
    localDate: '2026-08-02',
  });
  assert.equal(rewardEffectiveCost(automaticReward), 75);
  assert.equal(rewardHasEffectiveSale(automaticReward), true);
  assert.equal(rewardEffectiveSaleLabel(automaticReward), 'Weekend Sale');

  const manualWinner = {
    ...automaticReward,
    sale_enabled: true,
    sale_percentage: 40,
    sale_name: 'Family Flash Sale',
  };
  assert.equal(rewardEffectiveCost(manualWinner), 60);
  assert.equal(rewardEffectiveSaleLabel(manualWinner), 'Family Flash Sale');
});

test('Ontario calendar includes public holidays but excludes non-public observances', () => {
  const holidays = publicHolidayDates('CA', 'ON', 2026, 2026, 'en');
  assert.ok(holidays.some(holiday => holiday.date === '2026-01-01'));
  assert.ok(holidays.every(holiday => /^2026-\d{2}-\d{2}$/.test(holiday.date)));
  assert.equal(new Set(holidays.map(holiday => holiday.date)).size, holidays.length);
});

test('automatic sale migration validates settings and enforces both checkout paths', () => {
  const migration = readFileSync(
    join(process.cwd(), 'supabase/migrations/100_automatic_reward_sales.sql'),
    'utf8',
  );
  assert.match(migration, /assert_parent_admin\(\)/);
  assert.match(migration, /pg_timezone_names/);
  assert.match(migration, /create or replace function public\.redeem_reward_atomic/);
  assert.match(migration, /create or replace function public\.purchase_reward_joint/);
  assert.match(migration, /v_current_cost := least\(v_manual_cost, v_auto_cost\)/g);
  assert.match(migration, /revoke all on function public\.automatic_reward_sale_context[^;]+authenticated/);

  const serverTimeMigration = readFileSync(
    join(process.cwd(), 'supabase/migrations/101_use_server_time_for_automatic_sales.sql'),
    'utf8',
  );
  assert.match(serverTimeMigration, /timezone\(v_timezone, statement_timestamp\(\)\)/);
  assert.doesNotMatch(serverTimeMigration, /timezone\(v_timezone, coalesce\(p_at/);
});
