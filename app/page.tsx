'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Palmtree } from 'lucide-react';
import { DashboardHeader } from '@/components/DashboardHeader';
import { toast } from 'sonner';
import { MemberPanel } from '@/components/MemberPanel';
import { MobileMemberTabs } from '@/components/MobileMemberTabs';
import { CelebrationOverlay } from '@/components/CelebrationOverlay';
import { InsigniaUnlockOverlay } from '@/components/InsigniaUnlockOverlay';
import { PerfectDayCelebrationOverlay } from '@/components/PerfectDayCelebrationOverlay';
import { WeeklyRecapModal } from '@/components/WeeklyRecapModal';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { FamBitWordmark } from '@/components/FamBitLogo';
import { FamilyOnboardingChecklist } from '@/components/FamilyOnboardingChecklist';
import { useFamilyStore } from '@/lib/store';
import { createBrowserSupabase } from '@/lib/supabase';
import { clearFamilySessionStorage } from '@/lib/localSessionStorage';
import { familyHasAdminPin } from '@/lib/adminPin';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Dashboard() {
  const router = useRouter();
  const { t } = useLanguage();
  const {
    users, hydrate, celebration, dismissCelebration, soundEnabled, toggleSound,
    penaltyPauseEnabled, togglePenaltyPause,
  } = useFamilyStore();
  const hydrated  = useFamilyStore(s => s.hydrated);
  const currentMemberCanAdmin = useFamilyStore(s => s.currentMemberCanAdmin);
  const familyId  = useFamilyStore(s => s.familyId);
  const familyName = useFamilyStore(s => s.familyName);
  const weeklyRecapByUser = useFamilyStore(s => s.weeklyRecapByUser);
  const perfectDayAward = useFamilyStore(s => s.perfectDayQueue[0] ?? null);
  const dismissPerfectDayAward = useFamilyStore(s => s.dismissPerfectDayAward);
  const [recapDismissedKey, setRecapDismissedKey] = useState<string | null>(null);
  const [penaltyPauseToggling, setPenaltyPauseToggling] = useState(false);
  // authReady starts as false on every mount — the blank screen is shown until
  // hydrate() finishes verifying the session. This is the primary guard against
  // stale Zustand state flashing on Back-button or cross-user navigation.
  const [authReady, setAuthReady] = useState(false);
  const [authProfile, setAuthProfile] = useState<{ email: string | null; avatarUrl: string | null }>({
    email: null,
    avatarUrl: null,
  });
  const [now, setNow] = useState(() => new Date());
  const [currentPage, setCurrentPage] = useState(0);
  const [activeMobileUserId, setActiveMobileUserId] = useState<string | null>(null);

  const resetAndHydrate = useCallback(async () => {
    setAuthReady(false);
    setAuthProfile({ email: null, avatarUrl: null });
    useFamilyStore.setState({
      hydrated: false, familyId: null, familyName: null, users: [], rewards: [],
      activeTaskCount: 0,
      tasksByUser: {}, activitiesByUser: {}, levelsByUser: {}, todayCompletions: {},
      todayCompletionsByWindow: {}, couponsByUser: {}, perfectQuestByUser: {}, perfectDayQueue: [],
      dailyStreakByUser: {}, dailyStreakAtRiskByUser: {}, weeklyRecapByUser: {},
    });
    try {
      const supabase = createBrowserSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setAuthProfile({
          email: user.email ?? null,
          avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null,
        });
      }
      const { data: resolvedFamilyId } = await supabase.rpc('get_my_family_id');
      if (resolvedFamilyId && !await familyHasAdminPin()) {
        router.replace('/setup/set-pin');
        return;
      }
      await hydrate();
    } finally {
      setAuthReady(true);
    }
  }, [hydrate, router]);

  // On every mount: clear stale state then verify session
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      resetAndHydrate().catch(console.error);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [resetAndHydrate]);

  // Handle browser Back/Forward cache: page is restored from bfcache without
  // remounting React, so useEffect/useState don't reset — catch it with pageshow.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) resetAndHydrate().catch(console.error);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [resetAndHydrate]);

  useEffect(() => {
    if (authReady && hydrated && familyId === null) {
      router.replace('/setup');
    }
  }, [authReady, hydrated, familyId, router]);

  const handleLogout = async () => {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    clearFamilySessionStorage();
    useFamilyStore.setState({
      hydrated: false, familyId: null, familyName: null, users: [], rewards: [],
      activeTaskCount: 0,
      tasksByUser: {}, activitiesByUser: {}, levelsByUser: {}, todayCompletions: {},
      todayCompletionsByWindow: {}, couponsByUser: {}, perfectQuestByUser: {}, perfectDayQueue: [],
      dailyStreakByUser: {}, dailyStreakAtRiskByUser: {}, weeklyRecapByUser: {},
    });
    router.replace('/login');
  };

  const handleTogglePenaltyPause = async () => {
    if (penaltyPauseToggling) return;
    setPenaltyPauseToggling(true);
    try {
      await togglePenaltyPause();
      const nowEnabled = useFamilyStore.getState().penaltyPauseEnabled;
      toast.success(nowEnabled ? t('vacation_mode_on_toast') : t('vacation_mode_off_toast'));
    } catch (error) {
      console.error('Failed to toggle penalty pause', error);
      toast.error(t('vacation_mode_update_failed'));
    } finally {
      setPenaltyPauseToggling(false);
    }
  };

  useEffect(() => {
    const ch = new BroadcastChannel('habit_sync');
    ch.onmessage = () => {
      hydrate().catch(console.error);
    };
    return () => ch.close();
  }, [hydrate]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const recapEntries = useMemo(() => {
    return users
      .map(user => {
        const recap = weeklyRecapByUser[user.id];
        return recap ? { user, recap } : null;
      })
      .filter((entry): entry is { user: typeof users[number]; recap: NonNullable<typeof weeklyRecapByUser[string]> } => entry !== null)
      // Only include members who actually have anything happening this/last week.
      .filter(entry => entry.recap.weekDone > 0 || (entry.recap.lastWeekPct ?? 0) > 0)
      .sort((a, b) => a.user.displayOrder - b.user.displayOrder);
  }, [users, weeklyRecapByUser]);

  // Derived recap trigger — no setState-in-effect needed. Show on Mon/Tue/Wed for the
  // most recently completed ISO week, once per family per week.
  const recapWeekKey = recapEntries[0]?.recap.weekStartISO ?? null;
  const dow = now.getDay();
  const isRecapWindow = dow === 1 || dow === 2 || dow === 3;
  const recapStorageKey = familyId ? `family_weekly_recap_seen_${familyId}` : null;
  const persistedSeenKey =
    typeof window !== 'undefined' && recapStorageKey ? localStorage.getItem(recapStorageKey) : null;
  const recapOpen = Boolean(
    hydrated &&
    familyId &&
    isRecapWindow &&
    recapWeekKey &&
    recapEntries.length > 0 &&
    persistedSeenKey !== recapWeekKey &&
    recapDismissedKey !== recapWeekKey,
  );

  const dismissRecap = useCallback(() => {
    if (recapStorageKey && recapWeekKey && typeof window !== 'undefined') {
      localStorage.setItem(recapStorageKey, recapWeekKey);
    }
    setRecapDismissedKey(recapWeekKey);
  }, [recapStorageKey, recapWeekKey]);

  // Desktop 2x2 grid keeps the bottom row slightly taller for longer child task lists,
  // while giving the top row enough room to show three rows of habit cards.
  const orderedUsers = [...users].sort((a, b) => {
    const roleRank = (r: typeof a.role) => (r === 'PARENT' ? 0 : 1);
    const role = roleRank(a.role) - roleRank(b.role);
    if (role !== 0) return role;
    const displayOrder = a.displayOrder - b.displayOrder;
    if (displayOrder !== 0) return displayOrder;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  const pageCount = Math.max(1, Math.ceil(orderedUsers.length / 4));
  const activePage = Math.min(currentPage, pageCount - 1);
  const desktopPageUsers = orderedUsers.slice(activePage * 4, activePage * 4 + 4);
  const desktopSlots = Array.from({ length: 4 }, (_, index) => desktopPageUsers[index] ?? null);
  const activeMobileUser = orderedUsers.find(user => user.id === activeMobileUserId) ?? orderedUsers[0] ?? null;

  const goToPrevPage = () => setCurrentPage(page => Math.max(0, page - 1));
  const goToNextPage = () => setCurrentPage(page => Math.min(pageCount - 1, page + 1));

  // Show blank screen until auth is verified for THIS render cycle.
  // familyId === null check is handled by the redirect useEffect above.
  if (!authReady || !hydrated || familyId === null) {
    return <div className="min-h-screen bg-[#0D0E1C]" />;
  }

  return (
    <div className="dashboard-shell flex min-h-dvh flex-col bg-[#0D0E1C] md:fixed md:inset-0 md:h-dvh md:overflow-hidden">

      <DashboardHeader
        familyName={familyName}
        authProfile={authProfile}
        soundEnabled={soundEnabled}
        toggleSound={toggleSound}
        canAdmin={currentMemberCanAdmin}
        penaltyPauseEnabled={penaltyPauseEnabled}
        penaltyPauseToggling={penaltyPauseToggling}
        onTogglePenaltyPause={() => { void handleTogglePenaltyPause(); }}
        onLogout={() => { void handleLogout(); }}
        activePage={activePage}
        pageCount={pageCount}
        onPreviousPage={goToPrevPage}
        onNextPage={goToNextPage}
      />

      {penaltyPauseEnabled && (
        <div className="flex shrink-0 items-center justify-center gap-1.5 border-b border-[#4EEDB0]/25 bg-[#4EEDB0]/12 px-3 py-1.5 text-center text-[11px] font-bold text-[#4EEDB0] md:text-[12px]">
          <Palmtree size={14} className="shrink-0" />
          <span>{t('vacation_mode_banner')}</span>
        </div>
      )}

      <main className="flex flex-1 flex-col gap-3 px-3 pb-[max(16px,env(safe-area-inset-bottom))] md:hidden">
        <MobileMemberTabs
          users={orderedUsers}
          activeUserId={activeMobileUser?.id ?? null}
          onSelectUser={userId => {
            setActiveMobileUserId(userId);
            window.scrollTo({ top: 0, behavior: 'instant' });
          }}
        />
        <FamilyOnboardingChecklist />
        <div id="mobile-member-panel" role="tabpanel" aria-labelledby={activeMobileUser ? `mobile-member-${activeMobileUser.id}` : undefined}>
          {activeMobileUser && <MemberPanel key={activeMobileUser.id} user={activeMobileUser} />}
        </div>
      </main>

      <main className="hidden flex-1 min-h-0 flex-col gap-3 overflow-hidden bg-[#0D0E1C] p-3 md:flex">
        <FamilyOnboardingChecklist />
        <div className="dashboard-grid grid min-h-0 flex-1 grid-cols-2 grid-rows-[minmax(0,9fr)_minmax(0,10fr)] gap-3 overflow-hidden">
          {desktopSlots.map((user, index) =>
            user ? (
              <MemberPanel key={user.id} user={user} />
            ) : (
              <div
                key={`empty-${activePage}-${index}`}
                className="grid min-h-0 place-items-center rounded-lg border border-dashed border-white/8 bg-[#111224]/60"
              >
                <div className="flex flex-col items-center gap-2 opacity-40">
                  <FamBitWordmark markSize={28} showText={false} />
                  <span className="text-xs font-black tracking-widest text-white/40">FAMBIT</span>
                </div>
              </div>
            ),
          )}
        </div>
      </main>

      {celebration && (
        <CelebrationOverlay data={celebration} onDismiss={dismissCelebration} />
      )}

      {perfectDayAward && (() => {
        const awardUser = users.find(user => user.id === perfectDayAward.userId);
        return awardUser ? (
          <PerfectDayCelebrationOverlay
            award={perfectDayAward}
            user={awardUser}
            onDismiss={dismissPerfectDayAward}
          />
        ) : null;
      })()}

      <InsigniaUnlockOverlay />

      {recapOpen && recapEntries.length > 0 && (
        <WeeklyRecapModal entries={recapEntries} onDismiss={dismissRecap} />
      )}

      <PWAInstallPrompt />
    </div>
  );
}
