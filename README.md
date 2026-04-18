# Freight Market Scanner

Daily freight market intelligence dashboard for brokerage operations. Pulls from free public data sources, renders a dark-themed snapshot, and emails a morning summary at 6:45 AM.

## What it shows

| Section | Source | What you see |
|---|---|---|
| **Fuel** | [EIA Open Data](https://www.eia.gov/opendata/) | Weekly #2 ULSD retail diesel — national + PADD regions, WoW change, 12-week trend |
| **Corridor Conditions** | [NOAA / NWS](https://www.weather.gov/documentation/services-web-api) | Active alerts intersected with major interstates (I-10, I-40, I-70, I-80, I-95, etc.) |
| **Carriers** | [FMCSA SAFER](https://mobile.fmcsa.dot.gov/developer/) | Watchlist safety/authority status + ad-hoc DOT/MC lookup |
| **Regulatory Watch** | FMCSA news + Federal Register (via Tavily) | Rule changes and enforcement, filtered on freight keywords |

## Layout

```
freight-scanner/
├── server.js                 Express server, per-resource /api/* routes
├── config/
│   └── corridors.js          Freight corridor → state list
├── sources/
│   ├── fuel.js               EIA diesel (stub → Session 2)
│   ├── weather.js            NOAA corridor conditions (stub → Session 3)
│   ├── carriers.js           FMCSA lookup + watchlist (stub → Session 4)
│   └── regulatory.js         Tavily scrape of FMCSA news + Fed Register (stub → Session 5)
├── cache/                    Per-source JSON caches (gitignored)
├── public/
│   ├── index.html            Dashboard shell
│   ├── styles.css            Dark theme, CSS variables
│   └── app.js                Fetches /api/* and renders
├── jobs/
│   └── morningEmail.js       Task Scheduler entry point for the 6:45 AM summary
├── .env.example              All keys the modules need
└── package.json              express + dotenv only (native fetch)
```

## Setup

```bash
git clone <repo-url>
cd freight-scanner
npm install
cp .env.example .env          # fill in keys as you wire each source
npm run dev                   # http://localhost:3000
```

### Environment variables

| Var | Where to get it |
|---|---|
| `EIA_API_KEY` | https://www.eia.gov/opendata/register.php |
| `FMCSA_WEBKEY` | https://mobile.fmcsa.dot.gov/developer/ |
| `TAVILY_API_KEY` | https://tavily.com |
| `NOAA_USER_AGENT` | Any string identifying the app + a contact email — NOAA rejects requests without one |
| `EMAIL_*` | Your SMTP credentials for the morning summary |

## Architecture

- **Server**: a thin Express layer that exposes one GET endpoint per source (`/api/fuel`, `/api/weather`, `/api/carriers`, `/api/regulatory`) plus `/api/health`. Each route delegates to a source module and normalizes errors.
- **Source modules**: pure async functions that fetch, cache, and return a shaped snapshot. Each follows the same pattern — try-fetch → write cache → return fresh; on error → return last cache with `stale: true`.
- **Caching**: per-source JSON files in `cache/` with source-specific TTLs (fuel 24h, weather 15min, carriers 6h). Directory is kept in git via `.gitkeep`; cache contents are gitignored.
- **Frontend**: plain HTML/CSS/JS. Four cards fetched in parallel via `Promise.allSettled` so one slow source doesn't block the others. Dark theme driven entirely by CSS variables in `:root`.
- **Morning email**: `jobs/morningEmail.js` is a standalone script invoked by Windows Task Scheduler at 6:45 AM (after the 6:00 / 6:30 stock scanners). It hits the same `/api/*` endpoints and renders an HTML + plain-text summary.

## Scheduling

| Time | Job |
|---|---|
| 6:00 AM | stock scanner (existing) |
| 6:30 AM | stock scanner (existing) |
| 6:45 AM | `npm run email` — freight scanner summary |

## Status

All four source modules are stubs returning shaped placeholder payloads. The dashboard wires up end-to-end and shows a `STUB` badge on each card. Session-by-session build-out replaces each stub with live data.
