'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { User, Task, startOfDay, DayOfWeek, DOW_INDEX, legacyRecurrenceToDays } from '@/lib/db';
import { createBrowserSupabase } from '@/lib/supabase';
import { useLanguage, type Lang } from '@/contexts/LanguageContext';

const DOW_LABELS_KO = ['월', '화', '수', '목', '금', '토', '일'];
const DOW_LABELS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const THEME_ACCENT: Record<string, string> = {
  dark_minimal: '#4f9cff',
  warm_minimal: '#d97757',
  robot_neon:   '#00e5ff',
  pastel_cute:  '#ff8fab',
};

// Fixed dark palette — never changes per theme
const BG_PAGE = '#0f0f0f';
const BG_CARD = '#242424';
const BD_CARD    = '#333333';
const FG_MAIN    = '#ffffff';
const FG_SUB     = '#aaaaaa';
const BAR_EMPTY  = '#333333';

interface TaskStat { title: string; done: number; possible: number }
interface HeatDay  { date: Date; done: number; total: number }

interface UserStats {
  user: User;
  tasks: Task[];
  todayDone: number;
  maxStreak: number;
  totalPoints: number;
  currentLevel: number;
  weekCounts: number[];
  weeklyPoints: number;
  taskStats: TaskStat[];
  heatmap: HeatDay[];
  thisWeekAvgPct: number | null;
  lastWeekAvgPct: number | null;
}

function weekMonday(date: Date): Date {
  const d = new Date(date);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

export default function StatsPage() {
  const { lang, t } = useLanguage();
  const [allStats, setAllStats] = useState<UserStats[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabase();
      const now = new Date();
      const dayStart   = startOfDay(now);
      const weekStart  = weekMonday(now);
      const weekEnd    = addDays(weekStart, 7);
      const lastWeekStart = addDays(weekStart, -7);
      const monthStart = addDays(dayStart, -29);

      // Fetch everything in one round-trip
      const [
        usersRes, tasksRes, streaksRes, levelsRes,
        todayCompsRes, weekCompsRes, lastWeekCompsRes, monthCompsRes,
      ] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('tasks').select('*').eq('active', 1),
        supabase.from('streaks').select('*'),
        supabase.from('levels').select('*'),
        supabase.from('task_completions')
          .select('user_id, task_id')
          .gte('completed_at', dayStart.toISOString()),
        supabase.from('task_completions')
          .select('user_id, task_id, completed_at, points_awarded')
          .gte('completed_at', weekStart.toISOString())
          .lt('completed_at', weekEnd.toISOString()),
        supabase.from('task_completions')
          .select('user_id, task_id, completed_at')
          .gte('completed_at', lastWeekStart.toISOString())
          .lt('completed_at', weekStart.toISOString()),
        supabase.from('task_completions')
          .select('user_id, task_id, completed_at')
          .gte('completed_at', monthStart.toISOString()),
      ]);

      function avgDailyPct(
        comps: { task_id: string; completed_at: string }[],
        from: Date,
        days: number,
        total: number,
      ): number {
        if (total === 0) return 0;
        let sum = 0;
        for (let i = 0; i < days; i++) {
          const d    = startOfDay(addDays(from, i));
          const dEnd = addDays(d, 1);
          const unique = new Set(
            comps
              .filter(c => {
                const tms = new Date(c.completed_at).getTime();
                return tms >= d.getTime() && tms < dEnd.getTime();
              })
              .map(c => c.task_id)
          ).size;
          sum += unique / total;
        }
        return Math.round((sum / days) * 100);
      }

      const ordered: User[] = [...(usersRes.data ?? [])]
        .sort((a, b) => ((a.display_order ?? 0) - (b.display_order ?? 0)) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map(r => ({
          id: r.id, name: r.name, role: r.role, theme: r.theme,
          avatarUrl: r.avatar_url ?? undefined,
          pinHash:   r.pin_hash   ?? undefined,
          authUserId: r.auth_user_id ?? undefined,
          loginMethod: r.login_method ?? undefined,
          displayOrder: r.display_order ?? 0,
          createdAt: new Date(r.created_at),
        }));

      const result: UserStats[] = [];

      for (const user of ordered) {
        const activeTasks: Task[] = (tasksRes.data ?? [])
          .filter(r => r.user_id === user.id)
          .map(r => {
            const rawDays = r.days_of_week as DayOfWeek[] | null | undefined;
            return {
              id: r.id, userId: r.user_id, code: r.code ?? undefined,
              title: r.title, icon: r.icon, difficulty: r.difficulty,
              basePoints: r.base_points, recurrence: r.recurrence,
              daysOfWeek: (rawDays && rawDays.length > 0) ? rawDays : legacyRecurrenceToDays(r.recurrence),
              timeWindow: r.time_window ?? undefined,
              active: r.active, sortOrder: r.sort_order,
              streakCount: r.streak_count ?? 0,
              lastCompletedAt: r.last_completed_at ? new Date(r.last_completed_at) : null,
            };
          })
          .sort((a, b) => a.sortOrder - b.sortOrder);

        const todayDone = new Set(
          (todayCompsRes.data ?? [])
            .filter(c => c.user_id === user.id)
            .map(c => c.task_id)
        ).size;

        const userStreaks = (streaksRes.data ?? []).filter(s => s.user_id === user.id);
        const maxStreak   = userStreaks.reduce((m, s) => Math.max(m, s.current), 0);

        const lvl = (levelsRes.data ?? []).find(l => l.user_id === user.id);

        const userWeekComps     = (weekCompsRes.data     ?? []).filter(c => c.user_id === user.id);
        const userLastWeekComps = (lastWeekCompsRes.data ?? []).filter(c => c.user_id === user.id);
        const userMonthComps    = (monthCompsRes.data    ?? []).filter(c => c.user_id === user.id);

        const weekCounts = Array(7).fill(0);
        let weeklyPoints = 0;
        for (const c of userWeekComps) {
          const dow = new Date(c.completed_at).getDay();
          weekCounts[dow === 0 ? 6 : dow - 1]++;
          weeklyPoints += c.points_awarded ?? 0;
        }

        const taskStats: TaskStat[] = activeTasks.map(task => {
          let possible = 0;
          for (let i = 0; i < 30; i++) {
            const d      = addDays(monthStart, i);
            const dayKey = DOW_INDEX[d.getDay()];
            if (!task.daysOfWeek.includes(dayKey)) continue;
            possible++;
          }
          const done = new Set(
            userMonthComps
              .filter(c => c.task_id === task.id)
              .map(c => startOfDay(new Date(c.completed_at)).getTime())
          ).size;
          return { title: task.title, done, possible: Math.max(possible, 1) };
        });
        taskStats.sort((a, b) => a.done / a.possible - b.done / b.possible);

        const heatmap: HeatDay[] = Array.from({ length: 30 }, (_, i) => {
          const d    = addDays(monthStart, i);
          const dEnd = addDays(d, 1);
          const dc   = userMonthComps.filter(c => {
            const tms = new Date(c.completed_at).getTime();
            return tms >= d.getTime() && tms < dEnd.getTime();
          });
          return { date: d, done: new Set(dc.map(c => c.task_id)).size, total: activeTasks.length };
        });

        const total        = activeTasks.length;
        const daysThisWeek = (now.getDay() === 0 ? 6 : now.getDay() - 1) + 1;

        const thisWeekAvgPct = total > 0
          ? avgDailyPct(userWeekComps, weekStart, daysThisWeek, total)
          : null;
        const lastWeekAvgPct = total > 0 && userLastWeekComps.length > 0
          ? avgDailyPct(userLastWeekComps, lastWeekStart, 7, total)
          : null;

        result.push({
          user, tasks: activeTasks, todayDone, maxStreak,
          totalPoints:  lvl?.total_points  ?? 0,
          currentLevel: lvl?.current_level ?? 1,
          weekCounts, weeklyPoints, taskStats, heatmap,
          thisWeekAvgPct, lastWeekAvgPct,
        });
      }

      setAllStats(result);
      setLoading(false);
    }
    load();
  }, []);

  const s      = allStats[idx];
  const accent = s ? (THEME_ACCENT[s.user.theme] ?? '#4f9cff') : '#4f9cff';

  return (
    <div style={{ minHeight: '100vh', background: BG_PAGE, color: FG_MAIN }}>
      {/* Sticky header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: `rgba(15,15,15,0.96)`, backdropFilter: 'blur(8px)',
        borderBottom: `1px solid ${BD_CARD}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px 6px' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 6, color: FG_SUB, textDecoration: 'none' }}>
            <ArrowLeft size={16} />
            <span style={{ fontSize: 13 }}>{t('back_to_dashboard')}</span>
          </Link>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex' }}>
          {allStats.map((st, i) => {
            const a      = THEME_ACCENT[st.user.theme] ?? '#4f9cff';
            const active = i === idx;
            return (
              <button key={st.user.id} onClick={() => setIdx(i)} style={{
                flex: 1, padding: '10px 4px 8px', fontSize: 14,
                fontWeight: active ? 700 : 400,
                color: active ? a : FG_SUB,
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: `2px solid ${active ? a : 'transparent'}`,
                transition: 'all 0.15s',
              }}>
                {st.user.name}
              </button>
            );
          })}
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: FG_SUB }}>
          {t('loading')}
        </div>
      )}

      {!loading && s && (
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px 80px' }}>

          {/* A — Today's Summary */}
          <SectionLabel accent={accent}>{t('today_summary')}</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 28 }}>
            <StatCard
              label={t('today_completion_rate')}
              value={s.tasks.length > 0 ? `${Math.round(s.todayDone / s.tasks.length * 100)}%` : '—'}
              sub={`${s.todayDone}/${s.tasks.length}`}
              accent={accent}
            />
            <StatCard
              label={t('highest_streak')}
              value={s.maxStreak > 0 ? `🔥${s.maxStreak}` : '—'}
              sub={s.maxStreak > 0 ? (lang === 'en' ? 'd' : '일') : undefined}
              accent={accent}
            />
            <StatCard
              label={`Lv.${s.currentLevel}`}
              value={s.totalPoints.toLocaleString()}
              sub="pt"
              accent={accent}
            />
          </div>

          {/* A-2 — This Week vs Last Week */}
          <SectionLabel accent={accent}>{t('week_vs_last')}</SectionLabel>
          <WeekComparison thisWeek={s.thisWeekAvgPct} lastWeek={s.lastWeekAvgPct} accent={accent} />

          {/* B — This Week */}
          <SectionLabel accent={accent}>{t('weekly_completions')}</SectionLabel>
          <WeekChart weekCounts={s.weekCounts} accent={accent} lang={lang} />

          {/* C — Monthly task completion */}
          <SectionLabel accent={accent}>{t('monthly_task_completion')}</SectionLabel>
          <TaskRates taskStats={s.taskStats} accent={accent} />

          {/* D — Heatmap */}
          <SectionLabel accent={accent}>{t('heatmap_30')}</SectionLabel>
          <Heatmap heatmap={s.heatmap} accent={accent} />

          {/* E — Family Ranking */}
          <SectionLabel accent={accent}>{t('family_ranking')}</SectionLabel>
          <Ranking allStats={allStats} />
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────── */

function SectionLabel({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <div style={{ fontSize: 18, fontWeight: 600, color: accent, marginBottom: 12 }}>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div style={{
      background: BG_CARD,
      border: `1px solid ${BD_CARD}`,
      borderRadius: 16,
      padding: '16px 14px',
    }}>
      <div style={{ fontSize: 14, color: FG_SUB, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 700, color: accent, lineHeight: 1 }}>
        {value}
        {sub && <span style={{ fontSize: 13, fontWeight: 400, color: FG_SUB, marginLeft: 4 }}>{sub}</span>}
      </div>
    </div>
  );
}

function WeekComparison({
  thisWeek, lastWeek, accent,
}: { thisWeek: number | null; lastWeek: number | null; accent: string }) {
  const { t } = useLanguage();
  if (thisWeek === null || lastWeek === null) {
    return <div style={{ fontSize: 14, color: FG_SUB, marginBottom: 28 }}>{t('no_comparison_data')}</div>;
  }
  const diff      = thisWeek - lastWeek;
  const diffColor = diff > 0 ? '#3ddc97' : diff < 0 ? '#ff6b6b' : FG_SUB;
  const diffLabel = diff > 0
    ? `↑ +${diff}% ${t('improvement')}`
    : diff < 0
    ? `↓ ${Math.abs(diff)}% ${t('try_harder')}`
    : `→ ${t('steady')}`;
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div style={{ background: BG_CARD, border: `1px solid ${BD_CARD}`, borderRadius: 16, padding: '16px 14px' }}>
          <div style={{ fontSize: 14, color: FG_SUB, marginBottom: 8 }}>{t('this_week_avg')}</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: accent, lineHeight: 1 }}>{thisWeek}%</div>
        </div>
        <div style={{ background: BG_CARD, border: `1px solid ${BD_CARD}`, borderRadius: 16, padding: '16px 14px' }}>
          <div style={{ fontSize: 14, color: FG_SUB, marginBottom: 8 }}>{t('last_week_avg')}</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: FG_SUB, lineHeight: 1 }}>{lastWeek}%</div>
        </div>
      </div>
      <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 600, color: diffColor }}>{diffLabel}</div>
    </div>
  );
}

function WeekChart({ weekCounts, accent, lang }: { weekCounts: number[]; accent: string; lang: Lang }) {
  const DOW_LABELS = lang === 'en' ? DOW_LABELS_EN : DOW_LABELS_KO;
  const todayIdx = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })();
  const max = Math.max(1, ...weekCounts);
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 120 }}>
        {weekCounts.map((count, i) => {
          const isToday  = i === todayIdx;
          const pct      = (count / max) * 100;
          const barColor = isToday ? '#3ddc97' : accent;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, height: '100%' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: count > 0 ? accent : 'transparent' }}>
                {count > 0 ? count : '·'}
              </span>
              <div style={{
                flex: 1, width: '100%', minHeight: 40,
                display: 'flex', alignItems: 'flex-end',
                background: BAR_EMPTY, borderRadius: 8, overflow: 'hidden',
              }}>
                <div style={{
                  width: '100%',
                  height: `${Math.max(pct, count > 0 ? 12 : 0)}%`,
                  background: barColor,
                  transition: 'height 0.6s ease',
                }} />
              </div>
              <span style={{
                fontSize: 14,
                fontWeight: isToday ? 700 : 400,
                color: isToday ? FG_MAIN : FG_SUB,
              }}>
                {DOW_LABELS[i]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskRates({ taskStats, accent }: { taskStats: TaskStat[]; accent: string }) {
  const { t } = useLanguage();
  if (!taskStats.length) {
    return <div style={{ color: FG_SUB, fontSize: 14, marginBottom: 28 }}>{t('no_tasks_stat')}</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
      {taskStats.map((task, i) => {
        const pct = Math.min(100, Math.round(task.done / task.possible * 100));
        return (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{
                fontSize: 14, color: FG_MAIN,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%',
              }}>
                {task.title}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: accent, flexShrink: 0 }}>{pct}%</span>
            </div>
            <div style={{ height: 12, background: BAR_EMPTY, borderRadius: 6, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${pct}%`,
                background: accent, borderRadius: 6,
                transition: 'width 0.6s ease',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Heatmap({ heatmap, accent }: { heatmap: HeatDay[]; accent: string }) {
  const { t } = useLanguage();
  const todayTs = startOfDay(new Date()).getTime();
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4 }}>
        {heatmap.map((day, i) => {
          const pct     = day.total > 0 ? day.done / day.total : 0;
          const isToday = day.date.getTime() === todayTs;
          const opacity = pct === 0 ? 1 : pct <= 0.33 ? 0.3 : pct <= 0.66 ? 0.6 : 1;
          return (
            <div
              key={i}
              title={`${day.date.getMonth() + 1}/${day.date.getDate()} · ${Math.round(pct * 100)}%`}
              style={{
                aspectRatio: '1', borderRadius: 4,
                background: pct === 0 ? BAR_EMPTY : accent,
                opacity,
                outline:       isToday ? `2px solid ${accent}` : 'none',
                outlineOffset: isToday ? 2 : 0,
              }}
            />
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <span style={{ fontSize: 12, color: FG_SUB }}>{t('days_ago_30')}</span>
        <span style={{ fontSize: 12, color: FG_SUB }}>{t('today')}</span>
      </div>
    </div>
  );
}

function Ranking({ allStats }: { allStats: UserStats[] }) {
  const sorted = [...allStats].sort((a, b) => b.weeklyPoints - a.weeklyPoints);
  const maxPts = Math.max(1, sorted[0]?.weeklyPoints ?? 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
      {sorted.map((st, i) => {
        const a      = THEME_ACCENT[st.user.theme] ?? '#4f9cff';
        const barPct = (st.weeklyPoints / maxPts) * 100;
        return (
          <div key={st.user.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 24, textAlign: 'center', fontSize: 16, flexShrink: 0 }}>
              {i === 0 ? '👑' : <span style={{ color: FG_SUB, fontSize: 14 }}>{i + 1}</span>}
            </div>
            <div style={{
              width: 52, fontSize: 14, fontWeight: i === 0 ? 700 : 500,
              color: i === 0 ? a : FG_MAIN,
              flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {st.user.name}
            </div>
            <div style={{ flex: 1, height: 20, background: BAR_EMPTY, borderRadius: 6, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.max(barPct, st.weeklyPoints > 0 ? 4 : 0)}%`,
                background: a, borderRadius: 6, transition: 'width 0.7s ease',
              }} />
            </div>
            <div style={{ width: 48, textAlign: 'right', fontSize: 13, color: FG_SUB, flexShrink: 0 }}>
              {st.weeklyPoints}pt
            </div>
          </div>
        );
      })}
    </div>
  );
}
