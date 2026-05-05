/**
 * Fambit kid avatars — 4 original toy-like adventure characters with
 * hot-swappable cosmetics.
 *
 * Layered groups (consistent across all characters):
 *   #bg          background gradient ring
 *   #shadow      contact shadow under figure
 *   #cape        optional cape (drawn behind body)
 *   #wings       optional wings (drawn behind body)
 *   #body        torso + clothing (tinted)
 *   #neck        skin under chin
 *   #head-base   skin head + ears
 *   #hair        hair tufts
 *   #face        eyes, brows, mouth, blush
 *   #accessory   character-defining hat/hood/helmet
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
  outlineSoft: '#6D4B48',
  white: '#FFFFFF',
  shine: '#FFFDF7',
  skin: '#FFE2C7',
  skinShade: '#F5C6A0',
  skinDeep: '#EAA77E',
  cheek: '#FF9DB1',
  hairBoy: '#5A3A22',
  hairBoyShade: '#3F2614',
  hairGirl: '#6B3E26',
  hairGirlShade: '#4A2A18',
  starYellow: '#FFE066',
  starYellowShade: '#F5B82B',
  bowLavender: '#C8B6FF',
  bowLavenderShade: '#9C84F0',
  pink: '#FFC8DD',
  pinkShade: '#F49EBE',
  pinkInner: '#FF9CC0',
  cream: '#FFF1DD',
  visorBlue: '#7DCBEA',
  visorBlueShade: '#3F88B0',
  helmetGray: '#E5EBF1',
  helmetGrayShade: '#A8B5C2',
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

/* ─────────────────────────── Shared face ──────────────────────────────── */
function Face({ idSuffix, eyelashes }: { idSuffix: string; eyelashes?: boolean }) {
  return (
    <g id="face">
      <defs>
        <radialGradient id={`eye-${idSuffix}`} cx="0.35" cy="0.35" r="0.75">
          <stop offset="0%" stopColor="#715C58" />
          <stop offset="58%" stopColor="#2C1720" />
          <stop offset="100%" stopColor="#11080D" />
        </radialGradient>
      </defs>

      <path d="M75 111 Q86 103 98 109" stroke={COLORS.hairBoyShade} strokeWidth="3.4" strokeLinecap="round" fill="none" opacity="0.9" />
      <path d="M122 109 Q134 103 145 111" stroke={COLORS.hairBoyShade} strokeWidth="3.4" strokeLinecap="round" fill="none" opacity="0.9" />

      <ellipse cx="86" cy="132" rx="13.5" ry="16" fill="#2B1820" opacity="0.16" />
      <ellipse cx="134" cy="132" rx="13.5" ry="16" fill="#2B1820" opacity="0.16" />
      <ellipse cx="86" cy="130" rx="13" ry="15.5" fill={COLORS.white} />
      <ellipse cx="134" cy="130" rx="13" ry="15.5" fill={COLORS.white} />
      <ellipse cx="86" cy="131" rx="10.5" ry="12.8" fill={`url(#eye-${idSuffix})`} />
      <ellipse cx="134" cy="131" rx="10.5" ry="12.8" fill={`url(#eye-${idSuffix})`} />
      <circle cx="82" cy="124" r="4" fill={COLORS.white} />
      <circle cx="90.5" cy="136.5" r="1.9" fill={COLORS.white} opacity="0.9" />
      <circle cx="130" cy="124" r="4" fill={COLORS.white} />
      <circle cx="138.5" cy="136.5" r="1.9" fill={COLORS.white} opacity="0.9" />

      {eyelashes && (
        <>
          <path d="M75 122 Q72 119 70 117" stroke={COLORS.outline} strokeWidth="1.6" strokeLinecap="round" fill="none" />
          <path d="M145 122 Q148 119 150 117" stroke={COLORS.outline} strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </>
      )}

      <ellipse cx="72" cy="150" rx="11" ry="6.5" fill={COLORS.cheek} opacity="0.75" />
      <ellipse cx="148" cy="150" rx="11" ry="6.5" fill={COLORS.cheek} opacity="0.75" />

      <path d="M108 141 Q110 145 112 141" stroke={COLORS.skinDeep} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.65" />
      <path d="M101 156 Q106 163 110 159 Q114 163 119 156" stroke="#B93D53" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M104 154 Q110 157 116 154" stroke={COLORS.white} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.52" />
    </g>
  );
}

function HeadBase({ idSuffix }: { idSuffix: string }) {
  return (
    <g id="head-base">
      <defs>
        <radialGradient id={`skin-${idSuffix}`} cx="0.4" cy="0.35" r="0.85">
          <stop offset="0%" stopColor={COLORS.shine} />
          <stop offset="54%" stopColor={COLORS.skin} />
          <stop offset="100%" stopColor={COLORS.skinShade} />
        </radialGradient>
      </defs>
      <ellipse cx="46" cy="120" rx="8" ry="11" fill={COLORS.skin} stroke={COLORS.skinShade} strokeWidth="1" />
      <ellipse cx="46" cy="122" rx="3.5" ry="6" fill={COLORS.cheek} opacity="0.55" />
      <ellipse cx="174" cy="120" rx="8" ry="11" fill={COLORS.skin} stroke={COLORS.skinShade} strokeWidth="1" />
      <ellipse cx="174" cy="122" rx="3.5" ry="6" fill={COLORS.cheek} opacity="0.55" />
      <ellipse cx="110" cy="116" rx="62" ry="64" fill={`url(#skin-${idSuffix})`} stroke="#F0B98E" strokeWidth="1.4" />
      <path d="M70 91 Q94 66 130 74" stroke={COLORS.white} strokeWidth="6" strokeLinecap="round" opacity="0.18" fill="none" />
      <path d="M62 140 Q110 190 158 140 Q150 170 110 176 Q70 170 62 140 Z" fill={COLORS.skinShade} opacity="0.45" />
      <path d="M154 91 Q170 120 154 151" stroke={COLORS.skinDeep} strokeWidth="5" strokeLinecap="round" opacity="0.18" fill="none" />
    </g>
  );
}

function Neck() {
  return (
    <g id="neck">
      <path d="M94 178 Q110 188 126 178 L124 168 Q110 174 96 168 Z" fill={COLORS.skinShade} />
    </g>
  );
}

function Body({ tintColor, tintShade, idSuffix }: { tintColor: string; tintShade: string; idSuffix: string }) {
  return (
    <g id="body">
      <defs>
        <radialGradient id={`body-${idSuffix}`} cx="0.5" cy="0.2" r="0.9">
          <stop offset="0%" stopColor={lighten(tintColor)} />
          <stop offset="62%" stopColor={tintColor} />
          <stop offset="100%" stopColor={tintColor} />
        </radialGradient>
      </defs>
      <path d="M60 202 C48 204 42 214 46 224 C56 226 66 222 72 212 Z" fill={COLORS.skin} stroke={COLORS.skinShade} strokeWidth="1" />
      <path d="M160 202 C172 204 178 214 174 224 C164 226 154 222 148 212 Z" fill={COLORS.skin} stroke={COLORS.skinShade} strokeWidth="1" />
      <path d="M52 222 C58 188 80 178 110 178 C140 178 162 188 168 222 Z" fill={`url(#body-${idSuffix})`} stroke={tintShade} strokeWidth="1.4" />
      <path d="M142 186 C156 194 162 207 164 222 L142 222 C148 205 148 193 142 186 Z" fill={tintShade} opacity="0.28" />
      <path d="M52 222 C58 198 78 192 110 192 C142 192 162 198 168 222" fill="none" stroke={tintShade} strokeWidth="2.3" strokeLinecap="round" opacity="0.55" />
      <path d="M88 184 Q110 199 132 184 L128 178 Q110 188 92 178 Z" fill={COLORS.white} opacity="0.88" />
      <path d="M88 184 Q110 195 132 184" stroke={tintShade} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.38" />
      <ellipse cx="84" cy="226" rx="22" ry="6" fill={tintShade} opacity="0.42" />
      <ellipse cx="136" cy="226" rx="22" ry="6" fill={tintShade} opacity="0.42" />
      <path d="M77 184 C68 190 62 201 60 213" stroke={COLORS.white} strokeWidth="4" strokeLinecap="round" opacity="0.2" />
    </g>
  );
}

function lighten(hex: string): string {
  const c = hex.replace('#', '');
  const r = Math.min(255, parseInt(c.slice(0, 2), 16) + 30);
  const g = Math.min(255, parseInt(c.slice(2, 4), 16) + 30);
  const b = Math.min(255, parseInt(c.slice(4, 6), 16) + 30);
  return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
}

/* ──────────────────────── Per-character accessories ────────────────────── */

function HairBoy() {
  return (
    <g id="hair">
      <path d="M72 86 Q82 70 96 78 Q92 86 86 90 Z" fill={COLORS.hairBoy} />
      <path d="M96 78 Q108 64 122 80 Q116 88 108 90 Z" fill={COLORS.hairBoy} />
      <path d="M122 80 Q138 70 148 88 Q138 92 128 90 Z" fill={COLORS.hairBoy} />
    </g>
  );
}

function HairGirl() {
  return (
    <g id="hair">
      <path d="M64 102 Q72 82 96 88 Q88 100 78 104 Z" fill={COLORS.hairGirl} />
      <path d="M96 88 Q108 76 124 88 Q116 102 104 100 Z" fill={COLORS.hairGirl} />
      <path d="M124 88 Q140 80 156 102 Q146 106 132 100 Z" fill={COLORS.hairGirl} />
      <path d="M168 134 Q190 136 192 162 Q180 158 170 152 Z" fill={COLORS.hairGirl} />
    </g>
  );
}

function DinoHood({ tintColor, tintShade, idSuffix }: { tintColor: string; tintShade: string; idSuffix: string }) {
  return (
    <g id="accessory">
      <defs>
        <radialGradient id={`dino-${idSuffix}`} cx="0.4" cy="0.3" r="0.9">
          <stop offset="0%" stopColor={lighten(tintColor)} />
          <stop offset="100%" stopColor={tintColor} />
        </radialGradient>
      </defs>
      <path d="M158 108 Q188 100 190 131 Q174 123 162 124 Z" fill={tintShade} stroke={COLORS.outlineSoft} strokeWidth="1" opacity="0.95" />
      <path
        d="M48 108 Q44 56 110 50 Q176 56 172 108 Q170 90 152 84 Q148 96 140 92 Q132 80 110 80 Q88 80 80 92 Q72 96 68 84 Q50 90 48 108 Z"
        fill={`url(#dino-${idSuffix})`}
        stroke={tintShade}
        strokeWidth="1.6"
      />
      <path d="M68 77 Q100 52 148 70" stroke={COLORS.white} strokeWidth="5" strokeLinecap="round" opacity="0.22" fill="none" />
      <path d="M151 84 Q162 92 168 108" stroke={tintShade} strokeWidth="4" strokeLinecap="round" opacity="0.3" fill="none" />
      <path d="M88 56 Q92 42 101 54 Z" fill={COLORS.starYellow} stroke={tintShade} strokeWidth="1" />
      <path d="M104 50 Q110 36 119 50 Z" fill={COLORS.starYellow} stroke={tintShade} strokeWidth="1" />
      <path d="M122 54 Q130 42 135 56 Z" fill={COLORS.starYellow} stroke={tintShade} strokeWidth="1" />
      <circle cx="84" cy="68" r="5.5" fill={COLORS.white} />
      <circle cx="84" cy="69" r="3" fill={COLORS.outline} />
      <circle cx="83" cy="67.5" r="1" fill={COLORS.white} />
      <circle cx="136" cy="68" r="5.5" fill={COLORS.white} />
      <circle cx="136" cy="69" r="3" fill={COLORS.outline} />
      <circle cx="135" cy="67.5" r="1" fill={COLORS.white} />
      {/* teeth */}
      <polygon points="62,98 68,108 74,98" fill={COLORS.white} />
      <polygon points="76,96 82,106 88,96" fill={COLORS.white} />
      <polygon points="92,94 98,104 104,94" fill={COLORS.white} />
      <polygon points="116,94 122,104 128,94" fill={COLORS.white} />
      <polygon points="132,96 138,106 144,96" fill={COLORS.white} />
      <polygon points="146,98 152,108 158,98" fill={COLORS.white} />
    </g>
  );
}

function SpaceHelmet({ tintColor, tintShade, idSuffix }: { tintColor: string; tintShade: string; idSuffix: string }) {
  return (
    <g id="accessory">
      <defs>
        <radialGradient id={`helm-${idSuffix}`} cx="0.4" cy="0.35" r="0.95">
          <stop offset="0%" stopColor={COLORS.white} />
          <stop offset="100%" stopColor={COLORS.helmetGray} />
        </radialGradient>
        <linearGradient id={`visor-${idSuffix}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#BDE8FA" />
          <stop offset="100%" stopColor={COLORS.visorBlue} />
        </linearGradient>
      </defs>
      {/* helmet outer dome */}
      <circle cx="110" cy="116" r="76" fill={`url(#helm-${idSuffix})`} stroke={COLORS.helmetGrayShade} strokeWidth="2.4" opacity="0.96" />
      {/* visor cutout — a tinted bubble that frames the face */}
      <ellipse cx="110" cy="124" rx="58" ry="50" fill={`url(#visor-${idSuffix})`} opacity="0.85" stroke={COLORS.visorBlueShade} strokeWidth="1.6" />
      <path d="M64 101 C78 64 138 55 160 96" stroke={COLORS.white} strokeWidth="7" strokeLinecap="round" opacity="0.42" fill="none" />
      <path d="M156 138 C148 163 120 178 88 166" stroke={COLORS.visorBlueShade} strokeWidth="5" strokeLinecap="round" opacity="0.18" fill="none" />
      {/* oxygen tank knobs on top */}
      <circle cx="86" cy="46" r="6" fill={tintColor} stroke={tintShade} strokeWidth="1.5" />
      <circle cx="134" cy="46" r="6" fill={tintColor} stroke={tintShade} strokeWidth="1.5" />
      <rect x="100" y="40" width="20" height="6" rx="3" fill={COLORS.helmetGray} stroke={COLORS.helmetGrayShade} strokeWidth="1.5" />
      {/* antenna */}
      <line x1="110" y1="40" x2="110" y2="22" stroke={COLORS.helmetGrayShade} strokeWidth="2" />
      <circle cx="110" cy="20" r="4" fill="#FF6B6B" />
      <circle cx="109" cy="19" r="1.4" fill={COLORS.white} opacity="0.85" />
      {/* visor highlights */}
      <ellipse cx="80" cy="100" rx="14" ry="10" fill={COLORS.white} opacity="0.45" transform="rotate(-25 80 100)" />
      <ellipse cx="142" cy="148" rx="6" ry="3" fill={COLORS.white} opacity="0.35" transform="rotate(-25 142 148)" />
      {/* helmet rim band */}
      <path d="M44 168 Q110 196 176 168" stroke={tintColor} strokeWidth="6" strokeLinecap="round" fill="none" />
    </g>
  );
}

function CatHood({ tintColor, tintShade, idSuffix }: { tintColor: string; tintShade: string; idSuffix: string }) {
  return (
    <g id="accessory">
      <defs>
        <radialGradient id={`cat-${idSuffix}`} cx="0.4" cy="0.3" r="0.95">
          <stop offset="0%" stopColor={lighten(tintColor)} />
          <stop offset="100%" stopColor={tintColor} />
        </radialGradient>
      </defs>
      <path d="M150 110 Q202 110 197 171 Q180 158 168 158 L160 130 Z" fill={tintShade} stroke={COLORS.outlineSoft} strokeWidth="1" opacity="0.78" />
      {/* ears */}
      <path d="M58 90 L46 36 L98 70 Z" fill={`url(#cat-${idSuffix})`} stroke={tintShade} strokeWidth="1.5" />
      <path d="M64 80 L56 52 L86 70 Z" fill={COLORS.pinkInner} />
      <path d="M162 90 L174 36 L122 70 Z" fill={`url(#cat-${idSuffix})`} stroke={tintShade} strokeWidth="1.5" />
      <path d="M156 80 L164 52 L134 70 Z" fill={COLORS.pinkInner} />
      {/* hood */}
      <path d="M48 116 Q44 64 110 58 Q176 64 172 116 Q170 100 150 96 Q132 78 110 78 Q88 78 70 96 Q50 100 48 116 Z" fill={`url(#cat-${idSuffix})`} stroke={tintShade} strokeWidth="1.5" />
      <path d="M63 98 Q108 78 157 99" fill="none" stroke={COLORS.white} strokeWidth="4" strokeLinecap="round" opacity="0.28" />
      <path d="M151 96 Q166 105 170 120" fill="none" stroke={tintShade} strokeWidth="4" strokeLinecap="round" opacity="0.22" />
      {/* whisker dots */}
      <circle cx="100" cy="108" r="1.4" fill={tintShade} />
      <circle cx="120" cy="108" r="1.4" fill={tintShade} />
    </g>
  );
}

function PuppyHood({ tintColor, tintShade, idSuffix }: { tintColor: string; tintShade: string; idSuffix: string }) {
  return (
    <g id="accessory">
      <defs>
        <radialGradient id={`pup-${idSuffix}`} cx="0.4" cy="0.3" r="0.95">
          <stop offset="0%" stopColor={lighten(tintColor)} />
          <stop offset="100%" stopColor={tintColor} />
        </radialGradient>
      </defs>
      {/* hood dome */}
      <path d="M48 116 Q44 64 110 58 Q176 64 172 116 Q170 100 150 96 Q132 78 110 78 Q88 78 70 96 Q50 100 48 116 Z" fill={`url(#pup-${idSuffix})`} stroke={tintShade} strokeWidth="1.5" />
      {/* floppy left ear */}
      <path d="M50 96 Q24 110 32 158 Q52 152 62 134 Q58 116 56 102 Z" fill={`url(#pup-${idSuffix})`} stroke={tintShade} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M40 130 Q44 138 52 144" stroke={tintShade} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.6" />
      {/* floppy right ear */}
      <path d="M170 96 Q196 110 188 158 Q168 152 158 134 Q162 116 164 102 Z" fill={`url(#pup-${idSuffix})`} stroke={tintShade} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M180 130 Q176 138 168 144" stroke={tintShade} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.6" />
      {/* puppy nose patch on hood */}
      <ellipse cx="110" cy="92" rx="14" ry="9" fill={COLORS.cream} opacity="0.85" />
      <ellipse cx="110" cy="88" rx="3.5" ry="2.5" fill={COLORS.outline} />
      {/* tongue hint at bottom-front */}
      <path d="M64 101 Q110 80 156 102" fill="none" stroke={COLORS.white} strokeWidth="4" strokeLinecap="round" opacity="0.26" />
      <path d="M151 98 Q166 107 170 121" fill="none" stroke={tintShade} strokeWidth="4" strokeLinecap="round" opacity="0.22" />
    </g>
  );
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
        <Body tintColor={tint.color} tintShade={tint.shade} idSuffix={idSuffix} />
        <Neck />
        <HeadBase idSuffix={idSuffix} />

        {/* hair behind the accessory; spaceman has no visible hair under helmet */}
        {(config.kind === 'dino' || config.kind === 'spaceman') ? <HairBoy /> : <HairGirl />}

        <Face idSuffix={idSuffix} eyelashes={config.kind === 'kitty' || config.kind === 'puppy'} />

        {config.kind === 'dino' && <DinoHood tintColor={tint.color} tintShade={tint.shade} idSuffix={idSuffix} />}
        {config.kind === 'spaceman' && <SpaceHelmet tintColor={tint.color} tintShade={tint.shade} idSuffix={idSuffix} />}
        {config.kind === 'kitty' && <CatHood tintColor={tint.color} tintShade={tint.shade} idSuffix={idSuffix} />}
        {config.kind === 'puppy' && <PuppyHood tintColor={tint.color} tintShade={tint.shade} idSuffix={idSuffix} />}
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
