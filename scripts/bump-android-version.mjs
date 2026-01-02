#!/usr/bin/env node

// Simple helper to bump Android versionCode (and Expo version) before release builds.
// Works with managed Expo (app.json) and EAS Build when cli.appVersionSource = "local".

import fs from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const appJsonPath = path.resolve(__dirname, '..', 'app.json');

if (!fs.existsSync(appJsonPath)) {
  console.error('[bump-android-version] app.json not found at', appJsonPath);
  process.exit(1);
}

const raw = fs.readFileSync(appJsonPath, 'utf8');
let app;
try {
  app = JSON.parse(raw);
} catch (e) {
  console.error('[bump-android-version] Failed to parse app.json:', e.message);
  process.exit(1);
}

if (!app.expo) app.expo = {};
if (!app.expo.android) app.expo.android = {};

const expo = app.expo;
const android = app.expo.android;

const currentCode = Number.isInteger(android.versionCode) ? android.versionCode : 1;
const nextCode = currentCode + 1;
android.versionCode = nextCode;

// Bump patch part of expo.version if it exists and looks like x.y.z
if (typeof expo.version === 'string') {
  const parts = expo.version.split('.');
  if (parts.length === 3) {
    const [major, minor, patchStr] = parts;
    const patch = parseInt(patchStr, 10) || 0;
    const nextPatch = patch + 1;
    expo.version = `${major}.${minor}.${nextPatch}`;
  }
}

// IMPORTANT: Do NOT auto-bump runtimeVersion!
// runtimeVersion should only change when native code changes (new SDK, new native modules).
// Keeping runtimeVersion stable allows OTA updates to work for existing users.
// 
// To manually bump runtimeVersion when needed:
//   1. Update expo.runtimeVersion in app.json manually
//   2. This will create a new "native version" and old OTA updates won't apply
//
// Previous behavior (removed): auto-sync runtimeVersion with version
// if (typeof expo.runtimeVersion === 'string' && typeof expo.version === 'string') {
//   expo.runtimeVersion = expo.version;
// }

fs.writeFileSync(appJsonPath, JSON.stringify(app, null, 2) + '\n');

console.log(`[bump-android-version] Updated android.versionCode -> ${nextCode}`);
if (expo.version) {
  console.log(`[bump-android-version] Updated expo.version/runtimeVersion -> ${expo.version}`);
}
