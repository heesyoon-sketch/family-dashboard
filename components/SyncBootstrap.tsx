'use client';

import { useEffect } from 'react';
import { useFamilyStore } from '@/lib/store';

// Centralised sync wake-ups. Mounted once in the root layout so every page
// benefits — admin and stats no longer need to set up their own listeners,
// and the dashboard's per-page handlers become defence-in-depth rather than
// the only line of defence.
//
// Triggers a hydrate (which is a no-op if not authenticated) on:
//   - tab becoming visible (returning from background, screen unlock, app switch)
//   - network reconnect
//   - bfcache restore (mobile back navigation)
//
// Hydrate itself is debounced inside the store via _hydrateInFlight, so
// concurrent triggers collapse safely.

const WAKE_DEBOUNCE_MS = 250;

export function SyncBootstrap() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const wake = (reason: string) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        const state = useFamilyStore.getState();
        // Only hydrate if a family is already known — otherwise this is
        // a public/auth route and there's nothing to refresh.
        if (state.familyId) {
          state.hydrate().catch(err => console.warn(`[sync wake:${reason}]`, err));
        }
      }, WAKE_DEBOUNCE_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') wake('visibility');
    };
    const onOnline = () => wake('online');
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) wake('bfcache');
    };
    const onFocus = () => wake('focus');

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('focus', onFocus);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return null;
}
