// scripts/lib/chl-api.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fetchCurrentChlSeasonId, fetchChlGames } from './chl-api.js';

function makeFetcher(data) {
  return async () => ({ statusCode: 200, body: JSON.stringify(data) });
}

function makeFailFetcher() {
  return async () => ({ statusCode: 500, body: '' });
}

const seasons = [
  { _entityId: 'abc123', name: '2024/25' },
  { _entityId: 'def456', name: '2025/26' },
  { _entityId: 'ghi789', name: '2026/27' },
];

const norwegianGame = {
  _entityId: 'game-001',
  teams: {
    home: { name: 'Storhamar Hamar', _entityId: 'team-sh' },
    away: { name: 'Frölunda HC', _entityId: 'team-fr' },
  },
  startDate: '2026-02-14T18:00:00Z',
  venue: { name: 'Hamar Olympic Hall' },
};

const nonNorwegianGame = {
  _entityId: 'game-002',
  teams: {
    home: { name: 'Frölunda HC', _entityId: 'team-fr' },
    away: { name: 'Rögle BK', _entityId: 'team-ro' },
  },
  startDate: '2026-02-15T19:00:00Z',
  venue: { name: 'Frölunda Arena' },
};

const seedTeamNames = ['Storhamar'];

describe('fetchCurrentChlSeasonId', () => {
  it('returns correct season for month >= 6 (e.g. August 2025 → 2025/26)', async () => {
    const fetcher = makeFetcher(seasons);
    const date = new Date('2025-08-01T12:00:00Z');
    const result = await fetchCurrentChlSeasonId(date, fetcher);
    assert.equal(result, 'def456');
  });

  it('returns correct season for month < 6 (e.g. March 2026 → 2025/26)', async () => {
    const fetcher = makeFetcher(seasons);
    const date = new Date('2026-03-23T12:00:00Z');
    const result = await fetchCurrentChlSeasonId(date, fetcher);
    assert.equal(result, 'def456');
  });

  it('returns null on HTTP failure', async () => {
    const result = await fetchCurrentChlSeasonId(new Date(), makeFailFetcher());
    assert.equal(result, null);
  });
});

describe('fetchChlGames', () => {
  it('normalizes game fields correctly', async () => {
    const fetcher = makeFetcher({ games: [norwegianGame] });
    const result = await fetchChlGames('def456', seedTeamNames, fetcher);
    assert.equal(result.length, 1);
    const g = result[0];
    assert.equal(g.idEvent, 'game-001');
    assert.equal(g.strHomeTeam, 'Storhamar Hamar');
    assert.equal(g.strAwayTeam, 'Frölunda HC');
    assert.equal(g.dateEvent, '2026-02-14');
    assert.equal(g.strTime, '18:00:00');
    assert.equal(g.strVenue, 'Hamar Olympic Hall');
    assert.equal(g.idHomeTeam, 'team-sh');
    assert.equal(g.idAwayTeam, 'team-fr');
  });

  it('filters — only includes games with a Norwegian team (substring match)', async () => {
    const fetcher = makeFetcher({ games: [norwegianGame, nonNorwegianGame] });
    const result = await fetchChlGames('def456', seedTeamNames, fetcher);
    assert.equal(result.length, 1);
    assert.equal(result[0].idEvent, 'game-001');
  });

  it('returns empty array on HTTP failure', async () => {
    const result = await fetchChlGames('def456', seedTeamNames, makeFailFetcher());
    assert.deepEqual(result, []);
  });

  it('handles empty game list', async () => {
    const fetcher = makeFetcher({ games: [] });
    const result = await fetchChlGames('def456', seedTeamNames, fetcher);
    assert.deepEqual(result, []);
  });

  it('handles response that is a direct array (not wrapped in object)', async () => {
    const fetcher = makeFetcher([norwegianGame]);
    const result = await fetchChlGames('def456', seedTeamNames, fetcher);
    assert.equal(result.length, 1);
    assert.equal(result[0].idEvent, 'game-001');
  });
});
