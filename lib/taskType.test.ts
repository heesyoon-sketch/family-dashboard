import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import type { DayOfWeek, Task } from './db';
import { mapTask } from './admin/adminHelpers';
import { isPerfectRoutineDay, splitCompletionsByWindow } from './perfectDay';
import {
  BONUS_TASK_TEMPLATES,
  isOptionalTask,
  normalizeTaskType,
  requiredTasks,
  splitEarnedPoints,
  summarizeTaskDay,
} from './taskType';
import {
  buildMemberHistory,
  habitPerformance,
  periodRange,
  summarizeRange,
  type AnalyticsCompletion,
  type AnalyticsMember,
  type AnalyticsTask,
} from './analytics/history';
import { planMissionWeek, protectionStatus } from './analytics/family';
import { completedSlotKeys, tallyPeriod, periodContaining, type DailySchedule } from './shields/engine';
import { liveProgress } from './shields/live';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const MIGRATION = 'supabase/migrations/20261019120000_optional_bonus_tasks.sql';

const ALL: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const TZ = 'Asia/Seoul';
// 2026-10-14 is a Wednesday. 15:00 KST: morning closed, evening open.
const NOW = new Date('2026-10-14T15:00:00+09:00');

function task(id: string, extra: Partial<Task> = {}): Task {
  return {
    id, userId: 'kid', title: id, icon: 'circle', difficulty: 'EASY', basePoints: 10,
    recurrence: 'daily', daysOfWeek: ALL, timeWindow: 'evening', active: 1, sortOrder: 0,
    streakCount: 0, lastCompletedAt: null, ...extra,
  };
}
const member = (id: string): AnalyticsMember => ({ id, name: id, role: 'CHILD', createdAt: '2026-01-01T00:00:00+09:00' });
const habit = (id: string, userId: string, extra: Partial<AnalyticsTask> = {}): AnalyticsTask => ({
  id, userId, title: id, icon: '', daysOfWeek: ALL, timeWindow: 'evening', active: true,
  createdAt: '2026-10-01T00:00:00+09:00', deletedAt: null, streakCount: 0, ...extra,
});
let n = 0;
const done = (userId: string, taskId: string, at: string): AnalyticsCompletion => ({ id: `c${n++}`, userId, taskId, completedAt: at, partial: false });

// 1. Parent creates a required task -------------------------------------------

test('new and legacy tasks default to required', () => {
  assert.equal(normalizeTaskType(undefined), 'required');
  assert.equal(normalizeTaskType(null), 'required');
  assert.equal(normalizeTaskType('anything'), 'required');
  assert.equal(normalizeTaskType('optional'), 'optional');

  const admin = read('app/admin/page.tsx');
  assert.match(admin, /useState<TaskType>\('required'\)/);
  assert.match(admin, /p_task_type: newTaskType/);
  // The form resets to Required after each add.
  assert.match(admin, /setNewTaskType\('required'\)/);

  const migration = read(MIGRATION);
  assert.match(migration, /add column if not exists task_type text not null default 'required'/);
  assert.match(migration, /p_task_type text default 'required'/);
});

// 2. Parent creates an optional task ------------------------------------------

test('optional tasks are created and edited through the existing admin RPCs', () => {
  const migration = read(MIGRATION);
  assert.match(migration, /check \(task_type in \('required', 'optional'\)\)/);
  assert.match(migration, /drop function if exists public\.admin_insert_task\(text, text, text, text, integer, text, text\[\], integer, integer\);/);
  assert.match(migration, /task_type = coalesce\(p_patch->>'task_type', task_type\)/);
  assert.match(migration, /raise exception 'Invalid task type'/);

  const panel = read('components/admin/AdminTasksPanel.tsx');
  assert.match(panel, /Optional tasks give kids extra opportunities to earn points\. Skipping them has no penalty\./);
  assert.match(panel, /'Optional \/ Bonus'/);
  assert.match(panel, /updateTaskType\(task, value\)/);
  assert.match(read('app/admin/page.tsx'), /p_patch: \{ task_type: taskType \}/);
});

test('bonus templates are suggestions only, never seeded tasks', () => {
  assert.equal(BONUS_TASK_TEMPLATES.length, 5);
  for (const group of BONUS_TASK_TEMPLATES) {
    assert.ok(group.templates.length > 0);
    for (const template of group.templates) assert.ok(template.title.en && template.title.ko && template.icon);
  }
  assert.doesNotMatch(read(MIGRATION), /Read for 20 minutes|insert into public\.tasks \(\s*id, user_id, title, icon, difficulty, base_points, recurrence,\s*days_of_week, active, sort_order, family_id\s*\)/);
});

// 3. Bonus styling -------------------------------------------------------------

test('bonus tasks render with a lavender, labelled treatment that is not green', () => {
  const card = read('components/TaskCard.tsx');
  assert.match(card, /data-bonus=\{isBonus \|\| undefined\}/);
  assert.match(card, /<Icons\.Sparkles size=\{9\} aria-hidden \/>\{bonusLabel\}/);
  // Screen readers hear the type, so the distinction never relies on color.
  assert.match(card, /const spokenTitle = isBonus \? `\$\{bonusLabel\}: \$\{task\.title\}` : task\.title/);

  const css = read('app/globals.css');
  assert.match(css, /--bonus: #C4B5FD;/);
  const bonusRule = css.match(/\.member-task-card\[data-bonus="true"\] \{[^}]*\}/)?.[0] ?? '';
  assert.match(bonusRule, /var\(--bonus\)/);
  assert.doesNotMatch(bonusRule, /--success/);
  // A completed bonus task keeps the normal completed background plus the lavender edge.
  assert.match(css, /\[data-bonus="true"\]\[data-completed="true"\] \{\s*background: var\(--task-completed-bg\);\s*box-shadow: inset 3px 0 0 var\(--bonus\)/);

  const panel = read('components/MemberPanel.tsx');
  assert.match(panel, /visibleRequired\.map/);
  assert.match(panel, /visibleBonus\.map/);
  assert.ok(panel.indexOf('visibleRequired.map') < panel.indexOf('visibleBonus.map'), 'required tasks render first');
});

// 4. Completing a bonus task awards its points ----------------------------------

test('completed bonus tasks award their points and are tallied as bonus', () => {
  const tasks = [task('homework'), task('read', { taskType: 'optional', basePoints: 5 })];
  const summary = summarizeTaskDay(tasks, ['homework', 'read']);
  assert.equal(summary.bonusDone, 1);
  assert.equal(summary.bonusPointsEarned, 5);
  assert.equal(summary.requiredDone, 1);
  assert.equal(summary.requiredTotal, 1);

  const split = splitEarnedPoints(
    [{ taskId: 'homework', pointsAwarded: 10 }, { taskId: 'read', pointsAwarded: 5 }],
    tasks,
  );
  assert.deepEqual(split, { requiredPointsEarned: 10, bonusPointsEarned: 5, bonusCompleted: 1 });
  // Completion uses the same atomic RPC as required tasks; the migration
  // does not fork the points path.
  assert.doesNotMatch(read(MIGRATION), /function public\.process_task_completion_atomic/);
});

// 5. Skipping a bonus task costs nothing ------------------------------------------

test('routine penalties, perfect-day claims and quest eligibility count required tasks only', () => {
  const migration = read(MIGRATION);
  for (const fn of [
    'apply_morning_routine_penalties_before_sale_exemption',
    'apply_evening_routine_penalties_before_sale_exemption',
    'claim_perfect_day_coupon',
    'perfect_quest_day_is_eligible',
  ]) {
    const body = migration.slice(migration.indexOf(`FUNCTION public.${fn}(`));
    const end = body.indexOf('$function$;');
    const fnBody = body.slice(0, end);
    // Both the "due" count and the "done" count must skip bonus tasks.
    assert.equal(fnBody.match(/and t\.task_type = 'required'/g)?.length, 2, fn);
  }
});

test('an unfinished bonus task never leaves the routine deadline open', () => {
  const status = protectionStatus({
    members: [{ id: 'a' }],
    todayTasksByUser: { a: [{ id: 'm', timeWindow: 'morning' }, { id: 'read', timeWindow: 'evening', taskType: 'optional' }] },
    todayCompletionsByWindow: { a: { morning: ['m'], evening: [] } },
    nowHour: 15, vacation: false, saleDay: false, penaltiesToday: 0,
  });
  assert.equal(status.state, 'secured');
  assert.equal(status.openMembers, 0);
  assert.deepEqual(status.deadlines.find(d => d.window === 'evening')?.members, []);
});

// 6. Completion percentages ignore bonus tasks ------------------------------------

test('skipped bonus tasks do not lower the required completion rate', () => {
  const tasks = [task('a'), task('b'), task('read', { taskType: 'optional' }), task('hockey', { taskType: 'optional' })];
  const summary = summarizeTaskDay(tasks, ['a', 'b']);
  assert.equal(summary.requiredCompletionRate, 1);
  assert.equal(summary.requiredTotal, 2);
  assert.equal(summary.bonusDone, 0);

  // A bonus-only day is "nothing required", not 0%.
  assert.equal(summarizeTaskDay([task('read', { taskType: 'optional' })], []).requiredCompletionRate, null);

  const h = buildMemberHistory({
    member: member('kid'), now: NOW, timezone: TZ,
    tasks: [habit('a', 'kid'), habit('read', 'kid', { taskType: 'optional' })],
    completions: [done('kid', 'a', '2026-10-13T19:00:00+09:00')],
  });
  const day = summarizeRange(h, '2026-10-13', '2026-10-13');
  assert.equal(day.eligible, 1);
  assert.equal(day.rate, 1);
});

test('completed bonus tasks do not inflate the required completion rate', () => {
  const h = buildMemberHistory({
    member: member('kid'), now: NOW, timezone: TZ,
    tasks: [habit('a', 'kid'), habit('b', 'kid'), habit('read', 'kid', { taskType: 'optional' })],
    completions: [done('kid', 'a', '2026-10-13T19:00:00+09:00'), done('kid', 'read', '2026-10-13T19:30:00+09:00')],
  });
  const day = summarizeRange(h, '2026-10-13', '2026-10-13');
  assert.equal(day.eligible, 2);
  assert.equal(day.completed, 1);
  assert.equal(habitPerformance(h, [habit('read', 'kid', { taskType: 'optional' })], periodRange('week', h.today)).length, 0);

  const store = read('lib/store.ts');
  assert.match(store, /const userActiveTasks = requiredTasks\(/);
  assert.match(store, /const total = requiredTasks\(tasksByUser\[u\.id\]\)\.length/);
  assert.match(read('components/MobileMemberTabs.tsx'), /requiredTasks\(tasksByUser\[user\.id\] \?\? \[\]\)/);
});

// 7. Streaks and perfect days ------------------------------------------------------

test('a skipped bonus task never breaks a perfect day; a bonus alone never makes one', () => {
  const dayStart = new Date(2026, 7, 3, 0, 0, 0, 0);
  const at = (hour: number) => { const d = new Date(dayStart); d.setHours(hour); return d.toISOString(); };
  const tasks = [task('wake', { timeWindow: 'morning' }), task('homework'), task('read', { timeWindow: 'both', taskType: 'optional' })];
  const completions = splitCompletionsByWindow(tasks, [
    { task_id: 'wake', completed_at: at(8) },
    { task_id: 'homework', completed_at: at(18) },
  ], dayStart);
  assert.equal(isPerfectRoutineDay(tasks, completions), true);

  const bonusOnly = [task('read', { timeWindow: 'both', taskType: 'optional' })];
  const bonusDone = splitCompletionsByWindow(bonusOnly, [
    { task_id: 'read', completed_at: at(8) },
    { task_id: 'read', completed_at: at(18) },
  ], dayStart);
  assert.equal(isPerfectRoutineDay(bonusOnly, bonusDone), false);

  assert.match(read('lib/achievements/engine.ts'), /if \(task\.active !== 1 \|\| isOptionalTask\(task\)\) return false;/);
});

// 8. Shields --------------------------------------------------------------------

test('Shield snapshots exclude bonus tasks, so bonus completions never touch the monthly rate', () => {
  const migration = read(MIGRATION);
  const capture = migration.slice(migration.indexOf('FUNCTION public.capture_shield_daily_schedules('));
  assert.match(capture, /and t\.task_type = 'required'/);

  // A snapshot that (correctly) holds only the required task.
  const schedules: DailySchedule[] = [
    { userId: 'kid', day: '2026-10-13', slots: [{ taskId: 'homework', title: 'homework', icon: '', window: 'evening' }] },
  ];
  const withBonus = completedSlotKeys('kid', [
    { id: '1', userId: 'kid', taskId: 'homework', completedAt: '2026-10-13T19:00:00+09:00' },
    { id: '2', userId: 'kid', taskId: 'read', completedAt: '2026-10-13T19:30:00+09:00' },
  ], schedules, TZ);
  const without = completedSlotKeys('kid', [
    { id: '1', userId: 'kid', taskId: 'homework', completedAt: '2026-10-13T19:00:00+09:00' },
  ], schedules, TZ);
  const month = periodContaining('month', '2026-10-13');
  const a = tallyPeriod('kid', month, schedules, withBonus);
  const b = tallyPeriod('kid', month, schedules, without);
  assert.equal(a.eligible, 1);
  assert.equal(a.completed, 1);
  assert.deepEqual(a, b);
});

test('live Shield projections never count future bonus slots as remaining work', () => {
  const params = {
    userId: 'kid', period: periodContaining('month', '2026-10-14'), today: '2026-10-14', nowHour: 15,
    firstSnapshotDay: '2026-10-01', schedules: [], completions: [], missions: [], pastAwards: [], timezone: TZ,
  };
  const required = liveProgress({ ...params, tasks: [habit('homework', 'kid')] });
  const withBonus = liveProgress({ ...params, tasks: [habit('homework', 'kid'), habit('read', 'kid', { taskType: 'optional', timeWindow: 'both' })] });
  assert.equal(withBonus.remaining, required.remaining);
  assert.equal(withBonus.remainingDays, required.remainingDays);
});

test('family missions do not enrol a member through bonus tasks alone', () => {
  const plan = planMissionWeek({
    weekStart: '2026-10-12', now: NOW, timezone: TZ, completions: [],
    members: [member('a'), member('b')],
    tasks: [habit('a1', 'a'), habit('b-bonus', 'b', { taskType: 'optional' })],
  });
  assert.equal(plan, null);
});

// 9 & 10. Existing tasks and historical rows behave exactly as before -------------

test('tasks without a task_type (existing rows) behave exactly like required tasks', () => {
  const legacy = mapTask({ id: 't', user_id: 'u', title: 'Brush teeth', icon: 'circle', difficulty: 'EASY', base_points: 10, recurrence: 'daily', days_of_week: null, time_window: 'morning', active: 1, sort_order: 0 });
  assert.equal(legacy.taskType, 'required');
  assert.equal(isOptionalTask(legacy), false);
  assert.deepEqual(requiredTasks([legacy]), [legacy]);

  const completions = [done('kid', 'a', '2026-10-12T19:00:00+09:00'), done('kid', 'a', '2026-10-13T19:00:00+09:00')];
  const before = buildMemberHistory({ member: member('kid'), now: NOW, timezone: TZ, completions, tasks: [habit('a', 'kid')] });
  const after = buildMemberHistory({ member: member('kid'), now: NOW, timezone: TZ, completions, tasks: [habit('a', 'kid', { taskType: 'required' })] });
  assert.deepEqual(summarizeRange(after, '2026-10-01', '2026-10-14'), summarizeRange(before, '2026-10-01', '2026-10-14'));
});

test('the migration only adds a defaulted column and never rewrites history', () => {
  const migration = read(MIGRATION);
  // Everything before the first redefined function runs once at deploy time.
  const ddl = migration.slice(0, migration.indexOf('create or replace function'));
  assert.doesNotMatch(ddl, /\bupdate\b|\bdelete\b|\binsert\b/i);
  assert.doesNotMatch(migration, /alter table public\.(task_completions|levels|shield_)/i);
  // The redefined functions keep their old bodies apart from the new filter.
  assert.doesNotMatch(migration, /delete from public\.(task_completions|shield_|levels)/i);
});

// 11. Recurring bonus tasks --------------------------------------------------------

test('recurring bonus tasks follow their weekday schedule without ever becoming eligible slots', () => {
  const read20 = habit('read', 'kid', { taskType: 'optional', daysOfWeek: ['MON', 'WED'] });
  const h = buildMemberHistory({
    member: member('kid'), now: NOW, timezone: TZ,
    tasks: [habit('homework', 'kid'), read20],
    completions: [
      done('kid', 'homework', '2026-10-12T19:00:00+09:00'),
      done('kid', 'read', '2026-10-12T19:30:00+09:00'),
      done('kid', 'homework', '2026-10-13T19:00:00+09:00'),
    ],
  });
  // Monday had a bonus completion, Tuesday none: both are a clean 1/1.
  assert.equal(summarizeRange(h, '2026-10-12', '2026-10-12').rate, 1);
  assert.equal(summarizeRange(h, '2026-10-13', '2026-10-13').rate, 1);
  assert.equal(h.byTask.has('read'), false);
  // Recurrence is the same daysOfWeek filter the dashboard uses for every task.
  assert.match(read('lib/store.ts'), /\.filter\(t => t\.daysOfWeek\.includes\(todayDowKey\)\)/);
});

// 12. No point farming --------------------------------------------------------------

test('a bonus task pays at most once per routine window', () => {
  // The completion RPC is shared with required tasks; it locks the window's
  // existing completion and returns 0 points for a repeat.
  const guard = read('supabase/migrations/090_snapshot_completion_achievement_categories.sql');
  assert.match(guard, /select \* into v_existing_completion[\s\S]*completed_at >= v_completion_window_start[\s\S]*for update;\s*if found then[\s\S]*'pointsAwarded', 0/);
  assert.match(read('supabase/migrations/089_prevent_duplicate_task_completion_windows.sql'), /task_completions/);

  // Tallies count a task once per window even if the client repeats it.
  const tasks = [task('read', { taskType: 'optional', basePoints: 5 })];
  assert.equal(summarizeTaskDay(tasks, ['read', 'read', 'read']).bonusPointsEarned, 5);
});
