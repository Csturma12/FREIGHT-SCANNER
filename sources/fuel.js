const fs = require('fs');
const path = require('path');

const CACHE_PATH = path.join(__dirname, '..', 'cache', 'fuel.json');
const EIA_URL = 'https://api.eia.gov/v2/petroleum/pri/gnd/data/';

// #2 Ultra Low Sulfur Diesel, retail, weekly. Trucking industry standard.
// Legacy series IDs (EMD_EPD2DXL0_PTE_*_DPG) no longer resolve via /v2/seriesid/,
// so we hit the facet-based /petroleum/pri/gnd/ route and pass product/process/duoarea.
const REGIONS = [
  { code: 'NUS', name: 'National' },
  { code: 'R10', name: 'East Coast' },
  { code: 'R20', name: 'Midwest' },
  { code: 'R30', name: 'Gulf Coast' },
  { code: 'R40', name: 'Rocky Mountain' },
  { code: 'R50', name: 'West Coast' },
];

async function fetchRegion(code, apiKey) {
  const q = new URLSearchParams({
    api_key: apiKey,
    frequency: 'weekly',
    'data[0]': 'value',
    'facets[product][]': 'EPD2DXL0',
    'facets[process][]': 'PTE',
    'facets[duoarea][]': code,
    'sort[0][column]': 'period',
    'sort[0][direction]': 'desc',
    length: '12',
  });
  const res = await fetch(`${EIA_URL}?${q.toString()}`);
  if (!res.ok) throw new Error(`EIA ${code}: HTTP ${res.status}`);
  const body = await res.json();
  const rows = body?.response?.data || [];
  if (rows.length === 0) throw new Error(`EIA ${code}: empty response`);
  return rows.map((r) => ({ period: r.period, value: parseFloat(r.value) }));
}

function readCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function writeCache(payload) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(payload, null, 2));
}

// ET wall-clock parts for a given Date, avoiding timezone offset math.
function etParts(date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hour12: false, weekday: 'short',
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    weekday: p.weekday,
    ymd: `${p.year}-${p.month}-${p.day}`,
    hour: Number(p.hour === '24' ? 0 : p.hour),
  };
}

// EIA publishes weekly retail diesel Monday afternoons (~5pm ET). Refetch when we
// cross that boundary and cached data is from an earlier week.
function shouldRefetch(cache) {
  if (!cache) return true;
  const ageMs = Date.now() - new Date(cache.fetchedAt).getTime();
  if (ageMs > 24 * 60 * 60 * 1000) return true;
  const et = etParts(new Date());
  if (et.weekday === 'Mon' && et.hour >= 17) {
    const cachedLatestPeriod = cache.snapshot?.national?.asOf;
    if (cachedLatestPeriod && cachedLatestPeriod < et.ymd) return true;
  }
  return false;
}

function computeRegion(rows, name, code) {
  if (rows.length < 2) return null;
  const current = rows[0].value;
  const previous = rows[1].value;
  const wowChange = current - previous;
  const wowChangePct = previous ? (wowChange / previous) * 100 : 0;
  const trend = rows.map((r) => r.value).reverse(); // oldest → newest
  return {
    code, name, current, previous, wowChange, wowChangePct, trend, asOf: rows[0].period,
  };
}

function buildHighlights(national, regions) {
  const h = [];
  if (regions.length) {
    const biggest = [...regions].sort((a, b) => Math.abs(b.wowChange) - Math.abs(a.wowChange))[0];
    if (biggest && Math.abs(biggest.wowChange) >= 0.02) {
      const signed = biggest.wowChange >= 0
        ? `+$${biggest.wowChange.toFixed(3)}`
        : `-$${Math.abs(biggest.wowChange).toFixed(3)}`;
      h.push(`${biggest.name} diesel ${signed} WoW — largest regional move.`);
    }
  }
  if (national && national.trend.length >= 2) {
    const max = Math.max(...national.trend);
    const min = Math.min(...national.trend);
    if (national.current >= max) h.push(`National diesel at ${national.trend.length}-week high.`);
    else if (national.current <= min) h.push(`National diesel at ${national.trend.length}-week low.`);
  }
  for (const r of regions) {
    if (r.trend.length >= 3) {
      const last3 = r.trend.slice(-3);
      const range = Math.max(...last3) - Math.min(...last3);
      if (range < 0.01) {
        h.push(`${r.name} flat for 3 weeks — stable margin outlook.`);
        break;
      }
    }
  }
  return h;
}

async function getFuelSnapshot() {
  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey) {
    return { source: 'EIA', status: 'error', error: 'EIA_API_KEY not set', stale: false };
  }

  const cached = readCache();
  if (cached && !shouldRefetch(cached)) {
    return { ...cached.snapshot, status: 'live', stale: false };
  }

  try {
    const results = await Promise.all(
      REGIONS.map((r) => fetchRegion(r.code, apiKey).then((rows) => [r.code, rows]))
    );
    const byCode = Object.fromEntries(results);
    const metrics = {};
    for (const r of REGIONS) metrics[r.code] = computeRegion(byCode[r.code], r.name, r.code);

    const national = metrics.NUS;
    const regions = REGIONS.filter((r) => r.code !== 'NUS').map((r) => metrics[r.code]).filter(Boolean);
    const highlights = buildHighlights(national, regions);

    const snapshot = {
      source: 'EIA',
      product: 'No 2 ULSD retail (EPD2DXL0)',
      lastUpdated: new Date().toISOString(),
      asOf: national ? national.asOf : null,
      national,
      regions,
      highlights,
    };

    writeCache({ fetchedAt: new Date().toISOString(), snapshot });
    return { ...snapshot, status: 'live', stale: false };
  } catch (err) {
    console.error('[fuel] EIA error:', err.message);
    if (cached) {
      return { ...cached.snapshot, status: 'live', stale: true, staleReason: err.message };
    }
    return { source: 'EIA', status: 'error', error: err.message, stale: true };
  }
}

module.exports = { getFuelSnapshot };
