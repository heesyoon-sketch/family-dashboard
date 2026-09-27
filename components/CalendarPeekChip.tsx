'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import type { CalendarEvent } from '@/lib/ics';
import { addDays, calendarColor, groupEventsByDay, localDateKey, startOfDay, useFamilyCalendar } from '@/lib/familyCalendar';

/**
 * Header glance at today's and tomorrow's events; tapping opens /calendar.
 * Renders nothing until the calendar is connected and loaded.
 */
export function CalendarPeekChip() {
  const { lang } = useLanguage();
  const today = startOfDay(new Date());
  const todayKey = localDateKey(today);
  const tomorrowKey = localDateKey(addDays(today, 1));
  const { state, events } = useFamilyCalendar(todayKey, localDateKey(addDays(today, 2)));

  if (state !== 'ready') return null;

  const byDay = groupEventsByDay(events);
  const timeFormat = new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ko-KR', { hour: 'numeric', minute: '2-digit' });
  const days = [
    { key: todayKey, label: lang === 'en' ? 'Today' : '오늘', accent: 'text-[#4EEDB0]' },
    { key: tomorrowKey, label: lang === 'en' ? 'Tomorrow' : '내일', accent: 'text-[#8EAFFF]' },
  ];
  const describe = (event: CalendarEvent) => (event.allDay ? event.title : `${timeFormat.format(new Date(event.start))} ${event.title}`);
  const title = days
    .map(day => `${day.label}: ${(byDay.get(day.key) ?? []).map(describe).join(', ') || '-'}`)
    .join('\n');

  return (
    <Link
      href="/calendar"
      title={title}
      aria-label={title}
      className="hidden h-9 min-w-0 flex-1 items-center gap-4 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs transition hover:bg-white/10 md:flex"
    >
      {days.map(day => {
        const dayEvents = byDay.get(day.key) ?? [];
        // Wider screens have room for a second event per day.
        const shown = dayEvents.slice(0, 2);
        return (
          <span key={day.key} className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className={`shrink-0 font-black ${day.accent}`}>{day.label}</span>
            {shown.length === 0 && <span className="truncate text-white/30">{lang === 'en' ? 'Free' : '일정 없음'}</span>}
            {shown.map((event, index) => (
              <span
                key={event.id}
                className={`min-w-0 items-center gap-1.5 ${index === 0 ? 'flex' : 'hidden lg:flex'}`}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: calendarColor(event) }} />
                <span className="truncate font-semibold text-white/80">{describe(event)}</span>
              </span>
            ))}
            {dayEvents.length > 1 && <span className="shrink-0 font-bold text-white/40 lg:hidden">+{dayEvents.length - 1}</span>}
            {dayEvents.length > 2 && <span className="hidden shrink-0 font-bold text-white/40 lg:inline">+{dayEvents.length - 2}</span>}
          </span>
        );
      })}
    </Link>
  );
}
