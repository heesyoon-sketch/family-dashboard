'use client';

import { useId } from 'react';
import type { ShieldTier, ShieldType } from '@/lib/shields/engine';

const MATERIAL: Record<ShieldTier, { light: string; mid: string; dark: string; rim: string; symbol: string; glow: string | null }> = {
  silver: { light: '#f1f3f8', mid: '#b4bbcb', dark: '#5f6779', rim: '#dde1ea', symbol: '#2b3142', glow: null },
  gold: { light: '#fff1c4', mid: '#e3b35a', dark: '#8e6222', rim: '#f6d88f', symbol: '#4a2f08', glow: null },
  epic: { light: '#e7ddff', mid: '#8b6cf0', dark: '#3a2386', rim: '#cbbcff', symbol: '#f6f1ff', glow: 'rgba(139,108,240,0.45)' },
  legendary: { light: '#fff6d6', mid: '#f0c053', dark: '#7a4a0c', rim: '#ffe7a6', symbol: '#3a2204', glow: 'rgba(255,205,96,0.55)' },
};

/** Symbols drawn in a 40×40 box centred at (60, 62). */
function Symbol({ type, color }: { type: ShieldType; color: string }) {
  const common = { fill: 'none', stroke: color, strokeWidth: 3.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (type) {
    case 'consistency': // flame inside an unbroken circle
      return (
        <g>
          <circle cx="60" cy="62" r="18" {...common} />
          <path d="M60 50c5 6 8 9 8 14a8 8 0 0 1-16 0c0-3 1.5-5 3.5-7 0 3 1.5 4.5 3 5 0-5 0-8 1.5-12z" fill={color} stroke="none" />
        </g>
      );
    case 'growth': // rising path with an arrowhead
      return (
        <g>
          <path d="M42 76 L54 64 L62 70 L78 50" {...common} />
          <path d="M70 49 H79 V58" {...common} />
        </g>
      );
    case 'comeback': // phoenix: rising body with spread wings above a renewal arc
      return (
        <g>
          <path d="M44 76a18 18 0 0 0 32 0" {...common} />
          <path d="M60 72 V50" {...common} />
          <path d="M60 58c-6-8-14-8-19-5 6 1 10 5 12 10M60 58c6-8 14-8 19-5-6 1-10 5-12 10" {...common} />
          <circle cx="60" cy="47" r="3" fill={color} stroke="none" />
        </g>
      );
    case 'teamwork': // interlocking rings
      return (
        <g>
          <circle cx="52" cy="62" r="11" {...common} />
          <circle cx="68" cy="62" r="11" {...common} />
          <circle cx="60" cy="49" r="5" fill={color} stroke="none" opacity="0.9" />
        </g>
      );
    case 'dedication': // compass star
      return (
        <g>
          <path d="M60 42 L64.5 57.5 L80 62 L64.5 66.5 L60 82 L55.5 66.5 L40 62 L55.5 57.5 Z" fill={color} stroke="none" />
          <circle cx="60" cy="62" r="4" fill="none" stroke={color} strokeWidth="2" opacity="0.6" />
        </g>
      );
  }
}

export function ShieldEmblem({ type, tier, size = 120, projected = false, title }: {
  type: ShieldType;
  tier: ShieldTier;
  size?: number;
  /** Provisional outcome: dashed rim, desaturated, never looks earned. */
  projected?: boolean;
  title?: string;
}) {
  const id = useId().replace(/:/g, '');
  const m = MATERIAL[tier];
  return (
    <svg width={size} height={size * 1.12} viewBox="0 0 120 134" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} className={projected ? 'opacity-70 saturate-[0.55]' : ''}>
      <defs>
        <linearGradient id={`${id}-face`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor={m.light} />
          <stop offset="45%" stopColor={m.mid} />
          <stop offset="100%" stopColor={m.dark} />
        </linearGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={m.rim} />
          <stop offset="100%" stopColor={m.dark} />
        </linearGradient>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.55" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        {m.glow && (
          <radialGradient id={`${id}-glow`} cx="50%" cy="48%" r="55%">
            <stop offset="0%" stopColor={m.glow} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        )}
      </defs>
      {m.glow && !projected && <ellipse cx="60" cy="64" rx="60" ry="64" fill={`url(#${id}-glow)`} />}
      {tier === 'legendary' && !projected && (
        // Ornamental laurel ticks — static, no animation.
        <g stroke={m.rim} strokeWidth="2" strokeLinecap="round" opacity="0.85">
          {[-50, -35, -20, 20, 35, 50].map(a => {
            const r = (a * Math.PI) / 180;
            return <line key={a} x1={60 + Math.sin(r) * 54} y1={70 - Math.cos(r) * 58} x2={60 + Math.sin(r) * 60} y2={70 - Math.cos(r) * 64} />;
          })}
        </g>
      )}
      <path d="M60 6 L106 22 V62 C106 93 86 116 60 128 C34 116 14 93 14 62 V22 Z" fill={`url(#${id}-rim)`} stroke={projected ? m.rim : 'none'} strokeWidth={projected ? 2 : 0} strokeDasharray={projected ? '6 5' : undefined} />
      <path d="M60 14 L98 27.5 V62 C98 88 81 108 60 119 C39 108 22 88 22 62 V27.5 Z" fill={`url(#${id}-face)`} />
      {tier === 'epic' && !projected && (
        // Crystal facets
        <g fill="white" opacity="0.14">
          <path d="M60 14 L98 27.5 L60 62 Z" />
          <path d="M22 62 L60 62 L60 119 C39 108 22 88 22 62 Z" />
        </g>
      )}
      <path d="M60 14 L98 27.5 V44 C82 36 38 36 22 44 V27.5 Z" fill={`url(#${id}-sheen)`} />
      {(tier === 'gold' || tier === 'legendary') && <path d="M60 22 L90 33 V62 C90 84 76 100 60 110 C44 100 30 84 30 62 V33 Z" fill="none" stroke={m.rim} strokeWidth="1.2" opacity="0.7" />}
      <Symbol type={type} color={m.symbol} />
      {tier === 'legendary' && !projected && <path d="M50 9 L55 3 L60 8 L65 3 L70 9 Z" fill={m.rim} />}
    </svg>
  );
}

/** Empty placeholder shield for "no shield yet" / insufficient data. */
export function EmptyShield({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.12} viewBox="0 0 120 134" aria-hidden>
      <path d="M60 6 L106 22 V62 C106 93 86 116 60 128 C34 116 14 93 14 62 V22 Z" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.18)" strokeWidth="2" strokeDasharray="6 6" />
    </svg>
  );
}
