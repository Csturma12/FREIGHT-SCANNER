const fs = require('fs');
const path = require('path');

const { CORRIDORS } = require('../config/corridors');
const { INCLUDE_EVENTS } = require('../config/weather-filters');

const CACHE_PATH = path.join(__dirname, '..', 'cache', 'weather.json');
const CACHE_TTL_MS = 15 * 60 * 1000;
const NOAA_BASE = 'https://api.weather.gov/alerts/active';

const SEVERITY_LABEL = { 0: 'clear', 1: 'advisory', 2: 'warning', 3: 'emergency' };

async function fetchState(state, ua) {
  const res = await fetch(`${NOAA_BASE}?area=${state}`, {
    headers: { 'User-Agent': ua, Accept: 'application/geo+json' },
  });
  if (!res.ok) throw new Error(`NOAA ${state}: HTTP ${res.status}`);
  const body = await res.json();
  return body.features || [];
}

function uniqueStates(corridors) {
  const set = new Set();
  for (const c of corridors) for (const s of c.states) set.add(s);
  return [...set].sort();
}

function classify(alert) {
  const event = alert.properties && alert.properties.event;
  if (!event || !INCLUDE_EVENTS.has(event)) return null;
  const nws = alert.properties.severity;
  if (nws === 'Extreme' || /Emergency/i.test(event)) return { status: 'emergency', severity: 3 };
  if (event.endsWith(' Warning')) return { status: 'warning', severity: 2 };
  if (event.endsWith(' Watch') || event.endsWith(' Advisory')) return { status: 'advisory', severity: 1 };
  return { status: 'warning', severity: 2 };
}

// UGC codes look like "TXZ001" / "OKZ314" — first 2 chars are the state abbreviation.
function statesFromAlert(alert) {
  const ugc = (alert.properties && alert.properties.geocode && alert.properties.geocode.UGC) || [];
  const out = new Set();
  for (const code of ugc) {
    const ab = code.slice(0, 2);
    if (/^[A-Z]{2}$/.test(ab)) out.add(ab);
  }
  return [...out];
}

function isExpired(alert, now) {
  const exp = alert.properties && alert.properties.expires;
  if (!exp) return false;
  return new Date(exp).getTime() < now;
}

const ET_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short', day: 'numeric',
  hour: 'numeric', minute: '2-digit', hour12: true,
  timeZoneName: 'short',
});

function toEt(iso) {
  if (!iso) return null;
  try { return ET_FMT.format(new Date(iso)); } catch { return iso; }
}

function readCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); } catch { return null; }
}

function writeCache(payload) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(payload, null, 2));
}

function buildHighlights(corridors) {
  const h = [];
  const affected = corridors.filter((c) => c.severity > 0);
  if (affected.length === 0) {
    h.push('All corridors clear.');
    return h;
  }
  const worst = [...corridors].sort((a, b) => b.severity - a.severity || b.alertCount - a.alertCount)[0];
  if (worst.severity >= 2) {
    h.push(`${worst.name} at ${worst.status} — ${worst.alertCount} active alert${worst.alertCount === 1 ? '' : 's'}.`);
  } else if (worst.severity === 1) {
    h.push(`${worst.name} advisory in effect.`);
  }
  const warnOrWorse = corridors.filter((c) => c.severity >= 2);
  if (warnOrWorse.length > 1) {
    h.push(`${warnOrWorse.length} corridors with warnings or worse.`);
  }
  return h;
}

async function getWeatherSnapshot() {
  const ua = process.env.NOAA_USER_AGENT;
  if (!ua) {
    return { source: 'NOAA', status: 'error', error: 'NOAA_USER_AGENT not set', stale: false };
  }

  const cached = readCache();
  if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_TTL_MS) {
    return { ...cached.snapshot, status: 'live', stale: false };
  }

  try {
    const states = uniqueStates(CORRIDORS);
    const perState = await Promise.all(states.map((st) => fetchState(st, ua)));

    // Dedupe by id
    const byId = new Map();
    for (const feats of perState) {
      for (const f of feats) {
        const id = f.properties && f.properties.id;
        if (id && !byId.has(id)) byId.set(id, f);
      }
    }

    const now = Date.now();
    const classified = [];
    for (const f of byId.values()) {
      if (isExpired(f, now)) continue;
      const cls = classify(f);
      if (!cls) continue;
      classified.push({
        id: f.properties.id,
        event: f.properties.event,
        headline: f.properties.headline,
        areaDesc: f.properties.areaDesc,
        severity: cls.severity,
        status: cls.status,
        nwsSeverity: f.properties.severity,
        expires: f.properties.expires,
        expiresEt: toEt(f.properties.expires),
        sentEt: toEt(f.properties.sent),
        states: statesFromAlert(f),
      });
    }

    const corridors = CORRIDORS.map((c) => {
      const wanted = new Set(c.states);
      const alerts = classified
        .filter((a) => a.states.some((s) => wanted.has(s)))
        .sort((a, b) => b.severity - a.severity);
      const severity = alerts.reduce((m, a) => Math.max(m, a.severity), 0);
      return {
        id: c.id,
        name: c.name,
        severity,
        status: SEVERITY_LABEL[severity],
        alertCount: alerts.length,
        alerts,
      };
    });

    const corridorsAffected = corridors.filter((c) => c.severity > 0).length;
    const worst = [...corridors].sort((a, b) => b.severity - a.severity || b.alertCount - a.alertCount)[0];

    const snapshot = {
      source: 'NOAA',
      lastUpdated: new Date().toISOString(),
      corridors,
      nationalSummary: {
        totalAlerts: classified.length,
        corridorsAffected,
        worstCorridor: worst && worst.severity > 0
          ? { id: worst.id, name: worst.name, status: worst.status, alertCount: worst.alertCount }
          : null,
      },
      highlights: buildHighlights(corridors),
    };

    writeCache({ fetchedAt: new Date().toISOString(), snapshot });
    return { ...snapshot, status: 'live', stale: false };
  } catch (err) {
    console.error('[weather] NOAA error:', err.message);
    if (cached) return { ...cached.snapshot, status: 'live', stale: true, staleReason: err.message };
    return { source: 'NOAA', status: 'error', error: err.message, stale: true };
  }
}

module.exports = { getWeatherSnapshot };
