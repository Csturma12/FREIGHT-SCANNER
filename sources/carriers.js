// FMCSA SAFER / QCMobile APIs — requires FMCSA_WEBKEY
// https://mobile.fmcsa.dot.gov/developer/
// Next: lookupCarrier(dotOrMc) + watchlist monitor against config/carrier-watchlist.json.

async function getCarrierSnapshot() {
  return {
    source: 'FMCSA',
    status: 'stub',
    lastUpdated: null,
    watchlist: [],
    summary: { total: 0, active: 0, inactive: 0, flagged: 0 },
    recentChanges: [],
    highlights: [],
  };
}

async function lookupCarrier(_identifier) {
  return { status: 'stub', message: 'lookupCarrier not implemented' };
}

module.exports = { getCarrierSnapshot, lookupCarrier };
