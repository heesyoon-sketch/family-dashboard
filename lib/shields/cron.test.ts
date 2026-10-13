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
