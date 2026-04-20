import { create } from 'zustand';
import { db, User, Task, Level, startOfDay, Badge } from './db';
import { createBrowserSupabase } from './supabase';

// Supabase 데이터를 Dexie로 동기화 (hydrate 전처리)
async function syncSupabaseToDexie(): Promise<boolean> {
  try {
    const supabase = createBrowserSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const [uRes, tRes, cRes, sRes, bRes, ubRes, lRes] = await Promise.all([
      supabase.from('users').select('*'),
      supabase.from('tasks').select('*'),
      supabase.from('task_completions').select('*'),
      supabase.from('streaks').select('*'),
      supabase.from('badges').select('*'),
      supabase.from('user_badges').select('*'),
      supabase.from('levels').select('*'),
    ]);

    if (uRes.error || !uRes.data?.length) return false;

    await db.users.bulkPut(uRes.data.map(r => ({
      id: r.id, name: r.name, role: r.role, theme: r.theme,
      avatarUrl: r.avatar_url ?? undefined, pinHash: r.pin_hash ?? undefined,
      createdAt: new Date(r.created_at),
    })));

    if (tRes.data?.length) {
      await db.tasks.bulkPut(tRes.data.map(r => ({
        id: r.id, userId: r.user_id, code: r.code ?? undefined,
        title: r.title, icon: r.icon, difficulty: r.difficulty,
        basePoints: r.base_points, recurrence: r.recurrence,
        timeWindow: r.time_window ?? undefined, active: r.active, sortOrder: r.sort_order,
      })));
    }

    if (cRes.data?.length) {
      await db.taskCompletions.bulkPut(cRes.data.map(r => ({
        id: r.id, userId: r.user_id, taskId: r.task_id,
        completedAt: new Date(r.completed_at), pointsAwarded: r.points_awarded,
        partial: r.partial, forgivenessUsed: r.forgiveness_used,
      })));
    }

    if (sRes.data?.length) {
      await db.streaks.bulkPut(sRes.data.map(r => ({
        id: r.id, userId: r.user_id, taskId: r.task_id,
        current: r.current, longest: r.longest,
        lastCompletedAt: r.last_completed_at ? new Date(r.last_completed_at) : undefined,
        forgivenessUsedAt: r.forgiveness_used_at ? new Date(r.forgiveness_used_at) : undefined,
      })));
    }

    if (bRes.data?.length) {
      await db.badges.bulkPut(bRes.data.map(r => ({
        id: r.id, code: r.code, name: r.name, description: r.description,
        icon: r.icon, category: r.category, conditionJson: r.condition_json, active: r.active,
      })));
    }

    if (ubRes.data?.length) {
      await db.userBadges.bulkPut(ubRes.data.map(r => ({
        id: r.id, userId: r.user_id, badgeId: r.badge_id, earnedAt: new Date(r.earned_at),
      })));
    }

    if (lRes.data?.length) {
      await db.levels.bulkPut(lRes.data.map(r => ({
        userId: r.user_id, currentLevel: r.current_level,
        totalPoints: r.total_points, updatedAt: new Date(r.updated_at),
      })));
    }

    return true;
  } catch {
    return false;
  }
}

export type Celebration =
  | { type: 'level_up'; userId: string; newLevel: number }
  | { type: 'badge';    userId: string; badge: Badge };

interface FamilyState {
  users: User[];
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

  hydrate: () => Promise<void>;
  markCompleted: (userId: string, taskId: string) => Promise<void>;
  undoCompletion: (userId: string, taskId: string) => Promise<void>;
  dismissCelebration: () => void;
  toggleSound: () => void;
}

function loadSoundPref(): boolean {
  if (typeof window === 'undefined') return true;
  const v = localStorage.getItem('sound_enabled');
  return v === null ? true : v === '1';
}

export const useFamilyStore = create<FamilyState>((set, get) => ({
  users: [],
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

  hydrate: async () => {
    // Supabase 우선 동기화 → 실패 시 기존 Dexie 데이터 사용
    await syncSupabaseToDexie();

    const users = await db.users.toArray();
    const tasksByUser: Record<string, Task[]> = {};
    const levelsByUser: Record<string, Level> = {};
    const todayCompletions: Record<string, string[]> = {};
    const maxStreakByUser: Record<string, number> = {};
    const longestStreakByUser: Record<string, number> = {};
    const bestDayByUser: Record<string, number> = {};
    const growthByUser: Record<string, number | null> = {};

    // 날짜별 완료율 평균 계산 헬퍼
    function avgDailyPct(
      comps: { taskId: string; completedAt: Date }[],
      from: Date,
      days: number,
      total: number,
    ): number {
      if (total === 0) return 0;
      let sum = 0;
      for (let i = 0; i < days; i++) {
        const d = startOfDay(addDays(from, i));
        const dEnd = addDays(d, 1);
        const unique = new Set(
          comps
            .filter(c => { const t = new Date(c.completedAt).getTime(); return t >= d.getTime() && t < dEnd.getTime(); })
            .map(c => c.taskId)
        ).size;
        sum += unique / total;
      }
      return Math.round((sum / days) * 100);
    }

    function addDays(d: Date, n: number): Date {
      const r = new Date(d); r.setDate(r.getDate() + n); return r;
    }
    const dayStart = startOfDay(new Date());
    const now = new Date();

    for (const u of users) {
      const todayDow = new Date().getDay(); // 0=Sun, 6=Sat
      const isWeekend = todayDow === 0 || todayDow === 6;
      tasksByUser[u.id] = (await db.tasks
        .where('[userId+active]').equals([u.id, 1])
        .toArray()
      ).filter(t => {
        if (t.recurrence === 'weekdays') return !isWeekend;
        if (t.recurrence === 'weekend') return isWeekend;
        return true; // 'daily' or any other value
      }).sort((a, b) => a.sortOrder - b.sortOrder);

      const lvl = await db.levels.get(u.id);
      if (lvl) levelsByUser[u.id] = lvl;

      const comps = await db.taskCompletions
        .where('[userId+completedAt]').between([u.id, dayStart], [u.id, now])
        .toArray();
      todayCompletions[u.id] = comps.map(c => c.taskId);

      const streaks = await db.streaks.where('userId').equals(u.id).toArray();
      maxStreakByUser[u.id] = streaks.reduce((max, s) => Math.max(max, s.current), 0);
      longestStreakByUser[u.id] = streaks.reduce((max, s) => Math.max(max, s.longest), 0);

      // 역대 하루 최고 완료 수: 날짜별 unique taskId 수의 최대값
      const allComps = await db.taskCompletions
        .where('[userId+completedAt]')
        .between([u.id, new Date(0)], [u.id, now])
        .toArray();
      const dayMap = new Map<string, Set<string>>();
      for (const c of allComps) {
        const key = startOfDay(new Date(c.completedAt)).toISOString();
        if (!dayMap.has(key)) dayMap.set(key, new Set());
        dayMap.get(key)!.add(c.taskId);
      }
      bestDayByUser[u.id] = dayMap.size > 0
        ? Math.max(...[...dayMap.values()].map(s => s.size))
        : 0;

      // 성장 힌트: 최근 7일 vs 이전 7일 완료율 차이
      const total = tasksByUser[u.id].length;
      const recent7Start = addDays(dayStart, -6);
      const prev7Start = addDays(dayStart, -13);
      if (total > 0) {
        const recent7 = avgDailyPct(allComps, recent7Start, 7, total);
        const prev7   = avgDailyPct(allComps, prev7Start,   7, total);
        const hasPrevData = allComps.some(c => {
          const t = new Date(c.completedAt).getTime();
          return t >= prev7Start.getTime() && t < recent7Start.getTime();
        });
        growthByUser[u.id] = hasPrevData ? recent7 - prev7 : null;
      } else {
        growthByUser[u.id] = null;
      }
    }

    set({ users, tasksByUser, levelsByUser, todayCompletions, maxStreakByUser, longestStreakByUser, bestDayByUser, growthByUser, hydrated: true });
  },

  markCompleted: async (userId, taskId) => {
    set(state => ({
      todayCompletions: {
        ...state.todayCompletions,
        [userId]: Array.from(new Set([...(state.todayCompletions[userId] ?? []), taskId])),
      },
    }));

    const { processCompletion } = await import('./gamification');
    const result = await processCompletion(userId, taskId);

    set(state => ({
      levelsByUser: result.level
        ? { ...state.levelsByUser, [userId]: result.level }
        : state.levelsByUser,
      celebration: result.celebration ?? state.celebration,
    }));
  },

  undoCompletion: async (userId, taskId) => {
    set(state => ({
      todayCompletions: {
        ...state.todayCompletions,
        [userId]: (state.todayCompletions[userId] ?? []).filter(id => id !== taskId),
      },
    }));

    const { processUndo } = await import('./gamification');
    const updatedLevel = await processUndo(userId, taskId);

    if (updatedLevel) {
      set(state => ({
        levelsByUser: { ...state.levelsByUser, [userId]: updatedLevel },
      }));
    }
  },

  dismissCelebration: () => set({ celebration: null }),

  toggleSound: () => {
    const next = !get().soundEnabled;
    localStorage.setItem('sound_enabled', next ? '1' : '0');
    set({ soundEnabled: next });
  },
}));
