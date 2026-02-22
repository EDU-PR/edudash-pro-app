import type {
  VoiceBenchmarkSample,
  VoiceCellMetrics,
  VoiceLanguage,
  VoiceParityGateResult,
  VoicePlatform,
} from '@/lib/voice/benchmark/types';
import { aggregateVoiceScores, scoreVoiceSample } from '@/lib/voice/benchmark/metrics';

export interface VoiceCellComparison {
  language: VoiceLanguage;
  platform: VoicePlatform;
  our: VoiceCellMetrics | null;
  wispr: VoiceCellMetrics | null;
}

export interface VoiceParityEvaluation {
  run_id: string;
  generated_at: string;
  cells: VoiceCellComparison[];
  gates: VoiceParityGateResult[];
  passed: boolean;
}

function percentile(values: number[], value: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (value / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sorted[low];
  const weight = rank - low;
  return sorted[low] + (sorted[high] - sorted[low]) * weight;
}

function asNumber(input: number | null | undefined): number | null {
  if (typeof input !== 'number' || Number.isNaN(input)) return null;
  return input;
}

export function buildCellMetrics(samples: VoiceBenchmarkSample[]): VoiceCellMetrics[] {
  const groups = new Map<string, VoiceBenchmarkSample[]>();

  for (const sample of samples) {
    const key = `${sample.language}:${sample.platform}`;
    const existing = groups.get(key) || [];
    existing.push(sample);
    groups.set(key, existing);
  }

  const metrics: VoiceCellMetrics[] = [];

  for (const [key, grouped] of groups.entries()) {
    const [language, platform] = key.split(':') as [VoiceLanguage, VoicePlatform];
    const scored = grouped.map((sample) => scoreVoiceSample(sample));
    const aggregate = aggregateVoiceScores(scored);

    const firstTextLatency = scored
      .map((item) => asNumber(item.first_text_latency_ms))
      .filter((value): value is number => value !== null);

    const finalCommitLatency = scored
      .map((item) => asNumber(item.final_commit_latency_ms))
      .filter((value): value is number => value !== null);

    metrics.push({
      language,
      platform,
      n: aggregate.sample_count,
      wer: aggregate.wer,
      cer: aggregate.cer,
      failure_rate: aggregate.failure_rate,
      first_text_p50_ms: percentile(firstTextLatency, 50),
      final_commit_p50_ms: percentile(finalCommitLatency, 50),
      final_commit_p95_ms: percentile(finalCommitLatency, 95),
    });
  }

  return metrics.sort((a, b) => {
    if (a.language === b.language) return a.platform.localeCompare(b.platform);
    return a.language.localeCompare(b.language);
  });
}

function byLanguage(samples: VoiceBenchmarkSample[]): Map<VoiceLanguage, VoiceBenchmarkSample[]> {
  const grouped = new Map<VoiceLanguage, VoiceBenchmarkSample[]>();
  for (const sample of samples) {
    const existing = grouped.get(sample.language) || [];
    existing.push(sample);
    grouped.set(sample.language, existing);
  }
  return grouped;
}

export function evaluateVoiceParity(params: {
  runId: string;
  ourSamples: VoiceBenchmarkSample[];
  wisprSamples: VoiceBenchmarkSample[];
}): VoiceParityEvaluation {
  const { runId, ourSamples, wisprSamples } = params;
  const ourCells = buildCellMetrics(ourSamples);
  const wisprCells = buildCellMetrics(wisprSamples);

  const allKeys = new Set<string>([
    ...ourCells.map((cell) => `${cell.language}:${cell.platform}`),
    ...wisprCells.map((cell) => `${cell.language}:${cell.platform}`),
  ]);

  const cells: VoiceCellComparison[] = [...allKeys]
    .map((key) => {
      const [language, platform] = key.split(':') as [VoiceLanguage, VoicePlatform];
      return {
        language,
        platform,
        our: ourCells.find((item) => item.language === language && item.platform === platform) || null,
        wispr: wisprCells.find((item) => item.language === language && item.platform === platform) || null,
      };
    })
    .sort((a, b) => {
      if (a.language === b.language) return a.platform.localeCompare(b.platform);
      return a.language.localeCompare(b.language);
    });

  const gateAFailures: string[] = [];
  const gateBFailures: string[] = [];
  const gateDFailures: string[] = [];
  const floorP95Failures: string[] = [];

  for (const cell of cells) {
    const cellName = `${cell.language}/${cell.platform}`;
    if (!cell.our || !cell.wispr) {
      gateAFailures.push(`${cellName}: missing comparison data`);
      gateBFailures.push(`${cellName}: missing comparison data`);
      gateDFailures.push(`${cellName}: missing comparison data`);
      continue;
    }

    const werLimit = cell.wispr.wer * 1.1;
    if (cell.our.wer > werLimit) {
      gateAFailures.push(
        `${cellName}: our WER ${(cell.our.wer * 100).toFixed(2)}% > ${(werLimit * 100).toFixed(2)}%`,
      );
    }

    if (cell.our.n < 20 || cell.wispr.n < 20) {
      gateDFailures.push(`${cellName}: sample count below 20 (our=${cell.our.n}, wispr=${cell.wispr.n})`);
    }

    if (
      typeof cell.our.final_commit_p50_ms !== 'number' ||
      typeof cell.wispr.final_commit_p50_ms !== 'number'
    ) {
      gateBFailures.push(`${cellName}: missing p50 final-commit latency`);
    } else if (cell.our.final_commit_p50_ms > cell.wispr.final_commit_p50_ms + 300) {
      gateBFailures.push(
        `${cellName}: our p50 ${cell.our.final_commit_p50_ms.toFixed(0)}ms > ${(cell.wispr.final_commit_p50_ms + 300).toFixed(0)}ms`,
      );
    }

    if (
      typeof cell.our.final_commit_p95_ms !== 'number' ||
      cell.our.final_commit_p95_ms > 3500
    ) {
      floorP95Failures.push(
        `${cellName}: final-commit p95 ${cell.our.final_commit_p95_ms ?? 'missing'}ms exceeds 3500ms`,
      );
    }
  }

  const ourScored = ourSamples.map((sample) => scoreVoiceSample(sample));
  const ourAggregate = aggregateVoiceScores(ourScored);
  const gateCFailures: string[] = [];
  if (ourAggregate.failure_rate > 0.02) {
    gateCFailures.push(`overall failure rate ${(ourAggregate.failure_rate * 100).toFixed(2)}% > 2%`);
  }

  const byLang = byLanguage(ourSamples);
  const floorWERFailures: string[] = [];
  for (const [language, grouped] of byLang.entries()) {
    const scored = grouped.map((sample) => scoreVoiceSample(sample));
    const aggregate = aggregateVoiceScores(scored);

    if (aggregate.failure_rate > 0.05) {
      gateCFailures.push(`${language}: failure rate ${(aggregate.failure_rate * 100).toFixed(2)}% > 5%`);
    }

    if (aggregate.wer > 0.25) {
      floorWERFailures.push(`${language}: WER ${(aggregate.wer * 100).toFixed(2)}% > 25%`);
    }
  }

  const gates: VoiceParityGateResult[] = [
    {
      gate_id: 'A',
      name: 'WER parity (our <= wispr * 1.10) per language/platform',
      passed: gateAFailures.length === 0,
      details: gateAFailures,
    },
    {
      gate_id: 'B',
      name: 'Final-commit p50 parity (our <= wispr + 300ms) per language/platform',
      passed: gateBFailures.length === 0,
      details: gateBFailures,
    },
    {
      gate_id: 'C',
      name: 'Failure-rate limits (overall <= 2%, per-language <= 5%)',
      passed: gateCFailures.length === 0,
      details: gateCFailures,
    },
    {
      gate_id: 'D',
      name: 'Minimum samples per language/platform (n >= 20)',
      passed: gateDFailures.length === 0,
      details: gateDFailures,
    },
    {
      gate_id: 'F1',
      name: 'Absolute floor: final-commit p95 <= 3500ms per language/platform',
      passed: floorP95Failures.length === 0,
      details: floorP95Failures,
    },
    {
      gate_id: 'F2',
      name: 'Absolute floor: WER <= 25% per language',
      passed: floorWERFailures.length === 0,
      details: floorWERFailures,
    },
  ];

  return {
    run_id: runId,
    generated_at: new Date().toISOString(),
    cells,
    gates,
    passed: gates.every((gate) => gate.passed),
  };
}
