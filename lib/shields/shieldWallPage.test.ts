import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

test('insignias are read-only history: no engine, sync, awards or unlock pop-ups', () => {
  const reader = read('lib/achievements/earlierShields.ts');
  assert.match(reader, /\.from\('achievement_states'\)\s*\.select\('user_id,unlocked_at_by_achievement_id'\)/);
  assert.doesNotMatch(reader, /\.(insert|update|upsert)\(|\.delete\(\)/, 'never writes to the database');
  assert.match(read('components/hall/ShieldWall.tsx'), /useEarlierShields\(familyId, memberId\)/);
  for (const gone of ['lib/achievements/storage.ts', 'lib/achievements/engine.ts', 'lib/achievements/useShieldSnapshot.ts', 'lib/shields/transition.ts']) {
    assert.throws(() => read(gone), `${gone} is removed`);
  }
  assert.doesNotMatch(read('components/SyncBootstrap.tsx'), /achievements/);
  // No client-side bonus at all: the only point bonus is the weekly Shields.
  const store = read('lib/store.ts');
  assert.match(store, /await processCompletion\(userId, taskId, false, completionAt\);/);
  assert.doesNotMatch(store, /composeBonusPercent|loadoutBonusFromIds|bonusPercent|insigniaQueue|momentum/);
  assert.doesNotMatch(read('app/page.tsx'), /InsigniaUnlockOverlay/);
});

test('one page: /shields redirects into Family Growth, which embeds the Shield Wall', () => {
  assert.match(read('app/shields/page.tsx'), /redirect\('\/stats#shield-wall'\)/);
  const growth = read('components/growth/FamilyGrowth.tsx');
  assert.match(growth, /<ShieldWall analytics=\{analytics\} memberId=\{member\.id\} \/>/);
  assert.doesNotMatch(growth, /insignia-archive|ShieldCollection/, 'no separate insignia section');
  assert.match(read('components/EquippedShields.tsx'), /#shield-wall/);
});

test('simplified page: no tab nav, no footprints, habit icons render as icons', () => {
  assert.doesNotMatch(read('components/analytics/PageShell.tsx'), /<nav /);
  const growth = read('components/growth/FamilyGrowth.tsx');
  assert.doesNotMatch(growth, /Footprints|GrowthTimeline/);
  assert.equal((growth.match(/<HabitPerformanceList/g) ?? []).length, 1, 'one habit-by-habit section');
  assert.match(read('components/stats/HabitPerformanceList.tsx'), /<HabitIcon name=\{h\.task\.icon\}/);
});
