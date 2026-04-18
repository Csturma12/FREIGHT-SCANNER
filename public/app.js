const SECTIONS = ['fuel', 'weather', 'carriers', 'regulatory'];

async function loadAll() {
  const results = await Promise.allSettled(
    SECTIONS.map((s) => fetch(`/api/${s}`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }))
  );

  SECTIONS.forEach((section, i) => {
    const result = results[i];
    if (result.status === 'fulfilled') render(section, result.value);
    else renderError(section, result.reason);
  });

  document.getElementById('last-updated').textContent =
    `Updated ${new Date().toISOString()}`;
}

function render(section, payload) {
  const card = document.querySelector(`[data-section="${section}"]`);
  if (!card) return;

  const statusEl = card.querySelector('[data-status]');
  const bodyEl = card.querySelector('[data-body]');

  const level = payload.stale ? 'stale' : (payload.status === 'live' ? 'live' : (payload.status || 'stub'));
  statusEl.textContent = level;
  statusEl.dataset.level = level;

  if (section === 'fuel' && payload.national) {
    renderFuel(bodyEl, payload);
  } else {
    bodyEl.innerHTML = `<pre>${escapeHtml(JSON.stringify(payload, null, 2))}</pre>`;
  }
}

function renderFuel(body, payload) {
  const n = payload.national;
  const upDir = n.wowChange > 0;
  const dirClass = upDir ? 'up' : (n.wowChange < 0 ? 'down' : 'flat');
  const sign = n.wowChange >= 0 ? '+' : '';
  const arrow = upDir ? '▲' : (n.wowChange < 0 ? '▼' : '■');

  body.innerHTML = `
    <div class="fuel-hero">
      <div class="fuel-price">$${n.current.toFixed(3)}<span class="fuel-unit">/gal</span></div>
      <div class="fuel-wow ${dirClass}">
        <span class="fuel-arrow">${arrow}</span>
        ${sign}$${Math.abs(n.wowChange).toFixed(3)}
        <span class="fuel-pct">(${sign}${n.wowChangePct.toFixed(2)}%)</span>
        <span class="fuel-label">WoW</span>
      </div>
      <div class="fuel-asof">National · week ending ${n.asOf}</div>
    </div>
    ${sparkline(n.trend)}
    <div class="fuel-regions">
      ${payload.regions.map(renderRegion).join('')}
    </div>
    ${payload.highlights && payload.highlights.length ? `
      <ul class="fuel-highlights">
        ${payload.highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}
      </ul>` : ''}
  `;
}

function renderRegion(r) {
  const upDir = r.wowChange > 0;
  const dirClass = upDir ? 'up' : (r.wowChange < 0 ? 'down' : 'flat');
  const sign = r.wowChange >= 0 ? '+' : '';
  return `
    <div class="fuel-region">
      <div class="fuel-region-name">${escapeHtml(r.name)}</div>
      <div class="fuel-region-price">$${r.current.toFixed(3)}</div>
      <div class="fuel-region-wow ${dirClass}">${sign}${r.wowChange.toFixed(3)}</div>
    </div>
  `;
}

function sparkline(values) {
  if (!values || values.length < 2) return '';
  const w = 300;
  const h = 38;
  const pad = 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = (w - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const cls = values[values.length - 1] > values[0] ? 'up' : 'down';
  return `<svg class="fuel-sparkline ${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="${pts}" />
  </svg>`;
}

function renderError(section, err) {
  const card = document.querySelector(`[data-section="${section}"]`);
  if (!card) return;
  const statusEl = card.querySelector('[data-status]');
  const bodyEl = card.querySelector('[data-body]');
  statusEl.textContent = 'error';
  statusEl.dataset.level = 'error';
  const msg = (err && err.message) ? err.message : String(err);
  bodyEl.innerHTML = `<pre class="up">${escapeHtml(msg)}</pre>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

loadAll();
