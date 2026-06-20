import assert from 'node:assert/strict';
import test from 'node:test';
import { isUnrecoverableOfflineRpcCode } from './offlineQueue';

test('stale offline RPC actions do not block the queue forever', () => {
  for (const code of ['P0001', '23503', '23505', '42501', '42883', 'PGRST116', 'PGRST204']) {
    assert.equal(isUnrecoverableOfflineRpcCode(code), true, `${code} should be dropped`);
  }
  assert.equal(isUnrecoverableOfflineRpcCode('57014'), false, 'timeouts should retry');
  assert.equal(isUnrecoverableOfflineRpcCode(null), false);
});
