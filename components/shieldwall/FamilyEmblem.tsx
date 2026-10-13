'use client';

import { useId } from 'react';
import type { ProtectionState } from '@/lib/analytics/family';

const STATE_COLORS: Record<ProtectionState, { a: string; b: string; glow: string }> = {
  vacation: { a: '#8ff0c8', b: '#3f8f7c', glow: 'rgba(121,232,189,0.35)' },
  'sale-day': { a: '#8ff0c8', b: '#3f8f7c', glow: 'rgba(121,232,189,0.35)' },
  secured: { a: '#c3c4ff', b: '#5b5fc7', glow: 'rgba(165,166,255,0.35)' },
  open: { a: '#f3d99a', b: '#a3864a', glow: 'rgba(232,199,123,0.22)' },
  missed: { a: '#b9bdd6', b: '#4b5070', glow: 'rgba(150,155,190,0.15)' },
};

/** The family crest. Its colour reflects today's routine protection state,
 *  derived from existing penalty rules — never a separate shield economy.
 *  The inner arc shows how many members have been active today. */
export function FamilyEmblem({ state, activeToday, members, size = 168 }: { state: ProtectionState; activeToday: number; members: number; size?: number }) {
  const id = useId().replace(/:/g, '');
  const c = STATE_COLORS[state];
  const share = members > 0 ? activeToday / members : 0;
  const arcLength = 2 * Math.PI * 34;
  return (
    <svg width={size} height={size * 1.12} viewBox="0 0 120 134" aria-hidden className="drop-shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c.a} stopOpacity="0.95" />
          <stop offset="100%" stopColor={c.b} stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id={`${id}-inner`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d2340" />
          <stop offset="100%" stopColor="#11152a" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor={c.glow} />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="62" r="60" fill={`url(#${id}-glow)`} className="motion-safe:animate-[pulse_6s_ease-in-out_infinite]" />
      <path d="M60 6 L104 22 V62 C104 92 85 114 60 126 C35 114 16 92 16 62 V22 Z" fill={`url(#${id}-body)`} />
      <path d="M60 15 L96 28 V62 C96 87 80 106 60 116 C40 106 24 87 24 62 V28 Z" fill={`url(#${id}-inner)`} />
      <path d="M60 15 L96 28 V40 C80 34 40 34 24 40 V28 Z" fill="white" opacity="0.05" />
      <circle cx="60" cy="64" r="34" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
      <circle cx="60" cy="64" r="34" fill="none" stroke={c.a} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${arcLength * share} ${arcLength}`} transform="rotate(-90 60 64)" className="transition-[stroke-dasharray] duration-700 motion-reduce:transition-none" />
      <text x="60" y="70" textAnchor="middle" fontSize="20" fontWeight="700" fill="#F4F5FA">{activeToday}/{members}</text>
    </svg>
  );
}
