export const STREAK_BONUS_TIERS = {
  standard: { minStreak: 3, multiplier: 1.2 },
  premium: { minStreak: 7, multiplier: 1.5 },
} as const;

export type StreakBonusTier = 1 | 2 | 3;

export function getStreakBonusTier(streak: number): StreakBonusTier {
  if (streak >= STREAK_BONUS_TIERS.premium.minStreak) return 3;
  if (streak >= STREAK_BONUS_TIERS.standard.minStreak) return 2;
  return 1;
}

export function getStreakMultiplier(streak: number): number {
  const tier = getStreakBonusTier(streak);
  if (tier === 3) return STREAK_BONUS_TIERS.premium.multiplier;
  if (tier === 2) return STREAK_BONUS_TIERS.standard.multiplier;
  return 1;
}

export function applyStreakMultiplier(points: number, streak: number): number {
  return Math.round(points * getStreakMultiplier(streak));
}
