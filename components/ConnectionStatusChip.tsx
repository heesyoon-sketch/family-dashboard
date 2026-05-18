'use client';

import { useEffect, useState } from 'react';
import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { listTaskActions } from '@/lib/offlineQueue';
import { useLanguage } from '@/contexts/LanguageContext';

export function ConnectionStatusChip({ className }: { className?: string }) {
  const { lang } = useLanguage();
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const refresh = async () => {
      setOnline(navigator.onLine);
      setPendingCount((await listTaskActions()).length);
    };
    const handleOnline = () => { void refresh(); };
    const handleQueue = () => { void refresh(); };
    const timer = window.setInterval(() => { void refresh(); }, 10_000);

    void refresh();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOnline);
    window.addEventListener('fambit:offline-queue', handleQueue);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOnline);
      window.removeEventListener('fambit:offline-queue', handleQueue);
    };
  }, []);

  const healthy = online && pendingCount === 0;
  const label = healthy
    ? (lang === 'en' ? 'Live' : '실시간')
    : !online
      ? (lang === 'en' ? 'Offline' : '오프라인')
      : (lang === 'en' ? `${pendingCount} syncing` : `${pendingCount}개 동기화`);

  return (
    <div
      aria-live="polite"
      title={healthy
        ? (lang === 'en' ? 'Connected and synced' : '연결 및 동기화 완료')
        : !online
          ? (lang === 'en' ? 'Offline actions will sync when connection returns' : '연결되면 오프라인 작업이 동기화됩니다')
          : (lang === 'en' ? 'Pending offline actions are syncing' : '대기 중인 오프라인 작업을 동기화하고 있습니다')}
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em]',
        healthy
          ? 'border-[#4EEDB0]/25 bg-[#4EEDB0]/12 text-[#4EEDB0]'
          : !online
            ? 'border-[#FF7BAC]/30 bg-[#FF7BAC]/10 text-[#FFB8CF]'
            : 'border-[#FFB830]/30 bg-[#FFB830]/10 text-[#FFE0A0]',
        className ?? '',
      ].join(' ')}
    >
      {healthy ? <Cloud size={12} /> : !online ? <CloudOff size={12} /> : <RefreshCw size={12} className="animate-spin" />}
      <span>{label}</span>
    </div>
  );
}
