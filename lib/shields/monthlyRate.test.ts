import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { monthlyRequiredRate } from './monthlyRate';
import type { DailySchedule } from './engine';

const TZ = 'Asia/Seoul';
const slot = (taskId: string, window: 'morning' | 'evening') => ({ taskId, title: taskId, icon: '', window });
const schedules: DailySchedule[] = [
  { userId: 'kid', day: '2026-09-30', slots: [slot('homework', 'evening')] },
  { userId: 'kid', day: '2026-10-13', slots: [slot('wake', 'morning'), slot('homework', 'evening')] },
  { userId: 'kid', day: '2026-10-14', slots: [slot('wake', 'morning'), slot('homework', 'evening')] },
];
const done = (taskId: string, at: string) => ({ id: `${taskId}${at}`, userId: 'kid', taskId, completedAt: at });

test('monthly rate counts this month only and leaves today’s open window out', () => {
  const rate = monthlyRequiredRate({
    userId: 'kid', schedules, timezone: TZ,
    now: new Date('2026-10-14T15:00:00+09:00'),
    completions: [
      done('homework', '2026-09-30T19:00:00+09:00'), // last month
      done('wake', '2026-10-13T08:00:00+09:00'),
      done('wake', '2026-10-14T08:00:00+09:00'),
      // A bonus task is never in the snapshot, so it cannot lift the rate.
      done('read', '2026-10-13T20:00:00+09:00'),
    ],
  });
  // 13th: wake ✓ homework ✗ · 14th: wake ✓ (evening still open).
  assert.deepEqual(rate, { month: '2026-10-01', completed: 2, eligible: 3, rate: 2 / 3 });
});

test('a month with nothing closed yet has no rate rather than 0%', () => {
  const rate = monthlyRequiredRate({ userId: 'kid', schedules, completions: [], timezone: TZ, now: new Date('2026-11-01T08:00:00+09:00') });
  assert.equal(rate.month, '2026-11-01');
  assert.equal(rate.rate, null);
});

test('the dashboard shows the monthly required rate instead of level and XP', () => {
  const panel = readFileSync(join(process.cwd(), 'components/MemberPanel.tsx'), 'utf8');
  assert.doesNotMatch(panel, /Lv\.\{|formatXp|computeLevelProgress/);
  assert.match(panel, /useMonthlyRequiredRates\(\)/);
  assert.match(panel, /`\$\{monthNumber\}월 필수`/);
  const gamification = readFileSync(join(process.cwd(), 'lib/gamification/index.ts'), 'utf8');
  assert.doesNotMatch(gamification, /type: 'level_up'/);
});
