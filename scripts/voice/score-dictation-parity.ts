#!/usr/bin/env tsx

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { evaluateVoiceParity } from '../../lib/voice/benchmark/parity';
import type { VoiceBenchmarkSample } from '../../lib/voice/benchmark/types';
import { parseArgs, readJson, runArtifactsDir, writeJson } from './common';

function formatMs(value: number | null | undefined): string {
  if (typeof value !== 'number') return 'n/a';
  return `${value.toFixed(0)}ms`;
}

function formatPct(value: number | null | undefined): string {
  if (typeof value !== 'number') return 'n/a';
  return `${(value * 100).toFixed(2)}%`;
}

function renderMarkdown(result: ReturnType<typeof evaluateVoiceParity>): string {
  const cellRows = result.cells
    .map((cell) => {
      const ourWer = formatPct(cell.our?.wer);
      const wisprWer = formatPct(cell.wispr?.wer);
      const ourP50 = formatMs(cell.our?.final_commit_p50_ms);
      const wisprP50 = formatMs(cell.wispr?.final_commit_p50_ms);
      const ourFailure = formatPct(cell.our?.failure_rate);
      return `| ${cell.language} | ${cell.platform} | ${ourWer} | ${wisprWer} | ${ourP50} | ${wisprP50} | ${ourFailure} |`;
    })
    .join('\n');

  const gateRows = result.gates
    .map((gate) => {
      const detail = gate.details.length > 0 ? gate.details.join(' ; ') : 'ok';
      return `| ${gate.gate_id} | ${gate.passed ? 'PASS' : 'FAIL'} | ${gate.name} | ${detail} |`;
    })
    .join('\n');

  return [
    `# Voice Dictation Parity (${result.run_id})`,
    '',
    `Overall result: **${result.passed ? 'PASS' : 'FAIL'}**`,
    `Generated: ${result.generated_at}`,
    '',
    '## Cell Comparison',
    '',
    '| Language | Platform | Our WER | Wispr WER | Our Final p50 | Wispr Final p50 | Our Failure |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: |',
    cellRows || '| - | - | n/a | n/a | n/a | n/a | n/a |',
    '',
    '## Gate Results',
    '',
    '| Gate | Status | Rule | Details |',
    '| --- | --- | --- | --- |',
    gateRows,
    '',
  ].join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runId = String(args['run-id'] || '').trim();

  if (!runId) {
    throw new Error('Missing required --run-id');
  }

  const outDir = runArtifactsDir(runId);
  const ourPath = String(args.our || path.join(outDir, 'our_samples.json')).trim();
  const wisprPath = String(args.wispr || path.join(outDir, 'wispr_samples.json')).trim();

  const ourSamples = await readJson<VoiceBenchmarkSample[]>(ourPath);
  const wisprSamples = await readJson<VoiceBenchmarkSample[]>(wisprPath);

  const result = evaluateVoiceParity({
    runId,
    ourSamples,
    wisprSamples,
  });

  await writeJson(path.join(outDir, 'comparison.json'), result);
  await writeJson(path.join(outDir, 'gate_result.json'), {
    run_id: result.run_id,
    generated_at: result.generated_at,
    passed: result.passed,
    gates: result.gates,
  });

  await fs.writeFile(path.join(outDir, 'comparison.md'), renderMarkdown(result), 'utf8');

  console.log(`[voice-benchmark] parity result: ${result.passed ? 'PASS' : 'FAIL'}`);
  console.log(`[voice-benchmark] output: ${outDir}`);
}

main().catch((error) => {
  console.error('[voice-benchmark] score-dictation-parity failed:', error);
  process.exit(1);
});
