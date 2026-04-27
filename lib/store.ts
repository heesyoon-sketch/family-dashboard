import { create } from 'zustand';
import { Level, Badge, Task, User, DayOfWeek, DOW_INDEX, legacyRecurrenceToDays } from './db';
import { createBrowserSupabase } from './supabase';
import { deleteTaskAction, enqueueTaskAction, isProbablyOnline, listTaskActions } from './offlineQueue';

export type Celebration =
  | { type: 'level_up'; userId: string; newLevel: number }
  | { type: 'badge';    userId: string; badge: Badge };

export type TimeOfDay = 'morning' | 'evening';

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

function startOfDayLocal(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}

export function getCurrentTimeOfDay(): TimeOfDay {
  return new Date().getHours() < 12 ? 'morning' : 'evening';
}

interface FamilyState {
  familyId: string | null;
  users: User[];
  currentMemberId: string | null;
  currentMemberCanAdmin: boolean;
  tasksByUser: Record<string, Task[]>;
  levelsByUser: Record<string, Level>;
  todayCompletions: Record<string, string[]>;
  maxStreakByUser: Record<string, number>;
  longestStreakByUser: Record<string, number>;
  bestDayByUser: Record<string, number>;
  growthByUser: Record<string, number | null>;
  celebration: Celebration | null;
  hydrated: boolean;
  soundEnabled: boolean;
  timeOfDay: TimeOfDay;

  hydrate: () => Promise<void>;
  markCompleted: (userId: string, taskId: string) => Promise<void>;
  undoCompletion: (userId: string, taskId: string) => Promise<void>;
  syncOfflineActions: () => Promise<void>;
  redeemReward: (userId: string, rewardId: string, cost: number) => Promise<void>;
  updateMemberAvatar: (userId: string, avatarUrl: string) => void;
  dismissCelebration: () => void;
  toggleSound: () => void;
}

function loadSoundPref(): boolean {
  if (typeof window === 'undefined') return true;
  const v = localStorage.getItem('sound_enabled');
  return v === null ? true : v === '1';
}

let _timeIntervalStarted = false;
let _offlineSyncListenersStarted = false;
let _syncInFlight = false;
const _taskMutationsInFlight = new Set<string>();

function taskMutationKey(userId: string, taskId: string): string {
  return `${userId}:${taskId}`;
}

export const useFamilyStore = create<FamilyState>((set, get) => ({
  familyId: null,
  users: [],
  currentMemberId: null,
  currentMemberCanAdmin: false,
  tasksByUser: {},
  levelsByUser: {},
  todayCompletions: {},
  maxStreakByUser: {},
  longestStreakByUser: {},
  bestDayByUser: {},
  growthByUser: {},
  celebration: null,
  hydrated: false,
  soundEnabled: loadSoundPref(),
  timeOfDay: getCurrentTimeOfDay(),

  hydrate: async () => {
    const supabase = createBrowserSupabase();

    // getUser() verifies the token with the Supabase Auth server —
    // getSession() only reads local storage and can return a stale/invalid session.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('family_dashboard_member_id');
        localStorage.removeItem('family_dashboard_family_id');
      }
      set({
        hydrated: true,
        familyId: null,
        users: [],
        currentMemberId: null,
        currentMemberCanAdmin: false,
        tasksByUser: {},
        levelsByUser: {},
        todayCompletions: {},
      });
      return;
    }
    const cachedMemberId = typeof window !== 'undefined'
      ? localStorage.getItem('family_dashboard_member_id')
      : null;
    const { data: familyId } = await supabase.rpc('get_my_family_id');
    let resolvedFamilyId = familyId as string | null;

    if (!resolvedFamilyId && cachedMemberId) {
      const { data: memberFamilyId } = await supabase.rpc('get_family_id_for_member', {
        p_member_id: cachedMemberId,
      });
      // Only trust the result when the RPC confirms the member belongs to this auth user.
      // Do NOT fall back to cachedFamilyId — a stale localStorage value from a previous
      // session would let a new user resolve a different family, causing data leakage.
      resolvedFamilyId = memberFamilyId as string | null;
    }

    if (!resolvedFamilyId) {
      // Clear stale cache so the next login starts clean
      if (typeof window !== 'undefined') {
        localStorage.removeItem('family_dashboard_member_id');
        localStorage.removeItem('family_dashboard_family_id');
      }
      set({
        hydrated: true,
        familyId: null,
        users: [],
        currentMemberId: null,
        currentMemberCanAdmin: false,
        tasksByUser: {},
        levelsByUser: {},
        todayCompletions: {},
      });
      return;
    }

    const now = new Date();
    const todayStart = startOfDayLocal(now);
    const noonToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
    const timeOfDay = getCurrentTimeOfDay();
    const fourteenDaysAgo = addDays(todayStart, -13);

    const [uRes, tRes, lRes, sRes, cTodayRes, cHistRes] = await Promise.all([
      supabase.from('users').select('*').order('display_order', { ascending: true }).order('created_at', { ascending: true }),
      supabase.from('tasks').select('*'),
      supabase.from('levels').select('*'),
      supabase.from('streaks').select('*'),
      supabase.from('task_completions')
        .select('id, user_id, task_id, completed_at')
        .gte('completed_at', todayStart.toISOString()),
      supabase.from('task_completions')
        .select('user_id, task_id, completed_at')
        .gte('completed_at', fourteenDaysAgo.toISOString()),
    ]);

    const users: User[] = (uRes.data ?? []).map(r => ({
      id: r.id, name: r.name, role: r.role, theme: r.theme,
      avatarUrl: r.avatar_url ?? undefined, pinHash: r.pin_hash ?? undefined,
      email: r.email ?? undefined,
      authUserId: r.auth_user_id ?? undefined,
      loginMethod: r.login_method ?? undefined,
      displayOrder: r.display_order ?? 0,
      createdAt: new Date(r.created_at),
    }));
    const currentMember = users.find(u => u.authUserId === user.id) ?? null;
    const currentMemberId = currentMember?.id ?? null;
    const currentMemberCanAdmin = currentMember?.role === 'PARENT';

    if (typeof window !== 'undefined') {
      localStorage.setItem('family_dashboard_family_id', resolvedFamilyId);
      if (currentMemberId) {
        localStorage.setItem('family_dashboard_member_id', currentMemberId);
      } else {
        localStorage.removeItem('family_dashboard_member_id');
      }
    }

    const allTasks: Task[] = (tRes.data ?? []).map(r => {
      const rawDays = r.days_of_week as DayOfWeek[] | null | undefined;
      return {
        id: r.id, userId: r.user_id, code: r.code ?? undefined,
        title: r.title, icon: r.icon, difficulty: r.difficulty,
        basePoints: r.base_points, recurrence: r.recurrence,
        daysOfWeek: (rawDays && rawDays.length > 0) ? rawDays : legacyRecurrenceToDays(r.recurrence),
        timeWindow: r.time_window ?? undefined, active: r.active, sortOrder: r.sort_order,
        streakCount: r.streak_count ?? 0,
        lastCompletedAt: r.last_completed_at ? new Date(r.last_completed_at) : null,
      };
    });

    const tasksByUser: Record<string, Task[]> = {};
    const levelsByUser: Record<string, Level> = {};
    const todayCompletions: Record<string, string[]> = {};
    const maxStreakByUser: Record<string, number> = {};
    const longestStreakByUser: Record<string, number> = {};
    const bestDayByUser: Record<string, number> = {};
    const growthByUser: Record<string, number | null> = {};

    const todayDow = now.getDay();
    const todayDowKey = DOW_INDEX[todayDow];

    function avgDailyPct(
      comps: { task_id: string; completed_at: string }[],
      from: Date,
      days: number,
      total: number,
    ): number {
      if (total === 0) return 0;
      let sum = 0;
      for (let i = 0; i < days; i++) {
        const d = startOfDayLocal(addDays(from, i));
        const dEnd = addDays(d, 1);
        const unique = new Set(
          comps
            .filter(c => {
              const t = new Date(c.completed_at).getTime();
              return t >= d.getTime() && t < dEnd.getTime();
            })
            .map(c => c.task_id)
        ).size;
        sum += unique / total;
      }
      return Math.round((sum / days) * 100);
    }

    for (const u of users) {
      tasksByUser[u.id] = allTasks
        .filter(t => t.userId === u.id && t.active === 1)
        .filter(t => t.daysOfWeek.includes(todayDowKey))
        .sort((a, b) => a.sortOrder - b.sortOrder);

      const lvl = (lRes.data ?? []).find(r => r.user_id === u.id);
      if (lvl) {
        levelsByUser[u.id] = {
          userId: lvl.user_id, currentLevel: lvl.current_level,
          totalPoints: lvl.total_points,
          spendableBalance: lvl.spendable_balance ?? 0,
          updatedAt: new Date(lvl.updated_at),
        };
      }

      // timeWindow별 기준 시각으로 todayCompletions 필터링
      const taskMap = new Map(tasksByUser[u.id].map(t => [t.id, t.timeWindow]));
      const userTodayComps = (cTodayRes.data ?? []).filter(c => c.user_id === u.id);
      const completedTaskIds = new Set<string>();
      for (const c of userTodayComps) {
        const tw = taskMap.get(c.task_id);
        const completedAt = new Date(c.completed_at);
        if (tw === 'evening') {
          // 저녁 task: 오늘 12:00 이후 완료만 유효
          if (completedAt >= noonToday) completedTaskIds.add(c.task_id);
        } else {
          // 아침·종일: 오늘 00:00 이후 완료 유효
          if (completedAt >= todayStart) completedTaskIds.add(c.task_id);
        }
      }
      todayCompletions[u.id] = Array.from(completedTaskIds);

      const userStreaks = (sRes.data ?? []).filter(s => s.user_id === u.id);
      // maxStreak: read live streak_count from tasks (primary source)
      maxStreakByUser[u.id] = allTasks
        .filter(t => t.userId === u.id && t.active === 1)
        .reduce((max, t) => Math.max(max, t.streakCount), 0);
      longestStreakByUser[u.id] = userStreaks.reduce((max, s) => Math.max(max, s.longest), 0);

      const userHistComps = (cHistRes.data ?? []).filter(c => c.user_id === u.id);
      const dayMap = new Map<string, Set<string>>();
      for (const c of userHistComps) {
        const key = startOfDayLocal(new Date(c.completed_at)).toISOString();
        if (!dayMap.has(key)) dayMap.set(key, new Set());
        dayMap.get(key)!.add(c.task_id);
      }
      bestDayByUser[u.id] = dayMap.size > 0
        ? Math.max(...[...dayMap.values()].map(s => s.size))
        : 0;

      const total = tasksByUser[u.id].length;
      const recent7Start = addDays(todayStart, -6);
      const prev7Start = addDays(todayStart, -13);
      if (total > 0) {
        const recent7 = avgDailyPct(userHistComps, recent7Start, 7, total);
        const prev7   = avgDailyPct(userHistComps, prev7Start,   7, total);
        const hasPrevData = userHistComps.some(c => {
          const t = new Date(c.completed_at).getTime();
          return t >= prev7Start.getTime() && t < recent7Start.getTime();
        });
        growthByUser[u.id] = hasPrevData ? recent7 - prev7 : null;
      } else {
        growthByUser[u.id] = null;
      }
    }

    set({
      familyId: resolvedFamilyId,
      users,
      currentMemberId,
      currentMemberCanAdmin,
      tasksByUser,
      levelsByUser,
      todayCompletions,
      maxStreakByUser,
      longestStreakByUser,
      bestDayByUser,
      growthByUser,
      hydrated: true,
      timeOfDay,
    });

    if (!_timeIntervalStarted && typeof window !== 'undefined') {
      _timeIntervalStarted = true;
      setInterval(() => {
        const newTOD = getCurrentTimeOfDay();
        if (useFamilyStore.getState().timeOfDay !== newTOD) {
          useFamilyStore.setState({ timeOfDay: newTOD });
        }
      }, 60_000);
    }

    if (!_offlineSyncListenersStarted && typeof window !== 'undefined') {
      _offlineSyncListenersStarted = true;
      window.addEventListener('online', () => {
        useFamilyStore.getState().syncOfflineActions().catch(console.error);
      });
    }

    if (isProbablyOnline()) {
      get().syncOfflineActions().catch(console.error);
    }
  },

  markCompleted: async (userId, taskId) => {
    const mutationKey = taskMutationKey(userId, taskId);
    if (_taskMutationsInFlight.has(mutationKey)) return;
    if ((get().todayCompletions[userId] ?? []).includes(taskId)) return;
    _taskMutationsInFlight.add(mutationKey);

    try {
      // Optimistic: mark as done immediately so the UI feels instant.
      set(state => ({
        todayCompletions: {
          ...state.todayCompletions,
          [userId]: Array.from(new Set([...(state.todayCompletions[userId] ?? []), taskId])),
        },
      }));

      if (!isProbablyOnline()) {
        await enqueueTaskAction('complete', userId, taskId);
        return;
      }

      let result;
      try {
        const { processCompletion } = await import('./gamification');
        result = await processCompletion(userId, taskId);
      } catch (error) {
        await enqueueTaskAction('complete', userId, taskId);
        console.warn('Queued completion for offline sync', error);
        await get().hydrate();
        return;
      }

      // Overwrite with exact backend values; no local arithmetic.
      // CompletionResult.level is always non-null, so this always reflects DB truth.
      set(state => ({
        levelsByUser: { ...state.levelsByUser, [userId]: result.level },
        celebration:  result.celebration ?? state.celebration,
        maxStreakByUser: {
          ...state.maxStreakByUser,
          [userId]: result.maxStreak,
        },
        longestStreakByUser: {
          ...state.longestStreakByUser,
          [userId]: result.longestStreak,
        },
        tasksByUser: {
          ...state.tasksByUser,
          [userId]: (state.tasksByUser[userId] ?? []).map(t =>
            t.id === taskId
              ? { ...t, streakCount: result.streakCurrent, lastCompletedAt: result.taskLastCompletedAt }
              : t
          ),
        },
      }));
    } finally {
      _taskMutationsInFlight.delete(mutationKey);
    }
  },

  undoCompletion: async (userId, taskId) => {
    const mutationKey = taskMutationKey(userId, taskId);
    if (_taskMutationsInFlight.has(mutationKey)) return;
    if (!(get().todayCompletions[userId] ?? []).includes(taskId)) return;
    _taskMutationsInFlight.add(mutationKey);

    try {
      // Optimistic: unmark immediately so the UI feels instant.
      set(state => ({
        todayCompletions: {
          ...state.todayCompletions,
          [userId]: (state.todayCompletions[userId] ?? []).filter(id => id !== taskId),
        },
      }));

      if (!isProbablyOnline()) {
        await enqueueTaskAction('undo', userId, taskId);
        return;
      }

      let undoResult;
      try {
        const { processUndo } = await import('./gamification');
        undoResult = await processUndo(userId, taskId);
      } catch (error) {
        await enqueueTaskAction('undo', userId, taskId);
        console.warn('Queued undo for offline sync', error);
        await get().hydrate();
        return;
      }

      // processUndo returns level:null only when no completion/level row exists in the DB.
      // Hydrate so the UI returns to the database state instead of trusting optimism.
      if (!undoResult.level) {
        await get().hydrate();
        return;
      }

      // Overwrite with exact backend values; no local arithmetic.
      // processUndo returns maxStreak/longestStreak computed across ALL of this
      // user's tasks, so it is safe to SET (not Math.max) these directly.
      set(state => ({
        levelsByUser: { ...state.levelsByUser, [userId]: undoResult.level! },
        maxStreakByUser:     { ...state.maxStreakByUser,     [userId]: undoResult.maxStreak },
        longestStreakByUser: { ...state.longestStreakByUser, [userId]: undoResult.longestStreak },
        tasksByUser: {
          ...state.tasksByUser,
          [userId]: (state.tasksByUser[userId] ?? []).map(t =>
            t.id === taskId
              ? {
                  ...t,
                  // Use backend values directly; do not fall back with ?? here.
                  // taskStreakCount is always a number (>= 0).
                  // taskLastCompletedAt can legitimately be null (first-ever completion undone).
                  streakCount:     undoResult.taskStreakCount,
                  lastCompletedAt: undoResult.taskLastCompletedAt,
                }
              : t
          ),
        },
      }));
    } finally {
      _taskMutationsInFlight.delete(mutationKey);
    }
  },

  syncOfflineActions: async () => {
    if (_syncInFlight || !isProbablyOnline()) return;
    _syncInFlight = true;
    try {
      const actions = await listTaskActions();
      if (actions.length === 0) return;

      const { processCompletion, processUndo } = await import('./gamification');
      for (const action of actions) {
        try {
          const actionAt = new Date(action.createdAt);
          if (action.type === 'complete') {
            await processCompletion(action.userId, action.taskId, false, actionAt);
          } else {
            await processUndo(action.userId, action.taskId, actionAt);
          }
          await deleteTaskAction(action.id);
        } catch (error) {
          console.warn('Offline action sync paused', error);
          break;
        }
      }

      await get().hydrate();
      new BroadcastChannel('habit_sync').postMessage('update');
    } finally {
      _syncInFlight = false;
    }
  },

  redeemReward: async (userId, rewardId, cost) => {
    const { redeemReward: doRedeem } = await import('./gamification');
    const newBalance = await doRedeem(userId, rewardId, cost);
    set(state => ({
      levelsByUser: {
        ...state.levelsByUser,
        [userId]: state.levelsByUser[userId]
          ? { ...state.levelsByUser[userId], spendableBalance: newBalance }
          : state.levelsByUser[userId],
      },
    }));
    await get().hydrate();
    new BroadcastChannel('habit_sync').postMessage('update');
  },

  updateMemberAvatar: (userId, avatarUrl) => {
    set(state => ({
      users: state.users.map(user =>
        user.id === userId ? { ...user, avatarUrl } : user
      ),
    }));
  },

  dismissCelebration: () => set({ celebration: null }),

  toggleSound: () => {
    const next = !get().soundEnabled;
    localStorage.setItem('sound_enabled', next ? '1' : '0');
    set({ soundEnabled: next });
  },
}));
