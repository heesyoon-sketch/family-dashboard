import test from 'node:test';
import assert from 'node:assert/strict';
import { readPages } from './data';
test('pagination reads past the API row cap', async () => {
  const rows = Array.from({ length: 1201 }, (_, i) => i);
  const result = await readPages(async (from, to) => ({ data: rows.slice(from, to + 1), error: null }));
  assert.deepEqual(result, rows);
});
test('a failed history page must not become a misleading partial total', async () => {
  await assert.rejects(readPages(async from => from ? { data: null, error: { message: 'offline' } } : { data: Array(500).fill(1), error: null }), /offline/);
});
