import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

test('backend hardening migration removes anonymous definer access', () => {
  const migration = read('supabase/migrations/095_backend_security_and_integrity.sql');
  assert.match(migration, /revoke execute on all functions in schema public from public/);
  assert.match(migration, /revoke execute on all functions in schema public from anon/);
  assert.match(migration, /'link_auth_user_to_profile'/);
  assert.match(migration, /'prune_old_task_activities'/);
});

test('point transfers are authorized, idempotent, and lock in stable order', () => {
  const migration = read('supabase/migrations/095_backend_security_and_integrity.sql');
  assert.match(migration, /point_transactions_request_id_key/);
  assert.match(migration, /u\.auth_user_id = auth\.uid\(\) or public\.is_my_family_parent\(\)/);
  assert.match(migration, /order by user_id\s+for update/);
  assert.match(migration, /on conflict \(request_id\) do nothing/);

  const store = read('lib/store.ts');
  assert.match(store, /p_request_id: crypto\.randomUUID\(\)/);
});

test('family creation and task reordering use atomic RPCs', () => {
  const migration = read('supabase/migrations/095_backend_security_and_integrity.sql');
  assert.match(migration, /create or replace function public\.create_family_atomic/);
  assert.match(migration, /create or replace function public\.admin_swap_task_order/);
  assert.match(read('app/setup/page.tsx'), /supabase\.rpc\('create_family_atomic'/);
  assert.doesNotMatch(read('app/setup/page.tsx'), /supabase\.rpc\('prepare_create_family'/);
  assert.match(read('app/admin/page.tsx'), /supabase\.rpc\('admin_swap_task_order'/);
});

test('realtime task activities do not trigger a redundant full hydrate', () => {
  const store = read('lib/store.ts');
  assert.match(store, /if \(row\?\.type === 'TASK_COMPLETED'\) return/);
});

test('offline actions are retained until success or an unrecoverable rejection', () => {
  const queue = read('lib/offlineQueue.ts');
  assert.doesNotMatch(queue, /OFFLINE_ACTION_TTL_MS|pruneStaleActions|bulkDelete\(stale/);
  assert.doesNotMatch(read('lib/store.ts'), /pruneStaleActions/);
});

test('shield reads use an incremental completion cache and hydrated task data', () => {
  const storage = read('lib/achievements/storage.ts');
  assert.match(storage, /COMPLETION_CACHE_FULL_REFRESH_MS/);
  assert.match(storage, /COMPLETION_CACHE_OVERLAP_MS/);
  assert.match(storage, /new Map\(_completionCache!\.byId\)/);
  assert.match(storage, /Object\.prototype\.hasOwnProperty\.call\(fallback, id\)/);
});

test('school week quests are family-scoped, weekly-idempotent, and award one pass for three weekdays', () => {
  const migration = read('supabase/migrations/105_school_week_quest.sql');
  assert.match(migration, /unique \(user_id, earned_for_day\)/);
  assert.match(migration, /perfect_day_coupons_user_school_week_key/);
  assert.match(migration, /extract\(isodow from p_earned_for_day\) > 5/);
  assert.match(migration, /if v_week_perfect_days >= 3 then/);
  assert.doesNotMatch(migration, /v_reward_count/);
  assert.match(migration, /reconcile_school_week_mark_before_completion_delete/);
  assert.match(migration, /status = 'redeemed'/);
  assert.match(migration, /school_week_quest_marks_family_select/);
  assert.match(migration, /grant execute on function public\.get_perfect_quest_progress\(date\) to authenticated/);
});

test('weekend quest bonus requires both days and uses a separate weekly reward slot', () => {
  const migration = read('supabase/migrations/106_weekend_quest_bonus.sql');
  assert.match(migration, /week_start, reward_slot/);
  assert.match(migration, /v_reward_slot := 2/);
  assert.match(migration, /v_required_days := 2/);
  assert.match(migration, /between 6 and 7/);
  assert.match(migration, /weekendRewardEarnedThisWeek/);
  assert.match(migration, /and c\.reward_slot = v_reward_slot/);
  assert.match(migration, /reconcile_school_week_mark_on_completion_delete/);
});

test('child routine deadlines are server-enforced and morning penalties are idempotent', () => {
  const migration = read('supabase/migrations/107_child_routine_deadlines.sql');
  assert.match(migration, /interval '12 hours'/);
  assert.match(migration, /v_role = 'CHILD'/);
  assert.match(migration, /interval '9 hours'/);
  assert.match(migration, /interval '21 hours'/);
  assert.match(migration, /unique \(user_id, penalty_date\)/);
  assert.match(migration, /least\(50, v_balance\)/);
  assert.match(migration, /set spendable_balance = v_balance - v_deducted/);
  assert.doesNotMatch(migration, /set total_points = total_points -/);
  assert.match(migration, /MORNING_ROUTINE_PENALTY:/);
  assert.match(migration, /grant execute on function public\.apply_morning_routine_penalties/);
});

test('automatic weekend and holiday sale days skip only the morning point penalty', () => {
  const migration = read('supabase/migrations/108_sale_day_morning_penalty_exemption.sql');
  assert.match(migration, /automatic_reward_sale_context\(v_family_id, v_now\)/);
  assert.match(migration, /v_sale_context->>'localDate' = p_penalty_date::text/);
  assert.match(migration, /'exempt', true/);
  assert.match(migration, /'exemptionReason', v_sale_context->>'reason'/);
  assert.doesNotMatch(migration, /process_task_completion_atomic|process_task_undo_atomic/);
  assert.match(migration, /apply_morning_routine_penalties_before_sale_exemption/);
});
