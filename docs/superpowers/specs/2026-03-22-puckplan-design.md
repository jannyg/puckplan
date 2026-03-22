# puckplan.no — Design Spec

**Dato:** 2026-03-22
**Domene:** puckplan.no
**Hosting:** GitHub Pages

## Sammendrag

En statisk nettside som lar brukere abonnere på iCal-feeds for norske ishockeylag i EHL (EliteHockey Ligaen), EHL Sluttspill og CHL (Champions Hockey League). Feeds oppdateres daglig via GitHub Actions.

## Datakilde

**TheSportsDB** — gratis API, nøkkel: `123`

- EHL: league ID `4926`
- CHL: league ID `5277`
- Endepunkt: `/api/v1/json/123/eventsseason.php?id={league_id}&s={sesong}`
- Sesong beregnes automatisk basert på dato (aug–mai = samme sesong, f.eks. `2025-2026`)

## Arkitektur og dataflyt

```
TheSportsDB API
    EHL (4926) + CHL (5277)
         │
         ▼
GitHub Actions (daglig cron 06:00 UTC + manuell dispatch)
    scripts/fetch-and-generate.js  (Node.js, ingen npm-avhengigheter)
    1. Henter EHL sesongplan
    2. Henter CHL sesongplan
    3. Filtrerer norske lag i CHL
    4. Genererer .ics-filer
    5. Oppdaterer data/teams.json
    6. Committer til repo ved endringer
         │
         ▼
GitHub Pages (puckplan.no)
    /feeds/{liga}/{lag-slug}/{varsel}.ics
```

### Feed-kombinasjoner

10 lag × 3 turneringer × 5 varselvalg = ~150 `.ics`-filer

**Ligaer:** `ehl` / `ehl-sluttspill` / `chl`
**Varselvalg:** `none` / `15m` / `1h` / `3h` / `24h`

Eksempel-URL: `https://puckplan.no/feeds/ehl/storhamar/1h.ics`

CHL-feeds genereres kun for lag som faktisk har CHL-kamper inneværende sesong.

## Nettside (index.html)

Én enkelt HTML-fil uten rammeverk eller build-steg. Rent HTML/CSS/JS.

**Brukerflyt:**
1. Velg liga: EHL / EHL Sluttspill / CHL
2. Velg lag (liste filtrert etter liga — CHL viser kun kvalifiserte norske lag)
3. Velg varselstid: Ingen / 15 min / 1 time / 3 timer / 24 timer
4. Klikk "Kopier abonnements-URL"
5. Se instruksjoner for iPhone, Android, Google Kalender, Outlook

Lagliste og CHL-tilgjengelighet leses fra `data/teams.json` (oppdateres av GitHub Actions).

## GitHub Actions workflow

Fil: `.github/workflows/update.yml`

```
Trigger: schedule (daglig 06:00 UTC) + workflow_dispatch

Steg:
  1. checkout
  2. setup-node
  3. node scripts/fetch-and-generate.js
  4. git commit + push (kun ved endringer)
```

Script: `scripts/fetch-and-generate.js`
- Ingen eksterne npm-pakker — bruker innebygd `https` og `fs`
- Henter EHL + CHL sesongdata
- Filtrerer norske lag fra CHL-data
- Genererer alle .ics-kombinasjoner
- Oppdaterer `data/teams.json`

## iCal-format (RFC 5545)

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//puckplan.no//NO
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Storhamar – EHL
X-WR-CALDESC:Storhamar sine EHL-kamper
REFRESH-INTERVAL;VALUE=DURATION:P1D
X-PUBLISHED-TTL:P1D

BEGIN:VEVENT
  DTSTART:20251012T180000Z
  DTEND:20251012T200000Z       (kamp + 2 timer, estimert)
  SUMMARY:Storhamar vs Sparta
  LOCATION:Hamar OL-Amfi
  STATUS:CONFIRMED
  UID:ehl-{event_id}@puckplan.no
  BEGIN:VALARM               (kun hvis varsel valgt)
    TRIGGER:-PT60M
    ACTION:DISPLAY
    DESCRIPTION:Storhamar spiller om 1 time
  END:VALARM
END:VEVENT

END:VCALENDAR
```

**Innhold per kamp:** tittel (`Hjemmelag vs Bortelag`), arena/sted, dato og tid
**Kamplengde:** 2 timer estimert (TheSportsDB har ikke sluttidspunkt)
**Oppdateringsfrekvens:** `REFRESH-INTERVAL: P1D` — kalender-apper sjekker daglig

## Filstruktur

```
hockeykalender/
├── index.html
├── data/
│   └── teams.json              (genereres av Actions)
├── feeds/
│   └── {liga}/
│       └── {lag-slug}/
│           └── {varsel}.ics    (genereres av Actions)
├── scripts/
│   └── fetch-and-generate.js
└── .github/
    └── workflows/
        └── update.yml
```

## Begrensninger

- TheSportsDB gratis API: 30 req/min, Schedule Season har 15 req limit per dag — tilstrekkelig siden vi kun gjør 2 kall per kjøring (EHL + CHL)
- CHL inkluderer kun norske lag — ikke full CHL-kalender
- Tidspunkt for kamper i TheSportsDB kan mangle eller være feil nær sesongstart
- Sluttspill-data dukker opp i TheSportsDB automatisk etterhvert som kampene planlegges
