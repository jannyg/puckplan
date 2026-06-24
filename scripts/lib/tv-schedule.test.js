// scripts/lib/tv-schedule.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fetchTvSchedule } from './tv-schedule.js';

const tv2Channel   = { id: 'TV2S02', displayName: 'TV 2 Sport 2' };
const otherChannel = { id: 'EUROS2', displayName: 'Eurosport 2' };

const hockeyProgram = {
  title: 'NM-sluttspill ishockey, menn: Storhamar - Oilers',
  startTime: '2026-03-23T18:55:00',
  endTime:   '2026-03-23T21:30:00',
  live: true,
};

const nonHockeyProgram = {
  title: 'Fotball: Premier League',
  startTime: '2026-03-23T15:00:00',
  endTime:   '2026-03-23T17:00:00',
  live: true,
};

function makeDay(channel, programs) {
  return [{ channel, programs }];
}

function makeFetcher(dayData) {
  return async () => ({ statusCode: 200, body: JSON.stringify(dayData) });
}

describe('fetchTvSchedule', () => {
  it('returns hockey broadcasts on TV 2 channels', async () => {
    const fetcher = makeFetcher(makeDay(tv2Channel, [hockeyProgram]));
    const result = await fetchTvSchedule(1, fetcher);
    assert.equal(result.length, 1);
    assert.equal(result[0].title, hockeyProgram.title);
    assert.equal(result[0].channel, 'TV 2 Sport 2');
    assert.equal(result[0].live, true);
  });

  it('excludes hockey on non-TV2 channels', async () => {
    const fetcher = makeFetcher(makeDay(otherChannel, [hockeyProgram]));
    const result = await fetchTvSchedule(1, fetcher);
    assert.equal(result.length, 0);
  });

  it('excludes non-hockey programs on TV 2', async () => {
    const fetcher = makeFetcher(makeDay(tv2Channel, [nonHockeyProgram]));
    const result = await fetchTvSchedule(1, fetcher);
    assert.equal(result.length, 0);
  });

  it('deduplicates same broadcast', async () => {
    const fetcher = makeFetcher(makeDay(tv2Channel, [hockeyProgram, hockeyProgram]));
    const result = await fetchTvSchedule(1, fetcher);
    assert.equal(result.length, 1);
  });

  it('returns empty array when fetch fails', async () => {
    const fetcher = async () => ({ statusCode: 500, body: '' });
    const result = await fetchTvSchedule(1, fetcher);
    assert.equal(result.length, 0);
  });

  it('sorts broadcasts by start time', async () => {
    const early = { ...hockeyProgram, title: 'Ishockey A', startTime: '2026-03-23T14:00:00', endTime: '2026-03-23T16:00:00' };
    const late  = { ...hockeyProgram, title: 'Ishockey B', startTime: '2026-03-23T19:00:00', endTime: '2026-03-23T21:00:00' };
    const fetcher = makeFetcher(makeDay(tv2Channel, [late, early]));
    const result = await fetchTvSchedule(1, fetcher);
    assert.equal(result[0].title, 'Ishockey A');
    assert.equal(result[1].title, 'Ishockey B');
  });

  it('queries one URL per requested day', async () => {
    const urls = [];
    const fetcher = async (url) => {
      urls.push(url);
      return { statusCode: 200, body: JSON.stringify([]) };
    };
    await fetchTvSchedule(3, fetcher);
    assert.equal(urls.length, 3);
    assert.ok(urls.every(u => u.includes('/epg/days/')));
  });

  it('matches the ishockey keyword case-insensitively', async () => {
    const upper = { ...hockeyProgram, title: 'ISHOCKEY: Storhamar - Lillehammer' };
    const result = await fetchTvSchedule(1, makeFetcher(makeDay(tv2Channel, [upper])));
    assert.equal(result.length, 1);
  });

  it('defaults live to false when the field is absent', async () => {
    const noLive = { title: 'Ishockey: test', startTime: '2026-03-23T18:00:00', endTime: '2026-03-23T20:00:00' };
    const result = await fetchTvSchedule(1, makeFetcher(makeDay(tv2Channel, [noLive])));
    assert.equal(result.length, 1);
    assert.equal(result[0].live, false);
  });

  it('tolerates a day entry with no programs array', async () => {
    const fetcher = makeFetcher([{ channel: tv2Channel }]);
    const result = await fetchTvSchedule(1, fetcher);
    assert.deepEqual(result, []);
  });
});
