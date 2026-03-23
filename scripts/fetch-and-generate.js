// scripts/fetch-and-generate.js
import fs from 'node:fs';
import path from 'node:path';
import { getCurrentSeason } from './lib/season.js';
import { fetchLeagueEvents } from './lib/api.js';
import { categorizeEvent } from './lib/categorize.js';
import { generateIcs } from './lib/ics.js';
import { buildTeams } from './lib/teams.js';

const EHL_ID  = '4926';
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
  const season = getCurrentSeason();
  console.log(`Season: ${season}`);

  const seedTeams = readJson('data/teams-seed.json').teams;

  console.log('Fetching EHL events...');
  const ehlAllEvents = await fetchLeagueEvents(EHL_ID, season);
  console.log(`  Got ${ehlAllEvents.length} EHL events`);

  console.log('Fetching CHL events...');
  const chlEvents = await fetchLeagueEvents(CHL_ID, season);
  console.log(`  Got ${chlEvents.length} CHL events`);

  // Split EHL into serie + sluttspill, tag each event with its source league for UID stability
  const ehlEvents         = ehlAllEvents.filter(e => categorizeEvent(e) === 'ehl').map(e => ({ ...e, _league: 'ehl' }));
  const sluttspillEvents  = ehlAllEvents.filter(e => categorizeEvent(e) === 'ehl-sluttspill').map(e => ({ ...e, _league: 'ehl-sluttspill' }));
  const chlTagged         = chlEvents.map(e => ({ ...e, _league: 'chl' }));

  const eventsByLeague = {
    'ehl': ehlEvents,
    'ehl-sluttspill': sluttspillEvents,
    'chl': chlTagged,
    'alle': [...ehlEvents, ...sluttspillEvents, ...chlTagged],
  };

  // Build teams.json
  const teams = buildTeams(ehlAllEvents, chlEvents, seedTeams);
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
}

main().catch(err => {
  console.error('Script failed:', err.message);
  process.exit(0); // Exit 0 to not fail the workflow
});
