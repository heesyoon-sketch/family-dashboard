'use client';

import { motion, useMotionValue, useTransform, useReducedMotion, animate } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
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
import { toast } from 'sonner';
import { taskDurationOptionForPoints } from '@/lib/taskDurationPoints';

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
  disabledReason?: 'deadline';
  timeWindowDisplay: string;
}

export function TaskCard({
  task,
  completed,
  theme,
  disabled = false,
  disabledReason,
  timeWindowDisplay,
}: TaskCardProps) {
  const { lang } = useLanguage();
  const reducedMotion = useReducedMotion();
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
  const busyRef = useRef(false);
  const gesture = useRef({ cancelled: false, completed });
  const particleTimer             = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerEffects = (clientX?: number, clientY?: number) => {
    if (soundEnabled) playCompletionSound(task.id);
    if (reducedMotion) return;
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
    if (!reducedMotion) setRippleKey(k => k + 1);
  };

  const fireComplete = async (clientX?: number, clientY?: number) => {
    if (busyRef.current || disabled) return;
    busyRef.current = true;
    setBusy(true);
    try {
      if (completed) {
        triggerUndoEffects();
        await undoCompletion(task.userId, task.id);
      } else {
        triggerEffects(clientX, clientY);
        const feedback = await markCompleted(task.userId, task.id);
        if (feedback?.status === 'queued') {
          toast.message(lang === 'en' ? 'Saved offline' : '오프라인에 저장됨', {
            description: lang === 'en'
              ? 'This completion will sync automatically when the connection returns.'
              : '연결이 돌아오면 이 완료 기록이 자동으로 동기화됩니다.',
          });
        }
        if (feedback?.status === 'awarded') {
          const bonusPoints = Math.max(0, feedback.pointsAwarded - feedback.basePoints);
          const detail = feedback.perfectQuestAwarded && feedback.perfectQuest
            ? feedback.perfectQuest.rewardKind === 'weekend'
              ? (lang === 'en'
                  ? 'Weekend bonus complete · one extra 30-minute pass earned!'
                  : '주말 보너스 완주 · 추가 30분 이용권 1장 획득!')
              : (lang === 'en'
                  ? 'Weekday Quest complete · one 30-minute pass earned!'
                  : '평일 루틴 챌린지 완주 · 30분 이용권 1장 획득!')
            : bonusPoints > 0
              ? (lang === 'en'
                  ? `${feedback.basePoints} base + ${bonusPoints} bonus`
                  : `기본 ${feedback.basePoints} + 보너스 ${bonusPoints}`)
              : (lang === 'en' ? 'Points added to your balance' : '포인트가 차곡차곡 쌓였어요');
          toast.success(`+${feedback.pointsAwarded}pt`, { description: detail });
        }
      }
    } catch (error) {
      console.error('Task update failed', error);
      toast.error(lang === 'en' ? 'Could not save. Please try again.' : '저장하지 못했어요. 다시 시도해주세요.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  useEffect(() => () => {
    if (particleTimer.current) clearTimeout(particleTimer.current);
  }, []);

  // Soft, bouncy spring — feels alive without overshooting awkwardly.
  const snapBack = () => animate(x, 0, { type: 'spring', stiffness: 380, damping: 26, restDelta: 0.5 });

  // Confirm-and-release: a brief overshoot to acknowledge the swipe, then
  // we spring straight home. The network call fires in parallel — the UI
  // is never blocked on the RPC, so the card feels instantly responsive.
  const runSwipeAction = (targetX: number, clientX?: number, clientY?: number) => {
    if (disabled || busyRef.current) return;
    void fireComplete(clientX, clientY);
    animate(x, targetX, {
      duration: 0.09,
      ease: 'easeOut',
      onComplete: () => snapBack(),
    });
  };

  const handleDragEnd = (_: unknown, info: { offset: { x: number; y: number }; point: { x: number; y: number } }) => {
    if (busyRef.current || disabled || gesture.current.cancelled || gesture.current.completed !== completed
      || Math.abs(info.offset.x) <= Math.abs(info.offset.y)) {
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
  const iconCandidate = CUSTOM_ICON_MAP[task.icon] ?? IconMap[iconKey];
  const LucideIcon: React.ComponentType<{ size?: number; className?: string }> = iconCandidate ?? Icons.Circle;
  const iconMissing = !iconCandidate;
  // Log missing icons in an effect, not during render — render-phase side
  // effects fire on every commit (and React StrictMode double-fires them).
  useEffect(() => {
    if (iconMissing) {
      console.error(`[TaskCard] 아이콘 없음: "${task.icon}" → "${iconKey}"`);
    }
  }, [iconMissing, task.icon, iconKey]);

  // Points are now the simple base reward — no streak multipliers, no
  // tier glow. Momentum/harmony bonuses live on the dashboard HUD instead
  // of bleeding optimization pressure into individual habits.
  const displayPts = task.basePoints;
  const duration = taskDurationOptionForPoints(task.basePoints);
  const toggleLabel = completed
    ? (lang === 'en' ? `Undo ${task.title}` : `${task.title} 취소`)
    : (lang === 'en' ? `Complete ${task.title}` : `${task.title} 완료`);
  const accessibleLabel = disabledReason === 'deadline'
    ? (lang === 'en' ? `${task.title}, deadline passed` : `${task.title}, 마감됨`)
    : toggleLabel;
  const swipeHint = completed
    ? (lang === 'en' ? 'Drag left to undo · Left arrow key' : '왼쪽으로 드래그하여 취소 · 왼쪽 방향키')
    : (lang === 'en' ? 'Drag right to complete · Right arrow key' : '오른쪽으로 드래그하여 완료 · 오른쪽 방향키');

  return (
    <div className="relative h-full w-full">

      {/* Swipe success bg — absolute, zero layout impact */}
      {!completed && !disabled && (
        <motion.div
          aria-hidden
          style={{ opacity: completeBgOpacity }}
          className="pointer-events-none absolute inset-0 flex items-center justify-start rounded-xl bg-[var(--success)] pl-4"
        >
          <motion.div style={{ opacity: completeHintOpacity }} className="flex items-center gap-1.5 text-sm font-bold text-[var(--completion-fg)]">
            <span>{lang === 'en' ? 'Done' : '완료'}</span>
            <Icons.Check size={21} strokeWidth={3} />
          </motion.div>
        </motion.div>
      )}
      {completed && !disabled && (
        <motion.div
          aria-hidden
          style={{ opacity: undoBgOpacity }}
          className="pointer-events-none absolute inset-0 flex items-center justify-end rounded-xl bg-[var(--accent)] pr-4"
        >
          <motion.div style={{ opacity: undoHintOpacity }} className="flex items-center gap-1.5 text-sm font-bold text-[var(--completion-fg)]">
            <Icons.RotateCcw size={18} strokeWidth={3} />
            <span>{lang === 'en' ? 'Undo' : '취소'}</span>
          </motion.div>
        </motion.div>
      )}

      {/* Card — absolute inset-0 + overflow-hidden: content is ALWAYS clipped to CARD_H.
          ring-1 ring-inset paints inside the border-box → zero layout contribution.
          Both states (active/completed) carry a ring, so box-model is always identical. */}
      <motion.button
        type="button"
        disabled={disabled || busy}
        drag={disabled || busy ? false : 'x'}
        dragConstraints={completed ? { left: -SWIPE_LIMIT_PX, right: 0 } : { left: 0, right: SWIPE_LIMIT_PX }}
        dragDirectionLock
        dragElastic={completed ? { left: 0.18, right: 0 } : { left: 0, right: 0.18 }}
        dragMomentum={false}
        dragTransition={{ bounceStiffness: 380, bounceDamping: 26 }}
        onDragEnd={handleDragEnd}
        onPointerDownCapture={() => {
          gesture.current = { cancelled: false, completed };
        }}
        onPointerCancelCapture={() => { gesture.current.cancelled = true; }}
        // Clicks, including the click generated after a drag, never change state.
        onClick={event => event.preventDefault()}
        onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
          event.preventDefault();
          if (event.repeat || disabled || busyRef.current) return;
          if (event.key !== (completed ? 'ArrowLeft' : 'ArrowRight')) return;
          const rect = event.currentTarget.getBoundingClientRect();
          void fireComplete(rect.left + rect.width / 2, rect.top + rect.height / 2);
        }}
        aria-busy={busy}
        aria-disabled={disabled || busy}
        aria-pressed={completed}
        data-completed={completed}
        aria-label={accessibleLabel}
        aria-description={disabled ? timeWindowDisplay : `${timeWindowDisplay}. ${swipeHint}`}
        aria-keyshortcuts={disabled ? undefined : completed ? 'ArrowLeft' : 'ArrowRight'}
        title={disabled ? timeWindowDisplay : swipeHint}
        style={{ x, rotate: reducedMotion ? 0 : cardRotate, scale: reducedMotion ? 1 : cardScale, touchAction: 'pan-y' }}
        className={[
          'member-task-card absolute inset-0 w-full overflow-hidden rounded-xl bg-[var(--task-card-bg)] text-left',
          'px-3 py-1 flex items-center gap-2.5 md:px-2.5 md:gap-2',
          disabled || busy ? 'cursor-default' : 'cursor-grab active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--accent)]',
          'ring-1 ring-inset ring-[var(--task-card-border)] shadow-[var(--task-card-shadow)] transition-colors duration-200',
        ].join(' ')}
      >
        {/* Icon — 40px, readable and comfortable on touch screens */}
        <span aria-hidden className="relative w-10 h-10 rounded-xl bg-[var(--surface-elevated)] flex items-center justify-center shrink-0 md:h-8 md:w-8 md:rounded-lg">
          <LucideIcon size={19} className={completed ? 'text-[var(--success)]' : 'text-[var(--secondary)]'} />
        </span>

        {/* Text — text-sm title, text-xs points, line-clamp-2 prevents overflow */}
        <span className="flex-1 min-w-0">
          <span className={`text-base font-semibold leading-tight line-clamp-2 md:text-[13px] min-[1200px]:text-sm ${completed ? 'text-[var(--fg-secondary)] line-through decoration-[var(--success)]/60' : 'text-[var(--fg)]'}`}>
            {task.title}
          </span>
          <span className="text-[11px] leading-none mt-0.5 truncate flex items-center gap-1 text-[var(--fg-secondary)]">
            <span className="flex shrink-0 items-center gap-0.5"><Icons.Clock3 size={10} aria-hidden />{duration.label[lang]}</span>
            <span className={completed ? 'shrink-0 text-[var(--success)]' : 'shrink-0'}>· +{displayPts}pt</span>
            {disabled && (
              <span className="shrink-0 rounded-full bg-[var(--border)]/70 px-1 py-0.5 text-[9px] font-bold leading-none">
                {disabledReason === 'deadline'
                  ? (lang === 'en' ? 'Closed' : '마감')
                  : (lang === 'en' ? 'Locked' : '대기')}
              </span>
            )}
          </span>
        </span>

        <span aria-hidden className="flex w-8 shrink-0 flex-col items-center gap-0.5">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${completed ? 'border-[var(--success)] bg-[var(--success)] text-[var(--completion-fg)]' : 'border-[var(--fg-muted)]/40 text-[var(--fg-muted)]'}`}>
            {busy ? <Icons.LoaderCircle size={18} className="animate-spin" />
              : disabled && !completed ? <Icons.LockKeyhole size={14} />
                : completed ? <Icons.Check size={19} strokeWidth={3} /> : <Icons.ArrowRight size={16} />}
          </span>
          {completed && <span className="text-[9px] font-bold leading-none text-[var(--success)]">{lang === 'en' ? 'Done' : '완료'}</span>}
        </span>
      </motion.button>

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
