#!/usr/bin/env tsx

import { promises as fs } from 'node:fs';
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
  ensureDir,
  nowRunId,
  parseArgs,
  readCsv,
  readJsonl,
  runArtifactsDir,
  toNumber,
  writeCsv,
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

function resolvePlatforms(raw: string | boolean | undefined): VoicePlatform[] {
  if (raw === 'mobile') return ['mobile'];
  if (raw === 'web') return ['web'];
  return ['mobile', 'web'];
}

function metricMarkdown(params: {
  runId: string;
  overall: ReturnType<typeof aggregateVoiceScores>;
  cellMetrics: ReturnType<typeof buildCellMetrics>;
}): string {
  const { runId, overall, cellMetrics } = params;
  const rows = cellMetrics
    .map((cell) => {
      const p50 = typeof cell.final_commit_p50_ms === 'number' ? `${cell.final_commit_p50_ms.toFixed(0)}ms` : 'n/a';
      const p95 = typeof cell.final_commit_p95_ms === 'number' ? `${cell.final_commit_p95_ms.toFixed(0)}ms` : 'n/a';
      return `| ${cell.language} | ${cell.platform} | ${cell.n} | ${(cell.wer * 100).toFixed(2)}% | ${(cell.cer * 100).toFixed(2)}% | ${(cell.failure_rate * 100).toFixed(2)}% | ${p50} | ${p95} |`;
    })
    .join('\n');

  return [
    `# Our Dictation Benchmark (${runId})`,
    '',
    `- Sample count: ${overall.sample_count}`,
    `- Successful: ${overall.successful_count}`,
    `- Failed: ${overall.failed_count}`,
    `- Skipped: ${overall.skipped_count}`,
    `- WER: ${(overall.wer * 100).toFixed(2)}%`,
    `- CER: ${(overall.cer * 100).toFixed(2)}%`,
    `- Failure rate: ${(overall.failure_rate * 100).toFixed(2)}%`,
    '',
    '| Language | Platform | N | WER | CER | Failure | Final Commit p50 | Final Commit p95 |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    rows || '| - | - | 0 | n/a | n/a | n/a | n/a | n/a |',
    '',
  ].join('\n');
}

async function loadCapturedRows(paths: string[]): Promise<Record<string, string>[]> {
  const out: Record<string, string>[] = [];
  for (const filePath of paths) {
    if (!filePath) continue;
    const rows = await readCsv(filePath);
    out.push(...rows);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runId = (args['run-id'] as string) || nowRunId();
  const platforms = resolvePlatforms(args.platform);
  const outDir = runArtifactsDir(runId);
  await ensureDir(outDir);

  const references = await readJsonl<ReferenceRow>(REFERENCE_PATH);
  const referenceById = new Map(references.map((item) => [item.sample_id, item]));

  const captureSheetRows = references.flatMap((ref) =>
    platforms.map((platform) => ({
      run_id: runId,
      sample_id: ref.sample_id,
      language: ref.language,
      platform,
      reference_text: ref.reference_text,
      observed_text: '',
      first_text_latency_ms: '',
      final_commit_latency_ms: '',
      status: '',
      notes: '',
    })),
  );

  await writeCsv(
    path.join(outDir, 'our_capture_sheet.csv'),
    [
      'run_id',
      'sample_id',
      'language',
      'platform',
      'reference_text',
      'observed_text',
      'first_text_latency_ms',
      'final_commit_latency_ms',
      'status',
      'notes',
    ],
    captureSheetRows,
  );

  const capturedPaths = [
    args.captured as string,
    args['captured-mobile'] as string,
    args['captured-web'] as string,
  ].filter(Boolean) as string[];

  if (capturedPaths.length === 0) {
    console.log(`[voice-benchmark] Capture sheet generated: ${path.join(outDir, 'our_capture_sheet.csv')}`);
    console.log('[voice-benchmark] Provide --captured <csv> (or --captured-mobile/--captured-web) to score results.');
    return;
  }

  const rawRows = await loadCapturedRows(capturedPaths);
  const normalizedSamples: VoiceBenchmarkSample[] = [];

  for (const row of rawRows) {
    const sampleId = String(row.sample_id || '').trim();
    if (!sampleId) continue;
    const reference = referenceById.get(sampleId);
    if (!reference) {
      console.warn(`[voice-benchmark] Skipping unknown sample_id: ${sampleId}`);
      continue;
    }

    const platformRaw = String(row.platform || '').trim().toLowerCase();
    const platform: VoicePlatform = platformRaw === 'mobile' || platformRaw === 'web'
      ? platformRaw
      : (args.platform === 'mobile' ? 'mobile' : 'web');

    normalizedSamples.push({
      run_id: runId,
      source: 'our',
      sample_id: sampleId,
      language: reference.language,
      platform,
      category: reference.category as VoiceBenchmarkSample['category'],
      reference_text: reference.reference_text,
      observed_text: row.observed_text || '',
      first_text_latency_ms: toNumber(row.first_text_latency_ms),
      final_commit_latency_ms: toNumber(row.final_commit_latency_ms),
      status: normalizeStatus(row.status),
      notes: row.notes || '',
    });
  }

  const scored = normalizedSamples.map((sample) => scoreVoiceSample(sample));
  const overall = aggregateVoiceScores(scored);
  const cellMetrics = buildCellMetrics(normalizedSamples);

  await writeJson(path.join(outDir, 'our_samples.json'), normalizedSamples);
  await writeJson(path.join(outDir, 'our_metrics.json'), {
    run_id: runId,
    generated_at: new Date().toISOString(),
    overall,
    cells: cellMetrics,
  });

  const markdown = metricMarkdown({ runId, overall, cellMetrics });
  await fs.writeFile(path.join(outDir, 'our_metrics.md'), markdown, 'utf8');

  console.log(`[voice-benchmark] Scored ${normalizedSamples.length} captured rows.`);
  console.log(`[voice-benchmark] Outputs written to ${outDir}`);
}

main().catch((error) => {
  console.error('[voice-benchmark] run-our-dictation-benchmark failed:', error);
  process.exit(1);
});
