'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  getLatestShieldSnapshot,
  subscribeToShieldState,
  type ShieldStateChangedDetail,
} from './storage';

export function useShieldSnapshot(familyId: string | null): ShieldStateChangedDetail | undefined {
  const subscribe = useCallback((onStoreChange: () => void) => (
    subscribeToShieldState(detail => {
      if (familyId && detail.familyId === familyId) onStoreChange();
    })
  ), [familyId]);
  const getSnapshot = useCallback(
    () => familyId ? getLatestShieldSnapshot(familyId) : undefined,
    [familyId],
  );
  const getServerSnapshot = useCallback(() => undefined, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
