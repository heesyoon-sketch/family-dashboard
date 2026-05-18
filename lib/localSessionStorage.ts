const FAMILY_SESSION_KEYS = [
  'family_dashboard_member_id',
  'family_dashboard_family_id',
  'family_onboarding_complete',
] as const;

export function clearFamilySessionStorage(): void {
  if (typeof window === 'undefined') return;
  for (const key of FAMILY_SESSION_KEYS) {
    window.localStorage.removeItem(key);
  }
}
