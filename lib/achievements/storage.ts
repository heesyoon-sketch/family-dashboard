'use client';

import { legacyRecurrenceToDays, type Level, type Task, type User } from '@/lib/db';
import { createBrowserSupabase } from '@/lib/supabase';
import { ACHIEVEMENTS, HABIT_CATEGORIES, VISUAL_STYLE_DEFINITIONS, type HabitCategory, type RequirementType } from './definitions';
import { evaluateAchievementsForChild, type AchievementCompletion, type AchievementProgress } from './engine';

export interface ChildAchievementState {
  childId: string;
  unlockedAtByAchievementId: Record<string, string>;
  awardedAchievementIds: string[];
  unlockedVisualStyleIds: string[];
  pinnedAchievementIds: string[];
  /** Shields the member has actively equipped, in slot order. Length
   *  is bounded by the member's level (full set unlocks at Lv.10). */
  equippedInsigniaIds: string[];
  questClaims: Record<string, string>;
  /** ISO timestamp marking the start of this member's shield journey.
   *  Achievement metrics ignore completions before this point, so a fresh
   *  family begins with empty progress and unlocks shields as they go. */
  unlockBaselineAt: string;
}

export interface FamilyAchievementState {
  familyId: string;
  children: Record<string, ChildAchievementState>;
  updatedAt: string;
}

export interface AchievementSyncResult {
  state: FamilyAchievementState;
  achievementsByChild: Record<string, AchievementProgress[]>;
  newlyUnlocked: AchievementProgress[];
}

export const SHIELD_STATE_CHANGED_EVENT = 'fambit:shield-state-changed';

export interface ShieldStateChangedDetail {
  familyId: string;
  state: FamilyAchievementState;
  achievementsByChild?: Record<string, AchievementProgress[]>;
}

const _latestShieldSnapshots = new Map<string, ShieldStateChangedDetail>();

export function getLatestShieldSnapshot(familyId: string): ShieldStateChangedDetail | undefined {
  return _latestShieldSnapshots.get(familyId);
}

export function subscribeToShieldState(
  listener: (detail: ShieldStateChangedDetail) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handle = (event: Event) => {
    listener((event as CustomEvent<ShieldStateChangedDetail>).detail);
  };
  window.addEventListener(SHIELD_STATE_CHANGED_EVENT, handle);
  return () => window.removeEventListener(SHIELD_STATE_CHANGED_EVENT, handle);
}

function notifyShieldStateChanged(detail: ShieldStateChangedDetail): void {
  const previous = _latestShieldSnapshots.get(detail.familyId);
  const stableDetail: ShieldStateChangedDetail = {
    ...detail,
    achievementsByChild: detail.achievementsByChild ?? previous?.achievementsByChild,
  };
  _latestShieldSnapshots.set(detail.familyId, stableDetail);
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ShieldStateChangedDetail>(SHIELD_STATE_CHANGED_EVENT, { detail: stableDetail }));
}

export type AchievementAuditEventType = 'UNLOCKED' | 'BONUS_AWARDED' | 'REVOKED' | 'BONUS_REFUNDED';

export interface AchievementAuditCause {
  userId: string;
  taskId?: string;
  taskCompletionId?: string;
  occurredAt?: Date;
  source?: string;
}

export interface AchievementAuditEventInput {
  familyId: string;
  userId: string;
  achievementId: string;
  eventType: AchievementAuditEventType;
  pointsDelta?: number;
  taskCompletionId?: string;
  revocationWindowStart?: Date;
  revocationWindowEnd?: Date;
  occurredAt?: Date;
  source?: string;
  detail?: Record<string, unknown>;
}

const SHIELD_JOURNEY_BASELINE_AT = '2026-05-09T00:00:00.000Z';

// v5: reset on 2026-05-09 (third pass). The Monthly Quests block had
// targets of 1 on Better Month, Best Month Spark, etc. Combined with the
// over-broad monthlyQuest metric (max of monthActiveDays, monthTotal,
// monthlyImprovement, comebackCount) those epic shields unlocked on a
// single task. Every Monthly Quest target now sits at 21+, and we wipe
// the v4 unlock map so kids can't carry over the over-easy unlocks.
function storageKey(familyId: string): string {
  return `fambit_shield_wall_v5_${familyId}`;
}

export function defaultUnlockBaselineAt(child?: Pick<User, 'createdAt'>): string {
  const resetAt = new Date(SHIELD_JOURNEY_BASELINE_AT);
  const createdAt = child?.createdAt instanceof Date ? child.createdAt : null;
  if (!createdAt || Number.isNaN(createdAt.getTime())) return resetAt.toISOString();
  return new Date(Math.max(resetAt.getTime(), createdAt.getTime())).toISOString();
}

function emptyChildState(childId: string, baselineAt?: string): ChildAchievementState {
  return {
    childId,
    unlockedAtByAchievementId: {},
    awardedAchievementIds: [],
    unlockedVisualStyleIds: [],
    pinnedAchievementIds: [],
    equippedInsigniaIds: [],
    questClaims: {},
    unlockBaselineAt: baselineAt ?? defaultUnlockBaselineAt(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function stringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

function hasMeaningfulChildState(state?: Partial<ChildAchievementState>): boolean {
  if (!state) return false;
  return (
    Object.keys(state.unlockedAtByAchievementId ?? {}).length > 0 ||
    (state.awardedAchievementIds ?? []).length > 0 ||
    (state.unlockedVisualStyleIds ?? []).length > 0 ||
    (state.pinnedAchievementIds ?? []).length > 0 ||
    (state.equippedInsigniaIds ?? []).length > 0 ||
    Object.keys(state.questClaims ?? {}).length > 0
  );
}

function earliestIso(...values: Array<string | undefined>): string | undefined {
  const valid = values
    .map(value => value ? new Date(value) : null)
    .filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()));
  if (valid.length === 0) return undefined;
  return new Date(Math.min(...valid.map(value => value.getTime()))).toISOString();
}

function latestIso(...values: Array<string | undefined>): string {
  const valid = values
    .map(value => value ? new Date(value) : null)
    .filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()));
  if (valid.length === 0) return new Date().toISOString();
  return new Date(Math.max(...valid.map(value => value.getTime()))).toISOString();
}

function dateIso(value: Date | undefined): string | undefined {
  if (!value || Number.isNaN(value.getTime())) return undefined;
  return value.toISOString();
}

export function buildAchievementAuditRows(events: readonly AchievementAuditEventInput[]): Array<Record<string, unknown>> {
  return events.map(event => ({
    family_id: event.familyId,
    user_id: event.userId,
    achievement_id: event.achievementId,
    event_type: event.eventType,
    points_delta: event.pointsDelta ?? 0,
    task_completion_id: event.taskCompletionId,
    revocation_window_start: dateIso(event.revocationWindowStart),
    revocation_window_end: dateIso(event.revocationWindowEnd),
    occurred_at: dateIso(event.occurredAt) ?? new Date().toISOString(),
    source: event.source ?? 'achievement_engine',
    detail: event.detail ?? {},
  }));
}

async function recordAchievementAuditEvents(events: readonly AchievementAuditEventInput[]): Promise<void> {
  if (typeof window === 'undefined' || events.length === 0) return;
  try {
    const supabase = createBrowserSupabase();
    const { error } = await supabase.rpc('record_achievement_audit_events', {
      p_events: buildAchievementAuditRows(events),
    });
    if (error) throw error;
  } catch (error) {
    console.warn('[achievements] failed to record audit events', error);
  }
}

function achievementAuditDetail(
  achievement: AchievementProgress,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    title: achievement.title,
    category: achievement.category,
    rarity: achievement.rarity,
    tier: achievement.tier,
    requirementType: achievement.requirementType,
    requirementValue: achievement.requirementValue,
    progressCurrent: achievement.progressCurrent,
    progressTarget: achievement.progressTarget,
    progressPercent: achievement.progressPercent,
    rewardPoints: achievement.rewardPoints ?? 0,
    unlocksVisualStyleIds: achievement.unlocksVisualStyleIds ?? [],
    ...extra,
  };
}

function inferCauseTaskCompletionId(
  completions: readonly AchievementCompletion[],
  cause?: AchievementAuditCause,
): string | undefined {
  if (cause?.taskCompletionId) return cause.taskCompletionId;
  if (!cause?.taskId) return undefined;

  const candidates = completions
    .filter(completion => completion.taskId === cause.taskId && completion.id)
    .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
  if (candidates.length === 0) return undefined;

  const causeTime = cause.occurredAt?.getTime();
  if (!Number.isFinite(causeTime)) return candidates[0].id;

  const closest = candidates
    .map(completion => ({
      completion,
      distance: Math.abs(completion.completedAt.getTime() - causeTime!),
    }))
    .sort((a, b) => a.distance - b.distance)[0];
  return closest?.completion.id;
}

function auditCauseDetail(cause?: AchievementAuditCause, taskCompletionId?: string): Record<string, unknown> | undefined {
  if (!cause && !taskCompletionId) return undefined;
  return {
    userId: cause?.userId,
    taskId: cause?.taskId,
    taskCompletionId,
    occurredAt: dateIso(cause?.occurredAt),
    source: cause?.source,
  };
}

export function normaliseChildAchievementState(
  child: Pick<User, 'id' | 'createdAt'>,
  stored?: Partial<ChildAchievementState>,
): ChildAchievementState {
  const defaultBaseline = defaultUnlockBaselineAt(child);
  const base = emptyChildState(child.id, defaultBaseline);
  const meaningful = hasMeaningfulChildState(stored);
  const baseline = meaningful
    ? (earliestIso(stored?.unlockBaselineAt, defaultBaseline) ?? defaultBaseline)
    : defaultBaseline;

  return {
    ...base,
    ...(stored ?? {}),
    childId: child.id,
    unlockedAtByAchievementId: stringRecord(stored?.unlockedAtByAchievementId),
    awardedAchievementIds: stringArray(stored?.awardedAchievementIds),
    unlockedVisualStyleIds: stringArray(stored?.unlockedVisualStyleIds),
    pinnedAchievementIds: stringArray(stored?.pinnedAchievementIds),
    equippedInsigniaIds: stringArray(stored?.equippedInsigniaIds),
    questClaims: stringRecord(stored?.questClaims),
    unlockBaselineAt: baseline,
  };
}

export function loadAchievementState(familyId: string, children: User[]): FamilyAchievementState {
  if (typeof window === 'undefined') {
    return {
      familyId,
      children: Object.fromEntries(children.map(child => [child.id, normaliseChildAchievementState(child)])),
      updatedAt: new Date().toISOString(),
    };
  }
  const raw = localStorage.getItem(storageKey(familyId));
  let parsed: Partial<FamilyAchievementState> = {};
  try {
    parsed = raw ? JSON.parse(raw) as Partial<FamilyAchievementState> : {};
  } catch {
    parsed = {};
  }
  const childStates: Record<string, ChildAchievementState> = {};
  for (const child of children) {
    const stored = parsed.children?.[child.id];
    childStates[child.id] = normaliseChildAchievementState(child, stored);
  }
  return {
    familyId,
    children: childStates,
    updatedAt: latestIso(parsed.updatedAt),
  };
}

function saveAchievementStateLocal(state: FamilyAchievementState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(storageKey(state.familyId), JSON.stringify({ ...state, updatedAt: new Date().toISOString() }));
}

const _pendingIntentWrites = new Map<string, number>();
const _intentWriteChains = new Map<string, Promise<void>>();
const _intentRevisions = new Map<string, number>();

function intentKey(familyId: string, childId: string): string {
  return `${familyId}:${childId}`;
}

function hasPendingIntentWrite(familyId: string, childId: string): boolean {
  return (_pendingIntentWrites.get(intentKey(familyId, childId)) ?? 0) > 0;
}

function intentRevision(familyId: string, childId: string): number {
  return _intentRevisions.get(intentKey(familyId, childId)) ?? 0;
}

function queueIntentPersist(
  state: FamilyAchievementState,
  childId: string,
): void {
  const child = state.children[childId];
  if (!child) return;

  const key = intentKey(state.familyId, childId);
  _pendingIntentWrites.set(key, (_pendingIntentWrites.get(key) ?? 0) + 1);
  _intentRevisions.set(key, intentRevision(state.familyId, childId) + 1);

  const scoped: FamilyAchievementState = {
    ...state,
    children: { [childId]: child },
  };
  const previous = _intentWriteChains.get(key) ?? Promise.resolve();
  const write = previous
    .catch(() => undefined)
    .then(() => persistAchievementIntentExact(scoped, childId));
  _intentWriteChains.set(key, write);
  void write
    .catch(error => {
      console.warn('[achievements] failed to persist shield loadout', error);
    })
    .finally(() => {
      const pending = Math.max(0, (_pendingIntentWrites.get(key) ?? 1) - 1);
      if (pending === 0) _pendingIntentWrites.delete(key);
      else _pendingIntentWrites.set(key, pending);
      if (_intentWriteChains.get(key) === write) _intentWriteChains.delete(key);
    });
}

export function saveAchievementState(
  state: FamilyAchievementState,
  childId: string,
): void {
  saveAchievementStateLocal(state);
  notifyShieldStateChanged({ familyId: state.familyId, state });
  // Persist only the member and intent column that actually changed. Writing
  // every family member here allowed one stale local cache to unequip siblings.
  // Serialising per member also prevents rapid equip taps from landing out of
  // order at Supabase.
  queueIntentPersist(state, childId);
}

interface RemoteAchievementStateRow {
  family_id: string;
  user_id: string;
  unlocked_at_by_achievement_id: Record<string, string> | null;
  awarded_achievement_ids: string[] | null;
  unlocked_visual_style_ids: string[] | null;
  pinned_achievement_ids: string[] | null;
  equipped_insignia_ids: string[] | null;
  quest_claims: Record<string, string> | null;
  unlock_baseline_at: string | null;
  updated_at: string | null;
}

function remoteRowToChildState(row: RemoteAchievementStateRow, child: User): ChildAchievementState {
  return normaliseChildAchievementState(child, {
    childId: child.id,
    unlockedAtByAchievementId: row.unlocked_at_by_achievement_id ?? {},
    awardedAchievementIds: row.awarded_achievement_ids ?? [],
    unlockedVisualStyleIds: row.unlocked_visual_style_ids ?? [],
    pinnedAchievementIds: row.pinned_achievement_ids ?? [],
    equippedInsigniaIds: row.equipped_insignia_ids ?? [],
    questClaims: row.quest_claims ?? {},
    unlockBaselineAt: row.unlock_baseline_at ?? undefined,
  });
}

/** Resolve a user-intent list (loadout / pins) during a local⇄remote merge.
 *
 *  Intent lists are last-writer-wins, and an *intentional clear to empty* is a
 *  legitimate write we must honor. The old "non-empty side wins" rule couldn't:
 *  an empty preferred side always lost to a stale non-empty copy, so clearing
 *  your loadout would silently bounce back — shields re-equipping themselves.
 *
 *  We therefore trust the timestamp-preferred side's value as-is, *including*
 *  empty — but only when that side is a real record. A brand-new/empty record
 *  (e.g. first load on a fresh device, which `loadAchievementState` stamps with
 *  `now`) carries no intent to honor, so we fall back to whichever side
 *  actually has data rather than wiping it. */
function pickIntentList(
  preferred: readonly string[],
  secondary: readonly string[],
  preferredIsMeaningful: boolean,
): string[] {
  return [...(preferredIsMeaningful ? preferred : secondary)];
}

export function mergeChildState(
  child: User,
  local: ChildAchievementState,
  remote: ChildAchievementState | undefined,
  preferRemote: boolean,
): ChildAchievementState {
  if (!remote) return normaliseChildAchievementState(child, local);
  const preferred = preferRemote ? remote : local;
  const secondary = preferRemote ? local : remote;
  const preferredIsMeaningful = hasMeaningfulChildState(preferred);

  return normaliseChildAchievementState(child, {
    childId: child.id,
    // Unlock columns are engine-owned and remote-authoritative once a remote
    // row exists. Unioning local unlocks here lets stale browser storage
    // resurrect shields that were repaired or revoked on another device.
    unlockedAtByAchievementId: remote.unlockedAtByAchievementId,
    awardedAchievementIds: remote.awardedAchievementIds,
    unlockedVisualStyleIds: remote.unlockedVisualStyleIds,
    pinnedAchievementIds: pickIntentList(preferred.pinnedAchievementIds, secondary.pinnedAchievementIds, preferredIsMeaningful),
    equippedInsigniaIds: pickIntentList(preferred.equippedInsigniaIds, secondary.equippedInsigniaIds, preferredIsMeaningful),
    questClaims: { ...secondary.questClaims, ...preferred.questClaims },
    unlockBaselineAt: remote.unlockBaselineAt,
  });
}

function mergeAchievementStates(
  familyId: string,
  children: User[],
  local: FamilyAchievementState,
  remote: FamilyAchievementState | null,
): FamilyAchievementState {
  if (!remote) return local;
  return {
    familyId,
    children: Object.fromEntries(children.map(child => [
      child.id,
      mergeChildState(
        child,
        local.children[child.id] ?? normaliseChildAchievementState(child),
        remote.children[child.id],
        !hasPendingIntentWrite(familyId, child.id),
      ),
    ])),
    updatedAt: latestIso(local.updatedAt, remote.updatedAt),
  };
}

// Short-window cache so a single task tap doesn't re-fetch achievement_states
// twice (once to compose the loadout bonus, once during syncAchievements
// post-completion). Invalidated immediately by persistAchievementState so
// writes are never read stale from cache.
let _achievementStateCache:
  | { familyId: string; childIds: string; state: FamilyAchievementState; fetchedAt: number }
  | null = null;
const ACHIEVEMENT_STATE_CACHE_TTL_MS = 5_000;

function invalidateAchievementStateCache(): void {
  _achievementStateCache = null;
}

export async function loadPersistedAchievementState(familyId: string, children: User[]): Promise<FamilyAchievementState> {
  const local = loadAchievementState(familyId, children);
  if (typeof window === 'undefined' || children.length === 0) return local;

  const childIdsKey = children.map(c => c.id).sort().join(',');
  const now = Date.now();
  if (
    _achievementStateCache
    && _achievementStateCache.familyId === familyId
    && _achievementStateCache.childIds === childIdsKey
    && now - _achievementStateCache.fetchedAt < ACHIEVEMENT_STATE_CACHE_TTL_MS
  ) {
    return _achievementStateCache.state;
  }

  try {
    const supabase = createBrowserSupabase();
    const { data, error } = await supabase
      .from('achievement_states')
      .select('*')
      .eq('family_id', familyId)
      .in('user_id', children.map(child => child.id));
    if (error) throw error;

    const byChild = new Map(children.map(child => [child.id, child]));
    const remoteRows = (data ?? []) as unknown as RemoteAchievementStateRow[];
    const remote: FamilyAchievementState = {
      familyId,
      children: Object.fromEntries(remoteRows.flatMap(row => {
        const child = byChild.get(row.user_id);
        return child ? [[row.user_id, remoteRowToChildState(row, child)]] : [];
      })),
      updatedAt: latestIso(...remoteRows.map(row => row.updated_at ?? undefined)),
    };
    const merged = mergeAchievementStates(familyId, children, local, remoteRows.length > 0 ? remote : null);
    saveAchievementStateLocal(merged);
    _achievementStateCache = { familyId, childIds: childIdsKey, state: merged, fetchedAt: now };
    return merged;
  } catch (error) {
    console.warn('[achievements] failed to load persisted shield state', error);
    return local;
  }
}

// Columns on `achievement_states`, grouped by the concern that owns them.
//
// Each row mixes two independent concerns: unlock *progress* (driven by the
// evaluation engine) and user *intent* (the loadout the member equipped, what
// they pinned, quest claims). A write must only touch the columns it owns —
// otherwise a stale in-memory snapshot from one concern silently overwrites
// the other. That clobber is what made equipped shields spontaneously
// un-equip: syncAchievements snapshots the loadout, awaits a slow fetch, then
// upserts the whole row — reverting any equip the user made in the meantime.
//
// A partial Supabase upsert emits `INSERT ... ON CONFLICT DO UPDATE SET
// <provided columns>`, so listing only the owned columns leaves the rest
// untouched and lets the two concerns be written concurrently without races.
export type AchievementStateColumn =
  | 'unlocked_at_by_achievement_id'
  | 'awarded_achievement_ids'
  | 'unlocked_visual_style_ids'
  | 'unlock_baseline_at'
  | 'pinned_achievement_ids'
  | 'equipped_insignia_ids'
  | 'quest_claims';

/** Owned by the evaluation engine (syncAchievements / revokeUnmetAchievements). */
export const UNLOCK_COLUMNS: readonly AchievementStateColumn[] = [
  'unlocked_at_by_achievement_id',
  'awarded_achievement_ids',
  'unlocked_visual_style_ids',
  'unlock_baseline_at',
];

/** Owned by direct user intent (equip / pin / quest claim). */
export const INTENT_COLUMNS: readonly AchievementStateColumn[] = [
  'equipped_insignia_ids',
  'pinned_achievement_ids',
  'quest_claims',
];

export const ALL_COLUMNS: readonly AchievementStateColumn[] = [
  ...UNLOCK_COLUMNS,
  ...INTENT_COLUMNS,
];

function columnValue(child: ChildAchievementState, column: AchievementStateColumn): unknown {
  switch (column) {
    case 'unlocked_at_by_achievement_id': return child.unlockedAtByAchievementId;
    case 'awarded_achievement_ids': return child.awardedAchievementIds;
    case 'unlocked_visual_style_ids': return child.unlockedVisualStyleIds;
    case 'unlock_baseline_at': return child.unlockBaselineAt;
    case 'pinned_achievement_ids': return child.pinnedAchievementIds;
    case 'equipped_insignia_ids': return child.equippedInsigniaIds;
    case 'quest_claims': return child.questClaims;
  }
}

/** Build the upsert payload for `persistAchievementState`: the composite
 *  primary key plus only the requested columns. Exported so tests can assert
 *  that a given write path never touches columns it doesn't own. */
export function buildPersistRows(
  state: FamilyAchievementState,
  columns: readonly AchievementStateColumn[] = ALL_COLUMNS,
): Array<Record<string, unknown>> {
  return Object.values(state.children).map(child => {
    const row: Record<string, unknown> = {
      family_id: state.familyId,
      user_id: child.childId,
    };
    for (const column of columns) {
      row[column] = columnValue(child, column);
    }
    return row;
  });
}

export async function persistAchievementState(
  state: FamilyAchievementState,
  columns: readonly AchievementStateColumn[] = ALL_COLUMNS,
): Promise<void> {
  if (typeof window === 'undefined') return;
  const rows = buildPersistRows(state, columns);
  if (rows.length === 0) return;
  invalidateAchievementStateCache();
  const supabase = createBrowserSupabase();
  const { error } = await supabase
    .from('achievement_states')
    .upsert(rows, { onConflict: 'family_id,user_id' });
  if (error) throw error;
}

async function persistAchievementIntentExact(
  state: FamilyAchievementState,
  childId: string,
): Promise<void> {
  if (typeof window === 'undefined') return;
  const child = state.children[childId];
  if (!child) return;
  invalidateAchievementStateCache();
  const supabase = createBrowserSupabase();
  const { error } = await supabase.rpc('replace_achievement_state_intent', {
    p_family_id: state.familyId,
    p_user_id: childId,
    p_equipped_insignia_ids: child.equippedInsigniaIds,
    p_pinned_achievement_ids: child.pinnedAchievementIds,
    p_quest_claims: child.questClaims,
  });
  if (error) throw error;
}

async function persistAchievementUnlockStateExact(state: FamilyAchievementState): Promise<void> {
  if (typeof window === 'undefined') return;
  invalidateAchievementStateCache();
  const supabase = createBrowserSupabase();
  await Promise.all(Object.values(state.children).map(async child => {
    const { error } = await supabase.rpc('replace_achievement_unlock_state', {
      p_family_id: state.familyId,
      p_user_id: child.childId,
      p_unlocked_at_by_achievement_id: child.unlockedAtByAchievementId,
      p_awarded_achievement_ids: child.awardedAchievementIds,
      p_unlocked_visual_style_ids: child.unlockedVisualStyleIds,
      p_unlock_baseline_at: child.unlockBaselineAt,
    });
    if (error) throw error;
  }));
}

async function persistAchievementUnlockStateMerge(state: FamilyAchievementState): Promise<void> {
  if (typeof window === 'undefined') return;
  invalidateAchievementStateCache();
  const supabase = createBrowserSupabase();
  await Promise.all(Object.values(state.children).map(async child => {
    const { error } = await supabase.rpc('merge_achievement_unlock_state', {
      p_family_id: state.familyId,
      p_user_id: child.childId,
      p_unlocked_at_by_achievement_id: child.unlockedAtByAchievementId,
      p_awarded_achievement_ids: child.awardedAchievementIds,
      p_unlocked_visual_style_ids: child.unlockedVisualStyleIds,
      p_unlock_baseline_at: child.unlockBaselineAt,
    });
    if (error) throw error;
  }));
}

export function togglePinnedAchievement(familyId: string, children: User[], childId: string, achievementId: string): FamilyAchievementState {
  const state = loadAchievementState(familyId, children);
  const member = children.find(child => child.id === childId);
  const child = state.children[childId] ?? (member ? normaliseChildAchievementState(member) : emptyChildState(childId));
  const current = child.pinnedAchievementIds.includes(achievementId)
    ? child.pinnedAchievementIds.filter(id => id !== achievementId)
    : [...child.pinnedAchievementIds, achievementId].slice(-5);
  state.children[childId] = { ...child, pinnedAchievementIds: current };
  saveAchievementState(state, childId);
  return state;
}

/** Equip or unequip an insignia, capped to `maxSlots` (typically derived
 *  from the member's level). Equipping a 4th insignia when only 3 slots
 *  are available evicts the oldest. */
export function setEquippedInsignia(
  familyId: string,
  children: User[],
  childId: string,
  achievementId: string,
  equipped: boolean,
  maxSlots: number,
): FamilyAchievementState {
  const state = loadAchievementState(familyId, children);
  const member = children.find(child => child.id === childId);
  const child = state.children[childId] ?? (member ? normaliseChildAchievementState(member) : emptyChildState(childId));
  const current = new Set(child.equippedInsigniaIds);
  if (equipped) {
    current.add(achievementId);
  } else {
    current.delete(achievementId);
  }
  // Preserve original equip order; trim from the head if over capacity.
  const ordered = [
    ...child.equippedInsigniaIds.filter(id => current.has(id)),
    ...Array.from(current).filter(id => !child.equippedInsigniaIds.includes(id)),
  ];
  const trimmed = ordered.slice(Math.max(0, ordered.length - Math.max(0, maxSlots)));
  state.children[childId] = { ...child, equippedInsigniaIds: trimmed };
  saveAchievementState(state, childId);
  return state;
}

/** Trim equipped insignias if a member's level decreased or slot rules changed. */
export function clampEquippedToSlots(
  familyId: string,
  children: User[],
  childId: string,
  maxSlots: number,
): FamilyAchievementState {
  const state = loadAchievementState(familyId, children);
  const member = children.find(child => child.id === childId);
  const child = state.children[childId] ?? (member ? normaliseChildAchievementState(member) : emptyChildState(childId));
  if (child.equippedInsigniaIds.length <= maxSlots) return state;
  state.children[childId] = {
    ...child,
    equippedInsigniaIds: child.equippedInsigniaIds.slice(0, maxSlots),
  };
  saveAchievementState(state, childId);
  return state;
}

// How far back fetchCompletions looks. Anything older than this is invisible
// to the achievement engine, so cumulative metrics it computes are only
// faithful when this window reaches all the way back to a member's baseline.
export const COMPLETION_FETCH_WINDOW_DAYS = 370;
const COMPLETION_CACHE_FULL_REFRESH_MS = 5 * 60 * 1000;
const COMPLETION_CACHE_OVERLAP_MS = 60 * 1000;

type CompletionCache = {
  userKey: string;
  fullLoadedAt: number;
  refreshedAt: number;
  byId: Map<string, AchievementCompletion>;
};

let _completionCache: CompletionCache | null = null;

// Requirement types whose metric naturally recedes for reasons unrelated to
// the specific completion an undo removed — a "best ever" peak, a live streak,
// or a current-week / current-month quest. Re-deriving these from scratch
// after an unrelated undo (or after old data ages out of the fetch window)
// would strip a milestone the member genuinely reached, so we never revoke
// them. Only monotonic cumulative-since-baseline counts remain revocable.
const NON_REVOCABLE_REQUIREMENTS: ReadonlySet<RequirementType> = new Set([
  'dailyPersonalBest',
  'weeklyPersonalBest',
  'gentleFrequency',
  'dailyStreak',
  'weeklyQuest',
  'monthlyQuest',
]);

/** Whether an achievement of this requirement type may be revoked when its
 *  requirement no longer recomputes as met. Peaks, streaks, and current-period
 *  quests are milestones we keep once earned (see NON_REVOCABLE_REQUIREMENTS). */
export function isRevocableRequirement(requirementType: RequirementType): boolean {
  return !NON_REVOCABLE_REQUIREMENTS.has(requirementType);
}

/** A revoke pass is caused by one undo. If the badge was unlocked before the
 *  undone task's completion window, that task cannot have put the badge over
 *  the line, so revoking it would be historical drift rather than undo repair. */
export function canRevokeStoredAchievement(params: {
  requirementType: RequirementType;
  unlockedAt: string | undefined;
  revocationWindowStart?: Date;
}): boolean {
  if (!isRevocableRequirement(params.requirementType)) return false;
  if (!params.revocationWindowStart) return true;

  const windowStartTime = params.revocationWindowStart.getTime();
  const unlockedAtTime = params.unlockedAt ? new Date(params.unlockedAt).getTime() : NaN;
  if (!Number.isFinite(windowStartTime)) return true;
  return Number.isFinite(unlockedAtTime) && unlockedAtTime >= windowStartTime;
}

/** Whether the completion fetch window reaches back to `baselineAt`. When it
 *  doesn't, the engine can't see a member's full history since their shield
 *  journey began, so cumulative metrics are undercounted and revocation based
 *  on them would be a false positive. */
export function completionWindowCoversBaseline(baselineAt: string, now: Date = new Date()): boolean {
  const baselineTime = new Date(baselineAt).getTime();
  if (!Number.isFinite(baselineTime)) return false;
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - COMPLETION_FETCH_WINDOW_DAYS);
  return windowStart.getTime() <= baselineTime;
}

async function fetchCompletions(userIds: string[]): Promise<Record<string, AchievementCompletion[]>> {
  const safeIds = userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'];
  const userKey = [...userIds].sort().join(',');
  const now = Date.now();
  const needsFullRefresh = !_completionCache
    || _completionCache.userKey !== userKey
    || now - _completionCache.fullLoadedAt >= COMPLETION_CACHE_FULL_REFRESH_MS;
  const since = new Date(needsFullRefresh
    ? now - COMPLETION_FETCH_WINDOW_DAYS * 24 * 60 * 60 * 1000
    : _completionCache!.refreshedAt - COMPLETION_CACHE_OVERLAP_MS);
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase
    .from('task_completions')
    .select('id, user_id, task_id, completed_at, points_awarded, achievement_categories')
    .in('user_id', safeIds)
    .gte('completed_at', since.toISOString());
  if (error) throw new Error(error.message);

  const byId = needsFullRefresh
    ? new Map<string, AchievementCompletion>()
    : new Map(_completionCache!.byId);
  if (!needsFullRefresh) {
    // Replace the overlap rather than only appending, so a recent undo/delete
    // removes the completion from the cache as well.
    for (const [id, completion] of byId) {
      if (completion.completedAt.getTime() >= since.getTime()) byId.delete(id);
    }
  }

  const validCategories = new Set<string>(HABIT_CATEGORIES);
  for (const row of data ?? []) {
    const completionId = row.id as string;
    const childId = row.user_id as string;
    const categories = Array.isArray(row.achievement_categories)
      ? row.achievement_categories.filter((category): category is HabitCategory =>
          typeof category === 'string' && validCategories.has(category),
        )
      : undefined;
    const completion: AchievementCompletion = {
      id: completionId,
      childId,
      taskId: row.task_id as string,
      completedAt: new Date(row.completed_at as string),
      pointsAwarded: Number(row.points_awarded ?? 0),
      categories,
    };
    byId.set(completionId, completion);
  }

  _completionCache = {
    userKey,
    fullLoadedAt: needsFullRefresh ? now : _completionCache!.fullLoadedAt,
    refreshedAt: now,
    byId,
  };

  const byChild: Record<string, AchievementCompletion[]> = Object.fromEntries(userIds.map(id => [id, []]));
  for (const completion of byId.values()) {
    if (!(completion.childId in byChild)) continue;
    byChild[completion.childId].push(completion);
  }
  return byChild;
}

async function fetchTasks(userIds: string[], fallback: Record<string, Task[]>): Promise<Record<string, Task[]>> {
  if (userIds.every(id => Object.prototype.hasOwnProperty.call(fallback, id))) {
    return fallback;
  }
  const safeIds = userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'];
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase
    .from('tasks')
    .select('id, user_id, code, title, icon, difficulty, base_points, recurrence, days_of_week, time_window, active, sort_order, streak_count, last_completed_at')
    .in('user_id', safeIds)
    .is('deleted_at', null);
  if (error) {
    // Silently using `fallback` here is what hid migration-060 from us before;
    // log loudly so a missing column or RLS regression isn't invisible.
    console.error('[achievements] fetchTasks failed, using fallback', error);
    return fallback;
  }
  const byUser: Record<string, Task[]> = Object.fromEntries(userIds.map(id => [id, fallback[id] ?? []]));
  for (const row of data ?? []) {
    const task: Task = {
      id: row.id as string,
      userId: row.user_id as string,
      code: (row.code as string | null) ?? undefined,
      title: row.title as string,
      icon: row.icon as string,
      difficulty: row.difficulty as Task['difficulty'],
      basePoints: Number(row.base_points ?? 0),
      recurrence: row.recurrence as string,
      daysOfWeek: ((row.days_of_week as Task['daysOfWeek'] | null) ?? legacyRecurrenceToDays(row.recurrence as string)),
      timeWindow: row.time_window as Task['timeWindow'],
      active: Number(row.active ?? 1),
      sortOrder: Number(row.sort_order ?? 0),
      streakCount: Number(row.streak_count ?? 0),
      lastCompletedAt: row.last_completed_at ? new Date(row.last_completed_at as string) : null,
    };
    byUser[task.userId] = [...(byUser[task.userId] ?? []), task];
  }
  return byUser;
}

type AchievementBonusResult = { level: Level; awarded: boolean };

async function awardBonusPoints(
  childId: string,
  achievement: AchievementProgress,
): Promise<AchievementBonusResult | null> {
  const points = Math.max(0, Math.round(achievement.rewardPoints ?? 0));
  if (points <= 0) return null;
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase.rpc('award_achievement_bonus', {
    p_user_id: childId,
    p_achievement_id: achievement.achievementId,
    p_points: points,
    p_message: `Shield unlocked: ${achievement.title}`,
  });
  if (error || !data) return null;
  const raw = data as {
    awarded?: boolean;
    userId: string;
    currentLevel: number;
    totalPoints: number;
    spendableBalance: number;
    updatedAt: string;
  };
  return {
    awarded: raw.awarded === true,
    level: {
      userId: raw.userId,
      currentLevel: raw.currentLevel,
      totalPoints: raw.totalPoints,
      spendableBalance: raw.spendableBalance,
      updatedAt: new Date(raw.updatedAt),
    },
  };
}

export function buildPersistedAchievementSnapshot(
  state: FamilyAchievementState,
  members: User[],
  tasksByUser: Record<string, Task[]>,
): Record<string, AchievementProgress[]> {
  const emptyCompletionsByChild: Record<string, AchievementCompletion[]> = Object.fromEntries(
    members.map(member => [member.id, []]),
  );
  return Object.fromEntries(members.map(member => {
    const childState = state.children[member.id] ?? emptyChildState(member.id);
    const snapshot = evaluateAchievementsForChild({
      child: member,
      tasks: tasksByUser[member.id] ?? [],
      completions: [],
      allCompletionsByChild: emptyCompletionsByChild,
      unlockedAtByAchievementId: childState.unlockedAtByAchievementId,
      since: childState.unlockBaselineAt ? new Date(childState.unlockBaselineAt) : undefined,
    });
    return [member.id, snapshot.achievements];
  }));
}

/** Seed the external shield store from a meaningful local cache before the
 *  network refresh completes. Empty caches stay unpublished so the UI shows a
 *  loading state instead of flashing a false zero-shield state. */
export function primeShieldSnapshot(
  familyId: string,
  members: User[],
  tasksByUser: Record<string, Task[]>,
): ShieldStateChangedDetail | undefined {
  const current = getLatestShieldSnapshot(familyId);
  if (current) return current;
  const state = loadAchievementState(familyId, members);
  const meaningful = Object.values(state.children).some(hasMeaningfulChildState);
  if (!meaningful) return undefined;
  const detail: ShieldStateChangedDetail = {
    familyId,
    state,
    achievementsByChild: buildPersistedAchievementSnapshot(state, members, tasksByUser),
  };
  notifyShieldStateChanged(detail);
  return getLatestShieldSnapshot(familyId);
}

function unlockStateFingerprint(state: FamilyAchievementState): string {
  return JSON.stringify(Object.values(state.children)
    .sort((a, b) => a.childId.localeCompare(b.childId))
    .map(child => ({
      childId: child.childId,
      unlockedAtByAchievementId: child.unlockedAtByAchievementId,
      awardedAchievementIds: child.awardedAchievementIds,
      unlockedVisualStyleIds: child.unlockedVisualStyleIds,
      unlockBaselineAt: child.unlockBaselineAt,
    })));
}

export interface AchievementSyncParams {
  familyId: string;
  children: User[];
  tasksByUser: Record<string, Task[]>;
  levelsByUser?: Record<string, Level>;
  awardNew?: boolean;
  auditCause?: AchievementAuditCause;
  /** Realtime observers can evaluate and refresh local UI without writing the
   *  same remote rows back and creating a cross-device feedback loop. */
  persist?: boolean;
}

type FullAchievementSyncResult = AchievementSyncResult & { awardedLevelsByUser: Record<string, Level> };

async function runAchievementSync(params: AchievementSyncParams): Promise<FullAchievementSyncResult> {
  // Shield Wall is open to everyone in the family — kids and parents alike.
  const members = params.children;
  const state = await loadPersistedAchievementState(params.familyId, members);
  const initialUnlockFingerprint = unlockStateFingerprint(state);
  const intentRevisionAtStart = new Map(
    members.map(member => [member.id, intentRevision(params.familyId, member.id)]),
  );
  // Paint persisted unlock/equip truth as soon as the lightweight state query
  // returns. The 370-day completion evaluation continues below, but the wall
  // no longer looks empty while those heavier reads are in flight.
  const persistedAchievementsByChild = buildPersistedAchievementSnapshot(state, members, params.tasksByUser);
  notifyShieldStateChanged({
    familyId: params.familyId,
    state,
    achievementsByChild: persistedAchievementsByChild,
  });
  // Fetches are independent — issue them in parallel rather than serially.
  const memberIds = members.map(member => member.id);
  const [completionsByChild, allTasksByUser] = await Promise.all([
    fetchCompletions(memberIds),
    fetchTasks(memberIds, params.tasksByUser),
  ]);
  const achievementsByChild: Record<string, AchievementProgress[]> = {};
  const newlyUnlocked: AchievementProgress[] = [];
  const awardedLevelsByUser: Record<string, Level> = {};
  const auditEvents: AchievementAuditEventInput[] = [];
  const causeTaskCompletionId = params.auditCause
    ? inferCauseTaskCompletionId(completionsByChild[params.auditCause.userId] ?? [], params.auditCause)
    : undefined;
  const causeDetail = auditCauseDetail(params.auditCause, causeTaskCompletionId);

  for (const child of members) {
    const childState = state.children[child.id] ?? emptyChildState(child.id);
    const result = evaluateAchievementsForChild({
      child,
      tasks: allTasksByUser[child.id] ?? [],
      completions: completionsByChild[child.id] ?? [],
      allCompletionsByChild: completionsByChild,
      unlockedAtByAchievementId: childState.unlockedAtByAchievementId,
      since: childState.unlockBaselineAt ? new Date(childState.unlockBaselineAt) : undefined,
    });
    for (const achievement of result.newlyUnlocked) {
      const unlockedAt = achievement.unlockedAt ?? new Date().toISOString();
      childState.unlockedAtByAchievementId[achievement.achievementId] = unlockedAt;
      childState.unlockedVisualStyleIds = Array.from(new Set([
        ...childState.unlockedVisualStyleIds,
        ...(achievement.unlocksVisualStyleIds ?? []),
      ]));
      newlyUnlocked.push(achievement);
      auditEvents.push({
        familyId: params.familyId,
        userId: child.id,
        achievementId: achievement.achievementId,
        eventType: 'UNLOCKED',
        taskCompletionId: causeTaskCompletionId,
        occurredAt: new Date(unlockedAt),
        source: params.auditCause?.source ?? 'syncAchievements',
        detail: achievementAuditDetail(achievement, {
          cause: causeDetail,
        }),
      });

      if (params.awardNew && !childState.awardedAchievementIds.includes(achievement.achievementId)) {
        const bonus = await awardBonusPoints(child.id, achievement);
        if (bonus) {
          // The server receipt is authoritative. Mark a duplicate as handled
          // locally, but never report it as a new award or refresh points.
          childState.awardedAchievementIds.push(achievement.achievementId);
          if (bonus.awarded) {
            awardedLevelsByUser[child.id] = bonus.level;
            auditEvents.push({
              familyId: params.familyId,
              userId: child.id,
              achievementId: achievement.achievementId,
              eventType: 'BONUS_AWARDED',
              pointsDelta: Math.max(0, Math.round(achievement.rewardPoints ?? 0)),
              taskCompletionId: causeTaskCompletionId,
              occurredAt: bonus.level.updatedAt,
              source: params.auditCause?.source ?? 'syncAchievements',
              detail: achievementAuditDetail(achievement, {
                cause: causeDetail,
                totalPoints: bonus.level.totalPoints,
                spendableBalance: bonus.level.spendableBalance,
                currentLevel: bonus.level.currentLevel,
              }),
            });
          }
        }
      }
    }
    state.children[child.id] = childState;
    achievementsByChild[child.id] = result.achievements.map(achievement => ({
      ...achievement,
      isUnlocked: Boolean(childState.unlockedAtByAchievementId[achievement.achievementId]) || achievement.isUnlocked,
      unlockedAt: childState.unlockedAtByAchievementId[achievement.achievementId] ?? achievement.unlockedAt,
    }));
  }

  // A user may equip/unequip while this sync is awaiting completion/task
  // fetches. Preserve that newer local intent before caching or notifying;
  // unlock sync owns progress, never the loadout.
  const latestLocal = loadAchievementState(params.familyId, members);
  for (const child of members) {
    if (intentRevision(params.familyId, child.id) === intentRevisionAtStart.get(child.id)) continue;
    const currentIntent = latestLocal.children[child.id];
    const synced = state.children[child.id];
    if (!currentIntent || !synced) continue;
    synced.equippedInsigniaIds = [...currentIntent.equippedInsigniaIds];
    synced.pinnedAchievementIds = [...currentIntent.pinnedAchievementIds];
    synced.questClaims = { ...currentIntent.questClaims };
  }

  saveAchievementStateLocal(state);
  const unlockStateChanged = unlockStateFingerprint(state) !== initialUnlockFingerprint;
  if (params.persist !== false && unlockStateChanged) {
    // Routine sync can unlock shields but never revokes or changes the user's
    // loadout. Revocation is restricted to the explicit undo path below.
    await persistAchievementUnlockStateMerge(state);
    await recordAchievementAuditEvents(auditEvents);
  }
  const syncResult = { state, achievementsByChild, newlyUnlocked, awardedLevelsByUser };
  notifyShieldStateChanged({ familyId: params.familyId, state, achievementsByChild });
  return syncResult;
}

// Every family has exactly one shield evaluation lane. This prevents a
// completion-triggered sync, a realtime refresh, and a route mount from
// publishing different snapshots out of order.
const _familyAchievementSyncTails = new Map<string, Promise<unknown>>();

export function syncAchievements(params: AchievementSyncParams): Promise<FullAchievementSyncResult> {
  const previous = _familyAchievementSyncTails.get(params.familyId) ?? Promise.resolve();
  const sync = previous
    .catch(() => undefined)
    .then(() => runAchievementSync(params));
  _familyAchievementSyncTails.set(params.familyId, sync);
  const cleanup = () => {
    if (_familyAchievementSyncTails.get(params.familyId) === sync) {
      _familyAchievementSyncTails.delete(params.familyId);
    }
  };
  void sync.then(cleanup, cleanup);
  return sync;
}

const _backgroundAchievementSyncs = new Map<string, Promise<FullAchievementSyncResult>>();
const _backgroundAchievementResults = new Map<string, { result: FullAchievementSyncResult; completedAt: number }>();
const BACKGROUND_SYNC_FRESH_MS = 30_000;

/** Share one background family evaluation across every mounted shield strip
 *  and the Shield Wall. Mutation-driven syncs still call syncAchievements
 *  directly so award/audit context is never swallowed by deduplication. */
export function syncAchievementsOnce(params: {
  familyId: string;
  children: User[];
  tasksByUser: Record<string, Task[]>;
  levelsByUser?: Record<string, Level>;
  persist?: boolean;
  force?: boolean;
}): Promise<FullAchievementSyncResult> {
  const memberKey = params.children.map(child => child.id).sort().join(',');
  const key = `${params.familyId}:${memberKey}:${params.persist === false ? 'local' : 'remote'}`;
  const current = _backgroundAchievementSyncs.get(key);
  if (current) return current;
  const cached = _backgroundAchievementResults.get(key);
  if (!params.force && cached && Date.now() - cached.completedAt < BACKGROUND_SYNC_FRESH_MS) {
    return Promise.resolve(cached.result);
  }
  const { force: _force, ...syncParams } = params;
  void _force;
  const sync = syncAchievements({ ...syncParams, awardNew: false })
    .then(result => {
      _backgroundAchievementResults.set(key, { result, completedAt: Date.now() });
      return result;
    })
    .finally(() => {
      if (_backgroundAchievementSyncs.get(key) === sync) {
        _backgroundAchievementSyncs.delete(key);
      }
    });
  _backgroundAchievementSyncs.set(key, sync);
  return sync;
}

/** Re-evaluate a child's achievements against fresh completion data and
 *  revoke anything that no longer meets its requirement. Used after an undo
 *  so the shield wall stays honest with the underlying activity.
 *
 *  For each revoked achievement we:
 *    - drop it from `unlockedAtByAchievementId` and the local awarded cache
 *    - unequip it if it was in the loadout
 *    - drop any visual styles that were unlocked *only* by this achievement
 *    - call `revoke_achievement_bonus` on the server to refund the points once;
 *      the permanent server receipt still prevents a later duplicate award
 */
export async function revokeUnmetAchievements(params: {
  familyId: string;
  children: User[];
  tasksByUser: Record<string, Task[]>;
  /** Start of the completion window for the task being undone. When provided,
   *  only achievements unlocked during that window are eligible for revocation. */
  revocationWindowStart?: Date;
  revocationWindowEnd?: Date;
  auditCause?: AchievementAuditCause;
}): Promise<{ revoked: AchievementProgress[]; refundedLevelsByUser: Record<string, Level> }> {
  const members = params.children;
  const state = await loadPersistedAchievementState(params.familyId, members);
  const memberIds = members.map(member => member.id);
  const [completionsByChild, allTasksByUser] = await Promise.all([
    fetchCompletions(memberIds),
    fetchTasks(memberIds, params.tasksByUser),
  ]);

  const revoked: AchievementProgress[] = [];
  const refundedLevelsByUser: Record<string, Level> = {};
  const auditEvents: AchievementAuditEventInput[] = [];
  const causeDetail = auditCauseDetail(params.auditCause, params.auditCause?.taskCompletionId);
  // Members whose loadout we actually changed. We only write the equipped
  // column for these, so revoking one member's stale shield can't clobber a
  // sibling's loadout that was equipped during our fetch window.
  const loadoutChanged = new Set<string>();
  const supabase = createBrowserSupabase();

  for (const child of members) {
    const childState = state.children[child.id];
    if (!childState) continue;

    // If our fetch window doesn't reach this member's baseline, the engine
    // can't see their full history since the shield journey began. Cumulative
    // metrics (active days, total completions, …) would be undercounted, so a
    // recompute here would falsely revoke long-earned shields. Skip the member
    // entirely rather than revoke from truncated data.
    if (!completionWindowCoversBaseline(childState.unlockBaselineAt)) continue;

    // Evaluate as if nothing was unlocked yet — gives us the truth of which
    // achievements *currently* meet their requirement based on live data.
    const result = evaluateAchievementsForChild({
      child,
      tasks: allTasksByUser[child.id] ?? [],
      completions: completionsByChild[child.id] ?? [],
      allCompletionsByChild: completionsByChild,
      unlockedAtByAchievementId: {},
      since: childState.unlockBaselineAt ? new Date(childState.unlockBaselineAt) : undefined,
    });
    const stillUnlocked = new Set(
      result.achievements.filter(a => a.isUnlocked).map(a => a.achievementId),
    );

    const previouslyUnlocked = Object.keys(childState.unlockedAtByAchievementId);
    for (const id of previouslyUnlocked) {
      if (stillUnlocked.has(id)) continue;
      const def = ACHIEVEMENTS.find(a => a.achievementId === id);
      if (!def) continue;
      if (!canRevokeStoredAchievement({
        requirementType: def.requirementType,
        unlockedAt: childState.unlockedAtByAchievementId[id],
        revocationWindowStart: params.revocationWindowStart,
      })) continue;

      const previousUnlockedAt = childState.unlockedAtByAchievementId[id];
      const fullDef = result.achievements.find(a => a.achievementId === id);

      // Drop the unlock + local cache marker. The permanent server receipt is
      // authoritative and prevents a future re-earn from paying twice.
      delete childState.unlockedAtByAchievementId[id];
      childState.awardedAchievementIds = childState.awardedAchievementIds.filter(x => x !== id);
      if (childState.equippedInsigniaIds.includes(id)) {
        childState.equippedInsigniaIds = childState.equippedInsigniaIds.filter(eid => eid !== id);
        loadoutChanged.add(child.id);
      }

      // Visual styles can be unlocked by more than one shield, so only
      // revoke a style when no other still-unlocked shield grants it.
      if (def.unlocksVisualStyleIds) {
        for (const styleId of def.unlocksVisualStyleIds) {
          const otherSource = ACHIEVEMENTS.some(a =>
            a.achievementId !== id
            && a.unlocksVisualStyleIds?.includes(styleId)
            && Boolean(childState.unlockedAtByAchievementId[a.achievementId]),
          );
          if (!otherSource) {
            childState.unlockedVisualStyleIds = childState.unlockedVisualStyleIds.filter(v => v !== styleId);
          }
        }
      }

      if (fullDef) {
        auditEvents.push({
          familyId: params.familyId,
          userId: child.id,
          achievementId: id,
          eventType: 'REVOKED',
          taskCompletionId: params.auditCause?.taskCompletionId,
          revocationWindowStart: params.revocationWindowStart,
          revocationWindowEnd: params.revocationWindowEnd,
          occurredAt: new Date(),
          source: params.auditCause?.source ?? 'revokeUnmetAchievements',
          detail: achievementAuditDetail(fullDef, {
            cause: causeDetail,
            previousUnlockedAt,
            reason: 'requirement_unmet_after_undo',
          }),
        });
      }

      // Refund the bonus points this badge originally granted.
      try {
        const { data, error } = await supabase.rpc('revoke_achievement_bonus', {
          p_user_id: child.id,
          p_achievement_id: id,
        });
        if (!error && data) {
          const raw = data as {
            userId: string;
            currentLevel: number;
            totalPoints: number;
            spendableBalance: number;
            updatedAt: string;
            refunded: number;
          };
          const refunded = Math.max(0, Number(raw.refunded ?? 0));
          refundedLevelsByUser[child.id] = {
            userId: raw.userId,
            currentLevel: raw.currentLevel,
            totalPoints: raw.totalPoints,
            spendableBalance: raw.spendableBalance,
            updatedAt: new Date(raw.updatedAt),
          };
          if (refunded > 0) {
            auditEvents.push({
              familyId: params.familyId,
              userId: child.id,
              achievementId: id,
              eventType: 'BONUS_REFUNDED',
              pointsDelta: -refunded,
              taskCompletionId: params.auditCause?.taskCompletionId,
              revocationWindowStart: params.revocationWindowStart,
              revocationWindowEnd: params.revocationWindowEnd,
              occurredAt: new Date(raw.updatedAt),
              source: params.auditCause?.source ?? 'revokeUnmetAchievements',
              detail: {
                cause: causeDetail,
                refunded,
                totalPoints: raw.totalPoints,
                spendableBalance: raw.spendableBalance,
                currentLevel: raw.currentLevel,
              },
            });
          }
        }
      } catch (error) {
        console.warn('[revoke] failed to refund', id, error);
      }

      if (fullDef) revoked.push(fullDef);
    }

    state.children[child.id] = childState;
  }

  saveAchievementStateLocal(state);
  // Revocation is the only path allowed to replace engine-owned unlock state.
  // The validated RPC opts into the DB trigger's exact-replacement mode.
  await persistAchievementUnlockStateExact(state);
  // The loadout only changed for members whose equipped shield was revoked.
  // Write the equipped column for *just* those, scoping the state to avoid
  // overwriting an unaffected sibling's freshly-equipped loadout.
  if (loadoutChanged.size > 0) {
    const scoped: FamilyAchievementState = {
      ...state,
      children: Object.fromEntries(
        Object.entries(state.children).filter(([childId]) => loadoutChanged.has(childId)),
      ),
    };
    await Promise.all(Array.from(loadoutChanged).map(childId => (
      persistAchievementIntentExact(scoped, childId)
    )));
  }
  await recordAchievementAuditEvents(auditEvents);
  notifyShieldStateChanged({
    familyId: params.familyId,
    state,
    achievementsByChild: buildPersistedAchievementSnapshot(state, members, allTasksByUser),
  });
  return { revoked, refundedLevelsByUser };
}

export function getUnlockedVisualStyles(childState?: ChildAchievementState) {
  const ids = new Set(childState?.unlockedVisualStyleIds ?? []);
  return VISUAL_STYLE_DEFINITIONS.filter(style => ids.has(style.visualStyleId));
}

export function achievementCount(): number {
  return ACHIEVEMENTS.length;
}
