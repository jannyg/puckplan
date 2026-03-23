// scripts/lib/ehl-api.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { currentSeasonCode, fetchRelevantSeasonUuids, fetchEhlRegularGames, fetchEhlPlayoffGames } from './ehl-api.js';

const SEASON_UUID = 'bir2zwf4qa';

const mockFilterResponse = {
  defaultSsgtFilter: { season: SEASON_UUID, series: 'qUu-397s1Dpwm', gameType: 'qQ9-af37Ti40B' },
  season: [
    { uuid: SEASON_UUID, code: '2025' },
    { uuid: 'prev-season-uuid', code: '2024' },
  ],
};

const mockGame = {
  uuid: 'game1',
  rawStartDateTime: '2025-09-11T17:00:00.000Z',
  homeTeamInfo: { uuid: 'team1', names: { short: 'Storhamar' } },
  awayTeamInfo: { uuid: 'team2', names: { short: 'Sparta' } },
  venueInfo: { name: 'Hamar OL-Amfi' },
};

function makeFetcher(body, statusCode = 200) {
  return async () => ({ statusCode, body: JSON.stringify(body) });
}

describe('currentSeasonCode', () => {
  it('returns current year before June', () => {
    assert.equal(currentSeasonCode(new Date('2026-03-15')), '2025');
  });
  it('returns current year from June onwards', () => {
    assert.equal(currentSeasonCode(new Date('2026-06-01')), '2026');
  });
});

describe('fetchRelevantSeasonUuids', () => {
  it('returns the API default season UUID', async () => {
    const uuids = await fetchRelevantSeasonUuids(makeFetcher(mockFilterResponse));
    assert.ok(uuids.includes(SEASON_UUID));
  });

  it('includes season matching current date when different from default', async () => {
    // Simulate: API default is 2026/2027, but we're in May 2026 (still 2025/2026)
    const response = {
      defaultSsgtFilter: { season: 'new-season-uuid' },
      season: [
        { uuid: 'new-season-uuid', code: '2026' },
        { uuid: SEASON_UUID, code: '2025' },
      ],
    };
    const uuids = await fetchRelevantSeasonUuids(makeFetcher(response));
    // Both included during transition (current date is 2026-03, so code = '2025')
    assert.ok(uuids.includes('new-season-uuid'));
    assert.ok(uuids.includes(SEASON_UUID));
  });

  it('deduplicates when default and date-based match are the same', async () => {
    const uuids = await fetchRelevantSeasonUuids(makeFetcher(mockFilterResponse));
    assert.equal(new Set(uuids).size, uuids.length);
  });

  it('returns empty array when fetch fails', async () => {
    const uuids = await fetchRelevantSeasonUuids(makeFetcher('', 500));
    assert.deepEqual(uuids, []);
  });
});

describe('fetchEhlRegularGames', () => {
  it('normalizes game data to internal format', async () => {
    const fetcher = makeFetcher({ gameInfo: [mockGame] });
    const games = await fetchEhlRegularGames([SEASON_UUID], fetcher);
    assert.equal(games.length, 1);
    const g = games[0];
    assert.equal(g.idEvent, 'game1');
    assert.equal(g.strHomeTeam, 'Storhamar');
    assert.equal(g.strAwayTeam, 'Sparta');
    assert.equal(g.dateEvent, '2025-09-11');
    assert.equal(g.strTime, '17:00:00');
    assert.equal(g.strVenue, 'Hamar OL-Amfi');
    assert.equal(g.idHomeTeam, 'team1');
    assert.equal(g.idAwayTeam, 'team2');
  });

  it('deduplicates games appearing in both played and upcoming responses', async () => {
    let callCount = 0;
    const fetcher = async () => {
      callCount++;
      return { statusCode: 200, body: JSON.stringify({ gameInfo: [mockGame] }) };
    };
    const games = await fetchEhlRegularGames([SEASON_UUID], fetcher);
    assert.equal(games.length, 1);
    assert.equal(callCount, 2);
  });

  it('merges and deduplicates games across multiple seasons', async () => {
    const fetcher = makeFetcher({ gameInfo: [mockGame] });
    const games = await fetchEhlRegularGames([SEASON_UUID, 'other-uuid'], fetcher);
    assert.equal(games.length, 1); // same game uuid from both seasons, deduplicated
  });

  it('returns empty array when API returns no games', async () => {
    const games = await fetchEhlRegularGames([SEASON_UUID], makeFetcher({ gameInfo: [] }));
    assert.equal(games.length, 0);
  });

  it('returns empty array when fetch fails', async () => {
    const games = await fetchEhlRegularGames([SEASON_UUID], makeFetcher('', 500));
    assert.equal(games.length, 0);
  });
});

describe('fetchEhlPlayoffGames', () => {
  it('returns normalized playoff games', async () => {
    const games = await fetchEhlPlayoffGames([SEASON_UUID], makeFetcher({ gameInfo: [mockGame] }));
    assert.equal(games.length, 1);
    assert.equal(games[0].idEvent, 'game1');
  });
});
