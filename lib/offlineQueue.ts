import Dexie, { type Table } from 'dexie';

export type OfflineTaskActionType = 'complete' | 'undo';

export interface OfflineTaskAction {
  id: string;
  type: OfflineTaskActionType;
  userId: string;
  taskId: string;
  createdAt: string;
}

class HabitOfflineDb extends Dexie {
  taskActions!: Table<OfflineTaskAction, string>;

  constructor() {
    super('family_habit_offline');
    this.version(1).stores({
      taskActions: 'id, createdAt, userId, taskId',
    });
  }
}

const db = new HabitOfflineDb();

export function canUseOfflineQueue(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

export function isProbablyOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export async function enqueueTaskAction(
  type: OfflineTaskActionType,
  userId: string,
  taskId: string,
): Promise<void> {
  if (!canUseOfflineQueue()) return;

  await db.transaction('rw', db.taskActions, async () => {
    if (type === 'complete') {
      const existing = await db.taskActions
        .where('userId')
        .equals(userId)
        .and(action => action.taskId === taskId)
        .toArray();
      await db.taskActions.bulkDelete(existing.map(action => action.id));
    }

    if (type === 'undo') {
      const pending = await db.taskActions
        .where('userId')
        .equals(userId)
        .and(action => action.taskId === taskId)
        .toArray();
      const pendingComplete = pending.find(action => action.type === 'complete');
      if (pendingComplete) {
        await db.taskActions.delete(pendingComplete.id);
        return;
      }
    }

    await db.taskActions.add({
      id: crypto.randomUUID(),
      type,
      userId,
      taskId,
      createdAt: new Date().toISOString(),
    });
  });
}

export async function listTaskActions(): Promise<OfflineTaskAction[]> {
  if (!canUseOfflineQueue()) return [];
  return db.taskActions.orderBy('createdAt').toArray();
}

export async function deleteTaskAction(id: string): Promise<void> {
  if (!canUseOfflineQueue()) return;
  await db.taskActions.delete(id);
}

const OFFLINE_ACTION_TTL_MS = 24 * 60 * 60 * 1000;

export async function pruneStaleActions(): Promise<void> {
  if (!canUseOfflineQueue()) return;
  const cutoff = new Date(Date.now() - OFFLINE_ACTION_TTL_MS).toISOString();
  const stale = await db.taskActions.where('createdAt').below(cutoff).toArray();
  if (stale.length > 0) {
    await db.taskActions.bulkDelete(stale.map(a => a.id));
  }
}
