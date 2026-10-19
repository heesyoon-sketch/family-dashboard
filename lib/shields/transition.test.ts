import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INSIGNIAS_FROZEN, LEGACY_INSIGNIA_BONUS_END, legacyInsigniaBonusActive } from './transition';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

test('insignia bonus stops when weekly shields start (Mon Oct 19), so they never stack', () => {
  assert.equal(LEGACY_INSIGNIA_BONUS_END, '2026-10-19');
  const tz = 'America/Toronto';
  assert.equal(legacyInsigniaBonusActive(new Date('2026-10-19T03:59:00Z'), tz), true, 'Sun Oct 18, 23:59 in Toronto');
  assert.equal(legacyInsigniaBonusActive(new Date('2026-10-19T04:00:00Z'), tz), false, 'Mon Oct 19, 00:00 in Toronto');
});

test('insignias are frozen records: no unlocks, awards, revokes, loadout edits, or popups', () => {
  assert.equal(INSIGNIAS_FROZEN, true);
  const storage = read('lib/achievements/storage.ts');
  assert.match(storage, /if \(INSIGNIAS_FROZEN\) \{\n\s+return \{ state, achievementsByChild: persistedAchievementsByChild, newlyUnlocked: \[\], awardedLevelsByUser: \{\} \};/);
  assert.match(storage, /if \(INSIGNIAS_FROZEN\) return \{ revoked: \[\], refundedLevelsByUser: \{\} \};/);
  assert.match(storage, /\/\/ The insignia loadout is locked as-is[^\n]*\n\s+if \(INSIGNIAS_FROZEN\) return state;/);
  assert.match(read('lib/store.ts'), /legacyInsigniaBonusActive\(new Date\(\), get\(\)\.automaticSaleConfig\.timezone[^)]*\)\n\s+\? loadoutBonusFromIds\(equipped, unlocked\)\n\s+: 0;/);
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
