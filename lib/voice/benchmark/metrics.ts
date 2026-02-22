import type { VoiceBenchmarkSample } from '@/lib/voice/benchmark/types';
import { normalizeTranscript, tokenizeTranscript } from '@/lib/voice/benchmark/normalizeTranscript';

export interface VoiceSampleScore {
  sample_id: string;
  language: VoiceBenchmarkSample['language'];
  platform: VoiceBenchmarkSample['platform'];
  status: VoiceBenchmarkSample['status'];
  wer: number;
  cer: number;
  word_distance: number;
  word_ref_len: number;
  char_distance: number;
  char_ref_len: number;
  first_text_latency_ms: number | null;
  final_commit_latency_ms: number | null;
}

export interface VoiceAggregateScore {
  sample_count: number;
  successful_count: number;
  failed_count: number;
  skipped_count: number;
  failure_rate: number;
  wer: number;
  cer: number;
}

function levenshteinDistance<T>(left: T[], right: T[]): number {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[rows - 1][cols - 1];
}

export function calculateWER(referenceText: string, observedText: string): {
  wer: number;
  distance: number;
  refLength: number;
} {
  const ref = tokenizeTranscript(referenceText);
  const hyp = tokenizeTranscript(observedText);
  const refLength = ref.length;

  if (refLength === 0) {
    return { wer: hyp.length > 0 ? 1 : 0, distance: hyp.length, refLength: 0 };
  }

  const distance = levenshteinDistance(ref, hyp);
  return {
    wer: distance / refLength,
    distance,
    refLength,
  };
}

export function calculateCER(referenceText: string, observedText: string): {
  cer: number;
  distance: number;
  refLength: number;
} {
  const ref = normalizeTranscript(referenceText).replace(/\s+/g, '');
  const hyp = normalizeTranscript(observedText).replace(/\s+/g, '');
  const refChars = [...ref];
  const hypChars = [...hyp];
  const refLength = refChars.length;

  if (refLength === 0) {
    return { cer: hypChars.length > 0 ? 1 : 0, distance: hypChars.length, refLength: 0 };
  }

  const distance = levenshteinDistance(refChars, hypChars);
  return {
    cer: distance / refLength,
    distance,
    refLength,
  };
}

export function scoreVoiceSample(sample: VoiceBenchmarkSample): VoiceSampleScore {
  const status = sample.status || 'ok';
  const observed = String(sample.observed_text || '').trim();

  if (status !== 'ok' || !observed) {
    const wordRefLen = tokenizeTranscript(sample.reference_text).length;
    const charRefLen = normalizeTranscript(sample.reference_text).replace(/\s+/g, '').length;
    return {
      sample_id: sample.sample_id,
      language: sample.language,
      platform: sample.platform,
      status,
      wer: 1,
      cer: 1,
      word_distance: wordRefLen,
      word_ref_len: wordRefLen,
      char_distance: charRefLen,
      char_ref_len: charRefLen,
      first_text_latency_ms: typeof sample.first_text_latency_ms === 'number' ? sample.first_text_latency_ms : null,
      final_commit_latency_ms: typeof sample.final_commit_latency_ms === 'number' ? sample.final_commit_latency_ms : null,
    };
  }

  const word = calculateWER(sample.reference_text, observed);
  const char = calculateCER(sample.reference_text, observed);

  return {
    sample_id: sample.sample_id,
    language: sample.language,
    platform: sample.platform,
    status,
    wer: word.wer,
    cer: char.cer,
    word_distance: word.distance,
    word_ref_len: word.refLength,
    char_distance: char.distance,
    char_ref_len: char.refLength,
    first_text_latency_ms: typeof sample.first_text_latency_ms === 'number' ? sample.first_text_latency_ms : null,
    final_commit_latency_ms: typeof sample.final_commit_latency_ms === 'number' ? sample.final_commit_latency_ms : null,
  };
}

export function aggregateVoiceScores(scores: VoiceSampleScore[]): VoiceAggregateScore {
  let totalWordDistance = 0;
  let totalWordRef = 0;
  let totalCharDistance = 0;
  let totalCharRef = 0;
  let successfulCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const score of scores) {
    if (score.status === 'skipped') {
      skippedCount += 1;
      continue;
    }

    if (score.status === 'ok') {
      successfulCount += 1;
    } else {
      failedCount += 1;
    }

    totalWordDistance += score.word_distance;
    totalWordRef += score.word_ref_len;
    totalCharDistance += score.char_distance;
    totalCharRef += score.char_ref_len;
  }

  const processed = successfulCount + failedCount;
  const sampleCount = scores.length;

  return {
    sample_count: sampleCount,
    successful_count: successfulCount,
    failed_count: failedCount,
    skipped_count: skippedCount,
    failure_rate: processed > 0 ? failedCount / processed : 0,
    wer: totalWordRef > 0 ? totalWordDistance / totalWordRef : 0,
    cer: totalCharRef > 0 ? totalCharDistance / totalCharRef : 0,
  };
}
