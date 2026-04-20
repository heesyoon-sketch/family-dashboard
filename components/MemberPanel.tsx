'use client';

import { User } from '@/lib/db';
import { TaskCard } from './TaskCard';
import { ProgressRing } from './ProgressRing';
import { useFamilyStore } from '@/lib/store';
import { LEVEL_THRESHOLDS } from '@/lib/gamification';

export function MemberPanel({ user }: { user: User }) {
  const tasks = useFamilyStore(s => s.tasksByUser[user.id] ?? []);
  const level = useFamilyStore(s => s.levelsByUser[user.id]);
  const completed = useFamilyStore(s => s.todayCompletions[user.id] ?? []);
  const maxStreak = useFamilyStore(s => s.maxStreakByUser[user.id] ?? 0);
  const longestStreak = useFamilyStore(s => s.longestStreakByUser[user.id] ?? 0);
  const bestDay = useFamilyStore(s => s.bestDayByUser[user.id] ?? 0);
  const growth = useFamilyStore(s => s.growthByUser[user.id] ?? null);

  const doneCount = tasks.filter(t => completed.includes(t.id)).length;
  const totalCount = tasks.length;
  const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  // 동기부여 메시지 계산 (streak 신기록 우선)
  let motiveMsg: string | null = null;
  if (longestStreak > 0 && maxStreak >= longestStreak - 1) {
    if (maxStreak >= longestStreak) {
      motiveMsg = '🔥 신기록 달성!';
    } else {
      motiveMsg = `🔥 ${maxStreak}일 연속 신기록 도전 중!`;
    }
  } else if (bestDay > 0 && doneCount >= bestDay - 1) {
    const gap = bestDay - doneCount;
    motiveMsg = gap <= 0 ? '🏆 오늘 역대 최고야!' : `🏆 최고 기록까지 ${gap}개 남았어!`;
  }

  const lvlInfo = LEVEL_THRESHOLDS.find(l => l.level === (level?.currentLevel ?? 1))!;
  const pointsInLevel = (level?.totalPoints ?? 0) - lvlInfo.min;
  const pointsNeeded = lvlInfo.max - lvlInfo.min;

  return (
    <section
      data-theme={user.theme}
      className="bg-[var(--bg)] text-[var(--fg)]"
      style={{
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        padding: 24,
        boxShadow: 'var(--shadow)',
      }}
    >
      <header className="flex items-center gap-3 mb-1.5" style={{ flexShrink: 0 }}>
        <div className="w-12 h-12 rounded-xl bg-[var(--bg-card)] flex items-center justify-center text-xl font-bold text-[var(--accent)] shrink-0">
          {user.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 min-w-0">
            <h2 className="text-lg font-bold truncate leading-tight">{user.name}</h2>
            <span className="text-xs text-[var(--fg-muted)] shrink-0">Lv.{level?.currentLevel ?? 1} · {level?.totalPoints ?? 0}pt</span>
            {maxStreak > 0 && (
              <span className="text-sm font-bold text-[var(--accent)] shrink-0">🔥{maxStreak}</span>
            )}
          </div>
          <div className="h-1 rounded-full bg-[var(--border)] mt-1 overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] transition-[width] duration-500"
              style={{ width: `${Math.min(100, (pointsInLevel / pointsNeeded) * 100)}%` }}
            />
          </div>
        </div>
        <ProgressRing pct={pct} size={48} />
      </header>

      {motiveMsg && (
        <div className="text-xs font-semibold text-[var(--accent)] truncate" style={{ flexShrink: 0, marginBottom: 2 }}>
          {motiveMsg}
        </div>
      )}
      {growth !== null && growth > 0 && (
        <div className="text-xs font-semibold text-[var(--accent)] truncate" style={{ flexShrink: 0, marginBottom: 6 }}>
          {`📈 지난 주보다 ${growth}% 향상!`}
        </div>
      )}

      <div
        className="task-scroll"
        style={{
          flex: 1,
          overflowY: 'scroll',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          touchAction: 'pan-y',
          paddingRight: 4,
          marginRight: -4,
        }}
      ><div className="grid grid-cols-2" style={{ alignContent: 'start', gap: '8px' }}>
        {tasks.length === 0 && (
          <div className="text-center text-[var(--fg-muted)] py-8">
            오늘 할 일이 없어요
          </div>
        )}
        {tasks.map((t, i) => (
          <div
            key={t.id}
            className={tasks.length % 2 !== 0 && i === tasks.length - 1 ? 'col-span-2' : ''}
          >
            <TaskCard
              task={t}
              completed={completed.includes(t.id)}
              theme={user.theme}
            />
          </div>
        ))}
        </div>
      </div>
    </section>
  );
}
