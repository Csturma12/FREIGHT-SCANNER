// Major U.S. freight corridors. Used by sources/weather.js to intersect
// NOAA alerts with freight-relevant geography.

const CORRIDORS = [
  { id: 'I-80', states: ['CA', 'NV', 'UT', 'WY', 'NE', 'IA', 'IL', 'IN', 'OH', 'PA', 'NJ'] },
  { id: 'I-90', states: ['WA', 'ID', 'MT', 'WY', 'SD', 'MN', 'WI', 'IL', 'IN', 'OH', 'PA', 'NY', 'MA'] },
  { id: 'I-10', states: ['CA', 'AZ', 'NM', 'TX', 'LA', 'MS', 'AL', 'FL'] },
  { id: 'I-40', states: ['CA', 'AZ', 'NM', 'TX', 'OK', 'AR', 'TN', 'NC'] },
  { id: 'I-70', states: ['UT', 'CO', 'KS', 'MO', 'IL', 'IN', 'OH', 'WV', 'PA', 'MD'] },
  { id: 'I-35', states: ['TX', 'OK', 'KS', 'MO', 'IA', 'MN'] },
  { id: 'I-95', states: ['FL', 'GA', 'SC', 'NC', 'VA', 'MD', 'DE', 'PA', 'NJ', 'NY', 'CT', 'RI', 'MA', 'NH', 'ME'] },
];

module.exports = { CORRIDORS };
