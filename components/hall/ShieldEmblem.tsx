import Image from 'next/image';
import type { ShieldTier, ShieldType } from '@/lib/shields/engine';
import { shieldArtSource } from '@/lib/shields/art';

/** Rarity lives in the frame; a sculpted centerpiece and enamel field carry routine type. */
export function ShieldEmblem({ type, tier, size = 120, projected = false, title }: {
  type: ShieldType;
  tier: ShieldTier;
  size?: number;
  projected?: boolean;
  title?: string;
}) {
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
      <Image src={shieldArtSource(tier, size, type)} alt="" width={size} height={size} sizes={`${size}px`} draggable={false} className="h-full w-full select-none object-contain" />
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
