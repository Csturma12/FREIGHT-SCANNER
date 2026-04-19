// Major U.S. freight corridors — used by sources/weather.js to intersect
// NOAA alerts with freight-relevant geography.

const CORRIDORS = [
  { id: 'I-10', name: 'I-10 Southern',         states: ['CA', 'AZ', 'NM', 'TX', 'LA', 'MS', 'AL', 'FL'] },
  { id: 'I-40', name: 'I-40 Transcon',         states: ['CA', 'AZ', 'NM', 'TX', 'OK', 'AR', 'TN', 'NC'] },
  { id: 'I-80', name: 'I-80 Northern',         states: ['CA', 'NV', 'UT', 'WY', 'NE', 'IA', 'IL', 'IN', 'OH', 'PA', 'NJ'] },
  { id: 'I-70', name: 'I-70 Central',          states: ['UT', 'CO', 'KS', 'MO', 'IL', 'IN', 'OH', 'WV', 'PA', 'MD'] },
  { id: 'I-95', name: 'I-95 East Coast',       states: ['FL', 'GA', 'SC', 'NC', 'VA', 'MD', 'DE', 'NJ', 'NY', 'CT', 'RI', 'MA', 'NH', 'ME'] },
  { id: 'I-75', name: 'I-75 Southeast-Midwest',states: ['FL', 'GA', 'TN', 'KY', 'OH', 'MI'] },
  { id: 'I-35', name: 'I-35 NAFTA',            states: ['TX', 'OK', 'KS', 'MO', 'IA', 'MN'] },
];

module.exports = { CORRIDORS };
