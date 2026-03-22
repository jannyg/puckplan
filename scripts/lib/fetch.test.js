// scripts/lib/fetch.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonResponse, fetchJson } from './fetch.js';

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

describe('fetchJson', () => {
  it('returns parsed JSON on 200', async () => {
    const mockFetcher = async () => ({ statusCode: 200, body: '{"events":[]}' });
    const result = await fetchJson('http://example.com', true, mockFetcher);
    assert.deepEqual(result, { events: [] });
  });

  it('returns null on non-200 status', async () => {
    const mockFetcher = async () => ({ statusCode: 500, body: '' });
    const result = await fetchJson('http://example.com', true, mockFetcher);
    assert.equal(result, null);
  });

  it('retries once on 429 then succeeds', async () => {
    let calls = 0;
    const mockFetcher = async () => {
      calls++;
      if (calls === 1) return { statusCode: 429, body: '' };
      return { statusCode: 200, body: '{"events":[1]}' };
    };
    // Override setTimeout to avoid 60s wait in tests
    const origSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (fn) => { fn(); return 0; };
    const result = await fetchJson('http://example.com', true, mockFetcher);
    globalThis.setTimeout = origSetTimeout;
    assert.deepEqual(result, { events: [1] });
    assert.equal(calls, 2);
  });

  it('returns null on 429 with no retry', async () => {
    const mockFetcher = async () => ({ statusCode: 429, body: '' });
    const origSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (fn) => { fn(); return 0; };
    const result = await fetchJson('http://example.com', false, mockFetcher);
    globalThis.setTimeout = origSetTimeout;
    assert.equal(result, null);
  });
});
