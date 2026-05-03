'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, ChevronLeft, ChevronRight, Flame, Sparkles, TrendingDown, TrendingUp, X } from 'lucide-react';
import type { WeeklyRecap } from '@/lib/store';
import { useFamilyStore } from '@/lib/store';
import { useLanguage } from '@/contexts/LanguageContext';

interface RecapEntry {
  recap: WeeklyRecap;
  user: ReturnType<typeof useFamilyStore.getState>['users'][number];
}

export function WeeklyRecapModal({ entries, onDismiss }: { entries: RecapEntry[]; onDismiss: () => void }) {
  const { lang } = useLanguage();
  const [page, setPage] = useState(0);

  const total = entries.length;
  const safePage = Math.min(page, Math.max(0, total - 1));
  const current = entries[safePage];

  // Confetti emojis floating across the modal — randomised once per mount via lazy init.
  const [confetti] = useState(() =>
    Array.from({ length: 14 }, (_, i) => ({
      key: i,
      emoji: ['✨', '🎉', '⭐', '🔥', '💫'][i % 5],
      x: Math.random() * 100,
      delay: Math.random() * 0.8,
      duration: 3.5 + Math.random() * 1.5,
    })),
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
      if (e.key === 'ArrowRight') setPage(p => Math.min(total - 1, p + 1));
      if (e.key === 'ArrowLeft') setPage(p => Math.max(0, p - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total, onDismiss]);

  if (!current) return null;

  const { recap, user } = current;
  const weekLabel = formatWeekLabel(new Date(recap.weekStartISO), lang);
  const delta = recap.deltaPct;
  const dir = delta === null ? 'flat' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const deltaColor = dir === 'up' ? 'text-[#3ddc97]' : dir === 'down' ? 'text-[#ff9aa6]' : 'text-white/55';

  const headline = pickHeadline(recap, lang);

  return (
    <AnimatePresence>
      <motion.div
        key="recap-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDismiss}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-pointer"
      >
        <motion.div
          key={`recap-card-${user.id}-${recap.weekStartISO}`}
          data-theme={user.theme}
          initial={{ scale: 0.85, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          onClick={e => e.stopPropagation()}
          className="relative w-[min(92vw,420px)] overflow-hidden rounded-3xl bg-[var(--bg-card)] text-[var(--fg)] shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
          style={{ boxShadow: '0 0 60px var(--accent-glow)' }}
        >
          {/* Confetti layer */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {confetti.map(c => (
              <motion.span
                key={c.key}
                initial={{ y: -40, opacity: 0 }}
                animate={{ y: 540, opacity: [0, 1, 1, 0] }}
                transition={{ duration: c.duration, delay: c.delay, repeat: Infinity, ease: 'easeIn' }}
                className="absolute text-base"
                style={{ left: `${c.x}%` }}
              >
                {c.emoji}
              </motion.span>
            ))}
          </div>

          <button
            type="button"
            onClick={onDismiss}
            aria-label={lang === 'en' ? 'Close' : '닫기'}
            className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/30 text-white/80 transition hover:bg-black/50"
          >
            <X size={16} />
          </button>

          <div className="relative px-5 pb-5 pt-7">
            <div className="mb-4 text-center">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
                {lang === 'en' ? 'Weekly Recap' : '주간 리캡'}
              </div>
              <div className="mt-1 text-[11px] text-white/55">{weekLabel}</div>
            </div>

            <div className="mb-4 flex items-center justify-center gap-3">
              {user.avatarUrl ? (
                <Image
                  src={user.avatarUrl}
                  alt={user.name}
                  width={48}
                  height={48}
                  referrerPolicy="no-referrer"
                  className="h-12 w-12 rounded-xl object-cover ring-2 ring-[var(--accent)]"
                />
              ) : (
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--accent-glow)] text-xl font-bold text-[var(--accent)] ring-2 ring-[var(--accent)]">
                  {user.name[0]}
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate text-xl font-bold">{user.name}</div>
                <div className="text-xs font-semibold text-[var(--fg-muted)]">{headline}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <RecapStat
                icon={<Sparkles size={16} />}
                label={lang === 'en' ? 'Points earned' : '획득 포인트'}
                value={`${recap.weeklyPoints}`}
                suffix="pt"
              />
              <RecapStat
                icon={<Award size={16} />}
                label={lang === 'en' ? 'Perfect days' : '완벽한 날'}
                value={`${recap.perfectDays}`}
                suffix="/7"
              />
              <RecapStat
                icon={<Flame size={16} />}
                label={lang === 'en' ? 'Day streak' : '연속 일'}
                value={`${recap.dailyStreak}`}
                suffix="d"
              />
              <RecapStat
                icon={dir === 'up' ? <TrendingUp size={16} /> : dir === 'down' ? <TrendingDown size={16} /> : <Sparkles size={16} />}
                label={lang === 'en' ? 'vs last week' : '지난주 대비'}
                value={delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta}%`}
                valueClassName={deltaColor}
              />
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-white/55">
                <span>{lang === 'en' ? 'Completion' : '완료율'}</span>
                <span>{recap.weekDone}/{recap.weekPossible}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, recap.weekPct)}%` }}
                  transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
                  className="h-full rounded-full bg-[var(--accent)]"
                />
              </div>
              {recap.topTaskTitle && (
                <div className="mt-2.5 text-[11px] text-white/65">
                  {lang === 'en' ? 'Top habit: ' : '최고 습관: '}
                  <span className="font-semibold text-white">{recap.topTaskTitle}</span>
                  <span className="ml-1 text-white/45">×{recap.topTaskCount}</span>
                </div>
              )}
            </div>

            {/* Pager */}
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={safePage === 0}
                aria-label="Previous"
                className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/[0.04] text-white/70 transition hover:bg-white/10 disabled:pointer-events-none disabled:opacity-25"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex items-center gap-1.5">
                {entries.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPage(i)}
                    className={`h-1.5 rounded-full transition-all ${i === safePage ? 'w-5 bg-[var(--accent)]' : 'w-1.5 bg-white/25 hover:bg-white/40'}`}
                    aria-label={`Recap ${i + 1}`}
                  />
                ))}
              </div>
              {safePage < total - 1 ? (
                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(total - 1, p + 1))}
                  aria-label="Next"
                  className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/[0.04] text-white/70 transition hover:bg-white/10"
                >
                  <ChevronRight size={18} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-bold text-gray-950 transition hover:brightness-105"
                >
                  {lang === 'en' ? "Let's go" : '시작!'}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function RecapStat({
  icon, label, value, suffix, valueClassName,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/55">
        <span className="text-[var(--accent)]">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className={`flex items-baseline gap-1 text-2xl font-extrabold leading-none ${valueClassName ?? 'text-white'}`}>
        <span className="tabular-nums">{value}</span>
        {suffix && <span className="text-xs font-bold text-white/45">{suffix}</span>}
      </div>
    </div>
  );
}

function formatWeekLabel(monday: Date, lang: 'en' | 'ko'): string {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const locale = lang === 'en' ? 'en-US' : 'ko-KR';
  const fmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
  const a = fmt.format(monday);
  const b = fmt.format(sunday);
  return lang === 'en' ? `Week of ${a} – ${b}` : `${a} – ${b} 주간`;
}

function pickHeadline(r: WeeklyRecap, lang: 'en' | 'ko'): string {
  if (r.weekDone === 0) {
    return lang === 'en' ? 'A fresh start awaits 🌱' : '새로운 한 주를 시작해요 🌱';
  }
  if (r.perfectDays >= 5) {
    return lang === 'en' ? 'Unstoppable week! 🚀' : '멈출 수 없는 한 주! 🚀';
  }
  if (r.deltaPct !== null && r.deltaPct >= 15) {
    return lang === 'en' ? `Big jump — up ${r.deltaPct}% 📈` : `크게 향상 — ${r.deltaPct}% 상승 📈`;
  }
  if (r.dailyStreak >= 7) {
    return lang === 'en' ? `${r.dailyStreak}-day streak — keep it alive 🔥` : `${r.dailyStreak}일 연속 — 이어가요 🔥`;
  }
  if (r.weekPct >= 80) {
    return lang === 'en' ? 'Crushing it 💪' : '아주 잘했어요 💪';
  }
  return lang === 'en' ? 'Solid week — keep going!' : '꾸준한 한 주였어요!';
}
