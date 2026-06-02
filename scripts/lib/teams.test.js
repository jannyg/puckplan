// scripts/lib/teams.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildTeams } from './teams.js';

const seedTeams = [
  { slug: 'storhamar',  name: 'Storhamar',  thesportsdb_id: '140842' },
  { slug: 'sparta',     name: 'Sparta',     thesportsdb_id: '140839' },
  { slug: 'vaalerenga', name: 'Vålerenga',  thesportsdb_id: '140843' },
];

const ehlEvents = [
  { strHomeTeam: 'Storhamar', strAwayTeam: 'Sparta' },
];

const chlEvents = [
  { strHomeTeam: 'Storhamar', strAwayTeam: 'Eisbären Berlin' },
];

describe('buildTeams', () => {
  it('builds correct team list with IDs and league flags', () => {
    const teams = buildTeams(ehlEvents, chlEvents, seedTeams);

    const storhamar = teams.find(t => t.slug === 'storhamar');
    assert.equal(storhamar.thesportsdb_id, '140842');
    assert.equal(storhamar.leagues.ehl, true);
    assert.equal(storhamar.leagues['ehl-sluttspill'], true);
    assert.equal(storhamar.leagues.chl, true);
    assert.equal(storhamar.leagues.alle, true);

    const sparta = teams.find(t => t.slug === 'sparta');
    assert.equal(sparta.thesportsdb_id, '140839');
    assert.equal(sparta.leagues.chl, false);

    const vaalerenga = teams.find(t => t.slug === 'vaalerenga');
    assert.equal(vaalerenga.thesportsdb_id, '140843');
    assert.equal(vaalerenga.leagues.chl, false);
  });

  it('uses null thesportsdb_id when not in seed', () => {
    const seed = [{ slug: 'unknown', name: 'Unknown', thesportsdb_id: undefined }];
    const teams = buildTeams([], [], seed);
    assert.equal(teams[0].thesportsdb_id, null);
  });

  it('matches CHL teams using substring matching', () => {
    const seed = [
      { slug: 'storhamar', name: 'Storhamar', thesportsdb_id: '140842' },
      { slug: 'sparta', name: 'Sparta', thesportsdb_id: '140839' },
    ];
    const chlEventsWithSuffix = [
      { strHomeTeam: 'Storhamar Hamar', strAwayTeam: 'Eisbären Berlin' },
    ];
    const teams = buildTeams([], chlEventsWithSuffix, seed);

    const storhamar = teams.find(t => t.slug === 'storhamar');
    assert.equal(storhamar.leagues.chl, true, 'should match "Storhamar" seed with "Storhamar Hamar" from API');

    const sparta = teams.find(t => t.slug === 'sparta');
    assert.equal(sparta.leagues.chl, false, 'Sparta should not match');
  });

  it('builds national team with landslag league only', () => {
    const seed = [
      { slug: 'storhamar', name: 'Storhamar', thesportsdb_id: '140842' },
      { slug: 'norge', name: 'Norge', thesportsdb_id: '141346', type: 'national' },
    ];
    const teams = buildTeams(ehlEvents, chlEvents, seed);

    const norge = teams.find(t => t.slug === 'norge');
    assert.equal(norge.type, 'national');
    assert.equal(norge.leagues.landslag, true);
    assert.equal(norge.leagues.ehl, undefined);
    assert.equal(norge.leagues.chl, undefined);

    const storhamar = teams.find(t => t.slug === 'storhamar');
    assert.equal(storhamar.type, undefined);
    assert.equal(storhamar.leagues.ehl, true);
  });
});
