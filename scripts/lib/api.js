// scripts/lib/api.js
import { fetchJson } from './fetch.js';

const BASE_URL = 'https://www.thesportsdb.com/api/v1/json/123';

export function buildApiUrl(leagueId, season) {
  return `${BASE_URL}/eventsseason.php?id=${leagueId}&s=${season}`;
}

export function extractEvents(data) {
  return data?.events ?? [];
}

export async function fetchLeagueEvents(leagueId, season) {
  const url = buildApiUrl(leagueId, season);
  const data = await fetchJson(url);
  return extractEvents(data);
}
