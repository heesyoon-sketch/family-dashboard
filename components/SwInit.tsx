'use client';

import { useEffect } from 'react';

export function SwInit() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    (async () => {
      // Unregister every Service Worker and delete every cache.
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map(k => window.caches.delete(k)));
      }

      // Force a hard reload exactly once per session so Edge dumps its
      // HTTP disk cache after the SW and Cache Storage are gone.
      // sessionStorage is cleared when the tab closes, so this never
      // persists across sessions and cannot cause an infinite loop.
      if (!sessionStorage.getItem('sw_nuked')) {
        sessionStorage.setItem('sw_nuked', 'true');
        window.location.reload();
      }
    })();
  }, []);

  return null;
}
