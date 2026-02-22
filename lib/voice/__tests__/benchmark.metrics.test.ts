import { normalizeTranscript } from '@/lib/voice/benchmark/normalizeTranscript';
import {
  aggregateVoiceScores,
  calculateCER,
  calculateWER,
  scoreVoiceSample,
} from '@/lib/voice/benchmark/metrics';
import { evaluateVoiceParity } from '@/lib/voice/benchmark/parity';
import type { VoiceBenchmarkSample } from '@/lib/voice/benchmark/types';

describe('voice benchmark normalization', () => {
  it('normalizes punctuation, case, and accents', () => {
    expect(normalizeTranscript('  Héllo, WORLD!!  ')).toBe('hello world');
  });
});

describe('voice benchmark metrics', () => {
  it('calculates WER and CER deterministically', () => {
    const wer = calculateWER('open the messages tab', 'open messages tab');
    const cer = calculateCER('abc', 'adc');

    expect(wer.distance).toBe(1);
    expect(wer.refLength).toBe(4);
    expect(wer.wer).toBeCloseTo(0.25);

    expect(cer.distance).toBe(1);
    expect(cer.refLength).toBe(3);
    expect(cer.cer).toBeCloseTo(1 / 3);
  });

  it('treats failed rows as failures with score payload', () => {
    const sample: VoiceBenchmarkSample = {
      sample_id: 'en_001',
      language: 'en',
      platform: 'mobile',
      reference_text: 'open messages',
      observed_text: '',
      status: 'failed',
    };

    const scored = scoreVoiceSample(sample);
    expect(scored.status).toBe('failed');
    expect(scored.wer).toBe(1);
    expect(scored.cer).toBe(1);

    const aggregate = aggregateVoiceScores([scored]);
    expect(aggregate.failed_count).toBe(1);
    expect(aggregate.failure_rate).toBe(1);
    expect(aggregate.wer).toBe(1);
    expect(aggregate.cer).toBe(1);
  });
});

describe('voice parity gate evaluation', () => {
  function makeSamples(source: 'our' | 'wispr', observedText: string, latency = 1200): VoiceBenchmarkSample[] {
    const rows: VoiceBenchmarkSample[] = [];
    const languages: VoiceBenchmarkSample['language'][] = ['en', 'af', 'zu', 'xh'];
    const platforms: VoiceBenchmarkSample['platform'][] = ['mobile', 'web'];

    for (const language of languages) {
      for (const platform of platforms) {
        for (let i = 0; i < 20; i += 1) {
          rows.push({
            sample_id: `${language}_${platform}_${i}`,
            language,
            platform,
            reference_text: 'open the dashboard now',
            observed_text: observedText,
            first_text_latency_ms: latency - 400,
            final_commit_latency_ms: latency,
            status: 'ok',
            source,
          });
        }
      }
    }

    return rows;
  }

  it('passes all gates for near-identical data', () => {
    const wispr = makeSamples('wispr', 'open the dashboard now', 1200);
    const our = makeSamples('our', 'open the dashboard now', 1450);

    const result = evaluateVoiceParity({
      runId: 'run_pass',
      ourSamples: our,
      wisprSamples: wispr,
    });

    expect(result.passed).toBe(true);
    expect(result.gates.every((gate) => gate.passed)).toBe(true);
  });

  it('fails when WER and latency exceed parity thresholds', () => {
    const wispr = makeSamples('wispr', 'open the dashboard now', 1100);
    const our = makeSamples('our', 'dashboard', 1800);

    const result = evaluateVoiceParity({
      runId: 'run_fail',
      ourSamples: our,
      wisprSamples: wispr,
    });

    const gateA = result.gates.find((gate) => gate.gate_id === 'A');
    const gateB = result.gates.find((gate) => gate.gate_id === 'B');

    expect(result.passed).toBe(false);
    expect(gateA?.passed).toBe(false);
    expect(gateB?.passed).toBe(false);
  });
});
