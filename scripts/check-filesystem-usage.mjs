#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ALLOWED_IMPORT_FILES = new Set([
  'lib/platform/filesystem.ts',
]);

const TARGET_DIRS = ['app', 'components', 'hooks', 'lib', 'services', 'web', 'scripts'];
const IMPORT_REGEX = /from\s+['"]expo-file-system(?:\/legacy)?['"]/;
const DEPRECATED_METHODS = [
  'getInfoAsync',
  'readAsStringAsync',
  'copyAsync',
  'moveAsync',
  'deleteAsync',
  'makeDirectoryAsync',
  'writeAsStringAsync',
  'downloadAsync',
  'uploadAsync',
  'createDownloadResumable',
];

function listRepoFiles() {
  try {
    const query = TARGET_DIRS.join(' ');
    const output = execSync(
      `rg --files ${query} -g '!node_modules/**' -g '!*dist/**' -g '!.next/**'`,
      { cwd: ROOT, encoding: 'utf8' },
    );
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function collectViolations() {
  const files = listRepoFiles();
  const violations = [];

  for (const file of files) {
    const absolute = path.join(ROOT, file);
    const content = fs.readFileSync(absolute, 'utf8');
    const hasDirectImport = IMPORT_REGEX.test(content);

    if (hasDirectImport && !ALLOWED_IMPORT_FILES.has(file)) {
      violations.push({
        file,
        type: 'direct-import',
        message: 'Direct import from expo-file-system is not allowed outside adapter.',
      });
    }

    if (
      hasDirectImport &&
      !ALLOWED_IMPORT_FILES.has(file) &&
      /from\s+['"]expo-file-system['"]/.test(content)
    ) {
      const deprecatedHits = DEPRECATED_METHODS.filter((method) =>
        new RegExp(`\\b${method}\\s*\\(`).test(content),
      );
      if (deprecatedHits.length > 0) {
        violations.push({
          file,
          type: 'deprecated-method',
          message: `Deprecated runtime-throw methods used with expo-file-system import: ${deprecatedHits.join(', ')}`,
        });
      }
    }
  }

  return violations;
}

const violations = collectViolations();

if (violations.length > 0) {
  console.error('\n[check:filesystem] Violations found:\n');
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.message}`);
  }
  console.error('\nUse adapter: @/lib/platform/filesystem\n');
  process.exit(1);
}

console.log('[check:filesystem] OK - filesystem imports are adapter-only.');
