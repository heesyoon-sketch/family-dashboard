import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { User } from '../db';
import {
  buildAchievementAuditRows,
  buildPersistedAchievementSnapshot,
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

test('achievement audit events are converted to the RPC row contract', () => {
  const rows = buildAchievementAuditRows([{
    familyId: 'fam-1',
    userId: 'kid',
    achievementId: 'year-active-days-365',
    eventType: 'REVOKED',
    pointsDelta: -60,
    taskCompletionId: 'completion-1',
    revocationWindowStart: new Date('2026-06-12T13:00:00.000Z'),
    revocationWindowEnd: new Date('2026-06-13T00:00:00.000Z'),
    occurredAt: new Date('2026-06-12T13:05:00.000Z'),
    source: 'task_undo',
    detail: { reason: 'requirement_unmet_after_undo' },
  }]);

  assert.deepEqual(rows, [{
    family_id: 'fam-1',
    user_id: 'kid',
    achievement_id: 'year-active-days-365',
    event_type: 'REVOKED',
    points_delta: -60,
    task_completion_id: 'completion-1',
    revocation_window_start: '2026-06-12T13:00:00.000Z',
    revocation_window_end: '2026-06-13T00:00:00.000Z',
    occurred_at: '2026-06-12T13:05:00.000Z',
    source: 'task_undo',
    detail: { reason: 'requirement_unmet_after_undo' },
  }]);
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

// Unlock progress is engine-owned and remote-authoritative once a remote row
// exists. Otherwise a stale browser cache can resurrect shields that were
// repaired or revoked in the database.
test('remote unlock state wins over stale local unlocks during a merge', () => {
  const child = user('kid', '2026-01-01T00:00:00.000Z');
  const local = childState({ unlockedAtByAchievementId: { 'stale-shield': '2026-05-10T00:00:00.000Z' } });
  const remote = childState({ unlockedAtByAchievementId: { 'real-shield': '2026-05-11T00:00:00.000Z' } });

  const merged = mergeChildState(child, local, remote, false);
  assert.deepEqual(merged.unlockedAtByAchievementId, {
    'real-shield': '2026-05-11T00:00:00.000Z',
  });
});

test('remote loadout wins over stale local intent outside an active local write', () => {
  const child = user('kid', '2026-01-01T00:00:00.000Z');
  const staleLocal = childState({
    unlockedAtByAchievementId: { 'weekly-spark': '2026-05-10T00:00:00.000Z' },
    equippedInsigniaIds: [],
  });
  const remote = childState({
    unlockedAtByAchievementId: { 'weekly-spark': '2026-05-10T00:00:00.000Z' },
    equippedInsigniaIds: ['weekly-spark'],
  });

  const merged = mergeChildState(child, staleLocal, remote, true);
  assert.deepEqual(merged.equippedInsigniaIds, ['weekly-spark']);
});

test('persisted shield snapshot never flashes a stored unlock as locked', () => {
  const child = user('kid', '2026-01-01T00:00:00.000Z');
  const state = familyStateWith(child, {
    unlockedAtByAchievementId: { 'first-spark': '2026-05-10T00:00:00.000Z' },
    equippedInsigniaIds: ['first-spark'],
  });
  const snapshot = buildPersistedAchievementSnapshot(state, [child], { [child.id]: [] });
  const firstSpark = snapshot[child.id].find(shield => shield.achievementId === 'first-spark');

  assert.equal(firstSpark?.isUnlocked, true);
  assert.equal(firstSpark?.unlockedAt, '2026-05-10T00:00:00.000Z');
});

// Regression: revokeUnmetAchievements re-derives every badge from a rolling
// 370-day window after an undo. Long-horizon and peak badges must not be
// stripped just because old data aged out or the metric naturally receded.
test('cumulative requirements are revocable; peaks/streaks/quests are not', () => {
  // Monotonic cumulative-since-baseline counts — an undo can legitimately drop
  // these below target, so they stay revocable.
  for (const type of ['totalCompletions', 'activeDays', 'daysWithAtLeast', 'categoryCompletions', 'categoryActiveDays', 'comboDays', 'teamSameDay', 'perfectDays'] as const) {
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

test('routine shield sync never revokes or unequips stored shields', () => {
  const source = readFileSync(join(process.cwd(), 'lib/achievements/storage.ts'), 'utf8');
  const routineSync = source.slice(
    source.indexOf('export async function syncAchievements('),
    source.indexOf('export async function revokeUnmetAchievements('),
  );

  assert.doesNotMatch(routineSync, /eventType:\s*'REVOKED'/);
  assert.doesNotMatch(routineSync, /equippedInsigniaIds\s*=\s*.*filter/);
});

test('shield UI components consume the central snapshot instead of starting family syncs', () => {
  for (const file of ['components/EquippedInsigniaStrip.tsx', 'components/InsigniaWall.tsx']) {
    const source = readFileSync(join(process.cwd(), file), 'utf8');
    assert.doesNotMatch(source, /syncAchievements(?:Once)?\s*\(/, `${file} must not start a network sync`);
    assert.match(source, /useShieldSnapshot/);
  }
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

test('achievement audit ledger is append-only and family-scoped', () => {
  const migration = readFileSync(
    join(process.cwd(), 'supabase/migrations/087_achievement_audit_events.sql'),
    'utf8',
  );

  assert.match(migration, /create table if not exists public\.achievement_audit_events/);
  assert.match(migration, /event_type in \('UNLOCKED', 'BONUS_AWARDED', 'REVOKED', 'BONUS_REFUNDED'\)/);
  assert.match(migration, /alter table public\.achievement_audit_events enable row level security/);
  assert.match(migration, /create policy achievement_audit_events_family_select/);
  assert.match(migration, /using \(public\.is_family_member\(family_id\)\)/);
  assert.match(migration, /create or replace function public\.record_achievement_audit_events/);
  assert.match(migration, /not exists \(\s*select 1\s*from public\.users u\s*where u\.id = v_user_id\s*and u\.family_id = v_family_id/s);
  assert.doesNotMatch(migration, /for insert to authenticated/);
  assert.doesNotMatch(migration, /for update to authenticated/);
  assert.doesNotMatch(migration, /for delete to authenticated/);
});

test('achievement bonus activity feed writes use UUID member ids', () => {
  const migration = readFileSync(
    join(process.cwd(), 'supabase/migrations/088_fix_achievement_activity_user_cast.sql'),
    'utf8',
  );

  assert.match(migration, /create or replace function public\.award_achievement_bonus/);
  assert.match(migration, /create or replace function public\.revoke_achievement_bonus/);
  assert.match(migration, /select u\.family_id, u\.id::uuid\s+into v_family_id, v_activity_user_id/s);
  assert.match(migration, /v_activity_user_id,\s+'SYSTEM_MESSAGE'/);
  assert.doesNotMatch(migration, /\n\s+p_user_id,\s+'SYSTEM_MESSAGE'/);
});

test('task completion windows are unique per local day and time window', () => {
  const migration = readFileSync(
    join(process.cwd(), 'supabase/migrations/089_prevent_duplicate_task_completion_windows.sql'),
    'utf8',
  );

  assert.match(migration, /create unique index if not exists task_completions_one_per_task_window_idx/);
  assert.match(migration, /completed_at at time zone 'America\/Toronto'/);
  assert.match(migration, /extract\(hour from completed_at at time zone 'America\/Toronto'\) < 13/);
});

test('task completions snapshot achievement categories for rename-safe shields', () => {
  const migration = readFileSync(
    join(process.cwd(), 'supabase/migrations/090_snapshot_completion_achievement_categories.sql'),
    'utf8',
  );

  assert.match(migration, /add column if not exists achievement_categories text\[\]/);
  assert.match(migration, /public\.task_achievement_categories/);
  assert.match(migration, /set achievement_categories = public\.task_achievement_categories/);
  assert.match(migration, /achievement_categories\s*\)/);
  assert.match(migration, /v_achievement_categories/);
});

test('database guard blocks stale clients from deleting shield state', () => {
  const migration = readFileSync(
    join(process.cwd(), 'supabase/migrations/091_guard_shield_state_replacements.sql'),
    'utf8',
  );

  assert.match(migration, /create trigger trg_achievement_states_guard_replacement/);
  assert.match(migration, /new\.unlocked_at_by_achievement_id[\s\S]*old\.unlocked_at_by_achievement_id/);
  assert.match(migration, /public\.merge_jsonb_text_arrays\([\s\S]*old\.equipped_insignia_ids/);
  assert.match(migration, /replace_achievement_state_intent[\s\S]*security definer/);
  assert.match(migration, /replace_achievement_unlock_state[\s\S]*security definer/);
  assert.match(migration, /public\.is_family_member\(p_family_id\)/);

  const lockMigration = readFileSync(
    join(process.cwd(), 'supabase/migrations/092_lock_legacy_shield_writes.sql'),
    'utf8',
  );
  assert.match(lockMigration, /new\.unlocked_at_by_achievement_id := old\.unlocked_at_by_achievement_id/);
  assert.match(lockMigration, /new\.equipped_insignia_ids := old\.equipped_insignia_ids/);
  assert.match(lockMigration, /merge_achievement_unlock_state[\s\S]*security definer/);
  assert.match(lockMigration, /public\.is_family_member\(p_family_id\)/);

  const auditGuardMigration = readFileSync(
    join(process.cwd(), 'supabase/migrations/093_guard_shield_audit_events.sql'),
    'utf8',
  );
  assert.match(auditGuardMigration, /new\.event_type = 'REVOKED'/);
  assert.match(auditGuardMigration, /new\.source not in \('task_undo', 'revokeUnmetAchievements'\)/);
  assert.match(auditGuardMigration, /before insert on public\.achievement_audit_events/);

  const permanentClaimsMigration = readFileSync(
    join(process.cwd(), 'supabase/migrations/094_make_shield_bonus_claims_permanent.sql'),
    'utf8',
  );
  assert.match(permanentClaimsMigration, /add column if not exists refunded_at/);
  assert.match(permanentClaimsMigration, /'awarded', v_award_id is not null/);
  assert.match(permanentClaimsMigration, /on conflict \(user_id, achievement_id\) do nothing/);
  assert.doesNotMatch(permanentClaimsMigration, /delete from public\.achievement_awards/);
  assert.match(permanentClaimsMigration, /insert into public\.achievement_awards[\s\S]*jsonb_object_keys/);
});
