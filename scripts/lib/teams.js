// scripts/lib/teams.js
export function buildTeams(ehlEvents, chlEvents, seedTeams) {
  const chlTeamNames = new Set([
    ...chlEvents.map(e => e.strHomeTeam),
    ...chlEvents.map(e => e.strAwayTeam),
  ]);

  return seedTeams.map(seed => ({
    slug: seed.slug,
    name: seed.name,
    thesportsdb_id: seed.thesportsdb_id ?? null,
    leagues: {
      ehl: true,
      'ehl-sluttspill': true,
      chl: [...chlTeamNames].some(n => n.includes(seed.name) || seed.name.includes(n)),
      alle: true,
    },
  }));
}
