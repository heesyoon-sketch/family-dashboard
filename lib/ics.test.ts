import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIcsEvents } from './ics';

const WINDOW = {
  calendarIndex: 0,
  fallbackName: 'Family',
  windowStart: new Date('2026-07-01T00:00:00Z'),
  windowEnd: new Date('2026-08-31T23:59:59Z'),
};

function ics(body: string): string {
  return ['BEGIN:VCALENDAR', 'X-WR-CALNAME:Test Cal', body.trim(), 'END:VCALENDAR'].join('\r\n');
}

test('single timed UTC event lands inside the window', () => {
  const events = parseIcsEvents(ics(`
BEGIN:VEVENT
UID:one@test
DTSTART:20260710T090000Z
DTEND:20260710T100000Z
SUMMARY:Dentist\\, kids
LOCATION:Seoul
END:VEVENT
`), WINDOW);
  assert.equal(events.length, 1);
  assert.equal(events[0].title, 'Dentist, kids');
  assert.equal(events[0].location, 'Seoul');
  assert.equal(events[0].start, '2026-07-10T09:00:00.000Z');
  assert.equal(events[0].end, '2026-07-10T10:00:00.000Z');
  assert.equal(events[0].allDay, false);
  assert.equal(events[0].calendarName, 'Test Cal');
});

test('TZID wall times convert to the correct UTC instant', () => {
  const events = parseIcsEvents(ics(`
BEGIN:VEVENT
UID:tz@test
DTSTART;TZID=Asia/Seoul:20260710T180000
DTEND;TZID=Asia/Seoul:20260710T190000
SUMMARY:Piano
END:VEVENT
`), WINDOW);
  assert.equal(events.length, 1);
  // 18:00 KST == 09:00 UTC
  assert.equal(events[0].start, '2026-07-10T09:00:00.000Z');
});

test('all-day events keep date-only representation', () => {
  const events = parseIcsEvents(ics(`
BEGIN:VEVENT
UID:allday@test
DTSTART;VALUE=DATE:20260715
DTEND;VALUE=DATE:20260717
SUMMARY:Camping
END:VEVENT
`), WINDOW);
  assert.equal(events.length, 1);
  assert.equal(events[0].allDay, true);
  assert.equal(events[0].start, '2026-07-15');
  assert.equal(events[0].end, '2026-07-17');
});

test('weekly recurrence expands with BYDAY and honours EXDATE', () => {
  const events = parseIcsEvents(ics(`
BEGIN:VEVENT
UID:weekly@test
DTSTART;TZID=Asia/Seoul:20260706T160000
DTEND;TZID=Asia/Seoul:20260706T170000
RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20260722T000000Z
EXDATE;TZID=Asia/Seoul:20260713T160000
SUMMARY:Taekwondo
END:VEVENT
`), WINDOW);
  // Mondays: Jul 6, 13(excluded), 20; Wednesdays: Jul 8, 15 — until Jul 22 00:00Z
  const days = events.map(e => e.start.slice(0, 10));
  assert.deepEqual(days, ['2026-07-06', '2026-07-08', '2026-07-15', '2026-07-20']);
});

test('daily recurrence starting years earlier still reaches the window', () => {
  const events = parseIcsEvents(ics(`
BEGIN:VEVENT
UID:old-daily@test
DTSTART:20230101T210000Z
DTEND:20230101T213000Z
RRULE:FREQ=DAILY
SUMMARY:Reading time
END:VEVENT
`), WINDOW);
  // Every day in July + August 2026
  assert.equal(events.length, 62);
  assert.equal(events[0].start, '2026-07-01T21:00:00.000Z');
});

test('COUNT is consumed from the series origin, not the window', () => {
  const events = parseIcsEvents(ics(`
BEGIN:VEVENT
UID:count@test
DTSTART:20260628T100000Z
RRULE:FREQ=DAILY;COUNT=5
SUMMARY:Short series
END:VEVENT
`), WINDOW);
  // Jun 28–Jul 2; only Jul 1 and Jul 2 fall inside the window.
  assert.deepEqual(events.map(e => e.start.slice(0, 10)), ['2026-07-01', '2026-07-02']);
});

test('RECURRENCE-ID override replaces the master instance', () => {
  const events = parseIcsEvents(ics(`
BEGIN:VEVENT
UID:series@test
DTSTART:20260706T100000Z
DTEND:20260706T110000Z
RRULE:FREQ=WEEKLY;COUNT=3
SUMMARY:Swim class
END:VEVENT
BEGIN:VEVENT
UID:series@test
RECURRENCE-ID:20260713T100000Z
DTSTART:20260713T140000Z
DTEND:20260713T150000Z
SUMMARY:Swim class (moved)
END:VEVENT
`), WINDOW);
  const titles = events.map(e => `${e.start.slice(0, 13)} ${e.title}`);
  assert.deepEqual(titles, [
    '2026-07-06T10 Swim class',
    '2026-07-13T14 Swim class (moved)',
    '2026-07-20T10 Swim class',
  ]);
});

test('monthly ordinal BYDAY picks the nth weekday', () => {
  const events = parseIcsEvents(ics(`
BEGIN:VEVENT
UID:monthly@test
DTSTART;TZID=Asia/Seoul:20260614T110000
RRULE:FREQ=MONTHLY;BYDAY=2SU
SUMMARY:Grandma lunch
END:VEVENT
`), WINDOW);
  // 2nd Sundays: Jul 12, Aug 9 (2026)
  assert.deepEqual(events.map(e => e.start.slice(0, 10)), ['2026-07-12', '2026-08-09']);
});

test('cancelled events are dropped', () => {
  const events = parseIcsEvents(ics(`
BEGIN:VEVENT
UID:cancelled@test
DTSTART:20260710T090000Z
STATUS:CANCELLED
SUMMARY:Nope
END:VEVENT
`), WINDOW);
  assert.equal(events.length, 0);
});
