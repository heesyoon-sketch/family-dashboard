'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BarChart2, ChevronLeft, ChevronRight, LogOut, Settings, Volume2, VolumeX } from 'lucide-react';
import { MemberPanel } from '@/components/MemberPanel';
import { CelebrationOverlay } from '@/components/CelebrationOverlay';
import { useFamilyStore } from '@/lib/store';
import { createBrowserSupabase } from '@/lib/supabase';
import { useLanguage, type Lang } from '@/contexts/LanguageContext';

const iconBtn: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.05)',
  color: 'rgba(255,255,255,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  textDecoration: 'none',
  flexShrink: 0,
};


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
  // authReady starts as false on every mount — the blank screen is shown until
  // hydrate() finishes verifying the session. This is the primary guard against
  // stale Zustand state flashing on Back-button or cross-user navigation.
  const [authReady, setAuthReady] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [currentPage, setCurrentPage] = useState(0);
  const dateLabel = formatDate(now, timeOfDay, lang);

  const resetAndHydrate = useCallback(async () => {
    setAuthReady(false);
    useFamilyStore.setState({
      hydrated: false, familyId: null, users: [],
      tasksByUser: {}, levelsByUser: {}, todayCompletions: {},
    });
    try {
      await hydrate();
    } finally {
      setAuthReady(true);
    }
  }, [hydrate]);

  // On every mount: clear stale state then verify session
  useEffect(() => {
    resetAndHydrate().catch(console.error);
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
    useFamilyStore.setState({
      hydrated: false, familyId: null, users: [],
      tasksByUser: {}, levelsByUser: {}, todayCompletions: {},
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
    return <div className="min-h-screen bg-[#0b0d12]" />;
  }

  return (
    <div className="flex flex-col bg-[#0b0d12] min-h-screen md:fixed md:inset-0 md:h-screen md:overflow-hidden">

      {/* Header — sticky on mobile scroll, static on desktop */}
      <header
        className="sticky top-0 z-10 shrink-0 flex items-center gap-2 bg-[#0b0d12]"
        style={{ height: 44, padding: '0 12px', paddingTop: 'env(safe-area-inset-top)' }}
      >
        <span className="flex-1 text-white/45 text-[13px] font-medium overflow-hidden text-ellipsis whitespace-nowrap pl-0.5">
          {dateLabel}
        </span>
        {pageCount > 1 && (
          <div className="hidden md:flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-1 py-1">
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
                    page === activePage ? 'w-4 bg-white/70' : 'w-1.5 bg-white/25 hover:bg-white/45',
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
          style={iconBtn}
        >
          {soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
        </button>
        <Link href="/stats" aria-label={t('weekly_completions')} style={iconBtn}>
          <BarChart2 size={17} />
        </Link>
        <a
          href="https://forms.gle/KgxsBSBHwkdrwdTz7"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            backgroundColor: '#ff4757',
            color: 'white',
            padding: '5px 12px',
            zIndex: 9999,
            display: 'flex',
            visibility: 'visible',
            alignItems: 'center',
            borderRadius: 8,
            textDecoration: 'none',
            flexShrink: 0,
            fontSize: 13,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            position: 'relative',
          }}
        >
          💬 피드백
        </a>
        <button
          onClick={() => { void handleLogout(); }}
          aria-label="Logout"
          title="로그아웃"
          style={{
            ...iconBtn,
            color: 'rgba(255,90,90,0.85)',
            border: '1px solid rgba(255,80,80,0.25)',
            background: 'rgba(255,60,60,0.08)',
          }}
        >
          <LogOut size={17} />
        </button>
        <Link href="/admin" aria-label={t('admin_mode')} style={iconBtn}>
          <Settings size={17} />
        </Link>
      </header>

      <main className="grid flex-1 grid-cols-1 gap-0.5 bg-black md:hidden">
        {orderedUsers.map(user => (
          <MemberPanel key={user.id} user={user} />
        ))}
      </main>

      <main className="hidden flex-1 grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden bg-black md:grid">
        {desktopSlots.map((user, index) =>
          user ? (
            <MemberPanel key={user.id} user={user} />
          ) : (
            <div key={`empty-${activePage}-${index}`} className="min-h-0 bg-[#171717]" />
          ),
        )}
      </main>

      {celebration && (
        <CelebrationOverlay data={celebration} onDismiss={dismissCelebration} />
      )}
    </div>
  );
}
