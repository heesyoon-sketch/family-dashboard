'use client';

import { useId } from 'react';
import { ArrowUpRight, BookOpen, Check, Flame, Heart, House, Moon, RotateCcw, Sparkles, Sun, Users, Zap, Backpack, Feather, Pencil, CalendarCheck } from 'lucide-react';
import type { AchievementDefinition, AchievementRarity } from '@/lib/achievements/definitions';

const MARKS = {
  consistency: Flame, growth: ArrowUpRight, comeback: RotateCcw, teamwork: Users,
  learning: BookOpen, health: Heart, responsibility: House, exercise: Zap,
  faith: Feather, school: Backpack, morning: Sun, evening: Moon,
  writing: Pencil, perfect: Check, milestone: Sparkles, calendar: CalendarCheck,
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

const METALS: Record<AchievementRarity, [string, string, string, string]> = {
  common: ['#E2E8F0', '#8795AD', '#35435D', '#202A3C'],
  rare: ['#D1E9FF', '#719CE6', '#304E83', '#192A43'],
  epic: ['#E6D7FF', '#A387D5', '#57406F', '#2B203F'],
  legendary: ['#FFF0BF', '#C7A35B', '#73552A', '#342A1B'],
  mythic: ['#FFE2C9', '#D99868', '#854629', '#3C251D'],
};

/** A dedicated small-size drawing: one large ivory mark, a quiet enamel face,
 *  and directional metal highlights instead of tiny jewels or ambient glow. */
export function CompactShield({ rarity, mark, size = 38, title }: {
  rarity: AchievementRarity;
  mark: ShieldMark;
  size?: number;
  title?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const [light, mid, dark, face] = METALS[rarity];
  const Mark = MARKS[mark];
  const crowned = rarity === 'legendary' || rarity === 'mythic';
  const outline = crowned
    ? 'M5 8 11 5 15 7 20 3 25 7 29 5 35 8V20C35 29 28 35 20 38C12 35 5 29 5 20Z'
    : 'M5 7 20 3 35 7V20C35 29 28 35 20 38C12 35 5 29 5 20Z';
  return (
    <span className="relative inline-block shrink-0 align-middle" style={{ width: size, height: size, lineHeight: 0 }} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`${uid}-metal`} x1="8" y1="4" x2="29" y2="38" gradientUnits="userSpaceOnUse">
            <stop stopColor={light}/><stop offset=".32" stopColor={mid}/><stop offset=".65" stopColor={dark}/><stop offset="1" stopColor={mid}/>
          </linearGradient>
          <linearGradient id={`${uid}-face`} x1="14" y1="7" x2="25" y2="35" gradientUnits="userSpaceOnUse">
            <stop stopColor={face}/><stop offset="1" stopColor="#101522"/>
          </linearGradient>
        </defs>
        <path d={outline} fill="#080B14" transform="translate(0 1)"/>
        <path d={outline} fill={`url(#${uid}-metal)`}/>
        <path d="M7 9 20 5.5 33 9V20C33 27.5 27 33 20 35.8C13 33 7 27.5 7 20Z" fill={`url(#${uid}-face)`}/>
        <path d="M6 15V8L20 4.2 34 8" stroke={light} strokeWidth=".8" strokeLinecap="round" opacity=".75"/>
        <path d="M9 23C10 28 15 32 20 34" stroke={mid} strokeWidth=".6" opacity=".4"/>
        <Mark x={10} y={10} width={20} height={20} color="#FFF6E6" strokeWidth={2.7} strokeLinecap="round" strokeLinejoin="round" />
        {rarity === 'mythic' && <path d="m18 6 2-2 2 2-2 2Z" fill={light}/>}
      </svg>
    </span>
  );
}
