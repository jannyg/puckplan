// scripts/lib/ics.js
const REMINDERS = {
  none: null,
  '15m': '-PT15M',
  '1h':  '-PT1H',
  '3h':  '-PT3H',
  '24h': '-PT24H',
};

const LEAGUE_NAMES = {
  'ehl': 'EHL',
  'ehl-sluttspill': 'EHL Sluttspill',
  'chl': 'CHL',
};

export function formatDateTime(date, time) {
  return date.replace(/-/g, '') + 'T' + time.replace(/:/g, '').slice(0, 6) + 'Z';
}

export function reminderTrigger(reminder) {
  return REMINDERS[reminder] ?? null;
}

function addTwoHours(dtStart) {
  const year   = +dtStart.slice(0, 4);
  const month  = +dtStart.slice(4, 6) - 1;
  const day    = +dtStart.slice(6, 8);
  const hour   = +dtStart.slice(9, 11);
  const minute = +dtStart.slice(11, 13);
  const d = new Date(Date.UTC(year, month, day, hour + 2, minute));
  const pad = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}` +
         `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}

function crlf(lines) {
  return lines.join('\r\n') + '\r\n';
}

export function generateIcs(allEvents, teamName, league, reminder, now = new Date()) {
  const trigger = reminderTrigger(reminder);
  const leagueLabel = LEAGUE_NAMES[league] ?? league;
  const lastModified = now.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';

  const teamEvents = allEvents.filter(e =>
    e.strHomeTeam === teamName || e.strAwayTeam === teamName
  );

  const vevents = teamEvents.map(e => {
    const dtStart = formatDateTime(e.dateEvent, e.strTime || '00:00:00');
    const dtEnd   = addTwoHours(dtStart);
    const summary = `${e.strHomeTeam} vs ${e.strAwayTeam}`;
    const uid     = `${league}-${e.idEvent}@puckplan.no`;
    const location = e.strVenue || '';

    const lines = [
      'BEGIN:VEVENT',
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${summary}`,
      ...(location ? [`LOCATION:${location}`] : []),
      'STATUS:CONFIRMED',
      `UID:${uid}`,
      `LAST-MODIFIED:${lastModified}`,
      'SEQUENCE:0',
    ];

    if (trigger) {
      lines.push(
        'BEGIN:VALARM',
        `TRIGGER:${trigger}`,
        'ACTION:DISPLAY',
        `DESCRIPTION:${teamName} spiller snart`,
        'END:VALARM',
      );
    }

    lines.push('END:VEVENT');
    return lines;
  }).flat();

  const cal = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//puckplan.no//NO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${teamName} \u2013 ${leagueLabel}`,
    `X-WR-CALDESC:${teamName} sine ${leagueLabel}-kamper`,
    'REFRESH-INTERVAL;VALUE=DURATION:P1D',
    'X-PUBLISHED-TTL:P1D',
    ...vevents,
    'END:VCALENDAR',
  ];

  return crlf(cal);
}
