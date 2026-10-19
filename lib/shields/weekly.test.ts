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

test('rules and rates match shield_config in the migrations', () => {
  const rules = JSON.parse(read(MIGRATION).match(/rules = '(\{.*?\})'::jsonb/)![1]);
  // Bronze was added by a follow-up migration with jsonb_set.
  const bronze = read('supabase/migrations/20261019210000_bronze_shields.sql');
  assert.match(bronze, /'\{rateBp,bronze\}', '0'/);
  assert.match(bronze, /'\{window,bronze\}', '50'/);
  assert.match(bronze, /'\{bonus,bronze\}', '1'/);
  rules.rateBp.bronze = 0; rules.window.bronze = 50; rules.bonus.bronze = 1;
  // Legendary bonus moved to 6 days (one rest day) in a later migration.
  assert.match(read('supabase/migrations/20261019230000_bonus_shield_rest_day.sql'), /jsonb_set\(rules, '\{bonus,legendary\}', '6'\)/);
  rules.bonus.legendary = 6;
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
  assert.equal(p.evening.tier, 'bronze', '50% is Bronze — recognition, no bonus');
  assert.equal(RATE_BP.bronze, 0);
  assert.deepEqual(p.evening.next, { tier: 'silver', needed: 3 }, '10/14 = 71% → silver');
});

test('tier boundaries are exact', () => {
  assert.equal(tierFor(49.9, WEEKLY_RULES.window), null);
  assert.equal(tierFor(50, WEEKLY_RULES.window), 'bronze');
  assert.equal(tierFor(69.9, WEEKLY_RULES.window), 'bronze');
  assert.equal(tierFor(70, WEEKLY_RULES.window), 'silver');
  assert.equal(tierFor(84.6, WEEKLY_RULES.window), 'silver');
  assert.equal(tierFor(85, WEEKLY_RULES.window), 'gold');
  assert.equal(tierFor(95, WEEKLY_RULES.window), 'epic');
  assert.equal(tierFor(100, WEEKLY_RULES.window), 'legendary');
  assert.equal(tierFor(0, WEEKLY_RULES.bonus), null);
  assert.equal(tierFor(2, WEEKLY_RULES.bonus), 'bronze');
  assert.equal(tierFor(3, WEEKLY_RULES.bonus), 'silver');
  assert.equal(tierFor(5, WEEKLY_RULES.bonus), 'epic');
  assert.equal(tierFor(6, WEEKLY_RULES.bonus), 'legendary', 'one rest day still earns Legendary');
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
  assert.equal(gated.bonus.tier, 'bronze', 'bonus days still earn Bronze, never more');
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
  assert.equal(bonusPoints(30, RATE_BP.legendary), 5, 'ceil(30 × 15%) = ceil(4.5)');
  assert.equal(bonusPoints(10, RATE_BP.silver), 1, 'a 10-point habit still gets +1');
  assert.equal(bonusPoints(10, RATE_BP.gold), 1);
  assert.equal(bonusPoints(10, RATE_BP.legendary), 2);
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

test('the server ignores any client-sent bonus percent', () => {
  const sql = read('supabase/migrations/20261019200000_ignore_client_bonus_percent.sql');
  assert.match(sql, /v_bonus_pct := 0;/);
  assert.doesNotMatch(sql, /coalesce\(p_bonus_percent/);
});

test('bronze shields fill the slot but never pay, and add no ledger rows', () => {
  const sql = read('supabase/migrations/20261019210000_bronze_shields.sql');
  assert.match(sql, /check \(tier in \('bronze', 'silver', 'gold', 'epic', 'legendary'\)\)/);
  assert.match(sql, /if coalesce\(\(v_quote ->> 'rateBp'\)::integer, 0\) = 0 then return null; end if;/);
  assert.match(sql, /when v_bonus_days >= \(v_rules #>> '\{bonus,bronze\}'\)::int then 'bronze'/);
  assert.equal(bonusPoints(50, RATE_BP.bronze), 0);
});

test('undo works when a shield bonus rounded down to 0', () => {
  const sql = read('supabase/migrations/20261019220000_fix_zero_shield_bonus_undo.sql');
  // A 0-point award is never reversed (the ledger rejects a 0-point reversal).
  assert.match(sql, /if v_entry\.bonus_points <= 0 then return 0; end if;/);
  // And new 0-point bonuses are not recorded at all.
  assert.match(sql, /if v_bonus <= 0 then return null; end if;/);
});

test('a server error is shown, not queued as offline; paused retries never loop', () => {
  const store = read('lib/store.ts');
  assert.equal(store.match(/if \(error instanceof RpcError && error\.code !== null\) \{\n\s+await get\(\)\.hydrate\(\);\n\s+throw error;/g)?.length, 2, 'complete and undo');
  assert.match(store, /if \(processed > 0\) \{\n\s+await get\(\)\.hydrate\(\);\n\s+broadcastSync\(\);/);
  assert.match(read('components/TaskCard.tsx'), /description: error instanceof Error \? error\.message : undefined/);
});

test('a bonus day is any bonus task, not the same one every day', () => {
  // Monday laundry, Tuesday reading, Wednesday helping — three different
  // tasks still make three bonus days.
  const required = days.flatMap(day => [done('wake', day, 7), done('teeth', day, 7), done('homework', day, 18), done('shower', day, 19)]);
  const mixed = [done('laundry', '2026-10-12', 17), done('read', '2026-10-13', 17), done('help', '2026-10-14', 17)];
  const p = weekProgress({ userId: 'kid', weekStart: '2026-10-12', schedules, completions: [...required, ...mixed], bonusTaskIds: new Set(['laundry', 'read', 'help']), timezone: TZ });
  assert.equal(p.bonus.bonusDays, 3);
  assert.equal(p.bonus.tier, 'silver');
  assert.match(read('lib/shields/copy.ts'), /매일 같은 과제일 필요는 없어서/);
});

test('shield bonuses round up so small habits still feel them', () => {
  const sql = read('supabase/migrations/20261019240000_shield_bonus_round_up.sql');
  assert.match(sql, /'bonusPoints', \(greatest\(p_base_points, 0\) \* v_rate \+ 9999\) \/ 10000/);
  // Kid-sized habits: 10/15/30/50 points across the tiers.
  const table = [10, 15, 30, 50].map(base => (['silver', 'gold', 'epic', 'legendary'] as const).map(t => bonusPoints(base, RATE_BP[t])));
  assert.deepEqual(table, [[1, 1, 1, 2], [1, 1, 2, 3], [1, 2, 3, 5], [1, 3, 5, 8]]);
});
