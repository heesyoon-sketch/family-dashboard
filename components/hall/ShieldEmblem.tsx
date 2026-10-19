'use client';

import { useId, type ComponentType } from 'react';
import type { ShieldTier, ShieldType } from '@/lib/shields/engine';
import { EpicFrame, LegendaryFrame, MythicFrame, RareFrame, SHIELD_TIER_PALETTES } from '@/components/insignia/shieldFrames';
import { IconEveningFinisher, IconEveryWeekSpark, IconMorningHero } from '@/components/insignia/shieldIcons';

// Shields use the FamBit Shield Wall design package (the same frame shapes
// and illustrations the insignias had): the tier picks the shape and its own
// metal, the kind (morning / evening / bonus) picks the art.

/** Tier → frame shape, in increasing grandeur (recolored per tier). */
const TIER_SHAPE: Record<ShieldTier, typeof RareFrame> = {
  silver: RareFrame,
  gold: EpicFrame,
  epic: MythicFrame,
  legendary: LegendaryFrame,
};

const TYPE_ART: Record<ShieldType, ComponentType> = {
  morning: IconMorningHero,
  evening: IconEveningFinisher,
  bonus: IconEveryWeekSpark,
};

export function ShieldEmblem({ type, tier, size = 120, projected = false, title }: {
  type: ShieldType;
  tier: ShieldTier;
  size?: number;
  /** "On pace" preview — drawn faded so it never reads as earned. */
  projected?: boolean;
  title?: string;
}) {
  const uid = useId().replace(/[:]/g, '');
  const faded = projected ? 'opacity-55 saturate-50' : '';
  const Frame = TIER_SHAPE[tier];
  const Art = TYPE_ART[type];
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
