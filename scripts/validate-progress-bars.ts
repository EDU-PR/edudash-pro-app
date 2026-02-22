#!/usr/bin/env tsx

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

type Candidate = {
  file: string;
  line: number;
  content: string;
};

const ROOT = process.cwd();
const INVENTORY_PATH = path.join(ROOT, 'docs/audits/progress-bars-inventory.md');
const SCAN_CMD = "rg -n 'width:\\s*`\\$\\{[^`]*%`' app components web/src --glob '!components/wireframes/**'";

function loadInventoryAllowlist(): Set<string> {
  const allowlist = new Set<string>();
  let markdown = '';
  try {
    markdown = readFileSync(INVENTORY_PATH, 'utf8');
  } catch {
    return allowlist;
  }

  const rows = markdown.split('\n').filter((line) => line.startsWith('| `'));
  for (const row of rows) {
    const cols = row.split('|').map((col) => col.trim());
    const file = cols[1]?.replace(/`/g, '');
    const lineRaw = cols[2];
    const line = Number(lineRaw);
    if (!file || !Number.isFinite(line)) continue;
    allowlist.add(`${file}:${line}`);
  }
  return allowlist;
}

function scanDynamicWidthCandidates(): Candidate[] {
  const raw = execSync(SCAN_CMD, { cwd: ROOT, encoding: 'utf8' }).trim();
  if (!raw) return [];

  return raw
    .split('\n')
    .map((entry) => {
      const first = entry.indexOf(':');
      const second = entry.indexOf(':', first + 1);
      if (first <= 0 || second <= first) return null;
      const file = entry.slice(0, first);
      const line = Number(entry.slice(first + 1, second));
      const content = entry.slice(second + 1).trim();
      if (!file || !Number.isFinite(line)) return null;
      return { file, line, content };
    })
    .filter((entry): entry is Candidate => Boolean(entry));
}

function collectClampedVarsByFile(candidates: Candidate[]): Map<string, Set<string>> {
  const varsByFile = new Map<string, Set<string>>();
  const files = [...new Set(candidates.map((candidate) => candidate.file))];

  for (const file of files) {
    const fullPath = path.join(ROOT, file);
    let source = '';
    try {
      source = readFileSync(fullPath, 'utf8');
    } catch {
      varsByFile.set(file, new Set());
      continue;
    }

    const vars = new Set<string>();
    const regex = /\b(?:const|let)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:clampPercent|ratioToPercent)\s*\(/g;
    for (const match of source.matchAll(regex)) {
      if (match[1]) vars.add(match[1]);
    }
    varsByFile.set(file, vars);
  }

  return varsByFile;
}

function extractTemplateExpressions(lineContent: string): string[] {
  const expressions: string[] = [];
  const regex = /width\s*:\s*`\$\{([^`]+)\}%`/g;
  for (const match of lineContent.matchAll(regex)) {
    if (match[1]) expressions.push(match[1].trim());
  }
  return expressions;
}

function expressionUsesClampedValue(expression: string, clampedVars: Set<string>): boolean {
  if (/clampPercent\s*\(/.test(expression) || /ratioToPercent\s*\(/.test(expression)) {
    return true;
  }

  const identifiers = expression.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) || [];
  return identifiers.some((name) => clampedVars.has(name));
}

function main(): void {
  const allowlist = loadInventoryAllowlist();
  const candidates = scanDynamicWidthCandidates();
  const clampedVarsByFile = collectClampedVarsByFile(candidates);

  const violations: Candidate[] = [];
  for (const candidate of candidates) {
    const key = `${candidate.file}:${candidate.line}`;
    const clampedVars = clampedVarsByFile.get(candidate.file) || new Set<string>();
    const expressions = extractTemplateExpressions(candidate.content);
    const isSafe = expressions.length > 0 && expressions.every((expr) => expressionUsesClampedValue(expr, clampedVars));

    if (isSafe) continue;
    if (allowlist.has(key)) continue;
    violations.push(candidate);
  }

  if (violations.length > 0) {
    console.error('[validate-progress-bars] Found new dynamic width percentages without clamp helper usage:');
    for (const violation of violations) {
      console.error(`- ${violation.file}:${violation.line} -> ${violation.content}`);
    }
    console.error(
      `\nFix by using clamp helpers (\`clampPercent\` / \`ratioToPercent\`) or explicitly baseline in ${path.relative(ROOT, INVENTORY_PATH)}.`,
    );
    process.exit(1);
  }

  console.log(
    `[validate-progress-bars] OK. Checked ${candidates.length} dynamic width entries; no new unclamped entries beyond baseline.`,
  );
}

main();

