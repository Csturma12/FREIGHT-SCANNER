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

  bodyEl.innerHTML = `<pre>${escapeHtml(JSON.stringify(payload, null, 2))}</pre>`;
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
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

loadAll();
