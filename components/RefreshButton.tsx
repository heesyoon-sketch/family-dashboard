'use client';

import { useState } from 'react';
import { RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { useFamilyStore } from '@/lib/store';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * One-tap refresh for the always-on living-room tablet, where closing and
 * reopening the app is awkward. Online, it picks up any new deployment and
 * reloads with fresh data; offline, it only retries the data sync (queued
 * completions live in IndexedDB either way, so nothing is lost).
 */
export function RefreshButton({ className }: { className: string }) {
  const { lang } = useLanguage();
  const [busy, setBusy] = useState(false);
  const label = lang === 'en' ? 'Refresh' : '새로고침';

  const refresh = async () => {
    if (busy) return;
    setBusy(true);
    if (!navigator.onLine) {
      await useFamilyStore.getState().hydrate().catch(() => undefined);
      toast.message(lang === 'en' ? 'Offline — showing saved data' : '오프라인이라 저장된 내용을 보여줘요');
      setBusy(false);
      return;
    }
    try {
      const registration = await navigator.serviceWorker?.getRegistration();
      await registration?.update();
    } catch {
      // A failed update check must not block the reload.
    }
    window.location.reload();
  };

  return (
    <button
      type="button"
      onClick={() => { void refresh(); }}
      disabled={busy}
      aria-label={label}
      title={label}
      className={className}
    >
      <RotateCw size={17} className={busy ? 'animate-spin' : ''} aria-hidden />
    </button>
  );
}
