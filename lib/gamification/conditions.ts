import { db, BadgeCondition } from '../db';

export async function evaluateCondition(
  userId: string,
  cond: BadgeCondition,
): Promise<boolean> {
  switch (cond.type) {
    case 'streak': {
      const task = await db.tasks
        .where('[userId+code]').equals([userId, cond.taskCode])
        .first();
      if (!task) return false;
      const streak = await db.streaks
        .where('[userId+taskId]').equals([userId, task.id])
        .first();
      return (streak?.current ?? 0) >= cond.days;
    }

    case 'points_total': {
      const lvl = await db.levels.get(userId);
      return (lvl?.totalPoints ?? 0) >= cond.threshold;
    }

    case 'monthly_rate': {
      const task = await db.tasks
        .where('[userId+code]').equals([userId, cond.taskCode])
        .first();
      if (!task) return false;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const daysInMonthSoFar = Math.floor(
        (now.getTime() - monthStart.getTime()) / 86400000
      ) + 1;
      if (daysInMonthSoFar < 7) return false;
      const completions = await db.taskCompletions
        .where('[taskId+completedAt]').between([task.id, monthStart], [task.id, now])
        .count();
      return (completions / daysInMonthSoFar) * 100 >= cond.percent;
    }

    case 'monthly_count': {
      const task = await db.tasks
        .where('[userId+code]').equals([userId, cond.taskCode])
        .first();
      if (!task) return false;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const count = await db.taskCompletions
        .where('[taskId+completedAt]').between([task.id, monthStart], [task.id, now])
        .count();
      return count >= cond.count;
    }
  }
}
