'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BarChart2, Settings, Volume2, VolumeX } from 'lucide-react';
import { MemberPanel } from '@/components/MemberPanel';
import { CelebrationOverlay } from '@/components/CelebrationOverlay';
import { useFamilyStore } from '@/lib/store';
import type { ThemeName } from '@/lib/db';
import { useLanguage, type Lang } from '@/contexts/LanguageContext';

const ORDER: ThemeName[] = ['dark_minimal', 'warm_minimal', 'robot_neon', 'pastel_cute'];

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
  const [now, setNow] = useState(() => new Date());
  const dateLabel = formatDate(now, timeOfDay, lang);

  useEffect(() => {
    useFamilyStore.setState({ hydrated: false });
    hydrate().catch(console.error);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (hydrated && familyId === null) {
      router.replace('/setup');
    }
  }, [hydrated, familyId, router]);

  useEffect(() => {
    const ch = new BroadcastChannel('habit_sync');
    ch.onmessage = () => hydrate().catch(console.error);
    return () => ch.close();
  }, [hydrate]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const slots = ORDER.map(theme => users.find(u => u.theme === theme));

  if (!hydrated || (hydrated && familyId === null)) {
    return <div className="min-h-screen bg-[#0b0d12]" />;
  }

  return (
    /*
     * Mobile:  normal flow, min-h-screen, vertical scroll
     * Desktop: fixed viewport (md+), overflow hidden, 2x2 grid fills screen
     */
    <div className="flex flex-col bg-[#0b0d12] min-h-screen md:fixed md:inset-0 md:h-screen md:overflow-hidden">

      {/* Header — sticky on mobile scroll, static on desktop */}
      <header
        className="sticky top-0 z-10 shrink-0 flex items-center gap-2 bg-[#0b0d12]"
        style={{ height: 44, padding: '0 12px', paddingTop: 'env(safe-area-inset-top)' }}
      >
        <span className="flex-1 text-white/45 text-[13px] font-medium overflow-hidden text-ellipsis whitespace-nowrap pl-0.5">
          {dateLabel}
        </span>
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
        <Link href="/admin" aria-label={t('admin_mode')} style={iconBtn}>
          <Settings size={17} />
        </Link>
      </header>

      {/*
       * Mobile:  1-column, panels stack vertically, full-width per card
       * Desktop: 2×2 grid, each cell fills exactly half the remaining viewport
       */}
      <main className="flex-1 grid gap-0.5 bg-black grid-cols-1 md:grid-cols-2 md:grid-rows-2 md:overflow-hidden">
        {slots.map((user, i) =>
          user ? (
            <MemberPanel key={user.id} user={user} />
          ) : (
            <div key={`empty-${i}`} className="bg-[#171717] min-h-[480px] md:min-h-0" />
          ),
        )}
      </main>

      {celebration && (
        <CelebrationOverlay data={celebration} onDismiss={dismissCelebration} />
      )}
    </div>
  );
}
