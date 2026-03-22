// scripts/lib/teams.js
export function discoverTeamId(teamName, events) {
  for (const e of events) {
    if (e.strHomeTeam === teamName) return e.idHomeTeam;
    if (e.strAwayTeam === teamName) return e.idAwayTeam;
  }
  return null;
}

export function buildTeams(ehlEvents, chlEvents, seedTeams) {
  const chlTeamNames = new Set([
    ...chlEvents.map(e => e.strHomeTeam),
    ...chlEvents.map(e => e.strAwayTeam),
  ]);

  return seedTeams.map(seed => ({
    slug: seed.slug,
    name: seed.name,
    thesportsdb_id: discoverTeamId(seed.name, ehlEvents),
    leagues: {
      ehl: true,
      'ehl-sluttspill': true,
      chl: chlTeamNames.has(seed.name),
    },
  }));
}
