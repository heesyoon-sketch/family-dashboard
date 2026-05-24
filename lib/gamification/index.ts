import { DOW_INDEX, Level, Badge, startOfDay } from '../db';
import { assertUuid, createBrowserSupabase } from '../supabase';
import { evaluateCondition } from './conditions';
import { getCurrentTimeWindow, type TimeWindow } from '../timeWindows';

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

/** Error thrown when a Supabase RPC returns a structured error. Preserves
 *  the Postgres error code so callers (e.g. the offline-action queue) can
 *  distinguish "this will never succeed, drop it" from "transient, retry". */
export class RpcError extends Error {
  readonly code: string | null;
  readonly details: string | null;
  constructor(message: string, code: string | null, details: string | null) {
    super(message);
    this.name = 'RpcError';
    this.code = code;
    this.details = details;
  }
}

interface SupabaseRpcError {
  message: string;
  code?: string | null;
  details?: string | null;
}

function throwRpcError(error: SupabaseRpcError): never {
  throw new RpcError(error.message, error.code ?? null, error.details ?? null);
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

function currentTimeWindow(date: Date): TimeWindow {
  return getCurrentTimeWindow(date);
}

export async function processCompletion(
  userId: string,
  taskId: string,
  partial = false,
  completedAt = new Date(),
  bonusPercent = 0,
): Promise<CompletionResult> {
  const supabase = createBrowserSupabase();
  const now      = completedAt;
  const dayStart = startOfDay(now);
  const timeWindow = currentTimeWindow(now);

  // Compose the named-arg payload. We only attach p_bonus_percent when
  // there's an actual bonus to apply — that way clients running against a
  // database that hasn't received migration 079/080 yet still resolve to
  // the original 7-arg function instead of failing with "no matching
  // function" and reverting the optimistic completion.
  const params: Record<string, unknown> = {
    p_user_id: userId,
    p_task_id: taskId,
    p_partial: partial,
    p_day_start: dayStart.toISOString(),
    p_day_key: dayKey(now),
    p_time_window: timeWindow,
    p_now: now.toISOString(),
  };
  if (bonusPercent > 0) params.p_bonus_percent = bonusPercent;
  const { data, error } = await supabase.rpc('process_task_completion_atomic', params);
  if (error) throwRpcError(error);

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
  if (error) throwRpcError(error);

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
  const payload = {
    p_user_id: assertUuid(userId, 'userId'),
    p_reward_id: assertUuid(rewardId, 'rewardId'),
    p_day_key: dayKey(now),
    p_now: now.toISOString(),
  };
  const { data, error } = await supabase.rpc('redeem_reward_atomic', payload);
  if (error) {
    console.error('[shop:redeem_reward_atomic] rpc error', error);
    throw new Error(error.message);
  }

  const raw = data as { spendableBalance: number };
  return raw.spendableBalance;
}

// `badges` is effectively static config — re-fetching it on every task tap
// is pure waste. Cache for the page session; cache key is `active=1`.
let _badgesCache: { rows: Badge[]; fetchedAt: number } | null = null;
const BADGES_CACHE_TTL_MS = 5 * 60 * 1000;

async function loadActiveBadges(supabase: ReturnType<typeof createBrowserSupabase>): Promise<Badge[]> {
  const now = Date.now();
  if (_badgesCache && now - _badgesCache.fetchedAt < BADGES_CACHE_TTL_MS) {
    return _badgesCache.rows;
  }
  const { data, error } = await supabase.from('badges').select('*').eq('active', 1);
  if (error) {
    console.error('[badges] load failed', error);
    return _badgesCache?.rows ?? [];
  }
  const rows: Badge[] = (data ?? []).map(b => ({
    id: b.id, code: b.code, name: b.name, description: b.description,
    icon: b.icon, category: b.category, conditionJson: b.condition_json, active: b.active,
  }));
  _badgesCache = { rows, fetchedAt: now };
  return rows;
}

export async function evaluateAllBadges(userId: string): Promise<Badge[]> {
  const supabase = createBrowserSupabase();
  const [all, { data: earned }] = await Promise.all([
    loadActiveBadges(supabase),
    supabase.from('user_badges').select('badge_id').eq('user_id', userId),
  ]);
  const earnedIds = new Set((earned ?? []).map(e => e.badge_id));

  const candidates: Badge[] = all.filter(b => !earnedIds.has(b.id));
  // Common case once a kid has earned everything: skip the per-condition
  // queries entirely. evaluateCondition issues 1–2 SELECTs per candidate.
  if (candidates.length === 0) return [];

  const evaluated = await Promise.all(
    candidates.map(async badge => ({ badge, met: await evaluateCondition(userId, badge.conditionJson, supabase) }))
  );

  const newly: Badge[] = [];
  for (const { badge, met } of evaluated) {
    if (!met) continue;
    const { error: insertError } = await supabase.from('user_badges').insert({
      id: crypto.randomUUID(),
      user_id: userId,
      badge_id: badge.id,
      earned_at: new Date().toISOString(),
    });
    if (insertError) {
      // A unique-violation on (user_id, badge_id) means we lost a race with
      // another tab/device awarding the same badge — that's fine, treat as
      // not newly earned. Anything else (RLS, schema drift) is a real error.
      if (insertError.code !== '23505') {
        console.error('[badges] failed to award', badge.code, insertError);
      }
      continue;
    }
    newly.push(badge);
  }
  return newly;
}
