'use client';

import { useEffect } from 'react';

/** Reload an already-open installed PWA once a newly deployed worker takes
 * control. Without this, the new worker activates but the current tab keeps
 * running the old JavaScript bundle until the user manually closes it. */
export function ServiceWorkerUpdate() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloading = false;
    const handleControllerChange = () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    void navigator.serviceWorker.ready.then(registration => registration.update());

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  return null;
}
