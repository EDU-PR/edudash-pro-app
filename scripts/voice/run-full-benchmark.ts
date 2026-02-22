#!/usr/bin/env tsx

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { parseArgs } from './common';

function runStep(label: string, args: string[]) {
  const result = spawnSync('npx', ['tsx', ...args], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runId = String(args['run-id'] || '').trim();
  const ourCaptured = String(args['our-captured'] || '').trim();
  const wisprInput = String(args['wispr-input'] || '').trim();
  const fetchProbes = Boolean(args['fetch-probes']);

  if (!runId) {
    throw new Error('Missing --run-id');
  }
  if (!ourCaptured) {
    throw new Error('Missing --our-captured <path>');
  }
  if (!wisprInput) {
    throw new Error('Missing --wispr-input <path>');
  }

  runStep('score our captures', [
    path.join('scripts/voice/run-our-dictation-benchmark.ts'),
    '--run-id', runId,
    '--captured', ourCaptured,
  ]);

  runStep('import wispr captures', [
    path.join('scripts/voice/import-wispr-headtohead.ts'),
    '--run-id', runId,
    '--input', wisprInput,
  ]);

  runStep('score parity', [
    path.join('scripts/voice/score-dictation-parity.ts'),
    '--run-id', runId,
  ]);

  runStep('enforce gates', [
    path.join('scripts/voice/check-benchmark-gates.ts'),
    '--run-id', runId,
  ]);

  if (fetchProbes) {
    runStep('fetch dictation probes', [
      path.join('scripts/voice/fetch-dictation-probes.ts'),
      '--run-id', runId,
      '--probe-run-id', runId,
      '--days', String(args.days || 2),
    ]);
  }

  console.log(`[voice-benchmark] Full run complete (${runId})`);
}

main().catch((error) => {
  console.error('[voice-benchmark] run-full-benchmark failed:', error);
  process.exit(1);
});
