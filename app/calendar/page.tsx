'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { CalendarEvent } from '@/lib/ics';
import {
  addDays,
  CALENDAR_COLORS,
  calendarColor,
  groupEventsByDay,
  localDateKey,
  startOfDay,
  startOfWeek,
  useFamilyCalendar,
} from '@/lib/familyCalendar';

type CalendarView = 'week' | 'list' | 'month';

const VIEW_STORAGE_KEY = 'fambit.calendarView';
const LIST_DAYS = 60;

function isCalendarView(value: string | null): value is CalendarView {
  return value === 'week' || value === 'list' || value === 'month';
}

/** Visible [from, to) range for a view anchored at `anchor`. */
function viewRange(view: CalendarView, anchor: Date): { from: Date; to: Date } {
  if (view === 'week') {
    const from = startOfWeek(anchor);
    return { from, to: addDays(from, 7) };
  }
  if (view === 'month') {
    const from = startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    return { from, to: addDays(from, 42) };
  }
  const from = startOfDay(new Date());
  return { from, to: addDays(from, LIST_DAYS + 1) };
}

export default function FamilyCalendarPage() {
  const { lang } = useLanguage();
  const locale = lang === 'en' ? 'en-US' : 'ko-KR';
  const [view, setView] = useState<CalendarView>('list');
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [selectedKey, setSelectedKey] = useState(() => localDateKey(new Date()));

  useEffect(() => {
    // Restore the last view after mount so SSR and first client render match.
    const restore = setTimeout(() => {
      try {
        const saved = localStorage.getItem(VIEW_STORAGE_KEY);
        if (isCalendarView(saved)) setView(saved);
      } catch { /* storage unavailable */ }
    }, 0);
    return () => clearTimeout(restore);
  }, []);

  const changeView = (next: CalendarView) => {
    setView(next);
    try { localStorage.setItem(VIEW_STORAGE_KEY, next); } catch { /* storage unavailable */ }
  };

  const range = viewRange(view, anchor);
  const fromKey = localDateKey(range.from);
  const toKey = localDateKey(range.to);
  const { state, events, refreshing, reload } = useFamilyCalendar(fromKey, toKey);
  const byDay = useMemo(() => groupEventsByDay(events), [events]);

  const copy = {
    title: lang === 'en' ? 'Family calendar' : '가족 캘린더',
    subtitle: lang === 'en' ? 'What is coming up for us' : '우리 가족의 다가오는 일정',
    back: lang === 'en' ? 'Back to dashboard' : '대시보드로 돌아가기',
    refresh: lang === 'en' ? 'Refresh' : '새로고침',
    loading: lang === 'en' ? 'Loading events…' : '일정을 불러오는 중…',
    today: lang === 'en' ? 'Today' : '오늘',
    tomorrow: lang === 'en' ? 'Tomorrow' : '내일',
    allDay: lang === 'en' ? 'All day' : '종일',
    previous: lang === 'en' ? 'Previous' : '이전',
    next: lang === 'en' ? 'Next' : '다음',
    views: {
      week: lang === 'en' ? 'Week' : '주간',
      list: lang === 'en' ? 'List' : '목록',
      month: lang === 'en' ? 'Month' : '월간',
    } satisfies Record<CalendarView, string>,
    noEvents: lang === 'en'
      ? 'No events in the next 60 days. Enjoy the calm! 🌿'
      : '앞으로 60일 동안 일정이 없어요. 여유를 즐겨요! 🌿',
    noEventsDay: lang === 'en' ? 'No events' : '일정 없음',
    more: (count: number) => (lang === 'en' ? `+${count} more` : `+${count}개`),
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

  const calendarNames = useMemo(() => {
    const names = new Map<number, string>();
    for (const event of events) names.set(event.calendarIndex, event.calendarName);
    return names;
  }, [events]);
  const multiCalendar = calendarNames.size > 1;

  const timeFormat = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' });
  const dayFormat = new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', weekday: 'long' });
  const weekdayShort = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const monthTitle = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' });
  const shortDay = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });

  const todayKey = localDateKey(new Date());
  const tomorrowKey = localDateKey(addDays(new Date(), 1));

  const shift = (direction: 1 | -1) => {
    setAnchor(current => (view === 'week'
      ? addDays(current, 7 * direction)
      : new Date(current.getFullYear(), current.getMonth() + direction, 1)));
  };
  const goToday = () => {
    setAnchor(startOfDay(new Date()));
    setSelectedKey(localDateKey(new Date()));
  };

  const periodLabel = view === 'month'
    ? monthTitle.format(anchor)
    : `${shortDay.format(range.from)} – ${shortDay.format(addDays(range.to, -1))}`;

  const listDays: { key: string; date: Date; events: CalendarEvent[] }[] = [];
  if (view === 'list') {
    for (let d = range.from; d < range.to; d = addDays(d, 1)) {
      const key = localDateKey(d);
      const dayEvents = byDay.get(key);
      if (dayEvents?.length) listDays.push({ key, date: d, events: dayEvents });
    }
  }

  const renderTime = (event: CalendarEvent) => (event.allDay ? (
    <span className="inline-flex items-center gap-1 text-[#FFDB7A]">
      <Clock3 size={12} />
      {copy.allDay}
    </span>
  ) : timeFormat.format(new Date(event.start)));

  const renderEventRow = (event: CalendarEvent, dayKey: string) => (
    <div
      key={`${dayKey}:${event.id}`}
      className="flex items-center gap-3 rounded-xl border border-white/8 bg-[#14162A] px-3 py-2.5"
    >
      <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: calendarColor(event) }} />
      <div className="w-[74px] shrink-0 text-xs font-bold text-white/60">
        {renderTime(event)}
        {!event.allDay && event.end && (
          <span className="block text-[10px] font-semibold text-white/35">
            – {timeFormat.format(new Date(event.end))}
          </span>
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

  const renderDayHeading = (key: string, date: Date) => {
    const isToday = key === todayKey;
    const isTomorrow = key === tomorrowKey;
    return (
      <div className="mb-1.5 flex items-center gap-2 px-1">
        <h2 className={`text-sm font-black ${isToday ? 'text-[#4EEDB0]' : 'text-white/85'}`}>
          {dayFormat.format(date)}
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
    );
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(range.from, i));
  const monthCells = view === 'month' ? Array.from({ length: 42 }, (_, i) => addDays(range.from, i)) : [];
  const selectedDate = new Date(`${selectedKey}T00:00:00`);
  const selectedEvents = byDay.get(selectedKey) ?? [];

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
          onClick={() => { void reload(); }}
          disabled={refreshing}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-white/64 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : undefined} />
          <span className="hidden sm:inline">{copy.refresh}</span>
        </button>
      </header>

      <main className={`mx-auto w-full flex-1 p-3 pb-10 ${view === 'list' ? 'max-w-2xl' : 'max-w-6xl'}`}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label={copy.title} className="flex rounded-xl border border-white/10 bg-white/[0.04] p-1">
            {(['week', 'list', 'month'] as const).map(option => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={view === option}
                onClick={() => changeView(option)}
                className={[
                  'min-h-10 rounded-lg px-4 text-sm font-black transition',
                  view === option ? 'bg-[#FFB830] text-[#1a1300]' : 'text-white/60 hover:text-white',
                ].join(' ')}
              >
                {copy.views[option]}
              </button>
            ))}
          </div>

          {view !== 'list' && (
            <div className="ml-auto flex items-center gap-1.5">
              <button type="button" onClick={() => shift(-1)} aria-label={copy.previous} className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10"><ChevronLeft size={18} /></button>
              <span className="min-w-[128px] text-center text-sm font-black text-white/85 tabular-nums">{periodLabel}</span>
              <button type="button" onClick={() => shift(1)} aria-label={copy.next} className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10"><ChevronRight size={18} /></button>
              <button type="button" onClick={goToday} className="h-10 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-white/70 hover:bg-white/10">{copy.today}</button>
            </div>
          )}
        </div>

        {state === 'ready' && multiCalendar && (
          <div className="mb-3 flex flex-wrap items-center gap-3 px-1 text-[11px] font-bold text-white/55">
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

        {state === 'ready' && view === 'list' && (listDays.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-[#14162A] px-4 py-12 text-center text-sm font-bold text-white/55">
            {copy.noEvents}
          </div>
        ) : (
          <div className="space-y-4">
            {listDays.map(day => (
              <section key={day.key}>
                {renderDayHeading(day.key, day.date)}
                <div className="space-y-1.5">{day.events.map(event => renderEventRow(event, day.key))}</div>
              </section>
            ))}
          </div>
        ))}

        {state === 'ready' && view === 'week' && (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
            {weekDays.map(date => {
              const key = localDateKey(date);
              const dayEvents = byDay.get(key) ?? [];
              const isToday = key === todayKey;
              return (
                <section
                  key={key}
                  className={[
                    'flex min-h-[64px] flex-col rounded-xl border p-2 md:min-h-[320px]',
                    isToday ? 'border-[#4EEDB0]/45 bg-[#4EEDB0]/[0.06]' : 'border-white/8 bg-[#14162A]',
                  ].join(' ')}
                >
                  <div className="mb-2 flex items-baseline gap-1.5 px-0.5">
                    <span className={`text-lg font-black tabular-nums ${isToday ? 'text-[#4EEDB0]' : date.getDay() === 0 ? 'text-[#FF9DBF]' : date.getDay() === 6 ? 'text-[#8EAFFF]' : 'text-white/85'}`}>
                      {date.getDate()}
                    </span>
                    <span className="text-xs font-bold text-white/45">{weekdayShort.format(date)}</span>
                  </div>
                  <div className="space-y-1.5">
                    {dayEvents.length === 0 && <div className="px-0.5 text-[11px] text-white/25">{copy.noEventsDay}</div>}
                    {dayEvents.map(event => (
                      <div
                        key={`${key}:${event.id}`}
                        className="rounded-lg border-l-[3px] bg-white/[0.05] px-2 py-1.5"
                        style={{ borderColor: calendarColor(event) }}
                      >
                        <div className="text-[10px] font-bold text-white/50">{renderTime(event)}</div>
                        <div className="text-xs font-bold leading-snug text-white [overflow-wrap:anywhere]">{event.title}</div>
                        {event.location && <div className="mt-0.5 truncate text-[10px] text-white/40">{event.location}</div>}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {state === 'ready' && view === 'month' && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-white/8 bg-[#14162A]">
              <div className="grid grid-cols-7 border-b border-white/8">
                {weekDays.map((date, i) => (
                  <div key={i} className={`py-1.5 text-center text-[11px] font-black ${i === 0 ? 'text-[#FF9DBF]' : i === 6 ? 'text-[#8EAFFF]' : 'text-white/50'}`}>
                    {weekdayShort.format(date)}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthCells.map(date => {
                  const key = localDateKey(date);
                  const dayEvents = byDay.get(key) ?? [];
                  const inMonth = date.getMonth() === anchor.getMonth();
                  const isToday = key === todayKey;
                  const isSelected = key === selectedKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedKey(key)}
                      aria-pressed={isSelected}
                      className={[
                        'flex min-h-[64px] flex-col items-stretch gap-0.5 border-b border-r border-white/[0.06] p-1 text-left transition md:min-h-[104px] md:p-1.5',
                        isSelected ? 'bg-[#FFB830]/12' : 'hover:bg-white/[0.04]',
                        inMonth ? '' : 'opacity-35',
                      ].join(' ')}
                    >
                      <span className={[
                        'grid h-6 w-6 place-items-center rounded-full text-xs font-black tabular-nums',
                        isToday ? 'bg-[#4EEDB0] text-[#06281b]' : date.getDay() === 0 ? 'text-[#FF9DBF]' : date.getDay() === 6 ? 'text-[#8EAFFF]' : 'text-white/80',
                      ].join(' ')}>
                        {date.getDate()}
                      </span>
                      {/* Phones: dots only. Wider screens: up to 3 titles. */}
                      <span className="flex flex-wrap gap-0.5 md:hidden">
                        {dayEvents.slice(0, 4).map(event => (
                          <span key={event.id} className="h-1.5 w-1.5 rounded-full" style={{ background: calendarColor(event) }} />
                        ))}
                      </span>
                      <span className="hidden space-y-0.5 md:block">
                        {dayEvents.slice(0, 3).map(event => (
                          <span
                            key={event.id}
                            className="block truncate rounded px-1 py-px text-[10px] font-bold text-white/90"
                            style={{ background: `${calendarColor(event)}2e` }}
                          >
                            {!event.allDay && <span className="mr-1 text-white/50">{timeFormat.format(new Date(event.start))}</span>}
                            {event.title}
                          </span>
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="block px-1 text-[10px] font-bold text-white/45">{copy.more(dayEvents.length - 3)}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <section className="mx-auto max-w-2xl">
              {renderDayHeading(selectedKey, selectedDate)}
              {selectedEvents.length === 0 ? (
                <div className="rounded-xl border border-white/8 bg-[#14162A] px-3 py-4 text-center text-xs font-bold text-white/40">{copy.noEventsDay}</div>
              ) : (
                <div className="space-y-1.5">{selectedEvents.map(event => renderEventRow(event, selectedKey))}</div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
