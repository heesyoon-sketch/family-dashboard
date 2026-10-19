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

test('parseRoutinePenaltySetting defaults to on unless explicitly disabled', () => {
  assert.equal(parseRoutinePenaltySetting(null), true);
  assert.equal(parseRoutinePenaltySetting(''), true);
  assert.equal(parseRoutinePenaltySetting('not json'), true);
  assert.equal(parseRoutinePenaltySetting('{}'), true);
  assert.equal(parseRoutinePenaltySetting('{"enabled":"no"}'), true);
  assert.equal(parseRoutinePenaltySetting('{"enabled":true}'), true);
  assert.equal(parseRoutinePenaltySetting('{"enabled":false}'), false);
});
