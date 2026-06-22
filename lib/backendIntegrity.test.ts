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
