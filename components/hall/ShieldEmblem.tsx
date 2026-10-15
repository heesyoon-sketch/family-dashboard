'use client';

import { useId, type ComponentType } from 'react';
import type { ShieldTier, ShieldType } from '@/lib/shields/engine';
import { EpicFrame, LegendaryFrame, MythicFrame, RareFrame, SHIELD_TIER_PALETTES } from '@/components/insignia/shieldFrames';
import { CompactShield, categoryMark } from '@/components/insignia/CompactShield';
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

// Shields use the FamBit Shield Wall design package (the same frame shapes
// and illustrations the insignias had): the tier picks the shape and its own
// metal, the type — or, for Dedication, the habit area — picks the art.

/** Tier → frame shape, in increasing grandeur (recolored per tier). */
const TIER_SHAPE: Record<ShieldTier, typeof RareFrame> = {
  silver: RareFrame,
  gold: EpicFrame,
  epic: MythicFrame,
  legendary: LegendaryFrame,
};

/** Below this size the illustration turns to mush; draw the compact mark. */
const COMPACT_MAX_PX = 44;

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
  const faded = projected ? 'opacity-55 saturate-50' : '';
  if (size <= COMPACT_MAX_PX) {
    return (
      <span className={`inline-block shrink-0 align-middle ${faded}`} style={{ lineHeight: 0 }}>
        <CompactShield tier={tier} mark={type === 'dedication' ? categoryMark(category) : type} size={size} title={title} />
      </span>
    );
  }
  const Frame = TIER_SHAPE[tier];
  const Art = (type === 'dedication' && category && DEDICATION_ART[category]) || TYPE_ART[type];
  return (
    <span
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={`relative inline-block shrink-0 align-middle ${faded}`}
      style={{ width: size, height: size, lineHeight: 0 }}
    >
      <Frame uid={uid} palette={SHIELD_TIER_PALETTES[tier]}><Art /></Frame>
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
