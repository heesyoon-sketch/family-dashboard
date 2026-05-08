'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { X } from 'lucide-react';
import { MOMENTUM_STATES, type MomentumResult, type MomentumState } from '@/lib/progression';

const STATE_GRADIENT: Record<MomentumState, string> = {
  spark:        'radial-gradient(circle at 50% 60%, #6b6f7a 0%, #2a2d3a 70%)',
  warm:         'radial-gradient(circle at 50% 60%, #ffb37a 0%, #6f3a1f 75%)',
  bright:       'radial-gradient(circle at 50% 60%, #ffd166 0%, #b9750d 75%)',
  blazing:      'radial-gradient(circle at 50% 60%, #ffd166 0%, #ff7849 60%, #5a1f10 100%)',
  overflowing:  'radial-gradient(circle at 50% 60%, #fff7a8 0%, #ffafd5 50%, #7adff2 100%)',
};

const STATE_RING: Record<MomentumState, string> = {
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
  const [open, setOpen] = useState(false);

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
        <button
          type="button"
          onClick={event => {
            // Don't let the click bubble up to a parent that might also
            // respond (e.g. if the panel itself becomes clickable).
            event.stopPropagation();
            setOpen(true);
          }}
          aria-label={`Momentum: ${momentum.meta.label}. Tap to learn what each state means.`}
          className="cursor-pointer rounded text-[11px] font-black uppercase tracking-[0.18em] underline-offset-2 hover:underline focus:outline-none focus-visible:underline"
          style={{ color: idle ? 'var(--fg-muted)' : 'var(--accent)' }}
        >
          {momentum.meta.label}
        </button>
      )}

      <AnimatePresence>
        {open && (
          <MomentumStatesDialog current={momentum.state} onClose={() => setOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function MomentumStatesDialog({
  current,
  onClose,
}: {
  current: MomentumState;
  onClose: () => void;
}) {
  return (
    <motion.div
      key="momentum-dialog"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[60] grid place-items-center bg-black/70 px-4 py-6"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <motion.div
        initial={{ scale: 0.94, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 4 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={event => event.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#13151c] p-5 text-white shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <X size={16} />
        </button>

        <div className="mb-1 text-[11px] font-black uppercase tracking-[0.18em] text-white/45">
          Momentum
        </div>
        <h2 className="text-xl font-black leading-tight">
          The flame you carry day to day
        </h2>
        <p className="mt-1 text-sm leading-snug text-white/65">
          Momentum reflects the rhythm of your last two weeks, based on the share of your
          scheduled habits you finish each day. A 1-of-1 day counts the same as a 4-of-4
          day, and rest days where nothing's scheduled don't pull the score down. The
          brighter the flame, the larger the per-completion bonus.
        </p>

        <ul className="mt-4 space-y-2">
          {MOMENTUM_STATES.map(state => {
            const isCurrent = state.state === current;
            return (
              <li
                key={state.state}
                className={[
                  'flex items-start gap-3 rounded-xl border p-3 transition',
                  isCurrent
                    ? 'border-[var(--accent)]/55 bg-[var(--accent)]/10'
                    : 'border-white/10 bg-white/[0.03]',
                ].join(' ')}
              >
                <span
                  aria-hidden
                  className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full"
                  style={{
                    background: STATE_GRADIENT[state.state],
                    boxShadow:
                      state.state === 'spark'
                        ? 'none'
                        : `0 0 12px ${STATE_RING[state.state]}`,
                    opacity: 0.5 + state.intensity * 0.5,
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-black uppercase tracking-wider">
                        {state.label}
                      </span>
                      {isCurrent && (
                        <span className="rounded-full bg-[var(--accent)]/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-[var(--accent)]">
                          You
                        </span>
                      )}
                    </div>
                    <span
                      className={`shrink-0 text-xs font-bold ${
                        state.bonusPercent > 0 ? 'text-[#3ddc97]' : 'text-white/45'
                      }`}
                    >
                      {state.bonusPercent > 0 ? `+${state.bonusPercent}% bonus` : 'no bonus'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[13px] leading-snug text-white/65">
                    {state.description}
                  </p>
                  <p className="mt-1 text-[11px] text-white/40">
                    score {state.minScore}+ / 100
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="mt-4 text-[11px] leading-snug text-white/45">
          Bonuses stack with Harmony and your equipped insignia loadout, capped at +50%
          total.
        </p>
      </motion.div>
    </motion.div>
  );
}
