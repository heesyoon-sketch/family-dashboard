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
  starYellow: '#FFE066',
  starYellowShade: '#F5B82B',
  bowLavender: '#C8B6FF',
  bowLavenderShade: '#9C84F0',
};

const TINT_VISUALS: Record<string, { hue: number; saturation: number; lightness: number }> = {
  mint:     { hue: 0,   saturation: 1.06, lightness: 1.00 },
  sky:      { hue: 42,  saturation: 1.12, lightness: 1.02 },
  pink:     { hue: 292, saturation: 1.14, lightness: 1.04 },
  lavender: { hue: 252, saturation: 1.10, lightness: 1.02 },
  sun:      { hue: 326, saturation: 1.18, lightness: 1.05 },
  coral:    { hue: 306, saturation: 1.16, lightness: 1.04 },
  mauve:    { hue: 274, saturation: 1.08, lightness: 1.02 },
  sage:     { hue: 12,  saturation: 0.88, lightness: 0.98 },
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
          <ellipse cx="110" cy="26" rx="45" ry="9" fill="none" stroke={COLORS.starYellow} strokeWidth="4" opacity="0.95" />
          <ellipse cx="110" cy="26" rx="45" ry="9" fill="none" stroke={COLORS.starYellowShade} strokeWidth="1.5" opacity="0.6" />
        </g>
      )}
      {has('crown') && (
        <g id="crown">
          <path d="M72 34 L84 60 L98 42 L110 66 L124 42 L138 60 L150 34 L150 70 L72 70 Z" fill={COLORS.starYellow} stroke={COLORS.starYellowShade} strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="86" cy="45" r="3" fill="#E26C8A" />
          <circle cx="110" cy="53" r="3.2" fill="#7DCBEA" />
          <circle cx="134" cy="45" r="3" fill="#A8E6A1" />
        </g>
      )}
      {has('flowers') && (
        <g id="flowers">
          <Flower cx={68} cy={56} color="#FF9DB1" />
          <Flower cx={90} cy={40} color="#FFE066" />
          <Flower cx={120} cy={38} color="#C8B6FF" />
          <Flower cx={150} cy={52} color="#A8E6A1" />
        </g>
      )}
      {has('star_pin') && (
        <g id="star_pin" transform="translate(154 124) rotate(14)">
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
          <path d="M88 151 Q72 145 70 160 Q81 168 98 162 Z" fill={COLORS.bowLavender} stroke={COLORS.bowLavenderShade} strokeWidth="1.2" />
          <path d="M132 151 Q148 145 150 160 Q139 168 122 162 Z" fill={COLORS.bowLavender} stroke={COLORS.bowLavenderShade} strokeWidth="1.2" />
          <circle cx="110" cy="158" r="7" fill={COLORS.bowLavenderShade} />
          <circle cx="108.2" cy="155.7" r="2.2" fill={COLORS.white} opacity="0.85" />
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

const CREATURE_ASSETS: Record<AvatarKind, string> = {
  dino: '/avatars/creatures/dino-monster.png',
  spaceman: '/avatars/creatures/star-dragon.png',
  kitty: '/avatars/creatures/mystic-cat.png',
  puppy: '/avatars/creatures/bolt-puppy.png',
};

/* ───────────────────────── Composed Avatar ───────────────────────────── */

export function Avatar({ config, size = 200, className, showBg = true, title }: AvatarProps) {
  const tint = tintById(config.tint);
  const uniqueId = useId().replace(/:/g, '');
  const idSuffix = `${uniqueId}-${config.kind}-${config.tint}-${config.bg}`;
  const ariaTitle = title ?? `${config.kind} avatar`;
  const auraId = `aura-${idSuffix}`;
  const figureFilterId = `figure-${idSuffix}`;
  const creatureAsset = CREATURE_ASSETS[config.kind];
  const tintVisual = TINT_VISUALS[config.tint] ?? TINT_VISUALS.mint;

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
        <radialGradient id={auraId} cx="0.5" cy="0.4" r="0.55">
          <stop offset="0%" stopColor={tint.color} stopOpacity="0.46" />
          <stop offset="58%" stopColor={tint.color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={tint.color} stopOpacity="0" />
        </radialGradient>
        <filter id={figureFilterId} x="-20%" y="-18%" width="140%" height="140%">
          <feColorMatrix type="hueRotate" values={`${tintVisual.hue}`} />
          <feColorMatrix
            type="saturate"
            values={`${tintVisual.saturation}`}
          />
          <feComponentTransfer>
            <feFuncR type="linear" slope={`${tintVisual.lightness}`} />
            <feFuncG type="linear" slope={`${tintVisual.lightness}`} />
            <feFuncB type="linear" slope={`${tintVisual.lightness}`} />
          </feComponentTransfer>
          <feDropShadow dx="0" dy="4" stdDeviation="3.2" floodColor="#1F1B2E" floodOpacity="0.24" />
        </filter>
      </defs>

      {showBg && <Background id={config.bg} gradId={`bg-${idSuffix}`} />}

      <Shadow />
      <ellipse cx="110" cy="126" rx="84" ry="86" fill={`url(#${auraId})`} />

      {config.extras.includes('cape') && <Extras extras={['cape']} tintColor={tint.color} idSuffix={`cape-${idSuffix}`} />}
      {config.extras.includes('wings') && <Extras extras={['wings']} tintColor={tint.color} idSuffix={`wings-${idSuffix}`} />}

      <g filter={`url(#${figureFilterId})`}>
        <image
          href={creatureAsset}
          x="11"
          y="18"
          width="198"
          height="204"
          preserveAspectRatio="xMidYMid meet"
          role="presentation"
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
