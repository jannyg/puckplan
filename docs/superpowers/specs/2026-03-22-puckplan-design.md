# puckplan.no — Design Spec

**Dato:** 2026-03-22
**Domene:** puckplan.no
**Hosting:** GitHub Pages
**Språk:** Norsk (bokmål) gjennomgående — UI, alarmtekster, metadata

## Sammendrag

En statisk nettside som lar brukere abonnere på iCal-feeds for norske ishockeylag i EHL (EliteHockey Ligaen), EHL Sluttspill og CHL (Champions Hockey League). Feeds oppdateres daglig via GitHub Actions.

## Datakilde

**TheSportsDB** — gratis API, nøkkel: `123`

- EHL: league ID `4926`
- CHL: league ID `5277`
- Endepunkt: `/api/v1/json/123/eventsseason.php?id={league_id}&s={sesong}`

### Sesongsberegning

Sesongen beregnes fra dagens dato med følgende regel:
- Hvis måned ≥ juni (md ≥ 6): sesong = `{år}-{år+1}`, f.eks. `2025-2026`
- Hvis måned < juni (md < 6): sesong = `{år-1}-{år}`, f.eks. `2024-2025`

Begrunnelse: EHL-sesongen løper september–april. Juni brukes som skille for å unngå å hente fjorårets sesong for tidlig på sommeren.

### Tidssoner

TheSportsDB returnerer kampstarttider i UTC (`strTime` og `dateEvent`). Alle `.ics`-filer emitterer UTC-tidspunkter med `Z`-suffiks. Kalenderapper konverterer til brukerens lokale tidssone automatisk.

## Arkitektur og dataflyt

```
TheSportsDB API
    EHL (4926) + CHL (5277)
         │
         ▼
GitHub Actions (daglig cron 06:00 UTC + manuell dispatch)
    scripts/fetch-and-generate.js  (Node.js, ingen npm-avhengigheter)
    1. Beregner inneværende sesong
    2. Henter EHL sesongplan
    3. Splitter EHL-kamper i "serie" vs "sluttspill" (se under)
    4. Henter CHL sesongplan, filtrerer norske lag
    5. Genererer .ics-filer for alle kombinasjoner
    6. Oppdaterer data/teams.json
    7. Committer til repo ved endringer
         │
         ▼
GitHub Pages (puckplan.no)
    /feeds/{liga}/{lag-slug}/{varsel}.ics
```

### EHL Sluttspill — splittingsregel

TheSportsDB har ikke separat league ID for sluttspill. Sluttspill-kamper identifiseres fra EHL-sesongens data ved å sjekke `strRound`-feltet fra API-et:

- Hvis `strRound` inneholder "playoff", "quarterfinal", "semifinal", "final" (case-insensitive): → `ehl-sluttspill`
- Ellers: → `ehl`

Fallback: Hvis `strRound` er tom og kampens dato er etter 1. mars, kategoriseres kampen som `ehl-sluttspill`.

### Feed-kombinasjoner

10 lag × 3 ligaer × 5 varselvalg = ~150 `.ics`-filer

**Ligaer:** `ehl` / `ehl-sluttspill` / `chl`
**Varselvalg:** `none` / `15m` / `1h` / `3h` / `24h`

Eksempel-URL: `https://puckplan.no/feeds/ehl/storhamar/1h.ics`

**CHL-feeds for ikke-kvalifiserte lag:** Genereres alltid som tomme (men gyldige) VCALENDAR-filer uten VEVENT-blokker. Dette forhindrer 404-feil i kalenderapper når et lag ikke er kvalifisert.

## data/teams.json — skjema

```json
{
  "teams": [
    {
      "slug": "storhamar",
      "name": "Storhamar",
      "thesportsdb_id": "133919",
      "leagues": {
        "ehl": true,
        "ehl-sluttspill": true,
        "chl": true
      }
    },
    {
      "slug": "vaalerenga",
      "name": "Vålerenga",
      "thesportsdb_id": "133920",
      "leagues": {
        "ehl": true,
        "ehl-sluttspill": true,
        "chl": false
      }
    }
  ]
}
```

- `slug`: brukes i URL og filsti (`/feeds/ehl/{slug}/none.ics`)
- `thesportsdb_id`: brukes til å filtrere kamper per lag fra sesongdata
- `leagues.chl`: settes til `true` kun hvis laget har ≥1 CHL-kamp i inneværende sesong
- `leagues.ehl-sluttspill`: alltid `true` for alle EHL-lag — sluttspill-feeds genereres alltid (kan være tomme tidlig i sesongen, analogt med CHL-feeds for ikke-kvalifiserte lag)

## Nettside (index.html)

Én enkelt HTML-fil uten rammeverk eller build-steg. Rent HTML/CSS/JS.

**Brukerflyt:**
1. Velg liga: EHL / EHL Sluttspill / CHL
2. Velg lag (liste filtrert etter liga — CHL viser kun lag med `leagues.chl: true`)
3. Velg varselstid: Ingen / 15 min / 1 time / 3 timer / 24 timer
4. Klikk "Kopier abonnements-URL"
5. Se instruksjoner for iPhone, Android, Google Kalender, Outlook

Lagliste og CHL-tilgjengelighet leses fra `data/teams.json`.

## GitHub Actions workflow

Fil: `.github/workflows/update.yml`

```
Trigger: schedule (daglig 06:00 UTC) + workflow_dispatch

Permissions:
  contents: write   ← påkrevd for at git push skal fungere

Steg:
  1. actions/checkout
  2. actions/setup-node (Node 20)
  3. node scripts/fetch-and-generate.js
  4. git config user.name "github-actions[bot]"
     git config user.email "github-actions[bot]@users.noreply.github.com"
  5. git commit + push (kun ved endringer, sjekkes med git diff --quiet)
```

Script: `scripts/fetch-and-generate.js`
- Ingen eksterne npm-pakker — bruker innebygd `https` og `fs`
- Håndterer HTTP 429 (rate limit) med én retry etter 60 sekunder
- Avslutter med exit code 0 selv ved API-feil (for å ikke feile workflow unødvendig)

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
  DTSTART:20251012T170000Z
  DTEND:20251012T190000Z       (DTSTART + 2 timer, estimert)
  SUMMARY:Storhamar vs Sparta
  LOCATION:Hamar OL-Amfi
  STATUS:CONFIRMED
  UID:ehl-{event_id}@puckplan.no
  LAST-MODIFIED:20260322T060000Z   (tidspunkt for siste generering)
  SEQUENCE:0
  BEGIN:VALARM               (kun hvis varsel valgt)
    TRIGGER:-PT60M
    ACTION:DISPLAY
    DESCRIPTION:Storhamar spiller om 1 time
  END:VALARM
END:VEVENT

END:VCALENDAR
```

**Merk:** Innrykk i eksempelet over er kun illustrativt. Faktiske `.ics`-filer skal ikke ha innledende mellomrom foran egenskapsnavn (RFC 5545 §3.1).

**Innhold per kamp:** tittel (`Hjemmelag vs Bortelag`), arena/sted, dato og tid (UTC)
**Kamplengde:** 2 timer estimert (TheSportsDB har ikke sluttidspunkt)
**Oppdateringsfrekvens:** `REFRESH-INTERVAL: P1D` — kalenderapper sjekker daglig
**`LAST-MODIFIED`:** settes til genereringstidspunktet — sikrer at Outlook og andre klienter oppdaterer endrede kamper

## Filstruktur

```
puckplan/
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

- TheSportsDB gratis API: 30 req/min, Schedule Season begrenset til 15 req/dag — tilstrekkelig siden vi kun gjør 2 kall per kjøring (EHL + CHL). Manuell dispatch bør brukes sparsomt.
- CHL-feeds inkluderer kun norske lag — ikke full CHL-kalender
- Kampstarttider i TheSportsDB kan mangle eller være feil nær sesongstart
- Sluttspill-data dukker opp gradvis i TheSportsDB etterhvert som kampene planlegges
- Avlyste/utsatte kamper fjernes automatisk ved neste vellykkede generering; ved Actions-feil kan utdaterte kamper ligge i feed inntil neste suksessfulle kjøring
