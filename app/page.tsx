'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, BarChart2 } from 'lucide-react';
import { MemberPanel } from '@/components/MemberPanel';
import { CelebrationOverlay } from '@/components/CelebrationOverlay';
import { useFamilyStore } from '@/lib/store';
import type { ThemeName } from '@/lib/db';
import { useLanguage, type Lang } from '@/contexts/LanguageContext';

const ORDER: ThemeName[] = ['dark_minimal', 'warm_minimal', 'robot_neon', 'pastel_cute'];

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
  const [dateLabel, setDateLabel] = useState(() => formatDate(new Date(), useFamilyStore.getState().timeOfDay, 'ko'));

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

  // Update date label when timeOfDay or language changes
  useEffect(() => {
    setDateLabel(formatDate(new Date(), timeOfDay, lang));
  }, [timeOfDay, lang]);

  useEffect(() => {
    const tick = () => {
      setDateLabel(formatDate(new Date(), useFamilyStore.getState().timeOfDay, lang));
    };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [lang]);

  const slots = ORDER.map(theme => users.find(u => u.theme === theme));

  // Show blank screen while hydrating or while awaiting setup redirect
  if (!hydrated || (hydrated && familyId === null)) {
    return <div style={{ minHeight: '100vh', background: '#0b0d12' }} />;
  }

  return (
    <div style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, right: 0 }}>
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

      {/* Bottom-right buttons */}
      <div style={{ position: 'fixed', bottom: 16, right: 16, display: 'flex', gap: 8, zIndex: 50 }}>
        <button
          onClick={toggleSound}
          aria-label={soundEnabled ? t('sound_mute') : t('sound_unmute')}
          style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          {soundEnabled ? '🔊' : '🔇'}
        </button>
        <a
          href="/stats"
          aria-label={t('weekly_completions')}
          style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <BarChart2 size={22} />
        </a>
        <a
          href="/admin"
          aria-label={t('admin_mode')}
          style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Settings size={22} />
        </a>
      </div>
    </div>
  );
}
