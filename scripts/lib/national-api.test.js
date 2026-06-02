// scripts/lib/national-api.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { currentNationalSeason, fetchWmGames, fetchNationalFriendlyGames, fetchAllNationalGames } from './national-api.js';

function makeFetcher(body, statusCode = 200) {
  return async () => ({ statusCode, body: typeof body === 'string' ? body : JSON.stringify(body) });
}

const mockWmResponse = {
  events: [
    {
      idEvent: '2474616',
      strHomeTeam: 'Slovakia Ice Hockey',
      strAwayTeam: 'Norway Ice hockey',
      idHomeTeam: '141348',
      idAwayTeam: '141346',
      dateEvent: '2026-05-16',
      strTime: '10:20:00',
      strVenue: 'BCF Arena',
    },
    {
      idEvent: '2354269',
      strHomeTeam: 'Canada Ice Hockey',
      strAwayTeam: 'Sweden Ice Hockey',
      idHomeTeam: '141337',
      idAwayTeam: '141349',
      dateEvent: '2026-05-15',
      strTime: '14:20:00',
      strVenue: 'BCF Arena',
    },
  ],
};

describe('currentNationalSeason', () => {
  it('returns current season from August onwards', () => {
    assert.equal(currentNationalSeason(new Date('2025-08-15')), '2025-2026');
  });

  it('returns previous season before August', () => {
    assert.equal(currentNationalSeason(new Date('2026-03-15')), '2025-2026');
  });

  it('returns previous season in July', () => {
    assert.equal(currentNationalSeason(new Date('2026-07-15')), '2025-2026');
  });

  it('rolls over correctly in August', () => {
    assert.equal(currentNationalSeason(new Date('2026-08-01')), '2026-2027');
  });
});

describe('fetchWmGames', () => {
  it('fetches and filters Norway WM games', async () => {
    const games = await fetchWmGames(new Date('2026-03-15'), makeFetcher(mockWmResponse));
    assert.equal(games.length, 1);
    const g = games[0];
    assert.equal(g.idEvent, '2474616');
    assert.equal(g.strHomeTeam, 'Slovakia');
    assert.equal(g.strAwayTeam, 'Norge');
    assert.equal(g.dateEvent, '2026-05-16');
    assert.equal(g.strTime, '10:20:00');
    assert.equal(g.strVenue, 'BCF Arena');
  });

  it('cleans team names by removing Ice Hockey suffix', async () => {
    const games = await fetchWmGames(new Date('2026-03-15'), makeFetcher(mockWmResponse));
    assert.equal(games[0].strHomeTeam, 'Slovakia');
    assert.ok(!games[0].strHomeTeam.includes('Ice Hockey'));
  });

  it('uses Norge for Norway team name when home', async () => {
    const resp = {
      events: [{
        idEvent: '123',
        strHomeTeam: 'Norway Ice hockey',
        strAwayTeam: 'Latvia Ice Hockey',
        idHomeTeam: '141346',
        idAwayTeam: '141345',
        dateEvent: '2026-05-28',
        strTime: '18:20:00',
        strVenue: 'Arena',
      }],
    };
    const games = await fetchWmGames(new Date('2026-03-15'), makeFetcher(resp));
    assert.equal(games[0].strHomeTeam, 'Norge');
    assert.equal(games[0].strAwayTeam, 'Latvia');
  });

  it('returns empty array when fetch fails', async () => {
    const games = await fetchWmGames(new Date('2026-03-15'), makeFetcher('', 500));
    assert.deepEqual(games, []);
  });

  it('returns empty array when no events', async () => {
    const games = await fetchWmGames(new Date('2026-03-15'), makeFetcher({ events: null }));
    assert.deepEqual(games, []);
  });
});

describe('fetchNationalFriendlyGames', () => {
  const overviewHtml = `
    <html><body>
    <a href="/landslag/a-landslaget-menn/2025-2026/aktivitet/kamper-mot-den/">
      Kamper mot DEN og HUN
    </a>
    <a href="/landslag/a-landslaget-menn/2025-2026/aktivitet/treningssamling/">
      Treningssamling
    </a>
    <a href="/landslag/a-landslaget-menn/2025-2026/aktivitet/vm-2026/">
      VM 2026
    </a>
    <span>27.04.2026</span>
    </body></html>
  `;

  const detailHtml = `
    <html><body>
    <h1>Kamper mot DEN og HUN</h1>
    <p>Dato fra: 27. april 2026 08:00</p>
    <p><strong>Kamper</strong></p>
    <p>Torsdag 30/4 kl 19.00 - DEN v NOR 3-1</p>
    <p>Fredag 1/5 kl 14.00 - NOR v HUN 2-1</p>
    </body></html>
  `;

  it('scrapes and parses friendly games from hockey.no', async () => {
    let callCount = 0;
    const fetcher = async (url) => {
      callCount++;
      if (url.includes('/aktivitet/')) {
        return { statusCode: 200, body: detailHtml };
      }
      return { statusCode: 200, body: overviewHtml };
    };

    const games = await fetchNationalFriendlyGames(new Date('2026-03-15'), fetcher);
    assert.equal(games.length, 2);

    // DEN v NOR (April, CEST: -2h)
    assert.equal(games[0].strHomeTeam, 'Danmark');
    assert.equal(games[0].strAwayTeam, 'Norge');
    assert.equal(games[0].dateEvent, '2026-04-30');
    assert.equal(games[0].strTime, '17:00:00');

    // NOR v HUN (May, CEST: -2h)
    assert.equal(games[1].strHomeTeam, 'Norge');
    assert.equal(games[1].strAwayTeam, 'Ungarn');
    assert.equal(games[1].dateEvent, '2026-05-01');
    assert.equal(games[1].strTime, '12:00:00');
  });

  it('skips training camps and VM activities', async () => {
    let detailFetched = false;
    const fetcher = async (url) => {
      if (url.includes('/aktivitet/')) {
        detailFetched = true;
        return { statusCode: 200, body: '<html></html>' };
      }
      return { statusCode: 200, body: overviewHtml };
    };

    await fetchNationalFriendlyGames(new Date('2026-03-15'), fetcher);
    // Only the "kamper-mot-den" activity should be fetched, not treningssamling or VM
    assert.equal(detailFetched, true);
  });

  it('returns empty array when hockey.no is unavailable', async () => {
    const games = await fetchNationalFriendlyGames(new Date('2026-03-15'), makeFetcher('', 500));
    assert.deepEqual(games, []);
  });
});

describe('fetchAllNationalGames', () => {
  it('combines WM and friendly games', async () => {
    let callCount = 0;
    const fetcher = async (url) => {
      callCount++;
      if (url.includes('thesportsdb.com')) {
        return { statusCode: 200, body: JSON.stringify(mockWmResponse) };
      }
      // hockey.no returns empty (no activities)
      return { statusCode: 200, body: '<html></html>' };
    };

    const games = await fetchAllNationalGames(new Date('2026-03-15'), fetcher);
    // Should have the 1 Norway WM game
    assert.equal(games.length, 1);
    assert.equal(games[0].strAwayTeam, 'Norge');
  });
});
