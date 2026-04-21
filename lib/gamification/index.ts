import { Level, Badge, startOfDay, daysBetween } from '../db';
import { createBrowserSupabase } from '../supabase';
import { evaluateCondition } from './conditions';

export const LEVEL_THRESHOLDS = [
  { level: 1, min: 0,    max: 100 },
  { level: 2, min: 100,  max: 250 },
  { level: 3, min: 250,  max: 500 },
  { level: 4, min: 500,  max: 900 },
  { level: 5, min: 900,  max: 1500 },
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
}

export async function processCompletion(
  userId: string,
  taskId: string,
  partial = false,
): Promise<CompletionResult> {
  const supabase = createBrowserSupabase();
  const now = new Date();

  const { data: taskData } = await supabase.from('tasks').select('*').eq('id', taskId).single();
  if (!taskData) throw new Error(`Task ${taskId} not found`);

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

  const { data: streakRows } = await supabase.from('streaks')
    .select('*').eq('user_id', userId).eq('task_id', taskId);
  const streakData = streakRows?.[0];

  let streakCurrent: number;
  if (streakData) {
    const lastDate = streakData.last_completed_at ? new Date(streakData.last_completed_at) : null;
    const gap = lastDate ? daysBetween(lastDate, now) : 999;
    if (gap === 0) streakCurrent = streakData.current;
    else if (gap === 1) streakCurrent = streakData.current + 1;
    else streakCurrent = 1;
    await supabase.from('streaks').update({
      current: streakCurrent,
      longest: Math.max(streakData.longest, streakCurrent),
      last_completed_at: now.toISOString(),
    }).eq('id', streakData.id);
  } else {
    streakCurrent = 1;
    await supabase.from('streaks').insert({
      id: crypto.randomUUID(),
      user_id: userId,
      task_id: taskId,
      current: 1,
      longest: 1,
      last_completed_at: now.toISOString(),
    });
  }

  if (streakCurrent === 3)  pts += 10;
  if (streakCurrent === 7)  pts += 30;
  if (streakCurrent === 30) pts += 100;

  const dayStart = startOfDay(now);
  const { count: activeCount } = await supabase.from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId).eq('active', 1);
  const { count: todayCount } = await supabase.from('task_completions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('completed_at', dayStart.toISOString())
    .lte('completed_at', now.toISOString());
  if (todayCount === activeCount && (activeCount ?? 0) > 0) pts += 10;

  const { data: lvlData } = await supabase.from('levels')
    .select('*').eq('user_id', userId).single();
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
    .update({ points_awarded: pts }).eq('id', completionId);

  const leveledUp = newLevel > oldLevel;
  const badgesEarned = await evaluateAllBadges(userId);

  let celebration: CompletionResult['celebration'] = null;
  if (leveledUp) {
    celebration = { type: 'level_up', userId, newLevel };
  } else if (badgesEarned.length > 0) {
    celebration = { type: 'badge', userId, badge: badgesEarned[0] };
  }

  return { pointsAwarded: pts, level: updatedLevel, leveledUp, badgesEarned, celebration };
}

export async function processUndo(userId: string, taskId: string): Promise<Level | null> {
  const supabase = createBrowserSupabase();
  const dayStart = startOfDay(new Date());
  const now = new Date();

  const { data: completions } = await supabase.from('task_completions')
    .select('*')
    .eq('user_id', userId)
    .eq('task_id', taskId)
    .gte('completed_at', dayStart.toISOString())
    .lte('completed_at', now.toISOString())
    .order('completed_at', { ascending: false })
    .limit(1);

  const completion = completions?.[0];
  if (!completion) return null;

  await supabase.from('task_completions').delete().eq('id', completion.id);

  const { data: lvlData } = await supabase.from('levels')
    .select('*').eq('user_id', userId).single();
  if (!lvlData) return null;

  const newTotal   = Math.max(0, lvlData.total_points - completion.points_awarded);
  // Clamp at 0 in case points were already spent on rewards
  const newBalance = Math.max(0, (lvlData.spendable_balance ?? 0) - completion.points_awarded);

  const updatedLevel: Level = {
    userId,
    currentLevel: levelForPoints(newTotal),
    totalPoints: newTotal,
    spendableBalance: newBalance,
    updatedAt: new Date(),
  };
  await supabase.from('levels').update({
    current_level: updatedLevel.currentLevel,
    total_points: newTotal,
    spendable_balance: newBalance,
    updated_at: updatedLevel.updatedAt.toISOString(),
  }).eq('user_id', userId);

  return updatedLevel;
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
