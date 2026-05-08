'use client';

import { motion } from 'framer-motion';
import { useFamilyStore } from '@/lib/store';

/** Family-wide harmony summary, shown once at the top of the dashboard.
 *  It celebrates *cooperation* without naming any single member: the chip
 *  brightens when the family is in rhythm, dims when it isn't. */
export function HarmonyChip({ className }: { className?: string }) {
  const harmony = useFamilyStore(s => s.harmony);
  if (!harmony || harmony.totalMembers <= 1) return null;

  const idle = harmony.state === 'quiet';
  const glow = harmony.meta.glow;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 ${className ?? ''}`}
      style={{
        borderColor: idle ? 'rgba(255,255,255,0.10)' : `${glow}aa`,
        background: idle
          ? 'rgba(255,255,255,0.04)'
          : `linear-gradient(135deg, ${glow}28, ${glow}10)`,
        boxShadow: idle ? 'none' : `0 0 16px ${glow}33`,
      }}
      title={`${harmony.meta.description} · ${harmony.activeTodayCount}/${harmony.totalMembers} active today`}
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
    </div>
  );
}
