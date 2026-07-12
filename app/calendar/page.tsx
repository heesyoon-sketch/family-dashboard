'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, Clock3, MapPin, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { CalendarEvent } from '@/lib/ics';

const CALENDAR_COLORS = ['#4EEDB0', '#5B8EFF', '#FF7BAC', '#FFB830', '#B78BFF'];

type LoadState = 'loading' | 'ready' | 'unauthorized' | 'unconfigured' | 'error';

interface DayGroup {
  key: string; // YYYY-MM-DD local
  date: Date;
  events: CalendarEvent[];
}

function localDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Days this event should appear on (local time). */
function eventDayKeys(event: CalendarEvent): string[] {
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

export default function FamilyCalendarPage() {
  const { lang } = useLanguage();
  const [state, setState] = useState<LoadState>('loading');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const copy = {
    title: lang === 'en' ? 'Family calendar' : '가족 캘린더',
    subtitle: lang === 'en' ? 'What is coming up for us' : '우리 가족의 다가오는 일정',
    back: lang === 'en' ? 'Back to dashboard' : '대시보드로 돌아가기',
    refresh: lang === 'en' ? 'Refresh' : '새로고침',
    loading: lang === 'en' ? 'Loading events…' : '일정을 불러오는 중…',
    today: lang === 'en' ? 'Today' : '오늘',
    tomorrow: lang === 'en' ? 'Tomorrow' : '내일',
    allDay: lang === 'en' ? 'All day' : '종일',
    noEvents: lang === 'en'
      ? 'No events in the next 60 days. Enjoy the calm! 🌿'
      : '앞으로 60일 동안 일정이 없어요. 여유를 즐겨요! 🌿',
    loginNeeded: lang === 'en' ? 'Please log in first.' : '먼저 로그인해 주세요.',
    fetchFailed: lang === 'en'
      ? 'Could not load the calendar. Try refreshing.'
      : '캘린더를 불러오지 못했어요. 새로고침해 주세요.',
    setupTitle: lang === 'en' ? 'Connect Google Calendar' : '구글 캘린더 연결하기',
    setupIntro: lang === 'en'
      ? 'One-time setup by a parent:'
      : '부모님이 한 번만 설정하면 돼요:',
    setupSteps: lang === 'en'
      ? [
          'Open Google Calendar on a computer and go to Settings.',
          'Pick the calendar to share under "Settings for my calendars".',
          'Copy the "Secret address in iCal format" (.ics URL).',
          'Add it to Vercel as the FAMILY_CALENDAR_ICS_URLS environment variable (multiple URLs separated by commas), then redeploy.',
        ]
      : [
          '컴퓨터에서 구글 캘린더를 열고 설정으로 이동해요.',
          '"내 캘린더 설정"에서 공유할 캘린더를 선택해요.',
          '"iCal 형식의 비밀 주소"(.ics URL)를 복사해요.',
          'Vercel 환경변수 FAMILY_CALENDAR_ICS_URLS에 붙여넣고(여러 개는 쉼표로 구분) 다시 배포해요.',
        ],
  };

  const load = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    try {
      const response = await fetch('/api/family-calendar', { cache: 'no-store' });
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
  }, []);

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

  const dayGroups = useMemo<DayGroup[]>(() => {
    const byDay = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      for (const key of eventDayKeys(event)) {
        const list = byDay.get(key) ?? [];
        list.push(event);
        byDay.set(key, list);
      }
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const groups: DayGroup[] = [];
    for (let i = 0; i <= 60; i++) {
      const date = addDays(today, i);
      const key = localDateKey(date);
      const dayEvents = byDay.get(key);
      if (!dayEvents || dayEvents.length === 0) continue;
      // All-day first, then by start time.
      dayEvents.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start));
      groups.push({ key, date, events: dayEvents });
    }
    return groups;
  }, [events]);

  const calendarNames = useMemo(() => {
    const names = new Map<number, string>();
    for (const event of events) names.set(event.calendarIndex, event.calendarName);
    return names;
  }, [events]);
  const multiCalendar = calendarNames.size > 1;

  const timeFormat = new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ko-KR', {
    hour: 'numeric', minute: '2-digit',
  });
  const dayFormat = new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ko-KR', {
    month: 'long', day: 'numeric', weekday: 'long',
  });

  const todayKey = localDateKey(new Date());
  const tomorrowKey = localDateKey(addDays(new Date(), 1));

  return (
    <div className="flex min-h-screen flex-col bg-[#0b0d12] text-white">
      <header
        className="sticky top-0 z-20 flex shrink-0 items-center gap-2 border-b border-white/10 bg-[#0b0d12]/95 px-3 backdrop-blur"
        style={{ height: 52, paddingTop: 'env(safe-area-inset-top)' }}
      >
        <Link
          href="/"
          aria-label={copy.back}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft size={17} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 truncate text-sm font-semibold text-white/90">
            <CalendarDays size={15} className="shrink-0 text-[#FFB830]" />
            {copy.title}
          </div>
          <div className="truncate text-xs text-white/45">{copy.subtitle}</div>
        </div>
        <button
          type="button"
          onClick={() => { void load(true); }}
          disabled={refreshing}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-white/64 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : undefined} />
          {copy.refresh}
        </button>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 p-3 pb-10">
        {state === 'loading' && (
          <div className="py-16 text-center text-sm text-white/50">{copy.loading}</div>
        )}

        {state === 'unauthorized' && (
          <div className="rounded-xl border border-white/10 bg-[#14162A] px-4 py-10 text-center text-sm font-bold text-white/60">
            {copy.loginNeeded}
          </div>
        )}

        {state === 'error' && (
          <div className="rounded-xl border border-[#FF7BAC]/30 bg-[#FF7BAC]/10 px-4 py-10 text-center text-sm font-bold text-[#FFB8CF]">
            {copy.fetchFailed}
          </div>
        )}

        {state === 'unconfigured' && (
          <div className="rounded-xl border border-white/10 bg-[#14162A] p-5">
            <div className="mb-2 flex items-center gap-2 text-base font-black text-white">
              <CalendarDays size={18} className="text-[#FFB830]" />
              {copy.setupTitle}
            </div>
            <p className="mb-3 text-sm text-white/60">{copy.setupIntro}</p>
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-white/75">
              {copy.setupSteps.map(step => <li key={step}>{step}</li>)}
            </ol>
          </div>
        )}

        {state === 'ready' && dayGroups.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-[#14162A] px-4 py-12 text-center text-sm font-bold text-white/55">
            {copy.noEvents}
          </div>
        )}

        {state === 'ready' && dayGroups.length > 0 && (
          <div className="space-y-4">
            {multiCalendar && (
              <div className="flex flex-wrap items-center gap-3 px-1 text-[11px] font-bold text-white/55">
                {[...calendarNames.entries()].map(([index, name]) => (
                  <span key={index} className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: CALENDAR_COLORS[index % CALENDAR_COLORS.length] }}
                    />
                    {name}
                  </span>
                ))}
              </div>
            )}

            {dayGroups.map(group => {
              const isToday = group.key === todayKey;
              const isTomorrow = group.key === tomorrowKey;
              return (
                <section key={group.key}>
                  <div className="mb-1.5 flex items-center gap-2 px-1">
                    <h2 className={`text-sm font-black ${isToday ? 'text-[#4EEDB0]' : 'text-white/85'}`}>
                      {dayFormat.format(group.date)}
                    </h2>
                    {(isToday || isTomorrow) && (
                      <span className={[
                        'rounded-full px-2 py-0.5 text-[10px] font-black',
                        isToday ? 'bg-[#4EEDB0]/16 text-[#4EEDB0]' : 'bg-[#5B8EFF]/16 text-[#8EAFFF]',
                      ].join(' ')}>
                        {isToday ? copy.today : copy.tomorrow}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {group.events.map(event => {
                      const color = CALENDAR_COLORS[event.calendarIndex % CALENDAR_COLORS.length];
                      return (
                        <div
                          key={`${group.key}:${event.id}`}
                          className="flex items-center gap-3 rounded-xl border border-white/8 bg-[#14162A] px-3 py-2.5"
                        >
                          <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: color }} />
                          <div className="w-[74px] shrink-0 text-xs font-bold text-white/60">
                            {event.allDay ? (
                              <span className="inline-flex items-center gap-1 text-[#FFDB7A]">
                                <Clock3 size={12} />
                                {copy.allDay}
                              </span>
                            ) : (
                              <>
                                {timeFormat.format(new Date(event.start))}
                                {event.end && (
                                  <span className="block text-[10px] font-semibold text-white/35">
                                    – {timeFormat.format(new Date(event.end))}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-bold text-white">{event.title}</div>
                            {event.location && (
                              <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-white/45">
                                <MapPin size={11} className="shrink-0" />
                                <span className="truncate">{event.location}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
