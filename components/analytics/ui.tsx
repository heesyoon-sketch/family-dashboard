'use client';

// Shared building blocks for Stats and Shield Wall (Midnight Aurora).

import Image from 'next/image';
import type { ReactNode } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Minus, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Localized } from '@/lib/analytics/insights';

export const MEMBER_TONES = ['#79E8BD', '#A5A6FF', '#E8C77B', '#F2A7C3', '#7FD3F7', '#C4B5FD'];

export function useCopy() {
  const { lang } = useLanguage();
  const en = lang === 'en';
  return { lang, en, t: (copy: Localized) => (en ? copy.en : copy.ko) };
}

export function formatDay(day: string, en: boolean, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  return new Intl.DateTimeFormat(en ? 'en-US' : 'ko-KR', { ...options, timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
}

export function pctText(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`;
}

export function Section({ id, title, subtitle, action, children, className = '' }: {
  id?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={`scroll-mt-20 rounded-2xl border border-white/[0.08] bg-[#151a2e]/80 p-4 sm:p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={id ? `${id}-title` : undefined} className="text-base font-bold text-[#F4F5FA] sm:text-lg">{title}</h2>
          {subtitle && <p className="mt-1 text-sm leading-relaxed text-[#A9AECB]">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label, size = 'md' }: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-white/10 bg-black/20 p-1">
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`shrink-0 rounded-lg font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A5A6FF] ${size === 'sm' ? 'min-h-9 px-2.5 text-xs' : 'min-h-11 px-3.5 text-sm'} ${value === option.value ? 'bg-[#A5A6FF] text-[#141733]' : 'text-[#B3B7CE] hover:bg-white/[0.06] hover:text-white'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function MemberAvatar({ name, avatarUrl, tone, size = 40 }: { name: string; avatarUrl?: string; tone: string; size?: number }) {
  if (avatarUrl) {
    return <Image src={avatarUrl} alt="" width={size} height={size} referrerPolicy="no-referrer" className="shrink-0 rounded-xl object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-xl font-bold text-[#141733]" style={{ width: size, height: size, background: tone, fontSize: size * 0.4 }}>
      {Array.from(name)[0] ?? '?'}
    </span>
  );
}

export function PointDelta({ points, className = '' }: { points: number | null; className?: string }) {
  const { en } = useCopy();
  if (points === null) return <span className={`text-xs font-semibold text-[#8E94B4] ${className}`}>{en ? 'Not enough data' : '비교할 기록 부족'}</span>;
  const Icon = points > 0 ? ArrowUpRight : points < 0 ? ArrowDownRight : Minus;
  const color = points > 0 ? 'text-[#79E8BD]' : points < 0 ? 'text-[#F2B8A0]' : 'text-[#B3B7CE]';
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${color} ${className}`}>
      <Icon size={14} aria-hidden />
      {points > 0 ? '+' : ''}{points}%p
      <span className="sr-only">{en ? ' percentage points' : ' 퍼센트포인트'}</span>
    </span>
  );
}

export function ErrorBanner({ onRetry, stale }: { onRetry: () => void; stale: boolean }) {
  const { en } = useCopy();
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E8C77B]/25 bg-[#E8C77B]/[0.07] px-4 py-3 text-sm text-[#F3E3BC]">
      <AlertTriangle size={16} aria-hidden />
      <span className="min-w-0 flex-1">
        {stale
          ? (en ? 'Could not refresh. Showing the last records we loaded.' : '새로고침하지 못했어요. 마지막으로 불러온 기록을 보여드려요.')
          : (en ? 'Could not load your records.' : '기록을 불러오지 못했어요.')}
      </span>
      <button type="button" onClick={onRetry} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/15 px-3 font-semibold hover:bg-white/10">
        <RefreshCw size={14} aria-hidden /> {en ? 'Retry' : '다시 시도'}
      </button>
    </div>
  );
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3 p-4">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map(i => <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/[0.04] motion-reduce:animate-none" />)}
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-white/12 px-4 py-6 text-center text-sm leading-relaxed text-[#A9AECB]">{children}</p>;
}
