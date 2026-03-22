// scripts/lib/api.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildApiUrl, extractEvents } from './api.js';

describe('buildApiUrl', () => {
  it('builds correct URL for EHL', () => {
    const url = buildApiUrl('4926', '2025-2026');
    assert.equal(
      url,
      'https://www.thesportsdb.com/api/v1/json/123/eventsseason.php?id=4926&s=2025-2026'
    );
  });
});

describe('extractEvents', () => {
  it('returns empty array when response is null', () => {
    assert.deepEqual(extractEvents(null), []);
  });
  it('returns empty array when events key is null', () => {
    assert.deepEqual(extractEvents({ events: null }), []);
  });
  it('returns events array when present', () => {
    const data = { events: [{ idEvent: '1', strEvent: 'A vs B' }] };
    assert.deepEqual(extractEvents(data), [{ idEvent: '1', strEvent: 'A vs B' }]);
  });
});
