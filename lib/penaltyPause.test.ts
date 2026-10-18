import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePenaltyPauseSetting, parseRoutinePenaltyExemptSetting } from './penaltyPause';

test('parsePenaltyPauseSetting only trusts a well-formed enabled flag', () => {
  assert.equal(parsePenaltyPauseSetting(null), false);
  assert.equal(parsePenaltyPauseSetting(undefined), false);
  assert.equal(parsePenaltyPauseSetting(''), false);
  assert.equal(parsePenaltyPauseSetting('not json'), false);
  assert.equal(parsePenaltyPauseSetting('{"enabled":false}'), false);
  assert.equal(parsePenaltyPauseSetting('{"enabled":true}'), true);
  assert.equal(parsePenaltyPauseSetting('{}'), false);
});

test('parseRoutinePenaltyExemptSetting keeps only string member ids', () => {
  assert.deepEqual(parseRoutinePenaltyExemptSetting(null), []);
  assert.deepEqual(parseRoutinePenaltyExemptSetting('not json'), []);
  assert.deepEqual(parseRoutinePenaltyExemptSetting('{}'), []);
  assert.deepEqual(parseRoutinePenaltyExemptSetting('{"userIds":"a"}'), []);
  assert.deepEqual(parseRoutinePenaltyExemptSetting('{"userIds":["a",1,"b"]}'), ['a', 'b']);
});
