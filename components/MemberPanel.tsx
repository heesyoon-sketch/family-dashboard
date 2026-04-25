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
      className="bg-[var(--bg)] text-[var(--fg)] flex flex-col min-h-[480px] md:min-h-0 md:h-full overflow-hidden"
      style={{ padding: 12 }}
    >
      <header className="flex items-center gap-2 mb-2.5 shrink-0">
        <motion.div {...pulse} className="w-10 h-10 rounded-xl bg-[var(--bg-card)] shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <motion.div {...pulse} className="h-4 w-20 rounded-full bg-[var(--bg-card)]" />
          <motion.div {...pulse} className="h-2.5 w-32 rounded-full bg-[var(--bg-card)]" />
          <motion.div {...pulse} className="h-1 w-full rounded-full bg-[var(--bg-card)]" />
        </div>
        <motion.div {...pulse} className="w-9 h-9 rounded-full bg-[var(--bg-card)] shrink-0" />
      </header>
      <div className="grid grid-cols-2 gap-2 flex-1" style={{ alignContent: 'start' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={i}
            {...pulse}
            transition={{ ...pulse.transition, delay: i * 0.06 }}
            className="rounded-2xl bg-[var(--bg-card)]"
            style={{ height: 80 }}
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

  // Incomplete first, completed sink to bottom. Stable within each group (original index order).
  const sortedTasks = [...visibleTasks].sort((a, b) => {
    const aDone = completed.includes(a.id) ? 1 : 0;
    const bDone = completed.includes(b.id) ? 1 : 0;
    return aDone - bDone;
  });

  const doneCount  = visibleTasks.filter(task => completed.includes(task.id)).length;
  const totalCount = visibleTasks.length;
  const pct        = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
  const allDone    = totalCount > 0 && doneCount === totalCount;

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
        className="bg-[var(--bg)] text-[var(--fg)] flex flex-col min-h-[520px] md:min-h-0 md:h-full overflow-hidden"
        style={{
          padding: 12,
          boxShadow: allDone
            ? 'var(--shadow), inset 0 0 0 2px var(--success), 0 0 32px var(--accent-glow)'
            : 'var(--shadow)',
          transition: 'box-shadow 0.8s ease',
        }}
      >
        {/* ── Header ── */}
        <header className="flex items-center gap-2.5 mb-3 shrink-0">

          {/*
           * Avatar: show Google photo ONLY when auth_user_id is set on this profile.
           * This prevents a linked user's photo from appearing on unlinked profiles.
           */}
          {user.avatarUrl && user.authUserId ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-xl shrink-0 object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-[var(--bg-card)] flex items-center justify-center text-base font-bold text-[var(--accent)] shrink-0 select-none">
              {user.name[0]}
            </div>
          )}

          {/* Middle: name + stats + XP bar */}
          <div className="flex-1 min-w-0">

            {/* Row 1: Name + motive */}
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="text-base font-bold leading-tight truncate shrink-0">{user.name}</h2>
              {motiveMsg && (
                <span className="text-[11px] font-semibold text-[var(--accent)] truncate">{motiveMsg}</span>
              )}
            </div>

            {/* Row 2: compact stats + balance */}
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[11px] text-[var(--fg-muted)]">
                Lv.{level?.currentLevel ?? 1} · {level?.totalPoints ?? 0}pt
              </span>
              {maxStreak > 0 && (
                <span className="text-[11px] font-bold text-[var(--accent)]">· 🔥{maxStreak}</span>
              )}
              {growth !== null && growth > 0 && (
                <span className="text-[11px] text-[var(--fg-muted)]">· 📈{growth}%</span>
              )}
              <span className="flex-1" />
              <button
                onClick={() => setStoreOpen(true)}
                className="text-[11px] font-semibold text-[var(--accent)] shrink-0"
              >
                💰{spendableBalance}pt
              </button>
            </div>

            {/* Row 3: XP bar */}
            <div className="h-1 rounded-full bg-[var(--border)] mt-1.5 overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] transition-[width] duration-500"
                style={{ width: `${Math.min(100, (pointsInLevel / pointsNeeded) * 100)}%` }}
              />
            </div>
          </div>

          {/* Progress ring */}
          <ProgressRing pct={pct} size={36} />
        </header>

        {/*
         * Task list:
         * Mobile  — overflow-y-auto: scrollable if tasks exceed panel height
         * Desktop — overflow-hidden: clips to grid cell, no scroll
         */}
        <div className="flex-1 overflow-y-auto md:overflow-hidden" style={{ minHeight: 0 }}>
          <motion.div layout className="grid grid-cols-2 gap-2" style={{ alignContent: 'start' }}>
            {sortedTasks.length === 0 && (
              <div className="col-span-2 text-center text-[var(--fg-muted)] py-8 text-sm">
                {t('no_tasks_today')}
              </div>
            )}
            {sortedTasks.map((task, i) => (
              <motion.div
                key={task.id}
                layout
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className={sortedTasks.length % 2 !== 0 && i === sortedTasks.length - 1 ? 'col-span-2' : ''}
              >
                <TaskCard
                  task={task}
                  completed={completed.includes(task.id)}
                  theme={user.theme}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
    </>
  );
}
