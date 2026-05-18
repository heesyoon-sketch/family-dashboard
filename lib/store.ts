import { create } from 'zustand';
import { Level, Badge, Task, User, Reward, FamilyActivity, DayOfWeek, DOW_INDEX, legacyRecurrenceToDays } from './db';
import type { AchievementProgress } from './achievements/engine';
import {
  calculateMomentum,
  calculateHarmony,
  composeBonusPercent,
  loadoutBonusFromIds,
  type BonusBreakdown,
  type MomentumResult,
  type HarmonyResult,
} from './progression';
import { assertUuid, createBrowserSupabase } from './supabase';
import { deleteTaskAction, enqueueTaskAction, isProbablyOnline, listTaskActions, pruneStaleActions } from './offlineQueue';
import {
  getCompletionWindowEnd,
  getCompletionWindowStart,
  getCurrentTimeWindow,
  isTaskActiveInTimeWindow,
  normalizeTimeWindow,
  type TimeWindow,
} from './timeWindows';

async function requireAuthSession(supabase: ReturnType<typeof createBrowserSupabase>): Promise<void> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw new Error('로그인이 필요합니다');
  }
}

// Once-per-session flag so we toast the user about hydrate regressions only
// the first time, rather than every wake-up.
let _hydrateRegressionToastShown = false;

interface HydrateErrorEntry {
  label: string;
  error: { message?: string; code?: string; details?: string } | null;
}

async function maybeToastRegression(message: string) {
  if (_hydrateRegressionToastShown) return;
  _hydrateRegressionToastShown = true;
  try {
    const { toast } = await import('sonner');
    toast.error(message, { duration: 10000 });
  } catch {
    // sonner not loaded — console.error already happened, that's enough.
  }
}

function surfaceHydrateErrors(entries: HydrateErrorEntry[], hadPriorData: boolean) {
  const failed = entries.filter(e => e.error);
  if (failed.length === 0) return;
  for (const { label, error } of failed) {
    console.error(`[hydrate:${label}]`, error);
  }
  // If we previously had a successful hydrate and now suddenly all the
  // important reads fail, that's almost always a schema/migration mismatch
  // (column missing, RLS policy regression). Tell the user something is
  // wrong instead of letting the dashboard look mysteriously empty.
  if (hadPriorData) {
    const labels = failed.map(f => f.label).join(', ');
    void maybeToastRegression(
      `데이터를 불러오지 못했어요 (${labels}). 새로고침해도 비어 있으면 마이그레이션 적용 여부를 확인해주세요.`,
    );
  }
}

export type Celebration =
  | { type: 'level_up'; userId: string; newLevel: number }
  | { type: 'badge';    userId: string; badge: Badge };

export type CompletionFeedback =
  | {
      status: 'awarded';
      taskId: string;
      basePoints: number;
      pointsAwarded: number;
      bonus: BonusBreakdown;
    }
  | {
      status: 'queued';
      taskId: string;
      basePoints: number;
    };

export type TimeOfDay = TimeWindow;

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

function startOfDayLocal(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}

export function getCurrentTimeOfDay(): TimeOfDay {
  return getCurrentTimeWindow();
}

export interface WeeklyRecap {
  userId: string;
  weekStartISO: string;     // Monday of the recapped week
  weekDone: number;
  weekPossible: number;
  weekPct: number;
  weeklyPoints: number;
  perfectDays: number;      // 0–7
  topTaskTitle: string | null;
  topTaskCount: number;
  lastWeekPct: number | null;
  deltaPct: number | null;
  dailyStreak: number;
}

interface FamilyState {
  familyId: string | null;
  familyName: string | null;
  users: User[];
  rewards: Reward[];
  activeTaskCount: number;
  currentMemberId: string | null;
  currentMemberCanAdmin: boolean;
  tasksByUser: Record<string, Task[]>;
  activitiesByUser: Record<string, FamilyActivity[]>;
  levelsByUser: Record<string, Level>;
  todayCompletions: Record<string, string[]>;
  maxStreakByUser: Record<string, number>;
  longestStreakByUser: Record<string, number>;
  bestDayByUser: Record<string, number>;
  growthByUser: Record<string, number | null>;
  dailyStreakByUser: Record<string, number>;
  dailyStreakAtRiskByUser: Record<string, boolean>;
  weeklyRecapByUser: Record<string, WeeklyRecap>;
  /** Per-member emotional rhythm — replaces the old streak-multiplier system. */
  momentumByUser: Record<string, MomentumResult>;
  /** Family-wide cooperation/resonance score. */
  harmony: HarmonyResult | null;
  celebration: Celebration | null;
  /** Insignias unlocked but not yet shown to the user. Surfaces a celebration
   *  pop-up that nudges them to check out the Insignia Wall. */
  insigniaQueue: AchievementProgress[];
  hydrated: boolean;
  soundEnabled: boolean;
  timeOfDay: TimeOfDay;
  // ms since epoch of the last successful hydrate. Used by SyncBootstrap to
  // skip wake-up refetches when data is still fresh — realtime keeps state
  // up-to-date between hydrates, so we only need to refetch on stale wakes.
  lastHydrateAt: number;

  hydrate: () => Promise<void>;
  _hydrateOnce: () => Promise<void>;
  markCompleted: (userId: string, taskId: string) => Promise<CompletionFeedback | null>;
  undoCompletion: (userId: string, taskId: string) => Promise<void>;
  syncOfflineActions: () => Promise<void>;
  redeemReward: (userId: string, rewardId: string, cost: number) => Promise<void>;
  purchaseRewardJoint: (rewardId: string, user1Id: string, user1Amount: number, user2Id: string, user2Amount: number) => Promise<void>;
  transferPointsWithMessage: (senderId: string, receiverId: string, amount: number, message: string) => Promise<void>;
  updateMemberAvatar: (userId: string, avatarUrl: string) => void;
  /** Optimistically overwrite a user's spendable balance (after cosmetic spend). */
  applyBalance: (userId: string, newBalance: number) => void;
  dismissCelebration: () => void;
  enqueueInsigniaUnlocks: (items: AchievementProgress[]) => void;
  dismissInsigniaUnlock: () => void;
  toggleSound: () => void;
  reset: () => void;
}

function loadSoundPref(): boolean {
  if (typeof window === 'undefined') return true;
  const v = localStorage.getItem('sound_enabled');
  return v === null ? true : v === '1';
}

let _timeIntervalStarted = false;
let _offlineSyncListenersStarted = false;
let _syncInFlight = false;
let _activityCleanupDone = false;
const _taskMutationsInFlight = new Set<string>();

let _realtimeChannel: ReturnType<ReturnType<typeof createBrowserSupabase>['channel']> | null = null;
let _realtimeSubscribedFamilyId: string | null = null;
let _hydrateDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let _hydrateInFlight: Promise<void> | null = null;
let _hydrateQueued = false;

function broadcastSync() {
  const ch = new BroadcastChannel('habit_sync');
  ch.postMessage('update');
  ch.close();
}

// 400ms debounce: long enough to coalesce a burst of admin edits or a
// rapid sequence of completions, short enough that the second device
// feels live. Earlier value (1500ms) felt laggy on phones.
const REALTIME_HYDRATE_DEBOUNCE_MS = 400;

function scheduleRealtimeHydrate(ownMemberId: string | null, eventUserId?: string) {
  if (eventUserId && eventUserId === ownMemberId) return;
  if (_hydrateDebounceTimer) clearTimeout(_hydrateDebounceTimer);
  _hydrateDebounceTimer = setTimeout(() => {
    _hydrateDebounceTimer = null;
    useFamilyStore.getState().hydrate().catch(console.error);
  }, REALTIME_HYDRATE_DEBOUNCE_MS);
}

// Admin-driven tables (tasks, users, rewards, family_activities) are scoped by
// family_id rather than user_id, so the per-member self-filter above doesn't
// apply. We still debounce so a burst of edits coalesces into one hydrate.
function scheduleFamilyHydrate() {
  if (_hydrateDebounceTimer) clearTimeout(_hydrateDebounceTimer);
  _hydrateDebounceTimer = setTimeout(() => {
    _hydrateDebounceTimer = null;
    useFamilyStore.getState().hydrate().catch(console.error);
  }, REALTIME_HYDRATE_DEBOUNCE_MS);
}

function taskMutationKey(userId: string, taskId: string): string {
  return `${userId}:${taskId}`;
}

function normaliseSalePercentage(value: unknown): number {
  const n = Math.round(Number(value ?? 0));
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

function mapRewardRow(row: Record<string, unknown>): Reward {
  const saleName = typeof row.sale_name === 'string' && row.sale_name.trim()
    ? row.sale_name.trim()
    : undefined;
  const salePrice = Number(row.sale_price);
  return {
    id: row.id as string,
    title: (row.title ?? row.name ?? '') as string,
    cost_points: Number(row.cost_points ?? 0),
    icon: (row.icon ?? 'gift') as string,
    sale_enabled: Boolean(row.sale_enabled),
    sale_percentage: normaliseSalePercentage(row.sale_percentage),
    sale_price: row.sale_price == null || !Number.isFinite(salePrice) ? undefined : Math.max(0, Math.round(salePrice)),
    sale_name: saleName,
    is_hidden: Boolean(row.is_hidden),
    is_sold_out: Boolean(row.is_sold_out),
  };
}

function mapFamilyActivityRow(row: Record<string, unknown>): FamilyActivity {
  return {
    id: row.id as string,
    familyId: row.family_id as string,
    userId: row.user_id as string,
    type: row.type as FamilyActivity['type'],
    amount: Number(row.amount ?? 0),
    relatedUserName: (row.related_user_name as string | null) ?? undefined,
    message: (row.message as string | null) ?? undefined,
    createdAt: new Date(row.created_at as string),
  };
}

export const useFamilyStore = create<FamilyState>((set, get) => ({
  familyId: null,
  familyName: null,
  users: [],
  rewards: [],
  activeTaskCount: 0,
  currentMemberId: null,
  currentMemberCanAdmin: false,
  tasksByUser: {},
  activitiesByUser: {},
  levelsByUser: {},
  todayCompletions: {},
  maxStreakByUser: {},
  longestStreakByUser: {},
  bestDayByUser: {},
  growthByUser: {},
  dailyStreakByUser: {},
  dailyStreakAtRiskByUser: {},
  weeklyRecapByUser: {},
  momentumByUser: {},
  harmony: null,
  celebration: null,
  insigniaQueue: [],
  hydrated: false,
  soundEnabled: loadSoundPref(),
  timeOfDay: getCurrentTimeOfDay(),
  lastHydrateAt: 0,

  hydrate: async () => {
    if (_hydrateInFlight) {
      _hydrateQueued = true;
      return _hydrateInFlight;
    }
    _hydrateInFlight = (async () => {
      try {
        await get()._hydrateOnce();
      } finally {
        _hydrateInFlight = null;
        if (_hydrateQueued) {
          _hydrateQueued = false;
          get().hydrate().catch(console.error);
        }
      }
    })();
    return _hydrateInFlight;
  },

  _hydrateOnce: async () => {
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
        familyName: null,
        users: [],
        rewards: [],
        activeTaskCount: 0,
        currentMemberId: null,
        currentMemberCanAdmin: false,
        tasksByUser: {},
        activitiesByUser: {},
        levelsByUser: {},
        todayCompletions: {},
      });
      return;
    }
    const cachedMemberId = typeof window !== 'undefined'
      ? localStorage.getItem('family_dashboard_member_id')
      : null;

    // get_my_family_info() returns { id, name } in one round-trip, replacing the
    // previous get_my_family_id() + get_my_family_name() + fallback families query.
    const { data: familyInfo } = await supabase.rpc('get_my_family_info');
    let resolvedFamilyId = (familyInfo as { id: string; name: string } | null)?.id ?? null;
    const familyName = (familyInfo as { id: string; name: string } | null)?.name ?? null;

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
        familyName: null,
        users: [],
        rewards: [],
        activeTaskCount: 0,
        currentMemberId: null,
        currentMemberCanAdmin: false,
        tasksByUser: {},
        activitiesByUser: {},
        levelsByUser: {},
        todayCompletions: {},
      });
      return;
    }

    const now = new Date();
    const todayStart = startOfDayLocal(now);
    const timeOfDay = getCurrentTimeOfDay();
    // Recap window needs three trailing weeks (current week-in-progress so we can show
    // a daily streak that extends into today, plus the two completed weeks we compare).
    const thirtyDaysAgo = addDays(todayStart, -29);

    // Phase 1: load users, tasks, and rewards (family_id already resolved above).
    // .is('deleted_at', null) filters out soft-deleted rows. Migration 060
    // added the column with a default null and partial indexes scoped by
    // (family_id) where deleted_at is null, so this filter is cheap.
    const [uRes, tRes, rRes] = await Promise.all([
      supabase.from('users').select('*').eq('family_id', resolvedFamilyId).is('deleted_at', null).order('display_order', { ascending: true }).order('created_at', { ascending: true }),
      supabase.from('tasks').select('*').eq('family_id', resolvedFamilyId).is('deleted_at', null),
      supabase.from('rewards').select('*').eq('family_id', resolvedFamilyId).is('deleted_at', null).order('cost_points'),
    ]);
    // Surface SELECT errors loudly. Previously these were silently swallowed
    // by `?? []` fallbacks, which meant a missing column or RLS regression
    // would render the dashboard as "no data" with no diagnostic — exactly
    // the symptom that hid the missing migration 060 deployment.
    surfaceHydrateErrors([
      { label: 'users',   error: uRes.error },
      { label: 'tasks',   error: tRes.error },
      { label: 'rewards', error: rRes.error },
    ], get().lastHydrateAt > 0);

    // Phase 2: load per-user tables filtered by the verified user IDs.
    // levels/streaks have no family_id column; task_completions relies on user_id.
    // Filtering by userIds (not just RLS) ensures data never leaks across families
    // even if a ghost auth link were to exist.
    const userIds = (uRes.data ?? []).map((r: { id: string }) => r.id);
    const safeIds = userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'];

    const [lRes, sRes, cTodayRes, cHistRes, aRes] = await Promise.all([
      supabase.from('levels').select('*').in('user_id', safeIds),
      supabase.from('streaks').select('*').in('user_id', safeIds),
      supabase.from('task_completions')
        .select('id, user_id, task_id, completed_at')
        .in('user_id', safeIds)
        .gte('completed_at', todayStart.toISOString()),
      supabase.from('task_completions')
        .select('user_id, task_id, completed_at, points_awarded')
        .in('user_id', safeIds)
        .gte('completed_at', thirtyDaysAgo.toISOString()),
      supabase.from('family_activities')
        .select('*')
        .eq('family_id', resolvedFamilyId)
        .in('user_id', safeIds)
        .in('type', ['GIFT_SENT', 'GIFT_RECEIVED', 'REWARD_PURCHASED', 'REWARD_REFUNDED', 'SYSTEM_MESSAGE'])
        .order('created_at', { ascending: false })
        .limit(200),
    ]);
    surfaceHydrateErrors([
      { label: 'levels',           error: lRes.error },
      { label: 'streaks',          error: sRes.error },
      { label: 'completions:today', error: cTodayRes.error },
      { label: 'completions:30d',  error: cHistRes.error },
      { label: 'family_activities', error: aRes.error },
    ], get().lastHydrateAt > 0);

    const users: User[] = (uRes.data ?? []).map(r => ({
      id: r.id, name: r.name, role: r.role, theme: r.theme,
      avatarUrl: r.avatar_url ?? undefined, pinHash: r.pin_hash ?? undefined,
      email: r.email ?? undefined,
      authUserId: r.auth_user_id ?? undefined,
      loginMethod: r.login_method ?? undefined,
      displayOrder: r.display_order ?? 0,
      createdAt: new Date(r.created_at),
    }));
    const rewards: Reward[] = (rRes.data ?? []).map(r => mapRewardRow(r as Record<string, unknown>));
    const activeTaskCount = (tRes.data ?? []).filter(task => task.active === 1).length;
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
        timeWindow: normalizeTimeWindow(r.time_window), active: r.active, sortOrder: r.sort_order,
        streakCount: r.streak_count ?? 0,
        lastCompletedAt: r.last_completed_at ? new Date(r.last_completed_at) : null,
      };
    });

    const tasksByUser: Record<string, Task[]> = {};
    const activitiesByUser: Record<string, FamilyActivity[]> = {};
    const levelsByUser: Record<string, Level> = {};
    const todayCompletions: Record<string, string[]> = {};
    const maxStreakByUser: Record<string, number> = {};
    const longestStreakByUser: Record<string, number> = {};
    const bestDayByUser: Record<string, number> = {};
    const growthByUser: Record<string, number | null> = {};
    const dailyStreakByUser: Record<string, number> = {};
    const dailyStreakAtRiskByUser: Record<string, boolean> = {};
    const weeklyRecapByUser: Record<string, WeeklyRecap> = {};
    const momentumByUser: Record<string, MomentumResult> = {};
    const completionDatesByUser: Record<string, Date[]> = {};
    // Per-member daily done/due arrays for the trailing 14 days. Momentum
    // uses all 14; harmony slices the first 7. Storing 14 once keeps the
    // hydrate cost flat regardless of which window each module wants.
    const dailyByUser: Record<string, { done: number[]; due: number[] }> = {};
    const PROGRESSION_WINDOW = 14;

    // Recap focuses on the most recently *completed* ISO week (Mon–Sun).
    // weekMonday matches stats/page.tsx behaviour.
    const dowToday = now.getDay();
    const mondayOffset = dowToday === 0 ? 6 : dowToday - 1;
    const thisWeekMonday = startOfDayLocal(addDays(todayStart, -mondayOffset));
    const recapWeekStart = addDays(thisWeekMonday, -7);
    const recapWeekEnd = thisWeekMonday;
    const priorWeekStart = addDays(recapWeekStart, -7);
    const eveningCutoffHour = 18;

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
      activitiesByUser[u.id] = (aRes.data ?? [])
        .map(row => mapFamilyActivityRow(row as Record<string, unknown>))
        .filter(activity => activity.userId === u.id);

      const lvl = (lRes.data ?? []).find(r => r.user_id === u.id);
      if (lvl) {
        levelsByUser[u.id] = {
          userId: lvl.user_id, currentLevel: lvl.current_level,
          totalPoints: lvl.total_points,
          spendableBalance: lvl.spendable_balance ?? 0,
          updatedAt: new Date(lvl.updated_at),
        };
      }

      // 현재 dashboard window의 완료만 반영한다. "both" task는 오전/오후·저녁을 따로 완료할 수 있다.
      const taskMap = new Map(tasksByUser[u.id].map(t => [t.id, t.timeWindow]));
      const userTodayComps = (cTodayRes.data ?? []).filter(c => c.user_id === u.id);
      const completedTaskIds = new Set<string>();
      for (const c of userTodayComps) {
        const tw = taskMap.get(c.task_id);
        if (!isTaskActiveInTimeWindow(tw, timeOfDay)) continue;
        const completedAt = new Date(c.completed_at);
        const windowStart = getCompletionWindowStart(todayStart, tw, timeOfDay);
        const windowEnd = getCompletionWindowEnd(todayStart, tw, timeOfDay);
        if (completedAt >= windowStart && completedAt < windowEnd) {
          completedTaskIds.add(c.task_id);
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
      const completionDates: Date[] = [];
      for (const c of userHistComps) {
        const completedAt = new Date(c.completed_at);
        const key = startOfDayLocal(completedAt).toISOString();
        if (!dayMap.has(key)) dayMap.set(key, new Set());
        dayMap.get(key)!.add(c.task_id);
        completionDates.push(completedAt);
      }
      completionDatesByUser[u.id] = completionDates;

      // Build per-day done/due arrays for the trailing 14 days. Momentum and
      // harmony are %-based so each member is judged against their own due
      // load — fairer than counting raw completions when habits and counts
      // differ across the family. Days where nothing is scheduled don't
      // pull the score down (skipped from numerator and denominator).
      const userActiveTasks = allTasks.filter(t => t.userId === u.id && t.active === 1);
      const dailyDone = new Array<number>(PROGRESSION_WINDOW).fill(0);
      const dailyDue = new Array<number>(PROGRESSION_WINDOW).fill(0);
      for (let ago = 0; ago < PROGRESSION_WINDOW; ago++) {
        const dayStart = startOfDayLocal(addDays(todayStart, -ago));
        const dayEndMs = addDays(dayStart, 1).getTime();
        const dayStartMs = dayStart.getTime();
        const dowKey = DOW_INDEX[dayStart.getDay()];
        const dueTasks = userActiveTasks.filter(t => t.daysOfWeek.includes(dowKey));
        dailyDue[ago] = dueTasks.length;
        if (dueTasks.length === 0) continue;
        const dueIds = new Set(dueTasks.map(t => t.id));
        const doneIds = new Set<string>();
        for (const c of userHistComps) {
          const tms = new Date(c.completed_at).getTime();
          if (tms >= dayStartMs && tms < dayEndMs && dueIds.has(c.task_id)) {
            doneIds.add(c.task_id);
          }
        }
        dailyDone[ago] = doneIds.size;
      }
      dailyByUser[u.id] = { done: dailyDone, due: dailyDue };
      momentumByUser[u.id] = calculateMomentum({ dailyDone, dailyDue });
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

      // Daily streak — consecutive days ending today (or yesterday if today is empty)
      // where the user completed ≥1 task. dayMap is already keyed by startOfDay ISO.
      const todayHadActivity = (dayMap.get(todayStart.toISOString())?.size ?? 0) > 0;
      let dailyStreak = 0;
      let cursor = todayHadActivity ? todayStart : addDays(todayStart, -1);
      // Bound the walk by the history window (30 days back) to avoid infinite loops on bad data.
      for (let safety = 0; safety < 30; safety++) {
        const dayActive = (dayMap.get(cursor.toISOString())?.size ?? 0) > 0;
        if (!dayActive) break;
        dailyStreak++;
        cursor = addDays(cursor, -1);
      }
      dailyStreakByUser[u.id] = dailyStreak;
      dailyStreakAtRiskByUser[u.id] =
        dailyStreak > 0 && !todayHadActivity && now.getHours() >= eveningCutoffHour;

      // Weekly recap for the just-completed ISO week.
      const allUserActiveTasks = allTasks.filter(t => t.userId === u.id && t.active === 1);
      let recapDone = 0;
      let recapPossible = 0;
      let perfectDays = 0;
      let recapPoints = 0;
      const recapTaskCounts = new Map<string, number>();
      for (let i = 0; i < 7; i++) {
        const day = addDays(recapWeekStart, i);
        const dayKeyStr = DOW_INDEX[day.getDay()];
        const due = allUserActiveTasks.filter(t => t.daysOfWeek.includes(dayKeyStr));
        const dueIds = new Set(due.map(t => t.id));
        const dayDoneIds = dayMap.get(day.toISOString()) ?? new Set<string>();
        const intersect = new Set([...dayDoneIds].filter(id => dueIds.has(id)));
        recapDone += intersect.size;
        recapPossible += due.length;
        if (due.length > 0 && intersect.size >= due.length) perfectDays++;
        for (const id of intersect) recapTaskCounts.set(id, (recapTaskCounts.get(id) ?? 0) + 1);
      }
      for (const c of userHistComps) {
        const t = new Date(c.completed_at).getTime();
        if (t >= recapWeekStart.getTime() && t < recapWeekEnd.getTime()) {
          // points_awarded was added to the select list above.
          const pts = (c as { points_awarded?: number }).points_awarded ?? 0;
          recapPoints += pts;
        }
      }

      // Prior week comparison
      let priorDone = 0;
      let priorPossible = 0;
      for (let i = 0; i < 7; i++) {
        const day = addDays(priorWeekStart, i);
        const dayKeyStr = DOW_INDEX[day.getDay()];
        const due = allUserActiveTasks.filter(t => t.daysOfWeek.includes(dayKeyStr));
        const dueIds = new Set(due.map(t => t.id));
        const dayDoneIds = dayMap.get(day.toISOString()) ?? new Set<string>();
        const intersect = new Set([...dayDoneIds].filter(id => dueIds.has(id)));
        priorDone += intersect.size;
        priorPossible += due.length;
      }
      const recapPct = recapPossible > 0 ? Math.round((recapDone / recapPossible) * 100) : 0;
      const lastWeekPct = priorPossible > 0 ? Math.round((priorDone / priorPossible) * 100) : null;

      let topTaskId: string | null = null;
      let topTaskCount = 0;
      for (const [id, n] of recapTaskCounts) {
        if (n > topTaskCount) { topTaskId = id; topTaskCount = n; }
      }
      const topTask = topTaskId ? allUserActiveTasks.find(t => t.id === topTaskId) : null;

      weeklyRecapByUser[u.id] = {
        userId: u.id,
        weekStartISO: recapWeekStart.toISOString(),
        weekDone: recapDone,
        weekPossible: recapPossible,
        weekPct: recapPct,
        weeklyPoints: recapPoints,
        perfectDays,
        topTaskTitle: topTask?.title ?? null,
        topTaskCount,
        lastWeekPct,
        deltaPct: lastWeekPct === null ? null : recapPct - lastWeekPct,
        dailyStreak,
      };
    }

    // Family-level cooperation score derived from the same trailing window
    // used for momentum. Cheap (O(members * window)) so it's safe to recompute
    // every hydrate.
    const harmony = calculateHarmony({
      dailyByMember: dailyByUser,
      memberIds: users.map(u => u.id),
    });

    set({
      familyId: resolvedFamilyId,
      familyName,
      users,
      rewards,
      activeTaskCount,
      currentMemberId,
      currentMemberCanAdmin,
      tasksByUser,
      activitiesByUser,
      levelsByUser,
      todayCompletions,
      maxStreakByUser,
      longestStreakByUser,
      bestDayByUser,
      growthByUser,
      dailyStreakByUser,
      dailyStreakAtRiskByUser,
      weeklyRecapByUser,
      momentumByUser,
      harmony,
      hydrated: true,
      timeOfDay,
      lastHydrateAt: Date.now(),
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

    if (!_activityCleanupDone && isProbablyOnline() && typeof window !== 'undefined') {
      const lastCleanup = localStorage.getItem('activity_cleanup_date');
      const today = new Date().toDateString();
      if (lastCleanup !== today) {
        _activityCleanupDone = true;
        const supabaseForCleanup = createBrowserSupabase();
        (async () => {
          const { error } = await supabaseForCleanup.rpc('prune_old_task_activities');
          if (error) { _activityCleanupDone = false; return; }
          localStorage.setItem('activity_cleanup_date', today);
        })();
      }
    }

    // Cross-device realtime sync. Subscribes once per family; resubscribes only if
    // the family changes. The user-scoped tables (task_completions, levels) use a
    // self-filter via scheduleRealtimeHydrate so a device doesn't bounce on its own
    // optimistic write coming back. The family-scoped tables (tasks, users, rewards,
    // family_activities) are admin-driven and rare, so we always hydrate.
    if (typeof window !== 'undefined' && userIds.length > 0 && resolvedFamilyId !== _realtimeSubscribedFamilyId) {
      if (_realtimeChannel) {
        _realtimeChannel.unsubscribe();
        _realtimeChannel = null;
      }
      _realtimeSubscribedFamilyId = resolvedFamilyId;
      const userFilter = `user_id=in.(${userIds.join(',')})`;
      const familyFilter = `family_id=eq.${resolvedFamilyId}`;
      const currentMemberId = get().currentMemberId;
      _realtimeChannel = supabase
        .channel(`family-sync:${resolvedFamilyId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'task_completions', filter: userFilter },
          payload => scheduleRealtimeHydrate(currentMemberId, (payload.new as Record<string, string> | null)?.user_id ?? (payload.old as Record<string, string> | null)?.user_id),
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'levels', filter: userFilter },
          payload => scheduleRealtimeHydrate(currentMemberId, (payload.new as Record<string, string> | null)?.user_id),
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tasks', filter: familyFilter },
          () => scheduleFamilyHydrate(),
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'users', filter: familyFilter },
          () => scheduleFamilyHydrate(),
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'rewards', filter: familyFilter },
          () => scheduleFamilyHydrate(),
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'family_activities', filter: familyFilter },
          () => scheduleFamilyHydrate(),
        )
        .subscribe();
    }
  },

  markCompleted: async (userId, taskId) => {
    const mutationKey = taskMutationKey(userId, taskId);
    if (_taskMutationsInFlight.has(mutationKey)) return null;
    if ((get().todayCompletions[userId] ?? []).includes(taskId)) return null;
    _taskMutationsInFlight.add(mutationKey);

    try {
      const task = (get().tasksByUser[userId] ?? []).find(candidate => candidate.id === taskId);
      const basePoints = task?.basePoints ?? 0;

      // Optimistic: mark as done immediately so the UI feels instant.
      set(state => ({
        todayCompletions: {
          ...state.todayCompletions,
          [userId]: Array.from(new Set([...(state.todayCompletions[userId] ?? []), taskId])),
        },
      }));

      if (!isProbablyOnline()) {
        await enqueueTaskAction('complete', userId, taskId);
        return { status: 'queued', taskId, basePoints };
      }

      // Compose the loadout + momentum + harmony bonus on the client and
      // hand it to the RPC. The server clamps to 50% so a stale or tampered
      // client can never inflate points beyond the design ceiling (1.5×).
      let bonus = composeBonusPercent({
        momentumPercent: 0,
        harmonyPercent: 0,
        loadoutPercent: 0,
      });
      try {
        const familyId = get().familyId;
        if (familyId) {
          const { loadAchievementState } = await import('./achievements/storage');
          const ach = loadAchievementState(familyId, get().users);
          const child = ach.children[userId];
          const equipped = child?.equippedInsigniaIds ?? [];
          const unlocked = new Set(Object.keys(child?.unlockedAtByAchievementId ?? {}));
          const loadoutPct = loadoutBonusFromIds(equipped, unlocked);
          const momentumPct = get().momentumByUser[userId]?.bonusPercent ?? 0;
          const harmonyPct = get().harmony?.bonusPercent ?? 0;
          bonus = composeBonusPercent({
            momentumPercent: momentumPct,
            harmonyPercent: harmonyPct,
            loadoutPercent: loadoutPct,
          });
        }
      } catch (error) {
        console.warn('[bonus] failed to compose, sending 0%', error);
      }

      let result;
      try {
        const { processCompletion } = await import('./gamification');
        result = await processCompletion(userId, taskId, false, new Date(), bonus.totalPercent);
        console.log('[completion] bonus%', bonus.totalPercent, '→ awarded', result.pointsAwarded, 'pts');
      } catch (error) {
        await enqueueTaskAction('complete', userId, taskId);
        console.warn('Queued completion for offline sync', error);
        await get().hydrate();
        return { status: 'queued', taskId, basePoints };
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

      try {
        const familyId = get().familyId;
        if (familyId) {
          const { syncAchievements } = await import('./achievements/storage');
          const achievementResult = await syncAchievements({
            familyId,
            children: get().users,
            tasksByUser: get().tasksByUser,
            levelsByUser: get().levelsByUser,
            awardNew: true,
          });
          if (Object.keys(achievementResult.awardedLevelsByUser).length > 0) {
            set(state => ({
              levelsByUser: {
                ...state.levelsByUser,
                ...achievementResult.awardedLevelsByUser,
              },
            }));
          }
          // Surface a celebratory pop-up for everything that unlocked from this
          // completion (could be the kid's own badge plus a team badge that fired
          // on the sibling). The overlay queues them and walks through one by one.
          if (achievementResult.newlyUnlocked.length > 0) {
            get().enqueueInsigniaUnlocks(achievementResult.newlyUnlocked);
          }
        }
      } catch (error) {
        console.warn('[achievements] sync after completion failed', error);
      }

      return {
        status: 'awarded',
        taskId,
        basePoints,
        pointsAwarded: result.pointsAwarded,
        bonus,
      };
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

      // Walk back any insignia the now-undone completion put over the line.
      // Revokes the badge, refunds the achievement bonus points, and
      // unequips it (and any title/visual style it solely unlocked) so the
      // wall stays consistent with the underlying activity.
      try {
        const familyId = get().familyId;
        if (familyId) {
          const { revokeUnmetAchievements } = await import('./achievements/storage');
          const revokeResult = await revokeUnmetAchievements({
            familyId,
            children: get().users,
            tasksByUser: get().tasksByUser,
          });
          if (Object.keys(revokeResult.refundedLevelsByUser).length > 0) {
            set(state => ({
              levelsByUser: {
                ...state.levelsByUser,
                ...revokeResult.refundedLevelsByUser,
              },
            }));
          }
          if (revokeResult.revoked.length > 0) {
            console.log('[undo] revoked insignias', revokeResult.revoked.map(r => r.achievementId));
          }
        }
      } catch (error) {
        console.warn('[undo] revoke evaluation failed', error);
      }
    } finally {
      _taskMutationsInFlight.delete(mutationKey);
    }
  },

  syncOfflineActions: async () => {
    if (_syncInFlight || !isProbablyOnline()) return;
    _syncInFlight = true;
    try {
      await pruneStaleActions();
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
      broadcastSync();
    } finally {
      _syncInFlight = false;
    }
  },

  redeemReward: async (userId, rewardId, cost) => {
    assertUuid(userId, 'userId');
    assertUuid(rewardId, 'rewardId');
    const supabase = createBrowserSupabase();
    await requireAuthSession(supabase);
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
    broadcastSync();
  },

  purchaseRewardJoint: async (rewardId, user1Id, user1Amount, user2Id, user2Amount) => {
    assertUuid(rewardId, 'rewardId');
    assertUuid(user1Id, 'user1Id');
    assertUuid(user2Id, 'user2Id');
    const supabase = createBrowserSupabase();
    await requireAuthSession(supabase);
    const payload = {
      p_reward_id: rewardId,
      p_user1_id: user1Id,
      p_user1_amount: Math.max(0, Math.round(user1Amount)),
      p_user2_id: user2Id,
      p_user2_amount: Math.max(0, Math.round(user2Amount)),
    };
    console.log('[shop:purchase_reward_joint] supabase.rpc payload', payload);
    const { data, error } = await supabase.rpc('purchase_reward_joint', payload);
    if (error) {
      console.error('[shop:purchase_reward_joint] supabase.rpc error', { payload, error });
      throw new Error(error.message);
    }

    const result = data as {
      user1Id: string;
      user1Balance: number;
      user2Id: string;
      user2Balance: number;
    };
    set(state => ({
      levelsByUser: {
        ...state.levelsByUser,
        [result.user1Id]: state.levelsByUser[result.user1Id]
          ? { ...state.levelsByUser[result.user1Id], spendableBalance: result.user1Balance }
          : state.levelsByUser[result.user1Id],
        [result.user2Id]: state.levelsByUser[result.user2Id]
          ? { ...state.levelsByUser[result.user2Id], spendableBalance: result.user2Balance }
          : state.levelsByUser[result.user2Id],
      },
    }));
    await get().hydrate();
    broadcastSync();
  },

  transferPointsWithMessage: async (senderId, receiverId, amount, message) => {
    assertUuid(senderId, 'senderId');
    assertUuid(receiverId, 'receiverId');
    const safeAmount = Math.max(1, Math.round(amount));
    const supabase = createBrowserSupabase();
    const { data, error } = await supabase.rpc('transfer_points_with_message', {
      p_sender_id: senderId,
      p_receiver_id: receiverId,
      p_amount: safeAmount,
      p_message: message,
    });
    if (error) throw new Error(error.message);

    const result = data as {
      senderId: string;
      senderBalance: number;
      receiverId: string;
      receiverBalance: number;
    };
    set(state => ({
      levelsByUser: {
        ...state.levelsByUser,
        [result.senderId]: state.levelsByUser[result.senderId]
          ? { ...state.levelsByUser[result.senderId], spendableBalance: result.senderBalance }
          : state.levelsByUser[result.senderId],
        [result.receiverId]: state.levelsByUser[result.receiverId]
          ? { ...state.levelsByUser[result.receiverId], spendableBalance: result.receiverBalance }
          : state.levelsByUser[result.receiverId],
      },
    }));
    await get().hydrate();
    broadcastSync();
  },

  updateMemberAvatar: (userId, avatarUrl) => {
    set(state => ({
      users: state.users.map(user =>
        user.id === userId ? { ...user, avatarUrl } : user
      ),
    }));
  },

  applyBalance: (userId, newBalance) => {
    set(state => {
      const existing = state.levelsByUser[userId];
      if (!existing) return {};
      return {
        levelsByUser: {
          ...state.levelsByUser,
          [userId]: { ...existing, spendableBalance: Math.max(0, Math.round(newBalance)) },
        },
      };
    });
  },

  dismissCelebration: () => set({ celebration: null }),

  enqueueInsigniaUnlocks: (items) => {
    if (!items.length) return;
    set(state => {
      const seen = new Set(state.insigniaQueue.map(a => `${a.childId}:${a.achievementId}`));
      const additions = items.filter(a => !seen.has(`${a.childId}:${a.achievementId}`));
      if (additions.length === 0) return {};
      return { insigniaQueue: [...state.insigniaQueue, ...additions] };
    });
  },

  dismissInsigniaUnlock: () => set(state => ({ insigniaQueue: state.insigniaQueue.slice(1) })),

  toggleSound: () => {
    const next = !get().soundEnabled;
    localStorage.setItem('sound_enabled', next ? '1' : '0');
    set({ soundEnabled: next });
  },

  reset: () => {
    if (_realtimeChannel) {
      _realtimeChannel.unsubscribe();
      _realtimeChannel = null;
      _realtimeSubscribedFamilyId = null;
    }
    if (_hydrateDebounceTimer) {
      clearTimeout(_hydrateDebounceTimer);
      _hydrateDebounceTimer = null;
    }
    _activityCleanupDone = false;
    set({
      familyId: null,
      familyName: null,
      users: [],
      rewards: [],
      activeTaskCount: 0,
      currentMemberId: null,
      currentMemberCanAdmin: false,
      tasksByUser: {},
      activitiesByUser: {},
      levelsByUser: {},
      todayCompletions: {},
      maxStreakByUser: {},
      longestStreakByUser: {},
      bestDayByUser: {},
      growthByUser: {},
      dailyStreakByUser: {},
      dailyStreakAtRiskByUser: {},
      weeklyRecapByUser: {},
      momentumByUser: {},
      harmony: null,
      celebration: null,
      insigniaQueue: [],
      hydrated: false,
      timeOfDay: getCurrentTimeOfDay(),
      lastHydrateAt: 0,
    });
  },
}));
