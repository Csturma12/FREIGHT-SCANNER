// EIA Weekly Retail On-Highway #2 ULSD Diesel Prices
// Series: EMD_EPD2D_PTE_{NUS,R10,R20,R30,R40,R50}_DPG — weekly, $/gal
// Route: https://api.eia.gov/v2/seriesid/{SERIES_ID}?api_key=...
// Requires EIA_API_KEY. Cached to cache/fuel.json (EIA updates Mondays PM ET).

async function getFuelSnapshot() {
  return {
    source: 'EIA',
    status: 'stub',
    lastUpdated: null,
    national: null,
    regions: [],
    highlights: [],
  };
}

module.exports = { getFuelSnapshot };
