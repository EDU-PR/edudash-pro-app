export type VoiceLanguage = 'en' | 'af' | 'zu' | 'xh';

export type VoicePlatform = 'mobile' | 'web';

export type VoiceSampleStatus = 'ok' | 'failed' | 'skipped';

export type VoiceCategory =
  | 'short'
  | 'medium'
  | 'long'
  | 'command'
  | 'names_acronyms';

export interface VoiceBenchmarkSample {
  sample_id: string;
  language: VoiceLanguage;
  category?: VoiceCategory;
  platform: VoicePlatform;
  reference_text: string;
  observed_text?: string;
  first_text_latency_ms?: number | null;
  final_commit_latency_ms?: number | null;
  status?: VoiceSampleStatus;
  notes?: string;
  run_id?: string;
  source?: 'our' | 'wispr';
}

export interface VoiceProbeMetrics {
  run_id?: string;
  platform: VoicePlatform;
  source?: string;
  stt_start_at?: string;
  first_partial_at?: string;
  final_transcript_at?: string;
  commit_at?: string;
}

export interface VoiceCellMetrics {
  language: VoiceLanguage;
  platform: VoicePlatform;
  n: number;
  wer: number;
  cer: number;
  failure_rate: number;
  first_text_p50_ms: number | null;
  final_commit_p50_ms: number | null;
  final_commit_p95_ms: number | null;
}

export interface VoiceParityGateResult {
  gate_id: 'A' | 'B' | 'C' | 'D' | 'F1' | 'F2';
  name: string;
  passed: boolean;
  details: string[];
}
