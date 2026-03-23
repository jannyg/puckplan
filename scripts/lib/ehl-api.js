// scripts/lib/ehl-api.js
import { fetchJson } from './fetch.js';

const BASE_URL = 'https://www.ehl.no/api/sports-v2';
const SERIES_UUID = 'qUu-397s1Dpwm';
const GAME_TYPE_REGULAR = 'qQ9-af37Ti40B';
const GAME_TYPE_PLAYOFF = 'qQ9-7debq38kX';

// Season code is the starting year of the season (e.g. "2025" for 2025/2026).
// We use June as the boundary: before June, we're still in the previous year's season.
export function currentSeasonCode(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return month >= 6 ? String(year) : String(year - 1);
}

// Returns up to two UUIDs: the API's current default season, and the season
// matching the current date calculation. Usually they're the same. During
// transitions (e.g. summer when a new season is published), both are included
// so games from neither season are lost.
export async function fetchRelevantSeasonUuids(_fetcher) {
  const url = `${BASE_URL}/season-series-game-types-filter?series=${SERIES_UUID}`;
  const data = _fetcher
    ? await fetchJson(url, true, _fetcher)
    : await fetchJson(url);
  if (!data) return [];

  const uuids = new Set();

  // Always include the API's current default
  if (data.defaultSsgtFilter?.season) {
    uuids.add(data.defaultSsgtFilter.season);
  }

  // Also include the season matching today's date, in case the API default
  // has already flipped to a new season while the current season is ongoing
  const code = currentSeasonCode();
  const match = (data.season ?? []).find(s => s.code === code);
  if (match) uuids.add(match.uuid);

  return [...uuids];
}

function normalizeGame(game) {
  const [date, timePart] = game.rawStartDateTime.split('T');
  return {
    idEvent:     game.uuid,
    strHomeTeam: game.homeTeamInfo.names.short,
    strAwayTeam: game.awayTeamInfo.names.short,
    dateEvent:   date,
    strTime:     timePart.slice(0, 8),
    strVenue:    game.venueInfo?.name ?? '',
    idHomeTeam:  game.homeTeamInfo.uuid,
    idAwayTeam:  game.awayTeamInfo.uuid,
  };
}

async function fetchGames(seasonUuids, gameTypeUuid, _fetcher) {
  const seen = new Map();
  for (const seasonUuid of seasonUuids) {
    for (const played of [false, true]) {
      const url = `${BASE_URL}/game-schedule` +
        `?seasonUuid=${seasonUuid}&seriesUuid=${SERIES_UUID}` +
        `&gameTypeUuid=${gameTypeUuid}&gamePlace=home&played=${played}`;
      const data = _fetcher
        ? await fetchJson(url, true, _fetcher)
        : await fetchJson(url);
      for (const game of data?.gameInfo ?? []) {
        seen.set(game.uuid, normalizeGame(game));
      }
    }
  }
  return [...seen.values()];
}

export async function fetchEhlRegularGames(seasonUuids, _fetcher) {
  return fetchGames(seasonUuids, GAME_TYPE_REGULAR, _fetcher);
}

export async function fetchEhlPlayoffGames(seasonUuids, _fetcher) {
  return fetchGames(seasonUuids, GAME_TYPE_PLAYOFF, _fetcher);
}
