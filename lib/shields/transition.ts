// Insignia → Shield transition (one concept: Shields).
//
// Lifetime insignias are no longer earned; what a member already earned is
// kept as a read-only record. The insignia loadout bonus each member has
// equipped keeps paying until the first monthly Shields can be equipped
// (first official month November 2026 → equipment month December 2026), so
// the family never has a month without an equipment bonus.

import { zonedDayHour } from './engine';

/** First family-local day on which the insignia loadout bonus no longer applies. */
export const LEGACY_INSIGNIA_BONUS_END = '2026-12-01';

/** Lifetime insignias are frozen: no new unlocks, awards, revocations, or
 *  loadout changes. Existing records stay visible. */
export const INSIGNIAS_FROZEN = true;

export function legacyInsigniaBonusActive(at: Date, timezone: string): boolean {
  return zonedDayHour(at, timezone).day < LEGACY_INSIGNIA_BONUS_END;
}
