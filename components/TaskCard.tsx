'use client';

import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useState, useRef } from 'react';
import * as Icons from 'lucide-react';
import { Task } from '@/lib/db';
import type { ThemeName } from '@/lib/db';
import { useFamilyStore } from '@/lib/store';
import { Particles, buildParticles } from './Particles';
import type { ParticleData } from './Particles';
import { playCompletionSound, playUndoSound } from '@/lib/sound';
import confetti from 'canvas-confetti';
import { CUSTOM_ICON_MAP } from './CustomIcons';
import { useLanguage } from '@/contexts/LanguageContext';

const SWIPE_TRIGGER_PX = 54;
const SWIPE_LIMIT_PX = 88;

function pascalCase(kebab: string): string {
  return kebab.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

interface TaskCardProps {
  task: Task;
  completed: boolean;
  theme: ThemeName;
  disabled?: boolean;
  timeWindowDisplay: string;
}

export function TaskCard({ task, completed, theme, disabled = false, timeWindowDisplay }: TaskCardProps) {
  const { lang } = useLanguage();
  const markCompleted  = useFamilyStore(s => s.markCompleted);
  const undoCompletion = useFamilyStore(s => s.undoCompletion);
  const soundEnabled   = useFamilyStore(s => s.soundEnabled);

  const x            = useMotionValue(0);
  const completeBgOpacity    = useTransform(x, [0, SWIPE_TRIGGER_PX], [0, 1]);
  const completeHintOpacity  = useTransform(x, [0, SWIPE_TRIGGER_PX * 0.55, SWIPE_TRIGGER_PX], [0, 0, 1]);
  const undoBgOpacity        = useTransform(x, [-SWIPE_TRIGGER_PX, 0], [1, 0]);
  const undoHintOpacity      = useTransform(x, [-SWIPE_TRIGGER_PX, -SWIPE_TRIGGER_PX * 0.55, 0], [1, 0, 0]);
  // Subtle tilt while dragging — the card feels like a physical object
  // pivoting under the finger rather than sliding flat.
  const cardRotate           = useTransform(x, [-SWIPE_LIMIT_PX, 0, SWIPE_LIMIT_PX], [-1.6, 0, 1.6]);
  const cardScale            = useTransform(x, [-SWIPE_LIMIT_PX, 0, SWIPE_LIMIT_PX], [0.985, 1, 0.985]);

  const [busy, setBusy]           = useState(false);
  const [particles, setParticles] = useState<ParticleData[] | null>(null);
  const [rippleKey, setRippleKey] = useState(0);
  const particleTimer             = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerEffects = (clientX?: number, clientY?: number) => {
    if (soundEnabled) playCompletionSound(task.id);
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

  // Undo: a soft "rewind" feel — quiet descending tone, single haptic
  // pulse, and an expanding ripple ring that reads as "okay, reset".
  // No confetti or particles; we don't want the gesture to feel
  // celebratory the way completion does.
  const triggerUndoEffects = () => {
    if (soundEnabled) playUndoSound();
    if (navigator.vibrate) navigator.vibrate(20);
    // Bumping the key remounts the ripple element so it replays even
    // when the user undoes several cards in quick succession.
    setRippleKey(k => k + 1);
  };

  const fireComplete = async (clientX?: number, clientY?: number) => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      if (completed) {
        triggerUndoEffects();
        await undoCompletion(task.userId, task.id);
      } else {
        triggerEffects(clientX, clientY);
        await markCompleted(task.userId, task.id);
      }
    } finally {
      setBusy(false);
    }
  };

  // Soft, bouncy spring — feels alive without overshooting awkwardly.
  const snapBack = () => animate(x, 0, { type: 'spring', stiffness: 380, damping: 26, restDelta: 0.5 });

  // Confirm-and-release: a brief overshoot to acknowledge the swipe, then
  // we spring straight home. The network call fires in parallel — the UI
  // is never blocked on the RPC, so the card feels instantly responsive.
  const runSwipeAction = (targetX: number, clientX?: number, clientY?: number) => {
    if (disabled) return;
    void fireComplete(clientX, clientY);
    animate(x, targetX, {
      duration: 0.09,
      ease: 'easeOut',
      onComplete: () => snapBack(),
    });
  };

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; point?: { x: number; y: number } }) => {
    if (busy || disabled) {
      snapBack();
      return;
    }

    if (!completed && info.offset.x >= SWIPE_TRIGGER_PX) {
      runSwipeAction(SWIPE_TRIGGER_PX + 24, info.point?.x, info.point?.y);
      return;
    }

    if (completed && info.offset.x <= -SWIPE_TRIGGER_PX) {
      runSwipeAction(-(SWIPE_TRIGGER_PX + 24), info.point?.x, info.point?.y);
      return;
    }

    snapBack();
  };

  const iconKey = pascalCase(task.icon);
  const IconMap = Icons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>>;
  const LucideIcon: React.ComponentType<{ size?: number; className?: string }> =
    CUSTOM_ICON_MAP[task.icon] ??
    (IconMap[iconKey] || (console.error(`[TaskCard] 아이콘 없음: "${task.icon}" → "${iconKey}"`), Icons.Circle));

  // Points are now the simple base reward — no streak multipliers, no
  // tier glow. Momentum/harmony bonuses live on the dashboard HUD instead
  // of bleeding optimization pressure into individual habits.
  const displayPts = task.basePoints;
  const isLightTheme = theme === 'warm_minimal' || theme === 'pastel_cute';
  // Completed state: muted background, dimmed ring, washed-out colour, and
  // a strikethrough on the title — clearly readable as "done" at a glance.
  const ringClass = completed
    ? 'ring-[var(--accent)]/40'
    : 'ring-[var(--task-card-border)]';
  const completedClass = completed ? 'opacity-60 saturate-50 grayscale-[0.35]' : '';
  const glowStyle: React.CSSProperties = {};

  return (
    <div className="relative h-full w-full">

      {/* Swipe success bg — absolute, zero layout impact */}
      {!completed && !disabled && (
        <motion.div
          style={{ opacity: completeBgOpacity }}
          className="absolute inset-0 flex items-center justify-end rounded-2xl bg-[var(--success)] pr-4"
        >
          <motion.div style={{ opacity: completeHintOpacity }} className="flex items-center gap-1.5 text-sm font-black text-white">
            <span>{lang === 'en' ? 'Done' : '완료'}</span>
            <Icons.Check size={21} strokeWidth={3} />
          </motion.div>
        </motion.div>
      )}
      {completed && !disabled && (
        <motion.div
          style={{ opacity: undoBgOpacity }}
          className="absolute inset-0 flex items-center justify-start rounded-2xl bg-[var(--accent)] pl-4"
        >
          <motion.div style={{ opacity: undoHintOpacity }} className="flex items-center gap-1.5 text-sm font-black text-white">
            <Icons.RotateCcw size={18} strokeWidth={3} />
            <span>{lang === 'en' ? 'Undo' : '취소'}</span>
          </motion.div>
        </motion.div>
      )}

      {/* Card — absolute inset-0 + overflow-hidden: content is ALWAYS clipped to CARD_H.
          ring-1 ring-inset paints inside the border-box → zero layout contribution.
          Both states (active/completed) carry a ring, so box-model is always identical. */}
      <motion.div
        drag={disabled ? false : 'x'}
        dragConstraints={completed ? { left: -SWIPE_LIMIT_PX, right: 0 } : { left: 0, right: SWIPE_LIMIT_PX }}
        dragDirectionLock
        dragElastic={0.18}
        dragMomentum={false}
        dragTransition={{ bounceStiffness: 380, bounceDamping: 26 }}
        onDragEnd={handleDragEnd}
        style={{ x, rotate: cardRotate, scale: cardScale, touchAction: 'pan-y', ...glowStyle }}
        whileTap={disabled ? undefined : { scale: 0.97 }}
        className={[
          'absolute inset-0 overflow-hidden rounded-2xl bg-[var(--task-card-bg)]',
          'px-3.5 py-2.5 flex items-center gap-3 md:px-2.5 md:py-2 md:gap-2',
          disabled ? 'cursor-not-allowed opacity-50 saturate-75' : 'cursor-grab active:cursor-grabbing',
          'ring-1 ring-inset shadow-[var(--task-card-shadow)] transition-[opacity,filter] duration-200',
          isLightTheme ? 'backdrop-blur-sm' : '',
          ringClass,
          completedClass,
        ].join(' ')}
      >
        {/* Icon — 40px, readable and comfortable on touch screens */}
        <div className="relative w-10 h-10 rounded-xl bg-[var(--accent-glow)] flex items-center justify-center shrink-0 md:h-8 md:w-8 md:rounded-lg">
          <LucideIcon size={19} className="text-[var(--accent)]" />
        </div>

        {/* Text — text-sm title, text-xs points, line-clamp-2 prevents overflow */}
        <div className="flex-1 min-w-0">
          <div className={`text-base font-semibold leading-tight line-clamp-2 md:text-sm ${completed ? 'line-through decoration-2 text-[var(--fg-muted)]' : ''}`}>
            {task.title}
          </div>
          <div className="text-[11px] mt-0.5 truncate flex items-center gap-1 md:text-[10px] text-[var(--fg-muted)]">
            <span>+{displayPts}pt</span>
            <span className="min-w-0 truncate">· {timeWindowDisplay}</span>
            {disabled && (
              <span className="shrink-0 rounded-full bg-[var(--border)]/70 px-1 py-0.5 text-[9px] font-bold leading-none">
                {lang === 'en' ? 'Locked' : '대기'}
              </span>
            )}
          </div>
        </div>

        {/* Completed toggle — 48px touch target, shrink-0 */}
        {completed && (
          <div className="w-12 h-12 flex items-center justify-center shrink-0 md:h-9 md:w-9">
            <Icons.CheckCircle2 size={26} className="text-[var(--success)]" />
          </div>
        )}
      </motion.div>

      {/* Particles render outside card overflow, free to animate anywhere */}
      <Particles particles={particles} theme={theme} />

      {/* Undo ripple — expanding ring centered on the card. The keyed
          remount makes it replay on every undo without needing to
          juggle a "playing" flag. */}
      {rippleKey > 0 && (
        <motion.span
          key={rippleKey}
          aria-hidden
          initial={{ scale: 0.2, opacity: 0.55 }}
          animate={{ scale: 1.55, opacity: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-[var(--accent)]"
        />
      )}
    </div>
  );
}
