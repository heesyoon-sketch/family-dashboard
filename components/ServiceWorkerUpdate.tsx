'use client';

import { useEffect } from 'react';

// The living-room tablet keeps one tab open for days, so checking for a new
// deployment only on load would leave it on old code indefinitely.
const UPDATE_CHECK_MS = 10 * 60_000;
// Never reload under a child's finger: wait until the screen has been idle.
const IDLE_BEFORE_RELOAD_MS = 60_000;

/** Reload an already-open installed PWA once a newly deployed worker takes
 * control. Without this, the new worker activates but the current tab keeps
 * running the old JavaScript bundle until the user manually closes it. */
export function ServiceWorkerUpdate() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloading = false;
    let pendingReload = false;
    let lastInteraction = Date.now();
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const reloadWhenIdle = () => {
      if (reloading) return;
      const idleFor = Date.now() - lastInteraction;
      if (idleFor >= IDLE_BEFORE_RELOAD_MS) {
        reloading = true;
        window.location.reload();
        return;
      }
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(reloadWhenIdle, IDLE_BEFORE_RELOAD_MS - idleFor);
    };
    const handleControllerChange = () => {
      if (!hadController) return;
      pendingReload = true;
      reloadWhenIdle();
    };
    const markInteraction = () => {
      lastInteraction = Date.now();
      if (pendingReload) reloadWhenIdle();
    };
    const checkForUpdate = () => {
      if (!navigator.onLine) return;
      void navigator.serviceWorker.getRegistration()
        .then(registration => registration?.update())
        .catch(() => undefined);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    window.addEventListener('pointerdown', markInteraction, { passive: true });
    window.addEventListener('keydown', markInteraction);
    document.addEventListener('visibilitychange', onVisibility);
    const interval = window.setInterval(checkForUpdate, UPDATE_CHECK_MS);
    void navigator.serviceWorker.ready.then(registration => registration.update()).catch(() => undefined);

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      window.clearInterval(interval);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      window.removeEventListener('pointerdown', markInteraction);
      window.removeEventListener('keydown', markInteraction);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return null;
}
