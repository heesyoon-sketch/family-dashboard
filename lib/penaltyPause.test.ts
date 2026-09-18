import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePenaltyPauseSetting } from './penaltyPause';

test('parsePenaltyPauseSetting only trusts a well-formed enabled flag', () => {
  assert.equal(parsePenaltyPauseSetting(null), false);
  assert.equal(parsePenaltyPauseSetting(undefined), false);
  assert.equal(parsePenaltyPauseSetting(''), false);
  assert.equal(parsePenaltyPauseSetting('not json'), false);
  assert.equal(parsePenaltyPauseSetting('{"enabled":false}'), false);
  assert.equal(parsePenaltyPauseSetting('{"enabled":true}'), true);
  assert.equal(parsePenaltyPauseSetting('{}'), false);
});
