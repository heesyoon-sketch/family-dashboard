// Maps the production achievement catalog onto bespoke per-shield SVG
// illustrations from the FamBit Shield Wall design package. When an
// achievementId has no exact match, the closest thematic icon is used so
// every shield still gets richer art than the legacy emoji fallback.

import type { ComponentType } from 'react';
import type { AchievementRarity } from '@/lib/achievements/definitions';
import {
  Icon100DayBuilder,
  Icon150DayBuilder,
  Icon200DayBuilder,
  Icon250DayBuilder,
  Icon300DayBuilder,
  Icon365Legend,
  IconBackpackBoss,
  IconBeatLastWeek,
  IconBestMonthSpark,
  IconBetterMonth,
  IconBookExplorer,
  IconBrightSweep,
  IconCleanStart,
  IconCleanupCaptain,
  IconComebackMonth,
  IconDayBuilder,
  IconDoubleLevelUp,
  IconEarlyBird,
  IconEightyHabit,
  IconEnergyChampion,
  IconEnergyWeek,
  IconEveningFinisher,
  IconEveningStarter,
  IconEveryWeekSpark,
  IconFaithfulLight,
  IconFamilyRhythm,
  IconFirstSpark,
  IconFirstStep,
  IconFiveDay,
  IconGettingStarted,
  IconHealthMonth,
  IconHelperMonth,
  IconHiddenHelper,
  IconHomeHelper,
  IconHygieneHero,
  IconITried,
  IconLearningMonth,
  IconLittleWin,
  IconMorningHero,
  IconMorningStarter,
  IconNightOwl,
  IconNightRhythm,
  IconPageBuilder,
  IconPerfectPair,
  IconPerfectSeasonSpark,
  IconPerfectWeek,
  IconPerfectYear,
  IconRarePerfectRun,
  IconReadingLegend,
  IconReadingWeek,
  IconReflectionGuide,
  IconRoomRescue,
  IconRoutinePro,
  IconSevenDayBuilder,
  IconSiblingPower,
  IconStrongBody,
  IconSunriseBuilder,
  IconTeamComeback,
  IconTeamSpark,
  IconTeamThreeDays,
  IconThreeCategory,
  IconToothbrushMaster,
  IconTwentyDay,
  IconWeeklyComeback,
  IconWritingWizard,
  IconYearChampion,
} from './shieldIcons';

type IconComponent = ComponentType<Record<string, never>>;

export const SHIELD_ART_REGISTRY: Record<string, IconComponent> = {
  // First Steps
  'first-spark': IconFirstSpark,
  'little-win': IconLittleWin,
  'getting-started': IconGettingStarted,
  'i-tried-today': IconITried,

  // Habit groups — three tiers each
  'learning-1-reading-rookie': IconReadingWeek,
  'learning-2-book-explorer': IconBookExplorer,
  'learning-3-reading-legend': IconReadingLegend,
  'exercise-1-move-maker': IconEnergyWeek,
  'exercise-2-strong-body': IconStrongBody,
  'exercise-3-energy-champion': IconEnergyChampion,
  'health-1-clean-start': IconCleanStart,
  'health-2-hygiene-hero': IconHygieneHero,
  'health-3-toothbrush-master': IconToothbrushMaster,
  'morning-1-morning-starter': IconMorningStarter,
  'morning-2-morning-hero': IconMorningHero,
  'morning-3-sunrise-builder': IconSunriseBuilder,
  'evening-1-evening-starter': IconEveningStarter,
  'evening-2-evening-finisher': IconEveningFinisher,
  'evening-3-night-rhythm': IconNightRhythm,
  'responsibility-1-cleanup-captain': IconCleanupCaptain,
  'responsibility-2-room-rescue': IconRoomRescue,
  'responsibility-3-home-helper': IconHomeHelper,
  'school-1-school-ready': IconBackpackBoss,
  'school-2-backpack-boss': IconBackpackBoss,
  'school-3-routine-pro': IconRoutinePro,
  'faith-1-quiet-heart': IconFaithfulLight,
  'faith-2-faithful-light': IconFaithfulLight,
  'faith-3-reflection-guide': IconReflectionGuide,
  'learning-1-diary-starter': IconPageBuilder,
  'learning-2-page-builder': IconPageBuilder,
  'learning-3-writing-wizard': IconWritingWizard,

  // Perfect Days
  'full-house': IconFamilyRhythm,
  'morning-hero-perfect': IconMorningHero,
  'evening-finisher-perfect': IconEveningFinisher,
  'clean-sweep': IconBrightSweep,
  'weekend-win': IconPerfectWeek,
  'perfect-pair': IconPerfectPair,
  'perfect-week': IconPerfectWeek,
  'bright-sweep': IconBrightSweep,
  'rare-perfect-run': IconRarePerfectRun,
  'perfect-season-spark': IconPerfectSeasonSpark,

  // Combo
  'balanced-day': IconThreeCategory,
  'mind-and-body': IconStrongBody,
  'ready-and-clean': IconBackpackBoss,
  'calm-finish': IconEveningFinisher,
  'big-three': IconThreeCategory,

  // Team
  'team-spark': IconTeamSpark,
  'sibling-power': IconSiblingPower,
  'team-comeback': IconTeamComeback,
  'family-rhythm': IconFamilyRhythm,
  'double-level-up': IconDoubleLevelUp,

  // Secret
  'early-bird': IconEarlyBird,
  'quiet-champion': IconHiddenHelper,
  'surprise-comeback': IconTeamComeback,
  'hidden-helper': IconHiddenHelper,
  'rainbow-day': IconFirstSpark,

  // Year Journey — every milestone has bespoke art
  'year-active-days-7': IconSevenDayBuilder,
  'year-active-days-14': IconDayBuilder,
  'year-active-days-21': IconFirstStep,
  'year-active-days-30': IconRarePerfectRun,
  'year-active-days-50': IconBrightSweep,
  'year-active-days-75': IconNightOwl,
  'year-active-days-100': Icon100DayBuilder,
  'year-active-days-150': Icon150DayBuilder,
  'year-active-days-200': Icon200DayBuilder,
  'year-active-days-250': Icon250DayBuilder,
  'year-active-days-300': Icon300DayBuilder,
  'year-active-days-365': Icon365Legend,

  // Weekly quests
  'weekly-five-days': IconFiveDay,
  'weekly-reading-3': IconReadingWeek,
  'weekly-exercise-2': IconEnergyWeek,
  'weekly-beat-last': IconBeatLastWeek,
  'weekly-total-20': IconBeatLastWeek,
  'weekly-comeback': IconWeeklyComeback,
  'weekly-three-cats': IconThreeCategory,
  'weekly-team-three': IconTeamThreeDays,

  // Monthly quests
  'monthly-days-20': IconTwentyDay,
  'monthly-total-80': IconEightyHabit,
  'monthly-improve': IconBetterMonth,
  'monthly-learning-20': IconLearningMonth,
  'monthly-health-20': IconHealthMonth,
  'monthly-responsibility-15': IconHelperMonth,
  'monthly-comeback-3': IconComebackMonth,
  'monthly-best': IconBestMonthSpark,
  'monthly-every-week': IconEveryWeekSpark,
};

// Fallback icon when an achievementId is not explicitly mapped — keyed by
// rarity so the shield still feels tier-appropriate.
export const SHIELD_ART_FALLBACK: Record<AchievementRarity, IconComponent> = {
  common: IconLittleWin,
  rare: IconCleanStart,
  epic: IconPerfectPair,
  legendary: IconYearChampion,
  mythic: IconPerfectYear,
};

export function hasShieldArt(achievementId: string): boolean {
  return achievementId in SHIELD_ART_REGISTRY;
}
