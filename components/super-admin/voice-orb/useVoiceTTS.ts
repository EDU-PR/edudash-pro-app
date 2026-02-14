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
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { SupportedLanguage } from './useVoiceSTT';
import { normalizeForTTS } from '@/lib/dash-ai/ttsNormalize';
import { shouldUsePhonicsMode } from '@/lib/dash-ai/phonicsDetection';
import { track } from '@/lib/analytics';
import { resolveCapabilityTier } from '@/lib/tiers/resolveEffectiveTier';
import { getFeatureFlagsSync } from '@/lib/featureFlags';
import { trackTutorVoicePreferenceApplied } from '@/lib/ai/trackingEvents';
import { getPersonality, getVoicePrefs } from '@/lib/ai/dashSettings';
import type { VoicePreference } from '@/lib/voice/types';
import {
  consumePremiumVoiceActivity,
  getVoicePolicyDecision,
} from '@/lib/dash-ai/voicePolicy';

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

/** Normal speech rate — keep at 0% for consistent pacing */
const DEFAULT_AZURE_RATE = 0;
/** Phonics rate: slower than normal, but not overly stretched */
const DEFAULT_PHONICS_AZURE_RATE = -6;
/** Device TTS: 1.0 = natural pace (matches Azure 0%) */
const DEFAULT_DEVICE_RATE = 1.0;
/** Device TTS phonics: slightly slower for clarity */
const DEFAULT_PHONICS_DEVICE_RATE = 0.96;
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
  sh: 'shhh',
  ch: 'chh',
  th: 'thh',
  ph: 'fff',
  ng: 'nnng',
};

const AZURE_VOICES_BY_LANG: Record<string, { male: string; female: string }> = {
  en: { male: 'en-ZA-LukeNeural', female: 'en-ZA-LeahNeural' },
  af: { male: 'af-ZA-AdriNeural', female: 'af-ZA-AdriNeural' },
  zu: { male: 'zu-ZA-ThandoNeural', female: 'zu-ZA-ThandoNeural' },
};

const normalizeVoiceGender = (value: unknown): 'male' | 'female' => {
  return String(value || '').toLowerCase() === 'male' ? 'male' : 'female';
};

const VOICE_ID_PATTERN = /^[a-z]{2}-[a-z]{2}-[a-z0-9-]+neural$/i;

const normalizeLanguageBase = (language: string): string =>
  String(language || 'en')
    .toLowerCase()
    .split('-')[0]
    .trim() || 'en';

const resolveLocaleDefaultVoice = (language: string, fallbackGender: 'male' | 'female'): string => {
  const base = normalizeLanguageBase(language);
  const byLang = AZURE_VOICES_BY_LANG[base];
  if (byLang) return byLang[fallbackGender];
  return AZURE_VOICES_BY_LANG.en[fallbackGender];
};

const isVoiceId = (value: unknown): boolean => {
  return typeof value === 'string' && VOICE_ID_PATTERN.test(String(value || '').trim());
};

const voiceIdMatchesLanguage = (voiceId: string, language: string): boolean => {
  const prefix = String(voiceId || '').split('-')[0]?.toLowerCase() || '';
  return prefix === normalizeLanguageBase(language);
};

type VoiceResolutionSource =
  | 'request_override'
  | 'voice_preferences'
  | 'ai_settings'
  | 'locale_default';

export interface EffectiveVoiceResolution {
  voiceId: string;
  source: VoiceResolutionSource;
  fallbackGender: 'male' | 'female';
}

export function resolveEffectiveVoiceId(input: {
  language: string;
  requestOverride?: unknown;
  preferenceVoiceId?: unknown;
  aiSettingsVoice?: unknown;
  fallbackGender?: 'male' | 'female';
}): EffectiveVoiceResolution {
  const fallbackGender = normalizeVoiceGender(input.fallbackGender);
  const localeDefault = resolveLocaleDefaultVoice(input.language, fallbackGender);
  const base = normalizeLanguageBase(input.language);

  const candidates: Array<{ value: unknown; source: VoiceResolutionSource }> = [
    { value: input.requestOverride, source: 'request_override' },
    { value: input.preferenceVoiceId, source: 'voice_preferences' },
    { value: input.aiSettingsVoice, source: 'ai_settings' },
  ];

  for (const candidate of candidates) {
    const value = String(candidate.value || '').trim();
    if (!value) continue;

    if (isVoiceId(value)) {
      if (candidate.source === 'request_override' || voiceIdMatchesLanguage(value, base)) {
        return {
          voiceId: value,
          source: candidate.source,
          fallbackGender,
        };
      }
      continue;
    }

    const lower = String(value || '').toLowerCase();
    if (lower === 'male' || lower === 'female') {
      return {
        voiceId: resolveLocaleDefaultVoice(base, normalizeVoiceGender(lower)),
        source: candidate.source,
        fallbackGender: normalizeVoiceGender(lower),
      };
    }
  }

  return {
    voiceId: localeDefault,
    source: 'locale_default',
    fallbackGender,
  };
}

const resolveAzureVoiceId = (language: string, preferredVoice?: unknown): string | undefined => {
  const resolved = resolveEffectiveVoiceId({
    language,
    requestOverride: preferredVoice,
  });
  return resolved.voiceId;
};

export type TTSErrorCategory =
  | 'quota_exhausted'
  | 'auth_missing'
  | 'throttled'
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

const clampDeviceRate = (rate: number): number => Math.max(0.5, Math.min(rate, 2.0));

/**
 * Convert incoming rate to device TTS semantics.
 * - Device expects ~0.5..2.0
 * - Azure-style percentages use -100..100 where 0 is normal
 */
const resolveDeviceRate = (rate: unknown, defaultRate: number): number => {
  const parsed = Number(rate);
  if (!Number.isFinite(parsed)) return defaultRate;

  if (parsed >= 0.5 && parsed <= 2.0) {
    return clampDeviceRate(parsed);
  }

  if (parsed >= -100 && parsed <= 100) {
    return clampDeviceRate(1 + (parsed / 100));
  }

  return defaultRate;
};

const shouldRetryAzureChunk = (error: unknown): boolean => {
  const normalized = String(error instanceof Error ? error.message : error || '').toLowerCase();
  return (
    normalized.includes('tts_throttled_429') ||
    normalized.includes('network_error_status_429') ||
    normalized.includes('service_unconfigured_502') ||
    normalized.includes('service_unconfigured_503') ||
    normalized.includes('service_unconfigured_504') ||
    normalized.includes('service_unavailable_503') ||
    normalized.includes('network_error') ||
    normalized.includes('timeout')
  );
};

const parseTTSDiagnostics = (reason: unknown) => {
  const message = String(reason instanceof Error ? reason.message : reason || '');
  const statusMatch = message.match(/(?:upstream_status|status)=(\d{3})/i);
  const requestMatch = message.match(/req=([a-z0-9-]+)/i);
  const errorCodeMatch = message.match(/error_code=([a-z0-9_:-]+)/i);

  return {
    statusCode: statusMatch ? Number(statusMatch[1]) : undefined,
    requestId: requestMatch?.[1],
    errorCode: errorCodeMatch?.[1],
    raw: message,
  };
};

const pickDeviceVoiceIdentifier = async (
  locale: string,
  preferredVoice?: unknown
): Promise<string | undefined> => {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const langBase = String(locale || 'en-ZA').split('-')[0].toLowerCase();
    const matching = voices.filter((voice) => String(voice.language || '').toLowerCase().startsWith(langBase));
    if (matching.length === 0) return undefined;

    const preferredValue = String(preferredVoice || '').trim();
    if (isVoiceId(preferredValue)) {
      const exact = matching.find((voice) =>
        String(voice.identifier || '').toLowerCase() === preferredValue.toLowerCase()
      );
      if (exact?.identifier) return exact.identifier;
    }

    const target = normalizeVoiceGender(preferredVoice);
    if (target === 'male') {
      const male = matching.find((voice) =>
        String(voice.name || '').toLowerCase().includes('male') || (voice as any)?.gender === 'male'
      );
      return male?.identifier || matching[0]?.identifier;
    }

    const female = matching.find((voice) =>
      String(voice.name || '').toLowerCase().includes('female') || (voice as any)?.gender === 'female'
    );
    return female?.identifier || matching[0]?.identifier;
  } catch {
    return undefined;
  }
};

const prepareDevicePhonicsText = (text: string): string => {
  let next = String(text || '');
  // /s/ -> sss, /sh/ -> shhh, [m] -> mmm, etc.
  next = next.replace(/\/([a-z]{1,8})\//gi, (_m, token: string) => {
    const key = String(token || '').toLowerCase();
    return DEVICE_PHONICS_SOUND_MAP[key] || key;
  });
  next = next.replace(/\[([a-z]{1,8})\]/gi, (_m, token: string) => {
    const key = String(token || '').toLowerCase();
    return DEVICE_PHONICS_SOUND_MAP[key] || key;
  });
  // c-a-t -> kuh . ah . tuh (short pause to keep pace natural for young learners)
  next = next.replace(/\b([a-z](?:-[a-z]){1,7})\b/gi, (token) => {
    const letters = token.split('-').map((v) => v.trim().toLowerCase()).filter(Boolean);
    if (letters.some((v) => v.length !== 1)) return token;
    return letters.map((l) => DEVICE_PHONICS_SOUND_MAP[l] || l).join(' . ');
  });
  // Ensure marker punctuation is never spoken literally.
  next = next.replace(/[\/[\]]/g, ' ');
  return next;
};

export const categorizeTTSError = (error: unknown): TTSErrorCategory => {
  const message = error instanceof Error ? error.message : String(error || '');
  const normalized = message.toLowerCase();

  if (
    normalized.includes('free_quota_exhausted') ||
    normalized.includes('premium voice quota')
  ) {
    return 'quota_exhausted';
  }

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
    normalized.includes('tts_throttled') ||
    normalized.includes('too many requests') ||
    normalized.includes('429')
  ) {
    return 'throttled';
  }

  if (
    normalized.includes('service_unconfigured') ||
    normalized.includes('service_unavailable') ||
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
    case 'quota_exhausted':
      return 'Premium voice limit reached. Using standard voice until reset.';
    case 'auth_missing':
      return 'Voice needs an active login session.';
    case 'throttled':
      return 'Voice is busy right now. Retrying shortly.';
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
  const { user, profile } = useAuth();
  const { tier } = useSubscription();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const stopRequestedRef = useRef(false);
  const reportedErrorCategoriesRef = useRef<Set<TTSErrorCategory>>(new Set());
  const playbackIdRef = useRef(0);
  const playbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioModeConfiguredRef = useRef(false);
  const cachedVoicePreferenceRef = useRef<VoicePreference | null | undefined>(undefined);
  const cachedAISettingsVoiceRef = useRef<string | null | undefined>(undefined);
  const lastAppliedVoiceSignatureRef = useRef<string | null>(null);

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

  const getCachedVoicePreference = useCallback(async (): Promise<VoicePreference | null> => {
    if (cachedVoicePreferenceRef.current !== undefined) {
      return cachedVoicePreferenceRef.current;
    }
    try {
      const prefs = await getVoicePrefs();
      cachedVoicePreferenceRef.current = prefs;
      return prefs;
    } catch {
      cachedVoicePreferenceRef.current = null;
      return null;
    }
  }, []);

  const getCachedAISettingsVoice = useCallback((): string | null => {
    if (cachedAISettingsVoiceRef.current !== undefined) {
      return cachedAISettingsVoiceRef.current;
    }
    try {
      const personality = getPersonality?.();
      const voiceValue = String(
        personality?.voice_settings?.voice_id ||
        personality?.voice_settings?.voice ||
        personality?.voice ||
        ''
      ).trim();
      cachedAISettingsVoiceRef.current = voiceValue || null;
      return cachedAISettingsVoiceRef.current;
    } catch {
      cachedAISettingsVoiceRef.current = null;
      return null;
    }
  }, []);

  const resolveSessionVoice = useCallback(async (
    language: string,
    requestOverride?: unknown
  ): Promise<EffectiveVoiceResolution> => {
    const flags = getFeatureFlagsSync();
    const fallbackGender = normalizeVoiceGender((profile as any)?.voice_gender || (profile as any)?.gender);

    if (!flags.dash_tutor_voice_sticky_v1) {
      return resolveEffectiveVoiceId({
        language,
        requestOverride,
        fallbackGender,
      });
    }

    const [voicePreference, aiSettingsVoice] = await Promise.all([
      getCachedVoicePreference(),
      Promise.resolve(getCachedAISettingsVoice()),
    ]);

    return resolveEffectiveVoiceId({
      language,
      requestOverride,
      preferenceVoiceId: voicePreference?.voice_id,
      aiSettingsVoice,
      fallbackGender,
    });
  }, [getCachedAISettingsVoice, getCachedVoicePreference, profile]);

  const speakWithDeviceTTS = useCallback(async (
    text: string,
    language: string,
    options: TTSOptions = {}
  ): Promise<void> => {
    const locale = mapToDeviceLocale(language);
    const phonicsMode = options.phonicsMode === true;
    const fallbackRate = phonicsMode ? DEFAULT_PHONICS_DEVICE_RATE : DEFAULT_DEVICE_RATE;
    const effectiveRate = resolveDeviceRate(options.rate, fallbackRate);
    const safePitch = Number(options.pitch);
    const effectivePitch = Number.isFinite(safePitch)
      ? Math.max(0.5, Math.min(safePitch, 2.0))
      : 1.0;
    const spokenText = phonicsMode ? prepareDevicePhonicsText(text) : text;
    const selectedVoice = await pickDeviceVoiceIdentifier(locale, options.voice);
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

      const deviceOptions: Speech.SpeechOptions = {
        language: locale,
        rate: effectiveRate,
        pitch: effectivePitch,
        onDone: () => { clearTimeout(safetyTimer); resolve(); },
        onStopped: () => { clearTimeout(safetyTimer); resolve(); },
        onError: (err) => {
          clearTimeout(safetyTimer);
          reject(err instanceof Error ? err : new Error('DEVICE_TTS_FAILED'));
        },
      };
      if (selectedVoice) {
        deviceOptions.voice = selectedVoice;
      }
      Speech.speak(spokenText, deviceOptions);
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
    const voiceId = resolveAzureVoiceId(langCode, options.voice);
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
          voice_id: voiceId,
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
              error_code?: string;
              details?: string;
              provider?: string;
              fallback?: string;
              upstream_status?: number;
            };
            backendDetails = [
              payload.error || '',
              payload.error_code ? `error_code=${payload.error_code}` : '',
              payload.details || '',
              payload.provider ? `provider=${payload.provider}` : '',
              payload.fallback ? `fallback=${payload.fallback}` : '',
              Number.isFinite(payload.upstream_status) ? `upstream_status=${payload.upstream_status}` : '',
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
      if (status === 429) {
        throw new Error(`TTS_THROTTLED_429${diagnostic ? `:${diagnostic}` : ''}`);
      }
      if (status === 503) {
        throw new Error(`SERVICE_UNAVAILABLE_503${diagnostic ? `:${diagnostic}` : ''}`);
      }
      if (status === 500) {
        throw new Error(`SERVICE_INTERNAL_500${diagnostic ? `:${diagnostic}` : ''}`);
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

      const policy = await getVoicePolicyDecision(
        {
          role: profile?.role,
          profileTier: tier,
        },
        user?.id,
      );
      let cloudAttempted = false;
      let fallbackUsed: 'none' | 'device' | 'phonics_blocked' = 'none';
      let telemetryError: unknown = null;
      
      // Azure supports en/af/zu in this client path; device fallback will cover the rest.
      const SUPPORTED_TTS_LANGS = ['en', 'af', 'zu'];
      const baseLang = language.split('-')[0];
      const phonicsMode = typeof options.phonicsMode === 'boolean'
        ? options.phonicsMode
        : shouldUsePhonicsMode(text);
      const resolvedVoice = await resolveSessionVoice(language, options.voice);
      const effectiveOptions: TTSOptions = {
        ...options,
        voice: resolvedVoice.voiceId,
        phonicsMode,
      };
      const voiceSignature = `${language}|${resolvedVoice.source}|${resolvedVoice.voiceId}`;
      if (lastAppliedVoiceSignatureRef.current !== voiceSignature) {
        lastAppliedVoiceSignatureRef.current = voiceSignature;
        trackTutorVoicePreferenceApplied({
          voiceId: resolvedVoice.voiceId,
          source: resolvedVoice.source,
          language,
          role: String(profile?.role || 'unknown'),
        });
      }
      
      if (!SUPPORTED_TTS_LANGS.includes(baseLang)) {
        console.warn(`[VoiceTTS] Language ${language} not supported by Azure path. Falling back to device TTS.`);
        fallbackUsed = 'device';
        await speakWithDeviceTTS(text, language, {
          ...effectiveOptions,
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

      if (!policy.shouldUseCloudVoice) {
        reportTTSError(new Error('FREE_QUOTA_EXHAUSTED_DEVICE_VOICE'));
        fallbackUsed = 'device';
        for (const chunk of chunks) {
          if (stopRequestedRef.current) break;
          await speakWithDeviceTTS(chunk, effectiveLanguage, {
            ...effectiveOptions,
          });
        }
        return;
      }
      
      // Speak chunks sequentially so speech never cuts off mid-sentence
      let anyChunkSucceeded = false;
      let cloudChunkSucceeded = false;
      let lastErr: Error | null = null;

      for (const chunk of chunks) {
        if (stopRequestedRef.current) break;
        try {
          cloudAttempted = true;
          await speakWithAzure(chunk, effectiveLanguage, {
            ...effectiveOptions,
          });
          anyChunkSucceeded = true;
          cloudChunkSucceeded = true;
        } catch (azureErr) {
          let effectiveAzureErr: unknown = azureErr;
          const throttleRetry = String(effectiveAzureErr instanceof Error ? effectiveAzureErr.message : effectiveAzureErr || '')
            .toLowerCase()
            .includes('tts_throttled_429');
          const maxRetries = shouldRetryAzureChunk(effectiveAzureErr)
            ? (throttleRetry ? 2 : 1)
            : 0;

          for (let retry = 0; retry < maxRetries && !stopRequestedRef.current; retry += 1) {
            const baseDelay = throttleRetry ? 420 : 280;
            const jitter = Math.floor(Math.random() * (throttleRetry ? 260 : 120));
            try {
              await new Promise((resolve) => setTimeout(resolve, baseDelay + jitter));
              cloudAttempted = true;
              await speakWithAzure(chunk, effectiveLanguage, {
                ...effectiveOptions,
              });
              anyChunkSucceeded = true;
              cloudChunkSucceeded = true;
              effectiveAzureErr = null;
              break;
            } catch (retryErr) {
              effectiveAzureErr = retryErr;
            }
          }

          if (!effectiveAzureErr) {
            continue;
          }

          if (phonicsMode && !ALLOW_DEVICE_FALLBACK_IN_PHONICS) {
            const phonicsErr = effectiveAzureErr instanceof Error
              ? new Error(`PHONICS_REQUIRES_AZURE:${effectiveAzureErr.message}`)
              : new Error('PHONICS_REQUIRES_AZURE');
            console.warn('[VoiceTTS] Azure chunk failed in phonics mode; device fallback disabled:', effectiveAzureErr);
            reportTTSError(phonicsErr);
            lastErr = phonicsErr;
            telemetryError = phonicsErr;
            fallbackUsed = 'phonics_blocked';
            break;
          }

          console.warn('[VoiceTTS] Azure chunk failed; trying device fallback:', effectiveAzureErr);
          reportTTSError(effectiveAzureErr);
          fallbackUsed = 'device';
          try {
            await speakWithDeviceTTS(chunk, effectiveLanguage, {
              ...effectiveOptions,
            });
            anyChunkSucceeded = true;
          } catch (deviceErr) {
            console.warn('[VoiceTTS] Device fallback also failed:', deviceErr);
            reportTTSError(deviceErr);
            lastErr = deviceErr instanceof Error ? deviceErr : new Error(String(deviceErr));
            telemetryError = lastErr;
            // Continue — partial speech is better than none
          }
        }
      }

      // If no chunks played, rethrow so the caller can show a user-facing message
      if (!anyChunkSucceeded && lastErr) {
        telemetryError = lastErr;
        throw lastErr;
      }

      if (!policy.isPremiumTier && cloudChunkSucceeded) {
        await consumePremiumVoiceActivity(user?.id);
      }

      const successDiagnostics = parseTTSDiagnostics(telemetryError);
      track('edudash.voice.tts_turn', {
        tier: tier || 'free',
        capability_tier: policy.capabilityTier,
        cloud_attempted: cloudAttempted,
        fallback_used: fallbackUsed,
        error_code: successDiagnostics.errorCode || null,
        upstream_status: successDiagnostics.statusCode || null,
        request_id: successDiagnostics.requestId || null,
        success: true,
      });
      
    } catch (err) {
      console.error('[VoiceTTS] Error:', err);
      reportTTSError(err);
      const diagnostics = parseTTSDiagnostics(err);
      track('edudash.voice.tts_turn', {
        tier: tier || 'free',
        capability_tier: resolveCapabilityTier(String(tier || 'free')),
        cloud_attempted: true,
        fallback_used: 'none',
        error_code: diagnostics.errorCode || null,
        upstream_status: diagnostics.statusCode || null,
        request_id: diagnostics.requestId || null,
        success: false,
      });
    } finally {
      setIsSpeaking(false);
    }
  }, [
    stopPlayback,
    speakWithAzure,
    speakWithDeviceTTS,
    reportTTSError,
    resolveSessionVoice,
    profile?.role,
    tier,
    user?.id,
  ]);

  return { speak, stop, isSpeaking, error };
}

export default useVoiceTTS;
