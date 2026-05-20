'use client';

// Bespoke per-shield SVG illustrations ported from the FamBit "Shield Wall"
// design package. Each icon is a <g> meant to be composed inside one of the
// rarity frames from shieldFrames.tsx. Center ~(100, 108).

import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function Sparkle({ x, y, size = 4, color = '#fff' }: { x: number; y: number; size?: number; color?: string }) {
  const s = size;
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={`M 0 ${-s} L ${s*0.3} ${-s*0.3} L ${s} 0 L ${s*0.3} ${s*0.3} L 0 ${s} L ${-s*0.3} ${s*0.3} L ${-s} 0 L ${-s*0.3} ${-s*0.3} Z`} fill={color}/>
    </g>
  );
}

function MiniCal({ headerColor = '#9B6B45', children }: { headerColor?: string; children?: ReactNode }) {
  return (
    <g>
      <rect x="62" y="86" width="76" height="68" rx="8" fill="#2A2540" opacity="0.4"/>
      <rect x="60" y="84" width="76" height="68" rx="8" fill="#FFF6E5" stroke="#2A2540" strokeWidth="2"/>
      <rect x="60" y="84" width="76" height="18" rx="8" fill={headerColor}/>
      <rect x="60" y="96" width="76" height="6" fill={headerColor}/>
      <rect x="74" y="76" width="4" height="14" rx="2" fill="#2A2540"/>
      <rect x="120" y="76" width="4" height="14" rx="2" fill="#2A2540"/>
      <text x="98" y="98" fontSize="8" fontWeight="800" textAnchor="middle" fill="#fff" fontFamily="Plus Jakarta Sans, system-ui, sans-serif" letterSpacing="1">JUL</text>
      {children}
    </g>
  );
}

// ===========================================================================
// COMMON ICONS (17)
// ===========================================================================

export function IconFirstStep() {
  return (
    <g>
      <defs>
        <linearGradient id="fs-foot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C8CCDC"/>
          <stop offset="100%" stopColor="#7A8099"/>
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="128" rx="16" ry="20" fill="url(#fs-foot)" stroke="#3D4159" strokeWidth="2"/>
      <ellipse cx="100" cy="100" rx="12" ry="10" fill="url(#fs-foot)" stroke="#3D4159" strokeWidth="2" opacity="0.95"/>
      <ellipse cx="92" cy="82" rx="4.5" ry="6" fill="#C8CCDC" stroke="#3D4159" strokeWidth="1.5"/>
      <ellipse cx="100" cy="76" rx="4" ry="5.5" fill="#C8CCDC" stroke="#3D4159" strokeWidth="1.5"/>
      <ellipse cx="108" cy="78" rx="4" ry="5.5" fill="#C8CCDC" stroke="#3D4159" strokeWidth="1.5"/>
      <ellipse cx="114" cy="84" rx="3.5" ry="5" fill="#C8CCDC" stroke="#3D4159" strokeWidth="1.5"/>
      <ellipse cx="118" cy="92" rx="3" ry="4" fill="#C8CCDC" stroke="#3D4159" strokeWidth="1.5"/>
      <ellipse cx="95" cy="118" rx="5" ry="8" fill="#fff" opacity="0.35"/>
      <circle cx="124" cy="138" r="10" fill="#4EEDB0" stroke="#1a1b2e" strokeWidth="2"/>
      <text x="124" y="143" fontSize="13" fontWeight="900" textAnchor="middle" fill="#1a1b2e" fontFamily="Plus Jakarta Sans, system-ui, sans-serif">1</text>
    </g>
  );
}

export function IconEarlyBird() {
  return (
    <g>
      <defs>
        <linearGradient id="eb-sun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE89D"/>
          <stop offset="100%" stopColor="#FFB347"/>
        </linearGradient>
      </defs>
      <circle cx="100" cy="130" r="22" fill="url(#eb-sun)"/>
      {[-60, -30, 0, 30, 60].map((deg, i) => (
        <line key={i}
          x1={100 + Math.cos((deg-90) * Math.PI/180) * 28}
          y1={130 + Math.sin((deg-90) * Math.PI/180) * 28}
          x2={100 + Math.cos((deg-90) * Math.PI/180) * 36}
          y2={130 + Math.sin((deg-90) * Math.PI/180) * 36}
          stroke="#FFD93D" strokeWidth="2.5" strokeLinecap="round"/>
      ))}
      <line x1="62" y1="138" x2="138" y2="138" stroke="#4EEDB0" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
      <path d="M 78 78 Q 84 70 92 76 Q 100 70 108 76 Q 116 70 122 78 Q 116 82 108 80 Q 100 86 92 80 Q 84 82 78 78 Z" fill="#2A2540"/>
      <path d="M 86 86 Q 92 92 100 90 Q 108 92 114 86" stroke="#2A2540" strokeWidth="2" fill="none" strokeLinecap="round"/>
    </g>
  );
}

export function IconDayBuilder() {
  return (
    <g>
      <defs>
        <linearGradient id="db-brick" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C49475"/>
          <stop offset="100%" stopColor="#8B5E3C"/>
        </linearGradient>
      </defs>
      <rect x="62" y="138" width="22" height="14" rx="2" fill="url(#db-brick)" stroke="#5A3A1F" strokeWidth="1.5"/>
      <rect x="86" y="138" width="28" height="14" rx="2" fill="url(#db-brick)" stroke="#5A3A1F" strokeWidth="1.5"/>
      <rect x="116" y="138" width="22" height="14" rx="2" fill="url(#db-brick)" stroke="#5A3A1F" strokeWidth="1.5"/>
      <rect x="72" y="122" width="28" height="14" rx="2" fill="url(#db-brick)" stroke="#5A3A1F" strokeWidth="1.5"/>
      <rect x="102" y="122" width="28" height="14" rx="2" fill="url(#db-brick)" stroke="#5A3A1F" strokeWidth="1.5"/>
      <rect x="62" y="106" width="22" height="14" rx="2" fill="url(#db-brick)" stroke="#5A3A1F" strokeWidth="1.5"/>
      <rect x="86" y="106" width="28" height="14" rx="2" fill="url(#db-brick)" stroke="#5A3A1F" strokeWidth="1.5"/>
      <rect x="116" y="106" width="22" height="14" rx="2" fill="url(#db-brick)" stroke="#5A3A1F" strokeWidth="1.5"/>
      <rect x="86" y="84" width="28" height="14" rx="2" fill="#E0B080" stroke="#5A3A1F" strokeWidth="1.5"/>
      <path d="M 116 78 L 132 70 L 134 76 L 122 88 Z" fill="#8e96b0" stroke="#3D4159" strokeWidth="1.5"/>
      <line x1="132" y1="70" x2="142" y2="62" stroke="#5A3A1F" strokeWidth="3" strokeLinecap="round"/>
      <line x1="64" y1="108" x2="82" y2="108" stroke="#fff" strokeWidth="0.8" opacity="0.4"/>
      <line x1="74" y1="124" x2="98" y2="124" stroke="#fff" strokeWidth="0.8" opacity="0.4"/>
    </g>
  );
}

export function IconNightOwl() {
  return (
    <g>
      <defs>
        <radialGradient id="no-moon" cx="0.5" cy="0.4" r="0.6">
          <stop offset="0%" stopColor="#FFF6D0"/>
          <stop offset="100%" stopColor="#D8D8E5"/>
        </radialGradient>
      </defs>
      <path d="M 124 70 Q 80 78 76 116 Q 80 154 124 162 Q 96 152 90 116 Q 96 80 124 70 Z" fill="url(#no-moon)" stroke="#3D4159" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M 96 104 Q 102 100 108 104" stroke="#3D4159" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M 112 108 Q 118 104 124 108" stroke="#3D4159" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <ellipse cx="100" cy="118" rx="5" ry="2.5" fill="#FF9FB8" opacity="0.7"/>
      <ellipse cx="118" cy="122" rx="4" ry="2" fill="#FF9FB8" opacity="0.7"/>
      <path d="M 105 128 Q 109 132 113 128" stroke="#3D4159" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <circle cx="108" cy="86" r="2.5" fill="#3D4159" opacity="0.25"/>
      <circle cx="118" cy="92" r="1.8" fill="#3D4159" opacity="0.2"/>
      <Sparkle x={66} y={80} size={3.5} color="#FFD93D"/>
      <Sparkle x={140} y={92} size={3} color="#fff"/>
      <Sparkle x={70} y={140} size={2.5} color="#fff"/>
      <text x="146" y="80" fontSize="14" fontWeight="900" fill="#8e96b0" fontFamily="Plus Jakarta Sans, system-ui, sans-serif">z</text>
      <text x="150" y="68" fontSize="10" fontWeight="900" fill="#8e96b0" fontFamily="Plus Jakarta Sans, system-ui, sans-serif" opacity="0.7">z</text>
    </g>
  );
}

export function IconFirstSpark() {
  return (
    <g>
      <defs>
        <radialGradient id="fsp-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#FFE89D" stopOpacity="0.6"/>
          <stop offset="100%" stopColor="#FFE89D" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="100" cy="108" r="40" fill="url(#fsp-glow)"/>
      <path d="M 100 70 L 110 100 L 140 110 L 110 120 L 100 150 L 90 120 L 60 110 L 90 100 Z" fill="#FFD93D" stroke="#9B6B45" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M 100 70 L 110 100 L 140 110 L 100 108 Z" fill="#FFF6D0" opacity="0.6"/>
      <path d="M 64 76 L 67 84 L 75 87 L 67 90 L 64 98 L 61 90 L 53 87 L 61 84 Z" fill="#fff"/>
      <path d="M 142 142 L 145 148 L 151 150 L 145 152 L 142 158 L 139 152 L 133 150 L 139 148 Z" fill="#FFD93D"/>
      <circle cx="146" cy="80" r="2.5" fill="#fff"/>
      <circle cx="58" cy="146" r="2" fill="#FFD93D"/>
    </g>
  );
}

export function IconLittleWin() {
  return (
    <g>
      <defs>
        <linearGradient id="lw-leaf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7DD87B"/>
          <stop offset="100%" stopColor="#3A8E3F"/>
        </linearGradient>
        <linearGradient id="lw-pot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9B6B45"/>
          <stop offset="100%" stopColor="#5A3A1F"/>
        </linearGradient>
      </defs>
      <path d="M 100 110 Q 76 92 76 76 Q 90 78 100 100" fill="url(#lw-leaf)" stroke="#1F4F22" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M 100 110 Q 124 92 124 76 Q 110 78 100 100" fill="url(#lw-leaf)" stroke="#1F4F22" strokeWidth="1.8" strokeLinejoin="round"/>
      <line x1="100" y1="110" x2="100" y2="130" stroke="#1F4F22" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M 64 134 Q 100 122 136 134 L 136 142 Q 100 130 64 142 Z" fill="#5A3A1F" stroke="#2A2540" strokeWidth="1.5"/>
      <path d="M 70 140 L 130 140 L 124 156 L 76 156 Z" fill="url(#lw-pot)" stroke="#2A2540" strokeWidth="2" strokeLinejoin="round"/>
      <line x1="74" y1="148" x2="126" y2="148" stroke="#2A2540" strokeWidth="0.8" opacity="0.5"/>
      <circle cx="84" cy="82" r="1.8" fill="#fff" opacity="0.8"/>
      <circle cx="118" cy="86" r="1.5" fill="#FFD93D"/>
    </g>
  );
}

export function IconGettingStarted() {
  return (
    <g>
      <defs>
        <linearGradient id="gs-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff"/>
          <stop offset="100%" stopColor="#C8CCDC"/>
        </linearGradient>
        <linearGradient id="gs-flame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFD93D"/>
          <stop offset="100%" stopColor="#FF6B3D"/>
        </linearGradient>
      </defs>
      <path d="M 90 134 Q 86 144 90 154 Q 96 148 100 158 Q 104 148 110 154 Q 114 144 110 134 Z" fill="url(#gs-flame)" stroke="#D44545" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M 96 138 Q 100 144 104 138 Q 102 148 100 152 Q 98 148 96 138 Z" fill="#FFF6D0"/>
      <path d="M 100 64 Q 88 76 88 100 L 88 134 L 112 134 L 112 100 Q 112 76 100 64 Z" fill="url(#gs-body)" stroke="#2A2540" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M 88 116 L 76 132 L 88 132 Z" fill="#FF6B6B" stroke="#2A2540" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M 112 116 L 124 132 L 112 132 Z" fill="#FF6B6B" stroke="#2A2540" strokeWidth="1.8" strokeLinejoin="round"/>
      <circle cx="100" cy="96" r="7" fill="#7AC4F2" stroke="#2A2540" strokeWidth="1.8"/>
      <path d="M 96 92 Q 100 90 104 92" stroke="#fff" strokeWidth="1.5" fill="none" opacity="0.7"/>
      <line x1="88" y1="112" x2="112" y2="112" stroke="#FF6B6B" strokeWidth="3"/>
      <circle cx="68" cy="74" r="2" fill="#fff"/>
      <circle cx="134" cy="80" r="1.5" fill="#FFD93D"/>
    </g>
  );
}

export function IconITried() {
  return (
    <g>
      <defs>
        <radialGradient id="it-glow" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0%" stopColor="#FFD93D" stopOpacity="0.5"/>
          <stop offset="100%" stopColor="#FFD93D" stopOpacity="0"/>
        </radialGradient>
        <linearGradient id="it-heart" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE89D"/>
          <stop offset="100%" stopColor="#FFB347"/>
        </linearGradient>
      </defs>
      <circle cx="100" cy="108" r="48" fill="url(#it-glow)"/>
      <path d="M 100 142 Q 70 122 66 100 Q 64 82 80 78 Q 92 78 100 90 Q 108 78 120 78 Q 136 82 134 100 Q 130 122 100 142 Z" fill="url(#it-heart)" stroke="#9B6B45" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M 80 86 Q 90 80 96 90" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7"/>
      <circle cx="124" cy="62" r="9" fill="#4EEDB0" stroke="#2A2540" strokeWidth="1.5"/>
      <text x="124" y="66" fontSize="11" fontWeight="900" textAnchor="middle" fill="#2A2540" fontFamily="Plus Jakarta Sans, system-ui, sans-serif">1</text>
    </g>
  );
}

export function IconTeamSpark() {
  return (
    <g>
      <defs>
        <linearGradient id="ts-h1" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFD3B0"/>
          <stop offset="100%" stopColor="#E8A887"/>
        </linearGradient>
        <linearGradient id="ts-h2" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="#C49475"/>
          <stop offset="100%" stopColor="#9B6B45"/>
        </linearGradient>
      </defs>
      <path d="M 56 130 L 86 110 Q 100 102 110 112 L 96 124 Q 88 132 78 138 Z" fill="url(#ts-h1)" stroke="#2A2540" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M 144 130 L 114 110 Q 100 102 90 112 L 104 124 Q 112 132 122 138 Z" fill="url(#ts-h2)" stroke="#2A2540" strokeWidth="2" strokeLinejoin="round"/>
      <ellipse cx="100" cy="118" rx="12" ry="9" fill="#E8A887" stroke="#2A2540" strokeWidth="2"/>
      <path d="M 100 70 L 104 86 L 118 92 L 104 98 L 100 112 L 96 98 L 82 92 L 96 86 Z" fill="#FFD93D" stroke="#9B6B45" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M 100 70 L 104 86 L 118 92 L 100 88 Z" fill="#FFF6D0" opacity="0.7"/>
      <circle cx="62" cy="96" r="1.8" fill="#fff"/>
      <circle cx="140" cy="100" r="1.5" fill="#FFD93D"/>
    </g>
  );
}

export function IconSevenDayBuilder() {
  return (
    <g>
      <defs>
        <linearGradient id="sdb-map" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF6D0"/>
          <stop offset="100%" stopColor="#E5D8B5"/>
        </linearGradient>
      </defs>
      <path d="M 58 80 L 92 76 L 124 84 L 142 80 L 142 144 L 108 148 L 76 140 L 58 144 Z" fill="url(#sdb-map)" stroke="#2A2540" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M 92 76 L 92 144" stroke="#9B6B45" strokeWidth="0.8" opacity="0.55" strokeDasharray="2 2"/>
      <path d="M 124 84 L 124 148" stroke="#9B6B45" strokeWidth="0.8" opacity="0.55" strokeDasharray="2 2"/>
      <path d="M 70 134 Q 84 120 90 124 Q 100 130 108 116 Q 116 102 124 108 Q 134 114 132 96" stroke="#FF7BAC" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeDasharray="4 3"/>
      <circle cx="70" cy="134" r="3" fill="#FF7BAC" stroke="#2A2540" strokeWidth="1.2"/>
      {[0,1,2,3,4,5,6].map(i => (
        <circle key={i} cx={74 + i*9} cy={96} r="2" fill="#4EEDB0" stroke="#2A2540" strokeWidth="0.6"/>
      ))}
      <g>
        <path d="M 130 80 Q 122 80 122 88 Q 122 96 130 102 Q 138 96 138 88 Q 138 80 130 80 Z" fill="#FF6B6B" stroke="#2A2540" strokeWidth="1.5"/>
        <circle cx="130" cy="88" r="2.5" fill="#fff"/>
      </g>
    </g>
  );
}

export function IconFiveDay() {
  return (
    <MiniCal headerColor="#FF7BAC">
      <text x="98" y="138" fontSize="34" fontWeight="900" textAnchor="middle" fill="#FF7BAC" fontFamily="Plus Jakarta Sans, system-ui, sans-serif">5</text>
      {[0,1,2,3,4].map(i => (
        <circle key={i} cx={74 + i*12} cy={146} r="2" fill="#4EEDB0"/>
      ))}
    </MiniCal>
  );
}

export function IconReadingWeek() {
  return (
    <MiniCal headerColor="#7AC4F2">
      <g transform="translate(0 6)">
        <path d="M 70 124 L 70 110 Q 84 104 98 110 L 98 124 Q 84 118 70 124 Z" fill="#fff" stroke="#2A2540" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M 128 124 L 128 110 Q 114 104 98 110 L 98 124 Q 114 118 128 124 Z" fill="#fff" stroke="#2A2540" strokeWidth="1.5" strokeLinejoin="round"/>
        <line x1="74" y1="114" x2="92" y2="113" stroke="#9B6B45" strokeWidth="0.8"/>
        <line x1="74" y1="118" x2="90" y2="117" stroke="#9B6B45" strokeWidth="0.8"/>
        <line x1="106" y1="113" x2="124" y2="114" stroke="#9B6B45" strokeWidth="0.8"/>
        <line x1="108" y1="117" x2="124" y2="118" stroke="#9B6B45" strokeWidth="0.8"/>
      </g>
      <circle cx="86" cy="146" r="2" fill="#7AC4F2"/>
      <circle cx="98" cy="146" r="2" fill="#7AC4F2"/>
      <circle cx="110" cy="146" r="2" fill="#7AC4F2"/>
    </MiniCal>
  );
}

export function IconEnergyWeek() {
  return (
    <MiniCal headerColor="#FF6B3D">
      <g transform="translate(0 6)">
        <rect x="70" y="116" width="8" height="14" rx="2" fill="#4A5070" stroke="#2A2540" strokeWidth="1.5"/>
        <rect x="120" y="116" width="8" height="14" rx="2" fill="#4A5070" stroke="#2A2540" strokeWidth="1.5"/>
        <rect x="78" y="120" width="42" height="6" fill="#8e96b0" stroke="#2A2540" strokeWidth="1.5"/>
      </g>
      <path d="M 84 148 L 90 142 L 96 150 L 104 138 L 112 146" stroke="#FF6B3D" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </MiniCal>
  );
}

export function IconBeatLastWeek() {
  return (
    <MiniCal headerColor="#4EEDB0">
      <g transform="translate(0 8)">
        <rect x="70" y="124" width="8" height="10" fill="#8e96b0" rx="1"/>
        <rect x="82" y="118" width="8" height="16" fill="#8e96b0" rx="1"/>
        <rect x="94" y="112" width="8" height="22" fill="#4EEDB0" rx="1"/>
        <rect x="106" y="106" width="8" height="28" fill="#4EEDB0" rx="1"/>
        <rect x="118" y="100" width="8" height="34" fill="#FFD93D" rx="1"/>
        <path d="M 70 130 L 100 110 L 126 96" stroke="#FF7BAC" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
        <polygon points="126,96 118,98 122,104" fill="#FF7BAC" stroke="#2A2540" strokeWidth="1"/>
      </g>
    </MiniCal>
  );
}

export function IconWeeklyComeback() {
  return (
    <MiniCal headerColor="#B86CF7">
      <g transform="translate(0 6)">
        <path d="M 70 116 L 80 124 L 90 134 L 100 122 L 112 108 L 126 100" stroke="#B86CF7" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="90" cy="134" r="3.5" fill="#FF6B6B" stroke="#2A2540" strokeWidth="1.2"/>
        <polygon points="126,100 118,102 122,108" fill="#B86CF7" stroke="#2A2540" strokeWidth="1"/>
        <circle cx="124" cy="142" r="7" fill="#4EEDB0" stroke="#2A2540" strokeWidth="1.2"/>
        <path d="M 120 142 L 123 145 L 128 139" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </g>
    </MiniCal>
  );
}

export function IconThreeCategory() {
  return (
    <MiniCal headerColor="#FFD93D">
      <g transform="translate(0 4)">
        <circle cx="78" cy="124" r="10" fill="#FF6B6B" stroke="#2A2540" strokeWidth="1.5"/>
        <path d="M 78 132 Q 70 126 72 120 Q 76 118 78 122 Q 80 118 84 120 Q 86 126 78 132 Z" fill="#fff" opacity="0.85"/>
        <circle cx="100" cy="124" r="10" fill="#7AC4F2" stroke="#2A2540" strokeWidth="1.5"/>
        <path d="M 95 118 L 95 130 M 105 118 L 105 130 M 95 124 L 105 124" stroke="#fff" strokeWidth="2"/>
        <circle cx="122" cy="124" r="10" fill="#4EEDB0" stroke="#2A2540" strokeWidth="1.5"/>
        <path d="M 117 124 L 121 128 L 127 120" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </g>
      <text x="98" y="146" fontSize="10" fontWeight="900" textAnchor="middle" fill="#2A2540" fontFamily="Plus Jakarta Sans, system-ui, sans-serif" opacity="0.6">×3</text>
    </MiniCal>
  );
}

export function IconTeamThreeDays() {
  return (
    <MiniCal headerColor="#FF7BAC">
      <g transform="translate(0 6)">
        <circle cx="84" cy="118" r="7" fill="#FFD3B0" stroke="#2A2540" strokeWidth="1.5"/>
        <path d="M 78 138 Q 78 126 84 126 Q 90 126 90 138 Z" fill="#7AC4F2" stroke="#2A2540" strokeWidth="1.5" strokeLinejoin="round"/>
        <circle cx="82" cy="117" r="0.8" fill="#2A2540"/>
        <circle cx="86" cy="117" r="0.8" fill="#2A2540"/>
        <circle cx="114" cy="118" r="7" fill="#C49475" stroke="#2A2540" strokeWidth="1.5"/>
        <path d="M 108 138 Q 108 126 114 126 Q 120 126 120 138 Z" fill="#FF7BAC" stroke="#2A2540" strokeWidth="1.5" strokeLinejoin="round"/>
        <circle cx="112" cy="117" r="0.8" fill="#2A2540"/>
        <circle cx="116" cy="117" r="0.8" fill="#2A2540"/>
        <text x="98" y="150" fontSize="11" fontWeight="900" textAnchor="middle" fill="#FF7BAC" fontFamily="Plus Jakarta Sans, system-ui, sans-serif">×3</text>
      </g>
    </MiniCal>
  );
}

// ===========================================================================
// RARE ICONS (8)
// ===========================================================================

export function IconCleanStart() {
  return (
    <g>
      <defs>
        <radialGradient id="cs-bubble" cx="0.5" cy="0.4" r="0.6">
          <stop offset="0%" stopColor="#E0F4FF"/>
          <stop offset="100%" stopColor="#7AC4F2"/>
        </radialGradient>
      </defs>
      <circle cx="100" cy="106" r="26" fill="url(#cs-bubble)" stroke="#3D6FD9" strokeWidth="2" opacity="0.9"/>
      <circle cx="100" cy="106" r="26" fill="none" stroke="#fff" strokeWidth="0.8" opacity="0.7"/>
      <ellipse cx="92" cy="96" rx="8" ry="6" fill="#fff" opacity="0.7"/>
      <ellipse cx="89" cy="93" rx="3" ry="2" fill="#fff"/>
      <circle cx="74" cy="84" r="8" fill="url(#cs-bubble)" stroke="#3D6FD9" strokeWidth="1.5" opacity="0.85"/>
      <ellipse cx="72" cy="82" rx="2.5" ry="2" fill="#fff" opacity="0.8"/>
      <circle cx="132" cy="88" r="5" fill="url(#cs-bubble)" stroke="#3D6FD9" strokeWidth="1.2" opacity="0.85"/>
      <circle cx="131" cy="87" r="1.5" fill="#fff" opacity="0.9"/>
      <line x1="68" y1="148" x2="118" y2="118" stroke="#9B6B45" strokeWidth="5" strokeLinecap="round"/>
      <line x1="68" y1="148" x2="118" y2="118" stroke="#C49475" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
      <path d="M 56 154 Q 64 138 76 142 Q 82 152 76 162 Q 64 162 56 154 Z" fill="#FFD93D" stroke="#A88560" strokeWidth="2" strokeLinejoin="round"/>
      <line x1="60" y1="158" x2="62" y2="148" stroke="#A88560" strokeWidth="1.5"/>
      <line x1="66" y1="161" x2="68" y2="146" stroke="#A88560" strokeWidth="1.5"/>
      <line x1="72" y1="161" x2="74" y2="148" stroke="#A88560" strokeWidth="1.5"/>
      <Sparkle x={132} y={132} size={4} color="#fff"/>
      <Sparkle x={146} y={108} size={3} color="#4EEDB0"/>
    </g>
  );
}

export function IconMorningStarter() {
  return (
    <g>
      <defs>
        <radialGradient id="ms-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#FFF6D0"/>
          <stop offset="50%" stopColor="#FFD93D"/>
          <stop offset="100%" stopColor="#FF9F47"/>
        </radialGradient>
      </defs>
      {[0, 45, 90, 135, 180].map((deg, i) => (
        <g key={i} transform={`rotate(${deg-90} 100 130)`}>
          <path d="M 100 130 L 96 86 L 100 78 L 104 86 Z" fill="#FFD93D" opacity="0.5"/>
        </g>
      ))}
      <path d="M 70 130 Q 70 100 100 100 Q 130 100 130 130 Z" fill="url(#ms-sun)" stroke="#E0900F" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M 78 124 Q 90 116 100 116" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.6"/>
      <path d="M 60 144 L 80 116 L 92 130 L 100 122 L 112 134 L 124 118 L 140 144 Z" fill="#4A5070" stroke="#2A2540" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M 76 122 L 80 116 L 84 122 Z" fill="#fff" opacity="0.85"/>
      <path d="M 120 124 L 124 118 L 128 124 Z" fill="#fff" opacity="0.85"/>
      <line x1="60" y1="144" x2="140" y2="144" stroke="#2A2540" strokeWidth="2"/>
      <ellipse cx="130" cy="82" rx="14" ry="6" fill="#fff" opacity="0.7"/>
      <ellipse cx="124" cy="80" rx="8" ry="5" fill="#fff" opacity="0.7"/>
      <ellipse cx="136" cy="80" rx="7" ry="5" fill="#fff" opacity="0.7"/>
    </g>
  );
}

export function IconEveningStarter() {
  return (
    <g>
      <defs>
        <linearGradient id="es-moon" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E0E8FF"/>
          <stop offset="100%" stopColor="#9AAEDB"/>
        </linearGradient>
      </defs>
      <path d="M 116 70 Q 78 78 78 116 Q 78 154 116 162 Q 94 152 88 116 Q 94 80 116 70 Z" fill="url(#es-moon)" stroke="#3D4159" strokeWidth="2" strokeLinejoin="round"/>
      <circle cx="98" cy="104" r="2.5" fill="#3D4159"/>
      <ellipse cx="98" cy="103" rx="1" ry="1" fill="#fff"/>
      <ellipse cx="100" cy="120" rx="3.5" ry="1.5" fill="#FF9FB8" opacity="0.8"/>
      <path d="M 96 128 Q 100 132 104 128" stroke="#3D4159" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      <g>
        <path d="M 138 80 L 140 86 L 146 88 L 140 90 L 138 96 L 136 90 L 130 88 L 136 86 Z" fill="#FFD93D" stroke="#E0B520" strokeWidth="1" strokeLinejoin="round"/>
        <path d="M 138 80 L 140 86 L 146 88" stroke="#fff" strokeWidth="0.8" fill="none" opacity="0.7"/>
      </g>
      <path d="M 64 92 L 65.5 96 L 69.5 97 L 65.5 98 L 64 102 L 62.5 98 L 58.5 97 L 62.5 96 Z" fill="#fff"/>
      <path d="M 150 130 L 151.5 134 L 155.5 135 L 151.5 136 L 150 140 L 148.5 136 L 144.5 135 L 148.5 134 Z" fill="#7AC4F2"/>
      <Sparkle x={66} y={146} size={2.5} color="#fff"/>
      <Sparkle x={140} y={108} size={2} color="#fff"/>
    </g>
  );
}

export function IconCleanupCaptain() {
  return (
    <g>
      <defs>
        <linearGradient id="cc-basket" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E0B080"/>
          <stop offset="100%" stopColor="#9B6B45"/>
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="100" rx="22" ry="10" fill="#7AC4F2" stroke="#2A2540" strokeWidth="1.8"/>
      <ellipse cx="90" cy="94" rx="16" ry="7" fill="#FF7BAC" stroke="#2A2540" strokeWidth="1.8"/>
      <ellipse cx="106" cy="88" rx="12" ry="6" fill="#FFD93D" stroke="#2A2540" strokeWidth="1.8"/>
      <path d="M 86 88 Q 90 84 94 88" stroke="#2A2540" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M 102 102 Q 106 98 110 102" stroke="#2A2540" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M 68 110 L 132 110 L 124 154 L 76 154 Z" fill="url(#cc-basket)" stroke="#5A3A1F" strokeWidth="2" strokeLinejoin="round"/>
      <line x1="72" y1="120" x2="128" y2="120" stroke="#5A3A1F" strokeWidth="1" opacity="0.5"/>
      <line x1="74" y1="130" x2="126" y2="130" stroke="#5A3A1F" strokeWidth="1" opacity="0.5"/>
      <line x1="76" y1="140" x2="124" y2="140" stroke="#5A3A1F" strokeWidth="1" opacity="0.5"/>
      <line x1="85" y1="112" x2="80" y2="152" stroke="#5A3A1F" strokeWidth="0.8" opacity="0.4"/>
      <line x1="100" y1="112" x2="100" y2="152" stroke="#5A3A1F" strokeWidth="0.8" opacity="0.4"/>
      <line x1="115" y1="112" x2="120" y2="152" stroke="#5A3A1F" strokeWidth="0.8" opacity="0.4"/>
      <ellipse cx="100" cy="110" rx="32" ry="4" fill="#C49475" stroke="#5A3A1F" strokeWidth="2"/>
      <ellipse cx="100" cy="110" rx="32" ry="4" fill="none" stroke="#fff" strokeWidth="0.8" opacity="0.4"/>
      <Sparkle x={140} y={86} size={3.5} color="#4EEDB0"/>
      <Sparkle x={62} y={94} size={2.5} color="#fff"/>
    </g>
  );
}

export function IconSiblingPower() {
  return (
    <g>
      <defs>
        <linearGradient id="sp-l" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7AC4F2"/>
          <stop offset="100%" stopColor="#3D6FD9"/>
        </linearGradient>
        <linearGradient id="sp-r" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFB5D8"/>
          <stop offset="100%" stopColor="#D95C8A"/>
        </linearGradient>
      </defs>
      <circle cx="84" cy="110" r="22" fill="none" stroke="url(#sp-l)" strokeWidth="9"/>
      <circle cx="84" cy="110" r="22" fill="none" stroke="#fff" strokeWidth="2" opacity="0.45" strokeDasharray="3 3"/>
      <circle cx="116" cy="110" r="22" fill="none" stroke="url(#sp-r)" strokeWidth="9"/>
      <circle cx="116" cy="110" r="22" fill="none" stroke="#fff" strokeWidth="2" opacity="0.45" strokeDasharray="3 3"/>
      <path d="M 100 110 Q 96 104 92 110 Q 92 114 100 120 Q 108 114 108 110 Q 104 104 100 110 Z" fill="#FFD93D" stroke="#2A2540" strokeWidth="1.5"/>
      <Sparkle x={68} y={84} size={3.5} color="#4EEDB0"/>
      <Sparkle x={132} y={88} size={3} color="#FFD93D"/>
      <Sparkle x={100} y={150} size={2.5} color="#fff"/>
    </g>
  );
}

export function IconTeamComeback() {
  return (
    <g>
      <defs>
        <linearGradient id="tc-arrow" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#3D6FD9"/>
          <stop offset="100%" stopColor="#4EEDB0"/>
        </linearGradient>
        <linearGradient id="tc-flame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFD93D"/>
          <stop offset="100%" stopColor="#FF6B6B"/>
        </linearGradient>
      </defs>
      <path d="M 68 144 Q 78 132 88 130 Q 100 128 108 116 Q 116 102 122 92" stroke="url(#tc-arrow)" strokeWidth="9" fill="none" strokeLinecap="round" opacity="0.95"/>
      <path d="M 68 144 Q 78 132 88 130 Q 100 128 108 116 Q 116 102 122 92" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.4"/>
      <path d="M 122 92 L 112 90 L 116 100 Z M 122 92 L 134 86 L 130 96 Z M 122 92 L 124 78 L 132 86 Z" fill="#4EEDB0" stroke="#2A2540" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M 122 92 L 134 70" stroke="#4EEDB0" strokeWidth="6" strokeLinecap="round"/>
      <polygon points="134,70 128,80 142,80" fill="#4EEDB0" stroke="#2A2540" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M 70 146 Q 60 152 56 144 Q 52 138 58 134 Q 60 138 64 138 Q 62 132 70 130 Q 74 138 70 146 Z" fill="url(#tc-flame)" stroke="#D44545" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M 64 142 Q 62 138 64 134 Q 66 138 64 142 Z" fill="#FFF6D0"/>
      <circle cx="92" cy="118" r="2" fill="#FFD93D"/>
      <circle cx="104" cy="106" r="1.5" fill="#fff"/>
    </g>
  );
}

export function IconHiddenHelper() {
  return (
    <g>
      <defs>
        <radialGradient id="hh-glow" cx="0.5" cy="0.4" r="0.6">
          <stop offset="0%" stopColor="#4EEDB0" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="#4EEDB0" stopOpacity="0"/>
        </radialGradient>
        <linearGradient id="hh-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5B8EFF"/>
          <stop offset="100%" stopColor="#2D5BC2"/>
        </linearGradient>
      </defs>
      <circle cx="100" cy="108" r="46" fill="url(#hh-glow)"/>
      <path d="M 64 132 Q 64 88 100 84 Q 136 88 136 132 Q 100 144 64 132 Z" fill="url(#hh-body)" stroke="#1a1b2e" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M 70 110 Q 100 100 130 110 L 130 122 Q 100 130 70 122 Z" fill="#0d0e1c" stroke="#1a1b2e" strokeWidth="1.5" strokeLinejoin="round"/>
      <ellipse cx="86" cy="116" rx="4.5" ry="3" fill="#4EEDB0"/>
      <ellipse cx="86" cy="115" rx="2" ry="1.5" fill="#fff"/>
      <ellipse cx="114" cy="116" rx="4.5" ry="3" fill="#4EEDB0"/>
      <ellipse cx="114" cy="115" rx="2" ry="1.5" fill="#fff"/>
      <path d="M 72 96 Q 88 88 100 88" stroke="#fff" strokeWidth="1.5" fill="none" opacity="0.4" strokeLinecap="round"/>
      <circle cx="100" cy="142" r="9" fill="#FF7BAC" stroke="#1a1b2e" strokeWidth="1.8"/>
      <path d="M 96 140 Q 100 136 104 140 Q 104 144 100 148 Q 96 144 96 140 Z" fill="#fff"/>
      <path d="M 60 84 L 61.5 88 L 65.5 89 L 61.5 90 L 60 94 L 58.5 90 L 54.5 89 L 58.5 88 Z" fill="#fff"/>
      <path d="M 140 88 L 141 91 L 144 92 L 141 93 L 140 96 L 139 93 L 136 92 L 139 91 Z" fill="#4EEDB0"/>
      <circle cx="68" cy="148" r="1.5" fill="#fff" opacity="0.7"/>
      <circle cx="134" cy="148" r="1.5" fill="#FFD93D"/>
    </g>
  );
}

export function IconDoubleLevelUp() {
  return (
    <g>
      <defs>
        <linearGradient id="dlu-a" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#3D6FD9"/>
          <stop offset="100%" stopColor="#4EEDB0"/>
        </linearGradient>
      </defs>
      <path d="M 100 60 L 64 100 L 84 100 L 84 132 L 116 132 L 116 100 L 136 100 Z" fill="url(#dlu-a)" stroke="#1a1b2e" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M 100 60 L 64 100 L 84 100" stroke="#fff" strokeWidth="2" fill="none" opacity="0.45" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M 100 84 L 76 108 L 90 108 L 90 124 L 110 124 L 110 108 L 124 108 Z" fill="#FFD93D" stroke="#1a1b2e" strokeWidth="2" strokeLinejoin="round" opacity="0.95"/>
      <path d="M 100 84 L 76 108 L 90 108" stroke="#fff" strokeWidth="1.5" fill="none" opacity="0.6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="130" cy="138" r="13" fill="#FF7BAC" stroke="#1a1b2e" strokeWidth="2"/>
      <text x="130" y="143" fontSize="13" fontWeight="900" textAnchor="middle" fill="#fff" fontFamily="Plus Jakarta Sans, system-ui, sans-serif">+2</text>
      <path d="M 60 76 L 62 80 L 66 81 L 62 82 L 60 86 L 58 82 L 54 81 L 58 80 Z" fill="#FFD93D"/>
      <path d="M 142 80 L 144 84 L 148 85 L 144 86 L 142 90 L 140 86 L 136 85 L 140 84 Z" fill="#fff"/>
      <Sparkle x={66} y={148} size={2.5} color="#fff"/>
    </g>
  );
}

// ===========================================================================
// EPIC ICONS (22)
// ===========================================================================

export function IconTwentyDay() {
  return (
    <g>
      <defs>
        <linearGradient id="td-cal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF6D0"/>
          <stop offset="100%" stopColor="#FFE89D"/>
        </linearGradient>
      </defs>
      <rect x="68" y="78" width="64" height="64" rx="6" fill="#2A2540" opacity="0.4"/>
      <rect x="66" y="76" width="64" height="64" rx="6" fill="url(#td-cal)" stroke="#2A2540" strokeWidth="2"/>
      <rect x="66" y="76" width="64" height="14" rx="6" fill="#FF7BAC"/>
      <rect x="66" y="86" width="64" height="4" fill="#FF7BAC"/>
      <rect x="78" y="68" width="4" height="14" rx="2" fill="#2A2540"/>
      <rect x="114" y="68" width="4" height="14" rx="2" fill="#2A2540"/>
      {[0,1,2,3].flatMap(r => [0,1,2,3,4].map(c => {
        const cx = 74 + c*12, cy = 100 + r*10;
        const filled = (r*5+c) < 14;
        return (
          <g key={`${r}-${c}`}>
            <circle cx={cx} cy={cy} r="3" fill={filled ? '#4EEDB0' : 'rgba(42,37,64,0.2)'}/>
            {filled && <path d={`M ${cx-1.5} ${cy} L ${cx-0.3} ${cy+1.5} L ${cx+1.8} ${cy-1.5}`} stroke="#fff" strokeWidth="1.2" fill="none" strokeLinecap="round"/>}
          </g>
        );
      }))}
      <circle cx="138" cy="138" r="14" fill="#FF7BAC" stroke="#fff" strokeWidth="2"/>
      <text x="138" y="143" fontSize="13" fontWeight="900" textAnchor="middle" fill="#fff" fontFamily="Plus Jakarta Sans, system-ui, sans-serif">20</text>
      <Sparkle x={66} y={64} size={3} color="#FFD93D"/>
    </g>
  );
}

export function IconEightyHabit() {
  return (
    <g>
      <defs>
        <linearGradient id="eh-loop" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFD93D"/>
          <stop offset="50%" stopColor="#FF7BAC"/>
          <stop offset="100%" stopColor="#B86CF7"/>
        </linearGradient>
      </defs>
      <path d="M 80 110 Q 64 90 78 80 Q 92 70 100 90 Q 108 110 122 120 Q 136 130 122 140 Q 108 150 100 130 Q 92 110 78 100 Q 64 90 80 110 Z" fill="none" stroke="url(#eh-loop)" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M 80 110 Q 64 90 78 80 Q 92 70 100 90 Q 108 110 122 120 Q 136 130 122 140 Q 108 150 100 130 Q 92 110 78 100 Q 64 90 80 110 Z" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.45"/>
      <circle cx="100" cy="110" r="13" fill="#1a1b2e" stroke="#FFD93D" strokeWidth="2"/>
      <text x="100" y="115" fontSize="13" fontWeight="900" textAnchor="middle" fill="#FFD93D" fontFamily="Plus Jakarta Sans, system-ui, sans-serif">80</text>
      <Sparkle x={62} y={68} size={4} color="#FFD93D"/>
      <Sparkle x={140} y={148} size={3.5} color="#FF7BAC"/>
      <Sparkle x={146} y={72} size={3} color="#B86CF7"/>
    </g>
  );
}

export function IconBetterMonth() {
  return (
    <g>
      <defs>
        <linearGradient id="bm-mt1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A8C4F0"/>
          <stop offset="100%" stopColor="#4A5070"/>
        </linearGradient>
        <linearGradient id="bm-mt2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7A8DBA"/>
          <stop offset="100%" stopColor="#2A2540"/>
        </linearGradient>
      </defs>
      <path d="M 64 150 L 90 92 L 112 130 L 132 100 L 148 150 Z" fill="url(#bm-mt2)" stroke="#2A2540" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M 86 100 L 90 92 L 96 102 L 92 106 Z" fill="#fff"/>
      <path d="M 126 110 L 132 100 L 138 116 L 132 118 Z" fill="#fff" opacity="0.9"/>
      <path d="M 76 150 L 100 76 L 124 150 Z" fill="url(#bm-mt1)" stroke="#2A2540" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M 92 96 L 100 76 L 110 100 L 104 102 L 98 98 Z" fill="#fff"/>
      <line x1="100" y1="76" x2="100" y2="60" stroke="#2A2540" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M 100 60 L 122 64 L 116 72 L 122 80 L 100 76 Z" fill="#FF7BAC" stroke="#2A2540" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M 108 68 L 109 71 L 112 72 L 109 73 L 108 76 L 107 73 L 104 72 L 107 71 Z" fill="#FFD93D"/>
      <circle cx="64" cy="80" r="10" fill="#FFD93D" opacity="0.5"/>
      <circle cx="64" cy="80" r="6" fill="#FFD93D" opacity="0.8"/>
      <Sparkle x={138} y={76} size={3} color="#fff"/>
    </g>
  );
}

export function IconLearningMonth() {
  return (
    <g>
      <defs>
        <linearGradient id="lm-book" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF6E5"/>
          <stop offset="100%" stopColor="#E5D8B5"/>
        </linearGradient>
        <linearGradient id="lm-cover" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D95C8A"/>
          <stop offset="100%" stopColor="#A03868"/>
        </linearGradient>
      </defs>
      <path d="M 60 140 L 60 100 Q 80 92 100 100 Q 120 92 140 100 L 140 140 Q 120 132 100 140 Q 80 132 60 140 Z" fill="url(#lm-cover)" stroke="#2A2540" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M 64 138 L 64 104 Q 82 98 100 104 L 100 138 Q 82 132 64 138 Z" fill="url(#lm-book)" stroke="#2A2540" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M 136 138 L 136 104 Q 118 98 100 104 L 100 138 Q 118 132 136 138 Z" fill="url(#lm-book)" stroke="#2A2540" strokeWidth="1.5" strokeLinejoin="round"/>
      <line x1="70" y1="112" x2="92" y2="110" stroke="#9B6B45" strokeWidth="1" opacity="0.6"/>
      <line x1="70" y1="118" x2="92" y2="116" stroke="#9B6B45" strokeWidth="1" opacity="0.6"/>
      <line x1="70" y1="124" x2="88" y2="122" stroke="#9B6B45" strokeWidth="1" opacity="0.6"/>
      <line x1="108" y1="110" x2="130" y2="112" stroke="#9B6B45" strokeWidth="1" opacity="0.6"/>
      <line x1="108" y1="116" x2="130" y2="118" stroke="#9B6B45" strokeWidth="1" opacity="0.6"/>
      <line x1="108" y1="122" x2="126" y2="124" stroke="#9B6B45" strokeWidth="1" opacity="0.6"/>
      <path d="M 100 104 L 100 138" stroke="#2A2540" strokeWidth="1.5"/>
      <g>
        <circle cx="78" cy="78" r="10" fill="#FFD93D" stroke="#2A2540" strokeWidth="1.8"/>
        <text x="78" y="83" fontSize="13" fontWeight="900" textAnchor="middle" fill="#2A2540" fontFamily="Plus Jakarta Sans, system-ui, sans-serif">A</text>
      </g>
      <g>
        <circle cx="100" cy="68" r="8" fill="#4EEDB0" stroke="#2A2540" strokeWidth="1.5"/>
        <text x="100" y="73" fontSize="11" fontWeight="900" textAnchor="middle" fill="#2A2540" fontFamily="Plus Jakarta Sans, system-ui, sans-serif">B</text>
      </g>
      <g>
        <circle cx="124" cy="78" r="9" fill="#7AC4F2" stroke="#2A2540" strokeWidth="1.6"/>
        <text x="124" y="83" fontSize="11" fontWeight="900" textAnchor="middle" fill="#2A2540" fontFamily="Plus Jakarta Sans, system-ui, sans-serif">C</text>
      </g>
      <Sparkle x={64} y={92} size={2.5} color="#fff"/>
      <Sparkle x={140} y={92} size={2.5} color="#fff"/>
    </g>
  );
}

export function IconHealthMonth() {
  return (
    <g>
      <defs>
        <linearGradient id="hm-heart" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF7BAC"/>
          <stop offset="100%" stopColor="#D44545"/>
        </linearGradient>
      </defs>
      <path d="M 100 142 Q 70 122 66 100 Q 64 82 80 78 Q 92 78 100 90 Q 108 78 120 78 Q 136 82 134 100 Q 130 122 100 142 Z" fill="url(#hm-heart)" stroke="#2A2540" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M 80 86 Q 90 80 96 90" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.65"/>
      <path d="M 64 108 L 76 108 L 80 100 L 84 116 L 88 96 L 92 120 L 96 108 L 136 108" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M 64 108 L 76 108 L 80 100 L 84 116 L 88 96 L 92 120 L 96 108 L 136 108" fill="none" stroke="#FFD93D" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="124" cy="64" r="11" fill="#fff" stroke="#2A2540" strokeWidth="1.8"/>
      <rect x="121" y="58" width="6" height="12" rx="1" fill="#D44545"/>
      <rect x="118" y="61" width="12" height="6" rx="1" fill="#D44545"/>
      <Sparkle x={68} y={68} size={3} color="#FF7BAC"/>
    </g>
  );
}

export function IconHelperMonth() {
  return (
    <g>
      <defs>
        <linearGradient id="hp-hand1" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFD3B0"/>
          <stop offset="100%" stopColor="#E8A887"/>
        </linearGradient>
        <linearGradient id="hp-hand2" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="#C49475"/>
          <stop offset="100%" stopColor="#9B6B45"/>
        </linearGradient>
      </defs>
      <path d="M 100 132 Q 76 116 74 98 Q 74 86 86 84 Q 96 84 100 92 Q 104 84 114 84 Q 126 86 126 98 Q 124 116 100 132 Z" fill="#FF7BAC" opacity="0.2"/>
      <g>
        <path d="M 56 122 Q 56 110 64 106 L 88 100 Q 100 100 108 108 Q 110 116 102 120 L 84 124 Q 70 128 56 122 Z" fill="url(#hp-hand1)" stroke="#2A2540" strokeWidth="2" strokeLinejoin="round"/>
        <path d="M 64 106 Q 66 96 72 96 Q 78 96 76 104" fill="url(#hp-hand1)" stroke="#2A2540" strokeWidth="2" strokeLinejoin="round"/>
        <path d="M 86 108 Q 92 110 96 112" stroke="#9B6B45" strokeWidth="1" opacity="0.5" fill="none"/>
      </g>
      <g>
        <path d="M 144 102 Q 144 90 136 86 L 112 80 Q 100 80 92 88 Q 90 96 98 100 L 116 104 Q 130 108 144 102 Z" fill="url(#hp-hand2)" stroke="#2A2540" strokeWidth="2" strokeLinejoin="round"/>
        <path d="M 136 86 Q 134 76 128 76 Q 122 76 124 84" fill="url(#hp-hand2)" stroke="#2A2540" strokeWidth="2" strokeLinejoin="round"/>
      </g>
      <path d="M 100 96 Q 96 92 92 96 Q 92 100 100 104 Q 108 100 108 96 Q 104 92 100 96 Z" fill="#FF7BAC" stroke="#2A2540" strokeWidth="1.2"/>
      <Sparkle x={70} y={84} size={3} color="#FFD93D"/>
      <Sparkle x={134} y={130} size={2.5} color="#fff"/>
    </g>
  );
}

export function IconComebackMonth() {
  return (
    <g>
      <defs>
        <linearGradient id="cbm-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#FF6B3D"/>
          <stop offset="60%" stopColor="#FFD93D"/>
          <stop offset="100%" stopColor="#FFF6D0"/>
        </linearGradient>
        <linearGradient id="cbm-bird" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFB347"/>
          <stop offset="100%" stopColor="#D44545"/>
        </linearGradient>
      </defs>
      <path d="M 60 152 Q 70 130 80 140 Q 86 122 100 132 Q 114 122 120 140 Q 130 130 140 152 Q 100 160 60 152 Z" fill="url(#cbm-flame)" stroke="#9B2B0F" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M 100 70 Q 88 88 88 110 Q 92 124 100 132 Q 108 124 112 110 Q 112 88 100 70 Z" fill="url(#cbm-bird)" stroke="#2A2540" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M 88 96 Q 64 84 56 70 Q 76 80 88 90 Z" fill="url(#cbm-bird)" stroke="#2A2540" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M 112 96 Q 136 84 144 70 Q 124 80 112 90 Z" fill="url(#cbm-bird)" stroke="#2A2540" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M 100 70 L 96 60 L 100 64 L 104 60 Z" fill="#FFD93D" stroke="#2A2540" strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="98" cy="80" r="1.6" fill="#2A2540"/>
      <path d="M 100 84 L 96 90 L 100 88 L 104 90 Z" fill="#2A2540"/>
      <path d="M 100 106 L 96 114 L 100 110 L 104 114 Z" fill="#FFF6D0" opacity="0.85"/>
      <Sparkle x={70} y={72} size={3} color="#FFD93D"/>
      <Sparkle x={132} y={76} size={3} color="#FFD93D"/>
    </g>
  );
}

export function IconBestMonthSpark() {
  return (
    <g>
      <defs>
        <linearGradient id="bms-cup" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE89D"/>
          <stop offset="100%" stopColor="#E0B520"/>
        </linearGradient>
      </defs>
      <path d="M 76 78 L 124 78 L 122 110 Q 118 130 100 132 Q 82 130 78 110 Z" fill="url(#bms-cup)" stroke="#9B6B45" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M 76 84 Q 64 86 64 96 Q 64 106 78 108" stroke="#9B6B45" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <path d="M 124 84 Q 136 86 136 96 Q 136 106 122 108" stroke="#9B6B45" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <rect x="86" y="132" width="28" height="6" fill="#9B6B45" stroke="#2A2540" strokeWidth="1.5"/>
      <rect x="78" y="138" width="44" height="10" rx="2" fill="url(#bms-cup)" stroke="#9B6B45" strokeWidth="1.8"/>
      <path d="M 102 86 L 90 108 L 100 108 L 96 124 L 112 100 L 102 100 Z" fill="#FF7BAC" stroke="#9B2B0F" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M 102 86 L 92 106 L 100 106 L 96 120" stroke="#FFF6D0" strokeWidth="1" fill="none" opacity="0.6"/>
      <Sparkle x={62} y={68} size={3.5} color="#FFD93D"/>
      <Sparkle x={140} y={66} size={3} color="#FFD93D"/>
      <Sparkle x={64} y={140} size={2.5} color="#fff"/>
      <Sparkle x={136} y={142} size={2.5} color="#fff"/>
    </g>
  );
}

export function IconEveryWeekSpark() {
  return (
    <g>
      <defs>
        <radialGradient id="ews-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#FFD93D" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="#FFD93D" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="100" cy="108" r="42" fill="url(#ews-glow)"/>
      <circle cx="100" cy="108" r="36" fill="none" stroke="#FFD93D" strokeWidth="2.5" strokeDasharray="6 4"/>
      <circle cx="100" cy="108" r="36" fill="#2A1E4A" opacity="0.3"/>
      {[0, 90, 180, 270].map((deg, i) => (
        <g key={i} transform={`rotate(${deg} 100 108)`}>
          <path d="M 100 80 Q 108 90 100 100 Q 92 90 100 80 Z" fill="#FF7BAC" stroke="#2A2540" strokeWidth="1.5" strokeLinejoin="round"/>
          <circle cx="100" cy="86" r="2" fill="#FFD93D"/>
        </g>
      ))}
      <circle cx="100" cy="108" r="9" fill="#4EEDB0" stroke="#2A2540" strokeWidth="1.8"/>
      <path d="M 95 108 L 99 112 L 105 104" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <Sparkle x={64} y={70} size={3} color="#fff"/>
      <Sparkle x={138} y={146} size={3} color="#fff"/>
    </g>
  );
}

export function IconStrongBody() {
  return (
    <g>
      <defs>
        <linearGradient id="sb-arm" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFD3B0"/>
          <stop offset="100%" stopColor="#C49475"/>
        </linearGradient>
      </defs>
      <rect x="58" y="120" width="12" height="20" rx="3" fill="#4A5070" stroke="#2A2540" strokeWidth="1.8"/>
      <rect x="130" y="120" width="12" height="20" rx="3" fill="#4A5070" stroke="#2A2540" strokeWidth="1.8"/>
      <rect x="70" y="126" width="60" height="8" fill="#8e96b0" stroke="#2A2540" strokeWidth="1.8"/>
      <line x1="78" y1="130" x2="122" y2="130" stroke="#fff" strokeWidth="1" opacity="0.4"/>
      <g>
        <path d="M 78 96 Q 84 80 100 78 Q 116 80 118 96 L 116 108 Q 110 110 100 108 Q 90 110 80 108 Z" fill="url(#sb-arm)" stroke="#2A2540" strokeWidth="2" strokeLinejoin="round"/>
        <ellipse cx="100" cy="92" rx="14" ry="9" fill="url(#sb-arm)" stroke="#2A2540" strokeWidth="2"/>
        <path d="M 90 88 Q 98 84 110 86" stroke="#fff" strokeWidth="1.5" fill="none" opacity="0.6" strokeLinecap="round"/>
        <circle cx="100" cy="68" r="10" fill="url(#sb-arm)" stroke="#2A2540" strokeWidth="2"/>
        <path d="M 92 66 L 108 66" stroke="#2A2540" strokeWidth="1.2" opacity="0.5"/>
        <path d="M 92 70 L 108 70" stroke="#2A2540" strokeWidth="1.2" opacity="0.5"/>
      </g>
      <path d="M 62 88 L 70 92" stroke="#FFD93D" strokeWidth="2" strokeLinecap="round"/>
      <path d="M 138 88 L 130 92" stroke="#FFD93D" strokeWidth="2" strokeLinecap="round"/>
      <Sparkle x={140} y={72} size={3} color="#FFD93D"/>
      <Sparkle x={60} y={72} size={2.5} color="#fff"/>
    </g>
  );
}

export function IconHygieneHero() {
  return (
    <g>
      <defs>
        <linearGradient id="hyh-brush" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7AC4F2"/>
          <stop offset="100%" stopColor="#3D6FD9"/>
        </linearGradient>
      </defs>
      <path d="M 100 86 Q 70 100 64 148 Q 80 138 100 140 Q 120 138 136 148 Q 130 100 100 86 Z" fill="#FF7BAC" stroke="#2A2540" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M 100 90 Q 76 104 72 138 Q 90 130 100 130" stroke="#FFB5D8" strokeWidth="1.5" fill="none" opacity="0.6"/>
      <rect x="92" y="98" width="16" height="50" rx="6" fill="url(#hyh-brush)" stroke="#2A2540" strokeWidth="2"/>
      <line x1="96" y1="110" x2="104" y2="110" stroke="#fff" strokeWidth="1" opacity="0.6"/>
      <line x1="96" y1="118" x2="104" y2="118" stroke="#fff" strokeWidth="1" opacity="0.6"/>
      <rect x="88" y="80" width="24" height="22" rx="4" fill="#FFF6D0" stroke="#2A2540" strokeWidth="2"/>
      {[0,1,2,3,4].map(i => (
        <line key={i} x1={90 + i*5} y1="76" x2={90 + i*5} y2="82" stroke="#2A2540" strokeWidth="1.5" strokeLinecap="round"/>
      ))}
      <path d="M 92 70 Q 100 64 108 70 Q 110 74 100 76 Q 90 74 92 70 Z" fill="#4EEDB0" stroke="#2A2540" strokeWidth="1.5"/>
      <path d="M 96 116 L 100 114 L 104 116 L 104 122 Q 100 126 96 122 Z" fill="#FFD93D" stroke="#2A2540" strokeWidth="1.2"/>
      <Sparkle x={66} y={86} size={3} color="#fff"/>
      <Sparkle x={134} y={86} size={3} color="#FFD93D"/>
    </g>
  );
}

export function IconMorningHero() {
  return (
    <g>
      <defs>
        <radialGradient id="mh-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#FFF6D0"/>
          <stop offset="50%" stopColor="#FFD93D"/>
          <stop offset="100%" stopColor="#FF9F47"/>
        </radialGradient>
      </defs>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
        <g key={i} transform={`rotate(${deg} 100 100)`}>
          <path d="M 100 60 L 96 76 L 100 72 L 104 76 Z" fill="#FFD93D" stroke="#E0900F" strokeWidth="1"/>
        </g>
      ))}
      <circle cx="100" cy="100" r="24" fill="url(#mh-sun)" stroke="#9B6B45" strokeWidth="2.5"/>
      <ellipse cx="92" cy="98" rx="2.5" ry="3" fill="#2A2540"/>
      <ellipse cx="108" cy="98" rx="2.5" ry="3" fill="#2A2540"/>
      <circle cx="92.5" cy="97" r="0.8" fill="#fff"/>
      <circle cx="108.5" cy="97" r="0.8" fill="#fff"/>
      <path d="M 91 106 Q 100 114 109 106" stroke="#2A2540" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M 86 76 L 90 70 L 94 76 L 100 68 L 106 76 L 110 70 L 114 76 Z" fill="#FF7BAC" stroke="#2A2540" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M 76 134 Q 100 124 124 134 L 130 150 Q 100 144 70 150 Z" fill="#FF7BAC" stroke="#2A2540" strokeWidth="1.5" strokeLinejoin="round"/>
      <Sparkle x={66} y={146} size={2.5} color="#fff"/>
      <Sparkle x={138} y={148} size={2.5} color="#FFD93D"/>
    </g>
  );
}

export function IconEveningFinisher() {
  return (
    <g>
      <defs>
        <linearGradient id="ef-moon" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E0E8FF"/>
          <stop offset="100%" stopColor="#9AAEDB"/>
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="28" fill="url(#ef-moon)" stroke="#2A2540" strokeWidth="2"/>
      <path d="M 100 72 Q 78 84 78 100 Q 78 116 100 128 Q 88 116 88 100 Q 88 84 100 72 Z" fill="#7A8DBA" opacity="0.45"/>
      <circle cx="94" cy="96" r="2" fill="#2A2540"/>
      <circle cx="106" cy="96" r="2" fill="#2A2540"/>
      <path d="M 92 108 Q 100 114 108 108" stroke="#2A2540" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <circle cx="92" cy="86" r="2.5" fill="#7A8DBA" opacity="0.7"/>
      <circle cx="110" cy="90" r="1.8" fill="#7A8DBA" opacity="0.6"/>
      <path d="M 56 132 L 144 132 L 138 142 L 144 152 L 56 152 L 62 142 Z" fill="#FF7BAC" stroke="#2A2540" strokeWidth="2" strokeLinejoin="round"/>
      <text x="100" y="147" fontSize="11" fontWeight="900" textAnchor="middle" fill="#fff" fontFamily="Plus Jakarta Sans, system-ui, sans-serif" letterSpacing="1">DONE</text>
      <Sparkle x={62} y={70} size={3} color="#FFD93D"/>
      <Sparkle x={140} y={74} size={3} color="#fff"/>
      <Sparkle x={66} y={114} size={2.5} color="#fff"/>
      <Sparkle x={138} y={110} size={2.5} color="#FFD93D"/>
    </g>
  );
}

export function IconRoomRescue() {
  return (
    <g>
      <defs>
        <linearGradient id="rr-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF7BAC"/>
          <stop offset="100%" stopColor="#A03868"/>
        </linearGradient>
      </defs>
      <path d="M 60 80 L 100 64 L 140 80 L 140 144 L 100 160 L 60 144 Z" fill="#3D2A12" stroke="#FFD93D" strokeWidth="1.5" strokeLinejoin="round" opacity="0.55"/>
      <path d="M 60 144 L 100 160 L 140 144 L 100 128 Z" fill="url(#rr-floor)" stroke="#2A2540" strokeWidth="1.8" strokeLinejoin="round"/>
      <rect x="80" y="116" width="40" height="18" rx="3" fill="#FFE89D" stroke="#2A2540" strokeWidth="1.8"/>
      <rect x="82" y="108" width="16" height="10" rx="2" fill="#fff" stroke="#2A2540" strokeWidth="1.5"/>
      <rect x="106" y="100" width="14" height="14" rx="2" fill="#4EEDB0" stroke="#2A2540" strokeWidth="1.5"/>
      <path d="M 100 70 L 105 84 L 118 88 L 105 92 L 100 106 L 95 92 L 82 88 L 95 84 Z" fill="#FFD93D" stroke="#9B6B45" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M 100 70 L 105 84 L 118 88 L 100 88 Z" fill="#FFF6D0" opacity="0.6"/>
      <Sparkle x={64} y={100} size={3} color="#fff"/>
      <Sparkle x={136} y={104} size={3} color="#FFD93D"/>
      <Sparkle x={70} y={142} size={2.5} color="#fff"/>
    </g>
  );
}

export function IconBackpackBoss() {
  return (
    <g>
      <defs>
        <linearGradient id="bb-bag" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5B8EFF"/>
          <stop offset="100%" stopColor="#2D5BC2"/>
        </linearGradient>
      </defs>
      <path d="M 76 70 L 84 56 L 92 68 L 100 52 L 108 68 L 116 56 L 124 70 Z" fill="#FFD93D" stroke="#2A2540" strokeWidth="1.8" strokeLinejoin="round"/>
      <rect x="76" y="70" width="48" height="6" fill="#E0B520" stroke="#2A2540" strokeWidth="1.5"/>
      <circle cx="100" cy="58" r="2" fill="#FF6B6B"/>
      <path d="M 90 78 Q 100 70 110 78" stroke="#2A2540" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <path d="M 70 90 Q 70 80 78 80 L 122 80 Q 130 80 130 90 L 132 142 Q 130 150 122 150 L 78 150 Q 70 150 68 142 Z" fill="url(#bb-bag)" stroke="#2A2540" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M 80 108 L 120 108 L 122 140 L 78 140 Z" fill="#7DC3FF" stroke="#2A2540" strokeWidth="1.8" strokeLinejoin="round" opacity="0.85"/>
      <line x1="80" y1="120" x2="120" y2="120" stroke="#2A2540" strokeWidth="1.2" strokeDasharray="2 2"/>
      <circle cx="100" cy="120" r="2.5" fill="#FFD93D" stroke="#2A2540" strokeWidth="1"/>
      <path d="M 78 90 L 70 110" stroke="#2A2540" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <path d="M 122 90 L 130 110" stroke="#2A2540" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <Sparkle x={62} y={72} size={3} color="#FFD93D"/>
      <Sparkle x={138} y={72} size={3} color="#fff"/>
    </g>
  );
}

export function IconFaithfulLight() {
  return (
    <g>
      <defs>
        <radialGradient id="fl-flame" cx="0.5" cy="0.6" r="0.5">
          <stop offset="0%" stopColor="#FFF6D0"/>
          <stop offset="60%" stopColor="#FFD93D"/>
          <stop offset="100%" stopColor="#FF7BAC"/>
        </radialGradient>
      </defs>
      {[-60, -30, 0, 30, 60].map((deg, i) => (
        <g key={i} transform={`rotate(${deg} 100 86)`}>
          <path d="M 100 86 L 96 50 L 100 44 L 104 50 Z" fill="#FFD93D" opacity="0.6"/>
        </g>
      ))}
      <path d="M 100 64 Q 92 76 96 88 Q 100 96 100 96 Q 100 96 104 88 Q 108 76 100 64 Z" fill="url(#fl-flame)" stroke="#9B2B0F" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M 98 78 Q 100 84 102 78 Q 100 90 98 78 Z" fill="#fff" opacity="0.7"/>
      <rect x="92" y="96" width="16" height="36" rx="2" fill="#FFF6E5" stroke="#2A2540" strokeWidth="2"/>
      <rect x="92" y="96" width="16" height="6" fill="#FFE89D" stroke="#2A2540" strokeWidth="1.5"/>
      <line x1="100" y1="96" x2="100" y2="92" stroke="#2A2540" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M 76 132 L 124 132 L 118 144 L 82 144 Z" fill="#E0B520" stroke="#2A2540" strokeWidth="2" strokeLinejoin="round"/>
      <ellipse cx="100" cy="132" rx="24" ry="3" fill="#FFE89D" stroke="#2A2540" strokeWidth="1.5"/>
      <ellipse cx="100" cy="144" rx="22" ry="3" fill="#9B6B45" stroke="#2A2540" strokeWidth="1.5"/>
      <Sparkle x={64} y={86} size={3} color="#FFD93D"/>
      <Sparkle x={136} y={86} size={3} color="#FFD93D"/>
    </g>
  );
}

export function IconPageBuilder() {
  return (
    <g>
      <defs>
        <linearGradient id="pgb-b1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF7BAC"/>
          <stop offset="100%" stopColor="#A03868"/>
        </linearGradient>
        <linearGradient id="pgb-b2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7DC3FF"/>
          <stop offset="100%" stopColor="#2D5BC2"/>
        </linearGradient>
        <linearGradient id="pgb-b3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4EEDB0"/>
          <stop offset="100%" stopColor="#1F8A5B"/>
        </linearGradient>
      </defs>
      <rect x="58" y="132" width="84" height="18" rx="3" fill="url(#pgb-b3)" stroke="#2A2540" strokeWidth="2"/>
      <line x1="62" y1="140" x2="138" y2="140" stroke="#fff" strokeWidth="0.8" opacity="0.55"/>
      <rect x="64" y="136" width="3" height="10" fill="#FFD93D"/>
      <rect x="64" y="110" width="72" height="22" rx="3" fill="url(#pgb-b2)" stroke="#2A2540" strokeWidth="2"/>
      <line x1="68" y1="120" x2="132" y2="120" stroke="#fff" strokeWidth="0.8" opacity="0.55"/>
      <rect x="70" y="114" width="4" height="14" fill="#FFD93D"/>
      <rect x="72" y="86" width="56" height="22" rx="3" fill="url(#pgb-b1)" stroke="#2A2540" strokeWidth="2"/>
      <line x1="76" y1="96" x2="124" y2="96" stroke="#fff" strokeWidth="0.8" opacity="0.55"/>
      <rect x="78" y="90" width="4" height="14" fill="#FFD93D"/>
      <circle cx="100" cy="80" r="6" fill="#FF6B6B" stroke="#2A2540" strokeWidth="1.5"/>
      <path d="M 100 74 Q 102 70 104 72" stroke="#3A8E3F" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      <ellipse cx="98" cy="78" rx="1.5" ry="1" fill="#fff" opacity="0.7"/>
      <Sparkle x={64} y={78} size={2.5} color="#FFD93D"/>
      <Sparkle x={140} y={84} size={2.5} color="#fff"/>
    </g>
  );
}

export function IconPerfectPair() {
  return (
    <g>
      <defs>
        <linearGradient id="pp-c1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4EEDB0"/>
          <stop offset="100%" stopColor="#1F8A5B"/>
        </linearGradient>
        <linearGradient id="pp-c2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFD93D"/>
          <stop offset="100%" stopColor="#E0900F"/>
        </linearGradient>
      </defs>
      <circle cx="82" cy="106" r="26" fill="url(#pp-c1)" stroke="#2A2540" strokeWidth="2.5"/>
      <path d="M 70 106 L 80 116 L 96 96" stroke="#fff" strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="120" cy="118" r="26" fill="url(#pp-c2)" stroke="#2A2540" strokeWidth="2.5"/>
      <path d="M 108 118 L 118 128 L 134 108" stroke="#2A2540" strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="100" cy="72" r="13" fill="#1a1b2e" stroke="#FF7BAC" strokeWidth="2"/>
      <text x="100" y="77" fontSize="14" fontWeight="900" textAnchor="middle" fill="#FF7BAC" fontFamily="Plus Jakarta Sans, system-ui, sans-serif">14</text>
      <Sparkle x={56} y={70} size={3} color="#fff"/>
      <Sparkle x={144} y={68} size={3} color="#FFD93D"/>
    </g>
  );
}

export function IconPerfectWeek() {
  return (
    <g>
      <defs>
        <linearGradient id="pw-trophy" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE89D"/>
          <stop offset="100%" stopColor="#E0B520"/>
        </linearGradient>
      </defs>
      <path d="M 78 76 L 122 76 L 120 110 Q 116 126 100 128 Q 84 126 80 110 Z" fill="url(#pw-trophy)" stroke="#9B6B45" strokeWidth="2.2" strokeLinejoin="round"/>
      <path d="M 78 82 Q 66 84 66 96 Q 66 104 80 106" stroke="#9B6B45" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <path d="M 122 82 Q 134 84 134 96 Q 134 104 120 106" stroke="#9B6B45" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <rect x="86" y="128" width="28" height="6" fill="#9B6B45" stroke="#2A2540" strokeWidth="1.5"/>
      <rect x="78" y="134" width="44" height="12" rx="2" fill="url(#pw-trophy)" stroke="#9B6B45" strokeWidth="1.8"/>
      <text x="100" y="112" fontSize="30" fontWeight="900" textAnchor="middle" fill="#FF7BAC" fontFamily="Plus Jakarta Sans, system-ui, sans-serif" stroke="#2A2540" strokeWidth="1.5">7</text>
      {[0,1,2,3,4,5,6].map(i => (
        <circle key={i} cx={74 + i*9} cy={150} r="1.6" fill="#FFD93D"/>
      ))}
      <Sparkle x={62} y={62} size={3} color="#FFD93D"/>
      <Sparkle x={140} y={62} size={3} color="#fff"/>
    </g>
  );
}

export function IconBrightSweep() {
  return (
    <g>
      <defs>
        <linearGradient id="bs-trail" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFD93D"/>
          <stop offset="100%" stopColor="#FF7BAC" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d="M 56 138 Q 84 148 130 78" stroke="url(#bs-trail)" strokeWidth="14" fill="none" strokeLinecap="round" opacity="0.7"/>
      <path d="M 56 138 Q 84 148 130 78" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5"/>
      <circle cx="76" cy="138" r="2.5" fill="#FFD93D"/>
      <circle cx="92" cy="128" r="2" fill="#fff"/>
      <circle cx="106" cy="114" r="2.5" fill="#FFD93D"/>
      <circle cx="118" cy="98" r="2" fill="#fff"/>
      <line x1="76" y1="158" x2="124" y2="84" stroke="#9B6B45" strokeWidth="5" strokeLinecap="round"/>
      <line x1="76" y1="158" x2="124" y2="84" stroke="#C49475" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
      <path d="M 64 158 Q 76 142 90 152 Q 92 164 80 168 Q 68 168 64 158 Z" fill="#FFD93D" stroke="#9B6B45" strokeWidth="2" strokeLinejoin="round"/>
      {[0,1,2,3].map(i => <line key={i} x1={68 + i*5} y1={166} x2={72 + i*5} y2={152} stroke="#9B6B45" strokeWidth="1.2"/>)}
      <path d="M 130 70 L 134 80 L 144 82 L 134 84 L 130 94 L 126 84 L 116 82 L 126 80 Z" fill="#FFD93D" stroke="#9B6B45" strokeWidth="1.5" strokeLinejoin="round"/>
      <Sparkle x={66} y={84} size={2.5} color="#fff"/>
    </g>
  );
}

export function IconFamilyRhythm() {
  return (
    <g>
      <defs>
        <linearGradient id="fr-fig1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7DC3FF"/>
          <stop offset="100%" stopColor="#2D5BC2"/>
        </linearGradient>
        <linearGradient id="fr-fig2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFB5D8"/>
          <stop offset="100%" stopColor="#A03868"/>
        </linearGradient>
      </defs>
      <circle cx="82" cy="98" r="10" fill="#FFD3B0" stroke="#2A2540" strokeWidth="2"/>
      <path d="M 70 138 Q 70 116 82 116 Q 94 116 94 138 Z" fill="url(#fr-fig1)" stroke="#2A2540" strokeWidth="2" strokeLinejoin="round"/>
      <circle cx="79" cy="97" r="1.2" fill="#2A2540"/>
      <circle cx="85" cy="97" r="1.2" fill="#2A2540"/>
      <path d="M 79 102 Q 82 105 85 102" stroke="#2A2540" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <circle cx="118" cy="98" r="10" fill="#C49475" stroke="#2A2540" strokeWidth="2"/>
      <path d="M 106 138 Q 106 116 118 116 Q 130 116 130 138 Z" fill="url(#fr-fig2)" stroke="#2A2540" strokeWidth="2" strokeLinejoin="round"/>
      <circle cx="115" cy="97" r="1.2" fill="#2A2540"/>
      <circle cx="121" cy="97" r="1.2" fill="#2A2540"/>
      <path d="M 115 102 Q 118 105 121 102" stroke="#2A2540" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <g>
        <circle cx="64" cy="80" r="4" fill="#FFD93D" stroke="#2A2540" strokeWidth="1.5"/>
        <line x1="68" y1="80" x2="68" y2="64" stroke="#2A2540" strokeWidth="2"/>
        <path d="M 68 64 Q 76 66 76 74" stroke="#2A2540" strokeWidth="2" fill="none" strokeLinecap="round"/>
      </g>
      <g>
        <circle cx="136" cy="74" r="4" fill="#FF7BAC" stroke="#2A2540" strokeWidth="1.5"/>
        <line x1="140" y1="74" x2="140" y2="58" stroke="#2A2540" strokeWidth="2"/>
        <path d="M 140 58 Q 132 60 132 68" stroke="#2A2540" strokeWidth="2" fill="none" strokeLinecap="round"/>
      </g>
      <path d="M 100 132 Q 94 124 90 130 Q 90 138 100 144 Q 110 138 110 130 Q 106 124 100 132 Z" fill="#FF7BAC" stroke="#2A2540" strokeWidth="1.5"/>
      <Sparkle x={100} y={70} size={3} color="#FFD93D"/>
    </g>
  );
}

export function IconBookExplorer() {
  return (
    <g>
      <defs>
        <linearGradient id="be-book" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7DC3FF"/>
          <stop offset="100%" stopColor="#2D5BC2"/>
        </linearGradient>
        <radialGradient id="be-lens" cx="0.4" cy="0.4" r="0.5">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.5"/>
          <stop offset="60%" stopColor="#7AC4F2" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#3D6FD9" stopOpacity="0.6"/>
        </radialGradient>
      </defs>
      <path d="M 56 140 L 56 100 Q 78 92 100 100 Q 122 92 144 100 L 144 140 Q 122 132 100 140 Q 78 132 56 140 Z" fill="url(#be-book)" stroke="#2A2540" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M 62 138 L 62 104 Q 80 98 100 104 L 100 138 Q 80 132 62 138 Z" fill="#FFF6E5" stroke="#2A2540" strokeWidth="1.5"/>
      <path d="M 138 138 L 138 104 Q 120 98 100 104 L 100 138 Q 120 132 138 138 Z" fill="#FFF6E5" stroke="#2A2540" strokeWidth="1.5"/>
      <line x1="100" y1="104" x2="100" y2="138" stroke="#2A2540" strokeWidth="1.2"/>
      {[0,1,2].map(i => (
        <g key={i}>
          <line x1="68" y1={114 + i*6} x2="94" y2={113 + i*6} stroke="#9B6B45" strokeWidth="0.8" opacity="0.6"/>
          <line x1="106" y1={113 + i*6} x2="132" y2={114 + i*6} stroke="#9B6B45" strokeWidth="0.8" opacity="0.6"/>
        </g>
      ))}
      <circle cx="118" cy="82" r="18" fill="url(#be-lens)" stroke="#FFD93D" strokeWidth="3"/>
      <circle cx="118" cy="82" r="18" fill="none" stroke="#fff" strokeWidth="1" opacity="0.6"/>
      <ellipse cx="112" cy="76" rx="5" ry="3" fill="#fff" opacity="0.6"/>
      <line x1="130" y1="94" x2="142" y2="106" stroke="#FFD93D" strokeWidth="5" strokeLinecap="round"/>
      <line x1="130" y1="94" x2="142" y2="106" stroke="#9B6B45" strokeWidth="2" strokeLinecap="round"/>
      <text x="116" y="86" fontSize="12" fontWeight="900" textAnchor="middle" fill="#2A2540" fontFamily="Plus Jakarta Sans, system-ui, sans-serif">A</text>
      <Sparkle x={66} y={78} size={3} color="#FFD93D"/>
    </g>
  );
}

// ===========================================================================
// MYTHIC ICONS (4)
// ===========================================================================

export function IconPerfectSeasonSpark() {
  return (
    <g>
      <defs>
        <radialGradient id="pss-core" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#FFF6D0"/>
          <stop offset="50%" stopColor="#FFD93D"/>
          <stop offset="100%" stopColor="#FF6B3D"/>
        </radialGradient>
      </defs>
      {[0, 60, 120, 180, 240, 300].map((deg, i) => (
        <g key={i} transform={`rotate(${deg} 100 110)`}>
          <path d="M 100 56 L 92 80 L 100 76 L 108 80 Z" fill="#FFD93D" stroke="#9B2B0F" strokeWidth="1.2" strokeLinejoin="round"/>
        </g>
      ))}
      {[30, 90, 150, 210, 270, 330].map((deg, i) => (
        <g key={`s-${i}`} transform={`rotate(${deg} 100 110)`}>
          <path d="M 100 70 L 96 84 L 100 82 L 104 84 Z" fill="#FF6B3D" opacity="0.85"/>
        </g>
      ))}
      <circle cx="100" cy="110" r="28" fill="none" stroke="#FFD93D" strokeWidth="2.5" strokeDasharray="4 3" opacity="0.9"/>
      <circle cx="100" cy="110" r="22" fill="url(#pss-core)" stroke="#9B2B0F" strokeWidth="2.2"/>
      <text x="100" y="116" fontSize="16" fontWeight="900" textAnchor="middle" fill="#1a1b2e" fontFamily="Plus Jakarta Sans, system-ui, sans-serif">60</text>
      <ellipse cx="92" cy="102" rx="7" ry="4" fill="#fff" opacity="0.6"/>
      <Sparkle x={60} y={62} size={3.5} color="#FFD93D"/>
      <Sparkle x={140} y={62} size={3} color="#fff"/>
      <Sparkle x={60} y={158} size={3} color="#FFD93D"/>
      <Sparkle x={140} y={158} size={3.5} color="#fff"/>
    </g>
  );
}

export function Icon250DayBuilder() {
  return (
    <g>
      <defs>
        <linearGradient id="d250-m" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFB770"/>
          <stop offset="100%" stopColor="#4A1F12"/>
        </linearGradient>
      </defs>
      <path d="M 56 152 L 80 96 L 100 124 L 120 96 L 144 152 Z" fill="#9B2B0F" stroke="#2A0E08" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M 76 102 L 80 96 L 86 106 L 82 110 Z" fill="#fff" opacity="0.95"/>
      <path d="M 114 102 L 120 96 L 126 110 L 120 112 Z" fill="#fff" opacity="0.95"/>
      <path d="M 68 152 L 100 76 L 132 152 Z" fill="url(#d250-m)" stroke="#2A0E08" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M 92 100 L 100 76 L 108 100 L 104 104 L 100 102 L 96 104 Z" fill="#fff" opacity="0.95"/>
      <path d="M 100 76 L 86 130" stroke="#FFD93D" strokeWidth="1.5" opacity="0.55"/>
      <line x1="100" y1="76" x2="100" y2="58" stroke="#2A0E08" strokeWidth="2.5"/>
      <path d="M 100 58 L 124 64 L 116 72 L 124 80 L 100 74 Z" fill="#FFD93D" stroke="#2A0E08" strokeWidth="1.8" strokeLinejoin="round"/>
      <text x="112" y="73" fontSize="9" fontWeight="900" textAnchor="middle" fill="#9B2B0F" fontFamily="Plus Jakarta Sans, system-ui, sans-serif">250</text>
      <rect x="56" y="148" width="20" height="6" fill="#4A1F12" stroke="#2A0E08" strokeWidth="1.2"/>
      <rect x="78" y="142" width="14" height="6" fill="#4A1F12" stroke="#2A0E08" strokeWidth="1.2"/>
      <rect x="108" y="142" width="14" height="6" fill="#4A1F12" stroke="#2A0E08" strokeWidth="1.2"/>
      <rect x="124" y="148" width="20" height="6" fill="#4A1F12" stroke="#2A0E08" strokeWidth="1.2"/>
      <circle cx="64" cy="84" r="9" fill="#FFD93D" opacity="0.7"/>
      <circle cx="64" cy="84" r="5" fill="#FFF6D0"/>
      <Sparkle x={140} y={70} size={3} color="#FFD93D"/>
    </g>
  );
}

export function Icon300DayBuilder() {
  return (
    <g>
      <defs>
        <linearGradient id="d300-t" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFB770"/>
          <stop offset="100%" stopColor="#9B2B0F"/>
        </linearGradient>
      </defs>
      <rect x="58" y="118" width="22" height="32" fill="#4A1F12" stroke="#2A0E08" strokeWidth="1.5"/>
      <rect x="120" y="118" width="22" height="32" fill="#4A1F12" stroke="#2A0E08" strokeWidth="1.5"/>
      <rect x="56" y="112" width="6" height="8" fill="#4A1F12" stroke="#2A0E08" strokeWidth="1.2"/>
      <rect x="68" y="112" width="6" height="8" fill="#4A1F12" stroke="#2A0E08" strokeWidth="1.2"/>
      <rect x="126" y="112" width="6" height="8" fill="#4A1F12" stroke="#2A0E08" strokeWidth="1.2"/>
      <rect x="138" y="112" width="6" height="8" fill="#4A1F12" stroke="#2A0E08" strokeWidth="1.2"/>
      <rect x="80" y="92" width="40" height="58" fill="url(#d300-t)" stroke="#2A0E08" strokeWidth="2.2"/>
      <rect x="80" y="86" width="8" height="8" fill="url(#d300-t)" stroke="#2A0E08" strokeWidth="1.5"/>
      <rect x="92" y="86" width="8" height="8" fill="url(#d300-t)" stroke="#2A0E08" strokeWidth="1.5"/>
      <rect x="104" y="86" width="8" height="8" fill="url(#d300-t)" stroke="#2A0E08" strokeWidth="1.5"/>
      <rect x="116" y="86" width="8" height="8" fill="url(#d300-t)" stroke="#2A0E08" strokeWidth="1.5"/>
      <polygon points="80,86 100,60 120,86" fill="#FF6B3D" stroke="#2A0E08" strokeWidth="2" strokeLinejoin="round"/>
      <line x1="100" y1="60" x2="100" y2="46" stroke="#2A0E08" strokeWidth="2.2"/>
      <path d="M 100 46 L 112 50 L 100 56 Z" fill="#FFD93D" stroke="#2A0E08" strokeWidth="1.5" strokeLinejoin="round"/>
      {[0,1,2,3,4].map(r => (
        <line key={r} x1="82" y1={102 + r*10} x2="118" y2={102 + r*10} stroke="#5A3A1F" strokeWidth="0.6" opacity="0.6"/>
      ))}
      <rect x="76" y="124" width="48" height="18" rx="3" fill="#1a1b2e" stroke="#FFD93D" strokeWidth="2"/>
      <text x="100" y="138" fontSize="14" fontWeight="900" textAnchor="middle" fill="#FFD93D" fontFamily="Plus Jakarta Sans, system-ui, sans-serif">300</text>
      <path d="M 92 150 L 92 142 Q 92 138 100 138 Q 108 138 108 142 L 108 150 Z" fill="#2A0E08" stroke="#FFD93D" strokeWidth="1.2"/>
      <Sparkle x={56} y={62} size={3} color="#FFD93D"/>
      <Sparkle x={144} y={66} size={3} color="#fff"/>
    </g>
  );
}

export function Icon365Legend() {
  return (
    <g>
      <defs>
        <radialGradient id="d365-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#FFF6D0"/>
          <stop offset="100%" stopColor="#FF9F47"/>
        </radialGradient>
        <linearGradient id="d365-moon" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E0E8FF"/>
          <stop offset="100%" stopColor="#9AAEDB"/>
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="110" rx="42" ry="18" fill="none" stroke="#FFD93D" strokeWidth="2" strokeDasharray="3 4" opacity="0.8" transform="rotate(-20 100 110)"/>
      <ellipse cx="100" cy="110" rx="42" ry="18" fill="none" stroke="#7AC4F2" strokeWidth="1.5" strokeDasharray="2 5" opacity="0.6" transform="rotate(20 100 110)"/>
      <circle cx="100" cy="110" r="20" fill="#1a1b2e" stroke="#FFD93D" strokeWidth="2.5"/>
      <circle cx="100" cy="110" r="20" fill="none" stroke="#FF6B3D" strokeWidth="1" opacity="0.5"/>
      <text x="100" y="116" fontSize="14" fontWeight="900" textAnchor="middle" fill="#FFD93D" fontFamily="Plus Jakarta Sans, system-ui, sans-serif">365</text>
      <g transform="translate(60 96)">
        <circle r="10" fill="url(#d365-sun)" stroke="#9B2B0F" strokeWidth="1.8"/>
        {[-60,-30,0,30,60].map((d,i) => (
          <line key={i}
            x1={Math.cos((d-90)*Math.PI/180)*11}
            y1={Math.sin((d-90)*Math.PI/180)*11}
            x2={Math.cos((d-90)*Math.PI/180)*16}
            y2={Math.sin((d-90)*Math.PI/180)*16}
            stroke="#FFD93D" strokeWidth="1.5" strokeLinecap="round"/>
        ))}
        <ellipse cx="-3" cy="-3" rx="3" ry="2" fill="#fff" opacity="0.7"/>
      </g>
      <g transform="translate(140 124)">
        <circle r="10" fill="url(#d365-moon)" stroke="#2A2540" strokeWidth="1.8"/>
        <path d="M 0 -10 Q -8 -4 -8 0 Q -8 4 0 10 Q -4 4 -4 0 Q -4 -4 0 -10 Z" fill="#7A8DBA" opacity="0.55"/>
        <circle cx="-2" cy="-3" r="1.5" fill="#2A2540" opacity="0.4"/>
        <circle cx="3" cy="2" r="1" fill="#2A2540" opacity="0.4"/>
      </g>
      <Sparkle x={64} y={68} size={3.5} color="#FFD93D"/>
      <Sparkle x={144} y={70} size={3} color="#fff"/>
      <Sparkle x={56} y={148} size={3} color="#FFD93D"/>
      <Sparkle x={146} y={156} size={2.5} color="#fff"/>
    </g>
  );
}

// ===========================================================================
// LEGENDARY ICONS (15)
// ===========================================================================

export function IconYearChampion() {
  const left = [0, 1, 2, 3, 4, 5].map(i => 200 + i * 25);
  const right = [0, 1, 2, 3, 4, 5].map(i => -20 - i * 25);
  return (
    <g>
      <defs>
        <linearGradient id="yc-leaf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7DD87B"/>
          <stop offset="100%" stopColor="#3A8E3F"/>
        </linearGradient>
      </defs>
      {left.map((angle, i) => {
        const r = 36;
        const cx = 100 + Math.cos(angle * Math.PI/180) * r;
        const cy = 110 + Math.sin(angle * Math.PI/180) * r;
        return (
          <g key={`l-${i}`} transform={`translate(${cx} ${cy}) rotate(${angle + 90})`}>
            <ellipse cx="0" cy="0" rx="4" ry="9" fill="url(#yc-leaf)" stroke="#1F4F22" strokeWidth="1"/>
            <line x1="0" y1="-8" x2="0" y2="8" stroke="#1F4F22" strokeWidth="0.6" opacity="0.7"/>
          </g>
        );
      })}
      {right.map((angle, i) => {
        const r = 36;
        const cx = 100 + Math.cos(angle * Math.PI/180) * r;
        const cy = 110 + Math.sin(angle * Math.PI/180) * r;
        return (
          <g key={`r-${i}`} transform={`translate(${cx} ${cy}) rotate(${angle + 90})`}>
            <ellipse cx="0" cy="0" rx="4" ry="9" fill="url(#yc-leaf)" stroke="#1F4F22" strokeWidth="1"/>
            <line x1="0" y1="-8" x2="0" y2="8" stroke="#1F4F22" strokeWidth="0.6" opacity="0.7"/>
          </g>
        );
      })}
      <path d="M 92 144 Q 100 140 108 144 Q 110 152 100 154 Q 90 152 92 144 Z" fill="#FFD93D" stroke="#A88560" strokeWidth="1.5"/>
      <circle cx="100" cy="110" r="22" fill="#1a1b2e" stroke="#FFD93D" strokeWidth="2.5"/>
      <circle cx="100" cy="110" r="22" fill="none" stroke="#fff" strokeWidth="0.8" opacity="0.5" strokeDasharray="2 2"/>
      <text x="100" y="116" fontSize="14" fontWeight="900" textAnchor="middle" fill="#FFD93D" fontFamily="Plus Jakarta Sans, system-ui, sans-serif">365</text>
      <ellipse cx="94" cy="102" rx="6" ry="4" fill="#fff" opacity="0.25"/>
      <Sparkle x={70} y={70} size={4} color="#FFD93D"/>
      <Sparkle x={130} y={72} size={3.5} color="#fff"/>
      <Sparkle x={148} y={140} size={3} color="#FFD93D"/>
      <Sparkle x={56} y={140} size={3} color="#fff"/>
    </g>
  );
}

export function IconPerfectYear() {
  return (
    <g>
      <defs>
        <linearGradient id="py-diamond" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E0F4FF"/>
          <stop offset="100%" stopColor="#7AC4F2"/>
        </linearGradient>
        <linearGradient id="py-crown" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE89D"/>
          <stop offset="100%" stopColor="#E0B520"/>
        </linearGradient>
      </defs>
      {[0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map((deg, i) => (
        <line key={i}
          x1={100 + Math.cos(deg * Math.PI/180) * 30}
          y1={110 + Math.sin(deg * Math.PI/180) * 30}
          x2={100 + Math.cos(deg * Math.PI/180) * 48}
          y2={110 + Math.sin(deg * Math.PI/180) * 48}
          stroke="#FFD93D" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
      ))}
      <g>
        <polygon points="100,84 124,104 100,144 76,104" fill="url(#py-diamond)" stroke="#2D5BC2" strokeWidth="2" strokeLinejoin="round"/>
        <polyline points="76,104 88,84 100,84 100,104 124,104" stroke="#2D5BC2" strokeWidth="1" fill="none" opacity="0.6"/>
        <polyline points="88,84 100,104 112,84" stroke="#2D5BC2" strokeWidth="1" fill="none" opacity="0.6"/>
        <line x1="100" y1="104" x2="100" y2="144" stroke="#2D5BC2" strokeWidth="0.8" opacity="0.5"/>
        <polygon points="80,104 88,88 96,88 88,104" fill="#fff" opacity="0.55"/>
      </g>
      <g>
        <path d="M 76 80 L 84 64 L 92 76 L 100 60 L 108 76 L 116 64 L 124 80 Q 100 84 76 80 Z" fill="url(#py-crown)" stroke="#2A2540" strokeWidth="2" strokeLinejoin="round"/>
        <rect x="76" y="80" width="48" height="6" fill="#E0B520" stroke="#2A2540" strokeWidth="1.5"/>
        <circle cx="100" cy="64" r="3" fill="#FF6B6B" stroke="#2A2540" strokeWidth="1"/>
        <circle cx="84" cy="68" r="2" fill="#4EEDB0" stroke="#2A2540" strokeWidth="0.8"/>
        <circle cx="116" cy="68" r="2" fill="#7AC4F2" stroke="#2A2540" strokeWidth="0.8"/>
        <circle cx="100" cy="83" r="1.5" fill="#FF6B6B"/>
        <path d="M 80 76 Q 100 80 120 76" stroke="#fff" strokeWidth="1" fill="none" opacity="0.6"/>
      </g>
      <Sparkle x={60} y={84} size={4} color="#FFD93D"/>
      <Sparkle x={140} y={86} size={3.5} color="#fff"/>
      <Sparkle x={150} y={120} size={3} color="#FFD93D"/>
      <Sparkle x={52} y={124} size={3} color="#fff"/>
    </g>
  );
}

export function IconToothbrushMaster() {
  return (
    <g>
      <defs>
        <linearGradient id="tbm-h" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7DC3FF"/>
          <stop offset="100%" stopColor="#2D5BC2"/>
        </linearGradient>
      </defs>
      <path d="M 80 70 L 86 56 L 94 68 L 100 52 L 106 68 L 114 56 L 120 70 Z" fill="#FFD93D" stroke="#9B6B45" strokeWidth="1.8" strokeLinejoin="round"/>
      <rect x="80" y="70" width="40" height="5" fill="#E0B520" stroke="#9B6B45" strokeWidth="1.5"/>
      <circle cx="100" cy="58" r="2.2" fill="#FF6B6B" stroke="#9B6B45" strokeWidth="0.8"/>
      <circle cx="86" cy="62" r="1.5" fill="#4EEDB0"/>
      <circle cx="114" cy="62" r="1.5" fill="#FF7BAC"/>
      <path d="M 90 84 Q 100 76 110 84 Q 112 90 100 92 Q 88 90 90 84 Z" fill="#4EEDB0" stroke="#9B6B45" strokeWidth="1.5"/>
      <rect x="86" y="90" width="28" height="14" rx="3" fill="#FFF6D0" stroke="#9B6B45" strokeWidth="2"/>
      {[0,1,2,3,4,5].map(i => (
        <line key={i} x1={88 + i*5} y1="86" x2={88 + i*5} y2="92" stroke="#9B6B45" strokeWidth="1.5" strokeLinecap="round"/>
      ))}
      <rect x="92" y="104" width="16" height="50" rx="6" fill="url(#tbm-h)" stroke="#9B6B45" strokeWidth="2"/>
      <line x1="95" y1="116" x2="105" y2="116" stroke="#FFF6D0" strokeWidth="1.2" opacity="0.7"/>
      <line x1="95" y1="126" x2="105" y2="126" stroke="#FFF6D0" strokeWidth="1.2" opacity="0.7"/>
      <circle cx="100" cy="140" r="6" fill="#FFD93D" stroke="#9B6B45" strokeWidth="1.5"/>
      <path d="M 100 136 L 101 139 L 104 139 L 102 141 L 103 144 L 100 142 L 97 144 L 98 141 L 96 139 L 99 139 Z" fill="#2A2540"/>
      <Sparkle x={64} y={84} size={3} color="#FFD93D"/>
      <Sparkle x={138} y={84} size={3} color="#fff"/>
      <Sparkle x={144} y={140} size={2.5} color="#FFD93D"/>
    </g>
  );
}

export function IconSunriseBuilder() {
  return (
    <g>
      <defs>
        <radialGradient id="srb-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#FFF6D0"/>
          <stop offset="100%" stopColor="#FF9F47"/>
        </radialGradient>
      </defs>
      {[-75,-45,-15,15,45,75].map((deg,i) => (
        <g key={i} transform={`rotate(${deg} 100 116)`}>
          <path d="M 100 78 L 96 64 L 100 60 L 104 64 Z" fill="#FFD93D" stroke="#9B6B45" strokeWidth="0.8"/>
        </g>
      ))}
      <path d="M 64 116 Q 64 84 100 84 Q 136 84 136 116 Z" fill="url(#srb-sun)" stroke="#9B2B0F" strokeWidth="2.2" strokeLinejoin="round"/>
      <circle cx="92" cy="106" r="2" fill="#2A2540"/>
      <circle cx="108" cy="106" r="2" fill="#2A2540"/>
      <path d="M 90 112 Q 100 118 110 112" stroke="#2A2540" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      <ellipse cx="76" cy="124" rx="14" ry="5" fill="#fff" opacity="0.85"/>
      <ellipse cx="124" cy="126" rx="16" ry="5" fill="#fff" opacity="0.9"/>
      <path d="M 56 132 Q 100 124 144 132 L 144 144 L 56 144 Z" fill="#3A8E3F" stroke="#1F4F22" strokeWidth="1.8"/>
      <ellipse cx="74" cy="138" rx="6" ry="2.5" fill="#C49475" stroke="#5A3A1F" strokeWidth="1"/>
      <ellipse cx="100" cy="140" rx="7" ry="2.8" fill="#C49475" stroke="#5A3A1F" strokeWidth="1"/>
      <ellipse cx="126" cy="138" rx="6" ry="2.5" fill="#C49475" stroke="#5A3A1F" strokeWidth="1"/>
      <Sparkle x={62} y={74} size={3} color="#FFD93D"/>
      <Sparkle x={140} y={68} size={3} color="#fff"/>
    </g>
  );
}

export function IconNightRhythm() {
  return (
    <g>
      <defs>
        <linearGradient id="nr-moon" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF6D0"/>
          <stop offset="100%" stopColor="#9AAEDB"/>
        </linearGradient>
      </defs>
      <circle cx="100" cy="108" r="46" fill="none" stroke="#7AC4F2" strokeWidth="1.5" strokeDasharray="3 5" opacity="0.5"/>
      <circle cx="100" cy="108" r="38" fill="none" stroke="#FFD93D" strokeWidth="1.5" strokeDasharray="3 4" opacity="0.6"/>
      <path d="M 118 80 Q 82 88 80 110 Q 82 132 118 140 Q 94 130 92 110 Q 94 90 118 80 Z" fill="url(#nr-moon)" stroke="#2A2540" strokeWidth="2.2" strokeLinejoin="round"/>
      <g>
        <circle cx="98" cy="118" r="2.2" fill="#FF7BAC"/>
        <line x1="100.2" y1="118" x2="100.2" y2="108" stroke="#FF7BAC" strokeWidth="1.5"/>
        <path d="M 100.2 108 Q 106 109 106 114" stroke="#FF7BAC" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      </g>
      <g>
        <circle cx="112" cy="106" r="2.2" fill="#4EEDB0"/>
        <line x1="114.2" y1="106" x2="114.2" y2="94" stroke="#4EEDB0" strokeWidth="1.5"/>
        <path d="M 114.2 94 Q 120 95 120 100" stroke="#4EEDB0" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      </g>
      <path d="M 60 76 L 62 82 L 68 84 L 62 86 L 60 92 L 58 86 L 52 84 L 58 82 Z" fill="#FFD93D" stroke="#9B6B45" strokeWidth="0.8"/>
      <path d="M 142 86 L 143.5 90 L 147.5 91 L 143.5 92 L 142 96 L 140.5 92 L 136.5 91 L 140.5 90 Z" fill="#fff"/>
      <Sparkle x={144} y={140} size={3} color="#FFD93D"/>
      <Sparkle x={56} y={140} size={2.5} color="#fff"/>
    </g>
  );
}

export function IconHomeHelper() {
  return (
    <g>
      <defs>
        <linearGradient id="hmh-h" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE89D"/>
          <stop offset="100%" stopColor="#E0B520"/>
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="62" rx="28" ry="6" fill="none" stroke="#FFD93D" strokeWidth="3" opacity="0.85"/>
      <ellipse cx="100" cy="62" rx="28" ry="6" fill="none" stroke="#fff" strokeWidth="1" opacity="0.7"/>
      <path d="M 60 100 L 100 70 L 140 100 Z" fill="#D44545" stroke="#2A2540" strokeWidth="2.2" strokeLinejoin="round"/>
      <path d="M 68 100 L 100 76 L 132 100" stroke="#9B2B0F" strokeWidth="1.5" fill="none"/>
      <rect x="118" y="76" width="10" height="14" fill="#9B2B0F" stroke="#2A2540" strokeWidth="1.5"/>
      <rect x="68" y="100" width="64" height="48" fill="url(#hmh-h)" stroke="#2A2540" strokeWidth="2.2"/>
      <rect x="90" y="118" width="20" height="30" rx="2" fill="#9B6B45" stroke="#2A2540" strokeWidth="1.8"/>
      <circle cx="106" cy="134" r="1.5" fill="#FFD93D"/>
      <rect x="74" y="110" width="12" height="12" fill="#7AC4F2" stroke="#2A2540" strokeWidth="1.5"/>
      <line x1="80" y1="110" x2="80" y2="122" stroke="#2A2540" strokeWidth="1"/>
      <line x1="74" y1="116" x2="86" y2="116" stroke="#2A2540" strokeWidth="1"/>
      <rect x="114" y="110" width="12" height="12" fill="#7AC4F2" stroke="#2A2540" strokeWidth="1.5"/>
      <line x1="120" y1="110" x2="120" y2="122" stroke="#2A2540" strokeWidth="1"/>
      <line x1="114" y1="116" x2="126" y2="116" stroke="#2A2540" strokeWidth="1"/>
      <path d="M 100 124 Q 96 120 93 124 Q 93 128 100 132 Q 107 128 107 124 Q 104 120 100 124 Z" fill="#FF7BAC" stroke="#2A2540" strokeWidth="1.2"/>
      <Sparkle x={56} y={140} size={2.5} color="#FFD93D"/>
      <Sparkle x={144} y={140} size={2.5} color="#fff"/>
    </g>
  );
}

export function IconRoutinePro() {
  return (
    <g>
      <defs>
        <linearGradient id="rp-scroll" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF6E5"/>
          <stop offset="100%" stopColor="#E5D8B5"/>
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="70" rx="40" ry="7" fill="#9B6B45" stroke="#2A2540" strokeWidth="2"/>
      <rect x="60" y="70" width="80" height="76" fill="url(#rp-scroll)" stroke="#2A2540" strokeWidth="2"/>
      <ellipse cx="100" cy="146" rx="40" ry="7" fill="#9B6B45" stroke="#2A2540" strokeWidth="2"/>
      {[0,1,2,3].map(i => {
        const colors = ['#FFD93D', '#4EEDB0', '#FF7BAC', '#7AC4F2'];
        return (
          <g key={i}>
            <circle cx="70" cy={86 + i*14} r="3" fill={colors[i]} stroke="#2A2540" strokeWidth="1"/>
            <path d={`M 78 ${86 + i*14} L 82 ${90 + i*14} L 90 ${82 + i*14}`} stroke="#3A8E3F" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            <rect x="96" y={84 + i*14} width="34" height="3" rx="1.5" fill="#9B6B45" opacity="0.6"/>
          </g>
        );
      })}
      <circle cx="124" cy="140" r="9" fill="#FF6B6B" stroke="#9B2B0F" strokeWidth="1.5"/>
      <path d="M 124 134 L 125 138 L 129 138 L 126 140 L 127 144 L 124 142 L 121 144 L 122 140 L 119 138 L 123 138 Z" fill="#FFD93D"/>
      <Sparkle x={62} y={62} size={3} color="#FFD93D"/>
      <Sparkle x={140} y={62} size={3} color="#fff"/>
    </g>
  );
}

export function IconReflectionGuide() {
  return (
    <g>
      <defs>
        <radialGradient id="rg-glow" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0%" stopColor="#FFF6D0"/>
          <stop offset="60%" stopColor="#FFD93D" stopOpacity="0.7"/>
          <stop offset="100%" stopColor="#FFD93D" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="100" cy="110" r="48" fill="url(#rg-glow)"/>
      <path d="M 86 70 Q 100 60 114 70" stroke="#9B6B45" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <rect x="92" y="72" width="16" height="8" rx="2" fill="#9B6B45" stroke="#2A2540" strokeWidth="1.5"/>
      <polygon points="86,80 114,80 118,84 82,84" fill="#9B6B45" stroke="#2A2540" strokeWidth="1.5"/>
      <rect x="76" y="84" width="48" height="56" rx="4" fill="#1a1b2e" stroke="#FFD93D" strokeWidth="2.2"/>
      <path d="M 82 90 L 82 134" stroke="#FFD93D" strokeWidth="1.5" opacity="0.6"/>
      <path d="M 118 90 L 118 134" stroke="#FFD93D" strokeWidth="1.5" opacity="0.6"/>
      <path d="M 100 96 L 105 110 L 120 112 L 108 122 L 112 138 L 100 130 L 88 138 L 92 122 L 80 112 L 95 110 Z" fill="#FFD93D" stroke="#9B6B45" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M 100 96 L 105 110 L 120 112 L 100 114 Z" fill="#FFF6D0" opacity="0.7"/>
      <polygon points="76,140 124,140 128,148 72,148" fill="#9B6B45" stroke="#2A2540" strokeWidth="1.5"/>
      <Sparkle x={60} y={90} size={3} color="#FFD93D"/>
      <Sparkle x={142} y={92} size={3} color="#fff"/>
      <Sparkle x={56} y={138} size={2.5} color="#FFD93D"/>
    </g>
  );
}

export function IconWritingWizard() {
  return (
    <g>
      <defs>
        <linearGradient id="ww-feather" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFB5D8"/>
          <stop offset="100%" stopColor="#A03868"/>
        </linearGradient>
      </defs>
      <path d="M 130 60 Q 96 80 78 116 Q 84 124 100 116 Q 122 100 130 60 Z" fill="url(#ww-feather)" stroke="#2A2540" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M 130 60 Q 110 88 90 110" stroke="#2A2540" strokeWidth="1.5" fill="none"/>
      {[0,1,2,3,4].map(i => (
        <path key={i} d={`M ${122 - i*8} ${68 + i*8} Q ${112 - i*8} ${74 + i*8} ${108 - i*8} ${76 + i*8}`} stroke="#FFB5D8" strokeWidth="0.8" fill="none" opacity="0.6"/>
      ))}
      <path d="M 78 116 L 70 132 L 80 124 Z" fill="#2A2540" stroke="#FFD93D" strokeWidth="1.5" strokeLinejoin="round"/>
      <line x1="74" y1="120" x2="80" y2="126" stroke="#FFD93D" strokeWidth="1"/>
      <path d="M 68 138 Q 82 134 96 144 Q 110 154 130 142" stroke="#7AC4F2" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.85"/>
      <path d="M 68 138 Q 82 134 96 144" stroke="#fff" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.6"/>
      <path d="M 142 102 L 144 110 L 152 112 L 144 114 L 142 122 L 140 114 L 132 112 L 140 110 Z" fill="#FFD93D" stroke="#9B6B45" strokeWidth="1"/>
      <path d="M 142 102 L 144 110 L 152 112 L 142 112 Z" fill="#FFF6D0" opacity="0.6"/>
      <Sparkle x={56} y={76} size={3} color="#fff"/>
      <Sparkle x={146} y={78} size={2.5} color="#FFD93D"/>
      <Sparkle x={146} y={138} size={3} color="#FFD93D"/>
    </g>
  );
}

export function IconRarePerfectRun() {
  return (
    <g>
      <defs>
        <linearGradient id="rpr-trail" x1="1" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#FFD93D"/>
          <stop offset="100%" stopColor="#FF6B6B" stopOpacity="0"/>
        </linearGradient>
        <radialGradient id="rpr-head" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#FFF6D0"/>
          <stop offset="100%" stopColor="#FF6B6B"/>
        </radialGradient>
      </defs>
      <path d="M 62 152 Q 80 132 100 116 Q 120 100 138 78" stroke="url(#rpr-trail)" strokeWidth="14" fill="none" strokeLinecap="round"/>
      <path d="M 62 152 Q 80 132 100 116 Q 120 100 138 78" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.55"/>
      {[0,1,2].map(i => {
        const x = 72 + i*22;
        const y = 144 - i*22;
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="5" fill="#4EEDB0" stroke="#2A2540" strokeWidth="1.2"/>
            <path d={`M ${x-3} ${y} L ${x-1} ${y+2} L ${x+3} ${y-3}`} stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </g>
        );
      })}
      <path d="M 138 78 L 144 64 L 150 78 L 164 80 L 150 84 L 144 98 L 138 84 L 124 80 Z" fill="url(#rpr-head)" stroke="#9B2B0F" strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="144" cy="78" r="4" fill="#FFF6D0"/>
      <circle cx="58" cy="76" r="13" fill="#1a1b2e" stroke="#FFD93D" strokeWidth="2"/>
      <text x="58" y="81" fontSize="13" fontWeight="900" textAnchor="middle" fill="#FFD93D" fontFamily="Plus Jakarta Sans, system-ui, sans-serif">30</text>
      <Sparkle x={142} y={140} size={2.5} color="#fff"/>
    </g>
  );
}

export function Icon100DayBuilder() {
  return (
    <g>
      <defs>
        <linearGradient id="d100-w" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE89D"/>
          <stop offset="100%" stopColor="#9B6B45"/>
        </linearGradient>
      </defs>
      <rect x="60" y="106" width="80" height="44" fill="url(#d100-w)" stroke="#2A2540" strokeWidth="2"/>
      <rect x="60" y="100" width="10" height="10" fill="url(#d100-w)" stroke="#2A2540" strokeWidth="1.8"/>
      <rect x="78" y="100" width="10" height="10" fill="url(#d100-w)" stroke="#2A2540" strokeWidth="1.8"/>
      <rect x="96" y="100" width="10" height="10" fill="url(#d100-w)" stroke="#2A2540" strokeWidth="1.8"/>
      <rect x="114" y="100" width="10" height="10" fill="url(#d100-w)" stroke="#2A2540" strokeWidth="1.8"/>
      <rect x="130" y="100" width="10" height="10" fill="url(#d100-w)" stroke="#2A2540" strokeWidth="1.8"/>
      {[0,1,2,3].map(r => (
        <line key={r} x1="62" y1={114 + r*9} x2="138" y2={114 + r*9} stroke="#9B6B45" strokeWidth="0.6" opacity="0.6"/>
      ))}
      <line x1="80" y1="110" x2="80" y2="150" stroke="#9B6B45" strokeWidth="0.6" opacity="0.6"/>
      <line x1="120" y1="110" x2="120" y2="150" stroke="#9B6B45" strokeWidth="0.6" opacity="0.6"/>
      <path d="M 88 150 L 88 132 Q 88 122 100 122 Q 112 122 112 132 L 112 150 Z" fill="#5A3A1F" stroke="#2A2540" strokeWidth="1.8"/>
      <path d="M 64 78 L 136 78 L 130 96 L 70 96 Z" fill="#FF6B6B" stroke="#2A2540" strokeWidth="2" strokeLinejoin="round"/>
      <text x="100" y="92" fontSize="14" fontWeight="900" textAnchor="middle" fill="#FFD93D" fontFamily="Plus Jakarta Sans, system-ui, sans-serif">100</text>
      <line x1="100" y1="78" x2="100" y2="60" stroke="#2A2540" strokeWidth="2"/>
      <path d="M 100 60 L 118 64 L 100 70 Z" fill="#FFD93D" stroke="#2A2540" strokeWidth="1.5" strokeLinejoin="round"/>
      <Sparkle x={62} y={66} size={2.5} color="#FFD93D"/>
      <Sparkle x={140} y={66} size={2.5} color="#fff"/>
    </g>
  );
}

export function Icon150DayBuilder() {
  return (
    <g>
      <defs>
        <linearGradient id="d150-t" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE89D"/>
          <stop offset="100%" stopColor="#9B6B45"/>
        </linearGradient>
      </defs>
      <rect x="76" y="84" width="48" height="64" fill="url(#d150-t)" stroke="#2A2540" strokeWidth="2"/>
      <rect x="76" y="78" width="8" height="10" fill="url(#d150-t)" stroke="#2A2540" strokeWidth="1.6"/>
      <rect x="88" y="78" width="8" height="10" fill="url(#d150-t)" stroke="#2A2540" strokeWidth="1.6"/>
      <rect x="100" y="78" width="8" height="10" fill="url(#d150-t)" stroke="#2A2540" strokeWidth="1.6"/>
      <rect x="112" y="78" width="8" height="10" fill="url(#d150-t)" stroke="#2A2540" strokeWidth="1.6"/>
      {[0,1,2,3,4,5].map(r => (
        <line key={r} x1="78" y1={92 + r*10} x2="122" y2={92 + r*10} stroke="#9B6B45" strokeWidth="0.6" opacity="0.55"/>
      ))}
      <rect x="92" y="102" width="16" height="22" rx="8" fill="#7AC4F2" stroke="#2A2540" strokeWidth="1.8"/>
      <line x1="100" y1="102" x2="100" y2="124" stroke="#2A2540" strokeWidth="1"/>
      <line x1="92" y1="113" x2="108" y2="113" stroke="#2A2540" strokeWidth="1"/>
      <path d="M 90 148 L 90 134 Q 90 128 100 128 Q 110 128 110 134 L 110 148 Z" fill="#5A3A1F" stroke="#2A2540" strokeWidth="1.5"/>
      <polygon points="76,78 100,58 124,78" fill="#D44545" stroke="#2A2540" strokeWidth="2" strokeLinejoin="round"/>
      <line x1="100" y1="58" x2="100" y2="44" stroke="#2A2540" strokeWidth="2"/>
      <path d="M 100 44 L 110 48 L 100 52 Z" fill="#FFD93D" stroke="#2A2540" strokeWidth="1.5" strokeLinejoin="round"/>
      <rect x="78" y="140" width="44" height="14" rx="3" fill="#1a1b2e" stroke="#FFD93D" strokeWidth="1.8"/>
      <text x="100" y="151" fontSize="11" fontWeight="900" textAnchor="middle" fill="#FFD93D" fontFamily="Plus Jakarta Sans, system-ui, sans-serif">150</text>
      <Sparkle x={58} y={64} size={3} color="#FFD93D"/>
      <Sparkle x={144} y={66} size={3} color="#fff"/>
    </g>
  );
}

export function Icon200DayBuilder() {
  return (
    <g>
      <defs>
        <linearGradient id="d200-w" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE89D"/>
          <stop offset="100%" stopColor="#9B6B45"/>
        </linearGradient>
      </defs>
      <rect x="56" y="84" width="20" height="62" fill="url(#d200-w)" stroke="#2A2540" strokeWidth="2"/>
      <rect x="56" y="78" width="6" height="8" fill="url(#d200-w)" stroke="#2A2540" strokeWidth="1.5"/>
      <rect x="66" y="78" width="6" height="8" fill="url(#d200-w)" stroke="#2A2540" strokeWidth="1.5"/>
      <polygon points="54,78 76,78 66,68" fill="#D44545" stroke="#2A2540" strokeWidth="1.5" strokeLinejoin="round"/>
      <rect x="124" y="84" width="20" height="62" fill="url(#d200-w)" stroke="#2A2540" strokeWidth="2"/>
      <rect x="124" y="78" width="6" height="8" fill="url(#d200-w)" stroke="#2A2540" strokeWidth="1.5"/>
      <rect x="134" y="78" width="6" height="8" fill="url(#d200-w)" stroke="#2A2540" strokeWidth="1.5"/>
      <polygon points="122,78 144,78 134,68" fill="#D44545" stroke="#2A2540" strokeWidth="1.5" strokeLinejoin="round"/>
      <rect x="76" y="98" width="48" height="48" fill="url(#d200-w)" stroke="#2A2540" strokeWidth="2"/>
      {[0,1,2,3].map(i => (
        <rect key={i} x={76 + i*12} y="92" width="8" height="8" fill="url(#d200-w)" stroke="#2A2540" strokeWidth="1.5"/>
      ))}
      <path d="M 90 146 L 90 122 Q 90 112 100 112 Q 110 112 110 122 L 110 146 Z" fill="#5A3A1F" stroke="#2A2540" strokeWidth="1.8"/>
      <line x1="100" y1="112" x2="100" y2="146" stroke="#FFD93D" strokeWidth="1"/>
      {[0,1,2,3].map(r => (
        <line key={r} x1="78" y1={106 + r*10} x2="122" y2={106 + r*10} stroke="#9B6B45" strokeWidth="0.5" opacity="0.5"/>
      ))}
      <path d="M 60 116 L 140 116 L 134 130 L 66 130 Z" fill="#FF6B6B" stroke="#2A2540" strokeWidth="1.8" strokeLinejoin="round"/>
      <text x="100" y="128" fontSize="13" fontWeight="900" textAnchor="middle" fill="#FFD93D" fontFamily="Plus Jakarta Sans, system-ui, sans-serif">200</text>
      <Sparkle x={56} y={64} size={2.5} color="#FFD93D"/>
      <Sparkle x={144} y={62} size={2.5} color="#fff"/>
    </g>
  );
}

export function IconReadingLegend() {
  return (
    <g>
      <defs>
        <linearGradient id="rl-cover" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7AC4F2"/>
          <stop offset="100%" stopColor="#2D5BC2"/>
        </linearGradient>
        <radialGradient id="rl-glow" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0%" stopColor="#FFD93D" stopOpacity="0.7"/>
          <stop offset="100%" stopColor="#FFD93D" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="100" cy="112" r="40" fill="url(#rl-glow)"/>
      <path d="M 56 76 L 56 144 L 144 144 L 144 76 L 100 84 Z" fill="url(#rl-cover)" stroke="#2A2540" strokeWidth="2.2" strokeLinejoin="round"/>
      <path d="M 60 80 L 60 140 Q 78 134 100 140 L 100 84 Q 78 80 60 80 Z" fill="#FFF6E5" stroke="#2A2540" strokeWidth="1.8"/>
      <path d="M 140 80 L 140 140 Q 122 134 100 140 L 100 84 Q 122 80 140 80 Z" fill="#FFF6E5" stroke="#2A2540" strokeWidth="1.8"/>
      <circle cx="100" cy="110" r="14" fill="#1a1b2e" stroke="#FFD93D" strokeWidth="2"/>
      <path d="M 100 100 L 105 110 L 100 120 L 95 110 Z" fill="#FFD93D" stroke="#9B6B45" strokeWidth="1"/>
      <circle cx="100" cy="110" r="3" fill="#FF7BAC"/>
      <line x1="66" y1="92" x2="92" y2="92" stroke="#9B6B45" strokeWidth="0.8" opacity="0.55"/>
      <line x1="66" y1="100" x2="88" y2="100" stroke="#9B6B45" strokeWidth="0.8" opacity="0.55"/>
      <line x1="108" y1="92" x2="134" y2="92" stroke="#9B6B45" strokeWidth="0.8" opacity="0.55"/>
      <line x1="112" y1="100" x2="134" y2="100" stroke="#9B6B45" strokeWidth="0.8" opacity="0.55"/>
      <line x1="66" y1="128" x2="92" y2="128" stroke="#9B6B45" strokeWidth="0.8" opacity="0.55"/>
      <line x1="108" y1="128" x2="134" y2="128" stroke="#9B6B45" strokeWidth="0.8" opacity="0.55"/>
      <path d="M 56 64 L 58 70 L 64 72 L 58 74 L 56 80 L 54 74 L 48 72 L 54 70 Z" fill="#FFD93D" stroke="#9B6B45" strokeWidth="0.8"/>
      <Sparkle x={144} y={68} size={3} color="#fff"/>
      <Sparkle x={146} y={150} size={2.5} color="#FFD93D"/>
    </g>
  );
}

export function IconEnergyChampion() {
  return (
    <g>
      <defs>
        <linearGradient id="ec-bolt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF6D0"/>
          <stop offset="50%" stopColor="#FFD93D"/>
          <stop offset="100%" stopColor="#FF6B3D"/>
        </linearGradient>
      </defs>
      {[0,45,90,135,180,225,270,315].map((deg,i) => (
        <g key={i} transform={`rotate(${deg} 100 110)`}>
          <path d="M 100 70 L 96 84 L 100 80 L 104 84 Z" fill="#FFD93D" opacity="0.55"/>
        </g>
      ))}
      <path d="M 102 64 L 78 110 L 96 110 L 88 156 L 124 100 L 106 100 L 116 64 Z" fill="url(#ec-bolt)" stroke="#9B2B0F" strokeWidth="2.2" strokeLinejoin="round"/>
      <path d="M 102 64 L 80 108 L 96 108 L 88 152" stroke="#FFF6D0" strokeWidth="1.5" fill="none" opacity="0.65"/>
      <circle cx="100" cy="110" r="3" fill="#FF6B6B" stroke="#2A2540" strokeWidth="1"/>
      <Sparkle x={62} y={70} size={3.5} color="#FFD93D"/>
      <Sparkle x={140} y={74} size={3} color="#fff"/>
      <Sparkle x={64} y={146} size={3} color="#FFD93D"/>
      <Sparkle x={144} y={148} size={3} color="#fff"/>
    </g>
  );
}
