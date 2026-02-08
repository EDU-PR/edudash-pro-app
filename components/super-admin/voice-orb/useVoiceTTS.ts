/**
 * useVoiceTTS Hook
 * 
 * Handles Text-to-Speech with Azure TTS (primary) and device fallback.
 * Uses natural-sounding Azure voices with expo-speech as backup.
 * 
 * @module components/super-admin/voice-orb/useVoiceTTS
 */

import { useCallback, useState, useEffect, useRef } from 'react';
import * as Speech from 'expo-speech';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { assertSupabase } from '../../../lib/supabase';
import { SupportedLanguage } from './useVoiceSTT';

export interface TTSOptions {
  voice?: string;
  rate?: number;
  pitch?: number;
}

export interface UseVoiceTTSReturn {
  speak: (text: string, language?: SupportedLanguage) => Promise<void>;
  stop: () => Promise<void>;
  isSpeaking: boolean;
  error: string | null;
}

const mapToDeviceLocale = (language: string): string => {
  const normalized = (language || 'en-ZA').toLowerCase();
  if (normalized.startsWith('af')) return 'af-ZA';
  if (normalized.startsWith('zu')) return 'zu-ZA';
  if (normalized.startsWith('en')) return 'en-ZA';
  return 'en-ZA';
};

export function useVoiceTTS(): UseVoiceTTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const stopRequestedRef = useRef(false);
  const playbackIdRef = useRef(0);
  const playbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPlaybackTimers = useCallback(() => {
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
  }, []);

  const cleanupPlayer = useCallback((player?: AudioPlayer | null) => {
    if (!player) return;
    try {
      player.pause();
    } catch {
      // ignore pause errors
    }
    try {
      player.release();
    } catch {
      // ignore release errors
    }
    if (playerRef.current === player) {
      playerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Speech.stop();
      clearPlaybackTimers();
      cleanupPlayer(playerRef.current);
    };
  }, [clearPlaybackTimers, cleanupPlayer]);

  const stopPlayback = useCallback(async () => {
    try {
      Speech.stop();
      playbackIdRef.current += 1; // invalidate any pending intervals
      clearPlaybackTimers();
      cleanupPlayer(playerRef.current);
    } catch (err) {
      console.error('[VoiceTTS] Error stopping playback:', err);
    }
  }, [clearPlaybackTimers, cleanupPlayer]);

  const stop = useCallback(async () => {
    stopRequestedRef.current = true;
    await stopPlayback();
    setIsSpeaking(false);
  }, [stopPlayback]);

  const playAudioUrl = useCallback((audioUrl: string, timeoutMs: number): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      let hasStarted = false;
      const playbackId = playbackIdRef.current + 1;
      playbackIdRef.current = playbackId;

      clearPlaybackTimers();
      cleanupPlayer(playerRef.current);

      const finalize = (err?: Error) => {
        if (settled) return;
        settled = true;
        clearPlaybackTimers();
        cleanupPlayer(playerRef.current);
        if (err) {
          reject(err);
          return;
        }
        resolve();
      };

      let player: AudioPlayer | null = null;
      try {
        player = createAudioPlayer(audioUrl);
        playerRef.current = player;
        player.play();
      } catch (err) {
        console.error('[VoiceTTS] Failed to start audio playback:', err);
        finalize(new Error('AUDIO_PLAYER_INIT_FAILED'));
        return;
      }

      playbackIntervalRef.current = setInterval(() => {
        if (playbackIdRef.current !== playbackId) {
          finalize();
          return;
        }
        if (!player) {
          finalize(new Error('AUDIO_PLAYER_MISSING'));
          return;
        }
        let playing = false;
        try {
          playing = player.playing;
        } catch (err) {
          console.warn('[VoiceTTS] Playback status error, stopping:', err);
          finalize(new Error('AUDIO_PLAYER_STATUS_ERROR'));
          return;
        }
        if (playing) {
          hasStarted = true;
        }
        if (hasStarted && !playing) {
          finalize();
        }
      }, 150);

      playbackTimeoutRef.current = setTimeout(() => {
        if (!hasStarted) {
          finalize(new Error('AUDIO_PLAYBACK_TIMEOUT'));
          return;
        }
        finalize();
      }, timeoutMs);
    });
  }, [clearPlaybackTimers, cleanupPlayer]);

  const speakWithDeviceTTS = useCallback(async (text: string, language: string): Promise<void> => {
    const locale = mapToDeviceLocale(language);
    await stopPlayback();
    await new Promise<void>((resolve, reject) => {
      Speech.speak(text, {
        language: locale,
        rate: 1.0,
        pitch: 1.0,
        onDone: () => resolve(),
        onStopped: () => resolve(),
        onError: (err) => {
          reject(err instanceof Error ? err : new Error('DEVICE_TTS_FAILED'));
        },
      });
    });
  }, [stopPlayback]);

  /**
   * Speak using Azure TTS (primary method)
   */
  const speakWithAzure = useCallback(async (cleanText: string, language: SupportedLanguage): Promise<void> => {
    try {
      const supabase = assertSupabase();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        console.log('[VoiceTTS] No session, Azure TTS unavailable');
        throw new Error('TTS unavailable right now');
      }

      console.log('[VoiceTTS] Calling Azure TTS via Edge Function');
      
      // Map language to short code (en-ZA -> en)
      const langCode = language.split('-')[0] as 'en' | 'af' | 'zu';
      
      console.log('[VoiceTTS] Sending TTS request:', {
        language: language,
        langCode: langCode,
        textLength: cleanText.length,
        textPreview: cleanText.substring(0, 50),
      });
      
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/tts-proxy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            text: cleanText,
            lang: langCode,
            style: 'friendly',
            format: 'mp3',
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.log('[VoiceTTS] Azure TTS failed', {
          status: response.status,
          body: errText,
        });
        throw new Error('TTS unavailable right now');
      }

      const data = await response.json();
      
      // Handle fallback instruction from server
      if (data.fallback === 'device') {
        console.log('[VoiceTTS] Server instructed device fallback (blocked)');
        throw new Error('TTS unavailable right now');
      }
      
      if (!data.audio_url) {
        console.log('[VoiceTTS] No audio URL in response');
        throw new Error('TTS unavailable right now');
      }

      console.log('[VoiceTTS] Got audio URL from', data.provider, '- playing...');
      
      // Play the audio URL directly
      await playAudioUrl(data.audio_url, 60000);
      console.log('[VoiceTTS] Azure playback finished');
      return;
      
    } catch (err) {
      console.error('[VoiceTTS] Azure TTS error:', err);
      // Only fallback to device after network/server errors, not for all errors
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('timeout')) {
        console.log('[VoiceTTS] Network error, retrying Azure once before device fallback...');
        // One retry for network issues
        try {
          const supabase = assertSupabase();
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            const langCode = language.split('-')[0] as 'en' | 'af' | 'zu';
            const retryResponse = await fetch(
              `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/tts-proxy`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ text: cleanText, lang: langCode, style: 'friendly', format: 'mp3' }),
              }
            );
            if (retryResponse.ok) {
              const retryData = await retryResponse.json();
              if (retryData.audio_url) {
                console.log('[VoiceTTS] Retry successful - playing Azure audio');
                await playAudioUrl(retryData.audio_url, 30000);
                setIsSpeaking(false);
                return;
              }
            }
          }
        } catch (retryErr) {
          console.error('[VoiceTTS] Retry failed:', retryErr);
        }
      }
      throw err instanceof Error ? err : new Error('TTS unavailable for this language');
    }
  }, [playAudioUrl]);

  const splitIntoChunks = (text: string, maxLength: number): string[] => {
    const sentences: string[] = [];
    let buffer = '';

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      buffer += char;
      if (char === '.' || char === '!' || char === '?') {
        if (buffer.trim()) {
          sentences.push(buffer.trim());
        }
        buffer = '';
      }
    }
    if (buffer.trim()) {
      sentences.push(buffer.trim());
    }
    const chunks: string[] = [];
    let current = '';

    for (const sentence of sentences) {
      if (!sentence.trim()) continue;
      if ((current + ' ' + sentence).trim().length > maxLength) {
        if (current.trim()) chunks.push(current.trim());
        current = sentence;
      } else {
        current = current ? `${current} ${sentence}` : sentence;
      }
    }

    if (current.trim()) chunks.push(current.trim());

    if (chunks.length === 0) {
      return text.length > 0 ? [text] : [];
    }

    // Hard split any oversized chunks
    const normalized: string[] = [];
    chunks.forEach((chunk) => {
      if (chunk.length <= maxLength) {
        normalized.push(chunk);
      } else {
        for (let i = 0; i < chunk.length; i += maxLength) {
          normalized.push(chunk.slice(i, i + maxLength));
        }
      }
    });

    return normalized;
  };

  const speak = useCallback(async (text: string, language: SupportedLanguage = 'en-ZA') => {
    stopRequestedRef.current = false;
    setIsSpeaking(true);
    setError(null);
    
    try {
      // Stop any current playback without cancelling this session
      await stopPlayback();
      
      // Azure supports en/af/zu in this client path; device fallback will cover the rest.
      const SUPPORTED_TTS_LANGS = ['en', 'af', 'zu'];
      const baseLang = language.split('-')[0];
      
      if (!SUPPORTED_TTS_LANGS.includes(baseLang)) {
        console.warn(`[VoiceTTS] Language ${language} not supported by Azure path. Falling back to device TTS.`);
        await speakWithDeviceTTS(text, language);
        return;
      }
      
      const effectiveLanguage: SupportedLanguage = language;
      
      // Comprehensive text cleaning for natural TTS — strip markdown,
      // emojis, icons, unicode symbols and normalise for Azure Neural.
      const cleanText = text
        // Acronym expansion for natural speech
        .replace(/EduDash Pro/gi, 'Edu Dash Pro')
        .replace(/\bAPI\b/g, 'A P I')
        .replace(/\bHTTP\b/g, 'H T T P')
        .replace(/\bJSON\b/g, 'J S O N')
        .replace(/\bSQL\b/g, 'S Q L')
        .replace(/\bRLS\b/g, 'R L S')
        .replace(/\bRBAC\b/g, 'R B A C')
        .replace(/\bSTEM\b/g, 'stem')
        .replace(/\bSTT\b/g, 'speech to text')
        .replace(/\bTTS\b/g, 'text to speech')
        .replace(/\bAI\b/g, 'A.I.')
        .replace(/\bCAPS\b/g, 'caps')
        // Normalise newlines and list bullets
        .replace(/\r\n/g, '\n')
        .replace(/^\s*[-*\u2022\u25e6\u25aa\ufe0e\u00b7]\s*/gm, '')
        .replace(/^\s*\d+[.)]\s*/gm, '')
        // Code blocks + inline code
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`[^`]+`/g, '')
        // Markdown formatting
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/`/g, '')
        .replace(/#{1,6}\s/g, '')
        .replace(/>/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // Comprehensive emoji/icon removal (unicode ranges)
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
        .replace(/[\u{2600}-\u{26FF}]/gu, '')
        .replace(/[\u{2700}-\u{27BF}]/gu, '')
        .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
        .replace(/[\u{200D}]/gu, '')
        .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '')
        .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '')
        // Bracketed meta + tool indicators
        .replace(/\[.*?\]/g, '')
        .replace(/_Tools used:.*?_/gi, '')
        .replace(/_.*?tokens used_/gi, '')
        // Quotes/brackets that TTS reads awkwardly
        .replace(/[\u201C\u201D\u201E\u00AB\u00BB\u2018\u2019]/g, '')
        .replace(/["""'']/g, '')
        .replace(/[()[\]{}<>]/g, '')
        // Status labels
        .replace(/\bCorrect answer:\s*/gi, '')
        .replace(/\bNext question:\s*/gi, '')
        .replace(/\bHint:\s*/gi, 'Hint. ')
        .replace(/^\s*User:\s*/gmi, '')
        .replace(/^\s*Assistant:\s*/gmi, '')
        // SA language names for proper TTS pronunciation
        .replace(/\bi\s*s\s*i\s+zulu\b/gi, 'isiZulu')
        .replace(/\bi\s*s\s*i\s+xhosa\b/gi, 'isiXhosa')
        .replace(/\bse\s+pedi\b/gi, 'Sepedi')
        .replace(/\bse\s+sotho\b/gi, 'Sesotho')
        // Collapse whitespace
        .replace(/\n+/g, '. ')
        .replace(/\s{2,}/g, ' ')
        .replace(/\.\s*\./g, '. ')
        .trim();
      
      if (!cleanText) {
        console.log('[VoiceTTS] No text to speak');
        setIsSpeaking(false);
        return;
      }
      
      console.log('[VoiceTTS] Speaking text, length:', cleanText.length);
      const chunks = splitIntoChunks(cleanText, 1200);
      
      // Speak chunks sequentially so speech never cuts off mid-sentence
      for (const chunk of chunks) {
        if (stopRequestedRef.current) break;
        try {
          await speakWithAzure(chunk, effectiveLanguage);
        } catch (azureErr) {
          console.warn('[VoiceTTS] Azure chunk failed; using device fallback for this chunk:', azureErr);
          await speakWithDeviceTTS(chunk, effectiveLanguage);
        }
      }
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'TTS failed';
      console.error('[VoiceTTS] Error:', message);
      setError(message);
    } finally {
      setIsSpeaking(false);
    }
  }, [stopPlayback, speakWithAzure, speakWithDeviceTTS]);

  return { speak, stop, isSpeaking, error };
}

export default useVoiceTTS;
