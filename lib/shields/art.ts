import type { ShieldTier, ShieldType } from './engine';

/** Versioned files keep already-open PWAs from reusing the old artwork. */
export function shieldArtSource(tier: ShieldTier, displaySize = 48, type?: ShieldType): string {
  const resolution = displaySize > 96 ? 512 : 256;
  // Reward receipts sometimes know only rarity; equipped shields always know type.
  return type
    ? `/shields/routine-v3/${tier}-${type}-${resolution}.webp`
    : `/shields/aaa-v2/${tier}-${resolution}.webp`;
}
