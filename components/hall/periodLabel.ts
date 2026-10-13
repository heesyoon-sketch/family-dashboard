import type { PeriodType } from '@/lib/shields/engine';

const fmt = (day: string, locale: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale, { ...opts, timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));

/** "the week of Oct 19–25" / "10월 19일~25일 주간", "November 2026" / "2026년 11월". */
export function periodLabel(type: PeriodType, start: string, end: string): { en: string; ko: string } {
  if (type === 'month') {
    return { en: fmt(start, 'en-US', { month: 'long', year: 'numeric' }), ko: fmt(start, 'ko-KR', { month: 'long', year: 'numeric' }) };
  }
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return {
    en: `the week of ${fmt(start, 'en-US', { month: 'short', day: 'numeric' })}–${sameMonth ? Number(end.slice(8)) : fmt(end, 'en-US', { month: 'short', day: 'numeric' })}`,
    ko: `${fmt(start, 'ko-KR', { month: 'long', day: 'numeric' })}~${sameMonth ? `${Number(end.slice(8))}일` : fmt(end, 'ko-KR', { month: 'long', day: 'numeric' })} 주간`,
  };
}
