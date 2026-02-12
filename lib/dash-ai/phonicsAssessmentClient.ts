import { assertSupabase } from '@/lib/supabase';

export interface PhonicsAssessmentInput {
  referenceText: string;
  audioBase64: string;
  targetLanguage: string;
  targetPhoneme?: string | null;
  phonemeKey?: string | null;
  audioContentType?: string | null;
}

export interface PhonicsAssessmentResult {
  attemptId: string | null;
  assessment?: {
    accuracy_score?: number | null;
    target_phoneme_accuracy?: number | null;
    target_phoneme?: string | null;
    fluency_score?: number | null;
    completeness_score?: number | null;
    pronunciation_score?: number | null;
  };
  coaching?: {
    encouragement?: string | null;
    historical_hint?: string | null;
  };
  replay?: {
    audio_storage_path?: string | null;
    signed_url?: string | null;
    bucket?: string | null;
  };
}

export async function assessPhonicsAttempt(
  input: PhonicsAssessmentInput
): Promise<PhonicsAssessmentResult | null> {
  const referenceText = String(input.referenceText || '').trim();
  const audioBase64 = String(input.audioBase64 || '').trim();
  const targetLanguage = String(input.targetLanguage || 'en-ZA').trim() || 'en-ZA';
  const targetPhoneme = String(input.targetPhoneme || '').trim() || undefined;
  const phonemeKey = String(input.phonemeKey || '').trim() || undefined;
  const audioContentType = String(input.audioContentType || '').trim() || 'audio/m4a';

  if (!referenceText || !audioBase64) {
    return null;
  }

  const supabase = assertSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('AUTH_REQUIRED');
  }

  const response = await fetch(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/tts-proxy`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: 'assessAndRespond',
        reference_text: referenceText,
        target_lang: targetLanguage,
        target_phoneme: targetPhoneme,
        phoneme_key: phonemeKey,
        audio_data: audioBase64,
        audio_content_type: audioContentType,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || `PHONICS_ASSESS_FAILED_${response.status}`);
  }

  const data = await response.json().catch(() => ({}));
  return {
    attemptId: data?.attempt_id || null,
    assessment: data?.assessment,
    coaching: data?.coaching,
    replay: data?.replay,
  };
}

