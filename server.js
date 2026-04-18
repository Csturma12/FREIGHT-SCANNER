require('dotenv').config();
const express = require('express');
const path = require('path');

const { getFuelSnapshot } = require('./sources/fuel');
const { getWeatherSnapshot } = require('./sources/weather');
const { getCarrierSnapshot } = require('./sources/carriers');
const { getRegulatorySnapshot } = require('./sources/regulatory');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

function route(name, fn) {
  return async (req, res) => {
    try {
      res.json(await fn());
    } catch (err) {
      console.error(`[${name}]`, err.message);
      res.status(500).json({ error: 'source_failed', source: name, message: err.message });
    }
  };
}

app.get('/api/fuel', route('fuel', getFuelSnapshot));
app.get('/api/weather', route('weather', getWeatherSnapshot));
app.get('/api/carriers', route('carriers', getCarrierSnapshot));
app.get('/api/regulatory', route('regulatory', getRegulatorySnapshot));
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`freight-scanner listening on http://localhost:${PORT}`);
});
