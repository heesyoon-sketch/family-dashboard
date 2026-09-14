import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getChildRoutineAvailability,
  getCompletionWindowEnd,
  getCompletionWindowStart,
  getCurrentTimeWindow,
  getTimeWindowRange,
} from './timeWindows';

function at(hour: number, minute = 0): Date {
  return new Date(2026, 8, 11, hour, minute, 0, 0);
}

test('the dashboard switches from morning to afternoon at noon', () => {
  assert.equal(getCurrentTimeWindow(at(11, 59)), 'morning');
  assert.equal(getCurrentTimeWindow(at(12)), 'evening');
});

test('child morning routines follow the normal noon switch; evening still locks at 21:00', () => {
  assert.deepEqual(getChildRoutineAvailability(at(8, 59)), { morning: true, evening: false });
  assert.deepEqual(getChildRoutineAvailability(at(9)), { morning: true, evening: false });
  assert.deepEqual(getChildRoutineAvailability(at(11, 59)), { morning: true, evening: false });
  assert.deepEqual(getChildRoutineAvailability(at(12)), { morning: false, evening: true });
  assert.deepEqual(getChildRoutineAvailability(at(20, 59)), { morning: false, evening: true });
  assert.deepEqual(getChildRoutineAvailability(at(21)), { morning: false, evening: false });
});

test('completion windows split at noon', () => {
  const dayStart = at(0);
  assert.equal(getCompletionWindowStart(dayStart, 'evening').getHours(), 12);
  assert.equal(getCompletionWindowEnd(dayStart, 'morning').getHours(), 12);
});

test('child-facing ranges show the stricter evening deadline only', () => {
  assert.equal(getTimeWindowRange('morning', true), '00:00-11:59');
  assert.equal(getTimeWindowRange('evening', true), '12:00-20:59');
  assert.equal(getTimeWindowRange('both', true), '00:00-11:59 + 12:00-20:59');
});
