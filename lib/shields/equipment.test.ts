import test from 'node:test';
import assert from 'node:assert/strict';
import type { PeriodTally, ShieldCandidate, Tally } from './engine';
import {
  CAP_BP,
  RATE_BP,
  autoEquip,
  bonusFor,
  improvedCategories,
  monthlyAwards,
  scopeFor,
  summarizeLoadout,
  validateLoadout,
  type EquippableAward,
} from './equipment';

const t = (completed: number, eligible: number, days = 20): Tally => ({ completed, eligible, days, coveredDays: 30, periodDays: 30 });
const P = (total: Tally, byCategory: PeriodTally['byCategory'] = {}): PeriodTally => ({ ...total, byCategory });
const M = '2026-12-01';
const award = (id: string, shieldType: EquippableAward['shieldType'], tier: EquippableAward['tier'], scope: EquippableAward['scope'], rate = RATE_BP[tier], equipmentMonth = M): EquippableAward =>
  ({ id, shieldType, tier, scope, bonusRateBp: rate, equipmentMonth });
const cand = (type: ShieldCandidate['type'], tier: ShieldCandidate['tier'], category: ShieldCandidate['category'] = null): ShieldCandidate =>
  ({ type, tier, category, status: tier ? 'qualified' : 'not_qualified', reason: 'x', metrics: {} });

test('tier rates and the 30% cap', () => {
  assert.deepEqual(RATE_BP, { silver: 200, gold: 500, epic: 1000, legendary: 1500 });
  assert.equal(CAP_BP, 3000);
  const loadout = [
    award('a', 'consistency', 'legendary', { kind: 'all' }),
    award('b', 'growth', 'legendary', { kind: 'all' }),
    award('c', 'dedication', 'legendary', { kind: 'categories', categories: ['learning'] }),
  ];
  const r = bonusFor(loadout, { categories: ['learning'], isMissionTask: false }, 15);
  assert.equal(r.sumBp, 4500);
  assert.equal(r.rateBp, 3000, 'capped at 30%');
  assert.equal(r.bonus, 4, 'floor(15 × 0.30) = 4');
});

test('bonus uses integer floor math on base points only', () => {
  const gold = [award('a', 'consistency', 'gold', { kind: 'all' })];
  assert.equal(bonusFor(gold, { categories: [], isMissionTask: false }, 10).bonus, 0, 'floor(10 × 5%) = 0');
  assert.equal(bonusFor(gold, { categories: [], isMissionTask: false }, 20).bonus, 1);
  assert.equal(bonusFor(gold, { categories: [], isMissionTask: false }, 39).bonus, 1, 'floor(1.95)');
  assert.equal(bonusFor(gold, { categories: [], isMissionTask: false }, -5).bonus, 0);
  assert.equal(bonusFor([], { categories: [], isMissionTask: false }, 100).bonus, 0);
});

test('scopes: category, mission, universal', () => {
  const loadout = [
    award('d', 'dedication', 'epic', { kind: 'categories', categories: ['exercise'] }),
    award('t', 'teamwork', 'gold', { kind: 'mission' }),
  ];
  assert.equal(bonusFor(loadout, { categories: ['learning'], isMissionTask: false }, 100).rateBp, 0);
  assert.equal(bonusFor(loadout, { categories: ['exercise'], isMissionTask: false }, 100).rateBp, 1000);
  assert.equal(bonusFor(loadout, { categories: ['exercise'], isMissionTask: true }, 100).rateBp, 1500);
  assert.equal(bonusFor(loadout, { categories: [], isMissionTask: true }, 100).bonus, 5);
});

test('growth/comeback scope: verified categories, otherwise universal at half rate', () => {
  const cur = P(t(80, 100), { learning: t(19, 20), exercise: t(12, 20) });
  const prev = P(t(60, 100), { learning: t(10, 20), exercise: t(12, 20) });
  assert.deepEqual(improvedCategories(cur, prev), ['learning']);
  assert.deepEqual(scopeFor(cand('growth', 'epic'), cur, prev), { scope: { kind: 'categories', categories: ['learning'] }, rateBp: 1000, fallback: false });
  // Too few category occurrences to verify → fallback.
  const thin = P(t(80, 100), { learning: t(5, 5) });
  const thinPrev = P(t(60, 100), { learning: t(1, 5) });
  assert.deepEqual(scopeFor(cand('comeback', 'gold'), thin, thinPrev), { scope: { kind: 'all' }, rateBp: 250, fallback: true });
  assert.deepEqual(scopeFor(cand('growth', 'silver'), cur, null), { scope: { kind: 'all' }, rateBp: 100, fallback: true });
});

test('every qualified type becomes an award; unqualified ones do not', () => {
  const cur = P(t(90, 100), { learning: t(20, 20) });
  const drafts = monthlyAwards([cand('consistency', 'epic'), cand('dedication', 'legendary', 'learning'), cand('teamwork', null), cand('growth', null)], cur, null);
  assert.deepEqual(drafts.map(d => [d.shield_type, d.tier, d.bonus_rate_bp]), [['consistency', 'epic', 1000], ['dedication', 'legendary', 1500]]);
  assert.deepEqual(drafts[1].scope, { kind: 'categories', categories: ['learning'] });
  assert.equal(drafts[0].category, null);
});

test('auto-equip picks the best three, one per type, this month only', () => {
  const awards = [
    award('cons', 'consistency', 'gold', { kind: 'all' }),
    award('ded', 'dedication', 'legendary', { kind: 'categories', categories: ['learning'] }),
    award('team', 'teamwork', 'gold', { kind: 'mission' }),
    award('grow', 'growth', 'silver', { kind: 'all' }, 100),
    award('old', 'comeback', 'legendary', { kind: 'all' }, 1500, '2026-11-01'),
  ];
  assert.deepEqual(autoEquip(awards, M), ['ded', 'cons', 'team'], 'equal gold rate: broader scope first');
  assert.deepEqual(autoEquip([], M), []);
});

test('loadout validation mirrors the server', () => {
  const awards = [
    award('a', 'consistency', 'gold', { kind: 'all' }),
    award('b', 'dedication', 'gold', { kind: 'categories', categories: ['faith'] }),
    award('c', 'teamwork', 'gold', { kind: 'mission' }),
    award('d', 'growth', 'gold', { kind: 'all' }),
    award('e', 'consistency', 'gold', { kind: 'all' }),
    award('f', 'comeback', 'gold', { kind: 'all' }, 500, '2026-11-01'),
  ];
  assert.equal(validateLoadout(['a', 'b', 'c'], awards, M), null);
  assert.equal(validateLoadout([], awards, M), null);
  assert.equal(validateLoadout(['a', 'b', 'c', 'd'], awards, M), 'too_many');
  assert.equal(validateLoadout(['a', 'a'], awards, M), 'duplicate');
  assert.equal(validateLoadout(['a', 'e'], awards, M), 'same_type');
  assert.equal(validateLoadout(['f'], awards, M), 'not_available', 'last month’s equipment expired');
  assert.equal(validateLoadout(['zzz'], awards, M), 'not_available');
});

test('loadout summary reports universal, category, mission, and the capped best case', () => {
  const s = summarizeLoadout([
    award('a', 'consistency', 'epic', { kind: 'all' }),
    award('b', 'dedication', 'legendary', { kind: 'categories', categories: ['learning'] }),
    award('c', 'teamwork', 'epic', { kind: 'mission' }),
  ]);
  assert.equal(s.universalBp, 1000);
  assert.deepEqual(s.categoryBp, { learning: 1500 });
  assert.equal(s.missionBp, 1000);
  assert.equal(s.maxBp, 3000);
  assert.equal(s.capped, true);
});
