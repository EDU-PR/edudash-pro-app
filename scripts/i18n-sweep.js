#!/usr/bin/env node

/*
 * Deterministic i18n sweep for native + web surfaces.
 *
 * Modes:
 * - Report only: node scripts/i18n-sweep.js
 * - Apply + propagate: node scripts/i18n-sweep.js --apply
 * - Strict (fail on remaining missing keys): add --strict
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const REPORT_DIR = path.join(__dirname, 'reports');

const NATIVE_EN_COMMON_PATH = path.join(PROJECT_ROOT, 'locales/en/common.json');
const NATIVE_EN_WHATSAPP_PATH = path.join(PROJECT_ROOT, 'locales/en/whatsapp.json');
const WEB_EN_COMMON_PATH = path.join(PROJECT_ROOT, 'web/src/locales/en/common.json');

const NATIVE_PROPAGATE_LOCALES = ['af', 'de', 'es', 'fr', 'nso', 'pt', 'st', 'zu'];
const WEB_PROPAGATE_LOCALES = ['af', 'zu'];

const SCAN_DIRS = ['app', 'components', 'contexts', 'hooks', 'lib', 'web/src'];
const SCAN_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.expo',
  '.cache',
  'coverage',
  'android',
  'ios',
]);

const OVERRIDE_VALUES = {
  'common:account.current_email': 'Current Email',
  'common:ai_settings.title': 'Dash AI Settings',
  'common:branding.title': 'Branding',
  'common:common.save_failed': 'Failed to save settings',
  'common:cv_upload.pick_error': 'Failed to pick documents',
  'common:cv.end_date': 'End Date',
  'common:cv.start_date': 'Start Date',
  'common:dash_ai.ask_subtitle': 'Chat with your AI assistant',
  'common:dashboard.birthday_donations.friday_mode': 'Friday celebration day',
  'common:dashboard.hints.birthdays': 'Upcoming class birthdays and reminders.',
  'common:dashboard.uniform_collections_note': 'Uniform payments are tracked separately from school revenue.',
  'common:learner.documents': 'My Documents',
  'common:learner.enroll_prompt': 'Browse available programs and enroll to start learning',
  'common:messages.recording': 'Recording...',
  'common:receipt.pending_payment': 'Receipts are available once a payment is completed.',
  'common:teacher.no_students': 'No Students Yet',
};

const APPLY = process.argv.includes('--apply');
const STRICT = process.argv.includes('--strict');

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function writeJson(filePath, value) {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(filePath, serialized, 'utf8');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function listFiles(rootDir) {
  const files = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') && !entry.name.startsWith('.eslintrc')) {
        if (IGNORE_DIRS.has(entry.name)) {
          continue;
        }
      }

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name)) {
          continue;
        }
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (SCAN_EXTS.has(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(rootDir);
  return files;
}

function flatten(obj, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(obj || {})) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, fullKey, out);
    } else {
      out[fullKey] = value;
    }
  }
  return out;
}

function hasNested(obj, dottedKey) {
  if (!dottedKey.includes('.')) {
    return Object.prototype.hasOwnProperty.call(obj, dottedKey);
  }

  const parts = dottedKey.split('.');
  let cursor = obj;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (!cursor || typeof cursor !== 'object' || !Object.prototype.hasOwnProperty.call(cursor, part)) {
      return false;
    }
    if (i === parts.length - 1) {
      return true;
    }
    cursor = cursor[part];
  }
  return false;
}

function setNested(obj, dottedKey, value) {
  if (!dottedKey.includes('.')) {
    if (!Object.prototype.hasOwnProperty.call(obj, dottedKey)) {
      obj[dottedKey] = value;
      return { ok: true, created: true };
    }
    return { ok: true, created: false };
  }

  const parts = dottedKey.split('.');
  let cursor = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (!Object.prototype.hasOwnProperty.call(cursor, part)) {
      cursor[part] = {};
    } else if (!cursor[part] || typeof cursor[part] !== 'object' || Array.isArray(cursor[part])) {
      return { ok: false, reason: `Path collision at "${parts.slice(0, i + 1).join('.')}"` };
    }
    cursor = cursor[part];
  }

  const leaf = parts[parts.length - 1];
  if (!Object.prototype.hasOwnProperty.call(cursor, leaf)) {
    cursor[leaf] = value;
    return { ok: true, created: true };
  }
  return { ok: true, created: false };
}

function decodeEscapes(raw, quote) {
  let out = raw;
  out = out.replace(/\\\\/g, '\\');
  if (quote === "'") out = out.replace(/\\'/g, "'");
  if (quote === '"') out = out.replace(/\\"/g, '"');
  if (quote === '`') out = out.replace(/\\`/g, '`');
  out = out.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r');
  return out;
}

function parseQuotedString(source, startIndex) {
  const quote = source[startIndex];
  if (quote !== "'" && quote !== '"' && quote !== '`') {
    return null;
  }

  let i = startIndex + 1;
  let raw = '';
  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\') {
      if (i + 1 < source.length) {
        raw += ch + source[i + 1];
        i += 2;
        continue;
      }
      raw += ch;
      i += 1;
      continue;
    }
    if (ch === quote) {
      return {
        value: decodeEscapes(raw, quote),
        quote,
        endIndex: i + 1,
      };
    }
    raw += ch;
    i += 1;
  }

  return null;
}

function extractDefaultValue(argsText) {
  const match = argsText.match(/defaultValue\s*:\s*(["'`])([\s\S]*?)\1/);
  if (!match) return null;

  const quote = match[1];
  const raw = match[2];
  const value = decodeEscapes(raw, quote);
  if (quote === '`' && value.includes('${')) {
    return null;
  }
  return value;
}

function extractTranslationCalls(source) {
  const calls = [];
  const pattern = /(?:\bi18n\.t|\bt)\s*\(/g;

  let match;
  while ((match = pattern.exec(source)) !== null) {
    const openParenIndex = source.indexOf('(', match.index);
    if (openParenIndex === -1) continue;

    let i = openParenIndex + 1;
    while (i < source.length && /\s/.test(source[i])) i += 1;

    const parsedKey = parseQuotedString(source, i);
    if (!parsedKey) continue;

    const key = parsedKey.value;
    i = parsedKey.endIndex;

    let depth = 1;
    let inString = false;
    let stringQuote = '';
    let escaped = false;
    while (i < source.length && depth > 0) {
      const ch = source[i];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === stringQuote) {
          inString = false;
          stringQuote = '';
        }
      } else if (ch === "'" || ch === '"' || ch === '`') {
        inString = true;
        stringQuote = ch;
      } else if (ch === '(') {
        depth += 1;
      } else if (ch === ')') {
        depth -= 1;
      }
      i += 1;
    }

    const argsText = source.slice(parsedKey.endIndex, Math.max(parsedKey.endIndex, i - 1));
    const defaultValue = extractDefaultValue(argsText);

    calls.push({ key, defaultValue });

    pattern.lastIndex = i;
  }

  return calls;
}

function parseNamespacedKey(rawKey) {
  const idx = rawKey.indexOf(':');
  if (idx === -1) {
    return { namespace: 'common', key: rawKey };
  }
  return {
    namespace: rawKey.slice(0, idx),
    key: rawKey.slice(idx + 1),
  };
}

function isWebFile(filePath) {
  const relative = path.relative(PROJECT_ROOT, filePath).replace(/\\/g, '/');
  return relative.startsWith('web/');
}

function getEnglishContainer(surface, namespace, stores) {
  if (surface === 'web') {
    if (namespace === 'common') return stores.webCommon;
    return null;
  }

  if (namespace === 'common') return stores.nativeCommon;
  if (namespace === 'whatsapp') return stores.nativeWhatsapp;
  return null;
}

function humanizeToken(token) {
  const normalized = token
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return token;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function fallbackValueForKey(key) {
  if (/\s/.test(key)) {
    return key.trim();
  }
  const leaf = key.includes('.') ? key.split('.').pop() : key;
  return humanizeToken(leaf || key);
}

function buildSignature(surface, namespace, key) {
  return `${surface}|${namespace}:${key}`;
}

function sortArrayStable(values) {
  return values.slice().sort((a, b) => {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  });
}

function runScan(stores) {
  const files = [];
  for (const dir of SCAN_DIRS) {
    const full = path.join(PROJECT_ROOT, dir);
    if (fs.existsSync(full)) {
      files.push(...listFiles(full));
    }
  }

  const missingMap = new Map();

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const calls = extractTranslationCalls(source);
    const surface = isWebFile(file) ? 'web' : 'native';
    const relativeFile = path.relative(PROJECT_ROOT, file).replace(/\\/g, '/');

    for (const call of calls) {
      let keyRaw = (call.key || '').trim();
      if (!keyRaw) continue;
      if (keyRaw.includes('${')) continue;

      const { namespace, key } = parseNamespacedKey(keyRaw);
      if (!key) continue;

      const english = getEnglishContainer(surface, namespace, stores);
      const exists = english ? hasNested(english, key) : false;
      if (exists) continue;

      const signature = buildSignature(surface, namespace, key);
      if (!missingMap.has(signature)) {
        missingMap.set(signature, {
          signature,
          surface,
          namespace,
          key,
          refs: 0,
          files: new Set(),
          defaultValues: new Map(),
          unsupportedNamespace: !english,
        });
      }

      const rec = missingMap.get(signature);
      rec.refs += 1;
      rec.files.add(relativeFile);
      if (call.defaultValue !== null && call.defaultValue !== undefined && call.defaultValue !== '') {
        rec.defaultValues.set(call.defaultValue, (rec.defaultValues.get(call.defaultValue) || 0) + 1);
      }
    }
  }

  const missing = sortArrayStable([...missingMap.keys()]).map((signature) => {
    const rec = missingMap.get(signature);
    const defaultCandidates = sortArrayStable([...rec.defaultValues.keys()]).map((value) => ({
      value,
      count: rec.defaultValues.get(value),
    })).sort((a, b) => (b.count - a.count) || (a.value < b.value ? -1 : a.value > b.value ? 1 : 0));

    return {
      signature: rec.signature,
      surface: rec.surface,
      namespace: rec.namespace,
      key: rec.key,
      refs: rec.refs,
      files: sortArrayStable([...rec.files]),
      defaultCandidates,
      unsupportedNamespace: rec.unsupportedNamespace,
    };
  });

  const conflicts = missing
    .filter((m) => m.defaultCandidates.length > 1)
    .map((m) => ({
      signature: m.signature,
      namespaceKey: `${m.namespace}:${m.key}`,
      candidates: m.defaultCandidates,
    }));

  return { missing, conflicts };
}

function chooseValue(record) {
  const overrideKey = `${record.namespace}:${record.key}`;
  if (Object.prototype.hasOwnProperty.call(OVERRIDE_VALUES, overrideKey)) {
    return {
      value: OVERRIDE_VALUES[overrideKey],
      reason: 'override',
    };
  }

  if (record.defaultCandidates.length > 0) {
    return {
      value: record.defaultCandidates[0].value,
      reason: record.defaultCandidates.length > 1 ? 'default_conflict_resolved_by_frequency' : 'default_value',
    };
  }

  return {
    value: fallbackValueForKey(record.key),
    reason: 'fallback',
  };
}

function propagateLocaleFromEnglish(localePath, englishFlat) {
  const localeExists = fs.existsSync(localePath);
  const localeObj = localeExists ? readJson(localePath) : {};
  const localeFlat = flatten(localeObj);

  let added = 0;
  for (const key of sortArrayStable(Object.keys(englishFlat))) {
    if (!Object.prototype.hasOwnProperty.call(localeFlat, key)) {
      const setResult = setNested(localeObj, key, englishFlat[key]);
      if (setResult.ok && setResult.created) {
        localeFlat[key] = englishFlat[key];
        added += 1;
      }
    }
  }

  if (added > 0 || !localeExists) {
    writeJson(localePath, localeObj);
  }

  return { added, localePath: path.relative(PROJECT_ROOT, localePath).replace(/\\/g, '/') };
}

function renderMarkdownReport(report) {
  const lines = [];
  lines.push('# i18n Sweep Report');
  lines.push('');
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Apply mode: ${report.options.apply}`);
  lines.push(`- Strict mode: ${report.options.strict}`);
  lines.push(`- Missing before apply: ${report.before.missingCount}`);
  lines.push(`- Missing after apply: ${report.after ? report.after.missingCount : 'n/a'}`);
  lines.push(`- Conflicts: ${report.before.conflictCount}`);
  lines.push('');

  lines.push('## Counts By Surface');
  lines.push(`- Native missing signatures: ${report.before.bySurface.native}`);
  lines.push(`- Web missing signatures: ${report.before.bySurface.web}`);
  lines.push('');

  lines.push('## Conflicts');
  if (report.conflicts.length === 0) {
    lines.push('- None');
  } else {
    for (const conflict of report.conflicts) {
      lines.push(`- ${conflict.signature}`);
      for (const candidate of conflict.candidates) {
        lines.push(`  - ${JSON.stringify(candidate.value)} (${candidate.count})`);
      }
    }
  }
  lines.push('');

  lines.push('## Missing Keys');
  if (report.missing.length === 0) {
    lines.push('- None');
  } else {
    for (const miss of report.missing) {
      lines.push(`- ${miss.signature} (refs: ${miss.refs})`);
      if (miss.defaultCandidates.length > 0) {
        lines.push(`  - defaults: ${miss.defaultCandidates.map((d) => `${JSON.stringify(d.value)} x${d.count}`).join('; ')}`);
      }
      lines.push(`  - files: ${miss.files.join(', ')}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function loadEnglishStores() {
  return {
    nativeCommon: readJson(NATIVE_EN_COMMON_PATH),
    nativeWhatsapp: fs.existsSync(NATIVE_EN_WHATSAPP_PATH) ? readJson(NATIVE_EN_WHATSAPP_PATH) : {},
    webCommon: readJson(WEB_EN_COMMON_PATH),
  };
}

function buildSurfaceCounts(missing) {
  const counts = { native: 0, web: 0 };
  for (const item of missing) {
    if (item.surface === 'web') counts.web += 1;
    else counts.native += 1;
  }
  return counts;
}

function main() {
  ensureDir(REPORT_DIR);

  const stores = loadEnglishStores();
  const beforeScan = runScan(stores);

  const report = {
    generatedAt: new Date().toISOString(),
    options: {
      apply: APPLY,
      strict: STRICT,
    },
    before: {
      missingCount: beforeScan.missing.length,
      conflictCount: beforeScan.conflicts.length,
      bySurface: buildSurfaceCounts(beforeScan.missing),
    },
    missing: beforeScan.missing,
    conflicts: beforeScan.conflicts,
    resolutionStats: {
      override: 0,
      default_value: 0,
      default_conflict_resolved_by_frequency: 0,
      fallback: 0,
      unsupported_namespace: 0,
      path_collision: 0,
    },
    apply: {
      englishAdded: {
        nativeCommon: 0,
        nativeWhatsapp: 0,
        webCommon: 0,
      },
      unresolved: [],
      propagation: {
        native: [],
        web: [],
      },
    },
    after: null,
  };

  if (APPLY) {
    for (const miss of beforeScan.missing) {
      if (miss.unsupportedNamespace) {
        report.resolutionStats.unsupported_namespace += 1;
        report.apply.unresolved.push({
          signature: miss.signature,
          reason: 'unsupported_namespace',
        });
        continue;
      }

      const choice = chooseValue(miss);
      report.resolutionStats[choice.reason] += 1;

      let targetObj = null;
      let targetName = '';
      if (miss.surface === 'web') {
        targetObj = stores.webCommon;
        targetName = 'webCommon';
      } else if (miss.namespace === 'whatsapp') {
        targetObj = stores.nativeWhatsapp;
        targetName = 'nativeWhatsapp';
      } else {
        targetObj = stores.nativeCommon;
        targetName = 'nativeCommon';
      }

      const setResult = setNested(targetObj, miss.key, choice.value);
      if (!setResult.ok) {
        report.resolutionStats.path_collision += 1;
        report.apply.unresolved.push({
          signature: miss.signature,
          reason: 'path_collision',
          detail: setResult.reason,
        });
        continue;
      }

      if (setResult.created) {
        report.apply.englishAdded[targetName] += 1;
      }
    }

    writeJson(NATIVE_EN_COMMON_PATH, stores.nativeCommon);
    if (fs.existsSync(NATIVE_EN_WHATSAPP_PATH) || report.apply.englishAdded.nativeWhatsapp > 0) {
      writeJson(NATIVE_EN_WHATSAPP_PATH, stores.nativeWhatsapp);
    }
    writeJson(WEB_EN_COMMON_PATH, stores.webCommon);

    const nativeEnglishFlat = flatten(stores.nativeCommon);
    for (const locale of NATIVE_PROPAGATE_LOCALES) {
      const localePath = path.join(PROJECT_ROOT, `locales/${locale}/common.json`);
      const result = propagateLocaleFromEnglish(localePath, nativeEnglishFlat);
      report.apply.propagation.native.push(result);
    }

    const webEnglishFlat = flatten(stores.webCommon);
    for (const locale of WEB_PROPAGATE_LOCALES) {
      const localePath = path.join(PROJECT_ROOT, `web/src/locales/${locale}/common.json`);
      const result = propagateLocaleFromEnglish(localePath, webEnglishFlat);
      report.apply.propagation.web.push(result);
    }

    const afterStores = loadEnglishStores();
    const afterScan = runScan(afterStores);
    report.after = {
      missingCount: afterScan.missing.length,
      conflictCount: afterScan.conflicts.length,
      bySurface: buildSurfaceCounts(afterScan.missing),
    };
  }

  const jsonReportPath = path.join(REPORT_DIR, 'i18n-sweep-report.json');
  const mdReportPath = path.join(REPORT_DIR, 'i18n-sweep-report.md');
  writeJson(jsonReportPath, report);
  fs.writeFileSync(mdReportPath, renderMarkdownReport(report), 'utf8');

  const finalMissing = APPLY && report.after ? report.after.missingCount : report.before.missingCount;

  console.log('\n🌍 i18n sweep complete');
  console.log(`- Report: ${path.relative(PROJECT_ROOT, jsonReportPath)}`);
  console.log(`- Missing before apply: ${report.before.missingCount}`);
  if (APPLY && report.after) {
    console.log(`- Missing after apply: ${report.after.missingCount}`);
    console.log(`- English keys added (native common): ${report.apply.englishAdded.nativeCommon}`);
    console.log(`- English keys added (native whatsapp): ${report.apply.englishAdded.nativeWhatsapp}`);
    console.log(`- English keys added (web common): ${report.apply.englishAdded.webCommon}`);
  }

  if (STRICT && finalMissing > 0) {
    console.error(`\n❌ Strict mode failed: ${finalMissing} missing key signature(s) remain.`);
    process.exit(1);
  }

  console.log('\n✅ Done');
}

main();
