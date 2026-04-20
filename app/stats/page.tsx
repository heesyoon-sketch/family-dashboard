'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { db, User, Task, startOfDay } from '@/lib/db';
import { seedIfEmpty } from '@/lib/seed';

const ORDER = ['dark_minimal', 'warm_minimal', 'robot_neon', 'pastel_cute'] as const;
const DOW_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

const THEME_ACCENT: Record<string, string> = {
  dark_minimal: '#4f9cff',
  warm_minimal: '#d97757',
  robot_neon:   '#00e5ff',
  pastel_cute:  '#ff8fab',
};

// Fixed dark palette — never changes per theme
const BG_PAGE    = '#0f0f0f';
const BG_SECTION = '#1a1a1a';
const BG_CARD    = '#242424';
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
  const [allStats, setAllStats] = useState<UserStats[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      await seedIfEmpty();
      const now = new Date();
      const dayStart = startOfDay(now);
      const weekStart = weekMonday(now);
      const weekEnd = addDays(weekStart, 7);
      const lastWeekStart = addDays(weekStart, -7);
      const monthStart = addDays(dayStart, -29);

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
            comps.filter(c => {
              const t = new Date(c.completedAt).getTime();
              return t >= d.getTime() && t < dEnd.getTime();
            }).map(c => c.taskId)
          ).size;
          sum += unique / total;
        }
        return Math.round((sum / days) * 100);
      }

      const users = await db.users.toArray();
      const ordered = ORDER
        .map(t => users.find(u => u.theme === t))
        .filter(Boolean) as User[];

      const result: UserStats[] = [];
      for (const user of ordered) {
        const activeTasks = await db.tasks
          .where('[userId+active]').equals([user.id, 1]).toArray();

        const todayComps = await db.taskCompletions
          .where('[userId+completedAt]').between([user.id, dayStart], [user.id, now]).toArray();
        const todayDone = new Set(todayComps.map(c => c.taskId)).size;

        const streaks = await db.streaks.where('userId').equals(user.id).toArray();
        const maxStreak = streaks.reduce((m, s) => Math.max(m, s.current), 0);
        const lvl = await db.levels.get(user.id);

        const weekComps = await db.taskCompletions
          .where('[userId+completedAt]').between([user.id, weekStart], [user.id, weekEnd]).toArray();
        const lastWeekComps = await db.taskCompletions
          .where('[userId+completedAt]').between([user.id, lastWeekStart], [user.id, weekStart]).toArray();
        const weekCounts = Array(7).fill(0);
        let weeklyPoints = 0;
        for (const c of weekComps) {
          const dow = new Date(c.completedAt).getDay();
          weekCounts[dow === 0 ? 6 : dow - 1]++;
          weeklyPoints += c.pointsAwarded;
        }

        const monthComps = await db.taskCompletions
          .where('[userId+completedAt]').between([user.id, monthStart], [user.id, now]).toArray();

        const taskStats: TaskStat[] = activeTasks.map(task => {
          let possible = 0;
          for (let i = 0; i < 30; i++) {
            const d = addDays(monthStart, i);
            const isWE = [0, 6].includes(d.getDay());
            if (task.recurrence === 'weekdays' && isWE) continue;
            if (task.recurrence === 'weekend' && !isWE) continue;
            possible++;
          }
          const done = new Set(
            monthComps.filter(c => c.taskId === task.id)
              .map(c => startOfDay(new Date(c.completedAt)).getTime())
          ).size;
          return { title: task.title, done, possible: Math.max(possible, 1) };
        });
        taskStats.sort((a, b) => a.done / a.possible - b.done / b.possible);

        const heatmap: HeatDay[] = Array.from({ length: 30 }, (_, i) => {
          const d = addDays(monthStart, i);
          const dEnd = addDays(d, 1);
          const dc = monthComps.filter(c => {
            const t = new Date(c.completedAt).getTime();
            return t >= d.getTime() && t < dEnd.getTime();
          });
          return { date: d, done: new Set(dc.map(c => c.taskId)).size, total: activeTasks.length };
        });

        const total = activeTasks.length;
        const daysThisWeek = (now.getDay() === 0 ? 6 : now.getDay() - 1) + 1;
        const thisWeekAvgPct = total > 0 ? avgDailyPct(weekComps, weekStart, daysThisWeek, total) : null;
        const lastWeekAvgPct = total > 0 && lastWeekComps.length > 0
          ? avgDailyPct(lastWeekComps, lastWeekStart, 7, total)
          : null;

        result.push({
          user, tasks: activeTasks, todayDone, maxStreak,
          totalPoints: lvl?.totalPoints ?? 0,
          currentLevel: lvl?.currentLevel ?? 1,
          weekCounts, weeklyPoints, taskStats, heatmap,
          thisWeekAvgPct, lastWeekAvgPct,
        });
      }
      setAllStats(result);
      setLoading(false);
    }
    load();
  }, []);

  const s = allStats[idx];
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
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 6, color: FG_SUB, textDecoration: 'none' }}>
            <ArrowLeft size={16} />
            <span style={{ fontSize: 13 }}>대시보드로</span>
          </a>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex' }}>
          {allStats.map((st, i) => {
            const a = THEME_ACCENT[st.user.theme] ?? '#4f9cff';
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
          불러오는 중…
        </div>
      )}

      {!loading && s && (
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px 80px' }}>

          {/* A — 오늘 요약 */}
          <SectionLabel accent={accent}>오늘 요약</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 28 }}>
            <StatCard
              label="오늘 완료율"
              value={s.tasks.length > 0 ? `${Math.round(s.todayDone / s.tasks.length * 100)}%` : '—'}
              sub={`${s.todayDone}/${s.tasks.length}`}
              accent={accent}
            />
            <StatCard
              label="최고 연속"
              value={s.maxStreak > 0 ? `🔥${s.maxStreak}` : '—'}
              sub={s.maxStreak > 0 ? '일' : undefined}
              accent={accent}
            />
            <StatCard
              label={`Lv.${s.currentLevel}`}
              value={s.totalPoints.toLocaleString()}
              sub="pt"
              accent={accent}
            />
          </div>

          {/* A-2 — 이번 주 vs 지난 주 */}
          <SectionLabel accent={accent}>이번 주 vs 지난 주</SectionLabel>
          <WeekComparison thisWeek={s.thisWeekAvgPct} lastWeek={s.lastWeekAvgPct} accent={accent} />

          {/* B — 이번 주 */}
          <SectionLabel accent={accent}>이번 주 완료 수</SectionLabel>
          <WeekChart weekCounts={s.weekCounts} accent={accent} />

          {/* C — task 달성률 */}
          <SectionLabel accent={accent}>이번 달 task 달성률</SectionLabel>
          <TaskRates taskStats={s.taskStats} accent={accent} />

          {/* D — 히트맵 */}
          <SectionLabel accent={accent}>최근 30일 히트맵</SectionLabel>
          <Heatmap heatmap={s.heatmap} accent={accent} />

          {/* E — 가족 랭킹 */}
          <SectionLabel accent={accent}>이번 주 가족 랭킹</SectionLabel>
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

function WeekComparison({ thisWeek, lastWeek, accent }: { thisWeek: number | null; lastWeek: number | null; accent: string }) {
  if (thisWeek === null || lastWeek === null) {
    return <div style={{ fontSize: 14, color: FG_SUB, marginBottom: 28 }}>아직 비교 데이터가 없어요</div>;
  }
  const diff = thisWeek - lastWeek;
  const diffColor = diff > 0 ? '#3ddc97' : diff < 0 ? '#ff6b6b' : FG_SUB;
  const diffLabel = diff > 0
    ? `↑ +${diff}% 향상`
    : diff < 0
    ? `↓ ${Math.abs(diff)}% 분발해봐요`
    : '→ 유지';
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div style={{ background: BG_CARD, border: `1px solid ${BD_CARD}`, borderRadius: 16, padding: '16px 14px' }}>
          <div style={{ fontSize: 14, color: FG_SUB, marginBottom: 8 }}>이번 주 평균</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: accent, lineHeight: 1 }}>{thisWeek}%</div>
        </div>
        <div style={{ background: BG_CARD, border: `1px solid ${BD_CARD}`, borderRadius: 16, padding: '16px 14px' }}>
          <div style={{ fontSize: 14, color: FG_SUB, marginBottom: 8 }}>지난 주 평균</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: FG_SUB, lineHeight: 1 }}>{lastWeek}%</div>
        </div>
      </div>
      <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 600, color: diffColor }}>{diffLabel}</div>
    </div>
  );
}

function WeekChart({ weekCounts, accent }: { weekCounts: number[]; accent: string }) {
  const todayIdx = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })();
  const max = Math.max(1, ...weekCounts);
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 120 }}>
        {weekCounts.map((count, i) => {
          const isToday = i === todayIdx;
          const pct = (count / max) * 100;
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
  if (!taskStats.length) {
    return <div style={{ color: FG_SUB, fontSize: 14, marginBottom: 28 }}>task 없음</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
      {taskStats.map((t, i) => {
        const pct = Math.min(100, Math.round(t.done / t.possible * 100));
        return (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{
                fontSize: 14, color: FG_MAIN,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%',
              }}>
                {t.title}
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
  const todayTs = startOfDay(new Date()).getTime();
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4 }}>
        {heatmap.map((day, i) => {
          const pct = day.total > 0 ? day.done / day.total : 0;
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
                outline: isToday ? `2px solid ${accent}` : 'none',
                outlineOffset: isToday ? 2 : 0,
              }}
            />
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <span style={{ fontSize: 12, color: FG_SUB }}>30일 전</span>
        <span style={{ fontSize: 12, color: FG_SUB }}>오늘</span>
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
        const a = THEME_ACCENT[st.user.theme] ?? '#4f9cff';
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
