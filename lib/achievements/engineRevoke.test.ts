import assert from 'node:assert/strict';
import test from 'node:test';
import type { Task, User } from '../db';
import { evaluateAchievementsForChild, type AchievementCompletion } from './engine';

function child(id = 'kid'): User {
  return {
    id,
    name: id,
    role: 'CHILD',
    theme: 'dark_minimal',
    displayOrder: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

function task(id = 'task-1', userId = 'kid', patch: Partial<Task> = {}): Task {
  return {
    id,
    userId,
    title: 'brush teeth',
    icon: '🪥',
    difficulty: 'EASY',
    basePoints: 10,
    recurrence: 'daily',
    daysOfWeek: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    active: 1,
    sortOrder: 0,
    streakCount: 0,
    lastCompletedAt: null,
    ...patch,
  };
}

function completion(taskId: string, childId: string, at: string): AchievementCompletion {
  return { childId, taskId, completedAt: new Date(at), pointsAwarded: 10 };
}

function dayOffsetIso(dayIndex: number, hour: number): string {
  const date = new Date('2026-01-01T00:00:00.000Z');
  date.setUTCDate(date.getUTCDate() + dayIndex);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
}

test('engine: zero completions yields no first-spark unlock', () => {
  const kid = child();
  const result = evaluateAchievementsForChild({
    child: kid,
    tasks: [task()],
    completions: [],
    allCompletionsByChild: { kid: [] },
    unlockedAtByAchievementId: {},
    now: new Date('2026-05-22T12:00:00.000Z'),
  });
  const firstSpark = result.achievements.find(a => a.achievementId === 'first-spark');
  assert.ok(firstSpark, 'first-spark must be present in evaluation');
  assert.equal(firstSpark.isUnlocked, false);
  assert.equal(result.newlyUnlocked.find(a => a.achievementId === 'first-spark'), undefined);
});

test('engine: a single completion unlocks first-spark and reports it newly', () => {
  const kid = child();
  const comp = completion('task-1', 'kid', '2026-05-22T10:00:00.000Z');
  const result = evaluateAchievementsForChild({
    child: kid,
    tasks: [task()],
    completions: [comp],
    allCompletionsByChild: { kid: [comp] },
    unlockedAtByAchievementId: {},
    now: new Date('2026-05-22T12:00:00.000Z'),
  });
  const firstSpark = result.achievements.find(a => a.achievementId === 'first-spark');
  assert.equal(firstSpark?.isUnlocked, true);
  assert.ok(
    result.newlyUnlocked.some(a => a.achievementId === 'first-spark'),
    'first-spark should appear in newlyUnlocked when previously locked',
  );
});

test('engine: existing unlock survives even if conditions are no longer met', () => {
  // Models the case where a child unlocks first-spark, then the underlying
  // completion is later undone. evaluateAchievementsForChild is called once
  // by syncAchievements with the existing map (keeps it unlocked), and
  // separately by revokeUnmetAchievements with an empty map to test truth.
  const kid = child();
  const result = evaluateAchievementsForChild({
    child: kid,
    tasks: [task()],
    completions: [],
    allCompletionsByChild: { kid: [] },
    unlockedAtByAchievementId: { 'first-spark': '2026-05-20T00:00:00.000Z' },
    now: new Date('2026-05-22T12:00:00.000Z'),
  });
  const firstSpark = result.achievements.find(a => a.achievementId === 'first-spark');
  assert.equal(firstSpark?.isUnlocked, true, 'sync path keeps the badge unlocked from the map');
  assert.equal(
    result.newlyUnlocked.find(a => a.achievementId === 'first-spark'),
    undefined,
    'an already-unlocked achievement must not re-appear in newlyUnlocked',
  );
});

test('engine: revoke pattern (empty map, no completions) reveals the truth', () => {
  // revokeUnmetAchievements calls the engine with `unlockedAtByAchievementId: {}`
  // so isUnlocked reflects only what is *currently* true. This test pins the
  // contract that a previously-unlocked badge becomes locked here once the
  // underlying completion is gone.
  const kid = child();
  const result = evaluateAchievementsForChild({
    child: kid,
    tasks: [task()],
    completions: [],
    allCompletionsByChild: { kid: [] },
    unlockedAtByAchievementId: {},
    now: new Date('2026-05-22T12:00:00.000Z'),
  });
  const firstSpark = result.achievements.find(a => a.achievementId === 'first-spark');
  assert.equal(firstSpark?.isUnlocked, false);
});

test('engine: progressPercent caps at 100 even when current exceeds target', () => {
  const kid = child();
  const completions = Array.from({ length: 5 }, (_, i) =>
    completion('task-1', 'kid', `2026-05-2${i + 1}T10:00:00.000Z`),
  );
  const result = evaluateAchievementsForChild({
    child: kid,
    tasks: [task()],
    completions,
    allCompletionsByChild: { kid: completions },
    unlockedAtByAchievementId: {},
    now: new Date('2026-05-26T12:00:00.000Z'),
  });
  const firstSpark = result.achievements.find(a => a.achievementId === 'first-spark');
  assert.equal(firstSpark?.isUnlocked, true);
  assert.equal(firstSpark?.progressPercent, 100, 'progressPercent must clamp at 100');
  assert.equal(firstSpark?.progressCurrent, 1, 'progressCurrent must clamp at progressTarget');
});

test('engine: routine shields count category active days, not same-day task volume', () => {
  const kid = child();
  const morningTasks = [
    task('morning-1', 'kid', { title: 'morning checklist', timeWindow: 'morning' }),
    task('morning-2', 'kid', { title: 'morning stretch', timeWindow: 'morning' }),
    task('morning-3', 'kid', { title: 'morning reading', timeWindow: 'morning' }),
  ];
  const completions = Array.from({ length: 50 }).flatMap((_, dayIndex) =>
    morningTasks.map((morningTask, taskIndex) =>
      completion(
        morningTask.id,
        'kid',
        dayOffsetIso(dayIndex, 10 + taskIndex),
      ),
    ),
  );

  const result = evaluateAchievementsForChild({
    child: kid,
    tasks: morningTasks,
    completions,
    allCompletionsByChild: { kid: completions },
    unlockedAtByAchievementId: {},
    now: new Date('2026-03-01T12:00:00.000Z'),
  });
  const legendaryMorning = result.achievements.find(a => a.achievementId === 'morning-3-sunrise-builder');

  assert.equal(result.metrics.categoryCompletions.morning, 150);
  assert.equal(result.metrics.categoryActiveDays.morning, 50);
  assert.equal(legendaryMorning?.isUnlocked, false);
  assert.equal(legendaryMorning?.progressCurrent, 50);
});

test('engine: routine shields unlock after enough category active days', () => {
  const kid = child();
  const morningTask = task('morning-1', 'kid', { title: 'morning checklist', timeWindow: 'morning' });
  const completions = Array.from({ length: 150 }, (_, dayIndex) =>
    completion(
      morningTask.id,
      'kid',
      dayOffsetIso(dayIndex, 10),
    ),
  );

  const result = evaluateAchievementsForChild({
    child: kid,
    tasks: [morningTask],
    completions,
    allCompletionsByChild: { kid: completions },
    unlockedAtByAchievementId: {},
    now: new Date('2026-06-01T12:00:00.000Z'),
  });
  const legendaryMorning = result.achievements.find(a => a.achievementId === 'morning-3-sunrise-builder');

  assert.equal(result.metrics.categoryCompletions.morning, 150);
  assert.equal(result.metrics.categoryActiveDays.morning, 150);
  assert.equal(legendaryMorning?.isUnlocked, true);
  assert.equal(legendaryMorning?.progressCurrent, 150);
});
