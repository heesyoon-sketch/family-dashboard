// Minimal ICS (RFC 5545) parser for the family calendar page.
//
// Scope: what Google Calendar's secret iCal feeds actually emit — VEVENTs
// with DTSTART/DTEND (UTC "Z", TZID-local, or all-day DATE values), RRULE
// (DAILY / WEEKLY / MONTHLY / YEARLY with INTERVAL, BYDAY, UNTIL, COUNT),
// EXDATE, and RECURRENCE-ID instance overrides. Anything fancier is dropped
// rather than guessed at.

export interface CalendarEvent {
  id: string;
  calendarIndex: number;
  calendarName: string;
  title: string;
  location?: string;
  /** ISO UTC instant for timed events; YYYY-MM-DD for all-day events. */
  start: string;
  end?: string;
  allDay: boolean;
}

interface IcsProp {
  params: Record<string, string>;
  value: string;
}

interface RawVevent {
  props: Record<string, IcsProp>;
  exdates: IcsProp[];
}

// ── Line-level parsing ────────────────────────────────────────────────────────

/** RFC 5545 3.1 — continuation lines start with a space or tab. */
function unfoldLines(text: string): string[] {
  const out: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    if ((rawLine.startsWith(' ') || rawLine.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += rawLine.slice(1);
    } else if (rawLine.length > 0) {
      out.push(rawLine);
    }
  }
  return out;
}

function parseLine(line: string): { name: string; prop: IcsProp } | null {
  const colon = line.indexOf(':');
  if (colon === -1) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...paramParts] = head.split(';');
  const params: Record<string, string> = {};
  for (const part of paramParts) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), prop: { params, value } };
}

function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

// ── Timezone math ─────────────────────────────────────────────────────────────

const tzFormatters = new Map<string, Intl.DateTimeFormat>();

function tzFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = tzFormatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
    tzFormatters.set(timeZone, fmt);
  }
  return fmt;
}

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function tzOffsetMs(timeZone: string, instant: Date): number {
  const parts = tzFormatter(timeZone).formatToParts(instant);
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0);
  const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return wall - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Interprets wall-clock components in `timeZone` as a UTC instant. */
function zonedToUtc(
  y: number, mo: number, d: number, hh: number, mm: number, ss: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(y, mo - 1, d, hh, mm, ss);
  const offset = tzOffsetMs(timeZone, new Date(guess));
  // Second pass handles DST boundaries where the first guess lands on the
  // wrong side of the transition.
  const better = guess - offset;
  const offset2 = tzOffsetMs(timeZone, new Date(better));
  return new Date(guess - offset2);
}

// ── Date values ───────────────────────────────────────────────────────────────

/** A parsed DTSTART/DTEND: either a date-only value or a wall time + zone. */
interface IcsTime {
  allDay: boolean;
  y: number; mo: number; d: number;
  hh: number; mm: number; ss: number;
  /** IANA zone the wall time lives in; 'UTC' for trailing-Z values. */
  timeZone: string;
}

function parseIcsTime(prop: IcsProp, defaultTz: string): IcsTime | null {
  const value = prop.value.trim();
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (prop.params.VALUE === 'DATE' || dateOnly) {
    const m = dateOnly ?? /^(\d{4})(\d{2})(\d{2})/.exec(value);
    if (!m) return null;
    return { allDay: true, y: +m[1], mo: +m[2], d: +m[3], hh: 0, mm: 0, ss: 0, timeZone: 'UTC' };
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value);
  if (!m) return null;
  const timeZone = m[7] === 'Z' ? 'UTC' : (prop.params.TZID ?? defaultTz);
  return { allDay: false, y: +m[1], mo: +m[2], d: +m[3], hh: +m[4], mm: +m[5], ss: +m[6], timeZone };
}

function toInstant(t: IcsTime): Date {
  if (t.timeZone === 'UTC') return new Date(Date.UTC(t.y, t.mo - 1, t.d, t.hh, t.mm, t.ss));
  try {
    return zonedToUtc(t.y, t.mo, t.d, t.hh, t.mm, t.ss, t.timeZone);
  } catch {
    return new Date(Date.UTC(t.y, t.mo - 1, t.d, t.hh, t.mm, t.ss));
  }
}

/** Shifts the wall-clock date by whole days, keeping the time of day. */
function shiftDays(t: IcsTime, days: number): IcsTime {
  const shifted = new Date(Date.UTC(t.y, t.mo - 1, t.d + days));
  return { ...t, y: shifted.getUTCFullYear(), mo: shifted.getUTCMonth() + 1, d: shifted.getUTCDate() };
}

function dateKey(t: IcsTime): string {
  return `${t.y}-${String(t.mo).padStart(2, '0')}-${String(t.d).padStart(2, '0')}`;
}

/** Canonical identity of one occurrence — used for EXDATE / RECURRENCE-ID. */
function occurrenceKey(t: IcsTime): string {
  return t.allDay ? dateKey(t) : String(toInstant(t).getTime());
}

/** Day-of-week of the wall-clock date. 0=SU … 6=SA (RFC weekday letters). */
function wallWeekday(t: IcsTime): number {
  return new Date(Date.UTC(t.y, t.mo - 1, t.d)).getUTCDay();
}

const BYDAY_INDEX: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

// ── RRULE ─────────────────────────────────────────────────────────────────────

interface Rrule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  count?: number;
  until?: Date;
  /** Plain weekdays (weekly), e.g. ['MO','WE']. */
  byday: string[];
  /** Ordinal weekday (monthly), e.g. { ordinal: 2, weekday: 'SU' } for 2SU. */
  bydayOrdinal?: { ordinal: number; weekday: string };
}

function parseRrule(value: string, defaultTz: string): Rrule | null {
  const fields: Record<string, string> = {};
  for (const part of value.split(';')) {
    const eq = part.indexOf('=');
    if (eq !== -1) fields[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  const freq = fields.FREQ as Rrule['freq'] | undefined;
  if (!freq || !['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) return null;

  const rule: Rrule = {
    freq,
    interval: Math.max(1, Number(fields.INTERVAL ?? 1) || 1),
    byday: [],
  };
  if (fields.COUNT) rule.count = Math.max(1, Number(fields.COUNT) || 1);
  if (fields.UNTIL) {
    const until = parseIcsTime({ params: {}, value: fields.UNTIL }, defaultTz);
    if (until) {
      // All-day UNTIL means "through that date".
      rule.until = until.allDay
        ? new Date(Date.UTC(until.y, until.mo - 1, until.d, 23, 59, 59))
        : toInstant(until);
    }
  }
  if (fields.BYDAY) {
    for (const token of fields.BYDAY.split(',')) {
      const m = /^([+-]?\d)?(SU|MO|TU|WE|TH|FR|SA)$/.exec(token.trim());
      if (!m) continue;
      if (m[1]) rule.bydayOrdinal = { ordinal: Number(m[1]), weekday: m[2] };
      else rule.byday.push(m[2]);
    }
  }
  return rule;
}

/** Nth `weekday` of the month containing `t` (negative = from the end). */
function nthWeekdayOfMonth(y: number, mo: number, weekday: string, ordinal: number): number | null {
  const target = BYDAY_INDEX[weekday];
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const matches: number[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(Date.UTC(y, mo - 1, d)).getUTCDay() === target) matches.push(d);
  }
  const pick = ordinal > 0 ? matches[ordinal - 1] : matches[matches.length + ordinal];
  return pick ?? null;
}

/**
 * Expands occurrence start times within [windowStart, windowEnd].
 * COUNT/UNTIL are honoured from the series origin, so occurrences before the
 * window still consume COUNT.
 */
function daysSinceEpoch(t: IcsTime): number {
  return Math.floor(Date.UTC(t.y, t.mo - 1, t.d) / 86400000);
}

function expandRrule(
  start: IcsTime,
  rule: Rrule,
  windowStart: Date,
  windowEnd: Date,
): IcsTime[] {
  const out: IcsTime[] = [];
  const maxIterations = 5000;
  let produced = 0;
  let iterations = 0;

  // Without COUNT we can skip cycles wholesale; with COUNT every occurrence
  // from the series origin must be enumerated to know which number we're on.
  // One extra cycle of slack absorbs wall-clock/UTC edge cases.
  // `cycleDays` must be an upper bound on the real cycle length so the fast
  // forward can never overshoot the window.
  const fastForwardK = (cycleDays: number): number => {
    if (rule.count) return 0;
    const gapDays = Math.floor(windowStart.getTime() / 86400000) - daysSinceEpoch(start);
    const cycles = Math.floor(gapDays / (cycleDays * rule.interval)) - 1;
    return cycles > 0 ? cycles * rule.interval : 0;
  };

  const emit = (t: IcsTime): boolean => {
    produced += 1;
    if (rule.count && produced > rule.count) return false;
    const instant = toInstant(t);
    if (rule.until && instant.getTime() > rule.until.getTime()) return false;
    if (instant.getTime() >= windowStart.getTime() && instant.getTime() <= windowEnd.getTime()) {
      out.push(t);
    }
    return instant.getTime() <= windowEnd.getTime() || Boolean(rule.count);
  };

  if (rule.freq === 'DAILY') {
    for (let k = fastForwardK(1); iterations < maxIterations; k += rule.interval, iterations++) {
      if (!emit(shiftDays(start, k))) break;
    }
    return out;
  }

  if (rule.freq === 'WEEKLY') {
    const weekdays = rule.byday.length > 0
      ? rule.byday.map(d => BYDAY_INDEX[d]).sort((a, b) => a - b)
      : [wallWeekday(start)];
    // Anchor each cycle at the start of DTSTART's week (Sunday-based; Google
    // uses WKST=SU by default and BYDAY sets don't straddle week starts in
    // family calendars enough to matter).
    const weekAnchor = shiftDays(start, -wallWeekday(start));
    outer:
    for (let week = fastForwardK(7); iterations < maxIterations; week += rule.interval) {
      for (const weekday of weekdays) {
        iterations++;
        const occurrence = shiftDays(weekAnchor, week * 7 + weekday);
        const instant = toInstant(occurrence);
        if (instant.getTime() < toInstant(start).getTime()) continue;
        if (!emit(occurrence)) break outer;
      }
    }
    return out;
  }

  if (rule.freq === 'MONTHLY') {
    for (let k = fastForwardK(31); iterations < maxIterations; k += rule.interval, iterations++) {
      const total = start.mo - 1 + k;
      const y = start.y + Math.floor(total / 12);
      const mo = (total % 12) + 1;
      let day: number | null = start.d;
      if (rule.bydayOrdinal) {
        day = nthWeekdayOfMonth(y, mo, rule.bydayOrdinal.weekday, rule.bydayOrdinal.ordinal);
      } else if (day > new Date(Date.UTC(y, mo, 0)).getUTCDate()) {
        day = null; // e.g. Jan 31 monthly has no occurrence in February
      }
      if (day == null) continue;
      if (!emit({ ...start, y, mo, d: day })) break;
    }
    return out;
  }

  // YEARLY
  for (let k = fastForwardK(366); iterations < maxIterations; k += rule.interval, iterations++) {
    if (!emit({ ...start, y: start.y + k })) break;
  }
  return out;
}

// ── VEVENT assembly ───────────────────────────────────────────────────────────

function parseVevents(lines: string[]): { calendarName: string; defaultTz: string; vevents: RawVevent[] } {
  let calendarName = '';
  let defaultTz = 'UTC';
  const vevents: RawVevent[] = [];
  let current: RawVevent | null = null;
  let depth: string[] = [];

  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    const { name, prop } = parsed;

    if (name === 'BEGIN') {
      depth.push(prop.value.toUpperCase());
      if (prop.value.toUpperCase() === 'VEVENT') current = { props: {}, exdates: [] };
      continue;
    }
    if (name === 'END') {
      const closing = prop.value.toUpperCase();
      depth = depth.slice(0, Math.max(0, depth.lastIndexOf(closing)));
      if (closing === 'VEVENT' && current) {
        vevents.push(current);
        current = null;
      }
      continue;
    }

    // Ignore everything inside VALARM / VTIMEZONE sub-components.
    const inside = depth[depth.length - 1];
    if (current && inside === 'VEVENT') {
      if (name === 'EXDATE') current.exdates.push(prop);
      else if (!(name in current.props)) current.props[name] = prop;
    } else if (inside === 'VCALENDAR') {
      if (name === 'X-WR-CALNAME') calendarName = unescapeText(prop.value).trim();
      if (name === 'X-WR-TIMEZONE') defaultTz = prop.value.trim() || 'UTC';
    }
  }

  return { calendarName, defaultTz, vevents };
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface ParseIcsOptions {
  calendarIndex: number;
  /** Fallback when the feed has no X-WR-CALNAME. */
  fallbackName: string;
  windowStart: Date;
  windowEnd: Date;
}

/** Parses one ICS feed into concrete event instances within the window. */
export function parseIcsEvents(text: string, options: ParseIcsOptions): CalendarEvent[] {
  const { calendarName, defaultTz, vevents } = parseVevents(unfoldLines(text));
  const name = calendarName || options.fallbackName;

  // Split masters from RECURRENCE-ID overrides, keyed by UID.
  const overridesByUid = new Map<string, Map<string, RawVevent>>();
  const masters: RawVevent[] = [];
  for (const vevent of vevents) {
    const recurrenceId = vevent.props['RECURRENCE-ID'];
    const uid = vevent.props.UID?.value ?? '';
    if (recurrenceId && uid) {
      const t = parseIcsTime(recurrenceId, defaultTz);
      if (t) {
        const byKey = overridesByUid.get(uid) ?? new Map<string, RawVevent>();
        byKey.set(occurrenceKey(t), vevent);
        overridesByUid.set(uid, byKey);
        continue;
      }
    }
    masters.push(vevent);
  }

  const events: CalendarEvent[] = [];

  const pushInstance = (vevent: RawVevent, start: IcsTime, instanceSuffix: string) => {
    if ((vevent.props.STATUS?.value ?? '').toUpperCase() === 'CANCELLED') return;
    const title = unescapeText(vevent.props.SUMMARY?.value ?? '').trim() || '(제목 없음)';
    const location = unescapeText(vevent.props.LOCATION?.value ?? '').trim() || undefined;
    const uid = vevent.props.UID?.value ?? Math.random().toString(36).slice(2);

    const dtstart = parseIcsTime(vevent.props.DTSTART ?? { params: {}, value: '' }, defaultTz);
    const dtend = vevent.props.DTEND ? parseIcsTime(vevent.props.DTEND, defaultTz) : null;
    // Keep the original duration for recurring instances.
    let end: string | undefined;
    if (dtstart && dtend) {
      if (start.allDay) {
        const spanDays = Math.round(
          (Date.UTC(dtend.y, dtend.mo - 1, dtend.d) - Date.UTC(dtstart.y, dtstart.mo - 1, dtstart.d)) / 86400000,
        );
        end = dateKey(shiftDays(start, Math.max(1, spanDays)));
      } else {
        const durationMs = toInstant(dtend).getTime() - toInstant(dtstart).getTime();
        end = new Date(toInstant(start).getTime() + Math.max(0, durationMs)).toISOString();
      }
    }

    events.push({
      id: `${options.calendarIndex}:${uid}:${instanceSuffix}`,
      calendarIndex: options.calendarIndex,
      calendarName: name,
      title,
      location,
      start: start.allDay ? dateKey(start) : toInstant(start).toISOString(),
      end,
      allDay: start.allDay,
    });
  };

  for (const vevent of masters) {
    const dtstartProp = vevent.props.DTSTART;
    if (!dtstartProp) continue;
    const start = parseIcsTime(dtstartProp, defaultTz);
    if (!start) continue;

    const uid = vevent.props.UID?.value ?? '';
    const overrides = overridesByUid.get(uid);
    const exdateKeys = new Set<string>();
    for (const exdate of vevent.exdates) {
      for (const value of exdate.value.split(',')) {
        const t = parseIcsTime({ params: exdate.params, value: value.trim() }, defaultTz);
        if (t) exdateKeys.add(occurrenceKey(t));
      }
    }

    const rruleValue = vevent.props.RRULE?.value;
    const rule = rruleValue ? parseRrule(rruleValue, defaultTz) : null;

    if (!rule) {
      const instant = start.allDay
        ? new Date(Date.UTC(start.y, start.mo - 1, start.d))
        : toInstant(start);
      // Keep multi-day events that started before the window but overlap it.
      const endProp = vevent.props.DTEND ? parseIcsTime(vevent.props.DTEND, defaultTz) : null;
      const endInstant = endProp
        ? (endProp.allDay ? new Date(Date.UTC(endProp.y, endProp.mo - 1, endProp.d)) : toInstant(endProp))
        : instant;
      if (endInstant.getTime() < options.windowStart.getTime() || instant.getTime() > options.windowEnd.getTime()) {
        continue;
      }
      pushInstance(vevent, start, 'single');
      continue;
    }

    for (const occurrence of expandRrule(start, rule, options.windowStart, options.windowEnd)) {
      const key = occurrenceKey(occurrence);
      if (exdateKeys.has(key)) continue;
      if (overrides?.has(key)) continue; // the override VEVENT renders instead
      pushInstance(vevent, occurrence, key);
    }
  }

  // Overrides are standalone rows with their own DTSTART.
  for (const byKey of overridesByUid.values()) {
    for (const [key, vevent] of byKey) {
      const start = vevent.props.DTSTART ? parseIcsTime(vevent.props.DTSTART, defaultTz) : null;
      if (!start) continue;
      const instant = start.allDay ? new Date(Date.UTC(start.y, start.mo - 1, start.d)) : toInstant(start);
      if (instant.getTime() < options.windowStart.getTime() || instant.getTime() > options.windowEnd.getTime()) {
        continue;
      }
      pushInstance(vevent, start, `override:${key}`);
    }
  }

  events.sort((a, b) => a.start.localeCompare(b.start));
  return events;
}
