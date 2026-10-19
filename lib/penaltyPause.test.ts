import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePenaltyPauseSetting, parseRoutinePenaltySetting } from './penaltyPause';

test('parsePenaltyPauseSetting only trusts a well-formed enabled flag', () => {
  assert.equal(parsePenaltyPauseSetting(null), false);
  assert.equal(parsePenaltyPauseSetting(undefined), false);
  assert.equal(parsePenaltyPauseSetting(''), false);
  assert.equal(parsePenaltyPauseSetting('not json'), false);
  assert.equal(parsePenaltyPauseSetting('{"enabled":false}'), false);
  assert.equal(parsePenaltyPauseSetting('{"enabled":true}'), true);
  assert.equal(parsePenaltyPauseSetting('{}'), false);
});

test('parseRoutinePenaltySetting defaults to on at 50 points', () => {
  const on50 = { enabled: true, points: 50 };
  assert.deepEqual(parseRoutinePenaltySetting(null), on50);
  assert.deepEqual(parseRoutinePenaltySetting(''), on50);
  assert.deepEqual(parseRoutinePenaltySetting('not json'), on50);
  assert.deepEqual(parseRoutinePenaltySetting('{}'), on50);
  assert.deepEqual(parseRoutinePenaltySetting('{"enabled":"no"}'), on50);
  assert.deepEqual(parseRoutinePenaltySetting('{"enabled":false}'), { enabled: false, points: 50 });
  assert.deepEqual(parseRoutinePenaltySetting('{"enabled":true,"points":30}'), { enabled: true, points: 30 });
  assert.deepEqual(parseRoutinePenaltySetting('{"points":0}'), on50);
  assert.deepEqual(parseRoutinePenaltySetting('{"points":1001}'), on50);
  assert.deepEqual(parseRoutinePenaltySetting('{"points":12.5}'), on50);
});
