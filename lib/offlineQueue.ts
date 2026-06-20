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

function notifyOfflineQueueChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('fambit:offline-queue'));
  }
}

export function canUseOfflineQueue(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

export function isProbablyOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

const UNRECOVERABLE_OFFLINE_RPC_CODES = new Set([
  '23503', // foreign_key_violation — task or user deleted
  '23505', // unique_violation — completion already exists
  '42501', // insufficient_privilege — RLS denied
  '42883', // undefined_function — RPC removed/renamed
  'P0001', // explicit RPC rejection — task missing/no longer due/no family
  'PGRST116', // PostgREST: no rows / not found
  'PGRST204', // PostgREST: function not found in schema cache
]);

export function isUnrecoverableOfflineRpcCode(code: string | null): boolean {
  return code !== null && UNRECOVERABLE_OFFLINE_RPC_CODES.has(code);
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
  notifyOfflineQueueChanged();
}

export async function listTaskActions(): Promise<OfflineTaskAction[]> {
  if (!canUseOfflineQueue()) return [];
  return db.taskActions.orderBy('createdAt').toArray();
}

export async function deleteTaskAction(id: string): Promise<void> {
  if (!canUseOfflineQueue()) return;
  await db.taskActions.delete(id);
  notifyOfflineQueueChanged();
}

const OFFLINE_ACTION_TTL_MS = 24 * 60 * 60 * 1000;

export async function pruneStaleActions(): Promise<void> {
  if (!canUseOfflineQueue()) return;
  const cutoff = new Date(Date.now() - OFFLINE_ACTION_TTL_MS).toISOString();
  const stale = await db.taskActions.where('createdAt').below(cutoff).toArray();
  if (stale.length > 0) {
    await db.taskActions.bulkDelete(stale.map(a => a.id));
    notifyOfflineQueueChanged();
  }
}
