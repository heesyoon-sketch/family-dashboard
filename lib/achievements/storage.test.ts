import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { User } from '../db';
import {
  buildPersistRows,
  canRevokeStoredAchievement,
  completionWindowCoversBaseline,
  defaultUnlockBaselineAt,
  isRevocableRequirement,
  mergeChildState,
  normaliseChildAchievementState,
  ALL_COLUMNS,
  COMPLETION_FETCH_WINDOW_DAYS,
  INTENT_COLUMNS,
  UNLOCK_COLUMNS,
  type ChildAchievementState,
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

function childState(stored: Partial<ChildAchievementState>): ChildAchievementState {
  return normaliseChildAchievementState(user('kid', '2026-01-01T00:00:00.000Z'), {
    childId: 'kid',
    ...stored,
  });
}

// Regression: clearing your loadout used to bounce back. mergeChildState used
// "non-empty side wins", so an intentional clear (empty) always lost to a stale
// non-empty copy — shields silently re-equipping themselves.
test('clearing the loadout on the preferred side wins over a stale copy', () => {
  const child = user('kid', '2026-01-01T00:00:00.000Z');
  // Preferred side is meaningful (has unlocks) but the user emptied the loadout.
  const cleared = childState({
    unlockedAtByAchievementId: { 'weekly-spark': '2026-05-10T00:00:00.000Z' },
    equippedInsigniaIds: [],
    pinnedAchievementIds: [],
  });
  const stale = childState({
    unlockedAtByAchievementId: { 'weekly-spark': '2026-05-10T00:00:00.000Z' },
    equippedInsigniaIds: ['weekly-spark'],
    pinnedAchievementIds: ['weekly-spark'],
  });

  // local is the preferred side (preferRemote = false).
  const merged = mergeChildState(child, cleared, stale, false);
  assert.deepEqual(merged.equippedInsigniaIds, []);
  assert.deepEqual(merged.pinnedAchievementIds, []);
});

// But an empty *fresh* record (e.g. first load on a new device) carries no
// intent, so it must not wipe a real loadout that lives on the other side.
test('a fresh empty preferred side falls back to the real loadout', () => {
  const child = user('kid', '2026-01-01T00:00:00.000Z');
  const fresh = childState({}); // no unlocks, no loadout — brand new
  const real = childState({
    unlockedAtByAchievementId: { 'weekly-spark': '2026-05-10T00:00:00.000Z' },
    equippedInsigniaIds: ['weekly-spark'],
    pinnedAchievementIds: ['weekly-spark'],
  });

  // remote is the real side; fresh local is (wrongly) preferred by timestamp.
  const merged = mergeChildState(child, fresh, real, false);
  assert.deepEqual(merged.equippedInsigniaIds, ['weekly-spark']);
  assert.deepEqual(merged.pinnedAchievementIds, ['weekly-spark']);
});

// Unlocks are monotonic regardless of which side is preferred — never lost.
test('unlocks are unioned across sides during a merge', () => {
  const child = user('kid', '2026-01-01T00:00:00.000Z');
  const a = childState({ unlockedAtByAchievementId: { 'a-shield': '2026-05-10T00:00:00.000Z' } });
  const b = childState({ unlockedAtByAchievementId: { 'b-shield': '2026-05-11T00:00:00.000Z' } });

  const merged = mergeChildState(child, a, b, true);
  assert.deepEqual(Object.keys(merged.unlockedAtByAchievementId).sort(), ['a-shield', 'b-shield']);
});

// Regression: revokeUnmetAchievements re-derives every badge from a rolling
// 370-day window after an undo. Long-horizon and peak badges must not be
// stripped just because old data aged out or the metric naturally receded.
test('cumulative requirements are revocable; peaks/streaks/quests are not', () => {
  // Monotonic cumulative-since-baseline counts — an undo can legitimately drop
  // these below target, so they stay revocable.
  for (const type of ['totalCompletions', 'activeDays', 'daysWithAtLeast', 'categoryCompletions', 'comboDays', 'teamSameDay', 'perfectDays'] as const) {
    assert.equal(isRevocableRequirement(type), true, `${type} should be revocable`);
  }
  // Peaks, live streaks, and current-period quests recede for reasons unrelated
  // to the undone completion — keep them once earned.
  for (const type of ['dailyPersonalBest', 'weeklyPersonalBest', 'gentleFrequency', 'dailyStreak', 'weeklyQuest', 'monthlyQuest'] as const) {
    assert.equal(isRevocableRequirement(type), false, `${type} should not be revocable`);
  }
});

test('revocation only trusts data that reaches back to the baseline', () => {
  const now = new Date('2027-08-01T00:00:00.000Z');
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - COMPLETION_FETCH_WINDOW_DAYS);

  // Baseline inside the fetch window → we can see the full history → trustable.
  assert.equal(completionWindowCoversBaseline(now.toISOString(), now), true);
  assert.equal(completionWindowCoversBaseline(windowStart.toISOString(), now), true);

  // Baseline older than the window → early history is invisible → don't revoke.
  const justBeforeWindow = new Date(windowStart.getTime() - 86_400_000);
  assert.equal(completionWindowCoversBaseline(justBeforeWindow.toISOString(), now), false);

  // A garbage baseline is treated as "can't trust it".
  assert.equal(completionWindowCoversBaseline('not-a-date', now), false);
});

test('a one-year-old baseline keeps long-horizon shields safe from revocation', () => {
  // The exact failure mode reported: ~13 months after the shield journey began,
  // the 370-day window no longer reaches the baseline, so the year-active-days
  // badge can no longer be recomputed faithfully and must not be revoked.
  const baseline = '2026-05-09T00:00:00.000Z';
  const thirteenMonthsLater = new Date('2027-06-20T00:00:00.000Z');
  assert.equal(completionWindowCoversBaseline(baseline, thirteenMonthsLater), false);
});

test('today undo cannot revoke shields unlocked before the undone task window', () => {
  const undoWindowStart = new Date('2026-06-12T13:00:00.000Z');

  assert.equal(
    canRevokeStoredAchievement({
      requirementType: 'activeDays',
      unlockedAt: '2026-06-01T09:00:00.000Z',
      revocationWindowStart: undoWindowStart,
    }),
    false,
    'a historical long-horizon shield was not caused by the current undo window',
  );

  assert.equal(
    canRevokeStoredAchievement({
      requirementType: 'activeDays',
      unlockedAt: '2026-06-12T13:00:00.000Z',
      revocationWindowStart: undoWindowStart,
    }),
    true,
    'a shield unlocked inside the undone task window may have been caused by that task',
  );

  assert.equal(
    canRevokeStoredAchievement({
      requirementType: 'dailyPersonalBest',
      unlockedAt: '2026-06-12T13:05:00.000Z',
      revocationWindowStart: undoWindowStart,
    }),
    false,
    'peak-style milestones stay non-revocable even when unlocked in the window',
  );
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
