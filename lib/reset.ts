import { db } from './db';

export async function resetAllProgress(): Promise<void> {
  await db.taskCompletions.clear();
  await db.streaks.clear();
  const users = await db.users.toArray();
  for (const u of users) {
    await db.levels.put({
      userId: u.id,
      currentLevel: 1,
      totalPoints: 0,
      updatedAt: new Date(),
    });
  }
}
