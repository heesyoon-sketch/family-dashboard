// FamBit progression — re-exports.
//
// One import surface for everything progression-related: levels, momentum,
// harmony, and the insignia loadout. Each submodule has its own deterministic
// math that takes raw completion data and returns plain values — easy to
// memoize, easy to unit-test, easy to reason about.

export {
  LEVEL_GROWTH_BASE,
  LEVEL_GROWTH_EXPONENT,
  LEVEL_UNLOCKS,
  MAX_INSIGNIA_SLOTS,
  computeLevelProgress,
  insigniaSlotsForLevel,
  levelForXp,
  nextLevelUnlock,
  unlocksUpToLevel,
  xpForLevel,
} from './levels';
export type { LevelProgress, LevelUnlock } from './levels';

export {
  MOMENTUM_STATES,
  calculateMomentum,
  emptyMomentum,
} from './momentum';
export type { MomentumInput, MomentumResult, MomentumState, MomentumStateMeta } from './momentum';

export {
  HARMONY_STATES,
  calculateHarmony,
  emptyHarmony,
} from './harmony';
export type { HarmonyInput, HarmonyResult, HarmonyState, HarmonyStateMeta } from './harmony';

export {
  LOADOUT_BONUS_CAP,
  MAX_LOADOUT_SLOTS,
  TOTAL_BONUS_CAP,
  archetypeColor,
  archetypeDescription,
  archetypeFor,
  archetypeLabel,
  buildLoadoutSummary,
  composeBonusPercent,
} from './loadout';
export type { BonusBreakdown, EquippedInsignia, LoadoutArchetype, LoadoutSummary } from './loadout';
