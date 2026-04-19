// NOAA event-name allowlist — only alerts whose `event` field matches one of these
// are surfaced in Corridor Conditions. Tune freely; events not listed are dropped.
//
// Excluded by default (not trucking-relevant): Heat Advisory, Air Quality Alert,
// Beach Hazards, Rip Current, Frost/Freeze, Red Flag, Small Craft Advisory.

const INCLUDE_EVENTS = new Set([
  'Winter Storm Warning',
  'Ice Storm Warning',
  'Blizzard Warning',
  'Winter Weather Advisory',
  'High Wind Warning',
  'High Wind Advisory',
  'Tornado Warning',
  'Tornado Watch',
  'Hurricane Warning',
  'Hurricane Watch',
  'Tropical Storm Warning',
  'Flood Warning',
  'Flash Flood Warning',
  'Dense Fog Advisory',
  'Extreme Cold Warning',
]);

module.exports = { INCLUDE_EVENTS };
