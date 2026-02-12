#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const EXCLUDED_DIRS = new Set([
  '.git',
  'node_modules',
  '.expo',
  '.next',
  'dist',
  'build',
  'coverage',
]);

const TARGET_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const DEPRECATED_METHODS = [
  'getInfoAsync',
  'readAsStringAsync',
  'copyAsync',
  'moveAsync',
  'writeAsStringAsync',
  'deleteAsync',
  'downloadAsync',
  'uploadAsync',
];

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) walk(full, acc);
      continue;
    }
    const ext = path.extname(entry.name);
    if (TARGET_EXTS.has(ext)) acc.push(full);
  }
  return acc;
}

const files = walk(ROOT);
const failures = [];

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const importsNewFs =
    /from\s+['"]expo-file-system['"]/.test(source) ||
    /require\(['"]expo-file-system['"]\)/.test(source);
  const importsLegacyFs =
    /from\s+['"]expo-file-system\/legacy['"]/.test(source) ||
    /require\(['"]expo-file-system\/legacy['"]\)/.test(source);

  if (!importsNewFs || importsLegacyFs) continue;

  const badCalls = DEPRECATED_METHODS.filter((method) =>
    new RegExp(`\\.${method}\\s*\\(`).test(source)
  );

  if (badCalls.length > 0) {
    failures.push({
      file: path.relative(ROOT, file),
      methods: badCalls,
    });
  }
}

if (failures.length > 0) {
  console.error('\n[check-expo-filesystem-usage] Found SDK54-incompatible usage:\n');
  for (const failure of failures) {
    console.error(`- ${failure.file}: ${failure.methods.join(', ')}`);
  }
  console.error('\nUse expo-file-system/legacy for deprecated methods or migrate to File/Directory APIs.\n');
  process.exit(1);
}

console.log('[check-expo-filesystem-usage] OK');
