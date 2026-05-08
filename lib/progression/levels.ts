// FamBit progression — Levels.
//
// Levels are the long-term growth axis. They use a gentle polynomial curve
// (no MMO-style exponential inflation) so a level always feels reachable
// while higher levels stay meaningful.
//
// Curve: cumulative XP needed to reach level n = round(100 * n^1.35)
//
// Examples:
//   Level 1   →     0 xp
//   Level 5   →   856 xp
//   Level 10  → 2,239 xp
//   Level 15  → 3,823 xp
//   Level 25  → 7,596 xp
//   Level 50  → 19,001 xp
//   Level 100 → 50,118 xp

export const LEVEL_GROWTH_EXPONENT = 1.35;
export const LEVEL_GROWTH_BASE = 100;
export const MAX_INSIGNIA_SLOTS = 3;

/** Cumulative XP threshold to reach the start of `level`. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(LEVEL_GROWTH_BASE * Math.pow(level, LEVEL_GROWTH_EXPONENT));
}

/** Inverse — the level a member is at given total XP. */
export function levelForXp(totalXp: number): number {
  const xp = Math.max(0, Math.floor(totalXp));
  if (xp <= 0) return 1;
  const raw = Math.pow(xp / LEVEL_GROWTH_BASE, 1 / LEVEL_GROWTH_EXPONENT);
  return Math.max(1, Math.floor(raw));
}

export interface LevelProgress {
  /** Current level number. */
  level: number;
  /** XP needed to reach this level. */
  currentLevelXp: number;
  /** XP needed to reach the next level. */
  nextLevelXp: number;
  /** XP earned past the start of this level. */
  pointsInLevel: number;
  /** XP needed from currentLevelXp → nextLevelXp. */
  pointsToNext: number;
  /** 0..1 progress to next level. */
  progressToNext: number;
}

export function computeLevelProgress(totalXp: number): LevelProgress {
  const level = levelForXp(totalXp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const pointsInLevel = Math.max(0, totalXp - currentLevelXp);
  const pointsToNext = Math.max(1, nextLevelXp - currentLevelXp);
  return {
    level,
    currentLevelXp,
    nextLevelXp,
    pointsInLevel,
    pointsToNext,
    progressToNext: Math.min(1, pointsInLevel / pointsToNext),
  };
}

/** How many insignia slots a level grants. Soft, encouraging cadence. */
export function insigniaSlotsForLevel(level: number): number {
  if (level >= 15) return 3;
  if (level >= 5) return 2;
  return 1;
}

export interface LevelUnlock {
  level: number;
  kind: 'slot' | 'title' | 'frame' | 'effect';
  id: string;
  label: string;
  description: string;
}

/** Every named unlock in level order. Drives the "Levels matter" reveal UI. */
export const LEVEL_UNLOCKS: LevelUnlock[] = [
  { level: 1,  kind: 'slot',   id: 'slot-1',           label: '1st insignia slot',  description: 'Equip your first insignia to shape your playstyle.' },
  { level: 2,  kind: 'title',  id: 'morning-explorer', label: 'Morning Explorer',   description: 'A title earned through showing up early.' },
  { level: 3,  kind: 'effect', id: 'aura-soft',        label: 'Soft profile aura',  description: 'A gentle glow appears around your member panel.' },
  { level: 5,  kind: 'slot',   id: 'slot-2',           label: '2nd insignia slot',  description: 'Combine two insignias for richer playstyles.' },
  { level: 6,  kind: 'title',  id: 'quiet-helper',     label: 'Quiet Helper',       description: 'For the steady support of others.' },
  { level: 8,  kind: 'frame',  id: 'frame-bronze',     label: 'Bronze profile frame', description: 'A small chrome upgrade to your avatar.' },
  { level: 10, kind: 'title',  id: 'family-guardian',  label: 'Family Guardian',    description: 'For protecting the family rhythm over time.' },
  { level: 12, kind: 'effect', id: 'aura-warm',        label: 'Warm aura',          description: 'A warmer glow as your routine matures.' },
  { level: 15, kind: 'slot',   id: 'slot-3',           label: '3rd insignia slot',  description: 'Full loadout: balance cooperation, recovery, and growth.' },
  { level: 18, kind: 'title',  id: 'resilient-soul',   label: 'Resilient Soul',     description: 'For recovering again and again.' },
  { level: 22, kind: 'frame',  id: 'frame-silver',     label: 'Silver profile frame', description: 'A polished frame for long journeys.' },
  { level: 25, kind: 'title',  id: 'harmony-keeper',   label: 'Harmony Keeper',     description: 'For families that move together.' },
  { level: 30, kind: 'effect', id: 'aura-radiant',     label: 'Radiant aura',       description: 'A standout shimmer for veteran members.' },
  { level: 40, kind: 'frame',  id: 'frame-gold',       label: 'Gold profile frame', description: 'Premium frame reserved for sustained growth.' },
  { level: 50, kind: 'title',  id: 'lantern-bearer',   label: 'Lantern Bearer',     description: 'A milestone for half a hundred levels.' },
];

export function unlocksUpToLevel(level: number): LevelUnlock[] {
  return LEVEL_UNLOCKS.filter(unlock => unlock.level <= level);
}

export function nextLevelUnlock(level: number): LevelUnlock | null {
  return LEVEL_UNLOCKS.find(unlock => unlock.level > level) ?? null;
}
