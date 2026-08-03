import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import type { Task } from './db';
import {
  isPerfectRoutineDay,
  localDateKey,
  splitCompletionsByWindow,
} from './perfectDay';

function task(id: string, timeWindow: Task['timeWindow']): Task {
  return {
    id,
    userId: 'user',
    title: id,
    icon: 'circle',
    difficulty: 'EASY',
    basePoints: 10,
    recurrence: 'daily',
    daysOfWeek: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    timeWindow,
    active: 1,
    sortOrder: 0,
    streakCount: 0,
    lastCompletedAt: null,
  };
}

const dayStart = new Date(2026, 7, 2, 0, 0, 0, 0);

function at(hour: number): string {
  const value = new Date(dayStart);
  value.setHours(hour, 0, 0, 0);
  return value.toISOString();
}

test('perfect day requires scheduled routines in both windows', () => {
  const onlyMorning = [task('wake', 'morning')];
  const completions = splitCompletionsByWindow(
    onlyMorning,
    [{ task_id: 'wake', completed_at: at(8) }],
    dayStart,
  );
  assert.equal(isPerfectRoutineDay(onlyMorning, completions), false);
});

test('perfect day requires every morning and evening routine', () => {
  const tasks = [task('wake', 'morning'), task('read', 'morning'), task('brush', 'evening')];
  const incomplete = splitCompletionsByWindow(
    tasks,
    [
      { task_id: 'wake', completed_at: at(8) },
      { task_id: 'brush', completed_at: at(20) },
    ],
    dayStart,
  );
  assert.equal(isPerfectRoutineDay(tasks, incomplete), false);

  const complete = splitCompletionsByWindow(
    tasks,
    [
      { task_id: 'wake', completed_at: at(8) },
      { task_id: 'read', completed_at: at(9) },
      { task_id: 'brush', completed_at: at(20) },
    ],
    dayStart,
  );
  assert.equal(isPerfectRoutineDay(tasks, complete), true);
});

test('a both-window routine must be completed once in each window', () => {
  const tasks = [task('medicine', 'both')];
  const morningOnly = splitCompletionsByWindow(
    tasks,
    [{ task_id: 'medicine', completed_at: at(8) }],
    dayStart,
  );
  assert.equal(isPerfectRoutineDay(tasks, morningOnly), false);

  const both = splitCompletionsByWindow(
    tasks,
    [
      { task_id: 'medicine', completed_at: at(8) },
      { task_id: 'medicine', completed_at: at(19) },
    ],
    dayStart,
  );
  assert.equal(isPerfectRoutineDay(tasks, both), true);
});

test('local coupon day keys do not shift through UTC formatting', () => {
  assert.equal(localDateKey(new Date(2026, 0, 3, 23, 30)), '2026-01-03');
});

test('perfect-day migration is family-scoped, idempotent, and redemption-safe', () => {
  const migration = readFileSync(
    join(process.cwd(), 'supabase/migrations/099_perfect_day_coupons.sql'),
    'utf8',
  );
  assert.match(migration, /unique \(user_id, day_started_at\)/);
  assert.match(migration, /perfect_day_coupons_family_select/);
  assert.match(migration, /family_id = \(select public\.get_my_family_id\(\)\)/);
  assert.match(migration, /if found and v_coupon\.status = 'redeemed'/);
  assert.match(migration, /status = 'revoked'/);
  assert.match(migration, /revoke all on function public\.redeem_perfect_day_coupon/);
  assert.match(migration, /grant execute on function public\.redeem_perfect_day_coupon[^;]+to authenticated/);
});

test('reference routine cards expose no completion interaction', () => {
  const component = readFileSync(
    join(process.cwd(), 'components/RoutineReferenceCard.tsx'),
    'utf8',
  );
  assert.match(component, /pointer-events-none/);
  assert.match(component, /aria-disabled="true"/);
  assert.doesNotMatch(component, /onClick|onKeyDown|onDrag|markCompleted|undoCompletion/);
});
