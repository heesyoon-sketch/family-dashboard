import type { Task } from '@/lib/db';

export type AchievementCategory =
  | 'First Steps'
  | 'Comebacks'
  | 'Improvement'
  | 'Consistency'
  | 'Habit Mastery'
  | 'Gentle Streaks'
  | 'Perfect Days'
  | 'Weekly Quests'
  | 'Monthly Quests'
  | 'Year Journey'
  | 'Morning Routine'
  | 'Evening Routine'
  | 'School Routine'
  | 'Health & Hygiene'
  | 'Learning & Reading'
  | 'Faith & Reflection'
  | 'Responsibility & Cleanup'
  | 'Exercise'
  | 'Combo Badges'
  | 'Team Badges'
  | 'Secret Badges';

export type AchievementTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Legendary' | 'Mythic';
export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type AchievementTimeframe = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'lifetime';
export type RequirementType =
  | 'totalCompletions'
  | 'activeDays'
  | 'categoryCompletions'
  | 'habitKeywordCompletions'
  | 'daysWithAtLeast'
  | 'dailyStreak'
  | 'gentleFrequency'
  | 'perfectDays'
  | 'comebackCount'
  | 'zeroDayRecoveries'
  | 'improvementDays'
  | 'weeklyImprovement'
  | 'monthlyImprovement'
  | 'dailyPersonalBest'
  | 'weeklyPersonalBest'
  | 'comboDays'
  | 'teamSameDay'
  | 'weeklyQuest'
  | 'monthlyQuest';

export interface AchievementDefinition {
  achievementId: string;
  title: string;
  description: string;
  category: AchievementCategory;
  tier: AchievementTier;
  icon: string;
  requirementType: RequirementType;
  requirementValue: number;
  progressTarget: number;
  timeframe: AchievementTimeframe;
  rarity: AchievementRarity;
  displayOrder: number;
  isSecret?: boolean;
  rewardPoints?: number;
  unlocksTitleIds?: string[];
  unlocksVisualStyleIds?: string[];
  relatedHabitIds?: string[];
  requirementCategory?: HabitCategory;
  habitKeyword?: string;
  comboCategories?: HabitCategory[];
}

export interface TitleDefinition {
  titleId: string;
  title: string;
  description: string;
  unlockedByAchievementId: string;
}

export interface BadgeVisualStyleDefinition {
  visualStyleId: string;
  name: string;
  description: string;
  rarity: AchievementRarity;
  unlockedByAchievementId: string;
  styleToken: string;
}

export type HabitCategory =
  | 'health'
  | 'learning'
  | 'faith'
  | 'responsibility'
  | 'exercise'
  | 'school'
  | 'morning'
  | 'evening';

const tierByIndex: AchievementTier[] = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Legendary', 'Mythic'];
const rarityByIndex: AchievementRarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];
const milestoneValues = [7, 14, 21, 30, 50, 75, 100, 150, 200, 250, 300, 365];

// Year-journey tier/rarity ladder. The earliest milestone now requires a
// full week of activity — there is no insignia in the first 7 days. Curve
// stays gentle through the early ranks and gets steeper past 100 days so
// the finale (365) genuinely represents a year of growth.
const milestoneRarities: AchievementRarity[] = [
  'common',                                           // 7 days
  'common',                                           // 14 days
  'rare',                                             // 21 days
  'rare',                                             // 30 days
  'epic',                                             // 50 days
  'epic',                                             // 75 days
  'legendary',                                        // 100 days
  'legendary',                                        // 150 days
  'legendary',                                        // 200 days
  'mythic',                                           // 250 days
  'mythic',                                           // 300 days
  'mythic',                                           // 365 days
];

function rewardFor(rarity: AchievementRarity): number {
  return {
    common: 5,
    rare: 15,
    epic: 25,
    legendary: 40,
    mythic: 60,
  }[rarity];
}

function makeAchievement(
  partial: Omit<AchievementDefinition, 'progressTarget' | 'displayOrder' | 'rewardPoints'> & {
    progressTarget?: number;
    displayOrder?: number;
    rewardPoints?: number;
  },
): AchievementDefinition {
  const rarity = partial.rarity;
  return {
    ...partial,
    progressTarget: partial.progressTarget ?? partial.requirementValue,
    displayOrder: partial.displayOrder ?? 9999,
    rewardPoints: partial.rewardPoints ?? rewardFor(rarity),
  };
}

const firstSteps = [
  ['first-spark', 'First Spark', 'Complete any habit once.', 1, 'common', 'Bronze', '✨'],
  ['little-win', 'Little Win', 'Complete 3 habits total.', 3, 'common', 'Bronze', '🌱'],
  ['getting-started', 'Getting Started', 'Complete habits on 3 different days.', 3, 'common', 'Bronze', '🚀'],
  ['i-tried-today', 'I Tried Today', 'Complete at least one habit on any day.', 1, 'common', 'Bronze', '💛'],
] as const;

const comebackBadges = [
  ['comeback-kid', 'Comeback Kid', 'Complete a habit again after missing 3+ days.', 1, 'common', 'Bronze', '🔥'],
  ['back-on-track', 'Back on Track', 'Complete any habit after a zero-habit day.', 1, 'common', 'Bronze', '🛤️'],
  ['bounce-back', 'Bounce Back', 'Complete 3 habits the day after missing all habits.', 1, 'rare', 'Silver', '🏀'],
  ['reset-hero', 'Reset Hero', 'Restart a habit streak after it broke.', 3, 'rare', 'Silver', '🔁'],
  ['never-out', 'Never Out', 'Return after 7+ days away from a habit.', 1, 'rare', 'Silver', '🌄'],
  ['fresh-start', 'Fresh Start', 'Complete at least one habit after a difficult week.', 1, 'rare', 'Silver', '🌿'],
  ['again-and-again', 'Again and Again', 'Make 10 separate comebacks across habits.', 10, 'epic', 'Gold', '🔄'],
  ['brave-restart', 'Brave Restart', 'Complete a hard habit again after many misses.', 3, 'epic', 'Gold', '🛡️'],
  ['second-wind', 'Second Wind', 'Complete an evening habit after missing the morning.', 1, 'common', 'Bronze', '🌙'],
  ['new-week-new-me', 'New Week, New Me', 'Complete a habit on Monday after a weak week.', 1, 'rare', 'Silver', '📅'],
  ['small-return', 'Small Return', 'Come back with one small habit.', 5, 'common', 'Bronze', '🌤️'],
  ['steady-returner', 'Steady Returner', 'Make 20 comeback completions.', 20, 'epic', 'Gold', '🧭'],
  ['hard-day-helper', 'Hard Day Helper', 'Show up after two low-completion days.', 3, 'rare', 'Silver', '🤝'],
  ['restart-spark', 'Restart Spark', 'Restart three different habits.', 3, 'rare', 'Silver', '⚡'],
  ['comeback-flame', 'Comeback Flame', 'Make 30 comeback completions.', 30, 'legendary', 'Legendary', '🔥'],
  ['quiet-return', 'Quiet Return', 'Return without needing a perfect day.', 7, 'rare', 'Silver', '🕯️'],
  ['try-again-star', 'Try Again Star', 'Try again 14 times after misses.', 14, 'epic', 'Gold', '⭐'],
  ['resilience-riser', 'Resilience Riser', 'Make 50 comeback completions.', 50, 'legendary', 'Legendary', '🌅'],
  ['weekend-comeback', 'Weekend Comeback', 'Complete a habit after a quiet weekday stretch.', 2, 'rare', 'Silver', '🏁'],
  ['brave-restarter', 'Brave Restarter', 'Return to the wall many times.', 75, 'mythic', 'Mythic', '🏆'],
] as const;

const improvementBadges = [
  ['better-than-yesterday', 'Better Than Yesterday', 'Complete more habits than the previous day.', 1, 'common', 'Bronze', '📈'],
  ['level-up-day', 'Level Up Day', 'Beat your own daily completion record.', 1, 'common', 'Bronze', '⬆️'],
  ['stronger-week', 'Stronger Week', 'Complete more habits this week than last week.', 1, 'common', 'Bronze', '💪'],
  ['best-week-yet', 'Best Week Yet', 'Set a new weekly habit completion record.', 1, 'rare', 'Silver', '🏅'],
  ['tiny-progress', 'Tiny Progress', 'Improve by at least one completion compared with yesterday.', 3, 'common', 'Bronze', '🌱'],
  ['climbing-up', 'Climbing Up', 'Improve weekly total for 2 weeks in a row.', 2, 'rare', 'Silver', '🧗'],
  ['momentum-builder', 'Momentum Builder', 'Complete more in the second half of a week.', 1, 'rare', 'Silver', '🌀'],
  ['personal-best', 'Personal Best', 'Reach a new all-time daily record.', 2, 'rare', 'Silver', '🥇'],
  ['my-new-record', 'My New Record', 'Set a new category record.', 1, 'rare', 'Silver', '📌'],
  ['growing-strong', 'Growing Strong', 'Improve monthly total compared with last month.', 1, 'epic', 'Gold', '🌳'],
  ['record-rider', 'Record Rider', 'Set 5 new daily records.', 5, 'epic', 'Gold', '🏄'],
  ['week-builder', 'Week Builder', 'Beat a weekly total 3 times.', 3, 'rare', 'Silver', '🧱'],
  ['best-week-builder', 'Best Week Builder', 'Set 4 new weekly records.', 4, 'epic', 'Gold', '🏗️'],
  ['month-mover', 'Month Mover', 'Improve monthly total twice.', 2, 'epic', 'Gold', '📆'],
  ['tiny-progress-pro', 'Tiny Progress Pro', 'Make 20 improvement days.', 20, 'epic', 'Gold', '🔆'],
  ['steady-climber', 'Steady Climber', 'Make 30 improvement days.', 30, 'legendary', 'Legendary', '⛰️'],
  ['brighter-week', 'Brighter Week', 'Beat last week by 5 or more completions.', 1, 'rare', 'Silver', '🌞'],
  ['halfway-surge', 'Halfway Surge', 'Finish a week stronger than it started 5 times.', 5, 'epic', 'Gold', '🚲'],
  ['new-record-maker', 'New Record Maker', 'Set 10 new personal records.', 10, 'legendary', 'Legendary', '🏆'],
  ['growth-legend', 'Growth Legend', 'Make 60 improvement days.', 60, 'mythic', 'Mythic', '🌈'],
] as const;

const habitGroups: Array<{
  category: AchievementCategory;
  habitCategory: HabitCategory;
  keyword: string;
  icon: string;
  names: [string, string, string];
  thresholds: [number, number, number];
}> = [
  { category: 'Learning & Reading', habitCategory: 'learning', keyword: 'read', icon: '📚', names: ['Reading Rookie', 'Book Explorer', 'Reading Legend'], thresholds: [3, 30, 200] },
  { category: 'Exercise', habitCategory: 'exercise', keyword: 'exercise', icon: '🏃', names: ['Move Maker', 'Strong Body', 'Energy Champion'], thresholds: [3, 50, 150] },
  { category: 'Health & Hygiene', habitCategory: 'health', keyword: 'brush', icon: '🪥', names: ['Clean Start', 'Hygiene Hero', 'Toothbrush Master'], thresholds: [7, 50, 100] },
  { category: 'Morning Routine', habitCategory: 'morning', keyword: 'morning', icon: '🌅', names: ['Morning Starter', 'Morning Hero', 'Sunrise Builder'], thresholds: [7, 30, 100] },
  { category: 'Evening Routine', habitCategory: 'evening', keyword: 'evening', icon: '🌙', names: ['Evening Starter', 'Evening Finisher', 'Night Rhythm'], thresholds: [7, 30, 100] },
  { category: 'Responsibility & Cleanup', habitCategory: 'responsibility', keyword: 'clean', icon: '🧺', names: ['Cleanup Captain', 'Room Rescue', 'Home Helper'], thresholds: [30, 100, 200] },
  { category: 'School Routine', habitCategory: 'school', keyword: 'school', icon: '🎒', names: ['School Ready', 'Backpack Boss', 'Routine Pro'], thresholds: [30, 100, 200] },
  { category: 'Faith & Reflection', habitCategory: 'faith', keyword: 'bible', icon: '🕊️', names: ['Quiet Heart', 'Faithful Light', 'Reflection Guide'], thresholds: [7, 50, 150] },
  { category: 'Learning & Reading', habitCategory: 'learning', keyword: 'diary', icon: '✏️', names: ['Diary Starter', 'Page Builder', 'Writing Wizard'], thresholds: [7, 50, 150] },
] as const;

const consistencyBadges = [
  ['no-zero-day', 'No Zero Day', 'Complete at least one habit every day for 7 days.', 7, 'common', 'Bronze', '0️⃣'],
  ['still-showing-up', 'Still Showing Up', 'Complete at least one habit every day for 14 days.', 14, 'rare', 'Silver', '🧡'],
  ['steady-star', 'Steady Star', 'Complete at least one habit every day for 30 days.', 30, 'epic', 'Gold', '⭐'],
  ['little-by-little', 'Little by Little', 'Complete at least 3 habits per day for 7 days.', 7, 'rare', 'Silver', '🐾'],
  ['gentle-streak', 'Gentle Streak', 'Complete scheduled habits 5 times within 7 days.', 5, 'common', 'Bronze', '🌊'],
  ['keep-going', 'Keep Going', 'Complete at least 20 habits in a week.', 20, 'rare', 'Silver', '➡️'],
  ['consistency-beats-perfect', 'Consistency Beats Perfect', 'Complete habits on 20 days in a month.', 20, 'epic', 'Gold', '💎'],
  ['almost-every-day', 'Almost Every Day', 'Complete at least one habit on 25 days in a month.', 25, 'epic', 'Gold', '📍'],
  ['weekly-root', 'Weekly Root', 'Complete habits on 5 days in a week.', 5, 'common', 'Bronze', '🌿'],
  ['soft-rhythm', 'Soft Rhythm', 'Complete habits on 10 different days.', 10, 'common', 'Bronze', '🎵'],
  ['monthly-rhythm', 'Monthly Rhythm', 'Complete habits on 15 days in a month.', 15, 'rare', 'Silver', '🗓️'],
  ['steady-season', 'Steady Season', 'Complete habits on 60 active days.', 60, 'epic', 'Gold', '🍃'],
  ['brave-pace', 'Brave Pace', 'Complete habits on 90 active days.', 90, 'legendary', 'Legendary', '🧭'],
  ['no-zero-day-star', 'No Zero Day Star', 'Build a 50-day active-day path.', 50, 'legendary', 'Legendary', '🌟'],
  ['365-legend', '365 Legend', 'Reach 365 active days of growth.', 365, 'mythic', 'Mythic', '👑'],
] as const;

const perfectBadges = [
  ['full-house', 'Full House', 'Complete all active habits in one day.', 1, 'rare', 'Silver', '🏠'],
  ['morning-hero-perfect', 'Morning Hero', 'Complete all morning habits in one day.', 1, 'rare', 'Silver', '🌅'],
  ['evening-finisher-perfect', 'Evening Finisher', 'Complete all evening habits in one day.', 1, 'rare', 'Silver', '🌙'],
  ['clean-sweep', 'Clean Sweep', 'Complete all habits in one category in a day.', 1, 'rare', 'Silver', '🧹'],
  ['weekend-win', 'Weekend Win', 'Complete all active weekend habits on one weekend day.', 1, 'rare', 'Silver', '🎉'],
  ['perfect-pair', 'Perfect Pair', 'Complete two perfect days.', 2, 'epic', 'Gold', '✌️'],
  ['perfect-week', 'Perfect Week', 'Complete every active habit for a full week.', 7, 'epic', 'Gold', '🏆'],
  ['bright-sweep', 'Bright Sweep', 'Complete five perfect days.', 5, 'epic', 'Gold', '✨'],
  ['rare-perfect-run', 'Rare Perfect Run', 'Complete ten perfect days.', 10, 'legendary', 'Legendary', '💫'],
  ['perfect-season-spark', 'Perfect Season Spark', 'Complete twenty perfect days.', 20, 'mythic', 'Mythic', '🌈'],
] as const;

const comboBadges = [
  ['balanced-day', 'Balanced Day', 'Complete health, learning, and responsibility habits in one day.', ['health', 'learning', 'responsibility'], 'rare', 'Silver', '⚖️'],
  ['mind-and-body', 'Mind and Body', 'Complete learning and exercise on the same day.', ['learning', 'exercise'], 'common', 'Bronze', '🧠'],
  ['ready-and-clean', 'Ready and Clean', 'Complete school prep and hygiene on the same day.', ['school', 'health'], 'common', 'Bronze', '🎒'],
  ['calm-finish', 'Calm Finish', 'Complete cleanup and evening routine on the same day.', ['responsibility', 'evening'], 'rare', 'Silver', '🕯️'],
  ['big-three', 'Big Three', 'Complete habits from any 3 categories in one day.', ['health', 'learning', 'responsibility'], 'rare', 'Silver', '3️⃣'],
] as const;

const teamBadges = [
  ['team-spark', 'Team Spark', 'Both kids complete at least one habit on the same day.', 1, 'common', 'Bronze', '🤝'],
  ['sibling-power', 'Sibling Power', 'Both kids complete 5+ habits on the same day.', 1, 'rare', 'Silver', '⚡'],
  ['team-comeback', 'Team Comeback', 'Both kids show up after a low-completion day.', 1, 'rare', 'Silver', '🔥'],
  ['family-rhythm', 'Family Rhythm', 'Both kids complete habits on 5 days in the same week.', 5, 'epic', 'Gold', '🎶'],
  ['double-level-up', 'Double Level Up', 'Both kids beat yesterday on the same day.', 1, 'rare', 'Silver', '⬆️'],
] as const;

const secretBadges = [
  ['early-bird', 'Early Bird', 'Complete all morning habits before 9am.', 1, 'rare', 'Silver', '🐣'],
  ['quiet-champion', 'Quiet Champion', 'Complete reading or reflection before any reward is claimed.', 1, 'rare', 'Silver', '🤫'],
  ['surprise-comeback', 'Surprise Comeback', 'Return to a habit after 14+ days away.', 1, 'epic', 'Gold', '🎁'],
  ['hidden-helper', 'Hidden Helper', 'Complete cleanup 3 days in a row.', 3, 'rare', 'Silver', '🧼'],
  ['rainbow-day', 'Rainbow Day', 'Complete habits from 5 categories in one day.', 1, 'epic', 'Gold', '🌈'],
] as const;

function baseDefinitions(): AchievementDefinition[] {
  const defs: AchievementDefinition[] = [];
  let order = 1;

  for (const [id, title, description, value, rarity, tier, icon] of firstSteps) {
    defs.push(makeAchievement({
      achievementId: id,
      title,
      description,
      category: 'First Steps',
      tier,
      icon,
      requirementType: id === 'getting-started' ? 'activeDays' : 'totalCompletions',
      requirementValue: value,
      timeframe: 'lifetime',
      rarity,
      displayOrder: order++,
    }));
  }

  for (const [id, title, description, value, rarity, tier, icon] of comebackBadges) {
    defs.push(makeAchievement({
      achievementId: id,
      title,
      description,
      category: 'Comebacks',
      tier,
      icon,
      requirementType: id.includes('back-on-track') ? 'zeroDayRecoveries' : 'comebackCount',
      requirementValue: value,
      timeframe: 'lifetime',
      rarity,
      displayOrder: order++,
      unlocksTitleIds: id === 'comeback-kid' ? ['comeback-kid'] : id === 'brave-restarter' ? ['brave-restarter'] : undefined,
      unlocksVisualStyleIds: id === 'comeback-flame' ? ['comeback-flame'] : undefined,
    }));
  }

  for (const [id, title, description, value, rarity, tier, icon] of improvementBadges) {
    defs.push(makeAchievement({
      achievementId: id,
      title,
      description,
      category: 'Improvement',
      tier,
      icon,
      requirementType: id.includes('week') ? 'weeklyImprovement' : id.includes('month') || id.includes('growing') ? 'monthlyImprovement' : 'improvementDays',
      requirementValue: value,
      timeframe: id.includes('month') ? 'monthly' : id.includes('week') ? 'weekly' : 'lifetime',
      rarity,
      displayOrder: order++,
      unlocksTitleIds: id === 'tiny-progress-pro' ? ['tiny-progress-pro'] : id === 'best-week-builder' ? ['best-week-builder'] : undefined,
    }));
  }

  for (const group of habitGroups) {
    group.names.forEach((name, index) => {
      const rarity = rarityByIndex[Math.min(index + 1, rarityByIndex.length - 1)];
      defs.push(makeAchievement({
        achievementId: `${group.habitCategory}-${index + 1}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        title: name,
        description: `Complete ${group.category.toLowerCase()} habits ${group.thresholds[index]} times.`,
        category: group.category,
        tier: tierByIndex[index + 1],
        icon: group.icon,
        requirementType: 'categoryCompletions',
        requirementCategory: group.habitCategory,
        habitKeyword: group.keyword,
        requirementValue: group.thresholds[index],
        timeframe: 'lifetime',
        rarity,
        displayOrder: order++,
        unlocksTitleIds: name === 'Reading Legend' ? ['reading-wizard'] : name === 'Energy Champion' ? ['exercise-champion'] : name === 'Cleanup Captain' ? ['cleanup-captain'] : name === 'Toothbrush Master' ? ['toothbrush-master'] : name === 'Morning Hero' ? ['morning-hero'] : undefined,
        unlocksVisualStyleIds: index === 2 ? ['gold-shine'] : undefined,
      }));
    });
  }

  for (const [id, title, description, value, rarity, tier, icon] of consistencyBadges) {
    defs.push(makeAchievement({
      achievementId: id,
      title,
      description,
      category: id.includes('gentle') ? 'Gentle Streaks' : 'Consistency',
      tier,
      icon,
      requirementType: id.includes('zero') || id.includes('showing') || id.includes('steady-star') ? 'dailyStreak' : id.includes('gentle') ? 'gentleFrequency' : 'activeDays',
      requirementValue: value,
      timeframe: 'lifetime',
      rarity,
      displayOrder: order++,
      unlocksTitleIds: id === 'steady-star' ? ['steady-star'] : id === 'no-zero-day-star' ? ['no-zero-day-star'] : id === '365-legend' ? ['365-legend'] : undefined,
      unlocksVisualStyleIds: id === '365-legend' ? ['mythic-aurora'] : undefined,
    }));
  }

  for (const [id, title, description, value, rarity, tier, icon] of perfectBadges) {
    defs.push(makeAchievement({
      achievementId: id,
      title,
      description,
      category: 'Perfect Days',
      tier,
      icon,
      requirementType: 'perfectDays',
      requirementValue: value,
      timeframe: 'lifetime',
      rarity,
      displayOrder: order++,
      unlocksVisualStyleIds: id === 'perfect-week' ? ['legendary-ribbon'] : undefined,
    }));
  }

  for (const [id, title, description, cats, rarity, tier, icon] of comboBadges) {
    defs.push(makeAchievement({
      achievementId: id,
      title,
      description,
      category: 'Combo Badges',
      tier,
      icon,
      requirementType: 'comboDays',
      requirementValue: 1,
      comboCategories: [...cats] as HabitCategory[],
      timeframe: 'daily',
      rarity,
      displayOrder: order++,
      unlocksTitleIds: id === 'balanced-day' ? ['balanced-day-builder'] : undefined,
      unlocksVisualStyleIds: id === 'big-three' ? ['starburst'] : undefined,
    }));
  }

  for (const [id, title, description, value, rarity, tier, icon] of teamBadges) {
    defs.push(makeAchievement({
      achievementId: id,
      title,
      description,
      category: 'Team Badges',
      tier,
      icon,
      requirementType: 'teamSameDay',
      requirementValue: value,
      timeframe: 'weekly',
      rarity,
      displayOrder: order++,
      unlocksTitleIds: id === 'family-rhythm' ? ['family-rhythm-maker'] : undefined,
      unlocksVisualStyleIds: id === 'family-rhythm' ? ['firework-ring'] : undefined,
    }));
  }

  for (const [id, title, description, value, rarity, tier, icon] of secretBadges) {
    defs.push(makeAchievement({
      achievementId: id,
      title,
      description,
      category: 'Secret Badges',
      tier,
      icon,
      requirementType: id === 'rainbow-day' ? 'comboDays' : id === 'surprise-comeback' ? 'comebackCount' : id === 'hidden-helper' ? 'gentleFrequency' : 'comboDays',
      requirementValue: value,
      comboCategories: id === 'rainbow-day' ? ['health', 'learning', 'faith', 'responsibility', 'exercise'] : undefined,
      timeframe: 'lifetime',
      rarity,
      displayOrder: order++,
      isSecret: true,
      unlocksVisualStyleIds: id === 'rainbow-day' ? ['rainbow-glow'] : undefined,
    }));
  }

  milestoneValues.forEach((value, index) => {
    const rarity = milestoneRarities[index] ?? 'mythic';
    defs.push(makeAchievement({
      achievementId: `year-active-days-${value}`,
      title: value === 365 ? '365 Legend' : `${value} Day Builder`,
      description: `Complete at least one habit on ${value} different days.`,
      category: 'Year Journey',
      tier: tierByIndex[Math.min(index, tierByIndex.length - 1)],
      icon: '🗺️',
      requirementType: 'activeDays',
      requirementValue: value,
      timeframe: 'yearly',
      rarity,
      displayOrder: order++,
      unlocksVisualStyleIds: value === 300 ? ['diamond-spark'] : value === 365 ? ['mythic-aurora'] : undefined,
    }));
  });

  const weekly = [
    ['weekly-five-days', 'Five Day Week', 'Complete at least one habit on 5 days this week.', 5],
    ['weekly-reading-3', 'Reading Week', 'Complete reading 3 times this week.', 3],
    ['weekly-exercise-2', 'Energy Week', 'Complete exercise 2 times this week.', 2],
    ['weekly-beat-last', 'Beat Last Week', 'Beat last week’s total by 1.', 1],
    ['weekly-total-20', 'Twenty Habit Week', 'Complete 20 total habits this week.', 20],
    ['weekly-comeback', 'Weekly Comeback', 'Make one comeback after missing a habit.', 1],
    ['weekly-three-cats', 'Three Category Day', 'Complete 3 categories in one day.', 1],
    ['weekly-team-three', 'Team Three Days', 'Both kids complete habits on 3 same days this week.', 3],
  ] as const;
  weekly.forEach(([id, title, description, value]) => defs.push(makeAchievement({
    achievementId: id,
    title,
    description,
    category: 'Weekly Quests',
    tier: 'Silver',
    icon: '📆',
    requirementType: 'weeklyQuest',
    requirementValue: value,
    timeframe: 'weekly',
    rarity: 'rare',
    displayOrder: order++,
    rewardPoints: 20,
  })));

  const monthly = [
    ['monthly-days-20', 'Twenty Day Month', 'Complete habits on 20 different days this month.', 20],
    ['monthly-total-80', 'Eighty Habit Month', 'Complete 80 total habits this month.', 80],
    ['monthly-improve', 'Better Month', 'Improve compared with last month.', 1],
    ['monthly-learning-20', 'Learning Month', 'Complete 20 learning habits.', 20],
    ['monthly-health-20', 'Health Month', 'Complete 20 health habits.', 20],
    ['monthly-responsibility-15', 'Helper Month', 'Complete 15 responsibility habits.', 15],
    ['monthly-comeback-3', 'Comeback Month', 'Make 3 comeback completions.', 3],
    ['monthly-best', 'Best Month Spark', 'Set one new personal best.', 1],
    ['monthly-every-week', 'Every Week Spark', 'Complete at least one habit in every full week.', 4],
  ] as const;
  monthly.forEach(([id, title, description, value]) => defs.push(makeAchievement({
    achievementId: id,
    title,
    description,
    category: 'Monthly Quests',
    tier: 'Gold',
    icon: '🗓️',
    requirementType: 'monthlyQuest',
    requirementValue: value,
    timeframe: 'monthly',
    rarity: 'epic',
    displayOrder: order++,
    rewardPoints: 35,
  })));

  return defs;
}

export const ACHIEVEMENTS: AchievementDefinition[] = baseDefinitions();

export const TITLE_DEFINITIONS: TitleDefinition[] = [
  ['morning-hero', 'Morning Hero', 'Starts the day with courage.'],
  ['reading-wizard', 'Reading Wizard', 'Builds power through books.'],
  ['exercise-champion', 'Exercise Champion', 'Keeps moving with energy.'],
  ['cleanup-captain', 'Cleanup Captain', 'Makes spaces feel calmer.'],
  ['toothbrush-master', 'Toothbrush Master', 'Owns the hygiene routine.'],
  ['comeback-kid', 'Comeback Kid', 'Shows up again after misses.'],
  ['steady-star', 'Steady Star', 'Keeps a gentle rhythm.'],
  ['brave-restarter', 'Brave Restarter', 'Restarts without shame.'],
  ['tiny-progress-pro', 'Tiny Progress Pro', 'Finds wins in small steps.'],
  ['balanced-day-builder', 'Balanced Day Builder', 'Builds whole-person days.'],
  ['365-legend', '365 Legend', 'A full year of growth.'],
  ['best-week-builder', 'Best Week Builder', 'Makes stronger weeks.'],
  ['no-zero-day-star', 'No Zero Day Star', 'Keeps showing up.'],
  ['family-rhythm-maker', 'Family Rhythm Maker', 'Helps the family move together.'],
].map(([titleId, title, description]) => ({
  titleId,
  title,
  description,
  unlockedByAchievementId: ACHIEVEMENTS.find(a => a.unlocksTitleIds?.includes(titleId))?.achievementId ?? 'first-spark',
}));

export const VISUAL_STYLE_DEFINITIONS: BadgeVisualStyleDefinition[] = [
  ['gold-shine', 'Gold Shine', 'A warm gold shine for special insignias.', 'rare', 'gold-shine'],
  ['rainbow-glow', 'Rainbow Glow', 'A bright rainbow glow for surprise days.', 'mythic', 'rainbow-glow'],
  ['crystal-edge', 'Crystal Edge', 'A crisp crystal border.', 'epic', 'crystal-edge'],
  ['starburst', 'Starburst', 'A starry medal burst.', 'rare', 'starburst'],
  ['moonlight-seal', 'Moonlight Seal', 'A soft evening seal.', 'rare', 'moonlight-seal'],
  ['firework-ring', 'Firework Ring', 'A team celebration ring.', 'epic', 'firework-ring'],
  ['diamond-spark', 'Diamond Spark', 'A long-journey diamond sparkle.', 'legendary', 'diamond-spark'],
  ['legendary-ribbon', 'Legendary Ribbon', 'A rare ribbon for huge milestones.', 'legendary', 'legendary-ribbon'],
  ['mythic-aurora', 'Mythic Aurora', 'A mythic aurora for year-long growth.', 'mythic', 'mythic-aurora'],
  ['comeback-flame', 'Comeback Flame', 'A flame for resilient returns.', 'legendary', 'comeback-flame'],
].map(([visualStyleId, name, description, rarity, styleToken]) => ({
  visualStyleId,
  name,
  description,
  rarity: rarity as AchievementRarity,
  styleToken,
  unlockedByAchievementId: ACHIEVEMENTS.find(a => a.unlocksVisualStyleIds?.includes(visualStyleId))?.achievementId ?? 'first-spark',
}));

export function categorizeTask(task: Pick<Task, 'title' | 'icon' | 'timeWindow'>): HabitCategory[] {
  const text = `${task.title} ${task.icon}`.toLowerCase();
  const cats = new Set<HabitCategory>();
  if (/read|book|diary|workbook|homework|page|독서|책|일기|문제집|숙제/.test(text)) cats.add('learning');
  if (/bible|qt|pray|prayer|faith|reflection|묵상|성경|기도/.test(text)) cats.add('faith');
  if (/clean|cleanup|laundry|room|toy|bed|pajama|정리|빨래|장난감|침구|잠옷/.test(text)) cats.add('responsibility');
  if (/exercise|workout|move|run|운동|스트레칭/.test(text)) cats.add('exercise');
  if (/brush|tooth|wash|lotion|vitamin|supplement|hygiene|양치|세수|로션|비타민|영양제/.test(text)) cats.add('health');
  if (/school|backpack|bag|prepare|학교|가방|준비/.test(text)) cats.add('school');
  if (/morning|affirmation|아침|확언/.test(text) || task.timeWindow === 'morning') cats.add('morning');
  if (/evening|night|pajama|저녁|밤|잠옷/.test(text) || task.timeWindow === 'evening') cats.add('evening');
  if (cats.size === 0) cats.add('responsibility');
  return Array.from(cats);
}
