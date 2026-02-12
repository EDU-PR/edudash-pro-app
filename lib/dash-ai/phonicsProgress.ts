import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

const DEFAULT_PHONICS_REPLAY_BUCKET = 'tts-audio';

export type PhonemeMasteryBand = 'green' | 'amber' | 'red';

export interface PhonemeMasteryRow {
  user_id: string;
  language_code: string;
  target_phoneme: string;
  avg_accuracy: number | null;
  total_attempts: number;
}

export interface PhonemeHeatmapCell extends PhonemeMasteryRow {
  band: PhonemeMasteryBand;
}

export interface PhonicsAttemptRow {
  id: string;
  user_id: string;
  language_code: string;
  target_word: string;
  target_phoneme: string;
  accuracy_score: number | null;
  fluency_score: number | null;
  completeness_score: number | null;
  pron_score: number | null;
  phoneme_json: Record<string, unknown> | null;
  audio_url: string | null;
  created_at: string;
}

export const classifyPhonemeMastery = (avgAccuracy: number | null): PhonemeMasteryBand => {
  if (typeof avgAccuracy !== 'number') return 'amber';
  if (avgAccuracy > 80) return 'green';
  if (avgAccuracy < 50) return 'red';
  return 'amber';
};

export async function getPhonemeHeatmap(
  userId: string,
  languageCode?: string
): Promise<PhonemeHeatmapCell[]> {
  const supabase = assertSupabase();

  let query = supabase
    .from('phoneme_mastery')
    .select('user_id, language_code, target_phoneme, avg_accuracy, total_attempts')
    .eq('user_id', userId)
    .order('avg_accuracy', { ascending: false, nullsFirst: false });

  if (languageCode) {
    query = query.eq('language_code', languageCode);
  }

  const { data, error } = await query;
  if (error) {
    logger.error('PhonicsProgress.getPhonemeHeatmap', error);
    throw error;
  }

  return ((data || []) as PhonemeMasteryRow[]).map((row) => ({
    ...row,
    band: classifyPhonemeMastery(row.avg_accuracy),
  }));
}

export async function getRecentPhonicsAttempts(
  userId: string,
  targetPhoneme: string,
  languageCode?: string,
  limit = 3
): Promise<PhonicsAttemptRow[]> {
  const supabase = assertSupabase();

  let query = supabase
    .from('phonics_attempts')
    .select(
      'id, user_id, language_code, target_word, target_phoneme, accuracy_score, fluency_score, completeness_score, pron_score, phoneme_json, audio_url, created_at'
    )
    .eq('user_id', userId)
    .eq('target_phoneme', targetPhoneme)
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(limit, 20)));

  if (languageCode) {
    query = query.eq('language_code', languageCode);
  }

  const { data, error } = await query;
  if (error) {
    logger.error('PhonicsProgress.getRecentPhonicsAttempts', error);
    throw error;
  }

  return (data || []) as PhonicsAttemptRow[];
}

function isStoragePath(value: string): boolean {
  const input = String(value || '').trim();
  if (!input) return false;
  if (input.startsWith('http://') || input.startsWith('https://')) return false;
  if (input.startsWith('data:')) return false;
  return true;
}

export async function getPhonicsAttemptReplayUrl(
  audioPathOrUrl: string | null | undefined,
  expiresInSeconds = 60 * 60,
  bucket = DEFAULT_PHONICS_REPLAY_BUCKET
): Promise<string | null> {
  const raw = String(audioPathOrUrl || '').trim();
  if (!raw) return null;
  if (!isStoragePath(raw)) return raw;

  const supabase = assertSupabase();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(raw, Math.max(60, Math.min(expiresInSeconds, 60 * 60 * 24 * 7)));

  if (error) {
    logger.error('PhonicsProgress.getPhonicsAttemptReplayUrl', error);
    return null;
  }

  return data?.signedUrl || null;
}

export async function buildHistoricalPhonicsContext(
  userId: string,
  targetPhoneme: string,
  languageCode?: string
): Promise<string | null> {
  const attempts = await getRecentPhonicsAttempts(userId, targetPhoneme, languageCode, 3);
  if (attempts.length === 0) return null;

  const scores = attempts
    .map((a) => (typeof a.accuracy_score === 'number' ? a.accuracy_score : null))
    .filter((v): v is number => typeof v === 'number');

  if (scores.length === 0) return null;

  const avg = scores.reduce((sum, n) => sum + n, 0) / scores.length;
  if (avg >= 80) {
    return `Learner has recently mastered "${targetPhoneme}" (${Math.round(avg)}% avg). Reinforce with one harder blended-word challenge.`;
  }
  if (avg < 50) {
    return `Learner keeps struggling with "${targetPhoneme}" (${Math.round(avg)}% avg over last ${scores.length} attempts). Give a slower mouth-position cue and one repetition drill before moving on.`;
  }
  return `Learner is improving on "${targetPhoneme}" (${Math.round(avg)}% avg). Give one encouragement and one focused retry.`;
}
