#!/usr/bin/env node
/**
 * Bumps buildNumber (and optionally patch) in version.json.
 * Run before every build — used by Android pre-scripts and iOS Run Script phase.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const versionPath = path.join(root, 'version.json');

let data;
try {
  data = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
} catch (e) {
  data = { version: '0.0.1', buildNumber: 0 };
}

data.buildNumber = (data.buildNumber || 0) + 1;

fs.writeFileSync(versionPath, JSON.stringify(data, null, 2) + '\n', 'utf8');

console.log(`${data.version} (${data.buildNumber})`);
module.exports = data;
