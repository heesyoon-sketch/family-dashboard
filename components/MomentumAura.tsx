'use client';

import { motion } from 'framer-motion';
import type { MomentumResult } from '@/lib/progression';

const STATE_GRADIENT: Record<MomentumResult['state'], string> = {
  spark:        'radial-gradient(circle at 50% 60%, #6b6f7a 0%, #2a2d3a 70%)',
  warm:         'radial-gradient(circle at 50% 60%, #ffb37a 0%, #6f3a1f 75%)',
  bright:       'radial-gradient(circle at 50% 60%, #ffd166 0%, #b9750d 75%)',
  blazing:      'radial-gradient(circle at 50% 60%, #ffd166 0%, #ff7849 60%, #5a1f10 100%)',
  overflowing:  'radial-gradient(circle at 50% 60%, #fff7a8 0%, #ffafd5 50%, #7adff2 100%)',
};

const STATE_RING: Record<MomentumResult['state'], string> = {
  spark:        'rgba(140,148,162,0.55)',
  warm:         'rgba(255,179,122,0.65)',
  bright:       'rgba(255,209,102,0.75)',
  blazing:      'rgba(255,120,73,0.78)',
  overflowing:  'rgba(255,175,213,0.85)',
};

interface Props {
  momentum: MomentumResult;
  /** Compact mode renders a chip-sized inline aura for the dashboard. */
  size?: number;
  showLabel?: boolean;
  className?: string;
}

export function MomentumAura({ momentum, size = 28, showLabel = false, className }: Props) {
  const intensity = momentum.meta.intensity;
  const idle = momentum.state === 'spark';

  return (
    <div className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <div
        aria-hidden
        className="relative shrink-0 overflow-hidden rounded-full"
        style={{
          width: size,
          height: size,
          background: STATE_GRADIENT[momentum.state],
          boxShadow: idle ? 'none' : `0 0 ${Math.round(size * 0.45)}px ${STATE_RING[momentum.state]}`,
          opacity: 0.4 + intensity * 0.6,
        }}
      >
        {!idle && (
          <motion.span
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.55) 0%, transparent 60%)',
            }}
            animate={{ opacity: [0.3, 0.7, 0.3], scale: [0.85, 1.05, 0.85] }}
            transition={{ duration: 2.4 + (1 - intensity) * 1.6, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </div>
      {showLabel && (
        <span
          className="text-[11px] font-black uppercase tracking-[0.18em]"
          style={{ color: idle ? 'var(--fg-muted)' : 'var(--accent)' }}
          title={momentum.meta.description}
        >
          {momentum.meta.label}
        </span>
      )}
    </div>
  );
}
