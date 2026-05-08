'use client';

import { useId } from 'react';
import type { AchievementRarity } from '@/lib/achievements/definitions';

export type InsigniaShape = 'circle' | 'shield';

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

const TIERS: Record<AchievementRarity, TierPalette> = {
  // Bronze — warm copper, soft and approachable
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
  // Silver — cool platinum with a blue whisper
  uncommon: {
    edgeOuter: '#5e6a7a',
    edgeMid: '#cfd6e0',
    edgeInner: '#3e4754',
    faceLight: '#f3f7ff',
    faceMid: '#bcc6d4',
    faceDeep: '#6b7686',
    rimAccent: '#eaf1fb',
    starColor: '#f5faff',
    glow: 'rgba(190, 206, 225, 0.42)',
    highlight: 'rgba(255, 255, 255, 0.92)',
  },
  // Gold — bright amber, the classic prize
  rare: {
    edgeOuter: '#7d4f0c',
    edgeMid: '#f5c542',
    edgeInner: '#5b3a05',
    faceLight: '#fff1a8',
    faceMid: '#f5c542',
    faceDeep: '#9a6d10',
    rimAccent: '#fff3a8',
    starColor: '#fff6c8',
    glow: 'rgba(245, 197, 66, 0.5)',
    highlight: 'rgba(255, 244, 180, 0.95)',
  },
  // Platinum/violet — epic
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
  // Legendary — radiant orange-gold with a sunset rim
  legendary: {
    edgeOuter: '#8a4308',
    edgeMid: '#ffb04a',
    edgeInner: '#5a2a02',
    faceLight: '#ffe8b3',
    faceMid: '#ffb04a',
    faceDeep: '#a85a08',
    rimAccent: '#ffe9b8',
    starColor: '#fff2c8',
    glow: 'rgba(255, 162, 60, 0.6)',
    highlight: 'rgba(255, 240, 200, 0.98)',
  },
  // Mythic — aurora prismatic
  mythic: {
    edgeOuter: '#1f4f8a',
    edgeMid: '#7adff2',
    edgeInner: '#3b1f5a',
    faceLight: '#ffe0f3',
    faceMid: '#a3a8ff',
    faceDeep: '#3b2a7a',
    rimAccent: '#ffd6f5',
    starColor: '#ffffff',
    glow: 'rgba(170, 130, 255, 0.62)',
    highlight: 'rgba(255, 230, 250, 1)',
  },
};

const STAR_PATH = 'M0,-5 L1.4,-1.6 L5,-1.4 L2.2,1 L3,5 L0,2.7 L-3,5 L-2.2,1 L-5,-1.4 L-1.4,-1.6 Z';

function shapeFor(rarity: AchievementRarity, override?: InsigniaShape): InsigniaShape {
  if (override) return override;
  if (rarity === 'legendary' || rarity === 'mythic') return 'shield';
  return 'circle';
}

function clipPath(shape: InsigniaShape, idPrefix: string) {
  return shape === 'shield' ? (
    <clipPath id={`${idPrefix}-clip`}>
      <path d="M50 6 C 70 6, 86 12, 92 22 V 56 C 92 78, 74 92, 50 96 C 26 92, 8 78, 8 56 V 22 C 14 12, 30 6, 50 6 Z" />
    </clipPath>
  ) : (
    <clipPath id={`${idPrefix}-clip`}>
      <circle cx="50" cy="50" r="46" />
    </clipPath>
  );
}

function shapeOutline(shape: InsigniaShape, fill: string, stroke?: string, strokeWidth = 0) {
  return shape === 'shield' ? (
    <path
      d="M50 6 C 70 6, 86 12, 92 22 V 56 C 92 78, 74 92, 50 96 C 26 92, 8 78, 8 56 V 22 C 14 12, 30 6, 50 6 Z"
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
    />
  ) : (
    <circle cx="50" cy="50" r="46" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
  );
}

export interface InsigniaBadgeProps {
  rarity: AchievementRarity;
  icon: string;
  locked?: boolean;
  size?: number;
  shape?: InsigniaShape;
  /** Show extra sparkle decorations. Off by default for small badges. */
  showSparkles?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function InsigniaBadge({
  rarity,
  icon,
  locked = false,
  size = 56,
  shape,
  showSparkles,
  className,
  ariaLabel,
}: InsigniaBadgeProps) {
  const uid = useId().replace(/[:]/g, '');
  const palette = TIERS[rarity];
  const resolvedShape = shapeFor(rarity, shape);
  const sparkles = showSparkles ?? (size >= 72 || rarity === 'legendary' || rarity === 'mythic');

  // Icon font scales with badge size; emoji fits inside the medallion face.
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
          {clipPath(resolvedShape, uid)}
          {/* Outer ring metal — diagonal gradient for a beveled feel */}
          <linearGradient id={`${uid}-edge`} x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor={palette.edgeMid} />
            <stop offset="48%" stopColor={palette.edgeOuter} />
            <stop offset="100%" stopColor={palette.edgeInner} />
          </linearGradient>
          {/* Medallion face — radial light from upper-left */}
          <radialGradient id={`${uid}-face`} cx="36%" cy="32%" r="78%">
            <stop offset="0%" stopColor={palette.faceLight} />
            <stop offset="55%" stopColor={palette.faceMid} />
            <stop offset="100%" stopColor={palette.faceDeep} />
          </radialGradient>
          {/* Top gloss */}
          <radialGradient id={`${uid}-gloss`} cx="50%" cy="0%" r="70%">
            <stop offset="0%" stopColor={palette.highlight} stopOpacity="0.85" />
            <stop offset="55%" stopColor={palette.highlight} stopOpacity="0" />
          </radialGradient>
          {/* Mythic sweep — only used at mythic for an aurora wash */}
          {rarity === 'mythic' && (
            <linearGradient id={`${uid}-aurora`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7adff2" stopOpacity="0.55" />
              <stop offset="40%" stopColor="#a98bff" stopOpacity="0.45" />
              <stop offset="75%" stopColor="#ffafe0" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#fff7a8" stopOpacity="0.4" />
            </linearGradient>
          )}
          {/* Soft outer glow */}
          <radialGradient id={`${uid}-glow`} cx="50%" cy="50%" r="55%">
            <stop offset="55%" stopColor={palette.glow} stopOpacity="0" />
            <stop offset="80%" stopColor={palette.glow} stopOpacity="0.55" />
            <stop offset="100%" stopColor={palette.glow} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer halo for legendary/mythic */}
        {!locked && (rarity === 'legendary' || rarity === 'mythic') && (
          <circle cx="50" cy="50" r="49" fill={`url(#${uid}-glow)`} />
        )}

        {/* Outer rim */}
        {shapeOutline(resolvedShape, `url(#${uid}-edge)`)}

        {/* Inner medallion */}
        <g clipPath={`url(#${uid}-clip)`}>
          {resolvedShape === 'shield' ? (
            <path
              d="M50 12 C 66 12, 80 18, 86 26 V 54 C 86 72, 70 84, 50 88 C 30 84, 14 72, 14 54 V 26 C 20 18, 34 12, 50 12 Z"
              fill={`url(#${uid}-face)`}
            />
          ) : (
            <circle cx="50" cy="50" r="38" fill={`url(#${uid}-face)`} />
          )}

          {/* Mythic aurora wash on the face */}
          {rarity === 'mythic' && !locked && (
            <circle cx="50" cy="50" r="38" fill={`url(#${uid}-aurora)`} opacity="0.85" />
          )}

          {/* Inner accent ring */}
          {resolvedShape === 'shield' ? (
            <path
              d="M50 16 C 64 16, 78 22, 84 28 V 52 C 84 70, 68 82, 50 86 C 32 82, 16 70, 16 52 V 28 C 22 22, 36 16, 50 16 Z"
              fill="none"
              stroke={palette.rimAccent}
              strokeOpacity="0.55"
              strokeWidth="1.4"
            />
          ) : (
            <circle
              cx="50"
              cy="50"
              r="34"
              fill="none"
              stroke={palette.rimAccent}
              strokeOpacity="0.55"
              strokeWidth="1.4"
            />
          )}

          {/* Top gloss highlight */}
          {!locked && (
            resolvedShape === 'shield' ? (
              <path
                d="M50 12 C 66 12, 80 18, 86 26 V 50 C 76 44, 62 40, 50 40 C 38 40, 24 44, 14 50 V 26 C 20 18, 34 12, 50 12 Z"
                fill={`url(#${uid}-gloss)`}
                opacity="0.7"
              />
            ) : (
              <ellipse cx="50" cy="32" rx="30" ry="14" fill={`url(#${uid}-gloss)`} opacity="0.85" />
            )
          )}
        </g>

        {/* Decorative stars around the rim for higher tiers */}
        {sparkles && !locked && (
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

        {/* Locked dot */}
        {locked && (
          <circle cx="50" cy="50" r="4.5" fill="rgba(20,20,30,0.6)" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
        )}
      </svg>

      {/* Icon overlay (emoji) — positioned absolutely on top of the medallion */}
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
            // The emoji sits on a light-on-dark medallion; a soft drop-shadow
            // keeps it readable across all tiers without recoloring.
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
