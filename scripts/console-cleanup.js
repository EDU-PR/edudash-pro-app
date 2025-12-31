#!/usr/bin/env node
/**
 * console-cleanup.js
 * 
 * Removes or guards console.log/warn/error statements in production code.
 * Replaces with logger utility or __DEV__ guards.
 * 
 * Usage:
 *   node scripts/console-cleanup.js --check    # Report only, no changes
 *   node scripts/console-cleanup.js --fix      # Fix all files
 *   node scripts/console-cleanup.js --fix hooks/  # Fix specific directory
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Directories to scan (exclude scripts, tests, web/src)
const INCLUDE_PATTERNS = [
  'hooks/**/*.{ts,tsx}',
  'components/**/*.{ts,tsx}',
  'services/**/*.{ts,tsx}',
  'lib/**/*.{ts,tsx}',
  'contexts/**/*.{ts,tsx}',
  'app/**/*.{ts,tsx}',
];

// Files/patterns to exclude
const EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/web/**',
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/tests/**',
  '**/scripts/**',
  '**/logger.ts',  // Don't modify the logger itself
];

// Regex patterns for console statements
const CONSOLE_PATTERNS = [
  /console\.log\s*\(/g,
  /console\.warn\s*\(/g,
  /console\.error\s*\(/g,
  /console\.debug\s*\(/g,
  /console\.info\s*\(/g,
];

function findConsoleStatements(content) {
  const results = [];
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    CONSOLE_PATTERNS.forEach(pattern => {
      if (pattern.test(line)) {
        results.push({
          line: index + 1,
          content: line.trim(),
          type: line.includes('console.error') ? 'error' 
              : line.includes('console.warn') ? 'warn'
              : line.includes('console.debug') ? 'debug'
              : line.includes('console.info') ? 'info'
              : 'log'
        });
      }
    });
  });
  
  return results;
}

function countConsoleStatements(content) {
  let count = 0;
  CONSOLE_PATTERNS.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) count += matches.length;
  });
  return count;
}

function hasLoggerImport(content) {
  return /import\s+.*\{[^}]*logger[^}]*\}.*from\s+['"]@\/lib\/logger['"]/.test(content) ||
         /import\s+\{\s*logger\s*\}.*from\s+['"].*logger['"]/.test(content);
}

function hasDevGuard(line) {
  return line.includes('__DEV__') || line.includes('if (__DEV__)');
}

function scan(targetDir = null) {
  const patterns = targetDir 
    ? [`${targetDir}/**/*.{ts,tsx}`]
    : INCLUDE_PATTERNS;
    
  let totalFiles = 0;
  let filesWithConsole = 0;
  let totalStatements = 0;
  const fileResults = [];

  patterns.forEach(pattern => {
    const files = glob.sync(pattern, {
      ignore: EXCLUDE_PATTERNS,
      nodir: true,
    });

    files.forEach(file => {
      totalFiles++;
      const content = fs.readFileSync(file, 'utf8');
      const count = countConsoleStatements(content);
      
      if (count > 0) {
        filesWithConsole++;
        totalStatements += count;
        const statements = findConsoleStatements(content);
        fileResults.push({ file, count, statements });
      }
    });
  });

  return { totalFiles, filesWithConsole, totalStatements, fileResults };
}

function printReport(results) {
  console.log('\n📊 Console Statement Audit Report');
  console.log('='.repeat(50));
  console.log(`Total files scanned: ${results.totalFiles}`);
  console.log(`Files with console statements: ${results.filesWithConsole}`);
  console.log(`Total console statements: ${results.totalStatements}`);
  console.log('='.repeat(50));

  if (results.fileResults.length > 0) {
    console.log('\nFiles with console statements:');
    results.fileResults
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
      .forEach(({ file, count }) => {
        console.log(`  ${count.toString().padStart(4)} - ${file}`);
      });
    
    if (results.fileResults.length > 20) {
      console.log(`  ... and ${results.fileResults.length - 20} more files`);
    }
  }
  
  console.log('\n💡 Run with --fix to automatically clean up these statements');
}

function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const fix = args.includes('--fix');
  
  // Get target directory if specified
  const targetDir = args.find(a => !a.startsWith('--'));
  
  if (!checkOnly && !fix) {
    console.log('Usage:');
    console.log('  node scripts/console-cleanup.js --check         # Report only');
    console.log('  node scripts/console-cleanup.js --fix           # Fix all');
    console.log('  node scripts/console-cleanup.js --fix hooks/    # Fix directory');
    process.exit(0);
  }

  const results = scan(targetDir);
  printReport(results);

  if (fix) {
    console.log('\n⚠️  Auto-fix is NOT YET IMPLEMENTED.');
    console.log('Manual cleanup recommended using logger utility:');
    console.log('  import { logger } from \'@/lib/logger\';');
    console.log('  logger.debug(\'Component\', \'message\', data);');
    console.log('  logger.warn(\'Component\', \'warning\', data);');
    console.log('  logger.error(\'Component\', \'error\', data);');
    console.log('\nOr wrap with __DEV__ guard:');
    console.log('  if (__DEV__) console.log(\'debug info\');');
  }
}

main();
