'use client';

import { useCallback, useEffect, useState, useRef, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { ArrowDown, ArrowRight, CheckCircle2, Eye, HeartHandshake, Mail, MoonStar, Sparkles, Store, Sunrise } from 'lucide-react';
import { Reward, Task, User } from '@/lib/db';
import { TaskCard } from './TaskCard';
import { EquippedShields } from './EquippedShields';
import { useFamilyStore } from '@/lib/store';
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
} from '@/lib/timeWindows';
import { isOptionalTask, requiredTasks, summarizeTaskDay } from '@/lib/taskType';

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
      className="member-panel bg-[var(--bg)] text-[var(--fg)] flex flex-col min-h-[480px] md:min-h-0 md:h-full overflow-hidden"
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
  const [bonusView, setBonusView] = useState(false);

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
  // Routine progress counts required tasks only; bonus tasks are tallied
  // separately so skipping them never lowers "3/4".
  const requiredToday = requiredTasks(tasks);
  const morningTasks = requiredToday.filter(task => isTaskActiveInTimeWindow(task.timeWindow, 'morning'));
  const eveningTasks = requiredToday.filter(task => isTaskActiveInTimeWindow(task.timeWindow, 'evening'));
  const morningDone = morningTasks.filter(task => completionsByWindow.morning.includes(task.id)).length;
  const eveningDone = eveningTasks.filter(task => completionsByWindow.evening.includes(task.id)).length;
  // The selected window already filters the list. Honor the saved routine
  // order, including habits shared by both windows, even after completion.
  const sortedTasks = [...currentTasks].sort((a, b) => {
    return a.sortOrder - b.sortOrder;
  });
  const sortedReferenceTasks = [...referenceTasks].sort((a, b) => {
    return a.sortOrder - b.sortOrder;
  });
  const visibleTasks = routineView === 'current' ? sortedTasks : sortedReferenceTasks;
  const selectedWindow = routineView === 'current' ? timeOfDay : referenceWindow;
  // Bonus tasks are day-scoped and live in their own tab; the morning and
  // evening tabs only ever list required routines.
  const bonusToday = tasks.filter(isOptionalTask).sort((a, b) => a.sortOrder - b.sortOrder);
  const hasBonus = bonusToday.length > 0;
  const showBonus = bonusView && hasBonus;
  const bonusSummary = summarizeTaskDay(bonusToday, completed);
  const bonusLeft = bonusToday.length - bonusSummary.bonusDone;
  const activeTab = showBonus ? 'bonus' : selectedWindow;
  const listTasks = showBonus ? bonusToday : visibleTasks.filter(task => !isOptionalTask(task));
  const strictChildDeadline = user.role === 'CHILD' && !automaticSaleActive;
  const childDeadlinePassed = strictChildDeadline && !routineAvailability[timeOfDay];

  const selectRoutine = (window: 'morning' | 'evening') => {
    setBonusView(false);
    setRoutineView(timeOfDay === window ? 'current' : 'reference');
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  };

  const selectBonus = () => {
    setBonusView(true);
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
  }, [listTasks.length, timeOfDay, routineView, showBonus, updateScrollHint]);

  if (!hydrated) return <PanelSkeleton theme={user.theme} />;

  const showMore  = hasOverflow && !atBottom;

  const currentRequired = requiredTasks(currentTasks);
  const doneCount  = currentRequired.filter(task => completed.includes(task.id)).length;
  const totalCount = currentRequired.length;
  const morningPct = morningTasks.length ? Math.round((morningDone / morningTasks.length) * 100) : 0;
  const eveningPct = eveningTasks.length ? Math.round((eveningDone / eveningTasks.length) * 100) : 0;
  const allDone    = totalCount > 0 && doneCount === totalCount;
  const availableCouponCount = coupons.filter(coupon => coupon.status === 'available').length;

  const avatarSrc = user.avatarUrl
    ? `${user.avatarUrl}${user.avatarUrl.includes('?') ? '&' : '?'}v=${avatarVersion}`
    : null;

  const renderTask = (task: Task, i: number, count: number) => (
    <motion.div
      key={task.id}
      layout
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={count % 2 !== 0 && i === count - 1 ? 'col-span-full' : ''}
    >
      {routineView === 'current' || showBonus ? (
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
  );

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
      >
        {/* ── Header ── */}
        <header className="member-header mb-3 shrink-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2">
            <div className="flex min-w-0 basis-full items-center gap-2.5 md:min-w-[100px] md:flex-1 md:basis-0">
              <div className="member-avatar relative h-10 w-10 shrink-0">
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
                <div className="flex min-w-0 items-center gap-1.5">
                  <h2 className="min-w-0 truncate text-lg font-bold leading-tight tracking-tight">{user.name}</h2>
                  {allDone && <CheckCircle2 size={15} className="shrink-0 text-[var(--accent)]" aria-label={lang === 'en' ? 'All routines complete' : '루틴 모두 완료'} />}
                </div>
              </div>
              <span className="member-shields shrink-0"><EquippedShields userId={user.id} showcase /></span>
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
                <HeartHandshake size={18} className="text-[var(--fg-secondary)]" />
              </button>
              <button
                type="button"
                onClick={openActivityFeed}
                className="relative grid h-11 w-11 place-items-center rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--fg)] transition hover:bg-[var(--accent-glow)] active:scale-95"
                title={t('mailbox_history')}
                aria-label={t('mailbox_history')}
              >
                <Mail size={18} className="text-[var(--fg-secondary)]" />
                {hasRecentUnreadActivity && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[var(--bg)]" />
                )}
              </button>
              <button
                type="button"
                onClick={openStore}
                className="flex h-11 min-w-[78px] items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-2 text-[var(--fg)] transition hover:brightness-110 active:scale-95"
                title={`${t('store')} · ${lang === 'en' ? 'Current points' : '현재 포인트'}`}
                aria-label={lang === 'en' ? `Open store, ${spendableBalance} current points` : `상점 열기, 현재 ${spendableBalance}포인트`}
              >
                <Store size={18} className="shrink-0 text-[var(--fg-secondary)]" aria-hidden />
                <span className="text-left leading-tight">
                  <span className="block text-[10px] font-semibold text-[var(--fg)]">{t('store')}</span>
                  <span className="block text-sm font-bold tabular-nums text-[var(--success)]">{spendableBalance}<span className="ml-0.5 text-[10px] font-medium">pt</span></span>
                </span>
              </button>
            </div>
          </div>
        </header>

        <div
          className={`member-routine-tabs mb-2 grid h-9 shrink-0 gap-1 rounded-xl border border-[var(--border)] p-1 ${hasBonus ? 'grid-cols-3' : 'grid-cols-2'}`}
          role="tablist"
          onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const order = hasBonus ? ['morning', 'evening', 'bonus'] as const : ['morning', 'evening'] as const;
            const current = order.indexOf(activeTab as never);
            const nextIndex = event.key === 'Home' ? 0
              : event.key === 'End' ? order.length - 1
                : (current + (event.key === 'ArrowRight' ? 1 : order.length - 1)) % order.length;
            const next = order[nextIndex];
            if (next === 'bonus') selectBonus();
            else selectRoutine(next);
            event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus();
          }}
          aria-label={lang === 'en' ? `${user.name}'s routine view` : `${user.name}의 루틴 보기`}
        >
          <button
            type="button"
            role="tab"
            id={`${routineId}-morning`}
            aria-controls={`${routineId}-tasks`}
            tabIndex={activeTab === 'morning' ? 0 : -1}
            aria-selected={activeTab === 'morning'}
            aria-label={lang === 'en'
              ? `Morning ${morningDone} of ${morningTasks.length}${timeOfDay !== 'morning' ? ', reference only' : ''}`
              : `오전 ${morningDone}/${morningTasks.length}${timeOfDay !== 'morning' ? ', 보기 전용' : ''}`}
            onClick={() => selectRoutine('morning')}
            className={[
              'relative flex min-w-0 items-center justify-center gap-1.5 overflow-hidden rounded-lg px-2 pb-0.5 text-xs font-bold max-[380px]:gap-1 max-[380px]:text-[11px] tabular-nums transition',
              activeTab === 'morning'
                ? 'text-[var(--accent)]'
                : 'text-[var(--fg-muted)] hover:bg-[var(--bg-card)]',
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
            tabIndex={activeTab === 'evening' ? 0 : -1}
            aria-selected={activeTab === 'evening'}
            aria-label={lang === 'en'
              ? `Evening ${eveningDone} of ${eveningTasks.length}${timeOfDay !== 'evening' ? ', reference only' : ''}`
              : `오후·저녁 ${eveningDone}/${eveningTasks.length}${timeOfDay !== 'evening' ? ', 보기 전용' : ''}`}
            onClick={() => selectRoutine('evening')}
            className={[
              'relative flex min-w-0 items-center justify-center gap-1.5 overflow-hidden rounded-lg px-2 pb-0.5 text-xs font-bold max-[380px]:gap-1 max-[380px]:text-[11px] tabular-nums transition',
              activeTab === 'evening'
                ? 'text-[var(--accent)]'
                : 'text-[var(--fg-muted)] hover:bg-[var(--bg-card)]',
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
          {hasBonus && (
            <button
              type="button"
              role="tab"
              id={`${routineId}-bonus`}
              data-bonus-tab
              aria-controls={`${routineId}-tasks`}
              tabIndex={activeTab === 'bonus' ? 0 : -1}
              aria-selected={activeTab === 'bonus'}
              aria-label={lang === 'en'
                ? `Bonus, ${bonusSummary.bonusDone} of ${bonusToday.length} done, ${bonusSummary.bonusPointsEarned} points earned`
                : `보너스, ${bonusToday.length}개 중 ${bonusSummary.bonusDone}개 완료, ${bonusSummary.bonusPointsEarned}포인트 획득`}
              onClick={selectBonus}
              className={[
                'relative flex min-w-0 items-center justify-center gap-1.5 overflow-hidden rounded-lg px-2 pb-0.5 text-xs font-bold max-[380px]:gap-1 max-[380px]:text-[11px] tabular-nums transition',
                activeTab === 'bonus'
                  ? 'text-[var(--bonus)]'
                  : 'text-[var(--bonus)]/70 hover:bg-[var(--bg-card)]',
              ].join(' ')}
            >
              <Sparkles size={15} className="shrink-0" aria-hidden />
              <span className="whitespace-nowrap">{lang === 'en' ? 'Bonus' : '보너스'}</span>
              {/* Points earned, never a done/total score: skipping is fine. */}
              {bonusSummary.bonusPointsEarned > 0 && <span>+{bonusSummary.bonusPointsEarned}</span>}
            </button>
          )}
        </div>

        {!showBonus && routineView === 'current' && allDone && bonusLeft > 0 && !childDeadlinePassed && (
          <button
            type="button"
            onClick={selectBonus}
            className="mb-1.5 flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--bonus-badge-bg)] px-2.5 text-left text-[11px] font-bold text-[var(--bonus)] transition hover:brightness-125"
          >
            <CheckCircle2 size={13} className="shrink-0 text-[var(--success)]" aria-hidden />
            <span className="min-w-0 flex-1 truncate">
              {lang === 'en'
                ? `All done! ${bonusLeft} bonus ${bonusLeft === 1 ? 'task' : 'tasks'} waiting`
                : `모두 완료! 보너스 미션 ${bonusLeft}개 있어요`}
            </span>
            <ArrowRight size={13} className="shrink-0" aria-hidden />
          </button>
        )}

        <div className={showBonus || routineView === 'reference' || childDeadlinePassed ? 'mb-1.5 flex shrink-0 items-center text-[10px] font-medium text-[var(--fg-muted)]' : 'sr-only'} aria-live="polite">
          <span className="flex items-center gap-1">
            {showBonus ? <Sparkles size={13} className="text-[var(--bonus)]" /> : routineView === 'reference' ? <Eye size={13} /> : allDone ? <CheckCircle2 size={13} className="text-[var(--success)]" /> : null}
            {showBonus
              ? (childDeadlinePassed
                  ? (lang === 'en' ? 'Bonus tasks have closed for today' : '오늘 보너스 미션이 마감됐어요')
                  : (lang === 'en' ? 'Optional · do one any time today for extra points' : '선택 · 오늘 언제든 하면 추가 포인트'))
              : routineView === 'reference'
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
            aria-labelledby={`${routineId}-${activeTab}`}
            tabIndex={0}
            onScroll={updateScrollHint}
            className="member-task-scroll md:absolute md:inset-0 md:overflow-y-auto"
          >
            <motion.div
              ref={listRef}
              layout
              className="member-task-grid grid auto-rows-[68px] grid-cols-1 gap-1.5 min-[480px]:grid-cols-2 md:auto-rows-[60px] md:pb-6"
            >
              {listTasks.length === 0 && (
                <div className="col-span-full text-center text-[var(--fg-muted)] py-8 text-sm">
                  {routineView === 'current'
                    ? t('no_tasks_today')
                    : (lang === 'en' ? 'No routines scheduled in this window' : '이 시간대에 예정된 루틴이 없어요')}
                </div>
              )}
              {listTasks.map((task, i) => renderTask(task, i, listTasks.length))}
            </motion.div>
          </div>

          {/* Gradient fade — always mounted, opacity driven by showMore */}
          <motion.div
            initial={false}
            animate={{ opacity: showMore ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-x-0 bottom-0 hidden h-8 pointer-events-none md:block bg-gradient-to-t from-[var(--bg)] to-transparent md:h-8"
          />

          {/* Small non-blocking hint leaves room for task gestures. */}
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
