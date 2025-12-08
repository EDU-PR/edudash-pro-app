#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function readJsonSafe(file) {
  try {
    const txt = fs.readFileSync(file, 'utf8');
    return JSON.parse(txt);
  } catch (e) {
    return null;
  }
}

function flatten(obj, prefix = '') {
  const out = {};
  function walk(o, p) {
    if (o === null || o === undefined) return;
    if (Array.isArray(o)) {
      o.forEach((v, i) => walk(v, p ? p + '.' + i : String(i)));
    } else if (typeof o === 'object') {
      Object.keys(o).forEach((k) => {
        const v = o[k];
        const np = p ? p + '.' + k : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          walk(v, np);
        } else {
          out[np] = String(v);
        }
      });
    } else {
      out[p] = String(o);
    }
  }
  walk(obj, prefix);
  return out;
}

function parseArg(flag, def) {
  const i = process.argv.indexOf(flag);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  return def;
}

function parseFloatArg(flag, def) {
  const v = parseArg(flag, null);
  if (v === null || v === undefined) return def;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : def;
}

function parseListArg(flag, def) {
  const v = parseArg(flag, null);
  if (!v) return def;
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

const projectRoot = path.resolve(__dirname, '..');
const localesDir = path.join(projectRoot, 'locales');

const baseLocale = parseArg('--base', 'en');
const failUnder = parseFloatArg('--fail-under', 0);
const reportDir = path.resolve(parseArg('--reportDir', path.join(__dirname, 'reports')));
const criticalPrefixes = parseListArg('--critical-prefixes', [
  'navigation.',
  'common.actions.',
  'errors.',
  'auth.',
  'languageSelector.'
]);
const criticalThreshold = parseFloatArg('--critical-threshold', 3);

if (!fs.existsSync(localesDir)) {
  console.error('ERROR: locales directory not found:', localesDir);
  process.exit(2);
}

const availableLocales = fs.readdirSync(localesDir).filter((d) => {
  try {
    return fs.statSync(path.join(localesDir, d)).isDirectory();
  } catch {
    return false;
  }
});

if (!availableLocales.includes(baseLocale)) {
  console.error('ERROR: Base locale directory missing:', baseLocale);
  process.exit(2);
}

const baseNsFiles = fs.readdirSync(path.join(localesDir, baseLocale))
  .filter((f) => f.endsWith('.json'))
  .sort();

if (baseNsFiles.length === 0) {
  console.error('ERROR: No namespaces (JSON files) found under base locale:', path.join(localesDir, baseLocale));
  process.exit(2);
}

const baseKeysByNs = {};
let baseTotalKeys = 0;
for (const nsFile of baseNsFiles) {
  const full = path.join(localesDir, baseLocale, nsFile);
  const json = readJsonSafe(full) || {};
  const flat = flatten(json);
  baseKeysByNs[nsFile] = new Set(Object.keys(flat));
  baseTotalKeys += Object.keys(flat).length;
}

const targetLocales = availableLocales.filter((l) => l !== baseLocale).sort();
const missingPerLocale = {};
const missingKeyToLocales = {};

for (const loc of targetLocales) {
  let missingCount = 0;
  const missingByNs = {};
  for (const nsFile of baseNsFiles) {
    const baseKeys = baseKeysByNs[nsFile];
    const locNsPath = path.join(localesDir, loc, nsFile);
    const locJson = readJsonSafe(locNsPath) || {};
    const locFlat = flatten(locJson);
    const locKeys = new Set(Object.keys(locFlat));

    const missingKeys = [];
    for (const k of baseKeys) {
      if (!locKeys.has(k)) {
        missingKeys.push(k);
        const globalKey = nsFile.replace(/\.json$/, '') + ':' + k;
        if (!missingKeyToLocales[globalKey]) missingKeyToLocales[globalKey] = [];
        missingKeyToLocales[globalKey].push(loc);
      }
    }
    missingByNs[nsFile] = missingKeys;
    missingCount += missingKeys.length;
  }
  const coverage = baseTotalKeys === 0 ? 1 : (baseTotalKeys - missingCount) / baseTotalKeys;
  missingPerLocale[loc] = {
    missingCount,
    baseTotalKeys,
    coverage,
    missingByNs
  };
}

function isCriticalKey(key) {
  const parts = key.split(':');
  const k = parts.slice(1).join(':');
  return criticalPrefixes.some((p) => k.startsWith(p));
}

const criticalMissing = [];
const missingFrequency = [];
for (const [globalKey, localesMissing] of Object.entries(missingKeyToLocales)) {
  missingFrequency.push({ key: globalKey, count: localesMissing.length, locales: localesMissing.sort() });
  if (isCriticalKey(globalKey) && localesMissing.length >= criticalThreshold) {
    criticalMissing.push({ key: globalKey, count: localesMissing.length, locales: localesMissing.sort() });
  }
}
missingFrequency.sort((a, b) => b.count - a.count);

if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
const jsonReport = {
  generatedAt: new Date().toISOString(),
  baseLocale,
  namespaces: baseNsFiles,
  baseTotalKeys,
  locales: missingPerLocale,
  missingFrequency,
  critical: {
    prefixes: criticalPrefixes,
    threshold: criticalThreshold,
    items: criticalMissing
  }
};
fs.writeFileSync(path.join(reportDir, 'translation-completeness.json'), JSON.stringify(jsonReport, null, 2), 'utf8');

const mdLines = [];
mdLines.push('# Translation Completeness Report');
mdLines.push('');
mdLines.push('- Generated: ' + new Date().toISOString());
mdLines.push('- Base locale: ' + baseLocale);
mdLines.push('- Namespaces: ' + baseNsFiles.join(', '));
mdLines.push('');
mdLines.push('## Coverage by Locale');
for (const loc of Object.keys(missingPerLocale).sort()) {
  const s = missingPerLocale[loc];
  mdLines.push(`- ${loc}: ${(s.coverage * 100).toFixed(1)}% (${s.baseTotalKeys - s.missingCount}/${s.baseTotalKeys})`);
}
mdLines.push('');
mdLines.push('## Most Frequently Missing Keys (all locales)');
missingFrequency.slice(0, 50).forEach((item, idx) => {
  mdLines.push(`${idx + 1}. ${item.key} — missing in ${item.count} locales: ${item.locales.join(', ')}`);
});
mdLines.push('');
mdLines.push('## Critical Missing Keys');
if (criticalMissing.length === 0) {
  mdLines.push('- None above threshold.');
} else {
  criticalMissing.forEach((item, idx) => {
    mdLines.push(`${idx + 1}. ${item.key} — missing in ${item.count} locales: ${item.locales.join(', ')}`);
  });
}
fs.writeFileSync(path.join(reportDir, 'translation-completeness.md'), mdLines.join('\n'), 'utf8');

console.log('🌍 Translation Completeness Check');
console.log('Base locale:', baseLocale);
console.log('Namespaces:', baseNsFiles.join(', '));
console.log('Total base keys:', baseTotalKeys);
console.log('');
for (const loc of targetLocales) {
  const s = missingPerLocale[loc];
  const bar = '█'.repeat(Math.floor(s.coverage * 20));
  const spaces = ' '.repeat(20 - bar.length);
  console.log(`${loc}: [${bar}${spaces}] ${(s.coverage * 100).toFixed(1)}% (${s.baseTotalKeys - s.missingCount}/${s.baseTotalKeys})`);
}
if (criticalMissing.length > 0) {
  console.log('');
  console.log('⚠️  Critical missing keys above threshold:', criticalMissing.length);
}

let failed = false;
if (failUnder > 0) {
  const below = Object.entries(missingPerLocale).filter(([, s]) => s.coverage < failUnder);
  if (below.length > 0) {
    failed = true;
    console.error('');
    console.error('❌ FAIL: Some locales below coverage threshold', failUnder, '=>', below.map(([l]) => l).join(', '));
  }
}
if (criticalMissing.length > 0) {
  failed = true;
  console.error('❌ FAIL: Critical keys missing above threshold:', criticalMissing.length);
}

if (!failed) {
  console.log('');
  console.log('✅ All checks passed!');
}

process.exit(failed ? 1 : 0);
