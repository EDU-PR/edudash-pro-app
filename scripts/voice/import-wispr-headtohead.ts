#!/usr/bin/env tsx

import path from 'node:path';
import {
  aggregateVoiceScores,
  scoreVoiceSample,
} from '../../lib/voice/benchmark/metrics';
import { buildCellMetrics } from '../../lib/voice/benchmark/parity';
import type {
  VoiceBenchmarkSample,
  VoiceLanguage,
  VoicePlatform,
} from '../../lib/voice/benchmark/types';
import {
  nowRunId,
  parseArgs,
  readCsv,
  readJsonl,
  runArtifactsDir,
  toNumber,
  writeJson,
  normalizeStatus,
} from './common';

type ReferenceRow = {
  sample_id: string;
  language: VoiceLanguage;
  category: string;
  reference_text: string;
};

const REFERENCE_PATH = path.join(process.cwd(), 'tests/voice/benchmark/reference_transcripts.v1.jsonl');

function resolvePlatform(raw: unknown): VoicePlatform {
  const value = String(raw || '').trim().toLowerCase();
  return value === 'mobile' ? 'mobile' : 'web';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runId = (args['run-id'] as string) || nowRunId();
  const input = String(args.input || '').trim();

  if (!input) {
    throw new Error('Missing required --input <path-to-wispr-csv>');
  }

  const outDir = runArtifactsDir(runId);
  const referenceRows = await readJsonl<ReferenceRow>(REFERENCE_PATH);
  const referenceById = new Map(referenceRows.map((row) => [row.sample_id, row]));

  const wisprRows = await readCsv(path.resolve(input));
  const samples: VoiceBenchmarkSample[] = [];

  for (const row of wisprRows) {
    const sampleId = String(row.sample_id || '').trim();
    if (!sampleId) continue;

    const reference = referenceById.get(sampleId);
    if (!reference) {
      console.warn(`[voice-benchmark] skipping unknown sample_id in wispr csv: ${sampleId}`);
      continue;
    }

    samples.push({
      run_id: runId,
      source: 'wispr',
      sample_id: sampleId,
      language: reference.language,
      category: reference.category as VoiceBenchmarkSample['category'],
      platform: resolvePlatform(row.platform),
      reference_text: reference.reference_text,
      observed_text: row.observed_text || '',
      first_text_latency_ms: toNumber(row.first_text_latency_ms),
      final_commit_latency_ms: toNumber(row.final_commit_latency_ms),
      status: normalizeStatus(row.status),
      notes: row.notes || '',
    });
  }

  const overall = aggregateVoiceScores(samples.map((sample) => scoreVoiceSample(sample)));
  const cells = buildCellMetrics(samples);

  await writeJson(path.join(outDir, 'wispr_samples.json'), samples);
  await writeJson(path.join(outDir, 'wispr_metrics.json'), {
    run_id: runId,
    generated_at: new Date().toISOString(),
    overall,
    cells,
  });

  console.log(`[voice-benchmark] imported ${samples.length} wispr rows`);
  console.log(`[voice-benchmark] output: ${outDir}`);
}

main().catch((error) => {
  console.error('[voice-benchmark] import-wispr-headtohead failed:', error);
  process.exit(1);
});
