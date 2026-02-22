import { promises as fs } from 'node:fs';
import path from 'node:path';

export type ParsedArgs = Record<string, string | boolean>;

export function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function readJsonl<T>(filePath: string): Promise<T[]> {
  const raw = await fs.readFile(filePath, 'utf8');
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

export function csvEscape(value: unknown): string {
  const str = String(value ?? '');
  if (!/[",\n]/.test(str)) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      out.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  out.push(current);
  return out;
}

export async function readCsv(filePath: string): Promise<Record<string, string>[]> {
  const raw = await fs.readFile(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    rows.push(row);
  }

  return rows;
}

export async function writeCsv(filePath: string, headers: string[], rows: Record<string, unknown>[]): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const out: string[] = [headers.join(',')];
  for (const row of rows) {
    out.push(headers.map((header) => csvEscape(row[header])).join(','));
  }
  await fs.writeFile(filePath, `${out.join('\n')}\n`, 'utf8');
}

export function nowRunId(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `voice_benchmark_${stamp}`;
}

export function toNumber(input: unknown): number | null {
  if (typeof input === 'number') return Number.isNaN(input) ? null : input;
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function normalizeStatus(input: unknown): 'ok' | 'failed' | 'skipped' {
  const value = String(input || '').trim().toLowerCase();
  if (value === 'failed') return 'failed';
  if (value === 'skipped') return 'skipped';
  return 'ok';
}

export function runArtifactsDir(runId: string): string {
  return path.join(process.cwd(), 'scripts', 'artifacts', 'voice-benchmark', runId);
}
