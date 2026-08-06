import type { AchievementProgress } from './engine';

const ROUTINE_CATEGORIES = new Set<AchievementProgress['category']>([
  'Morning Routine',
  'Evening Routine',
  'School Routine',
  'Health & Hygiene',
  'Learning & Reading',
  'Faith & Reflection',
  'Responsibility & Cleanup',
  'Exercise',
]);

const LOW_PRESSURE_CATEGORIES = new Set<AchievementProgress['category']>([
  'First Steps',
  'Combo Shields',
  'Team Shields',
  'Year Journey',
]);

export function achievementRemaining(achievement: AchievementProgress): number {
  return Math.max(0, achievement.progressTarget - achievement.progressCurrent);
}

function compareReachability(a: AchievementProgress, b: AchievementProgress): number {
  const startedA = a.progressCurrent > 0 ? 0 : 1;
  const startedB = b.progressCurrent > 0 ? 0 : 1;
  if (startedA !== startedB) return startedA - startedB;
  if (a.progressPercent !== b.progressPercent) return b.progressPercent - a.progressPercent;
  const remaining = achievementRemaining(a) - achievementRemaining(b);
  if (remaining !== 0) return remaining;
  return a.displayOrder - b.displayOrder;
}

function closest(
  achievements: readonly AchievementProgress[],
  predicate: (achievement: AchievementProgress) => boolean,
): AchievementProgress | undefined {
  return achievements
    .filter(achievement => !achievement.isUnlocked && !achievement.isSecret && predicate(achievement))
    .sort(compareReachability)[0];
}

/** Selects a balanced set of visible goals: one fresh cumulative milestone,
 * one routine path, and one flexible growth goal. Perfect-day and streak
 * pressure never dominate this recommendation surface. */
export function selectNextAchievementGoals(
  achievements: readonly AchievementProgress[],
  limit = 3,
): AchievementProgress[] {
  const picks: AchievementProgress[] = [];
  const add = (achievement?: AchievementProgress) => {
    if (!achievement || picks.some(item => item.achievementId === achievement.achievementId)) return;
    picks.push(achievement);
  };

  add(closest(achievements, achievement => achievement.category === 'Momentum Trail'));
  add(closest(achievements, achievement => ROUTINE_CATEGORIES.has(achievement.category)));
  add(closest(achievements, achievement => LOW_PRESSURE_CATEGORIES.has(achievement.category)));

  const remaining = achievements
    .filter(achievement => !achievement.isUnlocked && !achievement.isSecret)
    .sort(compareReachability);
  for (const achievement of remaining) {
    if (picks.length >= limit) break;
    add(achievement);
  }
  return picks.slice(0, Math.max(0, limit));
}
