'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { X } from 'lucide-react';
import { useFamilyStore } from '@/lib/store';
import { HARMONY_STATES, type HarmonyState } from '@/lib/progression';

/** Family-wide harmony summary, shown once at the top of the dashboard.
 *  It celebrates *cooperation* without naming any single member: the chip
 *  brightens when the family is in rhythm, dims when it isn't. Tapping
 *  the chip explains all four states. */
export function HarmonyChip({ className }: { className?: string }) {
  const harmony = useFamilyStore(s => s.harmony);
  const [open, setOpen] = useState(false);
  if (!harmony || harmony.totalMembers <= 1) return null;

  const idle = harmony.state === 'quiet';
  const glow = harmony.meta.glow;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Family harmony: ${harmony.meta.label}. Tap to learn what each state means.`}
        className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 transition hover:brightness-110 focus:outline-none focus-visible:brightness-110 ${className ?? ''}`}
        style={{
          borderColor: idle ? 'rgba(255,255,255,0.10)' : `${glow}aa`,
          background: idle
            ? 'rgba(255,255,255,0.04)'
            : `linear-gradient(135deg, ${glow}28, ${glow}10)`,
          boxShadow: idle ? 'none' : `0 0 16px ${glow}33`,
        }}
      >
        <motion.span
          aria-hidden
          className="block h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: glow }}
          animate={idle ? { opacity: 0.5 } : { opacity: [0.5, 1, 0.5] }}
          transition={idle ? { duration: 0 } : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/72">
          {harmony.meta.label}
        </span>
        <span className="text-[10px] font-black tabular-nums text-white/45">
          {harmony.activeTodayCount}/{harmony.totalMembers}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <HarmonyStatesDialog
            current={harmony.state}
            activeToday={harmony.activeTodayCount}
            totalMembers={harmony.totalMembers}
            sideBySideDays={harmony.sideBySideDays}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function HarmonyStatesDialog({
  current,
  activeToday,
  totalMembers,
  sideBySideDays,
  onClose,
}: {
  current: HarmonyState;
  activeToday: number;
  totalMembers: number;
  sideBySideDays: number;
  onClose: () => void;
}) {
  return (
    <motion.div
      key="harmony-dialog"
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
          Family Harmony
        </div>
        <h2 className="text-xl font-black leading-tight">
          The rhythm you keep together
        </h2>
        <p className="mt-1 text-sm leading-snug text-white/65">
          Harmony measures how the family moves together over the last week. It mixes
          how many of you show up on the same days with how much of each member's own
          schedule they finished — fair across members with different numbers of habits.
          A quiet sibling never lowers anyone else's score; it only goes up when more
          members join the rhythm.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
              Active today
            </div>
            <div className="text-sm font-bold text-white">
              {activeToday}/{totalMembers}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
              Side-by-side days (7d)
            </div>
            <div className="text-sm font-bold text-white">{sideBySideDays}/7</div>
          </div>
        </div>

        <ul className="mt-4 space-y-2">
          {HARMONY_STATES.map(state => {
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
                  className="mt-1 block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    background: state.glow,
                    boxShadow: state.state === 'quiet' ? 'none' : `0 0 10px ${state.glow}`,
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
          Bonuses stack with each member's Momentum and equipped insignia loadout, capped
          at +50% total.
        </p>
      </motion.div>
    </motion.div>
  );
}
