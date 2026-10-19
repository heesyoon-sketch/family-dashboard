import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

test('cron route is reachable without a session but requires CRON_SECRET', () => {
  assert.match(read('proxy.ts'), /pathname\.startsWith\('\/api\/cron\/'\)/);
  const route = read('app/api/cron/shields/route.ts');
  assert.match(route, /process\.env\.CRON_SECRET/);
  assert.match(route, /!secret \|\| request\.headers\.get\('authorization'\) !== `Bearer \$\{secret\}`/);
  assert.match(read('vercel.json'), /"\/api\/cron\/shields"/);
});

test('equipment hooks: bonus on base points, reversed on undo, once per completion', () => {
  const sql = read('supabase/migrations/20261014120000_shield_equipment.sql');
  // Hooked into the authoritative RPCs, bonus on base points only.
  assert.match(sql, /v_shield := public\.apply_shield_bonus\(/);
  assert.match(sql, /case when v_partial then ceil\(v_base \* 0\.5\)::integer else v_base end/);
  assert.match(sql, /perform public\.reverse_shield_bonus\(v_undo_completion, p_user_id, v_undo_points\)/);
  assert.match(sql, /unique \(task_completion_id, entry_type\)/);
  // Weekly finalization replaced the monthly one and its client-side auto-equip.
  const weekly = read('supabase/migrations/20261019180000_weekly_window_shields.sql');
  assert.match(weekly, /drop function if exists public\.finalize_shield_month\(jsonb\);/);
  assert.match(weekly, /drop function if exists public\.shield_auto_equip\(text, uuid\[\]\);/);
  assert.doesNotMatch(read('lib/shields/finalize.ts'), /finalize_shield_month|shield_auto_equip/);
});
