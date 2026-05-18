import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCoachingInsight } from './coaching';

test('coaching starts with an anchor habit when no tasks exist today', () => {
  const insight = buildCoachingInsight({
    userName: 'Jun',
    focusTaskTitle: null,
    focusTaskPct: null,
    worstDayLabel: null,
    worstDayPct: null,
    deltaPct: null,
    todayDone: 0,
    todayPossible: 0,
    activeDays30: 0,
    lang: 'en',
  });

  assert.match(insight.title, /anchor habit/i);
});

test('coaching protects the weakest day before adding complexity', () => {
  const insight = buildCoachingInsight({
    userName: 'Jiu',
    focusTaskTitle: 'Reading',
    focusTaskPct: 52,
    worstDayLabel: 'Wed',
    worstDayPct: 40,
    deltaPct: 4,
    todayDone: 2,
    todayPossible: 3,
    activeDays30: 12,
    lang: 'en',
  });

  assert.match(insight.body, /Wed/);
  assert.match(insight.body, /Reading/);
});
