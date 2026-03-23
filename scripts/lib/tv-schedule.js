// scripts/lib/tv-schedule.js
// Fetches upcoming EHL hockey broadcasts from the TV 2 public EPG API.
// No API key required.
import { fetchJson } from './fetch.js';

const EPG_BASE = 'https://tv2no-epg-api.public.tv2.no';

// Only include TV 2 channels — the official EHL broadcaster in Norway.
// Eurosport, SVT etc. carry OL/Swedish hockey, not EHL.
function isTV2Channel(channel) {
  return channel?.id?.startsWith('TV2') ?? false;
}

function isHockey(program) {
  return program?.title?.toLowerCase().includes('ishockey') ?? false;
}

function normalizeProgram(program, channel) {
  return {
    title:     program.title,
    channel:   channel.displayName,
    startTime: program.startTime,
    endTime:   program.endTime,
    live:      program.live ?? false,
  };
}

export async function fetchTvSchedule(days = 14, _fetcher) {
  const broadcasts = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i));
    const year  = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const day   = d.getUTCDate();

    const url = `${EPG_BASE}/epg/days/${year}/${month}/${day}`;
    const data = _fetcher
      ? await fetchJson(url, true, _fetcher)
      : await fetchJson(url);

    for (const entry of data ?? []) {
      if (!isTV2Channel(entry.channel)) continue;
      for (const program of entry.programs ?? []) {
        if (isHockey(program)) {
          broadcasts.push(normalizeProgram(program, entry.channel));
        }
      }
    }
  }

  // Sort by start time, deduplicate by title+startTime
  const seen = new Set();
  return broadcasts
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .filter(b => {
      const key = `${b.startTime}|${b.title}|${b.channel}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
