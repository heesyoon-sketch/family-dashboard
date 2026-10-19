'use client';

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { MOMENTUM_STATES, type MomentumResult, type MomentumState } from '@/lib/progression';

const STATE_GRADIENT: Record<MomentumState, string> = {
  spark:        'radial-gradient(circle at 50% 60%, #6b6f7a 0%, #2a2d3a 70%)',
  warm:         'radial-gradient(circle at 50% 60%, #B7A0CC 0%, #514361 75%)',
  bright:       'radial-gradient(circle at 50% 60%, #E8C77B 0%, #8B754E 75%)',
  blazing:      'radial-gradient(circle at 50% 60%, #E8C77B 0%, #C79268 60%, #614637 100%)',
  overflowing:  'radial-gradient(circle at 50% 60%, #fff7a8 0%, #ffafd5 50%, #7adff2 100%)',
};

const STATE_RING: Record<MomentumState, string> = {
  spark:        'rgba(140,148,162,0.55)',
  warm:         'rgba(255,179,122,0.65)',
  bright:       'rgba(255,209,102,0.75)',
  blazing:      'rgba(255,120,73,0.78)',
  overflowing:  'rgba(255,175,213,0.85)',
};

// Visual only: momentum adds no points. Weekly Shields are the only bonus.
const STATE_COPY: Record<MomentumState, { ko: string; en: string; koDescription: string }> = {
  spark:       { en: 'Spark',       ko: '불씨',   koDescription: '조용한 시작이에요. 해내는 만큼 불꽃이 자라요.' },
  warm:        { en: 'Warm',        ko: '따뜻함', koDescription: '리듬이 생기고 있어요. 불꽃이 꾸준히 타요.' },
  bright:      { en: 'Bright',      ko: '밝음',   koDescription: '대부분의 날에 해내고 있어요.' },
  blazing:     { en: 'Blazing',     ko: '활활',   koDescription: '든든한 리듬이 나를 앞으로 밀어줘요.' },
  overflowing: { en: 'Overflowing', ko: '눈부심', koDescription: '반짝반짝! 집 전체가 그 리듬을 느껴요.' },
};

interface Props {
  momentum: MomentumResult;
  /** Compact mode renders a chip-sized inline aura for the dashboard. */
  size?: number;
  showLabel?: boolean;
  className?: string;
}

export function MomentumAura({ momentum, size = 28, showLabel = false, className }: Props) {
  const reducedMotion = useReducedMotion();
  const exceptional = momentum.state === 'overflowing';
  const intensity = momentum.meta.intensity;
  const [open, setOpen] = useState(false);

  const { lang } = useLanguage();
  const name = lang === 'en' ? STATE_COPY[momentum.state].en : STATE_COPY[momentum.state].ko;
  const aura = (
    <div
      aria-hidden
      className="relative shrink-0 overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        background: STATE_GRADIENT[momentum.state],
        boxShadow: !exceptional || reducedMotion ? 'none' : `0 0 ${Math.round(size * 0.45)}px ${STATE_RING[momentum.state]}`,
        opacity: 0.4 + intensity * 0.6,
      }}
    >
      {exceptional && !reducedMotion && (
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
  );

  return (
    <div className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      {showLabel ? (
        // The flame alone; tapping it explains the rhythm. No text label, so
        // it never reads like a points bonus.
        <button
          type="button"
          onClick={event => {
            event.stopPropagation();
            setOpen(true);
          }}
          aria-label={lang === 'en' ? `Rhythm flame: ${name}. Tap to learn more.` : `리듬 불꽃: ${name}. 눌러서 알아보기.`}
          title={lang === 'en' ? `Rhythm flame: ${name}` : `리듬 불꽃: ${name}`}
          className="grid place-items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          {aura}
        </button>
      ) : aura}
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
  const { lang } = useLanguage();
  const en = lang === 'en';
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
          aria-label={en ? 'Close' : '닫기'}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <X size={16} />
        </button>

        <div className="mb-1 text-[11px] font-black uppercase tracking-[0.18em] text-white/45">
          {en ? 'Rhythm flame' : '리듬 불꽃'}
        </div>
        <h2 className="text-xl font-black leading-tight">
          {en ? 'The flame you carry day to day' : '매일 지켜가는 나의 불꽃'}
        </h2>
        <p className="mt-1 text-sm leading-snug text-white/65">
          {en
            ? 'It shows the rhythm of your last two weeks: the share of your required routine you finish each day. Rest days with nothing scheduled don’t dim it. It is just for fun — it adds no points.'
            : '최근 2주 동안 매일 필수 루틴을 얼마나 해냈는지 보여줘요. 할 일이 없는 날은 불꽃을 줄이지 않아요. 보기만 하는 표시라 포인트는 붙지 않아요.'}
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
                      state.state !== 'overflowing'
                        ? 'none'
                        : `0 0 12px ${STATE_RING[state.state]}`,
                    opacity: 0.5 + state.intensity * 0.5,
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-black uppercase tracking-wider">
                        {en ? STATE_COPY[state.state].en : STATE_COPY[state.state].ko}
                      </span>
                      {isCurrent && (
                        <span className="rounded-full bg-[var(--accent)]/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-[var(--accent)]">
                          {en ? 'You' : '지금'}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mt-0.5 text-[13px] leading-snug text-white/65">
                    {en ? state.description : STATE_COPY[state.state].koDescription}
                  </p>
                  <p className="mt-1 text-[11px] text-white/40">
                    {en ? `score ${state.minScore}+ / 100` : `${state.minScore}점 이상 / 100`}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="mt-4 text-[11px] leading-snug text-white/45">
          {en ? 'Extra points come only from your weekly shields.' : '추가 포인트는 주간 쉴드에서만 받아요.'}
        </p>
      </motion.div>
    </motion.div>
  );
}
