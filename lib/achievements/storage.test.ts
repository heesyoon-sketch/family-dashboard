import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { User } from '../db';
import {
  buildPersistRows,
  defaultUnlockBaselineAt,
  normaliseChildAchievementState,
  ALL_COLUMNS,
  INTENT_COLUMNS,
  UNLOCK_COLUMNS,
  type FamilyAchievementState,
} from './storage';

function user(id: string, createdAt: string): User {
  return {
    id,
    name: id,
    role: 'CHILD',
    theme: 'dark_minimal',
    displayOrder: 0,
    createdAt: new Date(createdAt),
  };
}

test('shield baseline starts at the reset date for existing members', () => {
  assert.equal(
    defaultUnlockBaselineAt(user('older-child', '2026-01-01T00:00:00.000Z')),
    '2026-05-09T00:00:00.000Z',
  );
});

test('shield baseline starts at member creation for newer members', () => {
  assert.equal(
    defaultUnlockBaselineAt(user('new-child', '2026-05-12T15:30:00.000Z')),
    '2026-05-12T15:30:00.000Z',
  );
});

test('empty local shield state is recoverable from the reset baseline', () => {
  const child = user('kid', '2026-01-01T00:00:00.000Z');
  const state = normaliseChildAchievementState(child, {
    childId: child.id,
    unlockBaselineAt: '2026-05-18T00:00:00.000Z',
  });

  assert.equal(state.unlockBaselineAt, '2026-05-09T00:00:00.000Z');
  assert.deepEqual(state.unlockedAtByAchievementId, {});
});

test('stored shield state is sanitized without crossing family boundaries', () => {
  const child = user('kid', '2026-01-01T00:00:00.000Z');
  const state = normaliseChildAchievementState(child, {
    childId: 'stale-id',
    equippedInsigniaIds: ['weekly-spark', 123 as unknown as string],
    pinnedAchievementIds: ['team-shield'],
    unlockedAtByAchievementId: { 'weekly-spark': '2026-05-10T00:00:00.000Z', bad: 7 as unknown as string },
    questClaims: { today: '2026-05-10', invalid: null as unknown as string },
  });

  assert.equal(state.childId, child.id);
  assert.deepEqual(state.equippedInsigniaIds, ['weekly-spark']);
  assert.deepEqual(state.unlockedAtByAchievementId, {
    'weekly-spark': '2026-05-10T00:00:00.000Z',
  });
  assert.deepEqual(state.questClaims, { today: '2026-05-10' });
});

function familyStateWith(child: User, stored: Partial<Parameters<typeof normaliseChildAchievementState>[1]>): FamilyAchievementState {
  return {
    familyId: 'fam-1',
    children: {
      [child.id]: normaliseChildAchievementState(child, { childId: child.id, ...stored }),
    },
    updatedAt: '2026-05-10T00:00:00.000Z',
  };
}

// Regression: equipped shields were spontaneously un-equipping because every
// writer upserted the *whole* row. A background syncAchievements (which only
// changes unlock progress) would snapshot the loadout, await a slow fetch,
// then write its stale snapshot back — reverting any equip made meanwhile.
// The fix scopes each write to the columns it owns; these tests pin that down.
test('unlock writes never carry the loadout columns', () => {
  const child = user('kid', '2026-01-01T00:00:00.000Z');
  const state = familyStateWith(child, {
    equippedInsigniaIds: ['weekly-spark'],
    pinnedAchievementIds: ['team-shield'],
    unlockedAtByAchievementId: { 'weekly-spark': '2026-05-10T00:00:00.000Z' },
  });

  const rows = buildPersistRows(state, UNLOCK_COLUMNS);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].family_id, 'fam-1');
  assert.equal(rows[0].user_id, child.id);
  // The engine path must not write intent columns, or a stale snapshot would
  // un-equip / un-pin what the user just set from another code path.
  assert.ok(!('equipped_insignia_ids' in rows[0]));
  assert.ok(!('pinned_achievement_ids' in rows[0]));
  assert.ok(!('quest_claims' in rows[0]));
  assert.ok('unlocked_at_by_achievement_id' in rows[0]);
});

test('intent writes never carry the unlock columns', () => {
  const child = user('kid', '2026-01-01T00:00:00.000Z');
  const state = familyStateWith(child, { equippedInsigniaIds: ['weekly-spark'] });

  const rows = buildPersistRows(state, INTENT_COLUMNS);
  assert.deepEqual(rows[0].equipped_insignia_ids, ['weekly-spark']);
  assert.ok(!('unlocked_at_by_achievement_id' in rows[0]));
  assert.ok(!('awarded_achievement_ids' in rows[0]));
  assert.ok(!('unlock_baseline_at' in rows[0]));
});

test('every row always carries the composite primary key', () => {
  const child = user('kid', '2026-01-01T00:00:00.000Z');
  const state = familyStateWith(child, {});
  for (const columns of [ALL_COLUMNS, UNLOCK_COLUMNS, INTENT_COLUMNS]) {
    const [row] = buildPersistRows(state, columns);
    assert.equal(row.family_id, 'fam-1');
    assert.equal(row.user_id, child.id);
  }
});

test('the intent and unlock column sets are disjoint and cover every column', () => {
  const overlap = INTENT_COLUMNS.filter(c => UNLOCK_COLUMNS.includes(c));
  assert.deepEqual(overlap, [], 'a column owned by both concerns would re-introduce the clobber');
  assert.equal(new Set(ALL_COLUMNS).size, UNLOCK_COLUMNS.length + INTENT_COLUMNS.length);
});

test('shield persistence migration is family-scoped and RLS protected', () => {
  const migration = readFileSync(
    join(process.cwd(), 'supabase/migrations/086_persist_family_shield_state.sql'),
    'utf8',
  );

  assert.match(migration, /primary key \(family_id, user_id\)/);
  assert.match(migration, /alter table public\.achievement_states enable row level security/);
  assert.match(migration, /public\.is_family_member\(family_id\)/);
  assert.match(migration, /u\.family_id = achievement_states\.family_id/);
});
