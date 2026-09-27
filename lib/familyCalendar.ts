// Shared client helpers for the family calendar page and the dashboard peek.

import { useCallback, useEffect, useState } from 'react';
import type { CalendarEvent } from '@/lib/ics';

export const CALENDAR_COLORS = ['#4EEDB0', '#5B8EFF', '#FF7BAC', '#FFB830', '#B78BFF'];

export type CalendarLoadState = 'loading' | 'ready' | 'unauthorized' | 'unconfigured' | 'error';

export function calendarColor(event: CalendarEvent): string {
  return CALENDAR_COLORS[event.calendarIndex % CALENDAR_COLORS.length];
}

export function localDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Sunday-based week start, matching Korean wall calendars. */
export function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  return addDays(day, -day.getDay());
}

/** Days this event should appear on (local time). */
export function eventDayKeys(event: CalendarEvent): string[] {
  if (!event.allDay) {
    return [localDateKey(new Date(event.start))];
  }
  // All-day: date strings, DTEND exclusive.
  const start = new Date(`${event.start}T00:00:00`);
  const endExclusive = event.end ? new Date(`${event.end}T00:00:00`) : addDays(start, 1);
  const keys: string[] = [];
  for (let d = start; d < endExclusive && keys.length < 62; d = addDays(d, 1)) {
    keys.push(localDateKey(d));
  }
  return keys;
}

/** Events bucketed by local day, all-day first then by start time. */
export function groupEventsByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const byDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    for (const key of eventDayKeys(event)) {
      const list = byDay.get(key) ?? [];
      list.push(event);
      byDay.set(key, list);
    }
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start));
  }
  return byDay;
}

/**
 * Loads /api/family-calendar for [from, to) (local day keys) and refreshes on
 * window focus. Previous events stay on screen while a new range loads.
 */
export function useFamilyCalendar(from: string, to: string) {
  const [state, setState] = useState<CalendarLoadState>('loading');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    try {
      const params = new URLSearchParams({ from, to });
      const response = await fetch(`/api/family-calendar?${params}`, { cache: 'no-store' });
      if (response.status === 401) { setState('unauthorized'); return; }
      if (!response.ok) { setState('error'); return; }
      const body = await response.json() as { configured: boolean; events: CalendarEvent[] };
      if (!body.configured) { setState('unconfigured'); return; }
      setEvents(body.events);
      setState('ready');
    } catch {
      setState('error');
    } finally {
      if (asRefresh) setRefreshing(false);
    }
  }, [from, to]);

  useEffect(() => {
    // Deferred so the effect body itself never sets state synchronously.
    const initial = setTimeout(() => { void load(); }, 0);
    const onFocus = () => { void load(true); };
    window.addEventListener('focus', onFocus);
    return () => {
      clearTimeout(initial);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  return { state, events, refreshing, reload: () => load(true) };
}
