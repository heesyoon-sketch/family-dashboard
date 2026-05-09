'use client';

import { useId } from 'react';
import type { AchievementRarity } from '@/lib/achievements/definitions';

// Shape catalog. The list is intentionally ranked from simplest (circle)
// to most intricate (shield-radiant) so a member's rarity reads at a
// glance from the silhouette alone — no need to memorize colours.
export type InsigniaShape =
  | 'circle'
  | 'squircle'
  | 'hex-pointy'
  | 'octagon'
  | 'shield-heater'
  | 'shield-kite'
  | 'shield-fluted'
  | 'shield-crowned'
  | 'shield-winged'
  | 'shield-radiant';

const SHAPES: Record<InsigniaShape, string> = {
  // 1) plain circle — the absolute simplest, reserved for common
  'circle':
    'M 50 4 A 46 46 0 1 1 50 96 A 46 46 0 1 1 50 4 Z',
  // 2) squircle / rounded square — soft variant of the common silhouette
  'squircle':
    'M 28 4 H 72 Q 96 4 96 28 V 72 Q 96 96 72 96 H 28 Q 4 96 4 72 V 28 Q 4 4 28 4 Z',
  // 3) point-top hexagon — geometric, mid-tier
  'hex-pointy':
    'M 50 4 L 90 27 V 73 L 50 96 L 10 73 V 27 Z',
  // 4) octagon — chunky, slightly more elaborate than hex
  'octagon':
    'M 35 4 H 65 L 96 35 V 65 L 65 96 H 35 L 4 65 V 35 Z',
  // 5) heater shield — classic flat-top shield, where the "shield era" begins
  'shield-heater':
    'M 10 14 H 90 V 48 Q 90 78 50 96 Q 10 78 10 48 Z',
  // 6) kite shield — pointed top + bottom for a more knightly silhouette
  'shield-kite':
    'M 50 4 L 90 22 V 60 Q 80 88 50 96 Q 20 88 10 60 V 22 Z',
  // 7) fluted shield — scalloped sides; ornate
  'shield-fluted':
    'M 50 4 C 70 4 84 10 92 20 Q 86 30 94 40 Q 86 52 94 62 C 90 84 72 94 50 96 C 28 94 10 84 6 62 Q 14 52 6 40 Q 14 30 8 20 C 16 10 30 4 50 4 Z',
  // 8) crowned shield — castellated battlements on top, regal
  'shield-crowned':
    'M 16 16 V 6 H 28 V 16 H 40 V 4 H 60 V 16 H 72 V 6 H 84 V 16 Q 92 18 92 28 V 60 Q 92 86 50 96 Q 8 86 8 60 V 28 Q 8 18 16 16 Z',
  // 9) winged shield — outer flares like furled wings
  'shield-winged':
    'M 50 8 Q 76 8 80 22 Q 96 24 92 38 Q 80 38 80 48 V 60 Q 76 88 50 96 Q 24 88 20 60 V 48 Q 20 38 8 38 Q 4 24 20 22 Q 24 8 50 8 Z',
  // 10) radiant — twelve-point star burst, reserved for mythic
  'shield-radiant':
    'M 50 4 L 56 18 L 70 12 L 72 28 L 88 32 L 80 46 L 96 50 L 80 54 L 88 68 L 72 72 L 70 88 L 56 82 L 50 96 L 44 82 L 30 88 L 28 72 L 12 68 L 20 54 L 4 50 L 20 46 L 12 32 L 28 28 L 30 12 L 44 18 Z',
};

// Each rarity gets one or more shapes. Within a rarity the choice is
// deterministic from the achievement id, so each badge always wears the
// same silhouette — but two rare badges may sport different shapes,
// adding the variety the dashboard needed.
const SHAPES_BY_RARITY: Record<AchievementRarity, readonly InsigniaShape[]> = {
  common:    ['circle', 'squircle'],
  rare:      ['hex-pointy', 'octagon'],
  epic:      ['shield-heater', 'shield-kite'],
  legendary: ['shield-fluted', 'shield-crowned'],
  mythic:    ['shield-winged', 'shield-radiant'],
};

function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function pickShape(rarity: AchievementRarity, seed: string): InsigniaShape {
  const options = SHAPES_BY_RARITY[rarity];
  return options[hashString(seed) % options.length];
}

interface TierPalette {
  edgeOuter: string;
  edgeMid: string;
  edgeInner: string;
  faceLight: string;
  faceMid: string;
  faceDeep: string;
  rimAccent: string;
  starColor: string;
  glow: string;
  highlight: string;
}

// Each rarity has a clearly distinct hue family so a glance is enough to
// read the tier:
//   common    → warm brown
//   rare      → cool sapphire blue
//   epic      → royal purple
//   legendary → bright gold
//   mythic    → deep burnt orange
const TIERS: Record<AchievementRarity, TierPalette> = {
  common: {
    edgeOuter: '#7c4a25',
    edgeMid: '#c98553',
    edgeInner: '#5a3115',
    faceLight: '#f6c393',
    faceMid: '#c98553',
    faceDeep: '#7a4824',
    rimAccent: '#ffd9b3',
    starColor: '#ffe6c4',
    glow: 'rgba(214, 138, 81, 0.38)',
    highlight: 'rgba(255, 232, 200, 0.85)',
  },
  rare: {
    edgeOuter: '#1a3a78',
    edgeMid: '#5b8def',
    edgeInner: '#0d224f',
    faceLight: '#cfe1ff',
    faceMid: '#5b8def',
    faceDeep: '#1f4391',
    rimAccent: '#dceaff',
    starColor: '#eff5ff',
    glow: 'rgba(91, 141, 239, 0.5)',
    highlight: 'rgba(220, 238, 255, 0.95)',
  },
  epic: {
    edgeOuter: '#3f2868',
    edgeMid: '#a98bff',
    edgeInner: '#241646',
    faceLight: '#e8dcff',
    faceMid: '#a98bff',
    faceDeep: '#5a3da3',
    rimAccent: '#e2d5ff',
    starColor: '#f0e7ff',
    glow: 'rgba(169, 139, 255, 0.5)',
    highlight: 'rgba(245, 235, 255, 0.95)',
  },
  legendary: {
    edgeOuter: '#7d4f0c',
    edgeMid: '#f5c542',
    edgeInner: '#5b3a05',
    faceLight: '#fff1a8',
    faceMid: '#f5c542',
    faceDeep: '#9a6d10',
    rimAccent: '#fff3a8',
    starColor: '#fff6c8',
    glow: 'rgba(245, 197, 66, 0.6)',
    highlight: 'rgba(255, 244, 180, 0.98)',
  },
  mythic: {
    edgeOuter: '#7a2e0c',
    edgeMid: '#e85a1c',
    edgeInner: '#3f1804',
    faceLight: '#ffd2a8',
    faceMid: '#e85a1c',
    faceDeep: '#a83a08',
    rimAccent: '#ffdcb8',
    starColor: '#fff0d4',
    glow: 'rgba(232, 90, 28, 0.65)',
    highlight: 'rgba(255, 220, 184, 1)',
  },
};

const STAR_PATH = 'M0,-5 L1.4,-1.6 L5,-1.4 L2.2,1 L3,5 L0,2.7 L-3,5 L-2.2,1 L-5,-1.4 L-1.4,-1.6 Z';

export interface InsigniaBadgeProps {
  rarity: AchievementRarity;
  icon: string;
  /** Stable seed so a badge always shows the same shape. Pass the
   *  achievementId; falls back to icon + rarity when not provided. */
  seed?: string;
  locked?: boolean;
  size?: number;
  /** Manual override; otherwise picked deterministically from rarity+seed. */
  shape?: InsigniaShape;
  showSparkles?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function InsigniaBadge({
  rarity,
  icon,
  seed,
  locked = false,
  size = 56,
  shape,
  showSparkles,
  className,
  ariaLabel,
}: InsigniaBadgeProps) {
  const uid = useId().replace(/[:]/g, '');
  const palette = TIERS[rarity];
  const resolvedShape = shape ?? pickShape(rarity, seed ?? `${rarity}-${icon}`);
  const shapePath = SHAPES[resolvedShape];
  const sparkles = showSparkles ?? (size >= 72 || rarity === 'legendary' || rarity === 'mythic');
  const isStarShape = resolvedShape === 'shield-radiant';

  const iconFontPx = Math.round(size * 0.46);

  return (
    <span
      role="img"
      aria-label={ariaLabel ?? `${rarity} insignia${locked ? ' (locked)' : ''}`}
      className={[
        'inline-block shrink-0 align-middle',
        locked ? 'opacity-60 saturate-[0.35]' : '',
        className ?? '',
      ].join(' ')}
      style={{ width: size, height: size, lineHeight: 0 }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          {/* Clip the inner content to the badge silhouette. */}
          <clipPath id={`${uid}-clip`}>
            <path d={shapePath} />
          </clipPath>
          <linearGradient id={`${uid}-edge`} x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor={palette.edgeMid} />
            <stop offset="48%" stopColor={palette.edgeOuter} />
            <stop offset="100%" stopColor={palette.edgeInner} />
          </linearGradient>
          <radialGradient id={`${uid}-face`} cx="36%" cy="32%" r="78%">
            <stop offset="0%" stopColor={palette.faceLight} />
            <stop offset="55%" stopColor={palette.faceMid} />
            <stop offset="100%" stopColor={palette.faceDeep} />
          </radialGradient>
          <radialGradient id={`${uid}-gloss`} cx="50%" cy="0%" r="70%">
            <stop offset="0%" stopColor={palette.highlight} stopOpacity="0.85" />
            <stop offset="55%" stopColor={palette.highlight} stopOpacity="0" />
          </radialGradient>
          {rarity === 'mythic' && (
            <linearGradient id={`${uid}-aurora`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffb060" stopOpacity="0.55" />
              <stop offset="45%" stopColor="#ff7a2a" stopOpacity="0.5" />
              <stop offset="80%" stopColor="#c63808" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#7a2e0c" stopOpacity="0.45" />
            </linearGradient>
          )}
          <radialGradient id={`${uid}-glow`} cx="50%" cy="50%" r="55%">
            <stop offset="55%" stopColor={palette.glow} stopOpacity="0" />
            <stop offset="80%" stopColor={palette.glow} stopOpacity="0.55" />
            <stop offset="100%" stopColor={palette.glow} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer halo for higher tiers — radiant shape gets its own bigger halo */}
        {!locked && (rarity === 'legendary' || rarity === 'mythic') && (
          <circle cx="50" cy="50" r={isStarShape ? 52 : 49} fill={`url(#${uid}-glow)`} />
        )}

        {/* Outer rim — the silhouette */}
        <path d={shapePath} fill={`url(#${uid}-edge)`} />

        {/* Inner content — same shape, scaled to ~80% so the rim shows. */}
        <g clipPath={`url(#${uid}-clip)`}>
          <g transform="translate(50 50) scale(0.82) translate(-50 -50)">
            <path d={shapePath} fill={`url(#${uid}-face)`} />
          </g>

          {/* Mythic aurora wash on the face */}
          {rarity === 'mythic' && !locked && (
            <g transform="translate(50 50) scale(0.82) translate(-50 -50)">
              <path d={shapePath} fill={`url(#${uid}-aurora)`} opacity="0.85" />
            </g>
          )}

          {/* Inner accent ring — slightly smaller, stroke only */}
          <g transform="translate(50 50) scale(0.74) translate(-50 -50)">
            <path
              d={shapePath}
              fill="none"
              stroke={palette.rimAccent}
              strokeOpacity="0.55"
              strokeWidth="1.9"
              vectorEffect="non-scaling-stroke"
            />
          </g>

          {/* Top gloss highlight — generic top-light, works for every shape */}
          {!locked && (
            <ellipse cx="50" cy="30" rx="32" ry="14" fill={`url(#${uid}-gloss)`} opacity="0.85" />
          )}
        </g>

        {/* Decorative stars around the rim for higher tiers. The star
            shape already has 12 spikes of its own, so we skip stars on
            mythic-radiant to avoid visual clutter. */}
        {sparkles && !locked && !isStarShape && (
          <g fill={palette.starColor} opacity={rarity === 'mythic' ? 0.95 : 0.78}>
            <g transform="translate(50 8)">
              <path d={STAR_PATH} transform="scale(0.7)" />
            </g>
            <g transform="translate(92 50)">
              <path d={STAR_PATH} transform="scale(0.55)" />
            </g>
            <g transform="translate(50 92)">
              <path d={STAR_PATH} transform="scale(0.55)" />
            </g>
            <g transform="translate(8 50)">
              <path d={STAR_PATH} transform="scale(0.55)" />
            </g>
          </g>
        )}

        {locked && (
          <circle cx="50" cy="50" r="4.5" fill="rgba(20,20,30,0.6)" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
        )}
      </svg>

      {!locked && (
        <span
          aria-hidden
          style={{
            display: 'block',
            position: 'relative',
            marginTop: -size,
            width: size,
            height: size,
            lineHeight: `${size}px`,
            fontSize: iconFontPx,
            textAlign: 'center',
            textShadow:
              '0 1px 2px rgba(40,20,0,0.35), 0 0 8px rgba(255,255,255,0.18)',
            userSelect: 'none',
          }}
        >
          {icon}
        </span>
      )}
    </span>
  );
}
