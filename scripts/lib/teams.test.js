// scripts/lib/teams.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildTeams, discoverTeamId } from './teams.js';

const seedTeams = [
  { slug: 'storhamar',  name: 'Storhamar' },
  { slug: 'sparta',     name: 'Sparta' },
  { slug: 'vaalerenga', name: 'Vålerenga' },
];

const ehlEvents = [
  { idHomeTeam: '111', strHomeTeam: 'Storhamar', idAwayTeam: '222', strAwayTeam: 'Sparta' },
  { idHomeTeam: '333', strHomeTeam: 'Vålerenga', idAwayTeam: '111', strAwayTeam: 'Storhamar' },
];

const chlEvents = [
  { idHomeTeam: '111', strHomeTeam: 'Storhamar', idAwayTeam: '999', strAwayTeam: 'Frölunda' },
];

describe('discoverTeamId', () => {
  it('finds id when team is home', () => {
    assert.equal(discoverTeamId('Storhamar', ehlEvents), '111');
  });
  it('finds id when team is away', () => {
    assert.equal(discoverTeamId('Sparta', ehlEvents), '222');
  });
  it('returns null when team not found', () => {
    assert.equal(discoverTeamId('Narvik', ehlEvents), null);
  });
});

describe('buildTeams', () => {
  it('builds correct team list with IDs and CHL flags', () => {
    const teams = buildTeams(ehlEvents, chlEvents, seedTeams);
    const storhamar = teams.find(t => t.slug === 'storhamar');
    assert.equal(storhamar.thesportsdb_id, '111');
    assert.equal(storhamar.leagues.chl, true);
    assert.equal(storhamar.leagues.ehl, true);
    assert.equal(storhamar.leagues['ehl-sluttspill'], true);

    const sparta = teams.find(t => t.slug === 'sparta');
    assert.equal(sparta.thesportsdb_id, '222');
    assert.equal(sparta.leagues.chl, false);

    const vaalerenga = teams.find(t => t.slug === 'vaalerenga');
    assert.equal(vaalerenga.thesportsdb_id, '333');
    assert.equal(vaalerenga.leagues.chl, false);
  });

  it('sets thesportsdb_id to null when team has no events', () => {
    const teams = buildTeams([], [], seedTeams);
    assert.equal(teams[0].thesportsdb_id, null);
  });
});
