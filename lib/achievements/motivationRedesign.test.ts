import assert from 'node:assert/strict';
import test from 'node:test';
import type { Task, User } from '../db';
import { ACHIEVEMENTS } from './definitions';
import { evaluateAchievementsForChild, type AchievementCompletion, type AchievementProgress } from './engine';
import { achievementRemaining, selectNextAchievementGoals } from './recommendations';

const kid: User = {
  id: 'kid',
  name: 'Kid',
  role: 'CHILD',
  theme: 'dark_minimal',
  displayOrder: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const routine: Task = {
  id: 'routine',
  userId: kid.id,
  title: 'Morning routine',
  icon: 'sunrise',
  difficulty: 'EASY',
  basePoints: 10,
  recurrence: 'daily',
  daysOfWeek: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
  timeWindow: 'morning',
  active: 1,
  sortOrder: 0,
  streakCount: 0,
  lastCompletedAt: null,
};

function completion(at: string): AchievementCompletion {
  return { childId: kid.id, taskId: routine.id, completedAt: new Date(at), pointsAwarded: 10 };
}

function evaluate(completions: AchievementCompletion[], now: string) {
  return evaluateAchievementsForChild({
    child: kid,
    tasks: [routine],
    completions,
    allCompletionsByChild: { [kid.id]: completions },
    unlockedAtByAchievementId: {},
    now: new Date(now),
  });
}

test('momentum trail starts fresh without retroactive unlock spam', () => {
  const oldCompletions = Array.from({ length: 20 }, (_, index) =>
    completion(`2026-07-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`),
  );
  const result = evaluate(oldCompletions, '2026-08-06T12:00:00.000Z');
  const firstTrailGoal = result.achievements.find(item => item.achievementId === 'momentum-spark-5');

  assert.equal(firstTrailGoal?.progressCurrent, 0);
  assert.equal(firstTrailGoal?.isUnlocked, false);
});

test('momentum trail keeps progress across quiet days', () => {
  const completions = [
    completion('2026-08-05T14:00:00.000Z'),
    completion('2026-08-05T15:00:00.000Z'),
    completion('2026-08-12T14:00:00.000Z'),
    completion('2026-08-20T14:00:00.000Z'),
    completion('2026-08-20T15:00:00.000Z'),
  ];
  const result = evaluate(completions, '2026-08-20T18:00:00.000Z');
  const firstTrailGoal = result.achievements.find(item => item.achievementId === 'momentum-spark-5');

  assert.equal(firstTrailGoal?.progressCurrent, 5);
  assert.equal(firstTrailGoal?.isUnlocked, true);
});

test('momentum trail provides reachable rarity steps instead of a distant jump', () => {
  const trail = ACHIEVEMENTS.filter(item => item.category === 'Momentum Trail');
  assert.deepEqual(trail.slice(0, 8).map(item => item.progressTarget), [5, 15, 30, 50, 75, 100, 150, 225]);
  assert.equal(trail.find(item => item.rarity === 'legendary')?.progressTarget, 150);
  assert.equal(trail.find(item => item.rarity === 'mythic')?.progressTarget, 325);
});

function progress(patch: Partial<AchievementProgress>): AchievementProgress {
  return {
    childId: kid.id,
    achievementId: 'default',
    title: 'Default',
    description: 'Default',
    category: 'First Steps',
    tier: 'Bronze',
    icon: 'sparkles',
    requirementType: 'totalCompletions',
    requirementValue: 10,
    progressCurrent: 0,
    progressTarget: 10,
    progressPercent: 0,
    timeframe: 'lifetime',
    rarity: 'common',
    displayOrder: 1,
    isUnlocked: false,
    rewardPoints: 5,
    ...patch,
  };
}

test('next goals lead with momentum and avoid perfect-day pressure', () => {
  const goals = selectNextAchievementGoals([
    progress({ achievementId: 'perfect', title: 'Perfect', category: 'Perfect Days', progressCurrent: 9, progressTarget: 10, progressPercent: 90 }),
    progress({ achievementId: 'trail', title: 'Trail', category: 'Momentum Trail', progressCurrent: 2, progressTarget: 5, progressPercent: 40 }),
    progress({ achievementId: 'morning', title: 'Morning', category: 'Morning Routine', progressCurrent: 8, progressTarget: 14, progressPercent: 57 }),
    progress({ achievementId: 'team', title: 'Team', category: 'Team Shields', progressCurrent: 1, progressTarget: 3, progressPercent: 33 }),
  ]);

  assert.deepEqual(goals.map(goal => goal.achievementId), ['trail', 'morning', 'team']);
  assert.equal(achievementRemaining(goals[0]), 3);
});

test('weekly category quests only count the category they name', () => {
  const healthCompletions = Array.from({ length: 4 }, (_, index) => ({
    ...completion(`2026-08-0${3 + index}T14:00:00.000Z`),
    categories: ['health' as const],
  }));
  const healthResult = evaluate(healthCompletions, '2026-08-06T18:00:00.000Z');
  const readingBefore = healthResult.achievements.find(item => item.achievementId === 'weekly-reading-3');
  const totalBefore = healthResult.achievements.find(item => item.achievementId === 'weekly-total-20');

  assert.equal(readingBefore?.progressCurrent, 0);
  assert.equal(totalBefore?.progressCurrent, 4);

  const learningCompletions = Array.from({ length: 3 }, (_, index) => ({
    ...completion(`2026-08-0${3 + index}T16:00:00.000Z`),
    categories: ['learning' as const],
  }));
  const learningResult = evaluate([...healthCompletions, ...learningCompletions], '2026-08-06T18:00:00.000Z');
  const readingAfter = learningResult.achievements.find(item => item.achievementId === 'weekly-reading-3');

  assert.equal(readingAfter?.progressCurrent, 3);
  assert.equal(readingAfter?.isUnlocked, true);
});
