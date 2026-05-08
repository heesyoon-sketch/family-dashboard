// FamBit progression — Insignia loadout & passive bonuses.
//
// Insignias are the strategic identity layer. Each member equips up to 3
// (gated by their level) and the equipped set produces a small, capped
// passive bonus percent on every completion. Bonuses encourage the
// behaviours we want to see — cooperation, recovery, balance, kindness —
// and never produce a runaway "meta loadout":
//
//   - per-insignia percent depends on rarity, not stacking
//   - loadout sum is capped at LOADOUT_BONUS_CAP
//   - momentum + harmony + loadout combined cap at TOTAL_BONUS_CAP
//
// The classification below maps existing achievement categories onto
// playstyle archetypes so we don't need to redefine the badge catalog.

import type { AchievementProgress } from '@/lib/achievements/engine';
import type { AchievementCategory, AchievementRarity } from '@/lib/achievements/definitions';
import { ACHIEVEMENTS } from '@/lib/achievements/definitions';

export type LoadoutArchetype =
  | 'cooperation'   // family/team focused
  | 'recovery'      // resilience after misses
  | 'variety'       // category breadth
  | 'challenge'     // hard / rare goals
  | 'consistency';  // gentle long-term presence

// Best-three insignias should top out at +50% (1.5× the base reward).
// Total bonus is also clamped to 50% so momentum + harmony can't push the
// final multiplier past 1.5× under any combination.
export const LOADOUT_BONUS_CAP = 50;     // sum from insignias alone
export const TOTAL_BONUS_CAP = 50;       // momentum + harmony + insignias
export const MAX_LOADOUT_SLOTS = 3;

const ARCHETYPE_BY_CATEGORY: Record<AchievementCategory, LoadoutArchetype> = {
  'First Steps':                'consistency',
  'Comebacks':                  'recovery',
  'Improvement':                'consistency',
  'Consistency':                'consistency',
  'Habit Mastery':              'consistency',
  'Gentle Streaks':             'consistency',
  'Perfect Days':               'challenge',
  'Weekly Quests':              'consistency',
  'Monthly Quests':             'challenge',
  'Year Journey':               'challenge',
  'Morning Routine':            'consistency',
  'Evening Routine':            'consistency',
  'School Routine':             'consistency',
  'Health & Hygiene':           'consistency',
  'Learning & Reading':         'variety',
  'Faith & Reflection':         'consistency',
  'Responsibility & Cleanup':   'variety',
  'Exercise':                   'variety',
  'Combo Badges':               'variety',
  'Team Badges':                'cooperation',
  'Secret Badges':              'challenge',
};

// Per-rarity bonus contribution. Bronze/silver are nearly cosmetic so casual
// progress feels rewarding without inflating points; gold and above scale up
// because they're meant to be hard-earned. Three best-of-the-best insignias
// (3× mythic) sums to 54 and is then clamped to LOADOUT_BONUS_CAP (50%).
const RARITY_BONUS: Record<AchievementRarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 4,
  epic: 8,
  legendary: 13,
  mythic: 18,
};

const ARCHETYPE_LABEL: Record<LoadoutArchetype, string> = {
  cooperation: 'Cooperation',
  recovery: 'Recovery',
  variety: 'Variety',
  challenge: 'Challenge',
  consistency: 'Consistency',
};

const ARCHETYPE_DESCRIPTION: Record<LoadoutArchetype, string> = {
  cooperation: 'Boosts kick in on days the family moves together.',
  recovery: 'Boosts kick in when you return after a quiet stretch.',
  variety: 'Boosts kick in when you complete habits from multiple categories.',
  challenge: 'Boosts kick in for harder, rarer goals.',
  consistency: 'A small steady boost for showing up regularly.',
};

const ARCHETYPE_COLOR: Record<LoadoutArchetype, string> = {
  cooperation: '#7adff2',
  recovery: '#ff9aa2',
  variety: '#a8e6cf',
  challenge: '#ffd166',
  consistency: '#bcb4ff',
};

export function archetypeFor(category: AchievementCategory): LoadoutArchetype {
  return ARCHETYPE_BY_CATEGORY[category] ?? 'consistency';
}

export function archetypeLabel(archetype: LoadoutArchetype): string {
  return ARCHETYPE_LABEL[archetype];
}

export function archetypeDescription(archetype: LoadoutArchetype): string {
  return ARCHETYPE_DESCRIPTION[archetype];
}

export function archetypeColor(archetype: LoadoutArchetype): string {
  return ARCHETYPE_COLOR[archetype];
}

export interface EquippedInsignia {
  badge: AchievementProgress;
  archetype: LoadoutArchetype;
  /** Per-insignia bonus percent contributed to the loadout. */
  percent: number;
}

export interface LoadoutSummary {
  equipped: EquippedInsignia[];
  /** Sum of percents from equipped insignias, after the loadout cap. */
  loadoutBonusPercent: number;
  /** Map of archetype → contributing percent for quick UI lookups. */
  byArchetype: Record<LoadoutArchetype, number>;
}

export function buildLoadoutSummary(
  equippedIds: readonly string[],
  achievements: readonly AchievementProgress[],
): LoadoutSummary {
  const byId = new Map(achievements.map(a => [a.achievementId, a]));
  const equipped: EquippedInsignia[] = [];
  const byArchetype: Record<LoadoutArchetype, number> = {
    cooperation: 0,
    recovery: 0,
    variety: 0,
    challenge: 0,
    consistency: 0,
  };
  let raw = 0;

  for (const id of equippedIds) {
    const badge = byId.get(id);
    if (!badge) continue;
    if (!badge.isUnlocked) continue;
    const archetype = archetypeFor(badge.category);
    const percent = RARITY_BONUS[badge.rarity];
    equipped.push({ badge, archetype, percent });
    byArchetype[archetype] += percent;
    raw += percent;
  }

  // Cap the *sum* at LOADOUT_BONUS_CAP — but report individual contributions
  // truthfully so the UI can show them. We scale the breakdown proportionally
  // when the cap kicks in, so totals always match the displayed sum.
  const capped = Math.min(LOADOUT_BONUS_CAP, raw);
  if (raw > LOADOUT_BONUS_CAP && raw > 0) {
    const scale = capped / raw;
    for (const arch of Object.keys(byArchetype) as LoadoutArchetype[]) {
      byArchetype[arch] = Math.round(byArchetype[arch] * scale * 10) / 10;
    }
  }

  return {
    equipped,
    loadoutBonusPercent: capped,
    byArchetype,
  };
}

export interface BonusBreakdown {
  momentumPercent: number;
  harmonyPercent: number;
  loadoutPercent: number;
  /** Final percent applied per completion. */
  totalPercent: number;
}

/** Lightweight loadout bonus calc keyed off achievement IDs only — used at
 *  completion time, where we have the equipped IDs and the set of unlocked
 *  IDs but don't want to rebuild the full AchievementProgress[] just to
 *  read each badge's rarity. Returns the same capped percent as
 *  buildLoadoutSummary().loadoutBonusPercent. */
export function loadoutBonusFromIds(
  equippedIds: readonly string[],
  unlockedIds: ReadonlySet<string>,
): number {
  let raw = 0;
  for (const id of equippedIds) {
    if (!unlockedIds.has(id)) continue;
    const def = ACHIEVEMENTS.find(a => a.achievementId === id);
    if (!def) continue;
    raw += RARITY_BONUS[def.rarity];
  }
  return Math.min(LOADOUT_BONUS_CAP, raw);
}

/** Compose the final passive bonus a member gets per completion. Always
 *  capped at TOTAL_BONUS_CAP — momentum, harmony, and loadout cannot
 *  combine into runaway grinding. */
export function composeBonusPercent(opts: {
  momentumPercent: number;
  harmonyPercent: number;
  loadoutPercent: number;
}): BonusBreakdown {
  const momentum = Math.max(0, Math.min(LOADOUT_BONUS_CAP, opts.momentumPercent));
  const harmony = Math.max(0, Math.min(LOADOUT_BONUS_CAP, opts.harmonyPercent));
  const loadout = Math.max(0, Math.min(LOADOUT_BONUS_CAP, opts.loadoutPercent));
  const total = Math.min(TOTAL_BONUS_CAP, momentum + harmony + loadout);
  return {
    momentumPercent: momentum,
    harmonyPercent: harmony,
    loadoutPercent: loadout,
    totalPercent: Math.round(total * 10) / 10,
  };
}
