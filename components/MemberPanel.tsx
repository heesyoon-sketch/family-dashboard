'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { HeartHandshake, Mail, Store } from 'lucide-react';
import { Reward, User } from '@/lib/db';
import { TaskCard } from './TaskCard';
import { ProgressRing } from './ProgressRing';
import { useFamilyStore } from '@/lib/store';
import { LEVEL_THRESHOLDS } from '@/lib/gamification';
import { StoreModal } from './StoreModal';
import { WarmGiftModal } from './WarmGiftModal';
import { ActivityFeedModal } from './ActivityFeedModal';
import { useLanguage } from '@/contexts/LanguageContext';

const MAILBOX_ACTIVITY_TYPES = new Set(['GIFT_SENT', 'GIFT_RECEIVED', 'REWARD_PURCHASED']);

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
      <div className="grid grid-cols-2 gap-2 auto-rows-[76px] md:auto-rows-[80px]">
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={i}
            {...pulse}
            transition={{ ...pulse.transition, delay: i * 0.06 }}
            className="rounded-2xl bg-[var(--bg-card)] h-full"
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
  const allUsers       = useFamilyStore(s => s.users);
  const activities     = useFamilyStore(s => s.activitiesByUser[user.id] ?? []);

  const [storeOpen, setStoreOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityReadAt, setActivityReadAt] = useState(() => {
    if (typeof window === 'undefined') return 0;
    return Number(localStorage.getItem(`family_activity_read_at_${user.id}`) ?? 0);
  });
  const [recentCutoff] = useState(() => Date.now() - 24 * 60 * 60 * 1000);
  // Incremented on every open so StoreModal always mounts fresh.
  const [storeOpenKey, setStoreOpenKey] = useState(0);
  const [avatarVersion] = useState(() => Date.now());
  const scrollRef      = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(false);

  if (!hydrated) return <PanelSkeleton theme={user.theme} />;

  const spendableBalance = level?.spendableBalance ?? 0;
  const mailboxActivities = activities.filter(activity => MAILBOX_ACTIVITY_TYPES.has(activity.type));
  const hasRecentUnreadActivity = mailboxActivities.some(activity => {
    const created = activity.createdAt.getTime();
    return created >= recentCutoff && created > activityReadAt;
  });
  const giftReceivers = allUsers
    .filter(member => member.id !== user.id)
    .sort((a, b) => a.displayOrder - b.displayOrder);

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

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 40);
  };

  const moreCount = Math.max(0, sortedTasks.length - 8);
  const showMore  = moreCount > 0 && !atBottom;

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
  const avatarSrc = user.avatarUrl
    ? `${user.avatarUrl}${user.avatarUrl.includes('?') ? '&' : '?'}v=${avatarVersion}`
    : null;

  const handleRedeem = async (reward: Reward) => {
    await doRedeemReward(user.id, reward.id, reward.cost_points);
  };

  const openStore = () => {
    setStoreOpenKey(k => k + 1);
    setStoreOpen(true);
  };

  const openActivityFeed = () => {
    const now = Date.now();
    setActivityReadAt(now);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`family_activity_read_at_${user.id}`, String(now));
    }
    setActivityOpen(true);
  };

  return (
    <>
      {storeOpen && (
        <StoreModal
          key={storeOpenKey}
          user={user}
          balance={spendableBalance}
          onClose={() => setStoreOpen(false)}
          onRedeem={handleRedeem}
        />
      )}
      {giftOpen && (
        <WarmGiftModal
          sender={user}
          receivers={giftReceivers}
          balance={spendableBalance}
          onClose={() => setGiftOpen(false)}
        />
      )}
      {activityOpen && (
        <ActivityFeedModal
          user={user}
          activities={mailboxActivities}
          onClose={() => setActivityOpen(false)}
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

          <div className="relative w-10 h-10 shrink-0">
            {avatarSrc ? (
              <Image
                src={avatarSrc}
                alt={user.name}
                width={40}
                height={40}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-xl shrink-0 object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-[var(--bg-card)] flex items-center justify-center text-base font-bold text-[var(--accent)] shrink-0 select-none">
                {user.name[0]}
              </div>
            )}
          </div>

          {/* Middle: name + stats + XP bar */}
          <div className="flex-1 min-w-0">

            {/* Row 1: Name + motive */}
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="text-base font-bold leading-tight truncate shrink-0">{user.name}</h2>
              {motiveMsg && (
                <span className="text-[11px] font-semibold text-[var(--accent)] truncate">{motiveMsg}</span>
              )}
            </div>

            {/* Row 2: compact stats + balance + store */}
            <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
              <span className="text-[11px] text-[var(--fg-muted)] truncate">
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
                type="button"
                onClick={openActivityFeed}
                className="text-[11px] font-bold text-[var(--accent)] shrink-0"
                title="편지함 및 기록"
                aria-label="편지함 및 기록"
              >
                💰{spendableBalance}pt
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={openActivityFeed}
                  className="relative h-7 px-2.5 rounded-full bg-[var(--accent)] text-gray-950 text-[11px] font-bold flex items-center gap-1 shrink-0 transition hover:brightness-95"
                  title="편지함 및 기록"
                  aria-label="편지함 및 기록"
                >
                  <Mail size={13} />
                  <span>편지함</span>
                  {hasRecentUnreadActivity && (
                    <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[var(--bg)]" />
                  )}
                </button>
                {giftReceivers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setGiftOpen(true)}
                    className="h-7 px-2.5 rounded-full bg-[var(--accent)] text-gray-950 text-[11px] font-bold flex items-center gap-1 shrink-0 transition hover:brightness-95"
                    title="마음 나누기"
                    aria-label="마음 나누기"
                  >
                    <HeartHandshake size={13} />
                    <span>선물</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={openStore}
                  className="h-7 px-2.5 rounded-full bg-[var(--accent)] text-gray-950 text-[11px] font-bold flex items-center gap-1 shrink-0 transition hover:brightness-95"
                >
                  <Store size={13} />
                  <span>{lang === 'en' ? 'Store' : '상점'}</span>
                </button>
              </div>
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

        {/* Positioning context for gradient + badge overlays */}
        <div className="relative flex-1" style={{ minHeight: 0 }}>

          {/* Scrollable task list */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="absolute inset-0 overflow-y-auto"
          >
            <motion.div
              layout
              className="grid grid-cols-2 gap-2 auto-rows-[76px] md:auto-rows-[80px]"
            >
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

          {/* Gradient fade — always mounted, opacity driven by showMore */}
          <motion.div
            initial={false}
            animate={{ opacity: showMore ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-x-0 bottom-0 h-16 pointer-events-none bg-gradient-to-t from-[var(--bg)] to-transparent"
          />

          {/* Bouncing pill badge */}
          <AnimatePresence>
            {showMore && (
              <motion.div
                key="more-badge"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, y: [0, 4, 0] }}
                exit={{ opacity: 0 }}
                transition={{
                  opacity: { duration: 0.2 },
                  y: { duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: 0.4 },
                }}
                className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--bg-card)] ring-1 ring-[var(--border)] text-[11px] font-semibold text-[var(--fg-muted)] whitespace-nowrap"
              >
                ↓ {moreCount} more
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </>
  );
}
