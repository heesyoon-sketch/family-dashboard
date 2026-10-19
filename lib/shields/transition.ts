// Insignia → Shield transition (one concept: Shields).
//
// Lifetime insignias are no longer earned; what a member already earned is
// kept as a read-only record. The insignia loadout bonus stopped when weekly
// Shields started (Mon 2026-10-19): the new Shields replace it rather than
// stack on top of it.

import { zonedDayHour } from './engine';

/** First family-local day on which the insignia loadout bonus no longer applies. */
export const LEGACY_INSIGNIA_BONUS_END = '2026-10-19';

/** Lifetime insignias are frozen: no new unlocks, awards, revocations, or
 *  loadout changes. Existing records stay visible. */
export const INSIGNIAS_FROZEN = true;

export function legacyInsigniaBonusActive(at: Date, timezone: string): boolean {
  return zonedDayHour(at, timezone).day < LEGACY_INSIGNIA_BONUS_END;
}
