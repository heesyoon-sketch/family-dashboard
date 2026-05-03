'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BarChart2, ChevronLeft, ChevronRight, LogOut, Settings, Volume2, VolumeX } from 'lucide-react';
import { MemberPanel } from '@/components/MemberPanel';
import { CelebrationOverlay } from '@/components/CelebrationOverlay';
import { WeeklyRecapModal } from '@/components/WeeklyRecapModal';
import { AuthProfileAvatar } from '@/components/AuthProfileAvatar';
import { FamBitWordmark } from '@/components/FamBitLogo';
import { useFamilyStore } from '@/lib/store';
import { createBrowserSupabase } from '@/lib/supabase';
import { familyHasAdminPin } from '@/lib/adminPin';
import { useLanguage, type Lang } from '@/contexts/LanguageContext';

const iconBtnClass =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.045] text-white/56 transition-colors hover:border-[#4EEDB0]/40 hover:bg-[#4EEDB0]/10 hover:text-[#4EEDB0]';


function formatDate(d: Date, timeOfDay: 'morning' | 'evening', lang: Lang): string {
  const locale = lang === 'en' ? 'en-US' : 'ko-KR';
  const dayName = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(d);
  const dateStr = lang === 'en'
    ? `${new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(d)}  ·  ${dayName}`
    : `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}  ·  ${dayName}`;
  const tod = timeOfDay === 'morning'
    ? (lang === 'en' ? ' · 🌅 Morning' : ' · 🌅 아침')
    : (lang === 'en' ? ' · 🌙 Evening' : ' · 🌙 저녁');
  return dateStr + tod;
}

export default function Dashboard() {
  const router = useRouter();
  const { lang, t } = useLanguage();
  const { users, hydrate, celebration, dismissCelebration, soundEnabled, toggleSound } = useFamilyStore();
  const timeOfDay = useFamilyStore(s => s.timeOfDay);
  const hydrated  = useFamilyStore(s => s.hydrated);
  const familyId  = useFamilyStore(s => s.familyId);
  const familyName = useFamilyStore(s => s.familyName);
  const weeklyRecapByUser = useFamilyStore(s => s.weeklyRecapByUser);
  const [recapDismissedKey, setRecapDismissedKey] = useState<string | null>(null);
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
  const dateLabel = formatDate(now, timeOfDay, lang);

  const resetAndHydrate = useCallback(async () => {
    setAuthReady(false);
    setAuthProfile({ email: null, avatarUrl: null });
    useFamilyStore.setState({
      hydrated: false, familyId: null, familyName: null, users: [], rewards: [],
      tasksByUser: {}, activitiesByUser: {}, levelsByUser: {}, todayCompletions: {},
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
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
    useFamilyStore.setState({
      hydrated: false, familyId: null, familyName: null, users: [], rewards: [],
      tasksByUser: {}, activitiesByUser: {}, levelsByUser: {}, todayCompletions: {},
      dailyStreakByUser: {}, dailyStreakAtRiskByUser: {}, weeklyRecapByUser: {},
    });
    router.replace('/login');
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

  const orderedUsers = [...users].sort((a, b) => {
    const displayOrder = a.displayOrder - b.displayOrder;
    if (displayOrder !== 0) return displayOrder;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  const pageCount = Math.max(1, Math.ceil(orderedUsers.length / 4));
  const activePage = Math.min(currentPage, pageCount - 1);
  const desktopPageUsers = orderedUsers.slice(activePage * 4, activePage * 4 + 4);
  const desktopSlots = Array.from({ length: 4 }, (_, index) => desktopPageUsers[index] ?? null);

  const goToPrevPage = () => setCurrentPage(page => Math.max(0, page - 1));
  const goToNextPage = () => setCurrentPage(page => Math.min(pageCount - 1, page + 1));

  // Show blank screen until auth is verified for THIS render cycle.
  // familyId === null check is handled by the redirect useEffect above.
  if (!authReady || !hydrated || familyId === null) {
    return <div className="min-h-screen bg-[#0D0E1C]" />;
  }

  return (
    <div className="flex flex-col bg-[#0D0E1C] min-h-screen md:fixed md:inset-0 md:h-screen md:overflow-hidden">

      {/* Header — sticky on mobile scroll, static on desktop */}
      <header
        className="sticky top-0 z-10 grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-white/8 bg-[#0D0E1C]/95 px-2.5 backdrop-blur-md md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:px-3"
        style={{ minHeight: 52, paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex min-w-0 items-center gap-2 pl-0.5">
          <span className="shrink-0 md:hidden">
            <FamBitWordmark markSize={30} showText={false} />
          </span>
          <span className="min-w-0 truncate text-[12px] font-semibold text-white/42 md:text-[13px]">
            {dateLabel}
          </span>
        </div>

        <div className="hidden min-w-0 justify-center md:flex">
          <div className="flex h-10 max-w-full items-center gap-2 rounded-xl border border-white/9 bg-[#111224] px-2.5 shadow-[0_6px_22px_rgba(0,0,0,0.22)] md:h-11 md:px-3">
            <FamBitWordmark
              compact
              markSize={30}
              textClassName="hidden text-[18px] font-black text-white sm:inline"
            />
            <div className="h-4 w-px bg-white/10" />
            {familyName ? (
              <span
                title={familyName}
                className="min-w-0 max-w-[46vw] truncate text-[12px] font-black text-white/78 md:max-w-[210px]"
              >
                {familyName}
              </span>
            ) : (
              <span className="text-[12px] font-black text-white/52">Family Dashboard</span>
            )}
            <span className="hidden rounded-full bg-[#4EEDB0]/12 px-2 py-0.5 text-[10px] font-black text-[#4EEDB0] md:inline">
              LIVE
            </span>
          </div>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-1.5">
          {pageCount > 1 && (
            <div className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-1 py-1 md:flex">
              <button
                type="button"
                onClick={goToPrevPage}
                disabled={activePage === 0}
                aria-label="Previous members page"
                className="grid h-7 w-7 place-items-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-25"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: pageCount }, (_, page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    aria-label={`Members page ${page + 1}`}
                    className={[
                      'h-1.5 rounded-full transition-all',
                      page === activePage ? 'w-4 bg-[#4EEDB0]' : 'w-1.5 bg-white/25 hover:bg-white/45',
                    ].join(' ')}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={goToNextPage}
                disabled={activePage === pageCount - 1}
                aria-label="Next members page"
                className="grid h-7 w-7 place-items-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-25"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
          <button
            onClick={toggleSound}
            aria-label={soundEnabled ? t('sound_mute') : t('sound_unmute')}
            className={iconBtnClass}
          >
            {soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
          <Link href="/stats" aria-label={t('weekly_completions')} className={`${iconBtnClass} hover:border-[#5B8EFF]/40 hover:bg-[#5B8EFF]/10 hover:text-[#8EAFFF]`}>
            <BarChart2 size={17} />
          </Link>
          <button
            onClick={() => { void handleLogout(); }}
            aria-label={t('logout')}
            title={t('logout')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#FF7BAC]/28 bg-[#FF7BAC]/8 text-[#FFB8CF] transition-colors hover:border-[#FF7BAC]/55 hover:bg-[#FF7BAC]/14"
          >
            <LogOut size={17} />
          </button>
          <Link href="/admin" aria-label={t('admin_mode')} className={iconBtnClass}>
            <Settings size={17} />
          </Link>
          <AuthProfileAvatar email={authProfile.email} avatarUrl={authProfile.avatarUrl} size={32} />
        </div>
      </header>

      <main className="grid flex-1 grid-cols-1 gap-4 bg-[#0D0E1C] p-3 md:hidden">
        {orderedUsers.map(user => (
          <MemberPanel key={user.id} user={user} />
        ))}
      </main>

      <main className="hidden flex-1 grid-cols-2 grid-rows-2 gap-4 overflow-hidden bg-[#0D0E1C] p-4 md:grid">
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
      </main>

      {celebration && (
        <CelebrationOverlay data={celebration} onDismiss={dismissCelebration} />
      )}

      {recapOpen && recapEntries.length > 0 && (
        <WeeklyRecapModal entries={recapEntries} onDismiss={dismissRecap} />
      )}
    </div>
  );
}
