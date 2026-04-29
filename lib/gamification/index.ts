import { DOW_INDEX, Level, Badge, startOfDay } from '../db';
import { assertUuid, createBrowserSupabase } from '../supabase';
import { evaluateCondition } from './conditions';

export const LEVEL_THRESHOLDS = [
  { level: 1,  min: 0,     max: 599 },
  { level: 2,  min: 600,   max: 1499 },
  { level: 3,  min: 1500,  max: 2999 },
  { level: 4,  min: 3000,  max: 4999 },
  { level: 5,  min: 5000,  max: 7999 },
  { level: 6,  min: 8000,  max: 11999 },
  { level: 7,  min: 12000, max: 17999 },
  { level: 8,  min: 18000, max: 24999 },
  { level: 9,  min: 25000, max: 39999 },
  { level: 10, min: 40000, max: Infinity },
];

export function levelForPoints(pts: number): number {
  for (const l of LEVEL_THRESHOLDS) {
    if (pts >= l.min && pts < l.max) return l.level;
  }
  return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1].level;
}

export interface CompletionResult {
  pointsAwarded: number;
  level: Level;
  leveledUp: boolean;
  badgesEarned: Badge[];
  celebration: import('../store').Celebration | null;
  maxStreak: number;
  longestStreak: number;
  streakCurrent: number;
  streakLongest: number;
  taskLastCompletedAt: Date | null;
}

export interface UndoResult {
  level: Level | null;
  maxStreak: number;
  longestStreak: number;
  taskStreakCount: number;
  taskLastCompletedAt: Date | null;
}

interface RpcLevel {
  userId: string;
  currentLevel: number;
  totalPoints: number;
  spendableBalance: number;
  updatedAt: string;
}

function mapRpcLevel(level: RpcLevel): Level {
  return {
    userId: level.userId,
    currentLevel: level.currentLevel,
    totalPoints: level.totalPoints,
    spendableBalance: level.spendableBalance,
    updatedAt: new Date(level.updatedAt),
  };
}

function dayKey(date: Date): string {
  return DOW_INDEX[date.getDay()];
}

function currentTimeWindow(date: Date): 'morning' | 'evening' {
  return date.getHours() < 12 ? 'morning' : 'evening';
}

export async function processCompletion(
  userId: string,
  taskId: string,
  partial = false,
  completedAt = new Date(),
): Promise<CompletionResult> {
  const supabase = createBrowserSupabase();
  const now      = completedAt;
  const dayStart = startOfDay(now);
  const timeWindow = currentTimeWindow(now);

  const { data, error } = await supabase.rpc('process_task_completion_atomic', {
    p_user_id: userId,
    p_task_id: taskId,
    p_partial: partial,
    p_day_start: dayStart.toISOString(),
    p_day_key: dayKey(now),
    p_time_window: timeWindow,
    p_now: now.toISOString(),
  });
  if (error) throw new Error(error.message);

  const raw = data as {
    pointsAwarded: number;
    level: RpcLevel;
    leveledUp?: boolean;
    maxStreak: number;
    longestStreak: number;
    streakCurrent: number;
    streakLongest: number;
    taskLastCompletedAt: string | null;
  };

  const badgesEarned = await evaluateAllBadges(userId);
  const leveledUp = Boolean(raw.leveledUp);

  let celebration: CompletionResult['celebration'] = null;
  if (leveledUp)               celebration = { type: 'level_up', userId, newLevel: raw.level.currentLevel };
  else if (badgesEarned.length) celebration = { type: 'badge', userId, badge: badgesEarned[0] };

  return {
    pointsAwarded: raw.pointsAwarded,
    level: mapRpcLevel(raw.level),
    leveledUp,
    badgesEarned,
    celebration,
    maxStreak: raw.maxStreak,
    longestStreak: raw.longestStreak,
    streakCurrent: raw.streakCurrent,
    streakLongest: raw.streakLongest,
    taskLastCompletedAt: raw.taskLastCompletedAt ? new Date(raw.taskLastCompletedAt) : null,
  };
}

export async function processUndo(
  userId: string,
  taskId: string,
  undoneAt = new Date(),
): Promise<UndoResult> {
  const supabase = createBrowserSupabase();
  const now = undoneAt;
  const dayStart = startOfDay(now);
  const timeWindow = currentTimeWindow(now);

  const { data, error } = await supabase.rpc('process_task_undo_atomic', {
    p_user_id: userId,
    p_task_id: taskId,
    p_day_start: dayStart.toISOString(),
    p_day_key: dayKey(now),
    p_time_window: timeWindow,
    p_now: now.toISOString(),
  });
  if (error) throw new Error(error.message);

  const raw = data as {
    level: RpcLevel | null;
    maxStreak: number;
    longestStreak: number;
    taskStreakCount: number;
    taskLastCompletedAt: string | null;
  };

  return {
    level: raw.level ? mapRpcLevel(raw.level) : null,
    maxStreak: raw.maxStreak,
    longestStreak: raw.longestStreak,
    taskStreakCount: raw.taskStreakCount,
    taskLastCompletedAt: raw.taskLastCompletedAt ? new Date(raw.taskLastCompletedAt) : null,
  };
}

/**
 * Deducts the current server-calculated reward cost from spendable_balance only.
 * total_points (XP/level) are never touched.
 * Returns the new spendable balance.
 */
export async function redeemReward(
  userId: string,
  rewardId: string,
  _cost?: number,
): Promise<number> {
  void _cost;
  const supabase = createBrowserSupabase();
  const now = new Date();
  const { data, error } = await supabase.rpc('redeem_reward_atomic', {
    p_user_id: assertUuid(userId, 'userId'),
    p_reward_id: assertUuid(rewardId, 'rewardId'),
    p_day_key: dayKey(now),
    p_now: now.toISOString(),
  });
  if (error) throw new Error(error.message);

  const raw = data as { spendableBalance: number };
  return raw.spendableBalance;
}

export async function evaluateAllBadges(userId: string): Promise<Badge[]> {
  const supabase = createBrowserSupabase();
  const [{ data: all }, { data: earned }] = await Promise.all([
    supabase.from('badges').select('*').eq('active', 1),
    supabase.from('user_badges').select('badge_id').eq('user_id', userId),
  ]);
  const earnedIds = new Set((earned ?? []).map(e => e.badge_id));

  const candidates: Badge[] = (all ?? [])
    .filter(b => !earnedIds.has(b.id))
    .map(b => ({
      id: b.id, code: b.code, name: b.name, description: b.description,
      icon: b.icon, category: b.category, conditionJson: b.condition_json, active: b.active,
    }));

  const evaluated = await Promise.all(
    candidates.map(async badge => ({ badge, met: await evaluateCondition(userId, badge.conditionJson) }))
  );

  const newly: Badge[] = [];
  for (const { badge, met } of evaluated) {
    if (!met) continue;
    await supabase.from('user_badges').insert({
      id: crypto.randomUUID(),
      user_id: userId,
      badge_id: badge.id,
      earned_at: new Date().toISOString(),
    });
    newly.push(badge);
  }
  return newly;
}
