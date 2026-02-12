/**
 * useVoiceTTS Hook
 * 
 * Handles Text-to-Speech with Azure TTS (primary) and device fallback.
 * Uses natural-sounding Azure voices with expo-speech as backup.
 * 
 * @module components/super-admin/voice-orb/useVoiceTTS
 */

import { useCallback, useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { assertSupabase } from '../../../lib/supabase';
import { SupportedLanguage } from './useVoiceSTT';
import { normalizeForTTS } from '@/lib/dash-ai/ttsNormalize';
import { shouldUsePhonicsMode } from '@/lib/dash-ai/phonicsDetection';

export interface TTSOptions {
  voice?: string;
  rate?: number;
  pitch?: number;
  phonicsMode?: boolean;
}

export interface UseVoiceTTSReturn {
  speak: (text: string, language?: SupportedLanguage, options?: TTSOptions) => Promise<void>;
  stop: () => Promise<void>;
  isSpeaking: boolean;
  error: string | null;
}

const DEFAULT_AZURE_RATE = 0;
/** Slower rate for phonics — children need time to hear each sound clearly */
const DEFAULT_PHONICS_AZURE_RATE = -15;
const DEFAULT_DEVICE_RATE = 1.0;
const DEFAULT_PHONICS_DEVICE_RATE = 0.85;
const ALLOW_DEVICE_FALLBACK_IN_PHONICS =
  process.env.EXPO_PUBLIC_ALLOW_DEVICE_FALLBACK_IN_PHONICS === 'true';

const DEVICE_PHONICS_SOUND_MAP: Record<string, string> = {
  a: 'ah',
  b: 'buh',
  c: 'kuh',
  d: 'duh',
  e: 'eh',
  f: 'fff',
  g: 'guh',
  h: 'hhh',
  i: 'ih',
  j: 'juh',
  k: 'kuh',
  l: 'lll',
  m: 'mmm',
  n: 'nnn',
  o: 'aw',
  p: 'puh',
  q: 'kuh',
  r: 'rrr',
  s: 'sss',
  t: 'tuh',
  u: 'uh',
  v: 'vvv',
  w: 'wuh',
  x: 'ks',
  y: 'yuh',
  z: 'zzz',
};

export type TTSErrorCategory =
  | 'auth_missing'
  | 'service_unconfigured'
  | 'phonics_requires_azure'
  | 'network_error'
  | 'playback_error'
  | 'unknown';

const mapToDeviceLocale = (language: string): string => {
  const normalized = (language || 'en-ZA').toLowerCase();
  if (normalized.startsWith('af')) return 'af-ZA';
  if (normalized.startsWith('zu')) return 'zu-ZA';
  if (normalized.startsWith('en')) return 'en-ZA';
  return 'en-ZA';
};

const prepareDevicePhonicsText = (text: string): string => {
  let next = String(text || '');
  // /s/ -> sss, /m/ -> mmm, etc.
  next = next.replace(/\/([a-z])\//gi, (_m, letter: string) => {
    const key = String(letter || '').toLowerCase();
    return DEVICE_PHONICS_SOUND_MAP[key] || key;
  });
  // [s] -> sss
  next = next.replace(/\[([a-z])\]/gi, (_m, letter: string) => {
    const key = String(letter || '').toLowerCase();
    return DEVICE_PHONICS_SOUND_MAP[key] || key;
  });
  // c-a-t -> kuh ... ah ... tuh (so device TTS doesn't read punctuation oddly)
  next = next.replace(/\b([a-z](?:-[a-z]){1,7})\b/gi, (token) => {
    const letters = token.split('-').map((v) => v.trim().toLowerCase()).filter(Boolean);
    if (letters.some((v) => v.length !== 1)) return token;
    return letters.map((l) => DEVICE_PHONICS_SOUND_MAP[l] || l).join(' ... ');
  });
  return next;
};

export const categorizeTTSError = (error: unknown): TTSErrorCategory => {
  const message = error instanceof Error ? error.message : String(error || '');
  const normalized = message.toLowerCase();

  if (
    normalized.includes('auth_missing') ||
    normalized.includes('no session') ||
    normalized.includes('401') ||
    normalized.includes('403')
  ) {
    return 'auth_missing';
  }

  if (
    normalized.includes('phonics_requires_azure') ||
    normalized.includes('phonics mode requires azure') ||
    normalized.includes('phonics_needs_azure')
  ) {
    return 'phonics_requires_azure';
  }

  if (
    normalized.includes('service_unconfigured') ||
    normalized.includes('tts unavailable') ||
    normalized.includes('supabase_url') ||
    normalized.includes('fallback') ||
    normalized.includes('not configured')
  ) {
    return 'service_unconfigured';
  }

  if (
    normalized.includes('audio_player') ||
    normalized.includes('playback') ||
    normalized.includes('device_tts_failed')
  ) {
    return 'playback_error';
  }

  if (
    normalized.includes('network') ||
    normalized.includes('fetch') ||
    normalized.includes('timeout') ||
    normalized.includes('econn') ||
    normalized.includes('enotfound')
  ) {
    return 'network_error';
  }

  return 'unknown';
};

export const getTTSErrorMessage = (category: TTSErrorCategory): string => {
  switch (category) {
    case 'auth_missing':
      return 'Voice needs an active login session.';
    case 'phonics_requires_azure':
      return 'Phonics voice needs cloud TTS. Please check connection and retry.';
    case 'service_unconfigured':
      return 'Voice service is unavailable. Using device voice.';
    case 'network_error':
      return 'Network issue detected. Using device voice.';
    case 'playback_error':
      return 'Audio playback failed. Using device voice.';
    default:
      return 'Voice is temporarily unavailable.';
  }
};

export function useVoiceTTS(): UseVoiceTTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const stopRequestedRef = useRef(false);
  const reportedErrorCategoriesRef = useRef<Set<TTSErrorCategory>>(new Set());
  const playbackIdRef = useRef(0);
  const playbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioModeConfiguredRef = useRef(false);

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

  const reportTTSError = useCallback((reason: unknown) => {
    const category = categorizeTTSError(reason);
    if (reportedErrorCategoriesRef.current.has(category)) {
      return category;
    }
    reportedErrorCategoriesRef.current.add(category);
    setError(getTTSErrorMessage(category));
    return category;
  }, []);

  const estimatePlaybackTimeoutMs = useCallback((text: string): number => {
    const length = (text || '').length;
    // Conservative estimate for slower voices; clamp to avoid unbounded waits.
    const estimated = length * 120;
    return Math.min(120000, Math.max(20000, estimated));
  }, []);

  const playAudioUrl = useCallback((audioUrl: string, timeoutMs: number): Promise<void> => {
    return new Promise<void>(async (resolve, reject) => {
      // Configure audio mode on first use (ensures playback works on Android)
      if (!audioModeConfiguredRef.current) {
        try {
          await setAudioModeAsync({
            playsInSilentMode: true,
            shouldPlayInBackground: false,
            interruptionMode: 'duckOthers',
          });
          audioModeConfiguredRef.current = true;
        } catch (modeErr) {
          console.warn('[VoiceTTS] Audio mode config failed (non-fatal):', modeErr);
        }
      }

      let settled = false;
      let hasStarted = false;
      let stallTicks = 0;
      let endConfidenceTicks = 0;
      let lastPositionMs = 0;
      let lastSnapshot = { durationMs: 0, positionMs: 0, playing: false };
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
        let durationMs = 0;
        let positionMs = 0;
        try {
          playing = player.playing;
          durationMs = (player.duration || 0) * 1000;
          positionMs = (player.currentTime || 0) * 1000;
          lastSnapshot = { durationMs, positionMs, playing };
        } catch (err) {
          console.warn('[VoiceTTS] Playback status error, stopping:', err);
          finalize(new Error('AUDIO_PLAYER_STATUS_ERROR'));
          return;
        }
        if (playing) {
          hasStarted = true;
          stallTicks = 0;
          endConfidenceTicks = 0;
          if (positionMs > lastPositionMs) {
            lastPositionMs = positionMs;
          }
          return;
        }
        if (!hasStarted) {
          return;
        }

        const hasProgressed = positionMs > lastPositionMs + 20;
        if (hasProgressed) {
          lastPositionMs = positionMs;
          stallTicks = 0;
        } else {
          stallTicks += 1;
        }

        const reachedEnd = durationMs > 0 && positionMs >= Math.max(durationMs - 180, 0);
        if (reachedEnd) {
          endConfidenceTicks += 1;
          if (endConfidenceTicks >= 2) {
            finalize();
          }
          return;
        }

        const nearEndStall = durationMs > 0 && positionMs >= durationMs * 0.95 && stallTicks >= 6;
        if (nearEndStall) {
          finalize();
        }
      }, 150);

      playbackTimeoutRef.current = setTimeout(() => {
        if (!hasStarted) {
          finalize(new Error('AUDIO_PLAYBACK_TIMEOUT'));
          return;
        }
        if (lastSnapshot.playing) {
          finalize(new Error('AUDIO_PLAYBACK_TIMEOUT'));
          return;
        }
        const unfinished = lastSnapshot.durationMs > 0 && lastSnapshot.positionMs < lastSnapshot.durationMs * 0.8;
        if (unfinished) {
          finalize(new Error('AUDIO_PLAYBACK_STALL'));
          return;
        }
        finalize();
      }, timeoutMs);
    });
  }, [clearPlaybackTimers, cleanupPlayer]);

  const speakWithDeviceTTS = useCallback(async (
    text: string,
    language: string,
    options: TTSOptions = {}
  ): Promise<void> => {
    const locale = mapToDeviceLocale(language);
    const phonicsMode = options.phonicsMode === true;
    const safeRate = Number(options.rate);
    const effectiveRate = Number.isFinite(safeRate)
      ? Math.max(0.5, Math.min(safeRate, 2.0))
      : (phonicsMode ? DEFAULT_PHONICS_DEVICE_RATE : DEFAULT_DEVICE_RATE);
    const safePitch = Number(options.pitch);
    const effectivePitch = Number.isFinite(safePitch)
      ? Math.max(0.5, Math.min(safePitch, 2.0))
      : 1.0;
    const spokenText = phonicsMode ? prepareDevicePhonicsText(text) : text;
    await stopPlayback();
    // Delay after Speech.stop() to prevent Android race condition where
    // an immediate Speech.speak() call is silently ignored.
    if (Platform.OS === 'android') {
      await new Promise(r => setTimeout(r, 350));
    }
    await new Promise<void>((resolve, reject) => {
      // Safety timeout: if neither onDone nor onError fires within 30s, resolve
      const safetyTimer = setTimeout(() => {
        console.warn('[VoiceTTS] Device TTS safety timeout — resolving');
        resolve();
      }, 30000);

      Speech.speak(spokenText, {
        language: locale,
        rate: effectiveRate,
        pitch: effectivePitch,
        onDone: () => { clearTimeout(safetyTimer); resolve(); },
        onStopped: () => { clearTimeout(safetyTimer); resolve(); },
        onError: (err) => {
          clearTimeout(safetyTimer);
          reject(err instanceof Error ? err : new Error('DEVICE_TTS_FAILED'));
        },
      });
    });
  }, [stopPlayback]);

  /**
   * Speak using Azure TTS (primary method)
   */
  const speakWithAzure = useCallback(async (
    cleanText: string,
    language: SupportedLanguage,
    options: TTSOptions = {}
  ): Promise<void> => {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('SERVICE_UNCONFIGURED_SUPABASE_URL');
    }

    const supabase = assertSupabase();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('AUTH_MISSING');
    }

    const langCode = language.split('-')[0] as 'en' | 'af' | 'zu';
    const endpoint = `${supabaseUrl}/functions/v1/tts-proxy`;

    const phonicsMode = options.phonicsMode === true;
    const effectiveRate = Number.isFinite(options.rate as number)
      ? Number(options.rate)
      : (phonicsMode ? DEFAULT_PHONICS_AZURE_RATE : DEFAULT_AZURE_RATE);
    const effectivePitch = Number.isFinite(options.pitch as number) ? Number(options.pitch) : 0;

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          text: cleanText,
          lang: langCode,
          rate: effectiveRate,
          pitch: effectivePitch,
          style: 'friendly',
          phonics_mode: phonicsMode,
          format: 'mp3',
        }),
      });
    } catch (networkError) {
      throw new Error(`NETWORK_ERROR:${networkError instanceof Error ? networkError.message : String(networkError)}`);
    }

    if (!response.ok) {
      const status = response.status;
      const requestId =
        response.headers.get('sb-request-id') ||
        response.headers.get('x-sb-request-id') ||
        '';
      let backendDetails = '';
      try {
        const bodyText = await response.text();
        if (bodyText) {
          try {
            const payload = JSON.parse(bodyText) as {
              error?: string;
              details?: string;
              provider?: string;
              fallback?: string;
            };
            backendDetails = [
              payload.error || '',
              payload.details || '',
              payload.provider ? `provider=${payload.provider}` : '',
              payload.fallback ? `fallback=${payload.fallback}` : '',
            ]
              .filter(Boolean)
              .join(' | ');
          } catch {
            backendDetails = bodyText.slice(0, 260);
          }
        }
      } catch {
        // ignore body parsing errors
      }
      const diagnostic = [requestId ? `req=${requestId}` : '', backendDetails ? `details=${backendDetails}` : '']
        .filter(Boolean)
        .join(' | ');

      if (status === 401 || status === 403) {
        throw new Error(`AUTH_MISSING_${status}${diagnostic ? `:${diagnostic}` : ''}`);
      }
      if (status >= 500 || status === 404 || status === 422) {
        throw new Error(`SERVICE_UNCONFIGURED_${status}${diagnostic ? `:${diagnostic}` : ''}`);
      }
      throw new Error(`NETWORK_ERROR_STATUS_${status}${diagnostic ? `:${diagnostic}` : ''}`);
    }

    const data = await response.json();
    if (data?.fallback === 'device') {
      throw new Error('SERVICE_UNCONFIGURED_DEVICE_FALLBACK');
    }

    if (!data?.audio_url) {
      throw new Error('SERVICE_UNCONFIGURED_NO_AUDIO_URL');
    }

    try {
      const timeoutMs = estimatePlaybackTimeoutMs(cleanText);
      await playAudioUrl(data.audio_url, timeoutMs);
    } catch (playbackError) {
      throw new Error(`PLAYBACK_ERROR:${playbackError instanceof Error ? playbackError.message : String(playbackError)}`);
    }
  }, [playAudioUrl, estimatePlaybackTimeoutMs]);

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

  const speak = useCallback(async (
    text: string,
    language: SupportedLanguage = 'en-ZA',
    options: TTSOptions = {}
  ) => {
    stopRequestedRef.current = false;
    setIsSpeaking(true);
    setError(null);
    // Reset error dedup each invocation so persistent failures aren't silenced
    reportedErrorCategoriesRef.current.clear();
    
    try {
      // Stop any current playback without cancelling this session
      await stopPlayback();
      
      // Azure supports en/af/zu in this client path; device fallback will cover the rest.
      const SUPPORTED_TTS_LANGS = ['en', 'af', 'zu'];
      const baseLang = language.split('-')[0];
      const phonicsMode = typeof options.phonicsMode === 'boolean'
        ? options.phonicsMode
        : shouldUsePhonicsMode(text);
      
      if (!SUPPORTED_TTS_LANGS.includes(baseLang)) {
        console.warn(`[VoiceTTS] Language ${language} not supported by Azure path. Falling back to device TTS.`);
        const fallbackRate = phonicsMode ? DEFAULT_PHONICS_DEVICE_RATE : DEFAULT_DEVICE_RATE;
        await speakWithDeviceTTS(text, language, {
          ...options,
          phonicsMode,
          rate: Number.isFinite(options.rate as number) ? Number(options.rate) : fallbackRate,
        });
        return;
      }
      
      const effectiveLanguage: SupportedLanguage = language;
      const cleanText = normalizeForTTS(text, {
        phonicsMode,
        preservePhonicsMarkers: phonicsMode,
      });
      
      if (!cleanText) {
        console.log('[VoiceTTS] No text to speak');
        setIsSpeaking(false);
        return;
      }
      
      console.log('[VoiceTTS] Speaking text, length:', cleanText.length);
      const chunks = splitIntoChunks(cleanText, phonicsMode ? 800 : 1200);
      
      // Speak chunks sequentially so speech never cuts off mid-sentence
      let anyChunkSucceeded = false;
      let lastErr: Error | null = null;

      for (const chunk of chunks) {
        if (stopRequestedRef.current) break;
        try {
          await speakWithAzure(chunk, effectiveLanguage, {
            ...options,
            phonicsMode,
          });
          anyChunkSucceeded = true;
        } catch (azureErr) {
          if (phonicsMode && !ALLOW_DEVICE_FALLBACK_IN_PHONICS) {
            const phonicsErr = azureErr instanceof Error
              ? new Error(`PHONICS_REQUIRES_AZURE:${azureErr.message}`)
              : new Error('PHONICS_REQUIRES_AZURE');
            console.warn('[VoiceTTS] Azure chunk failed in phonics mode; device fallback disabled:', azureErr);
            reportTTSError(phonicsErr);
            lastErr = phonicsErr;
            break;
          }

          console.warn('[VoiceTTS] Azure chunk failed; trying device fallback:', azureErr);
          reportTTSError(azureErr);
          try {
            const fallbackRate = phonicsMode ? DEFAULT_PHONICS_DEVICE_RATE : DEFAULT_DEVICE_RATE;
            await speakWithDeviceTTS(chunk, effectiveLanguage, {
              ...options,
              phonicsMode,
              rate: Number.isFinite(options.rate as number) ? Number(options.rate) : fallbackRate,
            });
            anyChunkSucceeded = true;
          } catch (deviceErr) {
            console.warn('[VoiceTTS] Device fallback also failed:', deviceErr);
            reportTTSError(deviceErr);
            lastErr = deviceErr instanceof Error ? deviceErr : new Error(String(deviceErr));
            // Continue — partial speech is better than none
          }
        }
      }

      // If no chunks played, rethrow so the caller can show a user-facing message
      if (!anyChunkSucceeded && lastErr) {
        throw lastErr;
      }
      
    } catch (err) {
      console.error('[VoiceTTS] Error:', err);
      reportTTSError(err);
    } finally {
      setIsSpeaking(false);
    }
  }, [stopPlayback, speakWithAzure, speakWithDeviceTTS, reportTTSError]);

  return { speak, stop, isSpeaking, error };
}

export default useVoiceTTS;
