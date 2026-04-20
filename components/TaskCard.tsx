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

const SWIPE_TRIGGER_PX = 110;
const TIME_WINDOW_LABEL: Record<string, string> = {
  morning: '아침',
  afternoon: '오후',
  evening: '저녁',
};

function pascalCase(kebab: string): string {
  return kebab
    .split('-')
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

export function TaskCard({ task, completed, theme }: { task: Task; completed: boolean; theme: ThemeName }) {
  const markCompleted = useFamilyStore(s => s.markCompleted);
  const undoCompletion = useFamilyStore(s => s.undoCompletion);
  const soundEnabled = useFamilyStore(s => s.soundEnabled);
  const x = useMotionValue(0);
  const bgOpacity = useTransform(x, [0, SWIPE_TRIGGER_PX], [0, 1]);
  const checkOpacity = useTransform(x, [0, SWIPE_TRIGGER_PX * 0.5, SWIPE_TRIGGER_PX], [0, 0, 1]);
  const [busy, setBusy] = useState(false);
  const tappedAt = useRef(0);
  const [particles, setParticles] = useState<ParticleData[] | null>(null);
  const particleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  if (!IconMap[iconKey]) {
    console.error(`[TaskCard] 아이콘 없음: "${task.icon}" → "${iconKey}" (task: "${task.title}")`);
  }
  const LucideIcon = IconMap[iconKey] ?? Icons.Circle;

  return (
    <div className="relative" style={{ overflow: 'visible' }}>
      <motion.div
        style={{ opacity: bgOpacity }}
        className="absolute inset-0 rounded-2xl bg-[var(--success)] flex items-center justify-end pr-8"
      >
        <motion.div style={{ opacity: checkOpacity }}>
          <Icons.Check size={32} className="text-white" strokeWidth={3} />
        </motion.div>
      </motion.div>

      <motion.div
        drag={completed ? false : 'x'}
        dragConstraints={{ left: 0, right: SWIPE_TRIGGER_PX + 60 }}
        dragElastic={0.15}
        onDragEnd={handleDragEnd}
        onTap={handleTap}
        style={{ x }}
        whileTap={{ scale: 0.97 }}
        className={`relative rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-2.5 min-h-[44px] flex items-center gap-3 cursor-pointer ${completed ? 'opacity-50' : ''}`}
      >
        <div className="w-9 h-9 rounded-xl bg-[var(--accent-glow)] flex items-center justify-center shrink-0">
          <LucideIcon size={18} className="text-[var(--accent)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className={`font-semibold text-sm truncate ${completed ? 'line-through' : ''}`}>
            {task.title}
          </div>
          <div className="text-xs text-[var(--fg-muted)] mt-0.5">
            +{task.basePoints}pt
            {task.timeWindow && ` · ${TIME_WINDOW_LABEL[task.timeWindow]}`}
          </div>
        </div>
        {completed && (
          <div className="flex flex-col items-center gap-0.5 shrink-0">
            <Icons.CheckCircle2 size={28} className="text-[var(--success)]" />
            <span className="text-[10px] text-[var(--fg-muted)]">취소</span>
          </div>
        )}
      </motion.div>

      <Particles particles={particles} theme={theme} />
    </div>
  );
}
