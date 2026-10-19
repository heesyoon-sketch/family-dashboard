import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DayOfWeek } from './db';
import { HABIT_SIGNAL_RULES, habitSignal } from './habitSignals';

const ALL: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
// 2026-10-19 is a Monday.
const TODAY = '2026-10-19';
const days = (...list: string[]) => new Set(list);

test('a run of completed scheduled days lights a flame; today never breaks it while open', () => {
  const s = habitSignal({ daysOfWeek: ALL, optional: false, doneDays: days('2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'), today: TODAY });
  assert.deepEqual([s.streak, s.state], [5, 'hot']);
  assert.equal(habitSignal({ daysOfWeek: ALL, optional: false, createdDay: '2026-10-17', doneDays: days('2026-10-17', '2026-10-18'), today: TODAY }).state, null, 'two days is not yet a flame');
});

test('only scheduled days count, so a Wed/Thu habit is not missed on other days', () => {
  const wedThu: DayOfWeek[] = ['WED', 'THU'];
  // Done every Wed/Thu for three weeks.
  const s = habitSignal({ daysOfWeek: wedThu, optional: false, doneDays: days('2026-10-15', '2026-10-14', '2026-10-08', '2026-10-07'), today: TODAY });
  assert.equal(s.recentMisses, 0);
  assert.equal(s.streak, 4, 'lookback covers two weeks of Wed/Thu');
});

test('a required habit missed 3 of the last 5 times shows the gentle sprout; bonus tasks never do', () => {
  const missed = { daysOfWeek: ALL, doneDays: days('2026-10-16', '2026-10-15'), today: TODAY };
  assert.equal(habitSignal({ ...missed, optional: false }).state, 'cold');
  assert.equal(habitSignal({ ...missed, optional: true }).state, null);
});

test('days before the habit existed are ignored', () => {
  const s = habitSignal({ daysOfWeek: ALL, optional: false, createdDay: '2026-10-18', doneDays: days(), today: TODAY });
  assert.equal(s.recentMisses, 1, 'only Sunday counts');
  assert.equal(s.state, null);
});

test('a daily habit unbroken across the window shows the server streak, if it is current', () => {
  const all14 = days(...Array.from({ length: 14 }, (_, i) => { const d = new Date(2026, 9, 18 - i); return `2026-10-${String(d.getDate()).padStart(2, '0')}`; }));
  assert.equal(habitSignal({ daysOfWeek: ALL, optional: false, doneDays: all14, today: TODAY, serverStreak: 25, lastCompletedDay: '2026-10-18' }).streak, 25);
  assert.equal(habitSignal({ daysOfWeek: ALL, optional: false, doneDays: all14, today: TODAY, serverStreak: 25, lastCompletedDay: '2026-10-10' }).streak, 13, 'a stale server streak is ignored (13 closed days in the window)');
  assert.equal(habitSignal({ daysOfWeek: ALL, optional: false, doneDays: all14, today: TODAY, serverStreak: 25, lastCompletedDay: '2026-10-18' }).state, 'blazing');
  assert.ok(HABIT_SIGNAL_RULES.blazingStreak > HABIT_SIGNAL_RULES.hotStreak);
});

test('task cards render the flame or sprout from the store signal', () => {
  const card = readFileSync(join(process.cwd(), 'components/TaskCard.tsx'), 'utf8');
  assert.match(card, /useFamilyStore\(s => s\.habitSignalsByTask\[task\.id\]\)/);
  assert.match(card, /<Icons\.Flame size=\{9\}/);
  assert.match(card, /<Icons\.Sprout size=\{10\}/);
  assert.match(readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8'), /prefers-reduced-motion: no-preference\) \{\n\s+\.habit-flame-blazing/);
});
