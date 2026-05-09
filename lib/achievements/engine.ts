import type { Task, User } from '@/lib/db';
import { DOW_INDEX } from '@/lib/db';
import { ACHIEVEMENTS, categorizeTask, type AchievementDefinition, type AchievementRarity, type HabitCategory } from './definitions';

// Floor on how many distinct active days a member needs (within the
// baseline window) before any insignia of a given rarity can unlock.
// Without this, single-completion badges would fire on day 1 even for
// "epic" tiers, which made early progress feel hollow.
export const MIN_ACTIVE_DAYS_FOR_RARITY: Record<AchievementRarity, number> = {
  common: 7,
  rare: 14,
  epic: 21,
  legendary: 28,
  mythic: 60,
};

export interface AchievementCompletion {
  id?: string;
  childId: string;
  taskId: string;
  completedAt: Date;
  pointsAwarded?: number;
}

export interface AchievementProgress {
  childId: string;
  achievementId: string;
  title: string;
  description: string;
  category: AchievementDefinition['category'];
  tier: AchievementDefinition['tier'];
  icon: string;
  requirementType: AchievementDefinition['requirementType'];
  requirementValue: number;
  progressCurrent: number;
  progressTarget: number;
  progressPercent: number;
  timeframe: AchievementDefinition['timeframe'];
  rarity: AchievementDefinition['rarity'];
  displayOrder: number;
  isSecret?: boolean;
  isUnlocked: boolean;
  unlockedAt?: string;
  rewardPoints?: number;
  unlocksTitleIds?: string[];
  unlocksVisualStyleIds?: string[];
}

export interface AchievementMetrics {
  totalCompletions: number;
  activeDays: number;
  dailyStreak: number;
  gentleFrequency: number;
  perfectDays: number;
  comebackCount: number;
  zeroDayRecoveries: number;
  improvementDays: number;
  weeklyImprovement: number;
  monthlyImprovement: number;
  dailyPersonalBest: number;
  weeklyPersonalBest: number;
  categoryCompletions: Record<HabitCategory, number>;
  comboDaysByKey: Record<string, number>;
  teamSameDays: number;
  currentWeekActiveDays: number;
  currentWeekTotal: number;
  currentMonthActiveDays: number;
  currentMonthTotal: number;
}

const DAY_MS = 86_400_000;

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function isoDay(date: Date): string {
  return startOfDay(date).toISOString().slice(0, 10);
}

function weekStart(date: Date): Date {
  const day = startOfDay(date);
  const offset = day.getDay() === 0 ? 6 : day.getDay() - 1;
  return addDays(day, -offset);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function taskActiveOnDate(task: Task, date: Date): boolean {
  if (task.active !== 1) return false;
  // Historical schedule snapshots are not stored yet, so older perfect-day
  // checks use the current task schedule as the best available fallback.
  return task.daysOfWeek.includes(DOW_INDEX[date.getDay()]);
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function buildDayMap(completions: AchievementCompletion[]) {
  const map = new Map<string, AchievementCompletion[]>();
  for (const completion of completions) {
    const key = isoDay(completion.completedAt);
    map.set(key, [...(map.get(key) ?? []), completion]);
  }
  return map;
}

function buildWeekTotals(dayMap: Map<string, AchievementCompletion[]>) {
  const totals = new Map<string, number>();
  for (const [day, completions] of dayMap) {
    totals.set(isoDay(weekStart(new Date(`${day}T12:00:00`))), (totals.get(isoDay(weekStart(new Date(`${day}T12:00:00`)))) ?? 0) + completions.length);
  }
  return totals;
}

function buildMonthTotals(dayMap: Map<string, AchievementCompletion[]>) {
  const totals = new Map<string, number>();
  for (const [day, completions] of dayMap) {
    const key = monthKey(new Date(`${day}T12:00:00`));
    totals.set(key, (totals.get(key) ?? 0) + completions.length);
  }
  return totals;
}

function countDailyStreak(dayMap: Map<string, AchievementCompletion[]>, now = new Date()): number {
  let cursor = startOfDay(now);
  if (!dayMap.has(isoDay(cursor))) cursor = addDays(cursor, -1);
  let total = 0;
  for (let i = 0; i < 370; i++) {
    if (!dayMap.has(isoDay(cursor))) break;
    total++;
    cursor = addDays(cursor, -1);
  }
  return total;
}

function countComebacks(completions: AchievementCompletion[]): number {
  const byTask = new Map<string, Date[]>();
  for (const completion of completions) {
    byTask.set(completion.taskId, [...(byTask.get(completion.taskId) ?? []), completion.completedAt]);
  }
  let count = 0;
  for (const dates of byTask.values()) {
    const sorted = dates.map(startOfDay).sort((a, b) => a.getTime() - b.getTime());
    for (let i = 1; i < sorted.length; i++) {
      const gap = Math.round((sorted[i].getTime() - sorted[i - 1].getTime()) / DAY_MS) - 1;
      if (gap >= 3) count++;
    }
  }
  return count;
}

function countZeroDayRecoveries(dayMap: Map<string, AchievementCompletion[]>): number {
  const days = Array.from(dayMap.keys()).sort();
  let count = 0;
  for (const day of days) {
    const prev = isoDay(addDays(new Date(`${day}T12:00:00`), -1));
    const prevPrev = isoDay(addDays(new Date(`${day}T12:00:00`), -2));
    if (!dayMap.has(prev) && dayMap.has(prevPrev)) count++;
  }
  return count;
}

function countImprovementDays(dayMap: Map<string, AchievementCompletion[]>): number {
  const days = Array.from(dayMap.keys()).sort();
  let count = 0;
  for (let i = 1; i < days.length; i++) {
    const current = dayMap.get(days[i])?.length ?? 0;
    const prev = dayMap.get(isoDay(addDays(new Date(`${days[i]}T12:00:00`), -1)))?.length ?? 0;
    if (current > prev) count++;
  }
  return count;
}

function countImprovingPeriods(totals: Map<string, number>): number {
  const keys = Array.from(totals.keys()).sort();
  let count = 0;
  for (let i = 1; i < keys.length; i++) {
    if ((totals.get(keys[i]) ?? 0) > (totals.get(keys[i - 1]) ?? 0)) count++;
  }
  return count;
}

function countPerfectDays(dayMap: Map<string, AchievementCompletion[]>, tasks: Task[]): number {
  let total = 0;
  for (const [day, completions] of dayMap) {
    const date = new Date(`${day}T12:00:00`);
    const due = tasks.filter(task => taskActiveOnDate(task, date));
    if (due.length === 0) continue;
    const doneIds = new Set(completions.map(c => c.taskId));
    if (due.every(task => doneIds.has(task.id))) total++;
  }
  return total;
}

function buildCategoryData(completions: AchievementCompletion[], tasks: Task[]) {
  const taskCategories = new Map(tasks.map(task => [task.id, categorizeTask(task)]));
  const categoryCompletions: Record<HabitCategory, number> = {
    health: 0,
    learning: 0,
    faith: 0,
    responsibility: 0,
    exercise: 0,
    school: 0,
    morning: 0,
    evening: 0,
  };
  const categoriesByDay = new Map<string, Set<HabitCategory>>();

  for (const completion of completions) {
    const categories = taskCategories.get(completion.taskId) ?? ['responsibility'];
    const day = isoDay(completion.completedAt);
    const set = categoriesByDay.get(day) ?? new Set<HabitCategory>();
    for (const category of categories) {
      categoryCompletions[category]++;
      set.add(category);
    }
    categoriesByDay.set(day, set);
  }

  const comboDaysByKey: Record<string, number> = {};
  for (const categories of categoriesByDay.values()) {
    const sorted = Array.from(categories).sort();
    for (let size = 2; size <= sorted.length; size++) {
      const key = sorted.slice(0, size).join('+');
      comboDaysByKey[key] = (comboDaysByKey[key] ?? 0) + 1;
    }
    if (sorted.length >= 3) comboDaysByKey['any-3'] = (comboDaysByKey['any-3'] ?? 0) + 1;
    if (sorted.length >= 5) comboDaysByKey['any-5'] = (comboDaysByKey['any-5'] ?? 0) + 1;
  }

  return { categoryCompletions, comboDaysByKey, categoriesByDay };
}

function countTeamSameDays(childId: string, allCompletionsByChild: Record<string, AchievementCompletion[]>): number {
  const childDays = new Set((allCompletionsByChild[childId] ?? []).map(c => isoDay(c.completedAt)));
  const siblingDaySets = Object.entries(allCompletionsByChild)
    .filter(([id]) => id !== childId)
    .map(([, completions]) => new Set(completions.map(c => isoDay(c.completedAt))));
  if (siblingDaySets.length === 0) return 0;
  return Array.from(childDays).filter(day => siblingDaySets.some(set => set.has(day))).length;
}

export function calculateAchievementMetrics(
  childId: string,
  tasks: Task[],
  completions: AchievementCompletion[],
  allCompletionsByChild: Record<string, AchievementCompletion[]>,
  now = new Date(),
): AchievementMetrics {
  const sortedCompletions = completions.slice().sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());
  const dayMap = buildDayMap(sortedCompletions);
  const weekTotals = buildWeekTotals(dayMap);
  const monthTotals = buildMonthTotals(dayMap);
  const categoryData = buildCategoryData(sortedCompletions, tasks);
  const currentWeek = isoDay(weekStart(now));
  const currentMonth = monthKey(now);
  const currentWeekDays = Array.from(dayMap.keys()).filter(day => isoDay(weekStart(new Date(`${day}T12:00:00`))) === currentWeek).length;
  const currentMonthDays = Array.from(dayMap.keys()).filter(day => monthKey(new Date(`${day}T12:00:00`)) === currentMonth).length;
  const dailyBest = Math.max(0, ...Array.from(dayMap.values()).map(items => items.length));
  const weeklyBest = Math.max(0, ...Array.from(weekTotals.values()));

  return {
    totalCompletions: sortedCompletions.length,
    activeDays: dayMap.size,
    dailyStreak: countDailyStreak(dayMap, now),
    gentleFrequency: Math.max(0, ...Array.from(weekTotals.values())),
    perfectDays: countPerfectDays(dayMap, tasks),
    comebackCount: countComebacks(sortedCompletions),
    zeroDayRecoveries: countZeroDayRecoveries(dayMap),
    improvementDays: countImprovementDays(dayMap),
    weeklyImprovement: countImprovingPeriods(weekTotals),
    monthlyImprovement: countImprovingPeriods(monthTotals),
    dailyPersonalBest: dailyBest,
    weeklyPersonalBest: weeklyBest,
    categoryCompletions: categoryData.categoryCompletions,
    comboDaysByKey: categoryData.comboDaysByKey,
    teamSameDays: countTeamSameDays(childId, allCompletionsByChild),
    currentWeekActiveDays: currentWeekDays,
    currentWeekTotal: weekTotals.get(currentWeek) ?? 0,
    currentMonthActiveDays: currentMonthDays,
    currentMonthTotal: monthTotals.get(currentMonth) ?? 0,
  };
}

function comboKey(definition: AchievementDefinition): string {
  if (!definition.comboCategories || definition.comboCategories.length === 0) return 'any-3';
  if (definition.comboCategories.length >= 5) return 'any-5';
  return unique(definition.comboCategories).sort().join('+');
}

function progressFor(definition: AchievementDefinition, metrics: AchievementMetrics): number {
  switch (definition.requirementType) {
    case 'totalCompletions':
      return metrics.totalCompletions;
    case 'activeDays':
      return metrics.activeDays;
    case 'categoryCompletions':
    case 'habitKeywordCompletions':
      return metrics.categoryCompletions[definition.requirementCategory ?? 'responsibility'] ?? 0;
    case 'daysWithAtLeast':
      return metrics.activeDays;
    case 'dailyStreak':
      return metrics.dailyStreak;
    case 'gentleFrequency':
      return metrics.gentleFrequency;
    case 'perfectDays':
      return metrics.perfectDays;
    case 'comebackCount':
      return metrics.comebackCount;
    case 'zeroDayRecoveries':
      return metrics.zeroDayRecoveries;
    case 'improvementDays':
      return metrics.improvementDays;
    case 'weeklyImprovement':
      return metrics.weeklyImprovement;
    case 'monthlyImprovement':
      return metrics.monthlyImprovement;
    case 'dailyPersonalBest':
      return metrics.dailyPersonalBest;
    case 'weeklyPersonalBest':
      return metrics.weeklyPersonalBest;
    case 'comboDays':
      return metrics.comboDaysByKey[comboKey(definition)] ?? 0;
    case 'teamSameDay':
      return metrics.teamSameDays;
    case 'weeklyQuest':
      return Math.max(metrics.currentWeekActiveDays, metrics.currentWeekTotal, metrics.weeklyImprovement, metrics.comebackCount);
    case 'monthlyQuest':
      return Math.max(metrics.currentMonthActiveDays, metrics.currentMonthTotal, metrics.monthlyImprovement, metrics.comebackCount);
    default:
      return 0;
  }
}

export function evaluateAchievementsForChild(params: {
  child: User;
  tasks: Task[];
  completions: AchievementCompletion[];
  allCompletionsByChild: Record<string, AchievementCompletion[]>;
  unlockedAtByAchievementId?: Record<string, string>;
  now?: Date;
  /** Only count completions on/after this timestamp. Lets a fresh family
   *  begin unlocking insignias from a chosen reset point rather than
   *  retroactively crediting historical activity. */
  since?: Date;
}): { metrics: AchievementMetrics; achievements: AchievementProgress[]; newlyUnlocked: AchievementProgress[] } {
  const sinceTime = params.since ? params.since.getTime() : 0;
  const filteredCompletions = sinceTime > 0
    ? params.completions.filter(c => c.completedAt.getTime() >= sinceTime)
    : params.completions;
  const filteredAllByChild = sinceTime > 0
    ? Object.fromEntries(
        Object.entries(params.allCompletionsByChild).map(([id, comps]) => [
          id,
          comps.filter(c => c.completedAt.getTime() >= sinceTime),
        ]),
      )
    : params.allCompletionsByChild;
  const metrics = calculateAchievementMetrics(
    params.child.id,
    params.tasks,
    filteredCompletions,
    filteredAllByChild,
    params.now,
  );
  const unlocked = params.unlockedAtByAchievementId ?? {};
  const achievements = ACHIEVEMENTS.map(definition => {
    const progressCurrent = progressFor(definition, metrics);
    const meetsRequirement = progressCurrent >= definition.progressTarget;
    const meetsRarityFloor = metrics.activeDays >= MIN_ACTIVE_DAYS_FOR_RARITY[definition.rarity];
    const isUnlocked = Boolean(unlocked[definition.achievementId]) || (meetsRequirement && meetsRarityFloor);
    return {
      childId: params.child.id,
      achievementId: definition.achievementId,
      title: definition.title,
      description: definition.description,
      category: definition.category,
      tier: definition.tier,
      icon: definition.icon,
      requirementType: definition.requirementType,
      requirementValue: definition.requirementValue,
      progressCurrent: Math.min(progressCurrent, definition.progressTarget),
      progressTarget: definition.progressTarget,
      progressPercent: definition.progressTarget > 0 ? Math.min(100, Math.round((progressCurrent / definition.progressTarget) * 100)) : 0,
      timeframe: definition.timeframe,
      rarity: definition.rarity,
      displayOrder: definition.displayOrder,
      isSecret: definition.isSecret,
      isUnlocked,
      unlockedAt: unlocked[definition.achievementId],
      rewardPoints: definition.rewardPoints,
      unlocksTitleIds: definition.unlocksTitleIds,
      unlocksVisualStyleIds: definition.unlocksVisualStyleIds,
    };
  });
  const nowIso = (params.now ?? new Date()).toISOString();
  const newlyUnlocked = achievements
    .filter(achievement => achievement.isUnlocked && !unlocked[achievement.achievementId])
    .map(achievement => ({ ...achievement, unlockedAt: nowIso }));
  return { metrics, achievements, newlyUnlocked };
}
