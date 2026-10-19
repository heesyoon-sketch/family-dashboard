import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DailySchedule, ShieldCompletion } from './engine';
import { CAP_BP, RATE_BP, SLOT_OF, WEEKLY_RULES, bonusPoints, scopeApplies, tierFor, weekProgress } from './weekly';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const MIGRATION = 'supabase/migrations/20261019180000_weekly_window_shields.sql';
const TZ = 'America/Toronto';
const slot = (taskId: string, window: 'morning' | 'evening') => ({ taskId, title: taskId, icon: '', window });
// Week of Mon Oct 12 – Sun Oct 18, 2026.
const days = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'];
const schedules: DailySchedule[] = days.map(day => ({ userId: 'kid', day, slots: [slot('wake', 'morning'), slot('teeth', 'morning'), slot('homework', 'evening'), slot('shower', 'evening')] }));
let n = 0;
const at = (day: string, hour: number) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00-04:00`).toISOString();
const done = (taskId: string, day: string, hour: number): ShieldCompletion => ({ id: `c${n++}`, userId: 'kid', taskId, completedAt: at(day, hour) });

test('rules and rates match shield_config in the migration', () => {
  const rules = JSON.parse(read(MIGRATION).match(/rules = '(\{.*?\})'::jsonb/)![1]);
  assert.deepEqual(rules.rateBp, RATE_BP);
  assert.equal(rules.capBp, CAP_BP);
  assert.equal(rules.minCoveredDays, WEEKLY_RULES.minCoveredDays);
  assert.deepEqual(rules.window, { ...WEEKLY_RULES.window });
  assert.deepEqual(rules.bonus, { ...WEEKLY_RULES.bonus });
  assert.equal(rules.countsTowardXp, false);
});

test('morning and evening are scored separately from their own slots', () => {
  const completions = days.flatMap(day => [done('wake', day, 7), done('teeth', day, 7), done('homework', day, 18)]);
  const p = weekProgress({ userId: 'kid', weekStart: '2026-10-12', schedules, completions, bonusTaskIds: new Set(), timezone: TZ });
  assert.equal(p.morning.tier, 'legendary');
  assert.deepEqual([p.morning.completed, p.morning.eligible, p.morning.rate], [14, 14, 100]);
  assert.equal(p.evening.rate, 50);
  assert.equal(p.evening.tier, null);
  assert.deepEqual(p.evening.next, { tier: 'silver', needed: 3 }, '10/14 = 71% → silver');
});

test('tier boundaries are exact', () => {
  assert.equal(tierFor(69.9, WEEKLY_RULES.window), null);
  assert.equal(tierFor(70, WEEKLY_RULES.window), 'silver');
  assert.equal(tierFor(84.6, WEEKLY_RULES.window), 'silver');
  assert.equal(tierFor(85, WEEKLY_RULES.window), 'gold');
  assert.equal(tierFor(95, WEEKLY_RULES.window), 'epic');
  assert.equal(tierFor(100, WEEKLY_RULES.window), 'legendary');
  assert.equal(tierFor(2, WEEKLY_RULES.bonus), null);
  assert.equal(tierFor(3, WEEKLY_RULES.bonus), 'silver');
  assert.equal(tierFor(7, WEEKLY_RULES.bonus), 'legendary');
});

test('too few slots in a window earns nothing in that window', () => {
  const sparse: DailySchedule[] = [{ userId: 'kid', day: '2026-10-12', slots: [slot('wake', 'morning')] }, { userId: 'kid', day: '2026-10-13', slots: [slot('wake', 'morning')] }];
  const p = weekProgress({ userId: 'kid', weekStart: '2026-10-12', schedules: sparse, completions: [done('wake', '2026-10-12', 7), done('wake', '2026-10-13', 7)], bonusTaskIds: new Set(), timezone: TZ });
  assert.equal(p.morning.rate, 100);
  assert.equal(p.morning.tier, null);
});

test('bonus shield counts bonus days and needs the required routine first', () => {
  const required = days.flatMap(day => [done('wake', day, 7), done('teeth', day, 7), done('homework', day, 18), done('shower', day, 19)]);
  const reading = days.slice(0, 5).flatMap(day => [done('read', day, 16), done('read', day, 17)]);
  const p = weekProgress({ userId: 'kid', weekStart: '2026-10-12', schedules, completions: [...required, ...reading], bonusTaskIds: new Set(['read']), timezone: TZ });
  assert.equal(p.bonus.bonusDays, 5, 'two in a day still count once');
  assert.equal(p.bonus.tier, 'epic');

  // Same bonus days, but the required routine only 50% done.
  const half = days.flatMap(day => [done('wake', day, 7), done('homework', day, 18)]);
  const gated = weekProgress({ userId: 'kid', weekStart: '2026-10-12', schedules, completions: [...half, ...reading], bonusTaskIds: new Set(['read']), timezone: TZ });
  assert.equal(gated.bonus.gated, true);
  assert.equal(gated.bonus.tier, null);
});

test('a task that was required that day never counts as a bonus day', () => {
  // "tidy" became a bonus task later; it was a required slot on the 12th.
  const withTidy = schedules.map(s => s.day === '2026-10-12' ? { ...s, slots: [...s.slots, slot('tidy', 'evening')] } : s);
  const required = days.flatMap(day => [done('wake', day, 7), done('teeth', day, 7), done('homework', day, 18), done('shower', day, 19)]);
  const p = weekProgress({ userId: 'kid', weekStart: '2026-10-12', schedules: withTidy, completions: [...required, done('tidy', '2026-10-12', 20)], bonusTaskIds: new Set(['tidy']), timezone: TZ });
  assert.equal(p.bonus.bonusDays, 0);
  // And a day with no snapshot can't be told apart, so it never counts either.
  const noSnap = weekProgress({ userId: 'kid', weekStart: '2026-10-12', schedules: withTidy.slice(1), completions: [...required, done('read', '2026-10-12', 16)], bonusTaskIds: new Set(['read']), timezone: TZ });
  assert.equal(noSnap.bonus.bonusDays, 0);
});

test('live progress leaves today’s open windows out', () => {
  const live = weekProgress({ userId: 'kid', weekStart: '2026-10-12', schedules, completions: [done('wake', '2026-10-12', 7)], bonusTaskIds: new Set(), timezone: TZ, today: '2026-10-12', nowHour: 9 });
  assert.equal(live.morning.eligible, 1, 'only the finished morning slot');
  assert.equal(live.evening.eligible, 0);
  assert.equal(live.coveredDays, 1);
});

test('scopes never overlap, so a completion gets at most one shield', () => {
  const scopes = [{ kind: 'window', window: 'morning' }, { kind: 'window', window: 'evening' }, { kind: 'bonus' }] as const;
  for (const c of [{ optional: false, window: 'morning' }, { optional: false, window: 'evening' }, { optional: true, window: 'morning' }, { optional: true, window: 'evening' }] as const) {
    assert.equal(scopes.filter(s => scopeApplies(s, c)).length, 1);
  }
  assert.equal(bonusPoints(30, RATE_BP.legendary), 4, 'floor(30 × 15%)');
  assert.equal(bonusPoints(10, RATE_BP.silver), 0);
  assert.deepEqual(SLOT_OF, { morning: 1, evening: 2, bonus: 3 });
});

test('the database evaluates, equips and pays with the same rules', () => {
  const sql = read(MIGRATION);
  assert.match(sql, /create or replace function public\.finalize_shield_week\(p_family_id uuid, p_week date\)/);
  assert.match(sql, /add constraint shield_awards_kind check \(shield_type in \('morning', 'evening', 'bonus'\)\)/);
  assert.match(sql, /add constraint shield_awards_equip_next_week check \(equipment_month = evaluation_month \+ 7\)/);
  assert.match(sql, /when 'window' then v_task\.task_type <> 'optional' and v_row\.scope ->> 'window' = p_current_window/);
  assert.match(sql, /when 'bonus' then v_task\.task_type = 'optional'/);
  assert.match(sql, /grant execute on function public\.finalize_due_shield_weeks\(uuid\) to service_role/);
  assert.match(sql, /revoke all on function public\.finalize_shield_week\(uuid, date\) from public, anon, authenticated/);
  // The bonus-day snapshot guard lives in the follow-up migration.
  assert.match(read('supabase/migrations/20261019190000_weekly_shields_bonus_day_snapshot.sql'), /Only days with a snapshot/);
  assert.match(read('lib/shields/finalize.ts'), /db\.rpc\('finalize_due_shield_weeks', \{ p_family_id: familyId \}\)/);
});

test('the dashboard always shows all three weekly slots, empty ones included', () => {
  const strip = read('components/EquippedShields.tsx');
  assert.match(strip, /const slots = SHIELD_TYPES\.map\(type => \(\{ type, shield: mine\.find\(s => s\.shieldType === type\) \?\? null \}\)\)/);
  assert.match(strip, /<EmptyShield size=/);
  assert.doesNotMatch(strip, /legacyInsigniaBonusActive|InsigniaBadge/, 'the insignia stand-in ended with weekly shields');
  const wall = read('components/hall/ShieldWall.tsx');
  assert.match(wall, /\{SHIELD_TYPES\.map\(type => \{\n\s+const award = view\.equipped\[type\];/);
});
