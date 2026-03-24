// scripts/lib/chl-api.js
import { fetchJson } from './fetch.js';

const SEASONS_URL = 'https://www.chl.hockey/api/s3?q=seasons.json';
const SCHEDULE_URL_PREFIX = 'https://www.chl.hockey/api/s3?q=schedule-21ec9dad81abe2e0240460d0-';

// Returns the season name string for the given date, e.g. "2025/26".
// month < 6 → previous-year/year, month >= 6 → year/next-year
function currentSeasonName(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (month < 6) {
    return `${year - 1}/${String(year).slice(2)}`;
  } else {
    return `${year}/${String(year + 1).slice(2)}`;
  }
}

// Unwrap CHL API responses that may be a plain array or {data: [...]} wrapper.
function unwrapArray(resp) {
  if (Array.isArray(resp)) return resp;
  if (resp && Array.isArray(resp.data)) return resp.data;
  return null;
}

export async function fetchCurrentChlSeasonId(date = new Date(), _fetcher) {
  const raw = _fetcher
    ? await fetchJson(SEASONS_URL, true, _fetcher)
    : await fetchJson(SEASONS_URL);
  const seasons = unwrapArray(raw);
  if (!seasons) return null;

  const targetName = currentSeasonName(date);
  const match = seasons.find(s => s.name === targetName);
  return match ? match._entityId : null;
}

function normalizeGame(game) {
  return {
    idEvent:     game._entityId,
    strHomeTeam: game.teams.home.name,
    strAwayTeam: game.teams.away.name,
    dateEvent:   game.startDate.slice(0, 10),
    strTime:     game.startDate.slice(11, 19),
    strVenue:    game.venue?.name ?? '',
    idHomeTeam:  game.teams.home._entityId,
    idAwayTeam:  game.teams.away._entityId,
  };
}

export async function fetchChlGames(seasonId, seedTeamNames, _fetcher) {
  const url = `${SCHEDULE_URL_PREFIX}${seasonId}.json`;
  const raw = _fetcher
    ? await fetchJson(url, true, _fetcher)
    : await fetchJson(url);
  if (!raw) return [];

  const games = unwrapArray(raw) ?? (raw.games ? unwrapArray(raw.games) ?? [] : []);

  return games
    .filter(game => {
      const homeTeam = game.teams.home.name;
      const awayTeam = game.teams.away.name;
      return seedTeamNames.some(s =>
        homeTeam.includes(s) || s.includes(homeTeam) ||
        awayTeam.includes(s) || s.includes(awayTeam)
      );
    })
    .map(normalizeGame);
}
