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
    return <div style={{ minHeight: '100vh', background: '#0b0d12' }} />;
  }

  return (
    <div style={{
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      inset: 0,
    }}>
      {/* Header: date (left) + icon buttons (right) */}
      <header style={{
        height: 44,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 12px',
        paddingTop: 'env(safe-area-inset-top)',
      }}>
        <span style={{
          flex: 1,
          color: 'rgba(255,255,255,0.45)',
          fontSize: '0.8125rem',
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          paddingLeft: 2,
        }}>
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

      {/* 4-panel grid */}
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
    </div>
  );
}
