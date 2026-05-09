import type { Task } from '@/lib/db';

export type AchievementCategory =
  | 'First Steps'
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
  | 'Combo Shields'
  | 'Team Shields'
  | 'Secret Shields';

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
  unlocksVisualStyleIds?: string[];
  relatedHabitIds?: string[];
  requirementCategory?: HabitCategory;
  habitKeyword?: string;
  comboCategories?: HabitCategory[];
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

const habitGroups: Array<{
  category: AchievementCategory;
  habitCategory: HabitCategory;
  keyword: string;
  icon: string;
  names: [string, string, string];
  thresholds: [number, number, number];
}> = [
  // Habit-group thresholds: index 0 = rare (~14 of that habit), 1 = epic
  // (~60), 2 = legendary (~200). Bumped from the old lenient set so a kid
  // can't unlock a "rare" silhouette by reading three times in one
  // afternoon — a rare shield should reflect a couple weeks of work.
  { category: 'Learning & Reading', habitCategory: 'learning', keyword: 'read', icon: '📚', names: ['Reading Rookie', 'Book Explorer', 'Reading Legend'], thresholds: [14, 60, 200] },
  { category: 'Exercise', habitCategory: 'exercise', keyword: 'exercise', icon: '🏃', names: ['Move Maker', 'Strong Body', 'Energy Champion'], thresholds: [14, 60, 200] },
  { category: 'Health & Hygiene', habitCategory: 'health', keyword: 'brush', icon: '🪥', names: ['Clean Start', 'Hygiene Hero', 'Toothbrush Master'], thresholds: [14, 60, 150] },
  { category: 'Morning Routine', habitCategory: 'morning', keyword: 'morning', icon: '🌅', names: ['Morning Starter', 'Morning Hero', 'Sunrise Builder'], thresholds: [14, 60, 150] },
  { category: 'Evening Routine', habitCategory: 'evening', keyword: 'evening', icon: '🌙', names: ['Evening Starter', 'Evening Finisher', 'Night Rhythm'], thresholds: [14, 60, 150] },
  { category: 'Responsibility & Cleanup', habitCategory: 'responsibility', keyword: 'clean', icon: '🧺', names: ['Cleanup Captain', 'Room Rescue', 'Home Helper'], thresholds: [21, 100, 200] },
  { category: 'School Routine', habitCategory: 'school', keyword: 'school', icon: '🎒', names: ['School Ready', 'Backpack Boss', 'Routine Pro'], thresholds: [21, 100, 200] },
  { category: 'Faith & Reflection', habitCategory: 'faith', keyword: 'bible', icon: '🕊️', names: ['Quiet Heart', 'Faithful Light', 'Reflection Guide'], thresholds: [14, 60, 200] },
  { category: 'Learning & Reading', habitCategory: 'learning', keyword: 'diary', icon: '✏️', names: ['Diary Starter', 'Page Builder', 'Writing Wizard'], thresholds: [14, 60, 200] },
] as const;

// Across the boards below, single-day requirements have been raised so a
// rare/epic/legendary shield reflects sustained work. Common shields keep
// their ~1 day pacing.
const perfectBadges = [
  ['full-house', 'Full House', 'Complete every active habit on 7 different days.', 7, 'rare', 'Silver', '🏠'],
  ['morning-hero-perfect', 'Morning Hero', 'Complete every morning habit on 14 different days.', 14, 'rare', 'Silver', '🌅'],
  ['evening-finisher-perfect', 'Evening Finisher', 'Complete every evening habit on 14 different days.', 14, 'rare', 'Silver', '🌙'],
  ['clean-sweep', 'Clean Sweep', 'Complete every habit in a single category on 14 different days.', 14, 'rare', 'Silver', '🧹'],
  ['weekend-win', 'Weekend Win', 'Complete every weekend habit on 4 different weekend days.', 4, 'rare', 'Silver', '🎉'],
  ['perfect-pair', 'Perfect Pair', 'Complete 14 perfect days.', 14, 'epic', 'Gold', '✌️'],
  ['perfect-week', 'Perfect Week', 'Complete 14 perfect days.', 14, 'epic', 'Gold', '🏆'],
  ['bright-sweep', 'Bright Sweep', 'Complete 21 perfect days.', 21, 'epic', 'Gold', '✨'],
  ['rare-perfect-run', 'Rare Perfect Run', 'Complete 30 perfect days.', 30, 'legendary', 'Legendary', '💫'],
  ['perfect-season-spark', 'Perfect Season Spark', 'Complete 60 perfect days.', 60, 'mythic', 'Mythic', '🌈'],
] as const;

const comboBadges = [
  ['balanced-day', 'Balanced Day', 'Complete health, learning, and responsibility on 14 different days.', 14, ['health', 'learning', 'responsibility'], 'rare', 'Silver', '⚖️'],
  ['mind-and-body', 'Mind and Body', 'Complete learning and exercise on the same day.', 1, ['learning', 'exercise'], 'common', 'Bronze', '🧠'],
  ['ready-and-clean', 'Ready and Clean', 'Complete school prep and hygiene on the same day.', 1, ['school', 'health'], 'common', 'Bronze', '🎒'],
  ['calm-finish', 'Calm Finish', 'Complete cleanup and evening routine on 14 different days.', 14, ['responsibility', 'evening'], 'rare', 'Silver', '🕯️'],
  ['big-three', 'Big Three', 'Complete 3 categories on 14 different days.', 14, ['health', 'learning', 'responsibility'], 'rare', 'Silver', '3️⃣'],
] as const;

const teamBadges = [
  ['team-spark', 'Team Spark', 'Both kids complete at least one habit on the same day.', 1, 'common', 'Bronze', '🤝'],
  ['sibling-power', 'Sibling Power', 'Both kids show up on 14 different days.', 14, 'rare', 'Silver', '⚡'],
  ['team-comeback', 'Team Comeback', 'Both kids show up on 14 different days.', 14, 'rare', 'Silver', '🔥'],
  ['family-rhythm', 'Family Rhythm', 'Both kids show up on 21 different days.', 21, 'epic', 'Gold', '🎶'],
  ['double-level-up', 'Double Level Up', 'Both kids show up on 14 different days.', 14, 'rare', 'Silver', '⬆️'],
] as const;

const secretBadges = [
  ['early-bird', 'Early Bird', 'Show up across 14 mixed-category days.', 14, 'rare', 'Silver', '🐣'],
  ['quiet-champion', 'Quiet Champion', 'Show up across 14 mixed-category days.', 14, 'rare', 'Silver', '🤫'],
  ['surprise-comeback', 'Surprise Comeback', 'Make 14 comebacks across habits.', 14, 'epic', 'Gold', '🎁'],
  ['hidden-helper', 'Hidden Helper', 'Hit 14 habits in a single week.', 14, 'rare', 'Silver', '🧼'],
  ['rainbow-day', 'Rainbow Day', 'Touch 5 categories on 21 different days.', 21, 'epic', 'Gold', '🌈'],
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
        unlocksVisualStyleIds: index === 2 ? ['gold-shine'] : undefined,
      }));
    });
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

  for (const [id, title, description, value, cats, rarity, tier, icon] of comboBadges) {
    defs.push(makeAchievement({
      achievementId: id,
      title,
      description,
      category: 'Combo Shields',
      tier,
      icon,
      requirementType: 'comboDays',
      requirementValue: value,
      comboCategories: [...cats] as HabitCategory[],
      timeframe: 'daily',
      rarity,
      displayOrder: order++,
      unlocksVisualStyleIds: id === 'big-three' ? ['starburst'] : undefined,
    }));
  }

  for (const [id, title, description, value, rarity, tier, icon] of teamBadges) {
    defs.push(makeAchievement({
      achievementId: id,
      title,
      description,
      category: 'Team Shields',
      tier,
      icon,
      requirementType: 'teamSameDay',
      requirementValue: value,
      timeframe: 'weekly',
      rarity,
      displayOrder: order++,
      unlocksVisualStyleIds: id === 'family-rhythm' ? ['firework-ring'] : undefined,
    }));
  }

  for (const [id, title, description, value, rarity, tier, icon] of secretBadges) {
    defs.push(makeAchievement({
      achievementId: id,
      title,
      description,
      category: 'Secret Shields',
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
  // Weekly quests reset every week, so a single productive week unlocks
  // them. That's a common-tier effort — calling them rare contradicted the
  // "rare = weeks of work" rule the rest of the wall follows.
  weekly.forEach(([id, title, description, value]) => defs.push(makeAchievement({
    achievementId: id,
    title,
    description,
    category: 'Weekly Quests',
    tier: 'Bronze',
    icon: '📆',
    requirementType: 'weeklyQuest',
    requirementValue: value,
    timeframe: 'weekly',
    rarity: 'common',
    displayOrder: order++,
    rewardPoints: 8,
  })));

  // Monthly Quests are epic-tier — they should require a month of real
  // commitment, not a single task. The underlying `monthlyQuest` metric
  // returns max(monthActiveDays, monthTotal, monthlyImprovement,
  // comebackCount), so target=1 unlocked on the first task of the month.
  // Targets below all sit at 21+ so the easiest path through the metric
  // (monthTotal) still demands ~3 weeks of consistent activity.
  const monthly = [
    ['monthly-days-20', 'Twenty Day Month', 'Complete habits on 20 different days this month.', 20],
    ['monthly-total-80', 'Eighty Habit Month', 'Complete 80 total habits this month.', 80],
    ['monthly-improve', 'Better Month', 'Beat last month’s totals across 21 days.', 21],
    ['monthly-learning-20', 'Learning Month', 'Complete 20 learning habits.', 20],
    ['monthly-health-20', 'Health Month', 'Complete 20 health habits.', 20],
    ['monthly-responsibility-15', 'Helper Month', 'Complete 21 responsibility habits.', 21],
    ['monthly-comeback-3', 'Comeback Month', 'Show up consistently across 21 days.', 21],
    ['monthly-best', 'Best Month Spark', 'Hit personal-best pace across 21 days.', 21],
    ['monthly-every-week', 'Every Week Spark', 'Stay active across 21 days of the month.', 21],
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

export const VISUAL_STYLE_DEFINITIONS: BadgeVisualStyleDefinition[] = [
  ['gold-shine', 'Gold Shine', 'A warm gold shine for special shields.', 'rare', 'gold-shine'],
  ['rainbow-glow', 'Rainbow Glow', 'A bright rainbow glow for surprise days.', 'mythic', 'rainbow-glow'],
  ['crystal-edge', 'Crystal Edge', 'A crisp crystal border.', 'epic', 'crystal-edge'],
  ['starburst', 'Starburst', 'A starry medal burst.', 'rare', 'starburst'],
  ['moonlight-seal', 'Moonlight Seal', 'A soft evening seal.', 'rare', 'moonlight-seal'],
  ['firework-ring', 'Firework Ring', 'A team celebration ring.', 'epic', 'firework-ring'],
  ['diamond-spark', 'Diamond Spark', 'A long-journey diamond sparkle.', 'legendary', 'diamond-spark'],
  ['legendary-ribbon', 'Legendary Ribbon', 'A rare ribbon for huge milestones.', 'legendary', 'legendary-ribbon'],
  ['mythic-aurora', 'Mythic Aurora', 'A mythic aurora for year-long growth.', 'mythic', 'mythic-aurora'],
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
