import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { weeklyRequiredRate } from './requiredRate';
import type { DailySchedule } from './engine';

const TZ = 'Asia/Seoul';
const slot = (taskId: string, window: 'morning' | 'evening') => ({ taskId, title: taskId, icon: '', window });
const schedules: DailySchedule[] = [
  { userId: 'kid', day: '2026-10-11', slots: [slot('homework', 'evening')] },
  { userId: 'kid', day: '2026-10-13', slots: [slot('wake', 'morning'), slot('homework', 'evening')] },
  { userId: 'kid', day: '2026-10-14', slots: [slot('wake', 'morning'), slot('homework', 'evening')] },
];
const done = (taskId: string, at: string) => ({ id: `${taskId}${at}`, userId: 'kid', taskId, completedAt: at });

test('weekly rate counts this week only and leaves today’s open window out', () => {
  const rate = weeklyRequiredRate({
    userId: 'kid', schedules, timezone: TZ,
    now: new Date('2026-10-14T15:00:00+09:00'),
    completions: [
      done('homework', '2026-10-11T19:00:00+09:00'), // last week (Sunday)
      done('wake', '2026-10-13T08:00:00+09:00'),
      done('wake', '2026-10-14T08:00:00+09:00'),
      // A bonus task is never in the snapshot, so it cannot lift the rate.
      done('read', '2026-10-13T20:00:00+09:00'),
    ],
  });
  // 13th: wake ✓ homework ✗ · 14th: wake ✓ (evening still open).
  assert.deepEqual(rate, { weekStart: '2026-10-12', completed: 2, eligible: 3, rate: 2 / 3 });
});

test('a week with nothing closed yet has no rate rather than 0%', () => {
  const rate = weeklyRequiredRate({ userId: 'kid', schedules, completions: [], timezone: TZ, now: new Date('2026-10-19T08:00:00+09:00') });
  assert.equal(rate.weekStart, '2026-10-19');
  assert.equal(rate.rate, null);
});

test('the dashboard shows this week’s required rate instead of level and XP', () => {
  const panel = readFileSync(join(process.cwd(), 'components/MemberPanel.tsx'), 'utf8');
  assert.doesNotMatch(panel, /Lv\.\{|formatXp|computeLevelProgress/);
  assert.match(panel, /useWeeklyRequiredRates\(\)/);
  assert.match(panel, /'이번 주 필수'/);
  const gamification = readFileSync(join(process.cwd(), 'lib/gamification/index.ts'), 'utf8');
  assert.doesNotMatch(gamification, /type: 'level_up'/);
});
