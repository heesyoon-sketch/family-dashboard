'use client';

import { legacyRecurrenceToDays, type Level, type Task, type User } from '@/lib/db';
import { createBrowserSupabase } from '@/lib/supabase';
import { ACHIEVEMENTS, VISUAL_STYLE_DEFINITIONS } from './definitions';
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

// v3: reset progress on 2026-05-09. Rarity ladder collapsed to five
// (common/rare/epic/legendary/mythic), per-rarity active-day floor
// introduced, and unlock baseline must restart at "today" so kids
// don't carry over the day-1 platinum/gold unlocks they got under v2.
function storageKey(familyId: string): string {
  return `fambit_insignia_wall_v3_${familyId}`;
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
    unlockBaselineAt: baselineAt ?? new Date().toISOString(),
  };
}

export function loadAchievementState(familyId: string, children: User[]): FamilyAchievementState {
  if (typeof window === 'undefined') {
    return {
      familyId,
      children: Object.fromEntries(children.map(child => [child.id, emptyChildState(child.id)])),
      updatedAt: new Date().toISOString(),
    };
  }
  const raw = localStorage.getItem(storageKey(familyId));
  const parsed = raw ? JSON.parse(raw) as Partial<FamilyAchievementState> : {};
  const childStates: Record<string, ChildAchievementState> = {};
  for (const child of children) {
    const stored = parsed.children?.[child.id];
    const base = emptyChildState(child.id, stored?.unlockBaselineAt);
    childStates[child.id] = {
      ...base,
      ...(stored ?? {}),
      childId: child.id,
      unlockBaselineAt: stored?.unlockBaselineAt ?? base.unlockBaselineAt,
    };
  }
  return {
    familyId,
    children: childStates,
    updatedAt: parsed.updatedAt ?? new Date().toISOString(),
  };
}

export function saveAchievementState(state: FamilyAchievementState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(storageKey(state.familyId), JSON.stringify({ ...state, updatedAt: new Date().toISOString() }));
}

export function togglePinnedAchievement(familyId: string, children: User[], childId: string, achievementId: string): FamilyAchievementState {
  const state = loadAchievementState(familyId, children);
  const child = state.children[childId] ?? emptyChildState(childId);
  const current = child.pinnedAchievementIds.includes(achievementId)
    ? child.pinnedAchievementIds.filter(id => id !== achievementId)
    : [...child.pinnedAchievementIds, achievementId].slice(-5);
  state.children[childId] = { ...child, pinnedAchievementIds: current };
  saveAchievementState(state);
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
  const child = state.children[childId] ?? emptyChildState(childId);
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
  saveAchievementState(state);
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
  const child = state.children[childId] ?? emptyChildState(childId);
  if (child.equippedInsigniaIds.length <= maxSlots) return state;
  state.children[childId] = {
    ...child,
    equippedInsigniaIds: child.equippedInsigniaIds.slice(0, maxSlots),
  };
  saveAchievementState(state);
  return state;
}

async function fetchCompletions(userIds: string[]): Promise<Record<string, AchievementCompletion[]>> {
  const safeIds = userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'];
  const since = new Date();
  since.setDate(since.getDate() - 370);
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase
    .from('task_completions')
    .select('id, user_id, task_id, completed_at, points_awarded')
    .in('user_id', safeIds)
    .gte('completed_at', since.toISOString());
  if (error) throw new Error(error.message);

  const byChild: Record<string, AchievementCompletion[]> = Object.fromEntries(userIds.map(id => [id, []]));
  for (const row of data ?? []) {
    const childId = row.user_id as string;
    byChild[childId] = [
      ...(byChild[childId] ?? []),
      {
        id: row.id as string,
        childId,
        taskId: row.task_id as string,
        completedAt: new Date(row.completed_at as string),
        pointsAwarded: Number(row.points_awarded ?? 0),
      },
    ];
  }
  return byChild;
}

async function fetchTasks(userIds: string[], fallback: Record<string, Task[]>): Promise<Record<string, Task[]>> {
  const safeIds = userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'];
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase
    .from('tasks')
    .select('id, user_id, code, title, icon, difficulty, base_points, recurrence, days_of_week, time_window, active, sort_order, streak_count, last_completed_at')
    .in('user_id', safeIds)
    .is('deleted_at', null);
  if (error) return fallback;
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

async function awardBonusPoints(childId: string, achievement: AchievementProgress): Promise<Level | null> {
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
  const raw = data as { userId: string; currentLevel: number; totalPoints: number; spendableBalance: number; updatedAt: string };
  return {
    userId: raw.userId,
    currentLevel: raw.currentLevel,
    totalPoints: raw.totalPoints,
    spendableBalance: raw.spendableBalance,
    updatedAt: new Date(raw.updatedAt),
  };
}

export async function syncAchievements(params: {
  familyId: string;
  children: User[];
  tasksByUser: Record<string, Task[]>;
  levelsByUser?: Record<string, Level>;
  awardNew?: boolean;
}): Promise<AchievementSyncResult & { awardedLevelsByUser: Record<string, Level> }> {
  // Shield Wall is open to everyone in the family — kids and parents alike.
  const members = params.children;
  const state = loadAchievementState(params.familyId, members);
  // Fetches are independent — issue them in parallel rather than serially.
  const memberIds = members.map(member => member.id);
  const [completionsByChild, allTasksByUser] = await Promise.all([
    fetchCompletions(memberIds),
    fetchTasks(memberIds, params.tasksByUser),
  ]);
  const achievementsByChild: Record<string, AchievementProgress[]> = {};
  const newlyUnlocked: AchievementProgress[] = [];
  const awardedLevelsByUser: Record<string, Level> = {};

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
      childState.unlockedAtByAchievementId[achievement.achievementId] = achievement.unlockedAt ?? new Date().toISOString();
      childState.unlockedVisualStyleIds = Array.from(new Set([
        ...childState.unlockedVisualStyleIds,
        ...(achievement.unlocksVisualStyleIds ?? []),
      ]));
      newlyUnlocked.push(achievement);

      if (params.awardNew && !childState.awardedAchievementIds.includes(achievement.achievementId)) {
        const awarded = await awardBonusPoints(child.id, achievement);
        if (awarded) {
          awardedLevelsByUser[child.id] = awarded;
          childState.awardedAchievementIds.push(achievement.achievementId);
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

  saveAchievementState(state);
  return { state, achievementsByChild, newlyUnlocked, awardedLevelsByUser };
}

/** Re-evaluate a child's achievements against fresh completion data and
 *  revoke anything that no longer meets its requirement. Used after an undo
 *  so the shield wall stays honest with the underlying activity.
 *
 *  For each revoked achievement we:
 *    - drop it from `unlockedAtByAchievementId` and `awardedAchievementIds`
 *    - unequip it if it was in the loadout
 *    - drop any visual styles that were unlocked *only* by this achievement
 *    - call `revoke_achievement_bonus` on the server to refund the points
 *      this achievement originally granted
 */
export async function revokeUnmetAchievements(params: {
  familyId: string;
  children: User[];
  tasksByUser: Record<string, Task[]>;
}): Promise<{ revoked: AchievementProgress[]; refundedLevelsByUser: Record<string, Level> }> {
  const members = params.children;
  const state = loadAchievementState(params.familyId, members);
  const completionsByChild = await fetchCompletions(members.map(member => member.id));
  const allTasksByUser = await fetchTasks(members.map(member => member.id), params.tasksByUser);

  const revoked: AchievementProgress[] = [];
  const refundedLevelsByUser: Record<string, Level> = {};
  const supabase = createBrowserSupabase();

  for (const child of members) {
    const childState = state.children[child.id];
    if (!childState) continue;

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

      // Drop the unlock + the awarded marker so a future re-earn re-awards.
      delete childState.unlockedAtByAchievementId[id];
      childState.awardedAchievementIds = childState.awardedAchievementIds.filter(x => x !== id);
      childState.equippedInsigniaIds = childState.equippedInsigniaIds.filter(eid => eid !== id);

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
          refundedLevelsByUser[child.id] = {
            userId: raw.userId,
            currentLevel: raw.currentLevel,
            totalPoints: raw.totalPoints,
            spendableBalance: raw.spendableBalance,
            updatedAt: new Date(raw.updatedAt),
          };
        }
      } catch (error) {
        console.warn('[revoke] failed to refund', id, error);
      }

      const fullDef = result.achievements.find(a => a.achievementId === id);
      if (fullDef) revoked.push(fullDef);
    }

    state.children[child.id] = childState;
  }

  saveAchievementState(state);
  return { revoked, refundedLevelsByUser };
}

export function getUnlockedVisualStyles(childState?: ChildAchievementState) {
  const ids = new Set(childState?.unlockedVisualStyleIds ?? []);
  return VISUAL_STYLE_DEFINITIONS.filter(style => ids.has(style.visualStyleId));
}

export function achievementCount(): number {
  return ACHIEVEMENTS.length;
}
