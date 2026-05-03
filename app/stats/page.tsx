'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  rank: number;
  level: number;
  totalPoints: number;
  spendableBalance: number;
  maxStreak: number;
  perfectDaysThisWeek: number;
  activeDays30: number;
  monthPct: number;
  bestTask: TaskRate | null;
  focusTask: TaskRate | null;
  taskRates: TaskRate[];
  weekCounts: number[];
  heatmap: HeatDay[];
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
    timeWindow: row.time_window as Task['timeWindow'],
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
  };
}

export default function StatsPage() {
  const router = useRouter();
  const { lang, t } = useLanguage();
  const copy = labels(lang);
  const [allStats, setAllStats] = useState<UserStats[]>([]);
  const [familyName, setFamilyName] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(0);
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
        supabase.from('users').select('*').eq('family_id', familyId).order('display_order', { ascending: true }).order('created_at', { ascending: true }),
        supabase.from('tasks').select('*').eq('family_id', familyId).eq('active', 1),
      ]);

      const userIds = (usersRes.data ?? []).map((r: { id: string }) => r.id);
      const safeIds = userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'];

      // Phase 2: filter levels and completions by verified userIds.
      const [levelsRes, completionsRes] = await Promise.all([
        supabase.from('levels').select('*').in('user_id', safeIds),
        supabase.from('task_completions')
          .select('user_id, task_id, completed_at, points_awarded')
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
        const weekComps = completions.filter(c => {
          const tms = new Date(c.completed_at).getTime();
          return c.user_id === user.id && tms >= weekStart.getTime() && tms < weekEnd.getTime() && activeTaskIds.has(c.task_id);
        });
        const weeklyPoints = weekComps.reduce((sum, c) => sum + (c.points_awarded ?? 0), 0);

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
          rank: 0,
          level: lvl?.current_level ?? 1,
          totalPoints: lvl?.total_points ?? 0,
          spendableBalance: lvl?.spendable_balance ?? 0,
          maxStreak: activeTasks.reduce((max, task) => Math.max(max, task.streakCount), 0),
          perfectDaysThisWeek: thisWeek.perfectDays,
          activeDays30: month.activeDays,
          monthPct: pct(month.done, month.possible),
          bestTask,
          focusTask,
          taskRates,
          weekCounts: thisWeek.weekCounts,
          heatmap: month.heatmap,
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
        {pageCount > 1 && (
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
    </div>
  );
}

function MemberStatsPanel({ stat, lang, copy }: { stat: UserStats; lang: Lang; copy: ReturnType<typeof labels> }) {
  const accent = THEME_ACCENT[stat.user.theme] ?? '#4f9cff';
  const delta = stat.deltaPct;
  const deltaTone = delta === null ? 'text-white/45' : delta >= 0 ? 'text-[#3ddc97]' : 'text-[#ff6b6b]';
  const DOW_LABELS = lang === 'en' ? DOW_LABELS_EN : DOW_LABELS_KO;

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
        </div>

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

        <div className="mt-4 min-h-0 flex-1 overflow-hidden">
          <TaskBars tasks={stat.taskRates.slice(0, 4)} accent={accent} copy={copy} />
        </div>
      </div>
    </section>
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
