'use client';

// Five rarity frames ported from the FamBit "Shield Wall" design package.
// Each frame is a 200×200 SVG outer chrome with a safe inner area roughly
// (60-140, 60-150) where a per-shield icon is composed.

import type { ReactNode } from 'react';
import type { AchievementRarity } from '@/lib/achievements/definitions';

interface FramePalette {
  rim: [string, string, string];
  body: [string, string];
  panel: [string, string];
  accent: string;
  studs: string;
}

export const FRAME_PALETTES: Record<AchievementRarity, FramePalette> = {
  common: {
    rim:    ['#9ea4bd', '#6e7591', '#3d4159'],
    body:   ['#2c3149', '#1d2138'],
    panel:  ['#1a1d33', '#13162a'],
    accent: '#8e96b0',
    studs:  '#5a6079',
  },
  rare: {
    rim:    ['#7DC3FF', '#5B8EFF', '#2D5BC2'],
    body:   ['#1c2c4d', '#142037'],
    panel:  ['#13203a', '#0c172b'],
    accent: '#4EEDB0',
    studs:  '#4EEDB0',
  },
  epic: {
    rim:    ['#E0A8FF', '#B86CF7', '#6E2EB8'],
    body:   ['#2a1e4a', '#1a1235'],
    panel:  ['#231944', '#170f30'],
    accent: '#FF7BAC',
    studs:  '#FFD93D',
  },
  mythic: {
    rim:    ['#FFB770', '#FF6B3D', '#9B2B0F'],
    body:   ['#4A1F12', '#2A0E08'],
    panel:  ['#3A1A12', '#1F0E08'],
    accent: '#FFD93D',
    studs:  '#FFD93D',
  },
  legendary: {
    rim:    ['#FFE89D', '#FFC54D', '#C28A1F'],
    body:   ['#3D2A12', '#251A0B'],
    panel:  ['#3A2C1A', '#1F1607'],
    accent: '#FF6B6B',
    studs:  '#FF6B6B',
  },
};

interface FrameProps {
  uid: string;
  children: ReactNode;
}

function FrameDefs({ uid, palette, panelCenterY = 0.35, panelRadius = 0.7 }: {
  uid: string;
  palette: FramePalette;
  panelCenterY?: number;
  panelRadius?: number;
}) {
  return (
    <defs>
      <linearGradient id={`${uid}-rim`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={palette.rim[0]}/>
        <stop offset="50%" stopColor={palette.rim[1]}/>
        <stop offset="100%" stopColor={palette.rim[2]}/>
      </linearGradient>
      <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={palette.body[0]}/>
        <stop offset="100%" stopColor={palette.body[1]}/>
      </linearGradient>
      <radialGradient id={`${uid}-panel`} cx="0.5" cy={panelCenterY} r={panelRadius}>
        <stop offset="0%" stopColor={palette.panel[0]}/>
        <stop offset="100%" stopColor={palette.panel[1]}/>
      </radialGradient>
    </defs>
  );
}

export function CommonFrame({ uid, children }: FrameProps) {
  const p = FRAME_PALETTES.common;
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <FrameDefs uid={uid} palette={p}/>
      <rect x="20" y="24" width="160" height="160" rx="28" fill={`url(#${uid}-rim)`}/>
      <rect x="28" y="32" width="144" height="144" rx="22" fill={`url(#${uid}-body)`}/>
      <rect x="40" y="44" width="120" height="120" rx="16" fill={`url(#${uid}-panel)`} stroke={p.accent} strokeWidth="0.6" strokeOpacity="0.3"/>
      {([[40,44],[160,44],[40,164],[160,164]] as const).map(([cx,cy],i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="4" fill={p.studs}/>
          <circle cx={cx-0.8} cy={cy-0.8} r="1.5" fill="#fff" opacity="0.7"/>
        </g>
      ))}
      <path d="M 28 44 Q 30 36 50 32 L 150 32 Q 170 36 172 44" stroke="#fff" strokeWidth="1.5" fill="none" opacity="0.35"/>
      <g>{children}</g>
    </svg>
  );
}

export function RareFrame({ uid, children }: FrameProps) {
  const p = FRAME_PALETTES.rare;
  const outer = '100,16 178,58 178,142 100,184 22,142 22,58';
  const inner = '100,30 165,65 165,135 100,170 35,135 35,65';
  const panel = '100,42 152,72 152,128 100,158 48,128 48,72';
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <FrameDefs uid={uid} palette={p} panelCenterY={0.4} panelRadius={0.65}/>
      <polygon points={outer} fill={`url(#${uid}-rim)`}/>
      <polygon points={inner} fill={`url(#${uid}-body)`}/>
      <polygon points={panel} fill={`url(#${uid}-panel)`} stroke={p.accent} strokeWidth="0.8" strokeOpacity="0.3"/>
      <polygon points="100,30 165,65 100,42" fill="#fff" opacity="0.18"/>
      <polygon points="35,65 100,30 100,42" fill="#fff" opacity="0.1"/>
      <circle cx="100" cy="30" r="3.5" fill={p.studs}/>
      <circle cx="165" cy="65" r="3" fill={p.studs} opacity="0.7"/>
      <circle cx="165" cy="135" r="3" fill={p.studs} opacity="0.7"/>
      <circle cx="100" cy="170" r="3" fill={p.studs} opacity="0.7"/>
      <circle cx="35" cy="135" r="3" fill={p.studs} opacity="0.7"/>
      <circle cx="35" cy="65" r="3" fill={p.studs} opacity="0.7"/>
      <polyline points="22,58 100,16 178,58" stroke="#fff" strokeWidth="2" fill="none" opacity="0.4"/>
      <g>{children}</g>
    </svg>
  );
}

export function EpicFrame({ uid, children }: FrameProps) {
  const p = FRAME_PALETTES.epic;
  const outerPath = 'M 40 38 L 70 28 L 85 38 L 100 28 L 115 38 L 130 28 L 160 38 L 162 100 Q 162 140 130 168 Q 110 180 100 184 Q 90 180 70 168 Q 38 140 38 100 Z';
  const innerPath = 'M 50 46 L 72 38 L 85 46 L 100 38 L 115 46 L 128 38 L 150 46 L 152 100 Q 152 134 126 158 Q 108 170 100 174 Q 92 170 74 158 Q 48 134 48 100 Z';
  const panelPath = 'M 60 56 L 74 50 L 86 56 L 100 50 L 114 56 L 126 50 L 140 56 L 142 100 Q 142 128 122 148 Q 106 158 100 162 Q 94 158 78 148 Q 58 128 58 100 Z';
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <FrameDefs uid={uid} palette={p}/>
      <path d={outerPath} fill={`url(#${uid}-rim)`}/>
      <path d={innerPath} fill={`url(#${uid}-body)`}/>
      <path d={panelPath} fill={`url(#${uid}-panel)`} stroke={p.accent} strokeWidth="0.8" strokeOpacity="0.4"/>
      <g>
        <ellipse cx="100" cy="35" rx="6" ry="4" fill={p.accent}/>
        <ellipse cx="100" cy="34" rx="3" ry="1.5" fill="#fff" opacity="0.8"/>
        <ellipse cx="100" cy="35" rx="6" ry="4" fill="none" stroke={p.rim[2]} strokeWidth="1"/>
      </g>
      <circle cx="70" cy="34" r="2.5" fill={p.studs}/>
      <circle cx="130" cy="34" r="2.5" fill={p.studs}/>
      <circle cx="69" cy="33" r="0.8" fill="#fff" opacity="0.8"/>
      <circle cx="129" cy="33" r="0.8" fill="#fff" opacity="0.8"/>
      <path d="M 50 46 L 72 38 L 85 46 L 100 38 L 115 46 L 128 38 L 150 46" stroke="#fff" strokeWidth="1.2" fill="none" opacity="0.5"/>
      <path d="M 48 100 Q 48 70 56 50" stroke="#fff" strokeWidth="1.5" fill="none" opacity="0.25"/>
      <path d="M 95 174 Q 100 178 105 174" stroke={p.rim[2]} strokeWidth="1.2" fill="none" opacity="0.7"/>
      <circle cx="48" cy="44" r="3" fill={p.rim[1]}/>
      <circle cx="152" cy="44" r="3" fill={p.rim[1]}/>
      <circle cx="47" cy="43" r="1" fill="#fff" opacity="0.8"/>
      <circle cx="151" cy="43" r="1" fill="#fff" opacity="0.8"/>
      <g>{children}</g>
    </svg>
  );
}

export function MythicFrame({ uid, children }: FrameProps) {
  const p = FRAME_PALETTES.mythic;
  const outerPath = 'M 32 60 L 56 32 L 76 44 L 100 28 L 124 44 L 144 32 L 168 60 L 162 110 Q 156 152 124 172 L 100 184 L 76 172 Q 44 152 38 110 Z';
  const innerPath = 'M 42 64 L 60 42 L 76 52 L 100 38 L 124 52 L 140 42 L 158 64 L 152 108 Q 148 144 122 162 L 100 174 L 78 162 Q 52 144 48 108 Z';
  const panelPath = 'M 56 72 L 70 56 L 86 62 L 100 52 L 114 62 L 130 56 L 144 72 L 140 106 Q 138 134 118 150 L 100 162 L 82 150 Q 62 134 60 106 Z';
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <FrameDefs uid={uid} palette={p} panelCenterY={0.4}/>
      <defs>
        <radialGradient id={`${uid}-ember`} cx="0.5" cy="0.85" r="0.6">
          <stop offset="0%" stopColor="#FF8A3D" stopOpacity="0.6"/>
          <stop offset="100%" stopColor="#FF6B3D" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="180" rx="56" ry="14" fill={`url(#${uid}-ember)`}/>
      <path d={outerPath} fill={`url(#${uid}-rim)`}/>
      <path d={innerPath} fill={`url(#${uid}-body)`}/>
      <path d={panelPath} fill={`url(#${uid}-panel)`} stroke={p.accent} strokeWidth="0.8" strokeOpacity="0.45"/>
      <g>
        <circle cx="56" cy="32" r="3.5" fill={p.accent}/>
        <circle cx="56" cy="31" r="1.2" fill="#fff" opacity="0.85"/>
        <circle cx="144" cy="32" r="3.5" fill={p.accent}/>
        <circle cx="144" cy="31" r="1.2" fill="#fff" opacity="0.85"/>
      </g>
      <g>
        <path d="M 92 28 L 100 18 L 108 28 Z" fill={p.rim[1]} stroke={p.rim[2]} strokeWidth="1" strokeLinejoin="round"/>
        <circle cx="100" cy="32" r="3.5" fill="#FF6B6B" stroke={p.rim[2]} strokeWidth="1"/>
        <circle cx="99" cy="31" r="1" fill="#fff" opacity="0.8"/>
      </g>
      <path d="M 42 64 L 60 42 L 76 52 L 100 38 L 124 52 L 140 42 L 158 64" stroke="#FFE0B0" strokeWidth="1.4" fill="none" opacity="0.55"/>
      <circle cx="56" cy="86" r="2.5" fill={p.accent}/>
      <circle cx="144" cy="86" r="2.5" fill={p.accent}/>
      <path d="M 90 168 L 100 178 L 110 168" stroke="#FFB770" strokeWidth="1.2" fill="none" opacity="0.6"/>
      <circle cx="36" cy="120" r="1.5" fill="#FFD93D" opacity="0.7"/>
      <circle cx="164" cy="124" r="1.2" fill="#FF8A3D" opacity="0.8"/>
      <circle cx="28" cy="100" r="1" fill="#FF8A3D" opacity="0.6"/>
      <circle cx="172" cy="98" r="1" fill="#FFD93D" opacity="0.6"/>
      <g>{children}</g>
    </svg>
  );
}

export function LegendaryFrame({ uid, children }: FrameProps) {
  const p = FRAME_PALETTES.legendary;
  const outerPath = 'M 50 48 L 75 38 L 100 44 L 125 38 L 150 48 L 152 102 Q 152 138 128 162 Q 108 178 100 182 Q 92 178 72 162 Q 48 138 48 102 Z';
  const innerPath = 'M 58 54 L 76 46 L 100 52 L 124 46 L 142 54 L 144 102 Q 144 132 122 152 Q 106 166 100 170 Q 94 166 78 152 Q 56 132 56 102 Z';
  const panelPath = 'M 68 64 L 100 60 L 132 64 L 134 102 Q 134 126 116 142 Q 104 152 100 156 Q 96 152 84 142 Q 66 126 66 102 Z';
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <FrameDefs uid={uid} palette={p} panelCenterY={0.4}/>
      <defs>
        <linearGradient id={`${uid}-wing`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={p.rim[2]}/>
          <stop offset="50%" stopColor={p.rim[1]}/>
          <stop offset="100%" stopColor={p.rim[0]}/>
        </linearGradient>
      </defs>
      <g>
        <path d="M 50 90 Q 20 78 8 90 Q 22 92 28 98 Q 14 100 6 112 Q 24 110 32 116 Q 20 122 14 132 Q 30 126 40 128 Q 32 138 30 148 Q 44 140 52 134 Z"
          fill={`url(#${uid}-wing)`} stroke={p.rim[2]} strokeWidth="1" strokeLinejoin="round"/>
        <path d="M 50 92 Q 28 88 14 92" stroke="#fff" strokeWidth="1" fill="none" opacity="0.4"/>
        <path d="M 48 108 Q 28 106 18 110" stroke="#fff" strokeWidth="0.8" fill="none" opacity="0.3"/>
      </g>
      <g>
        <path d="M 150 90 Q 180 78 192 90 Q 178 92 172 98 Q 186 100 194 112 Q 176 110 168 116 Q 180 122 186 132 Q 170 126 160 128 Q 168 138 170 148 Q 156 140 148 134 Z"
          fill={`url(#${uid}-wing)`} stroke={p.rim[2]} strokeWidth="1" strokeLinejoin="round"/>
        <path d="M 150 92 Q 172 88 186 92" stroke="#fff" strokeWidth="1" fill="none" opacity="0.4"/>
        <path d="M 152 108 Q 172 106 182 110" stroke="#fff" strokeWidth="0.8" fill="none" opacity="0.3"/>
      </g>
      <g>
        <path d="M 72 36 L 78 22 L 88 32 L 100 18 L 112 32 L 122 22 L 128 36 Q 100 42 72 36 Z"
          fill={`url(#${uid}-rim)`} stroke={p.rim[2]} strokeWidth="1" strokeLinejoin="round"/>
        <circle cx="100" cy="22" r="2.5" fill={p.studs}/>
        <circle cx="78" cy="26" r="1.8" fill={p.accent}/>
        <circle cx="122" cy="26" r="1.8" fill={p.accent}/>
        <path d="M 78 32 Q 100 38 122 32" stroke="#fff" strokeWidth="1" fill="none" opacity="0.5"/>
      </g>
      <path d={outerPath} fill={`url(#${uid}-rim)`}/>
      <path d={innerPath} fill={`url(#${uid}-body)`}/>
      <path d={panelPath} fill={`url(#${uid}-panel)`} stroke={p.accent} strokeWidth="0.8" strokeOpacity="0.5"/>
      <circle cx="60" cy="54" r="3" fill={p.studs}/>
      <circle cx="140" cy="54" r="3" fill={p.studs}/>
      <circle cx="59" cy="53" r="1" fill="#fff" opacity="0.9"/>
      <circle cx="139" cy="53" r="1" fill="#fff" opacity="0.9"/>
      <path d="M 56 56 L 76 46 L 100 52 L 124 46 L 144 56" stroke="#fff" strokeWidth="1.2" fill="none" opacity="0.6"/>
      <g opacity="0.9">
        <path d="M 18 60 L 19.5 64 L 23.5 65 L 19.5 66 L 18 70 L 16.5 66 L 12.5 65 L 16.5 64 Z" fill="#fff"/>
        <path d="M 182 70 L 183.2 73 L 186.2 74 L 183.2 75 L 182 78 L 180.8 75 L 177.8 74 L 180.8 73 Z" fill="#fff"/>
        <path d="M 24 160 L 25 163 L 28 163.8 L 25 164.6 L 24 167.6 L 23 164.6 L 20 163.8 L 23 163 Z" fill="#fff"/>
      </g>
      <g>{children}</g>
    </svg>
  );
}

export const FRAME_BY_RARITY = {
  common: CommonFrame,
  rare: RareFrame,
  epic: EpicFrame,
  mythic: MythicFrame,
  legendary: LegendaryFrame,
} satisfies Record<AchievementRarity, (props: FrameProps) => ReactNode>;
