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

function NavIconButton({
  children,
  label,
  onClick,
  href,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
}) {
  const className = 'app-nav-button';
  if (href) {
    return (
      <Link href={href} aria-label={label} className={className} title={label}>
        {children}
        <span>{label}</span>
      </Link>
    );
  }
  return (
    <button onClick={onClick} aria-label={label} className={className} title={label}>
      {children}
      <span>{label}</span>
    </button>
  );
}

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

  // Initial load
  useEffect(() => {
    useFamilyStore.setState({ hydrated: false });
    hydrate().catch(console.error);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // After hydration: redirect to /setup if the user has no family yet
  useEffect(() => {
    if (hydrated && familyId === null) {
      router.replace('/setup');
    }
  }, [hydrated, familyId, router]);

  // Re-hydrate when Admin broadcasts a mutation over the same origin.
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

  // Show blank screen while hydrating or while awaiting setup redirect
  if (!hydrated || (hydrated && familyId === null)) {
    return <div style={{ minHeight: '100vh', background: '#0b0d12' }} />;
  }

  const renderNav = () => (
    <>
      <NavIconButton
        label={soundEnabled ? t('sound_mute') : t('sound_unmute')}
        onClick={toggleSound}
      >
        {soundEnabled ? <Volume2 size={22} /> : <VolumeX size={22} />}
      </NavIconButton>
      <NavIconButton label={t('weekly_completions')} href="/stats">
        <BarChart2 size={22} />
      </NavIconButton>
      <NavIconButton label={t('admin_mode')} href="/admin">
        <Settings size={22} />
      </NavIconButton>
    </>
  );

  return (
    <div
      style={{
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 'var(--app-nav-width)',
        right: 0,
        bottom: 'var(--app-bottom-nav-height)',
      }}
    >
      <aside className="app-sidebar" aria-label="Dashboard navigation">
        {renderNav()}
      </aside>
      {/* Header: 36px fixed */}
      <header style={{
        height: 36,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', fontWeight: 500 }}>
          {dateLabel}
        </span>
      </header>

      {/* 4-panel grid: remaining full height */}
      <main style={{
        flex: 1,
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: 2,
        background: '#000',
      }}>
        {slots.map((user, i) =>
          user ? (
            <MemberPanel key={user.id} user={user} />
          ) : (
            <div key={`empty-${i}`} style={{ background: '#171717' }} />
          ),
        )}
      </main>

      {celebration && (
        <CelebrationOverlay data={celebration} onDismiss={dismissCelebration} />
      )}

      <nav className="app-bottom-nav" aria-label="Dashboard navigation">
        {renderNav()}
      </nav>
    </div>
  );
}
