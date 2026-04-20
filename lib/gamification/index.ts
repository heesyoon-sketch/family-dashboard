import { db, Level, Badge, daysBetween, startOfDay } from '../db';
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
  const now = new Date();
  const task = await db.tasks.get(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);

  let pts = partial ? Math.round(task.basePoints * 0.5) : task.basePoints;

  const completionId = crypto.randomUUID();
  await db.taskCompletions.add({
    id: completionId,
    userId,
    taskId,
    completedAt: now,
    pointsAwarded: 0,
    partial,
    forgivenessUsed: false,
  });

  const existing = await db.streaks.where('[userId+taskId]').equals([userId, taskId]).first();
  let streakCurrent: number;
  if (existing) {
    const gap = existing.lastCompletedAt ? daysBetween(existing.lastCompletedAt, now) : 999;
    if (gap === 0) streakCurrent = existing.current;
    else if (gap === 1) streakCurrent = existing.current + 1;
    else streakCurrent = 1;
    await db.streaks.put({
      ...existing,
      current: streakCurrent,
      longest: Math.max(existing.longest, streakCurrent),
      lastCompletedAt: now,
    });
  } else {
    streakCurrent = 1;
    await db.streaks.add({
      id: crypto.randomUUID(),
      userId, taskId,
      current: 1,
      longest: 1,
      lastCompletedAt: now,
    });
  }

  if (streakCurrent === 3)  pts += 10;
  if (streakCurrent === 7)  pts += 30;
  if (streakCurrent === 30) pts += 100;

  const dayStart = startOfDay(now);
  const activeCount = await db.tasks.where('[userId+active]').equals([userId, 1]).count();
  const todayCount = await db.taskCompletions
    .where('[userId+completedAt]').between([userId, dayStart], [userId, now])
    .count();
  if (todayCount === activeCount && activeCount > 0) pts += 10;

  const lvlRow = await db.levels.get(userId);
  const oldPoints = lvlRow?.totalPoints ?? 0;
  const newTotal = oldPoints + pts;
  const oldLevel = lvlRow?.currentLevel ?? 1;
  const newLevel = levelForPoints(newTotal);
  const updatedLevel: Level = {
    userId,
    currentLevel: newLevel,
    totalPoints: newTotal,
    updatedAt: now,
  };
  await db.levels.put(updatedLevel);
  await db.taskCompletions.update(completionId, { pointsAwarded: pts });
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
  const dayStart = startOfDay(new Date());
  const now = new Date();

  const completion = await db.taskCompletions
    .where('[taskId+completedAt]')
    .between([taskId, dayStart], [taskId, now])
    .filter(c => c.userId === userId)
    .first();

  if (!completion) return null;

  await db.taskCompletions.delete(completion.id);

  const lvlRow = await db.levels.get(userId);
  if (!lvlRow) return null;

  const newTotal = Math.max(0, lvlRow.totalPoints - completion.pointsAwarded);
  const updatedLevel: Level = {
    userId,
    currentLevel: levelForPoints(newTotal),
    totalPoints: newTotal,
    updatedAt: new Date(),
  };
  await db.levels.put(updatedLevel);

  return updatedLevel;
}

export async function evaluateAllBadges(userId: string): Promise<Badge[]> {
  const all = await db.badges.where('active').equals(1).toArray();
  const earned = await db.userBadges.where('userId').equals(userId).toArray();
  const earnedIds = new Set(earned.map(e => e.badgeId));
  const newly: Badge[] = [];

  for (const badge of all) {
    if (earnedIds.has(badge.id)) continue;
    const met = await evaluateCondition(userId, badge.conditionJson);
    if (met) {
      await db.userBadges.add({
        id: crypto.randomUUID(),
        userId,
        badgeId: badge.id,
        earnedAt: new Date(),
      });
      newly.push(badge);
    }
  }
  return newly;
}
