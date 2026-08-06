import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TASK_DURATION_OPTIONS,
  normalizeTaskPoints,
  taskDurationOptionForPoints,
} from './taskDurationPoints';

test('duration tiers use the fixed 10, 15, 30, and 50 point economy', () => {
  assert.deepEqual(TASK_DURATION_OPTIONS.map(option => option.points), [10, 15, 30, 50]);
  assert.deepEqual(TASK_DURATION_OPTIONS.map(option => option.label.ko), [
    '5분 이하',
    '6~10분',
    '11~20분',
    '21분 이상',
  ]);
});

test('legacy values normalize into the nearest intended duration tier', () => {
  assert.equal(normalizeTaskPoints(5), 10);
  assert.equal(normalizeTaskPoints(10), 10);
  assert.equal(normalizeTaskPoints(15), 15);
  assert.equal(normalizeTaskPoints(20), 30);
  assert.equal(normalizeTaskPoints(30), 30);
  assert.equal(normalizeTaskPoints(40), 50);
  assert.equal(normalizeTaskPoints(50), 50);
  assert.equal(normalizeTaskPoints(Number.NaN), 10);
});

test('task duration labels can be reconstructed from stored points', () => {
  assert.equal(taskDurationOptionForPoints(20).tier, 'medium');
  assert.equal(taskDurationOptionForPoints(50).label.en, '21+ min');
});
