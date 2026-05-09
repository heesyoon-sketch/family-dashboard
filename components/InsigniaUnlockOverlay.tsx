'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';
import { InsigniaBadge } from '@/components/InsigniaBadge';
import type { AchievementProgress } from '@/lib/achievements/engine';
import { useFamilyStore } from '@/lib/store';

const RARITY_LABEL: Record<AchievementProgress['rarity'], string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic',
};

const RARITY_GLOW: Record<AchievementProgress['rarity'], string> = {
  common: 'rgba(214,138,81,0.55)',
  rare: 'rgba(91,141,239,0.65)',
  epic: 'rgba(169,139,255,0.65)',
  legendary: 'rgba(245,197,66,0.78)',
  mythic: 'rgba(232,90,28,0.78)',
};

interface ConfettiBit {
  left: number;
  delay: number;
  duration: number;
  color: string;
  rotate: number;
}

function makeConfetti(count: number, palette: string[]): ConfettiBit[] {
  return Array.from({ length: count }).map((_, i) => ({
    left: (i / count) * 100 + (Math.random() * 6 - 3),
    delay: Math.random() * 0.6,
    duration: 1.6 + Math.random() * 1.4,
    color: palette[i % palette.length],
    rotate: Math.random() * 360,
  }));
}

const CONFETTI = makeConfetti(28, [
  '#ffd166',
  '#ef476f',
  '#06d6a0',
  '#a98bff',
  '#7adff2',
  '#ffafe0',
]);

export function InsigniaUnlockOverlay() {
  const router = useRouter();
  const queue = useFamilyStore(s => s.insigniaQueue);
  const dismiss = useFamilyStore(s => s.dismissInsigniaUnlock);
  const users = useFamilyStore(s => s.users);

  const current = queue[0] ?? null;
  const member = current ? users.find(u => u.id === current.childId) : null;

  // Auto-dismiss after a generous beat — enough time to read and tap.
  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(dismiss, 9000);
    return () => clearTimeout(timer);
  }, [current, dismiss]);

  const goToWall = () => {
    dismiss();
    router.push('/stats?view=insignia');
  };

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.achievementId + current.childId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[60] grid place-items-center bg-black/78 px-4 backdrop-blur-md"
          onClick={dismiss}
        >
          {/* Confetti rain */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {CONFETTI.map((bit, idx) => (
              <motion.span
                key={idx}
                initial={{ y: -40, opacity: 0, rotate: bit.rotate }}
                animate={{ y: '110vh', opacity: [0, 1, 1, 0], rotate: bit.rotate + 540 }}
                transition={{
                  duration: bit.duration,
                  delay: bit.delay,
                  ease: 'easeIn',
                  repeat: Infinity,
                  repeatDelay: 1.6,
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: `${bit.left}%`,
                  width: 8,
                  height: 14,
                  background: bit.color,
                  borderRadius: 2,
                  boxShadow: `0 0 8px ${bit.color}`,
                }}
              />
            ))}
          </div>

          <motion.div
            onClick={e => e.stopPropagation()}
            initial={{ scale: 0.7, y: 18, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18 }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border p-6 text-center"
            style={{
              borderColor: RARITY_GLOW[current.rarity],
              background: 'linear-gradient(170deg, #1c1f3a 0%, #0c0e1c 100%)',
              boxShadow: `0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px ${RARITY_GLOW[current.rarity]} inset, 0 0 60px ${RARITY_GLOW[current.rarity]}`,
            }}
          >
            {/* Radial burst behind the badge */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                background: `radial-gradient(closest-side, ${RARITY_GLOW[current.rarity]} 0%, transparent 70%)`,
                opacity: 0.7,
              }}
            />

            <div className="relative">
              <div className="flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-[0.28em] text-white/65">
                <Sparkles size={14} />
                <span>Shield Unlocked</span>
                <Sparkles size={14} />
              </div>

              <motion.div
                initial={{ scale: 0.4, rotate: -16, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ delay: 0.12, type: 'spring', stiffness: 240, damping: 14 }}
                className="mt-5 flex justify-center"
              >
                <InsigniaBadge
                  rarity={current.rarity}
                  icon={current.icon}
                  seed={current.achievementId}
                  size={168}
                  showSparkles
                  ariaLabel={current.title}
                />
              </motion.div>

              <motion.div
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <div className="mt-5 text-[11px] font-black uppercase tracking-[0.22em] text-white/55">
                  {RARITY_LABEL[current.rarity]} · {current.category}
                </div>
                <h2 className="mt-1 text-3xl font-black leading-tight text-white">
                  {current.title}
                </h2>
                {member && (
                  <p className="mt-2 text-sm font-black text-white/65">
                    Earned by <span className="text-white">{member.name}</span>
                  </p>
                )}
                <p className="mt-3 text-sm font-semibold leading-relaxed text-white/65">
                  {current.description}
                </p>

                {current.rewardPoints && current.rewardPoints > 0 ? (
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-sm font-black text-white">
                    +{current.rewardPoints}
                    <span className="text-xs font-black uppercase tracking-wider text-white/55">bonus pts</span>
                  </div>
                ) : null}
              </motion.div>

              <div className="mt-6 grid gap-2">
                <button
                  type="button"
                  onClick={goToWall}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-white/90"
                >
                  See it on the Shield Wall
                  <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
                </button>
                <button
                  type="button"
                  onClick={dismiss}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white/65 transition hover:bg-white/10 hover:text-white"
                >
                  Keep going
                </button>
              </div>

              {queue.length > 1 && (
                <div className="mt-3 text-[11px] font-black uppercase tracking-wider text-white/45">
                  +{queue.length - 1} more shield{queue.length - 1 === 1 ? '' : 's'} waiting
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
