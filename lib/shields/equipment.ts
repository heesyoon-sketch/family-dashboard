// Shield Wall 4.0 — monthly equipment and scoped bonuses (pure).
//
// EARN LAST MONTH. EQUIP THIS MONTH. Every Shield type a member qualifies
// for in month A becomes an award equippable during month A+1 only. Up to
// three can be equipped, one per type. An equipped Shield adds a bonus to
// the base points of the completions inside its scope:
//
//   Consistency  every habit
//   Dedication   habits of its category
//   Growth /     the categories that verifiably improved; when no category
//   Comeback     can be verified, every habit at half the rate
//   Teamwork     habits that are part of this week's Family Mission
//
// bonus = floor(base × min(sum of applicable rates, 30%)). The authoritative
// calculation runs in Postgres (apply_shield_bonus, same rules and integer
// math); this module mirrors it for the UI, finalization, and tests.

import { HABIT_CATEGORIES, type HabitCategory } from '@/lib/achievements/definitions';
import {
  RULES,
  TYPE_PREFERENCE,
  gainAtLeast,
  type PeriodTally,
  type ShieldCandidate,
  type ShieldTier,
  type ShieldType,
} from './engine';

export const EQUIP_VERSION = 'equip-v1';
export const MAX_EQUIPPED = 3;
/** Basis points: 100 bp = 1%. Mirrors shield_config.rules. */
export const RATE_BP: Record<ShieldTier, number> = { silver: 200, gold: 500, epic: 1000, legendary: 1500 };
export const CAP_BP = 3000;
export const FALLBACK_FACTOR_PCT = 50;

export type BonusScope =
  | { kind: 'all' }
  | { kind: 'categories'; categories: HabitCategory[] }
  | { kind: 'mission' };

export interface MonthlyAwardDraft {
  shield_type: ShieldType;
  tier: ShieldTier;
  category: string | null;
  scope: BonusScope;
  bonus_rate_bp: number;
  qualification_metrics: Record<string, unknown>;
}

/** Categories whose own completion rate rose by at least the monthly Growth
 *  Silver margin, with enough occurrences in both months to be trusted. */
export function improvedCategories(current: PeriodTally, previous: PeriodTally): HabitCategory[] {
  const min = RULES.month.dedication.minOccurrences;
  return HABIT_CATEGORIES.filter(cat => {
    const cur = current.byCategory[cat];
    const prev = previous.byCategory[cat];
    return !!cur && !!prev && cur.eligible >= min && prev.eligible >= min && gainAtLeast(cur, prev, RULES.month.growth.silver);
  });
}

export function scopeFor(candidate: Pick<ShieldCandidate, 'type' | 'tier' | 'category'>, current: PeriodTally, previous: PeriodTally | null): { scope: BonusScope; rateBp: number; fallback: boolean } {
  const full = RATE_BP[candidate.tier ?? 'silver'];
  switch (candidate.type) {
    case 'consistency':
      return { scope: { kind: 'all' }, rateBp: full, fallback: false };
    case 'dedication':
      return { scope: { kind: 'categories', categories: [candidate.category as HabitCategory] }, rateBp: full, fallback: false };
    case 'teamwork':
      return { scope: { kind: 'mission' }, rateBp: full, fallback: false };
    case 'growth':
    case 'comeback': {
      const cats = previous ? improvedCategories(current, previous) : [];
      if (cats.length) return { scope: { kind: 'categories', categories: cats }, rateBp: full, fallback: false };
      return { scope: { kind: 'all' }, rateBp: Math.floor((full * FALLBACK_FACTOR_PCT) / 100), fallback: true };
    }
  }
}

/** One award per qualified Shield type (not only the month's winner). */
export function monthlyAwards(candidates: ShieldCandidate[], current: PeriodTally, previous: PeriodTally | null, extra: Record<string, unknown> = {}): MonthlyAwardDraft[] {
  return candidates
    .filter(c => c.status === 'qualified' && c.tier)
    .map(c => {
      const { scope, rateBp, fallback } = scopeFor(c, current, previous);
      return {
        shield_type: c.type,
        tier: c.tier!,
        category: c.type === 'dedication' ? c.category : null,
        scope,
        bonus_rate_bp: rateBp,
        qualification_metrics: { ...c.metrics, reason: c.reason, scopeFallback: fallback, ...extra },
      };
    });
}

// ---------------------------------------------------------------------------
// Loadouts
// ---------------------------------------------------------------------------

export interface EquippableAward {
  id: string;
  shieldType: ShieldType;
  tier: ShieldTier;
  scope: BonusScope;
  bonusRateBp: number;
  equipmentMonth: string;
}

/** Rough share of habits a scope reaches: all > categories > mission. */
export function scopeBreadth(scope: BonusScope): number {
  return scope.kind === 'all' ? 100 : scope.kind === 'categories' ? Math.min(90, 10 * scope.categories.length) : 5;
}

/** Default loadout: highest rate first, then the broadest scope, then the
 *  usual type preference. At most one per type, at most three. */
export function autoEquip(awards: EquippableAward[], month: string): string[] {
  const usable = awards.filter(a => a.equipmentMonth === month);
  const sorted = [...usable].sort((a, b) =>
    b.bonusRateBp - a.bonusRateBp
    || scopeBreadth(b.scope) - scopeBreadth(a.scope)
    || TYPE_PREFERENCE.indexOf(a.shieldType) - TYPE_PREFERENCE.indexOf(b.shieldType)
    || a.id.localeCompare(b.id));
  const out: EquippableAward[] = [];
  for (const a of sorted) {
    if (out.length >= MAX_EQUIPPED) break;
    if (out.some(o => o.shieldType === a.shieldType)) continue;
    out.push(a);
  }
  return out.map(a => a.id);
}

export type LoadoutError = 'too_many' | 'duplicate' | 'same_type' | 'not_available';

/** Same rules shield_set_loadout enforces server-side. */
export function validateLoadout(ids: string[], awards: EquippableAward[], month: string): LoadoutError | null {
  if (ids.length > MAX_EQUIPPED) return 'too_many';
  if (new Set(ids).size !== ids.length) return 'duplicate';
  const picked = ids.map(id => awards.find(a => a.id === id));
  if (picked.some(a => !a || a.equipmentMonth !== month)) return 'not_available';
  if (new Set(picked.map(a => a!.shieldType)).size !== picked.length) return 'same_type';
  return null;
}

// ---------------------------------------------------------------------------
// Bonus
// ---------------------------------------------------------------------------

export interface BonusTarget {
  categories: HabitCategory[];
  isMissionTask: boolean;
}

export function scopeApplies(scope: BonusScope, target: BonusTarget): boolean {
  if (scope.kind === 'all') return true;
  if (scope.kind === 'mission') return target.isMissionTask;
  return scope.categories.some(c => target.categories.includes(c));
}

export function bonusFor(loadout: EquippableAward[], target: BonusTarget, basePoints: number): { sumBp: number; rateBp: number; bonus: number; applied: string[] } {
  const applied = loadout.filter(a => scopeApplies(a.scope, target));
  const sumBp = applied.reduce((n, a) => n + a.bonusRateBp, 0);
  const rateBp = Math.min(sumBp, CAP_BP);
  // Integer math only, like the database: floor(base × rate / 10000).
  const bonus = Math.floor((Math.max(0, Math.trunc(basePoints)) * rateBp) / 10000);
  return { sumBp, rateBp, bonus, applied: applied.map(a => a.id) };
}

export interface LoadoutSummary {
  /** Applies to every habit. */
  universalBp: number;
  /** Extra on top of universal, per category. */
  categoryBp: Partial<Record<HabitCategory, number>>;
  missionBp: number;
  /** Best case for a single habit, after the cap. */
  maxBp: number;
  capped: boolean;
}

export function summarizeLoadout(loadout: EquippableAward[]): LoadoutSummary {
  let universalBp = 0;
  let missionBp = 0;
  const categoryBp: Partial<Record<HabitCategory, number>> = {};
  for (const a of loadout) {
    if (a.scope.kind === 'all') universalBp += a.bonusRateBp;
    else if (a.scope.kind === 'mission') missionBp += a.bonusRateBp;
    else for (const c of a.scope.categories) categoryBp[c] = (categoryBp[c] ?? 0) + a.bonusRateBp;
  }
  const bestCategory = Math.max(0, ...Object.values(categoryBp).map(v => v ?? 0));
  // A habit can be in a scoped category and in the mission at once.
  const raw = universalBp + bestCategory + missionBp;
  return { universalBp, categoryBp, missionBp, maxBp: Math.min(raw, CAP_BP), capped: raw > CAP_BP };
}

export const formatBp = (bp: number) => `${Number.isInteger(bp / 100) ? bp / 100 : (bp / 100).toFixed(1)}%`;
