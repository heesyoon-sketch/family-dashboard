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
import confetti from 'canvas-confetti';
import { CUSTOM_ICON_MAP } from './CustomIcons';
import { useLanguage } from '@/contexts/LanguageContext';

const SWIPE_TRIGGER_PX = 110;

function pascalCase(kebab: string): string {
  return kebab.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

function startOfDayLocal(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function nextCompletionStreak(task: Task, completed: boolean): number {
  const current = task.streakCount ?? 0;
  if (completed) return current;
  if (!task.lastCompletedAt) return 1;

  const today = startOfDayLocal(new Date()).getTime();
  const yesterday = today - 86_400_000;
  const last = startOfDayLocal(task.lastCompletedAt).getTime();
  if (last >= today) return current;
  if (last >= yesterday) return current + 1;
  return 1;
}

export function TaskCard({ task, completed, theme }: { task: Task; completed: boolean; theme: ThemeName }) {
  const { t } = useLanguage();
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

  const triggerEffects = (clientX?: number, clientY?: number) => {
    if (soundEnabled) playCompletionSound(theme);
    if (particleTimer.current) clearTimeout(particleTimer.current);
    setParticles(buildParticles(theme));
    particleTimer.current = setTimeout(() => setParticles(null), 1000);

    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);

    confetti({
      particleCount: 45,
      spread: 60,
      startVelocity: 22,
      decay: 0.88,
      scalar: 0.75,
      origin: {
        x: clientX != null ? clientX / window.innerWidth : 0.5,
        y: clientY != null ? clientY / window.innerHeight : 0.5,
      },
    });
  };

  const fireComplete = async (clientX?: number, clientY?: number) => {
    if (busy) return;
    setBusy(true);
    if (completed) {
      await undoCompletion(task.userId, task.id);
    } else {
      triggerEffects(clientX, clientY);
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

  const handleTap = (event: MouseEvent | TouchEvent | PointerEvent) => {
    const now = Date.now();
    if (now - tappedAt.current < 300) return;
    tappedAt.current = now;
    const clientX = 'clientX' in event ? (event as PointerEvent).clientX : undefined;
    const clientY = 'clientY' in event ? (event as PointerEvent).clientY : undefined;
    fireComplete(clientX, clientY);
  };

  const iconKey = pascalCase(task.icon);
  const IconMap = Icons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>>;
  const LucideIcon: React.ComponentType<{ size?: number; className?: string }> =
    CUSTOM_ICON_MAP[task.icon] ??
    (IconMap[iconKey] || (console.error(`[TaskCard] 아이콘 없음: "${task.icon}" → "${iconKey}"`), Icons.Circle));

  const streak      = nextCompletionStreak(task, completed);
  const tier        = streak >= 3 ? 3 : streak >= 2 ? 2 : 1;
  const multiplier  = tier === 3 ? 1.5 : tier === 2 ? 1.2 : 1;
  const displayPts  = tier > 1 ? Math.round(task.basePoints * multiplier) : task.basePoints;
  const extraFlames = tier === 3 ? 2 : tier === 2 ? 1 : 0;
  const streakLabel = streak > 0 ? `🔥${streak}${tier === 3 ? ' 1.5×' : tier === 2 ? ' 1.2×' : ''}` : null;
  const isLightTheme = theme === 'warm_minimal' || theme === 'pastel_cute';
  const ringClass   = completed
    ? 'ring-[var(--accent)] opacity-55'
    : tier === 3
      ? 'ring-amber-400'
      : tier === 2
        ? 'ring-orange-400'
        : 'ring-[var(--task-card-border)]';
  const glowStyle: React.CSSProperties = !completed && tier === 3
    ? { boxShadow: '0 0 16px rgba(251, 191, 36, 0.45)' }
    : !completed && tier === 2
      ? { boxShadow: '0 0 10px rgba(251, 146, 60, 0.30)' }
      : {};

  return (
    <div className="relative h-full w-full">

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
        style={{ x, ...glowStyle }}
        whileTap={{ scale: 0.92 }}
        className={[
          'absolute inset-0 overflow-hidden rounded-2xl bg-[var(--task-card-bg)]',
          'px-3.5 py-2.5 flex items-center gap-3 cursor-pointer',
          'ring-1 ring-inset shadow-[var(--task-card-shadow)]',
          isLightTheme ? 'backdrop-blur-sm' : '',
          ringClass,
        ].join(' ')}
      >
        {/* Icon — 40px, readable and comfortable on touch screens */}
        <div className="relative w-10 h-10 rounded-xl bg-[var(--accent-glow)] flex items-center justify-center shrink-0">
          <LucideIcon size={19} className="text-[var(--accent)]" />
          {extraFlames > 0 && !completed && (
            <div className="absolute -right-1 -top-1 flex gap-0.5" aria-hidden="true">
              {Array.from({ length: extraFlames }).map((_, i) => (
                <span key={i} className="text-[10px] leading-none drop-shadow-sm">🔥</span>
              ))}
            </div>
          )}
        </div>

        {/* Text — text-sm title, text-xs points, line-clamp-2 prevents overflow */}
        <div className="flex-1 min-w-0">
          <div className={`text-base font-semibold leading-tight line-clamp-2 ${completed ? 'line-through' : ''}`}>
            {task.title}
          </div>
          <div className={[
            'text-xs mt-0.5 truncate flex items-center gap-1',
            tier >= 2 && !completed
              ? tier === 3 ? 'text-amber-400' : 'text-orange-400'
              : 'text-[var(--fg-muted)]',
          ].join(' ')}>
            <span>+{displayPts}pt</span>
            {task.timeWindow && <span>· {t(task.timeWindow as 'morning' | 'afternoon' | 'evening')}</span>}
            {streakLabel && !completed && (
              tier === 3
                ? <motion.span animate={{ scale: [1, 1.25, 1] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}>{streakLabel}</motion.span>
                : <span>{streakLabel}</span>
            )}
          </div>
        </div>

        {/* Completed toggle — 48px touch target, shrink-0 */}
        {completed && (
          <div className="w-12 h-12 flex items-center justify-center shrink-0">
            <Icons.CheckCircle2 size={26} className="text-[var(--success)]" />
          </div>
        )}
      </motion.div>

      {/* Particles render outside card overflow, free to animate anywhere */}
      <Particles particles={particles} theme={theme} />
    </div>
  );
}
