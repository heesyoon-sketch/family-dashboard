'use client';

import { useId } from 'react';
import { BadgeCheck, Bird, BookOpen, Flame, Handshake, HeartPulse, Moon, Mountain, Sparkles, Star, Sun, Users, Zap, Backpack, Pencil, CalendarCheck } from 'lucide-react';
import type { AchievementDefinition, AchievementRarity } from '@/lib/achievements/definitions';
import type { ShieldTier } from '@/lib/shields/engine';

// Each mark echoes its Shield Wall illustration (ring + check, summit,
// phoenix, two friends, open book, heartbeat, helping hands, bolt, candle
// flame, backpack, sun, moon) so the small and large shields read as one.
const MARKS = {
  consistency: BadgeCheck, growth: Mountain, comeback: Bird, teamwork: Users,
  learning: BookOpen, health: HeartPulse, responsibility: Handshake, exercise: Zap,
  faith: Flame, school: Backpack, morning: Sun, evening: Moon,
  writing: Pencil, perfect: Star, milestone: Sparkles, calendar: CalendarCheck,
} as const;
export type ShieldMark = keyof typeof MARKS;

export function categoryMark(category: string | null): ShieldMark {
  return category && Object.prototype.hasOwnProperty.call(MARKS, category) ? category as ShieldMark : 'learning';
}

/** Preserve the achievement's meaning while dropping details that disappear at 38px. */
export function achievementMark(badge: AchievementDefinition): ShieldMark {
  if (badge.questMetric === 'comeback' || /comeback|recover/.test(badge.achievementId)) return 'comeback';
  if (badge.questMetric === 'improvement' || /better|beat-last|level-up/.test(badge.achievementId)) return 'growth';
  if (badge.questMetric === 'team' || badge.category === 'Team Shields' || badge.achievementId === 'full-house') return 'teamwork';
  if (badge.habitKeyword === 'diary' || /diary|writing|page-builder/.test(badge.achievementId)) return 'writing';
  if (badge.requirementCategory && badge.requirementCategory in MARKS) return badge.requirementCategory as ShieldMark;
  if (badge.questMetric === 'activeDays') return 'consistency';
  if (badge.questMetric === 'total') return 'milestone';
  if (badge.questMetric === 'combo') return 'perfect';
  if (badge.category === 'Perfect Days') return 'perfect';
  if (badge.category === 'Momentum Trail') return 'growth';
  if (badge.category === 'Weekly Quests' || badge.category === 'Monthly Quests') return 'calendar';
  if (badge.category === 'Year Journey') return 'consistency';
  return 'milestone';
}

type Metal = [light: string, mid: string, dark: string, face: string];

const METALS: Record<AchievementRarity, Metal> = {
  common: ['#E2E8F0', '#8795AD', '#35435D', '#202A3C'],
  rare: ['#D1E9FF', '#719CE6', '#304E83', '#192A43'],
  epic: ['#E6D7FF', '#A387D5', '#57406F', '#2B203F'],
  legendary: ['#FFF0BF', '#C7A35B', '#73552A', '#342A1B'],
  mythic: ['#FFE2C9', '#D99868', '#854629', '#3C251D'],
};

/** Same metals as the Shield Wall frames (SHIELD_TIER_PALETTES). */
const TIER_METALS: Record<ShieldTier, Metal> = {
  silver: ['#F4F7FB', '#B7C1D1', '#5A6578', '#252D3B'],
  gold: ['#FFF0B8', '#F3C14B', '#8F6014', '#36280E'],
  epic: ['#EBC8FF', '#B86CF7', '#5E239F', '#2C1A4A'],
  legendary: ['#FFE9A8', '#FF7A3D', '#A1201A', '#43150C'],
};

interface Silhouette {
  outline: string;
  face: string;
  highlight: string;
  /** Mark box: x, y, size. */
  mark: [number, number, number];
  /** Pieces drawn behind the body in the metal gradient (wings, crown). */
  ornaments?: string[];
}

const PLAIN: Silhouette = {
  outline: 'M5 7 20 3 35 7V20C35 29 28 35 20 38C12 35 5 29 5 20Z',
  face: 'M7 9 20 5.5 33 9V20C33 27.5 27 33 20 35.8C13 33 7 27.5 7 20Z',
  highlight: 'M6 15V8L20 4.2 34 8',
  mark: [10, 10, 20],
};
const CROWNED: Silhouette = {
  ...PLAIN,
  outline: 'M5 8 11 5 15 7 20 3 25 7 29 5 35 8V20C35 29 28 35 20 38C12 35 5 29 5 20Z',
};

/** Shield tiers echo the Wall's frame shapes: hex badge → crested shield →
 *  crowned shield → winged crown, so rank shows in the outline, not just color. */
const TIER_SILHOUETTES: Record<ShieldTier, Silhouette> = {
  silver: {
    outline: 'M20 2.5 35.5 11.2V28.8L20 37.5 4.5 28.8V11.2Z',
    face: 'M20 5.2 33.1 12.6V27.4L20 34.8 6.9 27.4V12.6Z',
    highlight: 'M5.3 11 20 3.3 34.7 11',
    mark: [10, 10, 20],
  },
  gold: {
    outline: 'M5 8 12 5 16 7.6 20 5 24 7.6 28 5 35 8V20C35 29 28 35 20 38C12 35 5 29 5 20Z',
    face: 'M7 10 12 7.6 16 10 20 7.6 24 10 28 7.6 33 10V20C33 27.5 27 33 20 35.8C13 33 7 27.5 7 20Z',
    highlight: 'M5.8 15V8.6L12 5.8 16 8.4 20 5.8 24 8.4 28 5.8 34.2 8.6',
    mark: [10, 11, 20],
  },
  epic: {
    outline: 'M3.5 11 9.5 4.5 15 7.5 20 1.5 25 7.5 30.5 4.5 36.5 11 34.5 22C33.5 30 27 35 20 38.5C13 35 6.5 30 5.5 22Z',
    face: 'M6 12 10 7.3 15 10 20 4.8 25 10 30 7.3 34 12 32.2 22C31.3 28.5 26 33 20 35.9C14 33 8.7 28.5 7.8 22Z',
    highlight: 'M4.4 16 4.4 11 9.6 5.5 15 8.4 20 2.6 25 8.4 30.4 5.5 35.6 11',
    mark: [10, 11, 20],
  },
  legendary: {
    outline: 'M8 11 20 8.5 32 11V21.5C32 29.5 26.5 34.5 20 37.5C13.5 34.5 8 29.5 8 21.5Z',
    face: 'M10 12.6 20 10.6 30 12.6V21.5C30 28 25.5 32.5 20 35.2C14.5 32.5 10 28 10 21.5Z',
    highlight: 'M8.8 18V11.6L20 9.3 31.2 11.6',
    mark: [11, 13, 18],
    ornaments: [
      'M8.5 15C5.8 13 3.2 13.3 1.4 15.4 3.6 15.8 4.6 16.7 5 17.7 2.8 18.1 1.8 20 4.4 20.1 5.6 20.8 4.4 22.1 4.2 24 6.6 23 8.5 22.3Z',
      'M31.5 15C34.2 13 36.8 13.3 38.6 15.4 36.4 15.8 35.4 16.7 35 17.7 37.2 18.1 38.2 20 35.6 20.1 34.4 20.8 35.6 22.1 35.8 24 33.4 23 31.5 22.3Z',
      'M13 11 14 5 17 8 20 3 23 8 26 5 27 11Q20 9 13 11Z',
    ],
  },
};

/** A dedicated small-size drawing: one large ivory mark, a tier-tinted enamel
 *  face, and directional metal highlights instead of tiny jewels or glow.
 *  Pass `tier` for monthly Shields, or `rarity` for legacy insignias. */
export function CompactShield({ rarity = 'common', tier, mark, size = 38, title }: {
  rarity?: AchievementRarity;
  tier?: ShieldTier;
  mark: ShieldMark;
  size?: number;
  title?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const [light, mid, dark, face] = tier ? TIER_METALS[tier] : METALS[rarity];
  const shape = tier ? TIER_SILHOUETTES[tier] : rarity === 'legendary' || rarity === 'mythic' ? CROWNED : PLAIN;
  const [mx, my, ms] = shape.mark;
  const Mark = MARKS[mark];
  return (
    <span className="relative inline-block shrink-0 align-middle" style={{ width: size, height: size, lineHeight: 0 }} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`${uid}-metal`} x1="8" y1="4" x2="29" y2="38" gradientUnits="userSpaceOnUse">
            <stop stopColor={light}/><stop offset=".32" stopColor={mid}/><stop offset=".65" stopColor={dark}/><stop offset="1" stopColor={mid}/>
          </linearGradient>
          <linearGradient id={`${uid}-face`} x1="14" y1="7" x2="25" y2="35" gradientUnits="userSpaceOnUse">
            <stop stopColor={face}/><stop offset="1" stopColor="#0E121C"/>
          </linearGradient>
        </defs>
        {shape.ornaments?.map(d => <path key={d} d={d} fill={`url(#${uid}-metal)`} stroke={dark} strokeWidth=".5" strokeLinejoin="round"/>)}
        <path d={shape.outline} fill="#080B14" transform="translate(0 1)"/>
        <path d={shape.outline} fill={`url(#${uid}-metal)`}/>
        <path d={shape.face} fill={`url(#${uid}-face)`}/>
        <path d={shape.highlight} stroke={light} strokeWidth=".8" strokeLinecap="round" strokeLinejoin="round" opacity=".75"/>
        <Mark x={mx} y={my} width={ms} height={ms} color="#FFF6E6" strokeWidth={ms < 20 ? 2.8 : 2.7} strokeLinecap="round" strokeLinejoin="round" />
        {!tier && rarity === 'mythic' && <path d="m18 6 2-2 2 2-2 2Z" fill={light}/>}
      </svg>
    </span>
  );
}
