'use client';

import { useId, type ComponentType } from 'react';
import type { ShieldTier, ShieldType } from '@/lib/shields/engine';
import type { AchievementRarity } from '@/lib/achievements/definitions';
import { FRAME_BY_RARITY } from '@/components/insignia/shieldFrames';
import {
  IconBackpackBoss,
  IconBetterMonth,
  IconComebackMonth,
  IconEnergyChampion,
  IconEveningFinisher,
  IconEveryWeekSpark,
  IconFaithfulLight,
  IconFamilyRhythm,
  IconHealthMonth,
  IconHelperMonth,
  IconLearningMonth,
  IconMorningHero,
} from '@/components/insignia/shieldIcons';

// Shields use the FamBit Shield Wall design package (the same frames and
// illustrations the insignias had): the tier picks the frame, the type —
// or, for Dedication, the habit area — picks the art.

/** Tier → frame, in increasing grandeur. */
export const TIER_FRAME: Record<ShieldTier, AchievementRarity> = {
  silver: 'rare',
  gold: 'legendary',
  epic: 'epic',
  legendary: 'mythic',
};

const TYPE_ART: Record<ShieldType, ComponentType> = {
  consistency: IconEveryWeekSpark,
  growth: IconBetterMonth,
  comeback: IconComebackMonth,
  teamwork: IconFamilyRhythm,
  dedication: IconLearningMonth,
};

const DEDICATION_ART: Record<string, ComponentType> = {
  learning: IconLearningMonth,
  health: IconHealthMonth,
  responsibility: IconHelperMonth,
  exercise: IconEnergyChampion,
  faith: IconFaithfulLight,
  school: IconBackpackBoss,
  morning: IconMorningHero,
  evening: IconEveningFinisher,
};

export function ShieldEmblem({ type, tier, category = null, size = 120, projected = false, title }: {
  type: ShieldType;
  tier: ShieldTier;
  category?: string | null;
  size?: number;
  /** "On pace" preview — drawn faded so it never reads as earned. */
  projected?: boolean;
  title?: string;
}) {
  const uid = useId().replace(/[:]/g, '');
  const Frame = FRAME_BY_RARITY[TIER_FRAME[tier]];
  const Art = (type === 'dedication' && category && DEDICATION_ART[category]) || TYPE_ART[type];
  return (
    <span
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={`relative inline-block shrink-0 align-middle ${projected ? 'opacity-55 saturate-50' : ''}`}
      style={{ width: size, height: size, lineHeight: 0 }}
    >
      <Frame uid={uid}><Art /></Frame>
    </span>
  );
}

/** Empty slot placeholder. */
export function EmptyShield({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden>
      <path d="M100 18 L172 44 V100 C172 146 140 176 100 188 C60 176 28 146 28 100 V44 Z" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.18)" strokeWidth="3" strokeDasharray="10 10" />
    </svg>
  );
}
