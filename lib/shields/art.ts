import type { ShieldTier } from './engine';

/** Versioned files keep already-open PWAs from reusing the old artwork. */
export function shieldArtSource(tier: ShieldTier, displaySize = 48): string {
  return `/shields/aaa-v2/${tier}-${displaySize > 96 ? 512 : 256}.webp`;
}
