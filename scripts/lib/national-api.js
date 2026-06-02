// scripts/lib/national-api.js
import { fetchJson, httpsGet } from './fetch.js';

const NORWAY_TEAM_ID = '141346';
const WM_LEAGUE_ID = '4976';

// Season runs August–July: month >= 8 → YYYY-(YYYY+1), else (YYYY-1)-YYYY.
export function currentNationalSeason(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (month >= 8) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}

function cleanTeamName(name) {
  return name.replace(/ Ice [Hh]ockey$/, '');
}

function normalizeWmEvent(ev) {
  const isHome = ev.idHomeTeam === NORWAY_TEAM_ID;
  return {
    idEvent:     ev.idEvent,
    strHomeTeam: isHome ? 'Norge' : cleanTeamName(ev.strHomeTeam),
    strAwayTeam: isHome ? cleanTeamName(ev.strAwayTeam) : 'Norge',
    dateEvent:   ev.dateEvent,
    strTime:     ev.strTime ?? '00:00:00',
    strVenue:    ev.strVenue ?? '',
    idHomeTeam:  ev.idHomeTeam,
    idAwayTeam:  ev.idAwayTeam,
  };
}

export async function fetchWmGames(date = new Date(), _fetcher) {
  const season = currentNationalSeason(date);
  const wmYear = season.split('-')[1];
  const url = `https://www.thesportsdb.com/api/v1/json/3/eventsseason.php?id=${WM_LEAGUE_ID}&s=${wmYear}`;
  const data = _fetcher
    ? await fetchJson(url, true, _fetcher)
    : await fetchJson(url);
  if (!data || !data.events) return [];

  return data.events
    .filter(ev => ev.idHomeTeam === NORWAY_TEAM_ID || ev.idAwayTeam === NORWAY_TEAM_ID)
    .map(normalizeWmEvent);
}

// --- Hockey.no scraping ---

const COUNTRY_CODES = {
  NOR: 'Norge', DEN: 'Danmark', SWE: 'Sverige', FIN: 'Finland',
  HUN: 'Ungarn', LAT: 'Latvia', GER: 'Tyskland', AUT: 'Østerrike',
  CZE: 'Tsjekkia', SVK: 'Slovakia', SUI: 'Sveits', FRA: 'Frankrike',
  GBR: 'Storbritannia', POL: 'Polen', SLO: 'Slovenia', KAZ: 'Kasakhstan',
  KOR: 'Sør-Korea', ITA: 'Italia', BLR: 'Hviterussland', USA: 'USA',
  CAN: 'Canada', JPN: 'Japan', CHN: 'Kina', ROU: 'Romania',
  CRO: 'Kroatia', UKR: 'Ukraina', EST: 'Estland', LTU: 'Litauen',
};

function teamNameFromCode(code) {
  return COUNTRY_CODES[code] ?? code;
}

// Convert Norwegian local time to UTC.
// CET (Oct–Mar): subtract 1h. CEST (Apr–Sep): subtract 2h.
function norwegianTimeToUtc(month, hours, minutes) {
  const isCest = month >= 4 && month <= 9;
  const offset = isCest ? 2 : 1;
  let utcHours = hours - offset;
  if (utcHours < 0) utcHours += 24;
  const hh = String(utcHours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  return `${hh}:${mm}:00`;
}

function parseActivityLinks(html, season) {
  const links = [];
  const re = new RegExp(
    `href="(/landslag/a-landslaget-menn/${season}/aktivitet/[^"]+)"[^>]*>\\s*([^<]+)`,
    'gi'
  );
  let m;
  while ((m = re.exec(html)) !== null) {
    const path = m[1];
    const label = m[2].trim();
    links.push({ path, label });
  }
  return links;
}

function parseDateFromOverview(html, activityPath) {
  // Try to find the "Dato fra" or date info associated with this activity.
  // The overview page typically shows dates near the activity link.
  // Look for a date pattern like "DD.MM.YYYY" near the activity path.
  const idx = html.indexOf(activityPath);
  if (idx === -1) return null;
  // Search in a window around the link
  const window = html.slice(Math.max(0, idx - 500), idx + 500);
  const dateMatch = window.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dateMatch) {
    return { day: parseInt(dateMatch[1]), month: parseInt(dateMatch[2]), year: parseInt(dateMatch[3]) };
  }
  return null;
}

function parseGameLines(html, activityYear) {
  const games = [];
  // Match lines like: "Torsdag 30/4 kl 19.00 - DEN v NOR 3-1"
  // or "Fredag 1/5 kl 14.00 - NOR v HUN"
  // or "NOR - DEN 3-1" or "NOR vs SWE"
  const lineRe = /(\d{1,2})\/(\d{1,2})\s+kl\s+(\d{1,2})[.:](\d{2})\s*[-–]\s*([A-Z]{3})\s+(?:v|vs|[-–])\s+([A-Z]{3})/gi;
  let m;
  while ((m = lineRe.exec(html)) !== null) {
    const day = parseInt(m[1]);
    const month = parseInt(m[2]);
    const hours = parseInt(m[3]);
    const minutes = parseInt(m[4]);
    const team1 = m[5];
    const team2 = m[6];

    const isHome = team1 === 'NOR';
    const opponentCode = isHome ? team2 : team1;
    const opponent = teamNameFromCode(opponentCode);

    const dd = String(day).padStart(2, '0');
    const mm = String(month).padStart(2, '0');
    const dateEvent = `${activityYear}-${mm}-${dd}`;
    const strTime = norwegianTimeToUtc(month, hours, minutes);

    games.push({
      idEvent:     `national-${dateEvent}-${opponentCode}`,
      strHomeTeam: isHome ? 'Norge' : opponent,
      strAwayTeam: isHome ? opponent : 'Norge',
      dateEvent,
      strTime,
      strVenue:    '',
      idHomeTeam:  isHome ? NORWAY_TEAM_ID : opponentCode,
      idAwayTeam:  isHome ? opponentCode : NORWAY_TEAM_ID,
    });
  }
  return games;
}

export async function fetchNationalFriendlyGames(date = new Date(), _fetcher) {
  const season = currentNationalSeason(date);
  const overviewUrl = `https://www.hockey.no/landslag/a-landslaget-menn/${season}/`;
  const fetcher = _fetcher ?? httpsGet;

  let overviewRes;
  try {
    overviewRes = await fetcher(overviewUrl);
  } catch (err) {
    console.warn(`Failed to fetch hockey.no overview: ${err.message}`);
    return [];
  }
  if (overviewRes.statusCode !== 200) {
    console.warn(`HTTP ${overviewRes.statusCode} for ${overviewUrl}`);
    return [];
  }

  const activities = parseActivityLinks(overviewRes.body, season);
  const allGames = [];

  for (const activity of activities) {
    const label = activity.label;
    // Skip training camps and VM (handled by TheSportsDB)
    if (/treningssamling/i.test(label) || /\bVM\b/.test(label)) continue;

    const dateInfo = parseDateFromOverview(overviewRes.body, activity.path);

    const detailUrl = `https://www.hockey.no${activity.path}`;
    let detailRes;
    try {
      detailRes = await fetcher(detailUrl);
    } catch (err) {
      console.warn(`Failed to fetch activity page: ${err.message}`);
      continue;
    }
    if (detailRes.statusCode !== 200) {
      console.warn(`HTTP ${detailRes.statusCode} for ${detailUrl}`);
      continue;
    }

    const activityYear = dateInfo?.year ?? parseInt(season.split('-')[1]);
    const games = parseGameLines(detailRes.body, activityYear);
    allGames.push(...games);
  }

  return allGames;
}

export async function fetchAllNationalGames(date = new Date(), _fetcher) {
  const [wmGames, friendlyGames] = await Promise.all([
    fetchWmGames(date, _fetcher),
    fetchNationalFriendlyGames(date, _fetcher),
  ]);
  return [...wmGames, ...friendlyGames];
}
