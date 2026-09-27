import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { parseIcsEvents, type CalendarEvent } from '@/lib/ics';

// Google Calendar secret iCal feeds, comma- or newline-separated.
// Grab yours from Google Calendar → 설정 → (캘린더 선택) → "iCal 형식의 비밀 주소".
const ENV_KEY = 'FAMILY_CALENDAR_ICS_URLS';

const WINDOW_PAST_DAYS = 1;
const WINDOW_FUTURE_DAYS = 60;
// Month view asks for ~6 weeks; cap custom ranges so one request stays cheap.
const MAX_WINDOW_DAYS = 120;
const DAY_PARAM = /^\d{4}-\d{2}-\d{2}$/;

/** `?from=YYYY-MM-DD&to=YYYY-MM-DD` (to exclusive), padded a day each side for timezones. */
function requestedWindow(request: Request): { windowStart: Date; windowEnd: Date } {
  const now = Date.now();
  const fallback = {
    windowStart: new Date(now - WINDOW_PAST_DAYS * 86400000),
    windowEnd: new Date(now + WINDOW_FUTURE_DAYS * 86400000),
  };
  const params = new URL(request.url).searchParams;
  const from = params.get('from');
  const to = params.get('to');
  if (!from || !to || !DAY_PARAM.test(from) || !DAY_PARAM.test(to)) return fallback;
  const start = Date.parse(`${from}T00:00:00Z`) - 86400000;
  const end = Date.parse(`${to}T00:00:00Z`) + 86400000;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return fallback;
  if (end - start > MAX_WINDOW_DAYS * 86400000) return fallback;
  return { windowStart: new Date(start), windowEnd: new Date(end) };
}

function feedUrls(): string[] {
  return (process.env[ENV_KEY] ?? '')
    .split(/[\n,]/)
    .map(url => url.trim())
    .filter(url => /^https?:\/\//i.test(url));
}

export async function GET(request: Request) {
  // Calendar contents are family-private: require the kiosk's login session.
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() { /* read-only route */ },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const urls = feedUrls();
  if (urls.length === 0) {
    return NextResponse.json({ configured: false, events: [] });
  }

  const { windowStart, windowEnd } = requestedWindow(request);

  const results = await Promise.allSettled(urls.map(async (url, index) => {
    const response = await fetch(url, {
      // Calendars change slowly; a 10-minute data cache keeps the kiosk
      // snappy without hammering Google.
      next: { revalidate: 600 },
      headers: { 'User-Agent': 'fambit-family-dashboard' },
    });
    if (!response.ok) {
      throw new Error(`feed ${index + 1} responded ${response.status}`);
    }
    const text = await response.text();
    return parseIcsEvents(text, {
      calendarIndex: index,
      fallbackName: `Calendar ${index + 1}`,
      windowStart,
      windowEnd,
    });
  }));

  const events: CalendarEvent[] = [];
  const errors: string[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') events.push(...result.value);
    else errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
  }
  events.sort((a, b) => a.start.localeCompare(b.start));

  if (events.length === 0 && errors.length === urls.length) {
    return NextResponse.json({ configured: true, events: [], error: errors[0] }, { status: 502 });
  }

  return NextResponse.json({ configured: true, events });
}
