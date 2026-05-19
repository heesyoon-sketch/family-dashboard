import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { User } from '../db';
import {
  defaultUnlockBaselineAt,
  normaliseChildAchievementState,
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
