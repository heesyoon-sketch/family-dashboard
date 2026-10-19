import Image from 'next/image';
import { Moon, Sparkles, Sunrise } from 'lucide-react';
import type { ShieldTier, ShieldType } from '@/lib/shields/engine';
import { shieldArtSource } from '@/lib/shields/art';

const TYPE_MARK = {
  morning: { Icon: Sunrise, color: '#E8C77B' },
  evening: { Icon: Moon, color: '#AFCDFB' },
  bonus: { Icon: Sparkles, color: '#C4B5FD' },
};

/** Approved collectible art carries rarity; a small corner mark carries routine type. */
export function ShieldEmblem({ type, tier, size = 120, projected = false, title }: {
  type: ShieldType;
  tier: ShieldTier;
  size?: number;
  projected?: boolean;
  title?: string;
}) {
  const { Icon, color } = TYPE_MARK[type];
  const markSize = Math.max(10, Math.min(25, Math.round(size * 0.28)));
  return (
    <span
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      data-shield-art={tier}
      data-shield-type={type}
      className={`relative inline-block shrink-0 align-middle ${projected ? 'opacity-55 saturate-50' : ''}`}
      style={{ width: size, height: size, lineHeight: 0 }}
    >
      <Image src={shieldArtSource(tier, size)} alt="" width={size} height={size} sizes={`${size}px`} draggable={false} className="h-full w-full select-none object-contain" />
      <span className="absolute grid place-items-center rounded-full border bg-[#141A2B] shadow-sm" style={{
        width: markSize, height: markSize, right: Math.round(size * (size >= 60 ? 0.16 : 0.04)), bottom: Math.round(size * (size >= 60 ? 0.14 : 0.02)),
        borderColor: `${color}60`, color,
      }}>
        <Icon size={Math.max(6, Math.round(markSize * 0.58))} strokeWidth={2.2} aria-hidden />
      </span>
    </span>
  );
}

/** Empty slot placeholder. */
export function EmptyShield({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden>
      <path d="M100 18 L172 44 V100 C172 146 140 176 100 188 C60 176 28 146 28 100 V44 Z" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.18)" strokeWidth="3" strokeDasharray="10 10" />
    </svg>
  );
}
