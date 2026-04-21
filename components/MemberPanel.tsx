'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import { User } from '@/lib/db';
import { TaskCard } from './TaskCard';
import { ProgressRing } from './ProgressRing';
import { useFamilyStore } from '@/lib/store';
import { LEVEL_THRESHOLDS } from '@/lib/gamification';
import { StoreModal, type Reward } from './StoreModal';

// ── Skeleton ─────────────────────────────────────────────────────────────────

const pulse = {
  animate: { opacity: [0.4, 0.8, 0.4] },
  transition: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' as const },
};

function PanelSkeleton({ theme }: { theme: string }) {
  return (
    <section
      data-theme={theme}
      className="bg-[var(--bg)] text-[var(--fg)]"
      style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 16 }}
    >
      <header className="flex items-center gap-3 mb-4" style={{ flexShrink: 0 }}>
        <motion.div {...pulse} className="w-12 h-12 rounded-xl bg-[var(--bg-card)] shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <motion.div {...pulse} className="h-4 w-28 rounded-full bg-[var(--bg-card)]" />
          <motion.div {...pulse} className="h-2 w-full rounded-full bg-[var(--bg-card)]" />
        </div>
        <motion.div {...pulse} className="w-12 h-12 rounded-full bg-[var(--bg-card)] shrink-0" />
      </header>
      <div className="grid grid-cols-2 gap-2 flex-1" style={{ alignContent: 'start' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div
            key={i}
            {...pulse}
            transition={{ ...pulse.transition, delay: i * 0.08 }}
            className="rounded-2xl bg-[var(--bg-card)]"
            style={{ height: 64 }}
          />
        ))}
      </div>
    </section>
  );
}

// ── MemberPanel ───────────────────────────────────────────────────────────────

export function MemberPanel({ user }: { user: User }) {
  const hydrated      = useFamilyStore(s => s.hydrated);
  const tasks         = useFamilyStore(s => s.tasksByUser[user.id] ?? []);
  const level         = useFamilyStore(s => s.levelsByUser[user.id]);
  const completed     = useFamilyStore(s => s.todayCompletions[user.id] ?? []);
  const maxStreak     = useFamilyStore(s => s.maxStreakByUser[user.id] ?? 0);
  const longestStreak = useFamilyStore(s => s.longestStreakByUser[user.id] ?? 0);
  const bestDay       = useFamilyStore(s => s.bestDayByUser[user.id] ?? 0);
  const growth        = useFamilyStore(s => s.growthByUser[user.id] ?? null);
  const timeOfDay     = useFamilyStore(s => s.timeOfDay);
  const doRedeemReward = useFamilyStore(s => s.redeemReward);

  const [storeOpen, setStoreOpen] = useState(false);

  if (!hydrated) return <PanelSkeleton theme={user.theme} />;

  const spendableBalance = level?.spendableBalance ?? 0;

  // timeWindow 기준으로 현재 시간대에 보여야 할 task만 표시
  const visibleTasks = tasks.filter(t => {
    if (!t.timeWindow) return true;
    if (t.timeWindow === 'morning') return timeOfDay === 'morning';
    if (t.timeWindow === 'evening') return timeOfDay === 'evening';
    return true;
  });

  const doneCount  = visibleTasks.filter(t => completed.includes(t.id)).length;
  const totalCount = visibleTasks.length;
  const pct        = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  // 동기부여 메시지
  let motiveMsg: string | null = null;
  if (longestStreak > 0 && maxStreak >= longestStreak - 1) {
    motiveMsg = maxStreak >= longestStreak
      ? '🔥 신기록 달성!'
      : `🔥 ${maxStreak}일 연속 신기록 도전 중!`;
  } else if (bestDay > 0 && doneCount >= bestDay - 1) {
    const gap = bestDay - doneCount;
    motiveMsg = gap <= 0 ? '🏆 오늘 역대 최고야!' : `🏆 최고 기록까지 ${gap}개 남았어!`;
  }

  const lvlInfo      = LEVEL_THRESHOLDS.find(l => l.level === (level?.currentLevel ?? 1))!;
  const pointsInLevel = (level?.totalPoints ?? 0) - lvlInfo.min;
  const pointsNeeded  = lvlInfo.max - lvlInfo.min;

  const handleRedeem = async (reward: Reward) => {
    await doRedeemReward(user.id, reward.id, reward.cost_points);
  };

  return (
    <>
      {storeOpen && (
        <StoreModal
          user={user}
          balance={spendableBalance}
          onClose={() => setStoreOpen(false)}
          onRedeem={handleRedeem}
        />
      )}

      <section
        data-theme={user.theme}
        className="bg-[var(--bg)] text-[var(--fg)]"
        style={{
          height: '100%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          padding: 16,
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
              <span className="text-xs text-[var(--fg-muted)] shrink-0">
                Lv.{level?.currentLevel ?? 1} · {level?.totalPoints ?? 0}pt
              </span>
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

        {/* 잔액 + 상점 버튼 */}
        <div className="flex items-center justify-between mb-1.5" style={{ flexShrink: 0 }}>
          <span className="text-xs font-semibold text-[var(--accent)]">
            💰 {spendableBalance}pt 보유
          </span>
          <button
            onClick={() => setStoreOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--bg-card)] text-[var(--accent)] border border-[var(--border)]"
          >
            <Icons.ShoppingBag size={12} /> 상점
          </button>
        </div>

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

        <div style={{ flex: 1, overflowY: 'hidden' }}>
          <div className="grid grid-cols-2 gap-2" style={{ alignContent: 'start' }}>
            {visibleTasks.length === 0 && (
              <div className="col-span-2 text-center text-[var(--fg-muted)] py-8">
                오늘 할 일이 없어요
              </div>
            )}
            {visibleTasks.map((t, i) => (
              <div
                key={t.id}
                className={visibleTasks.length % 2 !== 0 && i === visibleTasks.length - 1 ? 'col-span-2' : ''}
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
    </>
  );
}
