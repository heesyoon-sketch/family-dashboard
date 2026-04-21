'use client';

import { useEffect, useState } from 'react';
import { Settings, BarChart2 } from 'lucide-react';
import { MemberPanel } from '@/components/MemberPanel';
import { CelebrationOverlay } from '@/components/CelebrationOverlay';
import { useFamilyStore } from '@/lib/store';
import type { ThemeName } from '@/lib/db';

const ORDER: ThemeName[] = ['dark_minimal', 'warm_minimal', 'robot_neon', 'pastel_cute'];

const DAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

function formatDate(d: Date, timeOfDay: 'morning' | 'evening'): string {
  const dateStr = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}  ·  ${DAYS[d.getDay()]}`;
  const tod = timeOfDay === 'morning' ? ' · 🌅 아침' : ' · 🌙 저녁';
  return dateStr + tod;
}

export default function Dashboard() {
  const { users, hydrate, celebration, dismissCelebration, soundEnabled, toggleSound } = useFamilyStore();
  const timeOfDay = useFamilyStore(s => s.timeOfDay);
  const [dateLabel, setDateLabel] = useState(() => formatDate(new Date(), useFamilyStore.getState().timeOfDay));

  useEffect(() => {
    useFamilyStore.setState({ hydrated: false });
    hydrate().catch(console.error);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 날짜 라벨: 1분마다 + timeOfDay 변경 시 갱신
  useEffect(() => {
    setDateLabel(formatDate(new Date(), timeOfDay));
  }, [timeOfDay]);

  useEffect(() => {
    const tick = () => {
      setDateLabel(formatDate(new Date(), useFamilyStore.getState().timeOfDay));
    };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const slots = ORDER.map(theme => users.find(u => u.theme === theme));

  return (
    <div style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, right: 0 }}>
      {/* 헤더: 36px 고정 */}
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

      {/* 4분할 그리드: 나머지 전체 높이 */}
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

      {/* 우측 하단 버튼 */}
      <div style={{ position: 'fixed', bottom: 16, right: 16, display: 'flex', gap: 8, zIndex: 50 }}>
        <button
          onClick={toggleSound}
          aria-label={soundEnabled ? '소리 끄기' : '소리 켜기'}
          style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          {soundEnabled ? '🔊' : '🔇'}
        </button>
        <a
          href="/stats"
          aria-label="통계"
          style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <BarChart2 size={22} />
        </a>
        <a
          href="/admin"
          aria-label="관리자"
          style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Settings size={22} />
        </a>
      </div>
    </div>
  );
}
