import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { finalizablePeriods } from './finalize';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

test('cron route is reachable without a session but requires CRON_SECRET', () => {
  assert.match(read('proxy.ts'), /pathname\.startsWith\('\/api\/cron\/'\)/);
  const route = read('app/api/cron/shields/route.ts');
  assert.match(route, /process\.env\.CRON_SECRET/);
  assert.match(route, /!secret \|\| request\.headers\.get\('authorization'\) !== `Bearer \$\{secret\}`/);
  assert.match(read('vercel.json'), /"\/api\/cron\/shields"/);
});

test('only periods that start on/after the first snapshot and have ended are finalizable', () => {
  // First snapshot Tue Oct 13 → the week of Oct 12 is not official.
  assert.deepEqual(finalizablePeriods('week', '2026-10-13', '2026-10-26', 12).map(p => p.start), ['2026-10-19']);
  assert.deepEqual(finalizablePeriods('week', '2026-10-13', '2026-10-25', 12), [], 'Sunday Oct 25 has not ended');
  assert.deepEqual(finalizablePeriods('month', '2026-10-13', '2026-12-01', 6).map(p => p.start), ['2026-11-01']);
  assert.deepEqual(finalizablePeriods('month', '2026-11-01', '2026-11-30', 6), []);
  assert.equal(finalizablePeriods('week', '2026-01-05', '2026-12-31', 12).length, 12, 'catch-up is bounded');
});

test('equipment migration: simulate first, spendable-only, same rates as the TS mirror', async () => {
  const { RATE_BP, CAP_BP, FALLBACK_FACTOR_PCT } = await import('./equipment');
  const sql = read('supabase/migrations/20261014120000_shield_equipment.sql');
  assert.match(sql, /values \(1, 'equip-v1', 'simulate',/);
  const rules = JSON.parse(sql.match(/'simulate', '(\{.*?\})'\)/)![1]);
  assert.deepEqual(rules.rateBp, RATE_BP);
  assert.equal(rules.capBp, CAP_BP);
  assert.equal(rules.fallbackFactorPct, FALLBACK_FACTOR_PCT);
  assert.equal(rules.countsTowardXp, false);
  // Hooked into the authoritative RPCs, bonus on base points only.
  assert.match(sql, /v_shield := public\.apply_shield_bonus\(/);
  assert.match(sql, /case when v_partial then ceil\(v_base \* 0\.5\)::integer else v_base end/);
  assert.match(sql, /perform public\.reverse_shield_bonus\(v_undo_completion, p_user_id, v_undo_points\)/);
  assert.match(sql, /unique \(task_completion_id, entry_type\)/);
  assert.match(sql, /grant execute on function public\.shield_auto_equip\(text, uuid\[\]\) to service_role/);
  const route = read('lib/shields/finalize.ts');
  assert.match(route, /finalize_shield_month/);
  assert.doesNotMatch(route, /finalize_shield_period/);
});
