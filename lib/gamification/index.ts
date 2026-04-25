import { Level, Badge, startOfDay, daysBetween } from '../db';
import { createBrowserSupabase } from '../supabase';
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
  streakCurrent: number;
  streakLongest: number;
}

export interface UndoResult {
  level: Level | null;
  maxStreak: number;
  longestStreak: number;
  taskStreakCount: number;
  taskLastCompletedAt: Date | null;
}

export async function processCompletion(
  userId: string,
  taskId: string,
  partial = false,
): Promise<CompletionResult> {
  const supabase = createBrowserSupabase();
  const now = new Date();
  const dayStart = startOfDay(now);

  const { data: taskData } = await supabase.from('tasks').select('*').eq('id', taskId).single();
  if (!taskData) throw new Error(`Task ${taskId} not found`);

  const { data: existingCompletions } = await supabase.from('task_completions')
    .select('id')
    .eq('user_id', userId)
    .eq('task_id', taskId)
    .gte('completed_at', dayStart.toISOString())
    .lte('completed_at', now.toISOString())
    .limit(1);

  const { data: existingLevel } = await supabase.from('levels')
    .select('*').eq('user_id', userId).single();

  if (existingCompletions?.length) {
    const level: Level = {
      userId,
      currentLevel: existingLevel?.current_level ?? 1,
      totalPoints: existingLevel?.total_points ?? 0,
      spendableBalance: existingLevel?.spendable_balance ?? 0,
      updatedAt: existingLevel?.updated_at ? new Date(existingLevel.updated_at) : now,
    };
    const { data: existingStreak } = await supabase.from('streaks')
      .select('current, longest').eq('user_id', userId).eq('task_id', taskId).single();
    return {
      pointsAwarded: 0, level, leveledUp: false, badgesEarned: [], celebration: null,
      streakCurrent: existingStreak?.current ?? 0,
      streakLongest: existingStreak?.longest ?? 0,
    };
  }

  let pts = partial ? Math.round(taskData.base_points * 0.5) : taskData.base_points;

  const completionId = crypto.randomUUID();
  await supabase.from('task_completions').insert({
    id: completionId,
    user_id: userId,
    task_id: taskId,
    completed_at: now.toISOString(),
    points_awarded: 0,
    partial,
    forgiveness_used: false,
  });

  // Snapshot the pre-completion state from tasks table (primary source) for undo.
  const streakBefore: number               = taskData.streak_count ?? 0;
  const lastCompletedBefore: string | null = taskData.last_completed_at ?? null;

  // Calculate new streak from tasks table columns.
  const lastDate = lastCompletedBefore ? new Date(lastCompletedBefore) : null;
  const gap = lastDate ? daysBetween(lastDate, now) : 999;
  let streakCurrent: number;
  if (gap === 0)      streakCurrent = streakBefore;      // same day: no change
  else if (gap === 1) streakCurrent = streakBefore + 1;  // consecutive: increment
  else                streakCurrent = 1;                 // gap: reset

  // Write updated streak back to tasks table.
  await supabase.from('tasks').update({
    streak_count: streakCurrent,
    last_completed_at: now.toISOString(),
  }).eq('id', taskId);

  // Keep streaks table in sync for longest history and badge evaluation.
  const { data: streakRows } = await supabase.from('streaks')
    .select('*').eq('user_id', userId).eq('task_id', taskId);
  const streakData = streakRows?.[0];
  let streakLongest: number;
  if (streakData) {
    streakLongest = Math.max(streakData.longest, streakCurrent);
    await supabase.from('streaks').update({
      current: streakCurrent,
      longest: streakLongest,
      last_completed_at: now.toISOString(),
    }).eq('id', streakData.id);
  } else {
    streakLongest = streakCurrent;
    await supabase.from('streaks').insert({
      id: crypto.randomUUID(),
      user_id: userId,
      task_id: taskId,
      current: streakCurrent,
      longest: streakLongest,
      last_completed_at: now.toISOString(),
    });
  }

  // Streak multiplier: Tier 2 (3–6 days) = 1.5×, Tier 3 (7+ days) = 2×
  if (streakCurrent >= 7)      pts = Math.round(pts * 2);
  else if (streakCurrent >= 3) pts = Math.round(pts * 1.5);

  const { count: activeCount } = await supabase.from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId).eq('active', 1);
  const { count: todayCount } = await supabase.from('task_completions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('completed_at', dayStart.toISOString())
    .lte('completed_at', now.toISOString());
  if (todayCount === activeCount && (activeCount ?? 0) > 0) pts += 10;

  const lvlData = existingLevel;
  const oldPoints = lvlData?.total_points ?? 0;
  const oldBalance = lvlData?.spendable_balance ?? 0;
  const newTotal   = oldPoints + pts;
  const newBalance = oldBalance + pts;
  const oldLevel   = lvlData?.current_level ?? 1;
  const newLevel   = levelForPoints(newTotal);

  const updatedLevel: Level = {
    userId,
    currentLevel: newLevel,
    totalPoints: newTotal,
    spendableBalance: newBalance,
    updatedAt: now,
  };

  await supabase.from('levels').upsert({
    user_id: userId,
    current_level: newLevel,
    total_points: newTotal,
    spendable_balance: newBalance,
    updated_at: now.toISOString(),
  });
  await supabase.from('task_completions')
    .update({
      points_awarded: pts,
      streak_before: streakBefore,
      last_completed_before: lastCompletedBefore,
    }).eq('id', completionId);

  const leveledUp = newLevel > oldLevel;
  const badgesEarned = await evaluateAllBadges(userId);

  let celebration: CompletionResult['celebration'] = null;
  if (leveledUp) {
    celebration = { type: 'level_up', userId, newLevel };
  } else if (badgesEarned.length > 0) {
    celebration = { type: 'badge', userId, badge: badgesEarned[0] };
  }

  return { pointsAwarded: pts, level: updatedLevel, leveledUp, badgesEarned, celebration, streakCurrent, streakLongest };
}

export async function processUndo(userId: string, taskId: string): Promise<UndoResult> {
  const supabase = createBrowserSupabase();
  const dayStart = startOfDay(new Date());
  const now = new Date();

  const fetchStreakStats = async () => {
    const { data } = await supabase.from('streaks').select('current, longest').eq('user_id', userId);
    return {
      maxStreak:     (data ?? []).reduce((m, s) => Math.max(m, s.current), 0),
      longestStreak: (data ?? []).reduce((m, s) => Math.max(m, s.longest), 0),
    };
  };

  const { data: completions } = await supabase.from('task_completions')
    .select('*')
    .eq('user_id', userId)
    .eq('task_id', taskId)
    .gte('completed_at', dayStart.toISOString())
    .lte('completed_at', now.toISOString())
    .order('completed_at', { ascending: false })
    .limit(1);

  const completion = completions?.[0];
  if (!completion) {
    const { data: taskRow0 } = await supabase.from('tasks')
      .select('streak_count, last_completed_at').eq('id', taskId).single();
    return {
      level: null,
      ...(await fetchStreakStats()),
      taskStreakCount: taskRow0?.streak_count ?? 0,
      taskLastCompletedAt: taskRow0?.last_completed_at ? new Date(taskRow0.last_completed_at) : null,
    };
  }

  await supabase.from('task_completions').delete().eq('id', completion.id);

  // Restore streak only when this was the LAST completion today for this task.
  // streak_before / last_completed_before were written by processCompletion via migration 008.
  const streakBefore: number | null        = completion.streak_before ?? null;
  const lastCompletedBefore: string | null = completion.last_completed_before ?? null;

  // Fetch current task streak state before potentially restoring.
  const { data: taskRow } = await supabase.from('tasks')
    .select('streak_count, last_completed_at').eq('id', taskId).single();
  let restoredStreakCount  = taskRow?.streak_count ?? 0;
  let restoredLastCompleted: string | null = taskRow?.last_completed_at ?? null;

  if (streakBefore !== null) {
    const { count: remaining } = await supabase.from('task_completions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('task_id', taskId)
      .gte('completed_at', dayStart.toISOString())
      .lte('completed_at', now.toISOString());

    if ((remaining ?? 0) === 0) {
      restoredStreakCount   = streakBefore;
      restoredLastCompleted = lastCompletedBefore;

      // Restore tasks table (primary source).
      await supabase.from('tasks').update({
        streak_count: restoredStreakCount,
        last_completed_at: restoredLastCompleted,
      }).eq('id', taskId);

      // Keep streaks table in sync.
      const { data: streakRows } = await supabase.from('streaks')
        .select('id').eq('user_id', userId).eq('task_id', taskId);
      if (streakRows?.[0]) {
        await supabase.from('streaks').update({
          current: restoredStreakCount,
          last_completed_at: restoredLastCompleted,
        }).eq('id', streakRows[0].id);
      }
    }
  }

  // Deduct points from level.
  const { data: lvlData } = await supabase.from('levels').select('*').eq('user_id', userId).single();
  let level: Level | null = null;
  if (lvlData) {
    const newTotal   = Math.max(0, lvlData.total_points - completion.points_awarded);
    const newBalance = Math.max(0, (lvlData.spendable_balance ?? 0) - completion.points_awarded);
    level = {
      userId,
      currentLevel: levelForPoints(newTotal),
      totalPoints: newTotal,
      spendableBalance: newBalance,
      updatedAt: new Date(),
    };
    await supabase.from('levels').update({
      current_level: level.currentLevel,
      total_points: newTotal,
      spendable_balance: newBalance,
      updated_at: level.updatedAt.toISOString(),
    }).eq('user_id', userId);
  }

  const streakStats = await fetchStreakStats();
  return {
    level,
    ...streakStats,
    taskStreakCount: restoredStreakCount,
    taskLastCompletedAt: restoredLastCompleted ? new Date(restoredLastCompleted) : null,
  };
}

/**
 * Deducts `cost` from spendable_balance only — total_points (XP/level) are never touched.
 * Returns the new spendable balance.
 */
export async function redeemReward(
  userId: string,
  rewardId: string,
  cost: number,
): Promise<number> {
  const supabase = createBrowserSupabase();
  const { data: lvlData } = await supabase
    .from('levels')
    .select('spendable_balance')
    .eq('user_id', userId)
    .single();

  const currentBalance = lvlData?.spendable_balance ?? 0;
  if (currentBalance < cost) throw new Error('잔액이 부족합니다');

  const newBalance = currentBalance - cost;
  await supabase.from('levels')
    .update({ spendable_balance: newBalance })
    .eq('user_id', userId);
  await supabase.from('reward_redemptions').insert({
    id: crypto.randomUUID(),
    user_id: userId,
    reward_id: rewardId,
    redeemed_at: new Date().toISOString(),
  });
  return newBalance;
}

export async function evaluateAllBadges(userId: string): Promise<Badge[]> {
  const supabase = createBrowserSupabase();
  const { data: all } = await supabase.from('badges').select('*').eq('active', 1);
  const { data: earned } = await supabase.from('user_badges').select('*').eq('user_id', userId);
  const earnedIds = new Set((earned ?? []).map(e => e.badge_id));
  const newly: Badge[] = [];

  for (const b of (all ?? [])) {
    if (earnedIds.has(b.id)) continue;
    const badge: Badge = {
      id: b.id, code: b.code, name: b.name, description: b.description,
      icon: b.icon, category: b.category, conditionJson: b.condition_json, active: b.active,
    };
    const met = await evaluateCondition(userId, badge.conditionJson);
    if (met) {
      await supabase.from('user_badges').insert({
        id: crypto.randomUUID(),
        user_id: userId,
        badge_id: b.id,
        earned_at: new Date().toISOString(),
      });
      newly.push(badge);
    }
  }
  return newly;
}
