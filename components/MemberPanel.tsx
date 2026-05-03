'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
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

const MAILBOX_ACTIVITY_TYPES = new Set(['GIFT_SENT', 'GIFT_RECEIVED', 'REWARD_PURCHASED', 'SYSTEM_MESSAGE']);

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
  const dailyStreak    = useFamilyStore(s => s.dailyStreakByUser[user.id] ?? 0);
  const dailyStreakAtRisk = useFamilyStore(s => s.dailyStreakAtRiskByUser[user.id] ?? false);
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
  const listRef        = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  const spendableBalance = level?.spendableBalance ?? 0;
  const mailboxActivities = activities.filter(activity => MAILBOX_ACTIVITY_TYPES.has(activity.type));
  const hasRecentUnreadActivity = mailboxActivities.some(activity => {
    const created = activity.createdAt.getTime();
    return created >= recentCutoff && created > activityReadAt;
  });
  const giftReceivers = allUsers
    .filter(member => member.id !== user.id)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const isTaskCurrent = (task: { timeWindow?: string | null }) => {
    if (!task.timeWindow) return true;
    if (task.timeWindow === 'morning') return timeOfDay === 'morning';
    if (task.timeWindow === 'evening') return timeOfDay === 'evening';
    return true;
  };
  const currentTasks = tasks.filter(isTaskCurrent);
  // Incomplete first, completed sink to bottom. Stable within each group (original index order).
  const sortedTasks = [...currentTasks].sort((a, b) => {
    const aDone = completed.includes(a.id) ? 1 : 0;
    const bDone = completed.includes(b.id) ? 1 : 0;
    return aDone - bDone;
  });

  const updateScrollHint = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const overflow = el.scrollHeight > el.clientHeight + 8;
    setHasOverflow(overflow);
    setAtBottom(!overflow || el.scrollTop + el.clientHeight >= el.scrollHeight - 40);
  }, []);

  useEffect(() => {
    updateScrollHint();
    const el = scrollRef.current;
    const list = listRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateScrollHint);
    observer.observe(el);
    if (list) observer.observe(list);
    return () => observer.disconnect();
  }, [sortedTasks.length, timeOfDay, updateScrollHint]);

  if (!hydrated) return <PanelSkeleton theme={user.theme} />;

  const moreCount = Math.max(0, sortedTasks.length - 8);
  const showMore  = hasOverflow && !atBottom;

  const doneCount  = currentTasks.filter(task => completed.includes(task.id)).length;
  const totalCount = currentTasks.length;
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
          padding: 8,
          boxShadow: allDone
            ? 'var(--shadow), inset 0 0 0 3px var(--success-ring), 0 0 32px var(--success-glow, var(--accent-glow))'
            : 'var(--shadow)',
          transition: 'box-shadow 0.8s ease',
        }}
      >
        {/* ── Header ── */}
        <header className="mb-2 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/80 px-2 py-1.5 max-[380px]:px-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
            <div className="flex min-w-0 flex-1 items-center gap-2 max-[380px]:basis-[calc(100%-42px)]">
              <div className="relative h-9 w-9 shrink-0">
                {avatarSrc ? (
                  <Image
                    src={avatarSrc}
                    alt={user.name}
                    width={36}
                    height={36}
                    referrerPolicy="no-referrer"
                    className="h-9 w-9 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent-glow)] text-base font-bold text-[var(--accent)] select-none">
                    {user.name[0]}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 overflow-hidden pr-0.5">
                <div className="flex min-w-0 items-center gap-1.5 max-[380px]:gap-1">
                  <h2 className="min-w-0 truncate text-base font-bold leading-tight max-[380px]:text-sm">{user.name}</h2>
                  {motiveMsg && (
                    <span className="min-w-0 shrink truncate rounded-full bg-[var(--accent-glow)] px-1.5 py-0.5 text-[10px] font-bold leading-none text-[var(--accent)] max-[380px]:px-1 max-[380px]:text-[9px]">
                      {motiveMsg}
                    </span>
                  )}
                </div>

                <div className="mt-0.5 flex min-w-0 items-center gap-1.5 overflow-hidden text-[10px] font-semibold text-[var(--fg-muted)] max-[380px]:gap-1 max-[380px]:text-[9px]">
                  <span className="shrink-0">Lv.{level?.currentLevel ?? 1}</span>
                  <span className="h-1 w-1 shrink-0 rounded-full bg-[var(--fg-muted)]/40" />
                  <span className="min-w-0 truncate">{level?.totalPoints ?? 0}pt</span>
                  {dailyStreak > 0 && (
                    <>
                      <span className="h-1 w-1 shrink-0 rounded-full bg-[var(--fg-muted)]/40" />
                      <motion.span
                        className={`shrink-0 ${dailyStreakAtRisk ? 'text-rose-300' : 'text-[var(--accent)]'}`}
                        animate={dailyStreakAtRisk ? { opacity: [1, 0.45, 1] } : { opacity: 1 }}
                        transition={dailyStreakAtRisk ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }}
                        title={dailyStreakAtRisk
                          ? (lang === 'en' ? 'Finish a task today to keep your streak!' : '오늘 한 개라도 완료해서 연속 기록을 지켜요!')
                          : (lang === 'en' ? `${dailyStreak}-day streak` : `${dailyStreak}일 연속`)}
                      >
                        🔥{dailyStreak}d
                      </motion.span>
                    </>
                  )}
                  {maxStreak > 0 && (
                    <>
                      <span className="h-1 w-1 shrink-0 rounded-full bg-[var(--fg-muted)]/40" />
                      <span
                        className="shrink-0"
                        title={lang === 'en' ? 'Best per-task streak' : '습관 최고 연속'}
                      >
                        ⭐{maxStreak}
                      </span>
                    </>
                  )}
                  {growth !== null && growth > 0 && (
                    <>
                      <span className="h-1 w-1 shrink-0 rounded-full bg-[var(--fg-muted)]/40" />
                      <span className="shrink-0">📈{growth}%</span>
                    </>
                  )}
                </div>

                <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--border)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
                    style={{ width: `${Math.min(100, (pointsInLevel / pointsNeeded) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            <ProgressRing pct={pct} size={34} />

            <div className="flex min-w-0 shrink-0 items-center justify-end gap-1 max-[380px]:w-full">
              <button
                type="button"
                onClick={() => setGiftOpen(true)}
                disabled={giftReceivers.length === 0}
                className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] transition hover:brightness-105 disabled:opacity-35 max-[380px]:h-7 max-[380px]:w-7"
                title={t('gift')}
                aria-label={t('gift')}
              >
                <HeartHandshake size={15} className="text-rose-300" />
              </button>
              <button
                type="button"
                onClick={openStore}
                className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--accent)] bg-[var(--accent)] text-gray-950 transition hover:brightness-95 max-[380px]:h-7 max-[380px]:w-7"
                title={t('store')}
                aria-label={t('store')}
              >
                <Store size={15} />
              </button>
              <button
                type="button"
                onClick={openActivityFeed}
                className="relative grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] transition hover:brightness-105 max-[380px]:h-7 max-[380px]:w-7"
                title={t('mailbox_history')}
                aria-label={t('mailbox_history')}
              >
                <Mail size={15} className="text-[var(--accent)]" />
                {hasRecentUnreadActivity && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[var(--bg)]" />
                )}
              </button>
              <div
                className="flex h-8 min-w-[58px] items-center justify-end text-right text-[12px] font-black leading-none tabular-nums text-[var(--accent)] max-[380px]:h-7 max-[380px]:min-w-[48px] max-[380px]:text-[11px]"
                title={lang === 'en' ? 'Current points' : '현재 포인트'}
                aria-label={lang === 'en' ? 'Current points' : '현재 포인트'}
              >
                <span>{spendableBalance}</span>
                <span className="ml-0.5 text-[9px] font-bold text-[var(--fg-muted)]">pt</span>
              </div>
            </div>
          </div>
        </header>

        {/* Positioning context for gradient + badge overlays */}
        <div className="relative flex-1" style={{ minHeight: 0 }}>

          {/* Scrollable task list */}
          <div
            ref={scrollRef}
            onScroll={updateScrollHint}
            className="absolute inset-0 overflow-y-auto"
          >
            <motion.div
              ref={listRef}
              layout
              className="grid grid-cols-2 gap-1.5 auto-rows-[clamp(66px,17vh,76px)] pb-12 md:auto-rows-[clamp(60px,calc((50vh-108px)/4),76px)]"
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
                {moreCount > 0
                  ? (lang === 'en' ? `↓ ${moreCount} more` : `↓ ${moreCount}개 더 있어요`)
                  : (lang === 'en' ? '↓ more' : '↓ 더 있어요')}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </>
  );
}
