'use client';

import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useState, useRef } from 'react';
import * as Icons from 'lucide-react';
import { Task } from '@/lib/db';
import type { ThemeName } from '@/lib/db';
import { useFamilyStore } from '@/lib/store';
import { Particles, buildParticles } from './Particles';
import type { ParticleData } from './Particles';
import { playCompletionSound } from '@/lib/sound';
import { CUSTOM_ICON_MAP } from './CustomIcons';

const SWIPE_TRIGGER_PX = 110;
// 64px: 4 rows × 64 + 3 gaps × 8 = 280px task area — sweet spot for legibility + fit
const CARD_H = 64;

const TIME_WINDOW_LABEL: Record<string, string> = {
  morning: '아침',
  afternoon: '오후',
  evening: '저녁',
};

function pascalCase(kebab: string): string {
  return kebab.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

export function TaskCard({ task, completed, theme }: { task: Task; completed: boolean; theme: ThemeName }) {
  const markCompleted  = useFamilyStore(s => s.markCompleted);
  const undoCompletion = useFamilyStore(s => s.undoCompletion);
  const soundEnabled   = useFamilyStore(s => s.soundEnabled);

  const x            = useMotionValue(0);
  const bgOpacity    = useTransform(x, [0, SWIPE_TRIGGER_PX], [0, 1]);
  const checkOpacity = useTransform(x, [0, SWIPE_TRIGGER_PX * 0.5, SWIPE_TRIGGER_PX], [0, 0, 1]);

  const [busy, setBusy]           = useState(false);
  const tappedAt                  = useRef(0);
  const [particles, setParticles] = useState<ParticleData[] | null>(null);
  const particleTimer             = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerEffects = () => {
    if (soundEnabled) playCompletionSound(theme);
    if (particleTimer.current) clearTimeout(particleTimer.current);
    setParticles(buildParticles(theme));
    particleTimer.current = setTimeout(() => setParticles(null), 1000);
  };

  const fireComplete = async () => {
    if (busy) return;
    setBusy(true);
    if (completed) {
      await undoCompletion(task.userId, task.id);
    } else {
      triggerEffects();
      await markCompleted(task.userId, task.id);
    }
    setBusy(false);
  };

  const handleDragEnd = (_: unknown, info: { offset: { x: number } }) => {
    if (info.offset.x >= SWIPE_TRIGGER_PX) {
      animate(x, 300, { duration: 0.25, onComplete: fireComplete });
    } else {
      animate(x, 0, { type: 'spring', stiffness: 260, damping: 20 });
    }
  };

  const handleTap = () => {
    const now = Date.now();
    if (now - tappedAt.current < 300) return;
    tappedAt.current = now;
    fireComplete();
  };

  const iconKey = pascalCase(task.icon);
  const IconMap = Icons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>>;
  const LucideIcon: React.ComponentType<{ size?: number; className?: string }> =
    CUSTOM_ICON_MAP[task.icon] ??
    (IconMap[iconKey] || (console.error(`[TaskCard] 아이콘 없음: "${task.icon}" → "${iconKey}"`), Icons.Circle));

  return (
    // Outer: fixed height, overflow:visible so particles escape freely
    <div className="relative" style={{ height: CARD_H }}>

      {/* Swipe success bg — absolute, zero layout impact */}
      <motion.div
        style={{ opacity: bgOpacity }}
        className="absolute inset-0 rounded-2xl bg-[var(--success)] flex items-center justify-end pr-5"
      >
        <motion.div style={{ opacity: checkOpacity }}>
          <Icons.Check size={24} className="text-white" strokeWidth={3} />
        </motion.div>
      </motion.div>

      {/* Card — absolute inset-0 + overflow-hidden: content is ALWAYS clipped to CARD_H.
          ring-1 ring-inset paints inside the border-box → zero layout contribution.
          Both states (active/completed) carry a ring, so box-model is always identical. */}
      <motion.div
        drag={completed ? false : 'x'}
        dragConstraints={{ left: 0, right: SWIPE_TRIGGER_PX + 60 }}
        dragElastic={0.15}
        onDragEnd={handleDragEnd}
        onTap={handleTap}
        style={{ x }}
        whileTap={{ scale: 0.97 }}
        className={[
          'absolute inset-0 overflow-hidden rounded-2xl bg-[var(--bg-card)]',
          'px-3 py-2 flex items-center gap-2.5 cursor-pointer',
          'ring-1 ring-inset',
          completed ? 'ring-[var(--accent)] opacity-55' : 'ring-[var(--border)]',
        ].join(' ')}
      >
        {/* Icon — w-8 h-8 = 32px, meets legibility; shrink-0 prevents squishing */}
        <div className="w-8 h-8 rounded-xl bg-[var(--accent-glow)] flex items-center justify-center shrink-0">
          <LucideIcon size={16} className="text-[var(--accent)]" />
        </div>

        {/* Text — text-sm title, text-xs points, line-clamp-2 prevents overflow */}
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-semibold leading-tight line-clamp-2 ${completed ? 'line-through' : ''}`}>
            {task.title}
          </div>
          <div className="text-xs text-[var(--fg-muted)] mt-0.5 truncate">
            +{task.basePoints}pt
            {task.timeWindow && ` · ${TIME_WINDOW_LABEL[task.timeWindow]}`}
          </div>
        </div>

        {/* Completed toggle — w-10 h-10 (40px) touch target, shrink-0 */}
        {completed && (
          <div className="w-10 h-10 flex items-center justify-center shrink-0">
            <Icons.CheckCircle2 size={22} className="text-[var(--success)]" />
          </div>
        )}
      </motion.div>

      {/* Particles render outside card overflow, free to animate anywhere */}
      <Particles particles={particles} theme={theme} />
    </div>
  );
}
