const fs = require('node:fs');
const path = require('node:path');

const FLAGS_PATH = path.join(__dirname, '..', 'config', 'flags.json');
const flagsPath = path.join(__dirname, '..', 'config', 'flags.json');
const flagData = JSON.parse(fs.readFileSync(flagsPath, 'utf8'));

/**
 * Check whether a feature flag is enabled.
 * @param {string} flagName - The flag key to check (e.g., 'new-dashboard-widget')
 * @returns {boolean} true if the flag is enabled, false otherwise
 */
function isEnabled(flagName) {
  // TODO: Read config/flags.json, parse it, and return the enabled value
  // for the given flagName. Return false if the flag does not exist.
  return false;
}

module.exports = { isEnabled };
