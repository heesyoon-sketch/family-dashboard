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
import { useLanguage } from '@/contexts/LanguageContext';

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
      style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 12 }}
    >
      <header className="flex items-center gap-2 mb-2" style={{ flexShrink: 0 }}>
        <motion.div {...pulse} className="w-10 h-10 rounded-xl bg-[var(--bg-card)] shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <motion.div {...pulse} className="h-3.5 w-24 rounded-full bg-[var(--bg-card)]" />
          <motion.div {...pulse} className="h-1.5 w-full rounded-full bg-[var(--bg-card)]" />
          <motion.div {...pulse} className="h-3 w-32 rounded-full bg-[var(--bg-card)]" />
        </div>
        <motion.div {...pulse} className="w-8 h-8 rounded-full bg-[var(--bg-card)] shrink-0" />
      </header>
      <div className="grid grid-cols-2 gap-2 flex-1" style={{ alignContent: 'start' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={i}
            {...pulse}
            transition={{ ...pulse.transition, delay: i * 0.06 }}
            className="rounded-2xl bg-[var(--bg-card)]"
            style={{ height: 72 }}
          />
        ))}
      </div>
    </section>
  );
}

// ── MemberPanel ───────────────────────────────────────────────────────────────

export function MemberPanel({ user }: { user: User }) {
  const { lang, t } = useLanguage();
  const hydrated       = useFamilyStore(s => s.hydrated);
  const tasks          = useFamilyStore(s => s.tasksByUser[user.id] ?? []);
  const level          = useFamilyStore(s => s.levelsByUser[user.id]);
  const completed      = useFamilyStore(s => s.todayCompletions[user.id] ?? []);
  const maxStreak      = useFamilyStore(s => s.maxStreakByUser[user.id] ?? 0);
  const longestStreak  = useFamilyStore(s => s.longestStreakByUser[user.id] ?? 0);
  const bestDay        = useFamilyStore(s => s.bestDayByUser[user.id] ?? 0);
  const growth         = useFamilyStore(s => s.growthByUser[user.id] ?? null);
  const timeOfDay      = useFamilyStore(s => s.timeOfDay);
  const doRedeemReward = useFamilyStore(s => s.redeemReward);

  const [storeOpen, setStoreOpen] = useState(false);

  if (!hydrated) return <PanelSkeleton theme={user.theme} />;

  const spendableBalance = level?.spendableBalance ?? 0;

  const visibleTasks = tasks.filter(t => {
    if (!t.timeWindow) return true;
    if (t.timeWindow === 'morning') return timeOfDay === 'morning';
    if (t.timeWindow === 'evening') return timeOfDay === 'evening';
    return true;
  });

  const doneCount  = visibleTasks.filter(task => completed.includes(task.id)).length;
  const totalCount = visibleTasks.length;
  const pct        = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  // Motivational message
  let motiveMsg: string | null = null;
  if (longestStreak > 0 && maxStreak >= longestStreak - 1) {
    motiveMsg = maxStreak >= longestStreak
      ? `🔥 ${t('new_record')}`
      : lang === 'en'
        ? `🔥 ${maxStreak}-day streak`
        : `🔥 ${maxStreak}일 도전중`;
  } else if (bestDay > 0 && doneCount >= bestDay - 1) {
    const gap = bestDay - doneCount;
    motiveMsg = gap <= 0
      ? `🏆 ${t('best_day')}`
      : lang === 'en'
        ? `🏆 ${gap} to go`
        : `🏆 ${gap}개 남았어`;
  }

  const lvlInfo       = LEVEL_THRESHOLDS.find(l => l.level === (level?.currentLevel ?? 1))!;
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
          padding: 12,
          boxShadow: 'var(--shadow)',
        }}
      >
        {/* ── Consolidated header: 3 rows, ~44px total ── */}
        <header className="flex items-start gap-2 mb-2" style={{ flexShrink: 0 }}>

          {/* Avatar — w-10 h-10 (40px) */}
          <div className="w-10 h-10 rounded-xl bg-[var(--bg-card)] flex items-center justify-center text-base font-bold text-[var(--accent)] shrink-0">
            {user.name[0]}
          </div>

          {/* Middle column: name row + XP bar + balance row */}
          <div className="flex-1 min-w-0">

            {/* Row 1: Name · Lv · pts · streak · motiveMsg (all inline) */}
            <div className="flex items-center gap-1 min-w-0 flex-wrap" style={{ rowGap: 0 }}>
              <h2 className="text-sm font-bold leading-tight truncate shrink-0 max-w-[5rem]">{user.name}</h2>
              <span className="text-[11px] text-[var(--fg-muted)] shrink-0">
                Lv.{level?.currentLevel ?? 1} · {level?.totalPoints ?? 0}pt
              </span>
              {maxStreak > 0 && (
                <span className="text-[11px] font-bold text-[var(--accent)] shrink-0">🔥{maxStreak}</span>
              )}
              {motiveMsg && (
                <span className="text-[11px] font-semibold text-[var(--accent)] truncate">{motiveMsg}</span>
              )}
            </div>

            {/* Row 2: XP progress bar */}
            <div className="h-1 rounded-full bg-[var(--border)] mt-1 overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] transition-[width] duration-500"
                style={{ width: `${Math.min(100, (pointsInLevel / pointsNeeded) * 100)}%` }}
              />
            </div>

            {/* Row 3: Balance + Store + growth (all inline, same row) */}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] font-semibold text-[var(--accent)] shrink-0">
                💰{spendableBalance}pt
              </span>
              <button
                onClick={() => setStoreOpen(true)}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-semibold bg-[var(--bg-card)] text-[var(--accent)] border border-[var(--border)] shrink-0"
              >
                <Icons.ShoppingBag size={10} />{t('store')}
              </button>
              {growth !== null && growth > 0 && (
                <span className="text-[11px] font-semibold text-[var(--accent)] truncate">
                  📈{growth}%↑
                </span>
              )}
            </div>
          </div>

          {/* Progress ring — size=32, compact */}
          <ProgressRing pct={pct} size={32} />
        </header>

        {/* ── Task grid: flex:1, overflow hidden, 8 cards fit without scroll ── */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div className="grid grid-cols-2 gap-2" style={{ alignContent: 'start' }}>
            {visibleTasks.length === 0 && (
              <div className="col-span-2 text-center text-[var(--fg-muted)] py-6 text-sm">
                {t('no_tasks_today')}
              </div>
            )}
            {visibleTasks.map((task, i) => (
              <div
                key={task.id}
                className={visibleTasks.length % 2 !== 0 && i === visibleTasks.length - 1 ? 'col-span-2' : ''}
              >
                <TaskCard
                  task={task}
                  completed={completed.includes(task.id)}
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
