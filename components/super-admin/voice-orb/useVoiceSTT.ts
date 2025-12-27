/**
 * useVoiceSTT Hook
 * 
 * Handles Speech-to-Text via Edge Function.
 * Extracted from VoiceOrb per WARP.md guidelines.
 * 
 * @module components/super-admin/voice-orb/useVoiceSTT
 */

import { useCallback, useState } from 'react';
import { assertSupabase } from '../../../lib/supabase';

// Azure Speech Services supported South African languages
export const SUPPORTED_LANGUAGES = [
  { code: 'en-ZA', name: 'English (South Africa)', voice: 'en-ZA-LeahNeural' },
  { code: 'af-ZA', name: 'Afrikaans', voice: 'af-ZA-AdriNeural' },
  { code: 'zu-ZA', name: 'isiZulu', voice: 'zu-ZA-ThandoNeural' },
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]['code'];

export interface STTResult {
  text: string;
  language: string;
}

export interface UseVoiceSTTReturn {
  transcribe: (audioUri: string, language: SupportedLanguage) => Promise<STTResult | null>;
  isTranscribing: boolean;
  error: string | null;
}

export function useVoiceSTT(): UseVoiceSTTReturn {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transcribe = useCallback(async (
    audioUri: string, 
    language: SupportedLanguage
  ): Promise<STTResult | null> => {
    setIsTranscribing(true);
    setError(null);
    
    try {
      const supabase = assertSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }
      
      // Read audio file as base64
      const response = await fetch(audioUri);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      console.log('[VoiceSTT] Sending to STT, language:', language, 'size:', base64.length);
      
      const sttResponse = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/stt-proxy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            audio_base64: base64,
            language: language,
            format: 'm4a',
          }),
        }
      );
      
      if (!sttResponse.ok) {
        const errorText = await sttResponse.text();
        console.error('[VoiceSTT] STT error:', errorText);
        throw new Error(`STT failed: ${sttResponse.status}`);
      }
      
      const { text, language: detectedLang } = await sttResponse.json();
      
      if (text && text.trim()) {
        console.log('[VoiceSTT] Transcribed:', text.substring(0, 50) + '...');
        return { text, language: detectedLang || language };
      } else {
        console.log('[VoiceSTT] No speech in audio');
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transcription failed';
      console.error('[VoiceSTT] Error:', message);
      setError(message);
      return null;
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  return { transcribe, isTranscribing, error };
}

export default useVoiceSTT;
