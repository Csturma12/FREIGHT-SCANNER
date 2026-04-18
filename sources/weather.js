// NOAA / National Weather Service Active Alerts
// https://api.weather.gov — no API key; User-Agent header required (NOAA_USER_AGENT).
// Next: pull per-state active alerts, dedupe by id, intersect with config/corridors.js.

const { CORRIDORS } = require('../config/corridors');

async function getWeatherSnapshot() {
  return {
    source: 'NOAA',
    status: 'stub',
    lastUpdated: null,
    corridors: CORRIDORS.map((c) => ({
      id: c.id,
      name: c.name || c.id,
      status: 'clear',
      severity: 0,
      alertCount: 0,
      alerts: [],
    })),
    nationalSummary: { totalAlerts: 0, corridorsAffected: 0, worstCorridor: null },
    highlights: [],
  };
}

module.exports = { getWeatherSnapshot };
