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
  } else if (section === 'weather' && Array.isArray(payload.corridors) && payload.corridors.length) {
    renderWeather(bodyEl, payload);
  } else if (section === 'regulatory' && (payload.federalRegister || payload.industryNews)) {
    renderRegulatory(bodyEl, payload);
  } else {
    bodyEl.innerHTML = `<pre>${escapeHtml(JSON.stringify(payload, null, 2))}</pre>`;
  }
}

function renderRegulatory(body, payload) {
  const fr = payload.federalRegister || [];
  const news = payload.industryNews || [];
  body.innerHTML = `
    ${payload.highlights && payload.highlights.length ? `
      <ul class="reg-highlights">
        ${payload.highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}
      </ul>` : ''}
    ${fr.length ? `
      <div class="reg-section">
        <h3 class="reg-section-title">Federal Register <span class="reg-count">${fr.length}</span></h3>
        <ul class="reg-list">
          ${fr.slice(0, 5).map(renderFrItem).join('')}
        </ul>
      </div>` : ''}
    ${news.length ? `
      <div class="reg-section">
        <h3 class="reg-section-title">Industry Press <span class="reg-count">${news.length}</span></h3>
        <ul class="reg-list">
          ${news.slice(0, 5).map(renderNewsItem).join('')}
        </ul>
      </div>` : ''}
    ${!fr.length && !news.length ? '<div class="reg-empty">No regulatory activity to report.</div>' : ''}
  `;
}

function renderFrItem(d) {
  const typeSlug = (d.type || 'Notice').toLowerCase().replace(/\s+/g, '-');
  return `
    <li class="reg-item">
      <div class="reg-item-meta">
        <span class="reg-type reg-type-${escapeHtml(typeSlug)}">${escapeHtml(d.type || 'Notice')}</span>
        <span class="reg-date">${escapeHtml(d.publicationDate || '')}</span>
        ${d.effectiveOn ? `<span class="reg-effective">effective ${escapeHtml(d.effectiveOn)}</span>` : ''}
      </div>
      <a class="reg-item-title" href="${escapeHtml(d.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(d.title || '')}</a>
      ${d.abstract ? `<div class="reg-item-body">${escapeHtml(truncateText(d.abstract, 240))}</div>` : ''}
    </li>
  `;
}

function renderNewsItem(n) {
  return `
    <li class="reg-item">
      <div class="reg-item-meta">
        <span class="reg-source">${escapeHtml(n.source || '')}</span>
        ${n.publishedDate ? `<span class="reg-date">${escapeHtml(formatRegDate(n.publishedDate))}</span>` : ''}
        ${typeof n.score === 'number' ? `<span class="reg-score">${n.score.toFixed(2)}</span>` : ''}
      </div>
      <a class="reg-item-title" href="${escapeHtml(n.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(n.title || '')}</a>
      ${n.snippet ? `<div class="reg-item-body">${escapeHtml(truncateText(n.snippet, 240))}</div>` : ''}
    </li>
  `;
}

function truncateText(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1).trim() + '…' : s;
}

function formatRegDate(d) {
  try { return new Date(d).toISOString().slice(0, 10); } catch { return d; }
}

function renderWeather(body, payload) {
  body.innerHTML = `
    <div class="corridor-grid">
      ${payload.corridors.map(renderCorridorTile).join('')}
    </div>
    ${payload.highlights && payload.highlights.length ? `
      <ul class="weather-highlights">
        ${payload.highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}
      </ul>` : ''}
  `;
  body.querySelectorAll('.corridor-tile').forEach((tile) => {
    tile.addEventListener('click', () => tile.classList.toggle('open'));
    tile.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        tile.classList.toggle('open');
      }
    });
  });
}

function renderCorridorTile(c) {
  const alerts = (c.alerts || []).slice(0, 10).map((a) => `
    <li class="corridor-alert sev-${a.severity}">
      <div class="alert-event">${escapeHtml(a.event)}</div>
      <div class="alert-area">${escapeHtml(a.areaDesc || '')}</div>
      ${a.expiresEt ? `<div class="alert-expires">expires ${escapeHtml(a.expiresEt)}</div>` : ''}
    </li>
  `).join('');
  const hasAlerts = c.alertCount > 0;
  return `
    <div class="corridor-tile sev-${c.severity}${hasAlerts ? ' has-alerts' : ''}" role="button" tabindex="0" aria-label="${escapeHtml(c.id)} ${c.status}, ${c.alertCount} alerts">
      <div class="corridor-tile-head">
        <span class="corridor-id">${escapeHtml(c.id)}</span>
        <span class="corridor-dot" aria-hidden="true"></span>
      </div>
      <div class="corridor-name">${escapeHtml(c.name || c.id)}</div>
      <div class="corridor-meta">
        <span class="corridor-status">${escapeHtml(c.status)}</span>
        ${hasAlerts ? `<span class="corridor-count">${c.alertCount}</span>` : ''}
      </div>
      ${hasAlerts ? `<ul class="corridor-alerts">${alerts}</ul>` : ''}
    </div>
  `;
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
