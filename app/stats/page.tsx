'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Award,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Flame,
  Medal,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { User, Task, startOfDay, DayOfWeek, DOW_INDEX, legacyRecurrenceToDays } from '@/lib/db';
import { createBrowserSupabase } from '@/lib/supabase';
import { familyHasAdminPin } from '@/lib/adminPin';
import { useLanguage, type Lang } from '@/contexts/LanguageContext';
import { normalizeTimeWindow } from '@/lib/timeWindows';
import { InsigniaWall } from '@/components/InsigniaWall';
import { useFamilyStore } from '@/lib/store';
import {
  composeBonusPercent,
  computeLevelProgress,
  loadoutBonusFromIds,
} from '@/lib/progression';
import { ACHIEVEMENTS } from '@/lib/achievements/definitions';
import { loadAchievementState } from '@/lib/achievements/storage';

const THEME_ACCENT: Record<string, string> = {
  dark_minimal: '#4f9cff',
  warm_minimal: '#d97757',
  robot_neon:   '#00e5ff',
  pastel_cute:  '#ff8fab',
};

const DOW_LABELS_KO = ['월', '화', '수', '목', '금', '토', '일'];
const DOW_LABELS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface TaskRate {
  id: string;
  title: string;
  done: number;
  possible: number;
  pct: number;
}

interface HeatDay {
  date: Date;
  done: number;
  possible: number;
}

interface DayOfWeekStat {
  index: number;     // 0=Mon … 6=Sun
  done: number;
  possible: number;
  pct: number;
}

interface BestWindow {
  startDate: Date;
  pct: number;
  done: number;
  possible: number;
}

interface TimeOfDayBreakdown {
  morning: number;
  afternoon: number;
  evening: number;
}

interface UserStats {
  user: User;
  activeTasks: Task[];
  todayDone: number;
  todayPossible: number;
  weekDone: number;
  weekPossible: number;
  lastWeekPct: number | null;
  weekPct: number;
  deltaPct: number | null;
  weeklyPoints: number;
  weeklyBasePoints: number;        // sum of historical base_points contributions for the week
  rank: number;
  level: number;
  totalPoints: number;
  spendableBalance: number;
  pointsInLevel: number;
  pointsToNext: number;
  progressToNext: number;          // 0..1
  maxStreak: number;
  perfectDaysThisWeek: number;
  activeDays30: number;
  monthPct: number;
  bestTask: TaskRate | null;
  focusTask: TaskRate | null;
  taskRates: TaskRate[];
  weekCounts: number[];
  heatmap: HeatDay[];
  // Pattern insights computed across the last 30 days
  dayOfWeekStats: DayOfWeekStat[];   // 7 entries
  bestDayOfWeek: DayOfWeekStat | null;
  worstDayOfWeek: DayOfWeekStat | null;
  bestWindow: BestWindow | null;     // best rolling 7-day window
  longestRun30: number;              // longest run of consecutive days with ≥1 completion
  // When in the day this member usually completes habits (last 30 days)
  timeOfDay: TimeOfDayBreakdown;
  // Insignia loadout snapshot — computed from localStorage achievement state
  insigniasUnlocked: number;
  loadoutBonusPct: number;
  equippedInsigniaCount: number;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function weekMonday(date: Date): Date {
  const d = startOfDay(date);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return d;
}

function dayKey(date: Date): DayOfWeek {
  return DOW_INDEX[date.getDay()];
}

function isTaskDue(task: Task, date: Date): boolean {
  return task.daysOfWeek.includes(dayKey(date));
}

function pct(done: number, possible: number): number {
  if (possible <= 0) return 0;
  return Math.round((done / possible) * 100);
}

function mapTaskRow(row: Record<string, unknown>): Task {
  const rawDays = row.days_of_week as DayOfWeek[] | null | undefined;
  return {
    id: row.id as string,
    userId: row.user_id as string,
    code: row.code as string | undefined,
    title: row.title as string,
    icon: (row.icon as string | null) ?? 'circle',
    difficulty: row.difficulty as Task['difficulty'],
    basePoints: row.base_points as number,
    recurrence: row.recurrence as string,
    daysOfWeek: rawDays && rawDays.length > 0 ? rawDays : legacyRecurrenceToDays(row.recurrence as string),
    timeWindow: normalizeTimeWindow(row.time_window as string | null | undefined),
    active: row.active as number,
    sortOrder: (row.sort_order as number | null) ?? 0,
    streakCount: (row.streak_count as number | null) ?? 0,
    lastCompletedAt: row.last_completed_at ? new Date(row.last_completed_at as string) : null,
  };
}

function labels(lang: Lang) {
  return {
    pageTitle: lang === 'en' ? 'Family Stats' : '가족 통계',
    pageSub: lang === 'en' ? 'Four members at a glance' : '최대 4명을 한눈에 비교',
    today: lang === 'en' ? 'Today' : '오늘',
    week: lang === 'en' ? 'This week' : '이번주',
    month: lang === 'en' ? '30 days' : '30일',
    points: lang === 'en' ? 'Points' : '포인트',
    streak: lang === 'en' ? 'Best streak' : '최고 연속',
    perfectDays: lang === 'en' ? 'perfect days' : '완벽한 날',
    activeDays: lang === 'en' ? 'active days' : '기록한 날',
    focus: lang === 'en' ? 'Focus next' : '다음 집중',
    best: lang === 'en' ? 'Strong habit' : '잘하는 습관',
    noTasks: lang === 'en' ? 'No active habits yet' : '활성 습관이 아직 없습니다',
    noData: lang === 'en' ? 'No data yet' : '아직 데이터 없음',
    vsLastWeek: lang === 'en' ? 'vs last week' : '지난주 대비',
    rank: lang === 'en' ? 'week rank' : '주간 순위',
    habits: lang === 'en' ? 'habits' : '습관',
    completedThisWeek: (done: number, possible: number) => (
      lang === 'en'
        ? `${done}/${possible} completed this week`
        : `이번 주 ${done}/${possible} 완료`
    ),
    patterns: lang === 'en' ? 'Patterns (30d)' : '패턴 (30일)',
    bestDay: lang === 'en' ? 'Best day' : '최고 요일',
    worstDay: lang === 'en' ? 'Focus day' : '약한 요일',
    bestWindow: lang === 'en' ? 'Best week' : '최고 주',
    longestRun: lang === 'en' ? 'Longest run' : '최장 연속',
    activeBoost: lang === 'en' ? 'Active boost' : '현재 보너스',
    momentum: lang === 'en' ? 'Momentum' : '모멘텀',
    harmony: lang === 'en' ? 'Harmony' : '하모니',
    loadout: lang === 'en' ? 'Loadout' : '인시그니아',
    totalBoost: lang === 'en' ? 'Total' : '합계',
    bonusEarned: lang === 'en' ? 'Bonus earned' : '보너스 획득',
    weekBaseSplit: (base: number, total: number) => (
      lang === 'en'
        ? `${total}pt total · ${base}pt base + ${Math.max(0, total - base)}pt bonus`
        : `합계 ${total}pt · 기본 ${base}pt + 보너스 ${Math.max(0, total - base)}pt`
    ),
    levelProgress: lang === 'en' ? 'Level progress' : '레벨 진행',
    toNext: (need: number) => (lang === 'en' ? `${need} XP to next` : `다음까지 ${need} XP`),
    insignias: lang === 'en' ? 'Insignias' : '인시그니아',
    equipped: (count: number) => (lang === 'en' ? `${count} equipped` : `${count}개 장착`),
    timeOfDay: lang === 'en' ? 'Time of day (30d)' : '시간대 (30일)',
    morning: lang === 'en' ? 'Morning' : '아침',
    afternoon: lang === 'en' ? 'Afternoon' : '오후',
    evening: lang === 'en' ? 'Evening' : '저녁',
    weekOf: (d: Date) => (
      lang === 'en'
        ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d)
        : `${d.getMonth() + 1}/${d.getDate()}`
    ),
  };
}

export default function StatsPage() {
  return (
    <Suspense fallback={<main className="grid min-h-screen place-items-center bg-[#0b0d12] text-[#8a8f99]">…</main>}>
      <StatsPageInner />
    </Suspense>
  );
}

function StatsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang, t } = useLanguage();
  const copy = labels(lang);
  const [allStats, setAllStats] = useState<UserStats[]>([]);
  const [familyName, setFamilyName] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(0);
  // Deep links from the unlock celebration land here with ?view=insignia.
  const initialView = searchParams.get('view') === 'insignia' ? 'insignia' : 'stats';
  const [view, setView] = useState<'stats' | 'insignia'>(initialView);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }

      const { data: familyInfo } = await supabase.rpc('get_my_family_info');
      const familyId = (familyInfo as { id: string; name: string } | null)?.id ?? null;
      if (!familyId) {
        router.replace('/setup');
        return;
      }
      if (!await familyHasAdminPin()) {
        router.replace('/setup/set-pin');
        return;
      }

      setFamilyName((familyInfo as { id: string; name: string }).name ?? null);

      // Bring up the realtime channel for this family even when the user
      // lands here without first visiting the dashboard.
      const { useFamilyStore } = await import('@/lib/store');
      useFamilyStore.getState().hydrate().catch(err => console.warn('[stats hydrate]', err));

      const now = new Date();
      const today = startOfDay(now);
      const weekStart = weekMonday(now);
      const weekEnd = addDays(weekStart, 7);
      const lastWeekStart = addDays(weekStart, -7);
      const monthStart = addDays(today, -29);
      const historyStart = lastWeekStart;

      // Phase 1: fetch users and tasks (need userIds before filtering levels/completions).
      const [usersRes, tasksRes] = await Promise.all([
        supabase.from('users').select('*').eq('family_id', familyId).is('deleted_at', null).order('display_order', { ascending: true }).order('created_at', { ascending: true }),
        supabase.from('tasks').select('*').eq('family_id', familyId).eq('active', 1).is('deleted_at', null),
      ]);

      const userIds = (usersRes.data ?? []).map((r: { id: string }) => r.id);
      const safeIds = userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'];

      // Phase 2: filter levels and completions by verified userIds.
      const [levelsRes, completionsRes] = await Promise.all([
        supabase.from('levels').select('*').in('user_id', safeIds),
        supabase.from('task_completions')
          .select('user_id, task_id, completed_at, points_awarded, partial')
          .in('user_id', safeIds)
          .gte('completed_at', historyStart.toISOString()),
      ]);

      const users: User[] = (usersRes.data ?? []).map(row => ({
        id: row.id,
        name: row.name,
        role: row.role,
        theme: row.theme,
        avatarUrl: row.avatar_url ?? undefined,
        email: row.email ?? undefined,
        pinHash: row.pin_hash ?? undefined,
        authUserId: row.auth_user_id ?? undefined,
        loginMethod: row.login_method ?? undefined,
        displayOrder: row.display_order ?? 0,
        createdAt: new Date(row.created_at),
      }));

      const userIdSet = new Set(userIds);
      const tasks = (tasksRes.data ?? [])
        .map(row => mapTaskRow(row as Record<string, unknown>))
        .filter(task => userIdSet.has(task.userId))
        .sort((a, b) => a.sortOrder - b.sortOrder);

      const completions = (completionsRes.data ?? []).filter(c => userIdSet.has(c.user_id));
      const levels = levelsRes.data ?? [];

      // Per-task base_points lookup so we can reconstruct what each completion
      // *would* have been worth at the live base, and surface bonus deltas.
      const taskBaseById = new Map(tasks.map(task => [task.id, task.basePoints]));

      // Insignia loadout per member — equipped IDs + which are unlocked. Stored
      // in localStorage; pulled here so we can show the current bonus % and
      // the unlocked tally on each member panel.
      const achievementState = loadAchievementState(familyId, users);
      function loadoutFor(userId: string): { unlocked: number; bonusPct: number; equipped: number } {
        const child = achievementState.children[userId];
        if (!child) return { unlocked: 0, bonusPct: 0, equipped: 0 };
        const unlockedIds = new Set(Object.keys(child.unlockedAtByAchievementId));
        const equipped = child.equippedInsigniaIds ?? [];
        return {
          unlocked: unlockedIds.size,
          bonusPct: loadoutBonusFromIds(equipped, unlockedIds),
          equipped: equipped.length,
        };
      }

      function uniqueDoneForDay(userId: string, date: Date, taskIds: Set<string>): number {
        const from = startOfDay(date).getTime();
        const to = addDays(startOfDay(date), 1).getTime();
        return new Set(
          completions
            .filter(c => {
              const tms = new Date(c.completed_at).getTime();
              return c.user_id === userId && tms >= from && tms < to && taskIds.has(c.task_id);
            })
            .map(c => c.task_id),
        ).size;
      }

      function rangeTotals(userId: string, activeTasks: Task[], from: Date, days: number) {
        let done = 0;
        let possible = 0;
        let perfectDays = 0;
        const activeDays = new Set<number>();
        const weekCounts = Array(7).fill(0) as number[];
        const heatmap: HeatDay[] = [];

        for (let i = 0; i < days; i++) {
          const d = addDays(from, i);
          const due = activeTasks.filter(task => isTaskDue(task, d));
          const dueIds = new Set(due.map(task => task.id));
          const dayDone = dueIds.size > 0 ? uniqueDoneForDay(userId, d, dueIds) : 0;
          done += dayDone;
          possible += due.length;
          if (due.length > 0 && dayDone >= due.length) perfectDays++;
          if (dayDone > 0) activeDays.add(startOfDay(d).getTime());
          if (days === 7) {
            const idx = d.getDay() === 0 ? 6 : d.getDay() - 1;
            weekCounts[idx] = dayDone;
          }
          if (days === 30) heatmap.push({ date: d, done: dayDone, possible: due.length });
        }

        return { done, possible, perfectDays, activeDays: activeDays.size, weekCounts, heatmap };
      }

      const prelim = users.map(user => {
        const activeTasks = tasks.filter(task => task.userId === user.id);
        const activeTaskIds = new Set(activeTasks.map(task => task.id));
        const todayPossible = activeTasks.filter(task => isTaskDue(task, today)).length;
        const todayDone = uniqueDoneForDay(user.id, today, new Set(activeTasks.filter(task => isTaskDue(task, today)).map(task => task.id)));
        const thisWeek = rangeTotals(user.id, activeTasks, weekStart, 7);
        const lastWeek = rangeTotals(user.id, activeTasks, lastWeekStart, 7);
        const month = rangeTotals(user.id, activeTasks, monthStart, 30);

        // Per-day breakdown over 30 days, used for day-of-week, best-window, and run-length insights.
        const perDay: { date: Date; dow: number; done: number; possible: number }[] = [];
        for (let i = 0; i < 30; i++) {
          const d = addDays(monthStart, i);
          const due = activeTasks.filter(task => isTaskDue(task, d));
          const dueIds = new Set(due.map(task => task.id));
          const dayDone = dueIds.size > 0 ? uniqueDoneForDay(user.id, d, dueIds) : 0;
          // Mon=0 … Sun=6, matching the existing DOW_LABELS ordering.
          const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
          perDay.push({ date: d, dow, done: dayDone, possible: due.length });
        }

        // Day-of-week aggregation
        const dowAgg: DayOfWeekStat[] = Array.from({ length: 7 }, (_, i) => ({
          index: i, done: 0, possible: 0, pct: 0,
        }));
        for (const day of perDay) {
          dowAgg[day.dow].done += day.done;
          dowAgg[day.dow].possible += day.possible;
        }
        const dayOfWeekStats: DayOfWeekStat[] = dowAgg.map(d => ({
          ...d,
          pct: d.possible > 0 ? Math.round((d.done / d.possible) * 100) : 0,
        }));
        const dowWithData = dayOfWeekStats.filter(d => d.possible > 0);
        const bestDayOfWeek = dowWithData.length > 0
          ? [...dowWithData].sort((a, b) => b.pct - a.pct || b.done - a.done)[0]
          : null;
        const worstDayOfWeek = dowWithData.length > 0
          ? [...dowWithData].sort((a, b) => a.pct - b.pct || b.possible - a.possible)[0]
          : null;

        // Best rolling 7-day window
        let bestWindow: BestWindow | null = null;
        for (let i = 0; i + 7 <= perDay.length; i++) {
          let wd = 0, wp = 0;
          for (let j = 0; j < 7; j++) { wd += perDay[i + j].done; wp += perDay[i + j].possible; }
          if (wp === 0) continue;
          const wpct = Math.round((wd / wp) * 100);
          if (!bestWindow || wpct > bestWindow.pct) {
            bestWindow = { startDate: perDay[i].date, pct: wpct, done: wd, possible: wp };
          }
        }

        // Longest run of consecutive days with ≥1 completion in last 30 days
        let longestRun30 = 0;
        let runCursor = 0;
        for (const day of perDay) {
          if (day.done > 0) {
            runCursor += 1;
            if (runCursor > longestRun30) longestRun30 = runCursor;
          } else {
            runCursor = 0;
          }
        }
        const weekComps = completions.filter(c => {
          const tms = new Date(c.completed_at).getTime();
          return c.user_id === user.id && tms >= weekStart.getTime() && tms < weekEnd.getTime() && activeTaskIds.has(c.task_id);
        });
        const weeklyPoints = weekComps.reduce((sum, c) => sum + (c.points_awarded ?? 0), 0);
        // Reconstruct what each completion would have been worth at the live
        // base — partial completions count for half. The delta versus
        // weeklyPoints is the bonus actually applied this week, which is the
        // most concrete "is the bonus working?" signal we can show.
        const weeklyBasePoints = weekComps.reduce((sum, c) => {
          const base = taskBaseById.get(c.task_id) ?? 0;
          const partial = (c as { partial?: boolean }).partial === true;
          return sum + (partial ? Math.ceil(base * 0.5) : base);
        }, 0);

        // Time-of-day distribution — 30-day completions for this user, bucketed
        // by hour. Mornings 5-12, afternoons 12-17, evenings everything else.
        const timeOfDay: TimeOfDayBreakdown = { morning: 0, afternoon: 0, evening: 0 };
        for (const c of completions) {
          if (c.user_id !== user.id) continue;
          const t = new Date(c.completed_at);
          if (t.getTime() < monthStart.getTime()) continue;
          const hour = t.getHours();
          if (hour >= 5 && hour < 12) timeOfDay.morning += 1;
          else if (hour >= 12 && hour < 17) timeOfDay.afternoon += 1;
          else timeOfDay.evening += 1;
        }

        const taskRates: TaskRate[] = activeTasks.map(task => {
          let possible = 0;
          const doneDays = new Set<number>();
          for (let i = 0; i < 30; i++) {
            const d = addDays(monthStart, i);
            if (!isTaskDue(task, d)) continue;
            possible++;
          }
          for (const c of completions) {
            if (c.user_id !== user.id || c.task_id !== task.id) continue;
            const tms = new Date(c.completed_at).getTime();
            if (tms >= monthStart.getTime()) doneDays.add(startOfDay(new Date(c.completed_at)).getTime());
          }
          const done = doneDays.size;
          return { id: task.id, title: task.title, done, possible, pct: pct(done, possible) };
        }).sort((a, b) => a.pct - b.pct);

        const lvl = levels.find(level => level.user_id === user.id);
        const weekPct = pct(thisWeek.done, thisWeek.possible);
        const lastWeekPct = lastWeek.possible > 0 ? pct(lastWeek.done, lastWeek.possible) : null;
        const bestTask = [...taskRates].sort((a, b) => b.pct - a.pct)[0] ?? null;
        const focusTask = taskRates.find(task => task.possible > 0) ?? null;

        const totalPoints = lvl?.total_points ?? 0;
        const levelProgress = computeLevelProgress(totalPoints);
        const insignia = loadoutFor(user.id);

        return {
          user,
          activeTasks,
          todayDone,
          todayPossible,
          weekDone: thisWeek.done,
          weekPossible: thisWeek.possible,
          weekPct,
          lastWeekPct,
          deltaPct: lastWeekPct === null ? null : weekPct - lastWeekPct,
          weeklyPoints,
          weeklyBasePoints,
          rank: 0,
          level: levelProgress.level,
          totalPoints,
          spendableBalance: lvl?.spendable_balance ?? 0,
          pointsInLevel: levelProgress.pointsInLevel,
          pointsToNext: levelProgress.pointsToNext,
          progressToNext: levelProgress.progressToNext,
          maxStreak: activeTasks.reduce((max, task) => Math.max(max, task.streakCount), 0),
          perfectDaysThisWeek: thisWeek.perfectDays,
          activeDays30: month.activeDays,
          monthPct: pct(month.done, month.possible),
          bestTask,
          focusTask,
          taskRates,
          weekCounts: thisWeek.weekCounts,
          heatmap: month.heatmap,
          dayOfWeekStats,
          bestDayOfWeek,
          worstDayOfWeek,
          bestWindow,
          longestRun30,
          timeOfDay,
          insigniasUnlocked: insignia.unlocked,
          loadoutBonusPct: insignia.bonusPct,
          equippedInsigniaCount: insignia.equipped,
        };
      });

      const ranked = [...prelim].sort((a, b) => b.weeklyPoints - a.weeklyPoints || b.weekPct - a.weekPct);
      const rankMap = new Map(ranked.map((stat, index) => [stat.user.id, index + 1]));
      setAllStats(prelim.map(stat => ({ ...stat, rank: rankMap.get(stat.user.id) ?? 0 })));
      setLoading(false);
    }

    load().catch(error => {
      console.error(error);
      setLoading(false);
    });
  }, [router]);

  const pageCount = Math.max(1, Math.ceil(allStats.length / 4));
  const clampedActivePage = Math.min(activePage, pageCount - 1);
  const visibleStats = useMemo(() => {
    return allStats.slice(clampedActivePage * 4, clampedActivePage * 4 + 4);
  }, [clampedActivePage, allStats]);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0b0d12] text-[#8a8f99]">
        {t('loading')}
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0b0d12] text-white md:fixed md:inset-0 md:h-screen md:overflow-hidden">
      <header
        className="sticky top-0 z-20 flex shrink-0 items-center gap-2 border-b border-white/10 bg-[#0b0d12]/95 px-3 backdrop-blur"
        style={{ height: 52, paddingTop: 'env(safe-area-inset-top)' }}
      >
        <Link
          href="/"
          aria-label={t('back_to_dashboard')}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft size={17} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white/90">
            {copy.pageTitle}{familyName ? ` · ${familyName}` : ''}
          </div>
          <div className="truncate text-xs text-white/45">{copy.pageSub}</div>
        </div>
        <div className="flex shrink-0 rounded-lg border border-white/10 bg-white/[0.04] p-1">
          <button
            type="button"
            onClick={() => setView('stats')}
            className={`rounded-md px-3 py-1.5 text-xs font-black transition ${view === 'stats' ? 'bg-white text-slate-950' : 'text-white/58 hover:text-white'}`}
          >
            Stats
          </button>
          <button
            type="button"
            onClick={() => setView('insignia')}
            className={`rounded-md px-3 py-1.5 text-xs font-black transition ${view === 'insignia' ? 'bg-[#FFD166] text-slate-950' : 'text-white/58 hover:text-white'}`}
          >
            Insignia Wall
          </button>
        </div>
        {view === 'stats' && pageCount > 1 && (
          <div className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-1 py-1 md:flex">
            <button
              type="button"
              onClick={() => setActivePage(page => Math.max(0, page - 1))}
              disabled={clampedActivePage === 0}
              aria-label="Previous stats page"
              className="grid h-7 w-7 place-items-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-25"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-1 px-1">
              {Array.from({ length: pageCount }, (_, page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setActivePage(page)}
                  aria-label={`Stats page ${page + 1}`}
                  className={[
                    'h-1.5 rounded-full transition-all',
                    page === clampedActivePage ? 'w-4 bg-white/70' : 'w-1.5 bg-white/25 hover:bg-white/45',
                  ].join(' ')}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setActivePage(page => Math.min(pageCount - 1, page + 1))}
              disabled={clampedActivePage === pageCount - 1}
              aria-label="Next stats page"
              className="grid h-7 w-7 place-items-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-25"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </header>

      {view === 'insignia' ? (
        <main className="flex-1 overflow-auto bg-[#0b0d12]">
          <InsigniaWall />
        </main>
      ) : (
        <>
          <main className="grid flex-1 grid-cols-1 gap-0.5 overflow-auto bg-black md:hidden">
            {allStats.map(stat => <MemberStatsPanel key={stat.user.id} stat={stat} lang={lang} copy={copy} />)}
          </main>

          <main className="hidden flex-1 grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden bg-black md:grid">
            {Array.from({ length: 4 }, (_, index) => visibleStats[index] ?? null).map((stat, index) =>
              stat ? (
                <MemberStatsPanel key={stat.user.id} stat={stat} lang={lang} copy={copy} />
              ) : (
                <div key={`empty-${clampedActivePage}-${index}`} className="min-h-0 bg-[#171717]" />
              ),
            )}
          </main>
        </>
      )}
    </div>
  );
}

function MemberStatsPanel({ stat, lang, copy }: { stat: UserStats; lang: Lang; copy: ReturnType<typeof labels> }) {
  const accent = THEME_ACCENT[stat.user.theme] ?? '#4f9cff';
  const delta = stat.deltaPct;
  const deltaTone = delta === null ? 'text-white/45' : delta >= 0 ? 'text-[#3ddc97]' : 'text-[#ff6b6b]';
  const DOW_LABELS = lang === 'en' ? DOW_LABELS_EN : DOW_LABELS_KO;

  // Live bonus state — momentum is per-user, harmony is family-wide. The
  // store hydrate kicked off in StatsPageInner; until it lands these are
  // 0 and the card still reads correctly (just shows "no boost yet").
  const momentum = useFamilyStore(s => s.momentumByUser[stat.user.id]);
  const harmony = useFamilyStore(s => s.harmony);
  const momentumPct = momentum?.bonusPercent ?? 0;
  const harmonyPct = harmony?.bonusPercent ?? 0;
  const totalBoostPct = composeBonusPercent({
    momentumPercent: momentumPct,
    harmonyPercent: harmonyPct,
    loadoutPercent: stat.loadoutBonusPct,
  }).totalPercent;

  const weeklyBonus = Math.max(0, stat.weeklyPoints - stat.weeklyBasePoints);
  const totalAchievements = ACHIEVEMENTS.length;

  return (
    <section className="min-h-[680px] overflow-hidden bg-[#111318] p-4 md:min-h-0 md:p-5">
      <div className="flex h-full min-h-0 flex-col rounded-none md:overflow-hidden">
        <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-2xl font-bold tracking-normal text-white">{stat.user.name}</h2>
              {stat.rank === 1 && (
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#f8d24a]/15 text-[#f8d24a]">
                  <Medal size={16} />
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/45">
              <span>Lv.{stat.level}</span>
              <span>•</span>
              <span>{copy.rank} #{stat.rank}</span>
              <span>•</span>
              <span>{stat.activeTasks.length} {copy.habits}</span>
            </div>
          </div>
          <div className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-right">
            <div className="text-xs text-white/45">{copy.points}</div>
            <div className="text-lg font-bold" style={{ color: accent }}>{stat.weeklyPoints}pt</div>
            {weeklyBonus > 0 && (
              <div className="text-[10px] font-semibold text-[#3ddc97]">+{weeklyBonus}pt {copy.bonusEarned}</div>
            )}
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-[112px_1fr] gap-4">
          <ProgressDial value={pct(stat.todayDone, stat.todayPossible)} done={stat.todayDone} total={stat.todayPossible} accent={accent} label={copy.today} />
          <div className="grid grid-cols-2 gap-2">
            <MiniMetric icon={<BarChart3 size={15} />} label={copy.week} value={`${stat.weekPct}%`} accent={accent} />
            <MiniMetric icon={<Flame size={15} />} label={copy.streak} value={stat.maxStreak > 0 ? `${stat.maxStreak}d` : '—'} accent={accent} />
            <MiniMetric icon={<Award size={15} />} label={copy.perfectDays} value={`${stat.perfectDaysThisWeek}/7`} accent={accent} />
            <MiniMetric icon={<Sparkles size={15} />} label={copy.activeDays} value={`${stat.activeDays30}/30`} accent={accent} />
          </div>
        </div>

        <div className="mt-4 shrink-0 rounded-lg border border-white/10 bg-white/[0.035] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-white/45">{copy.vsLastWeek}</div>
            <div className={`flex items-center gap-1 text-sm font-bold ${deltaTone}`}>
              {delta === null ? (
                copy.noData
              ) : delta >= 0 ? (
                <>
                  <TrendingUp size={15} /> +{delta}%
                </>
              ) : (
                <>
                  <TrendingDown size={15} /> {delta}%
                </>
              )}
            </div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, stat.weekPct)}%`, background: accent }} />
          </div>
          <div className="mt-2 text-xs text-white/45">
            {copy.completedThisWeek(stat.weekDone, stat.weekPossible || 0)}
          </div>
          {stat.weeklyPoints > 0 && (
            <div className="mt-1 text-[11px] text-white/55">
              {copy.weekBaseSplit(stat.weeklyBasePoints, stat.weeklyPoints)}
            </div>
          )}
        </div>

        <ActiveBoostCard
          accent={accent}
          loadoutPct={stat.loadoutBonusPct}
          momentumPct={momentumPct}
          momentumState={momentum?.meta.label ?? '—'}
          harmonyPct={harmonyPct}
          harmonyState={harmony?.meta.label ?? '—'}
          totalPct={totalBoostPct}
          insigniasUnlocked={stat.insigniasUnlocked}
          insigniasTotal={totalAchievements}
          equipped={stat.equippedInsigniaCount}
          copy={copy}
        />

        <LevelProgressCard
          accent={accent}
          level={stat.level}
          pointsInLevel={stat.pointsInLevel}
          pointsToNext={stat.pointsToNext}
          progress={stat.progressToNext}
          totalPoints={stat.totalPoints}
          spendable={stat.spendableBalance}
          copy={copy}
        />

        <div className="mt-4 shrink-0">
          <div className="mb-2 flex items-center justify-between text-xs text-white/45">
            <span>{copy.week}</span>
            <span>{copy.month} {stat.monthPct}%</span>
          </div>
          <WeekStrip counts={stat.weekCounts} labels={DOW_LABELS} accent={accent} />
        </div>

        <div className="mt-4 shrink-0">
          <HeatGrid days={stat.heatmap} accent={accent} />
        </div>

        <div className="mt-4 grid shrink-0 grid-cols-1 gap-2 xl:grid-cols-2">
          <HabitCallout icon={<Target size={15} />} label={copy.focus} task={stat.focusTask} empty={copy.noTasks} tone="focus" />
          <HabitCallout icon={<Award size={15} />} label={copy.best} task={stat.bestTask} empty={copy.noData} tone="best" />
        </div>

        <div className="mt-4 shrink-0 rounded-lg border border-white/10 bg-white/[0.035] p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white/45">
            <Sparkles size={14} style={{ color: accent }} />
            <span>{copy.patterns}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <PatternMetric
              label={copy.bestDay}
              value={stat.bestDayOfWeek
                ? `${DOW_LABELS[stat.bestDayOfWeek.index]} · ${stat.bestDayOfWeek.pct}%`
                : '—'}
              tone="good"
            />
            <PatternMetric
              label={copy.worstDay}
              value={stat.worstDayOfWeek && stat.worstDayOfWeek !== stat.bestDayOfWeek
                ? `${DOW_LABELS[stat.worstDayOfWeek.index]} · ${stat.worstDayOfWeek.pct}%`
                : '—'}
              tone="bad"
            />
            <PatternMetric
              label={copy.bestWindow}
              value={stat.bestWindow
                ? `${copy.weekOf(stat.bestWindow.startDate)} · ${stat.bestWindow.pct}%`
                : '—'}
              tone="good"
            />
            <PatternMetric
              label={copy.longestRun}
              value={stat.longestRun30 > 0 ? `${stat.longestRun30}d` : '—'}
              tone="neutral"
            />
          </div>
          <TimeOfDayBars timeOfDay={stat.timeOfDay} accent={accent} copy={copy} />
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-hidden">
          <TaskBars tasks={stat.taskRates.slice(0, 4)} accent={accent} copy={copy} />
        </div>
      </div>
    </section>
  );
}

function ActiveBoostCard({
  accent,
  loadoutPct,
  momentumPct,
  momentumState,
  harmonyPct,
  harmonyState,
  totalPct,
  insigniasUnlocked,
  insigniasTotal,
  equipped,
  copy,
}: {
  accent: string;
  loadoutPct: number;
  momentumPct: number;
  momentumState: string;
  harmonyPct: number;
  harmonyState: string;
  totalPct: number;
  insigniasUnlocked: number;
  insigniasTotal: number;
  equipped: number;
  copy: ReturnType<typeof labels>;
}) {
  return (
    <div className="mt-4 shrink-0 rounded-lg border border-white/10 bg-white/[0.035] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white/45">
          <Sparkles size={14} style={{ color: accent }} />
          <span>{copy.activeBoost}</span>
        </div>
        <div className="text-base font-bold text-[#3ddc97]">+{totalPct}%</div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <BoostCell label={copy.loadout} pct={loadoutPct} sub={`${equipped}/3 ${copy.equipped(equipped).split(' ')[0]}`} />
        <BoostCell label={copy.momentum} pct={momentumPct} sub={momentumState} />
        <BoostCell label={copy.harmony} pct={harmonyPct} sub={harmonyState} />
      </div>
      <div className="mt-2 text-[11px] text-white/45">
        {copy.insignias}: {insigniasUnlocked}/{insigniasTotal}
      </div>
    </div>
  );
}

function BoostCell({ label, pct, sub }: { label: string; pct: number; sub: string }) {
  const active = pct > 0;
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.04] p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-white/45">{label}</div>
      <div className={`text-sm font-bold ${active ? 'text-[#3ddc97]' : 'text-white/55'}`}>
        +{Math.round(pct * 10) / 10}%
      </div>
      <div className="truncate text-[10px] text-white/45">{sub}</div>
    </div>
  );
}

function LevelProgressCard({
  accent,
  level,
  pointsInLevel,
  pointsToNext,
  progress,
  totalPoints,
  spendable,
  copy,
}: {
  accent: string;
  level: number;
  pointsInLevel: number;
  pointsToNext: number;
  progress: number;
  totalPoints: number;
  spendable: number;
  copy: ReturnType<typeof labels>;
}) {
  const need = Math.max(0, pointsToNext - pointsInLevel);
  return (
    <div className="mt-4 shrink-0 rounded-lg border border-white/10 bg-white/[0.035] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-white/45">{copy.levelProgress}</div>
        <div className="text-sm font-bold text-white">Lv.{level} → Lv.{level + 1}</div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.round(progress * 100)}%`, background: accent }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-white/55">
        <span>{copy.toNext(need)}</span>
        <span>{totalPoints} XP · {spendable} {copy.points.toLowerCase()}</span>
      </div>
    </div>
  );
}

function TimeOfDayBars({
  timeOfDay,
  accent,
  copy,
}: {
  timeOfDay: TimeOfDayBreakdown;
  accent: string;
  copy: ReturnType<typeof labels>;
}) {
  const total = timeOfDay.morning + timeOfDay.afternoon + timeOfDay.evening;
  if (total === 0) return null;
  const max = Math.max(timeOfDay.morning, timeOfDay.afternoon, timeOfDay.evening);
  const cells: Array<[string, number]> = [
    [copy.morning, timeOfDay.morning],
    [copy.afternoon, timeOfDay.afternoon],
    [copy.evening, timeOfDay.evening],
  ];
  return (
    <div className="mt-3">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/45">{copy.timeOfDay}</div>
      <div className="grid grid-cols-3 gap-1.5">
        {cells.map(([label, count]) => (
          <div key={label} className="min-w-0">
            <div className="mb-1 flex h-8 items-end rounded-md bg-white/[0.06] px-1">
              <div
                className="w-full rounded-sm transition-all"
                style={{
                  height: `${count > 0 ? Math.max(15, (count / max) * 100) : 0}%`,
                  background: accent,
                  opacity: count > 0 ? 0.85 : 0,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-white/45">{label}</span>
              <span className="font-semibold text-white/70">{count}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressDial({ value, done, total, accent, label }: { value: number; done: number; total: number; accent: string; label: string }) {
  return (
    <div className="flex aspect-square items-center justify-center rounded-xl border border-white/10 bg-white/[0.035]">
      <div
        className="grid h-[92px] w-[92px] place-items-center rounded-full"
        style={{ background: `conic-gradient(${accent} ${value * 3.6}deg, rgba(255,255,255,0.09) 0deg)` }}
      >
        <div className="grid h-[72px] w-[72px] place-items-center rounded-full bg-[#111318] text-center">
          <div>
            <div className="text-xl font-bold" style={{ color: accent }}>{total > 0 ? `${value}%` : '—'}</div>
            <div className="text-[11px] text-white/45">{done}/{total} {label}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PatternMetric({ label, value, tone }: { label: string; value: string; tone: 'good' | 'bad' | 'neutral' }) {
  const valueColor =
    tone === 'good' ? 'text-[#3ddc97]' :
    tone === 'bad'  ? 'text-[#ffb1bb]' :
    'text-white';
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
      <div className="mb-1 truncate text-[10px] font-semibold uppercase tracking-wider text-white/45">{label}</div>
      <div className={`truncate text-sm font-bold ${valueColor}`}>{value}</div>
    </div>
  );
}

function MiniMetric({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.035] p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs text-white/45">
        <span style={{ color: accent }}>{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="truncate text-lg font-bold text-white">{value}</div>
    </div>
  );
}

function WeekStrip({ counts, labels, accent }: { counts: number[]; labels: string[]; accent: string }) {
  const max = Math.max(1, ...counts);
  const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {counts.map((count, index) => (
        <div key={labels[index]} className="min-w-0">
          <div className="mb-1 flex h-14 items-end rounded-md bg-white/[0.06] px-1">
            <div
              className="w-full rounded-sm"
              style={{
                height: `${Math.max(count > 0 ? 12 : 0, (count / max) * 100)}%`,
                background: index === todayIdx ? '#3ddc97' : accent,
                opacity: count > 0 ? 1 : 0,
              }}
            />
          </div>
          <div className={`text-center text-[11px] ${index === todayIdx ? 'font-bold text-white' : 'text-white/40'}`}>{labels[index]}</div>
        </div>
      ))}
    </div>
  );
}

function HeatGrid({ days, accent }: { days: HeatDay[]; accent: string }) {
  return (
    <div className="grid grid-cols-10 gap-1">
      {days.map(day => {
        const value = pct(day.done, day.possible);
        const opacity = value === 0 ? 0.12 : value < 34 ? 0.35 : value < 67 ? 0.62 : 1;
        return (
          <div
            key={day.date.toISOString()}
            title={`${day.date.getMonth() + 1}/${day.date.getDate()} · ${value}%`}
            className="aspect-square rounded-[4px] bg-white/10"
            style={value > 0 ? { background: accent, opacity } : undefined}
          />
        );
      })}
    </div>
  );
}

function HabitCallout({
  icon,
  label,
  task,
  empty,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  task: TaskRate | null;
  empty: string;
  tone: 'focus' | 'best';
}) {
  const color = tone === 'focus' ? '#f59e0b' : '#3ddc97';
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.035] p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em]" style={{ color }}>
        {icon}
        <span>{label}</span>
      </div>
      {task ? (
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{task.title}</div>
          <div className="text-xs text-white/45">{task.done}/{task.possible} · {task.pct}%</div>
        </div>
      ) : (
        <div className="text-sm text-white/45">{empty}</div>
      )}
    </div>
  );
}

function TaskBars({ tasks, accent, copy }: { tasks: TaskRate[]; accent: string; copy: ReturnType<typeof labels> }) {
  if (tasks.length === 0) {
    return <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4 text-sm text-white/45">{copy.noTasks}</div>;
  }
  return (
    <div className="space-y-2">
      {tasks.map(task => (
        <div key={task.id}>
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="truncate text-xs text-white/70">{task.title}</div>
            <div className="shrink-0 text-xs font-semibold text-white/45">{task.pct}%</div>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full" style={{ width: `${task.pct}%`, background: accent }} />
          </div>
        </div>
      ))}
    </div>
  );
}
