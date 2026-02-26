/**
 * Voice-to-Text Transcription Hook (M14)
 *
 * Transcribes voice messages using the tts-proxy (STT mode) edge function.
 * Caches transcriptions in memory so each message is only transcribed once.
 */

import { useState, useCallback, useRef } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

interface UseVoiceTranscriptionReturn {
  transcribeVoice: (audioUrl: string) => Promise<string>;
  transcriptions: Map<string, string>;
  transcribing: Set<string>;
}

export function useVoiceTranscription(): UseVoiceTranscriptionReturn {
  const [transcriptions, setTranscriptions] = useState<Map<string, string>>(new Map());
  const [transcribing, setTranscribing] = useState<Set<string>>(new Set());
  const inflightRef = useRef<Map<string, Promise<string>>>(new Map());

  const transcribeVoice = useCallback(
    async (audioUrl: string): Promise<string> => {
      const cached = transcriptions.get(audioUrl);
      if (cached) return cached;

      const inflight = inflightRef.current.get(audioUrl);
      if (inflight) return inflight;

      const promise = (async () => {
        setTranscribing((prev) => new Set(prev).add(audioUrl));

        try {
          const client = assertSupabase();

          const { data, error } = await client.functions.invoke('tts-proxy', {
            body: {
              action: 'transcribe',
              audio_url: audioUrl,
              language: 'auto',
            },
          });

          if (error) {
            logger.warn('useVoiceTranscription', `Transcription failed: ${error.message}`);
            throw error;
          }

          const text =
            typeof data === 'string'
              ? data.trim()
              : (data?.text || data?.transcription || '').trim();

          if (!text) {
            throw new Error('Empty transcription response');
          }

          setTranscriptions((prev) => {
            const next = new Map(prev);
            next.set(audioUrl, text);
            return next;
          });

          return text;
        } catch (err) {
          logger.error('useVoiceTranscription', 'Transcription error:', err);
          const fallback = 'Transcription unavailable';
          setTranscriptions((prev) => {
            const next = new Map(prev);
            next.set(audioUrl, fallback);
            return next;
          });
          return fallback;
        } finally {
          setTranscribing((prev) => {
            const next = new Set(prev);
            next.delete(audioUrl);
            return next;
          });
          inflightRef.current.delete(audioUrl);
        }
      })();

      inflightRef.current.set(audioUrl, promise);
      return promise;
    },
    [transcriptions],
  );

  return { transcribeVoice, transcriptions, transcribing };
}
