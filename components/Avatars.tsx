/**
 * Fambit kid avatars — 4 original collectible creature companions with
 * hot-swappable cosmetics.
 *
 * Layered groups (consistent across all characters):
 *   #bg          background gradient ring
 *   #shadow      contact shadow under figure
 *   #cape        optional cape (drawn behind body)
 *   #wings       optional wings (drawn behind body)
 *   #creature-*  character-defining creature body
 *   #extras      bow_tie / star_pin / crown / flowers / halo
 *   #sparkles    optional twinkles
 */

import { AvatarConfig, AvatarExtra, AvatarKind, BG_OPTIONS, TINT_OPTIONS, bgById, tintById } from '@/lib/avatarConfig';
import { useId } from 'react';

type AvatarProps = {
  config: AvatarConfig;
  size?: number;
  className?: string;
  showBg?: boolean;
  title?: string;
};

const COLORS = {
  shadow: '#1F1B2E',
  outline: '#3A2A2A',
  white: '#FFFFFF',
  shine: '#FFFDF7',
  cheek: '#FF9DB1',
  starYellow: '#FFE066',
  starYellowShade: '#F5B82B',
  bowLavender: '#C8B6FF',
  bowLavenderShade: '#9C84F0',
  pinkInner: '#FF9CC0',
  cream: '#FFF1DD',
};

/* ───────────────────────────── Background ─────────────────────────────── */
function Background({ id, gradId }: { id: string; gradId: string }) {
  const bg = bgById(id);
  return (
    <g id="bg">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bg.from} />
          <stop offset="100%" stopColor={bg.to} />
        </linearGradient>
        <radialGradient id={`${gradId}-spot`} cx="0.34" cy="0.18" r="0.82">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.46" />
          <stop offset="58%" stopColor="#FFFFFF" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.16" />
        </radialGradient>
        <linearGradient id={`${gradId}-floor`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="220" height="240" rx="32" fill={`url(#${gradId})`} />
      <rect x="0" y="0" width="220" height="240" rx="32" fill={`url(#${gradId}-spot)`} />
      <ellipse cx="110" cy="220" rx="82" ry="13" fill={`url(#${gradId}-floor)`} opacity="0.55" />
      <circle cx="34" cy="34" r="34" fill="#FFFFFF" opacity="0.13" />
      <circle cx="190" cy="72" r="22" fill="#FFFFFF" opacity="0.11" />
      <path d="M22 188 C58 168 82 172 118 186 C154 200 174 196 200 180" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" opacity="0.22" />
    </g>
  );
}

function Shadow() {
  return <ellipse cx="110" cy="226" rx="62" ry="8" fill={COLORS.shadow} opacity="0.24" />;
}

function lighten(hex: string): string {
  const c = hex.replace('#', '');
  const r = Math.min(255, parseInt(c.slice(0, 2), 16) + 30);
  const g = Math.min(255, parseInt(c.slice(2, 4), 16) + 30);
  const b = Math.min(255, parseInt(c.slice(4, 6), 16) + 30);
  return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
}

function darken(hex: string): string {
  const c = hex.replace('#', '');
  const r = Math.max(0, parseInt(c.slice(0, 2), 16) - 44);
  const g = Math.max(0, parseInt(c.slice(2, 4), 16) - 44);
  const b = Math.max(0, parseInt(c.slice(4, 6), 16) - 44);
  return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
}

/* ────────────────────────────── Extras ────────────────────────────────── */

function Extras({ extras, tintColor, idSuffix }: { extras: AvatarExtra[]; tintColor: string; idSuffix: string }) {
  if (extras.length === 0) return null;
  const has = (id: AvatarExtra) => extras.includes(id);
  return (
    <g id="extras">
      {has('wings') && (
        <g id="wings" opacity="0.95">
          <path d="M40 188 Q-4 168 16 132 Q34 162 56 178 Z" fill={COLORS.white} stroke="#D9DEEA" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M180 188 Q224 168 204 132 Q186 162 164 178 Z" fill={COLORS.white} stroke="#D9DEEA" strokeWidth="1.5" strokeLinejoin="round" />
        </g>
      )}
      {has('cape') && (
        <g id="cape">
          <path
            d="M64 184 Q40 226 56 232 L164 232 Q180 226 156 184 Z"
            fill={tintColor}
            stroke={COLORS.outline}
            strokeWidth="0.8"
            opacity="0.9"
          />
          <path d="M82 200 L92 226" stroke={COLORS.outline} strokeWidth="0.8" opacity="0.4" />
          <path d="M138 200 L128 226" stroke={COLORS.outline} strokeWidth="0.8" opacity="0.4" />
        </g>
      )}
      {has('halo') && (
        <g id="halo">
          <ellipse cx="110" cy="40" rx="42" ry="9" fill="none" stroke={COLORS.starYellow} strokeWidth="4" opacity="0.95" />
          <ellipse cx="110" cy="40" rx="42" ry="9" fill="none" stroke={COLORS.starYellowShade} strokeWidth="1.5" opacity="0.6" />
        </g>
      )}
      {has('crown') && (
        <g id="crown">
          <path d="M70 64 L82 86 L96 70 L110 90 L124 70 L138 86 L150 64 L150 92 L70 92 Z" fill={COLORS.starYellow} stroke={COLORS.starYellowShade} strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="84" cy="72" r="3" fill="#E26C8A" />
          <circle cx="110" cy="78" r="3.2" fill="#7DCBEA" />
          <circle cx="136" cy="72" r="3" fill="#A8E6A1" />
        </g>
      )}
      {has('flowers') && (
        <g id="flowers">
          <Flower cx={70} cy={70} color="#FF9DB1" />
          <Flower cx={92} cy={56} color="#FFE066" />
          <Flower cx={120} cy={54} color="#C8B6FF" />
          <Flower cx={148} cy={66} color="#A8E6A1" />
        </g>
      )}
      {has('star_pin') && (
        <g id="star_pin" transform="translate(60 88) rotate(-18)">
          <path
            d="M0 -14 L4 -4 L14 -4 L6 3 L9 13 L0 7 L-9 13 L-6 3 L-14 -4 L-4 -4 Z"
            fill={COLORS.starYellow}
            stroke={COLORS.starYellowShade}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="-2" cy="-2" r="2.2" fill={COLORS.white} opacity="0.85" />
        </g>
      )}
      {has('bow_tie') && (
        <g id="bow_tie">
          <path d="M88 188 Q76 184 74 196 Q82 202 96 198 Z" fill={COLORS.bowLavender} stroke={COLORS.bowLavenderShade} strokeWidth="1" />
          <path d="M132 188 Q144 184 146 196 Q138 202 124 198 Z" fill={COLORS.bowLavender} stroke={COLORS.bowLavenderShade} strokeWidth="1" />
          <circle cx="110" cy="194" r="6" fill={COLORS.bowLavenderShade} />
          <circle cx="108.5" cy="192.5" r="2" fill={COLORS.white} opacity="0.85" />
        </g>
      )}
      {has('sparkles') && (
        <g id="sparkles" opacity="0.95">
          <Spark cx={32} cy={70} />
          <Spark cx={186} cy={88} small />
          <Spark cx={28} cy={178} small />
          <Spark cx={196} cy={172} />
        </g>
      )}
      {/* keep idSuffix referenced so the React compiler doesn't strip it */}
      <g data-id-suffix={idSuffix} />
    </g>
  );
}

function Flower({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <circle cx="0" cy="-6" r="5" fill={color} />
      <circle cx="6" cy="-2" r="5" fill={color} />
      <circle cx="-6" cy="-2" r="5" fill={color} />
      <circle cx="3" cy="5" r="5" fill={color} />
      <circle cx="-3" cy="5" r="5" fill={color} />
      <circle cx="0" cy="0" r="2.6" fill="#FFE066" />
    </g>
  );
}

function Spark({ cx, cy, small }: { cx: number; cy: number; small?: boolean }) {
  const s = small ? 0.7 : 1;
  return (
    <path
      d={`M${cx} ${cy - 6 * s} l${1.6 * s} ${4.6 * s} l${4.6 * s} ${1.6 * s} l${-4.6 * s} ${1.6 * s} l${-1.6 * s} ${4.6 * s} l${-1.6 * s} ${-4.6 * s} l${-4.6 * s} ${-1.6 * s} l${4.6 * s} ${-1.6 * s} z`}
      fill="#FFFFFF"
    />
  );
}

/* ───────────────────────── Creature Companions ─────────────────────────── */

function CreatureDefs({ tintColor, tintShade, idSuffix }: { tintColor: string; tintShade: string; idSuffix: string }) {
  return (
    <defs>
      <radialGradient id={`creature-${idSuffix}`} cx="0.36" cy="0.24" r="0.86">
        <stop offset="0%" stopColor={COLORS.shine} />
        <stop offset="18%" stopColor={lighten(tintColor)} />
        <stop offset="66%" stopColor={tintColor} />
        <stop offset="100%" stopColor={tintShade} />
      </radialGradient>
      <radialGradient id={`belly-${idSuffix}`} cx="0.4" cy="0.28" r="0.8">
        <stop offset="0%" stopColor="#FFF9E8" />
        <stop offset="100%" stopColor="#FFE3B4" />
      </radialGradient>
      <radialGradient id={`muzzle-${idSuffix}`} cx="0.38" cy="0.22" r="0.86">
        <stop offset="0%" stopColor="#FFFDF2" />
        <stop offset="100%" stopColor="#FFDDBB" />
      </radialGradient>
      <radialGradient id={`creature-eye-${idSuffix}`} cx="0.34" cy="0.3" r="0.78">
        <stop offset="0%" stopColor="#6F564C" />
        <stop offset="55%" stopColor="#211116" />
        <stop offset="100%" stopColor="#080406" />
      </radialGradient>
      <linearGradient id={`rim-${idSuffix}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
        <stop offset="48%" stopColor="#FFFFFF" stopOpacity="0.12" />
        <stop offset="100%" stopColor={darken(tintShade)} stopOpacity="0.28" />
      </linearGradient>
    </defs>
  );
}

function CreatureEye({ cx, cy, scale = 1, idSuffix }: { cx: number; cy: number; scale?: number; idSuffix: string }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${scale})`}>
      <ellipse cx="0" cy="2" rx="13.5" ry="16" fill="#180B11" opacity="0.18" />
      <ellipse cx="0" cy="0" rx="13" ry="16" fill={COLORS.white} />
      <ellipse cx="0" cy="1" rx="9.8" ry="12.2" fill={`url(#creature-eye-${idSuffix})`} />
      <circle cx="-3.8" cy="-5.1" r="3.8" fill={COLORS.white} />
      <circle cx="3.9" cy="5.4" r="1.6" fill={COLORS.white} opacity="0.86" />
    </g>
  );
}

function Paw({ cx, cy, color, shade, flip }: { cx: number; cy: number; color: string; shade: string; flip?: boolean }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${flip ? -1 : 1} 1)`}>
      <path d="M-18 2 C-18 -12 -6 -19 8 -14 C20 -10 22 4 12 13 C0 23 -18 17 -18 2 Z" fill={color} stroke={shade} strokeWidth="1.4" />
      <circle cx="-7" cy="11" r="2.4" fill={shade} opacity="0.36" />
      <circle cx="1" cy="13" r="2.4" fill={shade} opacity="0.36" />
      <circle cx="9" cy="10" r="2.4" fill={shade} opacity="0.36" />
      <path d="M-10 -7 C-4 -13 8 -12 14 -4" stroke={COLORS.white} strokeWidth="3" strokeLinecap="round" opacity="0.18" fill="none" />
    </g>
  );
}

function DinoCreature({ tintColor, tintShade, idSuffix }: { tintColor: string; tintShade: string; idSuffix: string }) {
  return (
    <g id="creature-dino">
      <CreatureDefs tintColor={tintColor} tintShade={tintShade} idSuffix={idSuffix} />
      <path d="M52 177 C22 171 14 143 36 122 C54 139 64 157 66 177 Z" fill={`url(#creature-${idSuffix})`} stroke={tintShade} strokeWidth="2.2" />
      <path d="M146 177 C184 160 195 124 174 100 C159 124 151 150 146 177 Z" fill={`url(#creature-${idSuffix})`} stroke={tintShade} strokeWidth="2.2" />
      <ellipse cx="110" cy="164" rx="54" ry="56" fill={`url(#creature-${idSuffix})`} stroke={tintShade} strokeWidth="2.4" />
      <ellipse cx="110" cy="178" rx="31" ry="34" fill={`url(#belly-${idSuffix})`} opacity="0.95" />
      <ellipse cx="110" cy="105" rx="62" ry="57" fill={`url(#creature-${idSuffix})`} stroke={tintShade} strokeWidth="2.4" />
      <path d="M78 50 L90 74 L104 44 L116 75 L132 47 L141 80" fill={COLORS.starYellow} stroke={tintShade} strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M68 80 C86 55 124 48 150 69" stroke={COLORS.white} strokeWidth="7" strokeLinecap="round" opacity="0.2" fill="none" />
      <CreatureEye cx={88} cy={103} idSuffix={idSuffix} />
      <CreatureEye cx={132} cy={103} idSuffix={idSuffix} />
      <ellipse cx="110" cy="128" rx="30" ry="18" fill={`url(#muzzle-${idSuffix})`} stroke="#E9B481" strokeWidth="1.2" />
      <ellipse cx="99" cy="122" rx="3" ry="2.2" fill={COLORS.outline} opacity="0.75" />
      <ellipse cx="121" cy="122" rx="3" ry="2.2" fill={COLORS.outline} opacity="0.75" />
      <path d="M97 136 Q110 145 123 136" stroke="#A94350" strokeWidth="3" strokeLinecap="round" fill="none" />
      <polygon points="95,136 101,145 107,137" fill={COLORS.white} />
      <polygon points="113,137 119,145 125,136" fill={COLORS.white} />
      <Paw cx={75} cy={207} color={tintColor} shade={tintShade} />
      <Paw cx={145} cy={207} color={tintColor} shade={tintShade} flip />
      <path d="M153 113 C167 118 179 129 185 146" stroke={`url(#rim-${idSuffix})`} strokeWidth="6" strokeLinecap="round" fill="none" />
    </g>
  );
}

function StarCreature({ tintColor, tintShade, idSuffix }: { tintColor: string; tintShade: string; idSuffix: string }) {
  return (
    <g id="creature-star">
      <CreatureDefs tintColor={tintColor} tintShade={tintShade} idSuffix={idSuffix} />
      <path d="M62 152 C30 142 25 110 45 87 C58 105 67 125 70 150 Z" fill={lighten(tintColor)} stroke={tintShade} strokeWidth="2" />
      <path d="M158 152 C190 142 195 110 175 87 C162 105 153 125 150 150 Z" fill={lighten(tintColor)} stroke={tintShade} strokeWidth="2" />
      <ellipse cx="110" cy="160" rx="49" ry="58" fill={`url(#creature-${idSuffix})`} stroke={tintShade} strokeWidth="2.4" />
      <ellipse cx="110" cy="181" rx="28" ry="31" fill={`url(#belly-${idSuffix})`} opacity="0.86" />
      <path d="M75 78 C67 45 89 31 110 54 C131 31 153 45 145 78 C171 87 173 118 151 139 C132 157 88 157 69 139 C47 118 49 87 75 78 Z" fill={`url(#creature-${idSuffix})`} stroke={tintShade} strokeWidth="2.5" />
      <path d="M110 54 L118 31 L126 56" fill="none" stroke={tintShade} strokeWidth="3" strokeLinecap="round" />
      <circle cx="126" cy="54" r="8" fill={COLORS.starYellow} stroke={COLORS.starYellowShade} strokeWidth="1.4" />
      <path d="M71 83 C88 58 122 53 146 73" stroke={COLORS.white} strokeWidth="7" strokeLinecap="round" opacity="0.22" fill="none" />
      <CreatureEye cx={88} cy={108} idSuffix={idSuffix} />
      <CreatureEye cx={132} cy={108} idSuffix={idSuffix} />
      <path d="M100 132 Q110 140 120 132" stroke="#A94350" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="73" cy="128" r="7" fill={COLORS.cheek} opacity="0.7" />
      <circle cx="147" cy="128" r="7" fill={COLORS.cheek} opacity="0.7" />
      <path d="M159 174 C190 168 202 188 192 208 C174 205 160 194 153 180 Z" fill={`url(#creature-${idSuffix})`} stroke={tintShade} strokeWidth="2" />
      <Paw cx={75} cy={207} color={lighten(tintColor)} shade={tintShade} />
      <Paw cx={145} cy={207} color={lighten(tintColor)} shade={tintShade} flip />
      <Spark cx={51} cy={64} small />
      <Spark cx={171} cy={62} />
    </g>
  );
}

function CatCreature({ tintColor, tintShade, idSuffix }: { tintColor: string; tintShade: string; idSuffix: string }) {
  return (
    <g id="creature-cat">
      <CreatureDefs tintColor={tintColor} tintShade={tintShade} idSuffix={idSuffix} />
      <path d="M151 160 C192 157 203 191 177 211 C162 202 150 186 146 166 Z" fill={`url(#creature-${idSuffix})`} stroke={tintShade} strokeWidth="2.2" />
      <ellipse cx="110" cy="166" rx="50" ry="55" fill={`url(#creature-${idSuffix})`} stroke={tintShade} strokeWidth="2.4" />
      <ellipse cx="110" cy="184" rx="27" ry="29" fill={`url(#belly-${idSuffix})`} opacity="0.86" />
      <path d="M66 91 L54 38 L96 69 Z" fill={`url(#creature-${idSuffix})`} stroke={tintShade} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M154 91 L166 38 L124 69 Z" fill={`url(#creature-${idSuffix})`} stroke={tintShade} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M64 78 L58 53 L82 70 Z" fill={COLORS.pinkInner} opacity="0.84" />
      <path d="M156 78 L162 53 L138 70 Z" fill={COLORS.pinkInner} opacity="0.84" />
      <ellipse cx="110" cy="106" rx="58" ry="55" fill={`url(#creature-${idSuffix})`} stroke={tintShade} strokeWidth="2.4" />
      <path d="M68 85 C91 62 128 59 153 82" stroke={COLORS.white} strokeWidth="7" strokeLinecap="round" opacity="0.22" fill="none" />
      <CreatureEye cx={88} cy={110} idSuffix={idSuffix} />
      <CreatureEye cx={132} cy={110} idSuffix={idSuffix} />
      <ellipse cx="110" cy="132" rx="25" ry="17" fill={`url(#muzzle-${idSuffix})`} stroke="#E9B481" strokeWidth="1.2" />
      <path d="M105 125 L110 130 L115 125" fill={COLORS.outline} opacity="0.78" />
      <path d="M110 130 Q104 137 98 133" stroke="#A94350" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d="M110 130 Q116 137 122 133" stroke="#A94350" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d="M77 129 L51 123 M78 137 L53 139 M143 129 L169 123 M142 137 L167 139" stroke={darken(tintShade)} strokeWidth="2" strokeLinecap="round" opacity="0.65" />
      <Paw cx={76} cy={207} color={lighten(tintColor)} shade={tintShade} />
      <Paw cx={144} cy={207} color={lighten(tintColor)} shade={tintShade} flip />
    </g>
  );
}

function PuppyCreature({ tintColor, tintShade, idSuffix }: { tintColor: string; tintShade: string; idSuffix: string }) {
  return (
    <g id="creature-puppy">
      <CreatureDefs tintColor={tintColor} tintShade={tintShade} idSuffix={idSuffix} />
      <ellipse cx="110" cy="166" rx="52" ry="55" fill={`url(#creature-${idSuffix})`} stroke={tintShade} strokeWidth="2.4" />
      <ellipse cx="110" cy="184" rx="29" ry="30" fill={`url(#belly-${idSuffix})`} opacity="0.88" />
      <path d="M65 82 C34 84 24 118 42 150 C64 145 76 124 76 95 Z" fill={`url(#creature-${idSuffix})`} stroke={tintShade} strokeWidth="2.3" />
      <path d="M155 82 C186 84 196 118 178 150 C156 145 144 124 144 95 Z" fill={`url(#creature-${idSuffix})`} stroke={tintShade} strokeWidth="2.3" />
      <ellipse cx="110" cy="105" rx="59" ry="54" fill={`url(#creature-${idSuffix})`} stroke={tintShade} strokeWidth="2.4" />
      <path d="M72 85 C94 62 130 61 151 84" stroke={COLORS.white} strokeWidth="7" strokeLinecap="round" opacity="0.22" fill="none" />
      <path d="M88 67 C101 55 119 56 132 69 C122 77 99 77 88 67 Z" fill={COLORS.cream} opacity="0.62" />
      <CreatureEye cx={88} cy={108} idSuffix={idSuffix} />
      <CreatureEye cx={132} cy={108} idSuffix={idSuffix} />
      <ellipse cx="110" cy="132" rx="29" ry="19" fill={`url(#muzzle-${idSuffix})`} stroke="#E9B481" strokeWidth="1.2" />
      <ellipse cx="110" cy="124" rx="7" ry="5" fill={COLORS.outline} />
      <circle cx="107.5" cy="122" r="1.8" fill={COLORS.white} opacity="0.72" />
      <path d="M110 130 Q103 139 96 134" stroke="#A94350" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M110 130 Q117 139 124 134" stroke="#A94350" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M113 137 Q112 148 121 146" stroke="#FF6F91" strokeWidth="4" strokeLinecap="round" fill="none" />
      <Paw cx={76} cy={207} color={lighten(tintColor)} shade={tintShade} />
      <Paw cx={144} cy={207} color={lighten(tintColor)} shade={tintShade} flip />
    </g>
  );
}

function CreatureFigure({ kind, tintColor, tintShade, idSuffix }: { kind: AvatarKind; tintColor: string; tintShade: string; idSuffix: string }) {
  if (kind === 'dino') return <DinoCreature tintColor={tintColor} tintShade={tintShade} idSuffix={idSuffix} />;
  if (kind === 'spaceman') return <StarCreature tintColor={tintColor} tintShade={tintShade} idSuffix={idSuffix} />;
  if (kind === 'kitty') return <CatCreature tintColor={tintColor} tintShade={tintShade} idSuffix={idSuffix} />;
  return <PuppyCreature tintColor={tintColor} tintShade={tintShade} idSuffix={idSuffix} />;
}

/* ───────────────────────── Composed Avatar ───────────────────────────── */

export function Avatar({ config, size = 200, className, showBg = true, title }: AvatarProps) {
  const tint = tintById(config.tint);
  const uniqueId = useId().replace(/:/g, '');
  const idSuffix = `${uniqueId}-${config.kind}-${config.tint}-${config.bg}`;
  const ariaTitle = title ?? `${config.kind} avatar`;
  const figureFilterId = `figure-shadow-${idSuffix}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 220 240"
      width={size}
      height={size}
      role="img"
      aria-label={ariaTitle}
      className={className}
    >
      <title>{ariaTitle}</title>
      <defs>
        <filter id={figureFilterId} x="-20%" y="-18%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="3.2" floodColor="#1F1B2E" floodOpacity="0.24" />
        </filter>
      </defs>

      {showBg && <Background id={config.bg} gradId={`bg-${idSuffix}`} />}

      <Shadow />

      {config.extras.includes('cape') && <Extras extras={['cape']} tintColor={tint.color} idSuffix={`cape-${idSuffix}`} />}
      {config.extras.includes('wings') && <Extras extras={['wings']} tintColor={tint.color} idSuffix={`wings-${idSuffix}`} />}

      <g filter={`url(#${figureFilterId})`}>
        <CreatureFigure
          kind={config.kind}
          tintColor={tint.color}
          tintShade={tint.shade}
          idSuffix={idSuffix}
        />
      </g>

      <Extras
        extras={config.extras.filter(e => e !== 'cape' && e !== 'wings')}
        tintColor={tint.color}
        idSuffix={`top-${idSuffix}`}
      />
    </svg>
  );
}

/* Convenience preview gallery for development. */
export function AvatarGallery() {
  const samples: AvatarKind[] = ['dino', 'spaceman', 'kitty', 'puppy'];
  return (
    <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
      {samples.map(kind => (
        <Avatar
          key={kind}
          size={180}
          config={{
            kind,
            tint: kind === 'kitty' ? 'pink' : kind === 'spaceman' ? 'sky' : kind === 'puppy' ? 'sun' : 'mint',
            bg: 'sunset',
            extras: ['sparkles'],
            owned: ['sparkles'],
          }}
        />
      ))}
    </div>
  );
}

/* Thumbnail variant — square, no background, used for buttons/lists. */
export function AvatarThumb({ config, size = 36 }: { config: AvatarConfig; size?: number }) {
  return <Avatar config={config} size={size} showBg={false} />;
}

/** Re-exports used by the studio modal. */
export { TINT_OPTIONS, BG_OPTIONS };
