'use client';

import { useCallback, useEffect, useState, useRef, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { ArrowDown, CheckCircle2, Eye, HeartHandshake, Mail, MoonStar, Store, Sunrise } from 'lucide-react';
import { Reward, User } from '@/lib/db';
import { TaskCard } from './TaskCard';
import { MomentumAura } from './MomentumAura';
import { EquippedInsigniaStrip } from './EquippedInsigniaStrip';
import { useFamilyStore } from '@/lib/store';
import { computeLevelProgress, emptyMomentum, formatXp } from '@/lib/progression';
import { StoreModal } from './StoreModal';
import { WarmGiftModal } from './WarmGiftModal';
import { ActivityFeedModal } from './ActivityFeedModal';
import { PerfectDayCouponModal } from './PerfectDayCouponModal';
import { RoutineReferenceCard } from './RoutineReferenceCard';
import { PerfectQuestChip } from './PerfectQuestChip';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  getTimeWindowDisplay,
  isTaskActiveInTimeWindow,
  taskWindowSortRank,
} from '@/lib/timeWindows';

const EMPTY_ITEMS: never[] = [];
const EMPTY_WINDOWS = { morning: EMPTY_ITEMS, evening: EMPTY_ITEMS };

const MAILBOX_ACTIVITY_TYPES = new Set(['GIFT_SENT', 'GIFT_RECEIVED', 'REWARD_PURCHASED', 'REWARD_REFUNDED', 'SYSTEM_MESSAGE']);

function isObserverRewardActivity(activity: { type: string; relatedUserName?: string }): boolean {
  return activity.type === 'REWARD_PURCHASED' && Boolean(activity.relatedUserName?.includes(' · '));
}

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
  const routineId = useId();
  const hydrated       = useFamilyStore(s => s.hydrated);
  const tasks          = useFamilyStore(s => s.tasksByUser[user.id] ?? EMPTY_ITEMS);
  const level          = useFamilyStore(s => s.levelsByUser[user.id]);
  const completed      = useFamilyStore(s => s.todayCompletions[user.id] ?? EMPTY_ITEMS);
  const completionsByWindow = useFamilyStore(
    s => s.todayCompletionsByWindow[user.id] ?? EMPTY_WINDOWS,
  );
  const coupons        = useFamilyStore(s => s.couponsByUser[user.id] ?? EMPTY_ITEMS);
  const momentum       = useFamilyStore(s => s.momentumByUser[user.id]) ?? emptyMomentum();
  const timeOfDay      = useFamilyStore(s => s.timeOfDay);
  const routineAvailability = useFamilyStore(s => s.routineAvailability);
  const automaticSaleActive = useFamilyStore(s => s.automaticSaleStatus.active);
  const doRedeemReward = useFamilyStore(s => s.redeemReward);
  const doRedeemCoupon = useFamilyStore(s => s.redeemPerfectDayCoupon);
  const doTransferCoupon = useFamilyStore(s => s.transferPerfectDayCoupon);
  const allUsers       = useFamilyStore(s => s.users);
  const activities     = useFamilyStore(s => s.activitiesByUser[user.id] ?? EMPTY_ITEMS);
  const perfectQuest   = useFamilyStore(s => s.perfectQuestByUser[user.id]);

  const [storeOpen, setStoreOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [couponOpen, setCouponOpen] = useState(false);
  const [routineView, setRoutineView] = useState<'current' | 'reference'>('current');

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
  const mailboxActivities = activities.filter(activity =>
    MAILBOX_ACTIVITY_TYPES.has(activity.type) && !isObserverRewardActivity(activity)
  );
  const hasRecentUnreadActivity = mailboxActivities.some(activity => {
    const created = activity.createdAt.getTime();
    return created >= recentCutoff && created > activityReadAt;
  });
  const giftReceivers = allUsers
    .filter(member => member.id !== user.id)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const isTaskCurrent = (task: { timeWindow?: string | null }) => {
    return isTaskActiveInTimeWindow(task.timeWindow, timeOfDay);
  };
  const currentTasks = tasks.filter(isTaskCurrent);
  const referenceWindow = timeOfDay === 'morning' ? 'evening' : 'morning';
  const referenceTasks = tasks.filter(task => isTaskActiveInTimeWindow(task.timeWindow, referenceWindow));
  const morningTasks = tasks.filter(task => isTaskActiveInTimeWindow(task.timeWindow, 'morning'));
  const eveningTasks = tasks.filter(task => isTaskActiveInTimeWindow(task.timeWindow, 'evening'));
  const morningDone = morningTasks.filter(task => completionsByWindow.morning.includes(task.id)).length;
  const eveningDone = eveningTasks.filter(task => completionsByWindow.evening.includes(task.id)).length;
  // Tasks stay in their original position when completed — checking off a
  // habit shouldn't re-shuffle the layout. Only sort by time window so the
  // morning/afternoon/evening grouping stays stable.
  const sortedTasks = [...currentTasks].sort((a, b) => {
    return taskWindowSortRank(a.timeWindow) - taskWindowSortRank(b.timeWindow);
  });
  const sortedReferenceTasks = [...referenceTasks].sort((a, b) => {
    return taskWindowSortRank(a.timeWindow) - taskWindowSortRank(b.timeWindow);
  });
  const visibleTasks = routineView === 'current' ? sortedTasks : sortedReferenceTasks;
  const selectedWindow = routineView === 'current' ? timeOfDay : referenceWindow;
  const strictChildDeadline = user.role === 'CHILD' && !automaticSaleActive;
  const childDeadlinePassed = strictChildDeadline && !routineAvailability[timeOfDay];

  const selectRoutine = (window: 'morning' | 'evening') => {
    setRoutineView(timeOfDay === window ? 'current' : 'reference');
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  };

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
  }, [visibleTasks.length, timeOfDay, routineView, updateScrollHint]);

  if (!hydrated) return <PanelSkeleton theme={user.theme} />;

  const showMore  = hasOverflow && !atBottom;

  const doneCount  = currentTasks.filter(task => completed.includes(task.id)).length;
  const totalCount = currentTasks.length;
  const morningPct = morningTasks.length ? Math.round((morningDone / morningTasks.length) * 100) : 0;
  const eveningPct = eveningTasks.length ? Math.round((eveningDone / eveningTasks.length) * 100) : 0;
  const allDone    = totalCount > 0 && doneCount === totalCount;
  const availableCouponCount = coupons.filter(coupon => coupon.status === 'available').length;

  const totalXp        = level?.totalPoints ?? 0;
  const levelProgress  = computeLevelProgress(totalXp);
  const displayLevel   = level?.currentLevel ?? levelProgress.level;
  const progressPct    = Math.round(levelProgress.progressToNext * 100);
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
      {couponOpen && (
        <PerfectDayCouponModal
          user={user}
          coupons={coupons}
          recipients={allUsers.filter(member => member.id !== user.id)}
          progress={perfectQuest ?? {
            userId: user.id,
            currentDay: 0,
            currentStreak: 0,
            bestStreak: 0,
            completedQuests: 0,
            nextRewardCount: 1,
            weekPerfectDays: 0,
            weekdayGoal: 3,
            weekdayTotal: 5,
            rewardEarnedThisWeek: false,
            weekendPerfectDays: 0,
            weekendGoal: 2,
            weekendTotal: 2,
            weekendRewardEarnedThisWeek: false,
          }}
          onClose={() => setCouponOpen(false)}
          onRedeem={(couponId, kind) => doRedeemCoupon(couponId, user.id, kind)}
          onTransfer={(couponId, recipientId, message) => doTransferCoupon(couponId, user.id, recipientId, message)}
        />
      )}
      <section
        data-theme={user.theme}
        aria-label={user.name}
        className="member-panel flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] md:min-h-0 md:h-full"
        style={{
          padding: 10,
          boxShadow: allDone
            ? 'var(--shadow), inset 0 0 0 2px var(--success)'
            : 'var(--shadow)',
          transition: 'box-shadow 0.8s ease',
        }}
      >
        {/* ── Header ── */}
        <header className="member-header mb-2 shrink-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2">
            <div className="flex min-w-0 basis-full items-center gap-2.5 md:min-w-[100px] md:flex-1 md:basis-0">
              <div className="relative h-10 w-10 shrink-0">
                {avatarSrc ? (
                  <Image
                    src={avatarSrc}
                    alt={user.name}
                    width={40}
                    height={40}
                    referrerPolicy="no-referrer"
                    className="h-10 w-10 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-glow)] text-base font-bold text-[var(--accent)] select-none">
                    {user.name[0]}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 overflow-hidden pr-0.5">
                <h2 className="min-w-0 truncate text-lg font-bold leading-tight md:text-base">{user.name}</h2>
                {/* Keep progression secondary to the member name and tasks. */}
                <div className="mt-0.5 flex min-w-0 items-center gap-1.5 overflow-hidden text-[10px] font-semibold text-[var(--fg-muted)] max-[380px]:gap-1 max-[380px]:text-[8px]">
                  <span
                    className="shrink-0"
                    title={`Level — long-term identity tier. Unlocks shield slots and profile frames.`}
                  >
                    Lv.{displayLevel}
                  </span>
                  <span className="h-1 w-1 shrink-0 rounded-full bg-[var(--fg-muted)]/40 max-[380px]:hidden" />
                  <span
                    className="min-w-0 truncate max-[380px]:hidden"
                    title={`XP earned. ${levelProgress.pointsInLevel}/${levelProgress.pointsToNext} to Lv.${displayLevel + 1}`}
                  >
                    {formatXp(totalXp)}xp
                  </span>
                  <span className="h-1 w-1 shrink-0 rounded-full bg-[var(--fg-muted)]/40 max-[380px]:hidden" />
                  <div className="max-[380px]:hidden">
                    <MomentumAura momentum={momentum} size={14} showLabel />
                  </div>
                </div>

                {/* Thin XP-to-next-level bar. Title attribute is the tooltip. */}
                <div
                  className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--border)] max-[380px]:mt-0.5"
                  title={`${levelProgress.pointsInLevel}/${levelProgress.pointsToNext} XP to Lv.${displayLevel + 1}`}
                >
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
              <span className="member-shields shrink-0"><EquippedInsigniaStrip userId={user.id} /></span>
            </div>

            <div className="member-actions flex w-full shrink-0 items-center justify-between gap-1.5 md:w-auto md:justify-end">
              <PerfectQuestChip
                progress={perfectQuest ?? {
                  userId: user.id,
                  currentDay: 0,
                  currentStreak: 0,
                  bestStreak: 0,
                  completedQuests: 0,
                  nextRewardCount: 1,
                  weekPerfectDays: 0,
                  weekdayGoal: 3,
                  weekdayTotal: 5,
                  rewardEarnedThisWeek: false,
                  weekendPerfectDays: 0,
                  weekendGoal: 2,
                  weekendTotal: 2,
                  weekendRewardEarnedThisWeek: false,
                }}
                morningComplete={morningTasks.length > 0 && morningDone === morningTasks.length}
                eveningComplete={eveningTasks.length > 0 && eveningDone === eveningTasks.length}
                availableCouponCount={availableCouponCount}
                onOpenWallet={() => setCouponOpen(true)}
              />
              <button
                type="button"
                onClick={() => setGiftOpen(true)}
                disabled={giftReceivers.length === 0}
                className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--fg)] transition hover:bg-[var(--accent-glow)] active:scale-95 disabled:opacity-35"
                title={t('gift')}
                aria-label={t('gift')}
              >
                <HeartHandshake size={18} className="text-[var(--accent)]" />
              </button>
              <button
                type="button"
                onClick={openActivityFeed}
                className="relative grid h-11 w-11 place-items-center rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--fg)] transition hover:bg-[var(--accent-glow)] active:scale-95"
                title={t('mailbox_history')}
                aria-label={t('mailbox_history')}
              >
                <Mail size={18} className="text-[var(--accent)]" />
                {hasRecentUnreadActivity && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[var(--bg)]" />
                )}
              </button>
              <button
                type="button"
                onClick={openStore}
                className="flex h-11 min-w-[78px] items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--accent-glow)] px-2 text-[var(--fg)] transition hover:brightness-110 active:scale-95"
                title={`${t('store')} · ${lang === 'en' ? 'Current points' : '현재 포인트'}`}
                aria-label={lang === 'en' ? `Open store, ${spendableBalance} current points` : `상점 열기, 현재 ${spendableBalance}포인트`}
              >
                <Store size={18} className="shrink-0 text-[var(--accent)]" aria-hidden />
                <span className="text-left leading-tight">
                  <span className="block text-[10px] font-semibold text-[var(--fg)]">{t('store')}</span>
                  <span className="block text-sm font-bold tabular-nums">{spendableBalance}<span className="ml-0.5 text-[10px] font-medium">pt</span></span>
                </span>
              </button>
            </div>
          </div>
        </header>

        <div
          className="mb-1.5 grid h-8 shrink-0 grid-cols-2 gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-px"
          role="tablist"
          onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const window = event.key === 'Home' ? 'morning' : event.key === 'End' ? 'evening' : selectedWindow === 'morning' ? 'evening' : 'morning';
            selectRoutine(window);
            event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[window === 'morning' ? 0 : 1]?.focus();
          }}
          aria-label={lang === 'en' ? `${user.name}'s routine view` : `${user.name}의 루틴 보기`}
        >
          <button
            type="button"
            role="tab"
            id={`${routineId}-morning`}
            aria-controls={`${routineId}-tasks`}
            tabIndex={selectedWindow === 'morning' ? 0 : -1}
            aria-selected={selectedWindow === 'morning'}
            aria-label={lang === 'en'
              ? `Morning ${morningDone} of ${morningTasks.length}${timeOfDay !== 'morning' ? ', reference only' : ''}`
              : `오전 ${morningDone}/${morningTasks.length}${timeOfDay !== 'morning' ? ', 보기 전용' : ''}`}
            onClick={() => selectRoutine('morning')}
            className={[
              'relative flex min-w-0 items-center justify-center gap-1.5 overflow-hidden rounded-lg px-2 pb-0.5 text-xs font-bold max-[380px]:gap-1 max-[380px]:text-[11px] tabular-nums transition',
              selectedWindow === 'morning'
                ? timeOfDay === 'morning'
                  ? 'bg-[var(--accent)] text-gray-950 shadow-sm'
                  : 'bg-[var(--bg)] text-[var(--fg)] shadow-sm ring-1 ring-inset ring-[var(--border)]'
                : 'text-[var(--fg-muted)] hover:bg-[var(--bg)]',
            ].join(' ')}
          >
            <Sunrise size={15} className="shrink-0" />
            <span className="whitespace-nowrap">{lang === 'en' ? 'Morning' : '오전'}</span>
            <span>{morningDone}/{morningTasks.length}</span>
            {timeOfDay !== 'morning' && <Eye size={11} className="ml-0.5 shrink-0 opacity-55 max-[380px]:hidden" aria-hidden />}
            <span className="absolute inset-x-2 bottom-0 h-0.5 overflow-hidden rounded-full bg-current/15" aria-hidden>
              <span className="block h-full rounded-full bg-current transition-[width] duration-500" style={{ width: `${morningPct}%` }} />
            </span>
          </button>
          <button
            type="button"
            role="tab"
            id={`${routineId}-evening`}
            aria-controls={`${routineId}-tasks`}
            tabIndex={selectedWindow === 'evening' ? 0 : -1}
            aria-selected={selectedWindow === 'evening'}
            aria-label={lang === 'en'
              ? `Evening ${eveningDone} of ${eveningTasks.length}${timeOfDay !== 'evening' ? ', reference only' : ''}`
              : `오후·저녁 ${eveningDone}/${eveningTasks.length}${timeOfDay !== 'evening' ? ', 보기 전용' : ''}`}
            onClick={() => selectRoutine('evening')}
            className={[
              'relative flex min-w-0 items-center justify-center gap-1.5 overflow-hidden rounded-lg px-2 pb-0.5 text-xs font-bold max-[380px]:gap-1 max-[380px]:text-[11px] tabular-nums transition',
              selectedWindow === 'evening'
                ? timeOfDay === 'evening'
                  ? 'bg-[var(--accent)] text-gray-950 shadow-sm'
                  : 'bg-[var(--bg)] text-[var(--fg)] shadow-sm ring-1 ring-inset ring-[var(--border)]'
                : 'text-[var(--fg-muted)] hover:bg-[var(--bg)]',
            ].join(' ')}
          >
            <MoonStar size={15} className="shrink-0" />
            <span className="whitespace-nowrap">{lang === 'en' ? 'Evening' : '오후·저녁'}</span>
            <span>{eveningDone}/{eveningTasks.length}</span>
            {timeOfDay !== 'evening' && <Eye size={11} className="ml-0.5 shrink-0 opacity-55 max-[380px]:hidden" aria-hidden />}
            <span className="absolute inset-x-2 bottom-0 h-0.5 overflow-hidden rounded-full bg-current/15" aria-hidden>
              <span className="block h-full rounded-full bg-current transition-[width] duration-500" style={{ width: `${eveningPct}%` }} />
            </span>
          </button>
        </div>

        <div className={routineView === 'reference' || childDeadlinePassed ? 'mb-1.5 flex shrink-0 items-center text-[10px] font-medium text-[var(--fg-muted)]' : 'sr-only'} aria-live="polite">
          <span className="flex items-center gap-1">
            {routineView === 'reference' ? <Eye size={13} /> : allDone ? <CheckCircle2 size={13} className="text-[var(--success)]" /> : null}
            {routineView === 'reference'
              ? (lang === 'en' ? 'View only' : '보기 전용')
              : allDone ? (lang === 'en' ? 'All done. Well done!' : '모두 완료했어요. 멋져요!')
                : childDeadlinePassed ? (lang === 'en' ? 'This routine has closed' : '이번 루틴이 마감됐어요')
                  : ''}
          </span>
        </div>

        {/* Mobile uses page scrolling; the shared screen scrolls inside each panel. */}
        <div className="relative md:min-h-0 md:flex-1">

          {/* Scrollable task list */}
          <div
            ref={scrollRef}
            id={`${routineId}-tasks`}
            role="tabpanel"
            aria-labelledby={`${routineId}-${selectedWindow}`}
            tabIndex={0}
            onScroll={updateScrollHint}
            className="member-task-scroll md:absolute md:inset-0 md:overflow-y-auto"
          >
            <motion.div
              ref={listRef}
              layout
              className="member-task-grid grid auto-rows-[80px] grid-cols-1 gap-2 min-[480px]:grid-cols-2 md:auto-rows-[64px] md:gap-1.5 md:pb-12"
            >
              {visibleTasks.length === 0 && (
                <div className="col-span-full text-center text-[var(--fg-muted)] py-8 text-sm">
                  {routineView === 'current'
                    ? t('no_tasks_today')
                    : (lang === 'en' ? 'No routines scheduled in this window' : '이 시간대에 예정된 루틴이 없어요')}
                </div>
              )}
              {visibleTasks.map((task, i) => (
                <motion.div
                  key={task.id}
                  layout
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className={visibleTasks.length % 2 !== 0 && i === visibleTasks.length - 1 ? 'col-span-full' : ''}
                >
                  {routineView === 'current' ? (
                    <TaskCard
                      task={task}
                      completed={completed.includes(task.id)}
                      theme={user.theme}
                      disabled={!isTaskCurrent(task) || childDeadlinePassed}
                      disabledReason={childDeadlinePassed ? 'deadline' : undefined}
                      timeWindowDisplay={getTimeWindowDisplay(task.timeWindow, lang, strictChildDeadline)}
                    />
                  ) : (
                    <RoutineReferenceCard
                      task={task}
                      completed={completionsByWindow[referenceWindow].includes(task.id)}
                      theme={user.theme}
                      referenceWindow={referenceWindow}
                    />
                  )}
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Gradient fade — always mounted, opacity driven by showMore */}
          <motion.div
            initial={false}
            animate={{ opacity: showMore ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-x-0 bottom-0 hidden h-8 pointer-events-none md:block bg-gradient-to-t from-[var(--bg)] to-transparent md:h-8"
          />

          {/* Small non-blocking hint keeps the task cards tappable. */}
          <AnimatePresence>
            {showMore && (
              <motion.div
                key="more-badge"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute bottom-0 left-1/2 hidden -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1 text-[10px] font-semibold text-[var(--fg-muted)] md:flex"
              >
                <ArrowDown size={12} aria-hidden />
                {lang === 'en' ? 'Scroll for more' : '아래로 내려 더 보기'}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </>
  );
}
