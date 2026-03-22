// scripts/lib/fetch.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonResponse } from './fetch.js';

describe('parseJsonResponse', () => {
  it('parses valid JSON string', () => {
    const result = parseJsonResponse('{"events":[{"id":1}]}');
    assert.deepEqual(result, { events: [{ id: 1 }] });
  });
  it('returns null for empty string', () => {
    assert.equal(parseJsonResponse(''), null);
  });
  it('returns null for invalid JSON', () => {
    assert.equal(parseJsonResponse('not json'), null);
  });
});
