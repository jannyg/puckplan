// scripts/fetch-and-generate.js
import fs from 'node:fs';
import path from 'node:path';
import { getCurrentSeason } from './lib/season.js';
import { fetchLeagueEvents } from './lib/api.js';
import { fetchRelevantSeasonUuids, fetchEhlRegularGames, fetchEhlPlayoffGames } from './lib/ehl-api.js';
import { generateIcs } from './lib/ics.js';
import { buildTeams } from './lib/teams.js';
import { fetchTvSchedule } from './lib/tv-schedule.js';

const CHL_ID  = '5277';
const REMINDERS = ['none', '15m', '1h', '3h', '24h'];
const LEAGUES   = ['ehl', 'ehl-sluttspill', 'chl', 'alle'];

const ROOT = new URL('..', import.meta.url).pathname;

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), 'utf8'));
}

function writeFile(relPath, content) {
  const abs = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
}

async function main() {
  const seedTeams = readJson('data/teams-seed.json').teams;

  // EHL data from ehl.no API
  console.log('Fetching relevant EHL season(s)...');
  const seasonUuids = await fetchRelevantSeasonUuids();
  if (seasonUuids.length === 0) {
    console.error('Could not determine current EHL season UUID(s)');
    process.exit(0);
  }
  console.log(`  Season UUID(s): ${seasonUuids.join(', ')}`);

  console.log('Fetching EHL regular season games...');
  const ehlEvents = await fetchEhlRegularGames(seasonUuids);
  console.log(`  Got ${ehlEvents.length} regular season games`);

  console.log('Fetching EHL playoff games...');
  const sluttspillEvents = await fetchEhlPlayoffGames(seasonUuids);
  console.log(`  Got ${sluttspillEvents.length} playoff games`);

  // CHL data from TheSportsDB (Norwegian teams only have ~6 games each)
  const chlSeason = getCurrentSeason();
  console.log(`Fetching CHL events (TheSportsDB, season ${chlSeason})...`);
  const chlEvents = await fetchLeagueEvents(CHL_ID, chlSeason);
  console.log(`  Got ${chlEvents.length} CHL events`);

  // Tag events with their source league for stable UIDs in the 'alle' feed
  const ehlTagged         = ehlEvents.map(e => ({ ...e, _league: 'ehl' }));
  const sluttspillTagged  = sluttspillEvents.map(e => ({ ...e, _league: 'ehl-sluttspill' }));
  const chlTagged         = chlEvents.map(e => ({ ...e, _league: 'chl' }));

  const eventsByLeague = {
    'ehl':           ehlTagged,
    'ehl-sluttspill': sluttspillTagged,
    'chl':           chlTagged,
    'alle':          [...ehlTagged, ...sluttspillTagged, ...chlTagged],
  };

  // Build teams.json
  const teams = buildTeams(ehlEvents, chlEvents, seedTeams);
  writeFile('data/teams.json', JSON.stringify({ teams }, null, 2) + '\n');
  console.log('Wrote data/teams.json');

  // Generate .ics files
  const now = new Date();
  let count = 0;
  for (const team of teams) {
    for (const league of LEAGUES) {
      for (const reminder of REMINDERS) {
        const events = eventsByLeague[league];
        const ics = generateIcs(events, team.name, league, reminder, now);
        const filePath = `feeds/${league}/${team.slug}/${reminder}.ics`;
        writeFile(filePath, ics);
        count++;
      }
    }
  }
  console.log(`Wrote ${count} .ics files`);

  // TV schedule from TV 2 EPG API
  console.log('Fetching TV schedule...');
  const broadcasts = await fetchTvSchedule(14);
  const tvSchedule = { generated: now.toISOString(), broadcasts };
  writeFile('data/tv-schedule.json', JSON.stringify(tvSchedule, null, 2) + '\n');
  console.log(`Wrote data/tv-schedule.json (${broadcasts.length} broadcasts)`);
}

main().catch(err => {
  console.error('Script failed:', err.message);
  process.exit(0); // Exit 0 to not fail the workflow
});
