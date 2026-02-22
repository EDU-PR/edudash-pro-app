#!/usr/bin/env tsx

import path from 'node:path';
import type { VoiceParityGateResult } from '../../lib/voice/benchmark/types';
import { parseArgs, readJson, runArtifactsDir } from './common';

type GateFile = {
  run_id: string;
  generated_at: string;
  passed: boolean;
  gates: VoiceParityGateResult[];
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runId = String(args['run-id'] || '').trim();
  const inputPath = String(args.input || (runId ? path.join(runArtifactsDir(runId), 'gate_result.json') : '')).trim();

  if (!inputPath) {
    throw new Error('Provide --run-id or --input <gate_result.json>');
  }

  const gateFile = await readJson<GateFile>(inputPath);
  const failed = gateFile.gates.filter((gate) => !gate.passed);

  if (gateFile.passed) {
    console.log(`[voice-benchmark] PASS (${gateFile.run_id})`);
    return;
  }

  console.error(`[voice-benchmark] FAIL (${gateFile.run_id})`);
  for (const gate of failed) {
    console.error(`- ${gate.gate_id}: ${gate.name}`);
    for (const detail of gate.details) {
      console.error(`  - ${detail}`);
    }
  }

  process.exit(1);
}

main().catch((error) => {
  console.error('[voice-benchmark] check-benchmark-gates failed:', error);
  process.exit(1);
});
