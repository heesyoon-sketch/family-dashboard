'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

// The browser-native install prompt event. Typed locally because
// BeforeInstallPromptEvent is not in lib.dom yet.
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'pwa_install_dismissed_at';
const DISMISS_COOLDOWN_DAYS = 14;

export function PWAInstallPrompt() {
  const { lang } = useLanguage();
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Already installed (running in standalone mode) — never show.
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true);
    if (isStandalone) return;

    // Recently dismissed — respect the cooldown.
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (dismissedAt > 0) {
      const ageMs = Date.now() - dismissedAt;
      if (ageMs < DISMISS_COOLDOWN_DAYS * 24 * 60 * 60 * 1000) return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallPromptEvent);
      setIsVisible(true);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setIsVisible(false);
      localStorage.removeItem(DISMISS_KEY);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'dismissed') {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
    setInstallEvent(null);
    setIsVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setIsVisible(false);
  };

  if (!isVisible || !installEvent) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-[#4EEDB0]/40 bg-[#0D0E1C]/95 py-2 pl-3 pr-2 shadow-[0_10px_40px_rgba(0,0,0,0.55)] backdrop-blur sm:bottom-6 sm:right-6"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      <span className="text-base">📌</span>
      <span className="hidden text-xs font-semibold text-white/80 sm:inline">
        {lang === 'en' ? 'Install Fambit on this laptop' : '이 컴퓨터에 Fambit 설치하기'}
      </span>
      <span className="text-xs font-semibold text-white/80 sm:hidden">
        {lang === 'en' ? 'Install Fambit' : 'Fambit 설치'}
      </span>
      <button
        type="button"
        onClick={() => { void handleInstall(); }}
        className="ml-1 inline-flex items-center gap-1 rounded-full bg-[#4EEDB0] px-3 py-1.5 text-xs font-black text-[#07120E] transition hover:bg-[#71F4C0]"
      >
        <Download size={13} />
        {lang === 'en' ? 'Install' : '설치'}
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label={lang === 'en' ? 'Dismiss' : '닫기'}
        className="grid h-7 w-7 place-items-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white"
      >
        <X size={14} />
      </button>
    </div>
  );
}
