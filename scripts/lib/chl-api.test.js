// scripts/lib/chl-api.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fetchCurrentChlSeasonId, fetchChlGames, currentSeasonName, resolveTeamName } from './chl-api.js';
import { generateIcs } from './ics.js';

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

describe('currentSeasonName', () => {
  it('returns year/next-year for month >= 6 (June boundary)', () => {
    assert.equal(currentSeasonName(new Date('2025-06-01T00:00:00Z')), '2025/26');
  });
  it('returns year/next-year for a late-year date', () => {
    assert.equal(currentSeasonName(new Date('2025-11-15T00:00:00Z')), '2025/26');
  });
  it('returns previous-year/year for month < 6 (May boundary)', () => {
    assert.equal(currentSeasonName(new Date('2026-05-31T00:00:00Z')), '2025/26');
  });
  it('returns previous-year/year in January', () => {
    assert.equal(currentSeasonName(new Date('2026-01-10T00:00:00Z')), '2025/26');
  });
  it('handles decade rollover (2029 -> 2029/30)', () => {
    assert.equal(currentSeasonName(new Date('2029-09-01T00:00:00Z')), '2029/30');
  });
});

describe('resolveTeamName', () => {
  it('maps a fuller API name to the matching seed name', () => {
    assert.equal(resolveTeamName('Storhamar Hamar', ['Storhamar']), 'Storhamar');
  });
  it('matches when the seed name is the longer string', () => {
    assert.equal(resolveTeamName('Storhamar', ['Storhamar Hamar']), 'Storhamar Hamar');
  });
  it('returns the API name unchanged when no seed matches', () => {
    assert.equal(resolveTeamName('Frölunda Gothenburg', ['Storhamar']), 'Frölunda Gothenburg');
  });
  it('returns the first matching seed when multiple seeds match', () => {
    assert.equal(resolveTeamName('Storhamar Hamar', ['Storhamar', 'Hamar']), 'Storhamar');
  });
  it('does not match unrelated names that share no substring', () => {
    assert.equal(resolveTeamName('KAC Klagenfurt', ['Storhamar', 'Sparta']), 'KAC Klagenfurt');
  });
});

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

  it('handles wrapped response format {data: [...]}', async () => {
    const fetcher = makeFetcher({ _type: 'Corebine.Core.Protocol.Response.Array', data: seasons });
    const date = new Date('2025-08-01T12:00:00Z');
    const result = await fetchCurrentChlSeasonId(date, fetcher);
    assert.equal(result, 'def456');
  });

  it('returns null on HTTP failure', async () => {
    const result = await fetchCurrentChlSeasonId(new Date(), makeFailFetcher());
    assert.equal(result, null);
  });

  it('returns null when no season matches the date', async () => {
    const fetcher = makeFetcher(seasons);
    const date = new Date('2014-08-01T12:00:00Z'); // 2014/15 not in mock list
    const result = await fetchCurrentChlSeasonId(date, fetcher);
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
    assert.equal(g.strHomeTeam, 'Storhamar');
    assert.equal(g.strAwayTeam, 'Frölunda HC');
    assert.equal(g.dateEvent, '2026-02-14');
    assert.equal(g.strTime, '18:00:00');
    assert.equal(g.strVenue, 'Hamar Olympic Hall');
    assert.equal(g.idHomeTeam, 'team-sh');
    assert.equal(g.idAwayTeam, 'team-fr');
  });

  it('maps API club name to seed name so downstream exact-match filters work', async () => {
    const fetcher = makeFetcher({ games: [norwegianGame] });
    const result = await fetchChlGames('def456', seedTeamNames, fetcher);
    assert.equal(result[0].strHomeTeam, 'Storhamar');
  });

  it('filters — only includes games with a Norwegian team (substring match)', async () => {
    const fetcher = makeFetcher({ games: [norwegianGame, nonNorwegianGame] });
    const result = await fetchChlGames('def456', seedTeamNames, fetcher);
    assert.equal(result.length, 1);
    assert.equal(result[0].idEvent, 'game-001');
  });

  it('includes and normalizes games where the seed team plays away', async () => {
    const awayGame = {
      _entityId: 'game-away',
      teams: {
        home: { name: 'HC Davos', _entityId: 'team-dav' },
        away: { name: 'Storhamar Hamar', _entityId: 'team-sh' },
      },
      startDate: '2026-09-04T17:45:00.000Z',
      venue: { name: 'zondacrypto-Arena' },
    };
    const result = await fetchChlGames('def456', seedTeamNames, makeFetcher({ games: [awayGame] }));
    assert.equal(result.length, 1);
    assert.equal(result[0].strHomeTeam, 'HC Davos');
    assert.equal(result[0].strAwayTeam, 'Storhamar');
  });

  it('defaults venue to empty string when missing', async () => {
    const noVenue = {
      _entityId: 'game-nv',
      teams: {
        home: { name: 'Storhamar Hamar', _entityId: 'team-sh' },
        away: { name: 'Graz99ers', _entityId: 'team-gr' },
      },
      startDate: '2026-10-14T17:00:00.000Z',
    };
    const result = await fetchChlGames('def456', seedTeamNames, makeFetcher({ games: [noVenue] }));
    assert.equal(result.length, 1);
    assert.equal(result[0].strVenue, '');
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

  it('handles wrapped response format {data: [...]}', async () => {
    const fetcher = makeFetcher({ _type: 'Corebine.Core.Protocol.Response.Array', data: [norwegianGame] });
    const result = await fetchChlGames('def456', seedTeamNames, fetcher);
    assert.equal(result.length, 1);
    assert.equal(result[0].idEvent, 'game-001');
  });
});

// Regression guard for the bug where CHL games never reached the feed because
// the API name ("Storhamar Hamar") didn't exactly equal the seed name
// ("Storhamar") that generateIcs filters on. Exercises both modules together.
describe('CHL games → ICS pipeline', () => {
  it('produces a VEVENT for a seed team even when the API uses a fuller name', async () => {
    const games = await fetchChlGames('def456', ['Storhamar'], makeFetcher({ games: [norwegianGame] }));
    const ics = generateIcs(
      games.map(g => ({ ...g, _league: 'chl' })),
      'Storhamar',
      'chl',
      'none',
      new Date('2026-06-24T00:00:00Z'),
    );
    assert.ok(ics.includes('BEGIN:VEVENT'), 'feed must contain the match, not be empty');
    assert.ok(ics.includes('SUMMARY:Storhamar vs Frölunda HC'));
    assert.ok(ics.includes('UID:chl-game-001@puckplan.no'));
  });
});
