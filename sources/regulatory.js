const fs = require('fs');
const path = require('path');

const CACHE_PATH = path.join(__dirname, '..', 'cache', 'regulatory.json');
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

const FR_BASE = 'https://www.federalregister.gov/api/v1/documents.json';
const TAVILY_URL = 'https://api.tavily.com/search';

// Freight-relevant keyword filter for industry news. Word-boundary matched.
// Excluded: ELP / HEA — short FMCSA-internal acronyms that create false positives
// even with word boundaries and rarely appear in actual news copy.
const FREIGHT_KEYWORDS = [
  'CDL', 'broker', 'non-domiciled', 'non domiciled',
  'HOS', 'hours of service', 'ELD', 'electronic logging',
  'motor carrier', 'trucking', 'freight', 'FMCSA', 'commercial driver',
];

async function fetchFederalRegister(sinceDate) {
  const parts = [
    'conditions[agencies][]=federal-motor-carrier-safety-administration',
    `conditions[publication_date][gte]=${sinceDate}`,
    'per_page=20',
    'order=newest',
    'fields[]=title',
    'fields[]=abstract',
    'fields[]=document_number',
    'fields[]=publication_date',
    'fields[]=type',
    'fields[]=html_url',
    'fields[]=effective_on',
  ];
  const res = await fetch(`${FR_BASE}?${parts.join('&')}`);
  if (!res.ok) throw new Error(`Federal Register HTTP ${res.status}`);
  const body = await res.json();
  return (body.results || []).map((r) => ({
    title: r.title,
    abstract: r.abstract,
    type: r.type,
    documentNumber: r.document_number,
    publicationDate: r.publication_date,
    effectiveOn: r.effective_on || null,
    url: r.html_url,
  }));
}

async function fetchTavily(apiKey) {
  const res = await fetch(TAVILY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query: 'trucking broker non-domiciled CDL enforcement rule change HOS ELD',
      search_depth: 'basic',
      topic: 'news',
      time_range: 'week',
      max_results: 10,
      include_answer: false,
    }),
  });
  if (!res.ok) throw new Error(`Tavily HTTP ${res.status}`);
  const body = await res.json();
  return (body.results || []).map((r) => ({
    title: r.title,
    url: r.url,
    source: domainOf(r.url),
    publishedDate: r.published_date || null,
    snippet: (r.content || '').slice(0, 260),
    score: r.score,
  }));
}

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

function keywordHits(item) {
  const text = `${item.title || ''} ${item.snippet || ''}`.toLowerCase();
  let n = 0;
  for (const kw of FREIGHT_KEYWORDS) {
    // \b works well for ASCII keywords; escape any regex metachars.
    const escaped = kw.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'g');
    const m = text.match(re);
    if (m) n += m.length;
  }
  return n;
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1).trim() + '…' : s;
}

function buildHighlights(fr, news) {
  const h = [];
  const rules = fr.filter((d) => d.type === 'Rule' || d.type === 'Proposed Rule');
  if (rules.length) {
    h.push(`${rules.length} rule${rules.length === 1 ? '' : 's'} or proposed rule${rules.length === 1 ? '' : 's'} in Federal Register (past 60 days).`);
  }
  const now = Date.now();
  const soon = fr
    .filter((d) => d.effectiveOn)
    .map((d) => ({ ...d, daysUntil: Math.ceil((new Date(d.effectiveOn).getTime() - now) / 86400000) }))
    .filter((d) => d.daysUntil >= 0 && d.daysUntil <= 45)
    .sort((a, b) => a.daysUntil - b.daysUntil)[0];
  if (soon) {
    h.push(`"${truncate(soon.title, 80)}" effective in ${soon.daysUntil} day${soon.daysUntil === 1 ? '' : 's'}.`);
  }
  if (news.length) {
    h.push(`${news.length} industry news item${news.length === 1 ? '' : 's'} matching freight keywords this week.`);
  }
  if (!h.length) h.push('No significant regulatory activity detected.');
  return h;
}

function readCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); } catch { return null; }
}
function writeCache(payload) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(payload, null, 2));
}

async function getRegulatorySnapshot() {
  const tavilyKey = process.env.TAVILY_API_KEY;
  const cached = readCache();
  if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_TTL_MS) {
    return { ...cached.snapshot, status: 'live', stale: false };
  }

  try {
    const since = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
    const [federalRegister, tavilyRaw] = await Promise.all([
      fetchFederalRegister(since),
      tavilyKey
        ? fetchTavily(tavilyKey).catch((e) => { console.error('[regulatory] Tavily:', e.message); return []; })
        : Promise.resolve([]),
    ]);

    // Tavily returns results in its own relevance order; preserve that. Drop the
    // absolute score gate (it drifts per-query) and filter by keyword hits with
    // word-boundary matching to reject boilerplate / breadcrumb-only matches.
    const industryNews = tavilyRaw
      .map((n) => ({ ...n, keywordHits: keywordHits(n) }))
      .filter((n) => n.keywordHits >= 2)
      .slice(0, 6);

    const snapshot = {
      source: 'Federal Register + Tavily',
      lastUpdated: new Date().toISOString(),
      federalRegister: federalRegister.slice(0, 10),
      industryNews,
      counts: { federalRegister: federalRegister.length, industryNews: industryNews.length },
      highlights: buildHighlights(federalRegister, industryNews),
    };

    writeCache({ fetchedAt: new Date().toISOString(), snapshot });
    return { ...snapshot, status: 'live', stale: false };
  } catch (err) {
    console.error('[regulatory] error:', err.message);
    if (cached) return { ...cached.snapshot, status: 'live', stale: true, staleReason: err.message };
    return { source: 'Regulatory', status: 'error', error: err.message, stale: true };
  }
}

module.exports = { getRegulatorySnapshot };
