/**
 * useKidVoice — Vibrant Child Voice Hook for Preschool Activities
 *
 * Playground voice strategy:
 * - Cloud Dash TTS for natural voice when allowed
 * - Freemium preview: first 3 activities/month use cloud, then device fallback
 * - Paid tiers: cloud voice for all activities
 * - Timeout protection + queued speech to avoid freezes
 *
 * Maintains kid-friendly delivery rate/pitch and encouragement phrases.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/lib/logger';
import { hasVoiceBudget, trackVoiceUsage } from '@/lib/dash-ai/voiceBudget';
import { getCapabilityTier } from '@/lib/tiers';
import { DashVoiceController } from '@/services/modules/DashVoiceController';
import type { DashMessage } from '@/services/dash-ai/types';

/** Random encouragement Dash says between rounds */
const ENCOURAGEMENTS = [
  "You're doing amazing!", "Wow, so clever!", "Super work! Keep going!",
  "Brilliant!", "You're a superstar!", "Way to go, friend!",
  "That was awesome!", "High five!", "You make Dash so proud!",
  "Look at you go!", "Incredible!", "What a champ!",
];

interface UseKidVoiceOptions {
  tier?: string | null;
  language?: string;
  rate?: number;
  pitch?: number;
}

interface VoiceSessionResult {
  useCloudVoice: boolean;
  remainingCloudActivities: number;
  didSwitchToDevice: boolean;
}

interface UseKidVoiceReturn {
  speak: (text: string) => Promise<void>;
  stop: () => void;
  isSpeaking: boolean;
  hasBudget: boolean;
  isUsingCloudVoice: boolean;
  remainingCloudActivities: number;
  beginActivitySession: (activitySessionId: string) => Promise<VoiceSessionResult>;
  speakIntro: (intro: string) => Promise<void>;
  speakCelebration: (text: string) => Promise<void>;
  /** Speak a random encouragement phrase */
  speakEncouragement: () => Promise<void>;
}

/** Strip emojis, markdown, and special chars for clean TTS */
const cleanForSpeech = (text: string): string =>
  text
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/[\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}]/gu, '')
    .replace(/[*_#`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Race a promise against a timeout — never hang */
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T | void> =>
  Promise.race([promise, new Promise<void>((r) => setTimeout(r, ms))]);

const FREEMIUM_CLOUD_ACTIVITY_LIMIT = 3;
const FREEMIUM_ACTIVITY_USAGE_KEY_PREFIX = '@dash_playground_cloud_voice_usage_';
const QUICK_COUNT_WORD_RE = /^(one|two|three|four|five|six|seven|eight|nine|ten)[!.]?$/i;
const QUICK_PROMPT_HINTS = [
  'tap each one',
  'great counting',
  'next round',
  'well done',
  'you counted',
];

const getMonthKey = (): string => {
  const date = new Date();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
};

const getFreemiumUsageStorageKey = (): string =>
  `${FREEMIUM_ACTIVITY_USAGE_KEY_PREFIX}${getMonthKey()}`;

const isLatencyCriticalUtterance = (text: string): boolean => {
  const cleaned = cleanForSpeech(text).toLowerCase();
  if (!cleaned) return false;
  if (QUICK_COUNT_WORD_RE.test(cleaned)) return true;
  if (cleaned.length <= 40) return true;
  const words = cleaned.split(' ').filter(Boolean);
  if (words.length <= 6) return true;
  return QUICK_PROMPT_HINTS.some((hint) => cleaned.includes(hint));
};

const loadFreemiumCloudUsage = async (): Promise<string[]> => {
  try {
    const raw = await AsyncStorage.getItem(getFreemiumUsageStorageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === 'string' && value.length > 0);
  } catch {
    return [];
  }
};

const saveFreemiumCloudUsage = async (activityIds: string[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(getFreemiumUsageStorageKey(), JSON.stringify(activityIds.slice(0, 50)));
  } catch {
    // Non-fatal. Voice should still work.
  }
};

export function useKidVoice(options: UseKidVoiceOptions = {}): UseKidVoiceReturn {
  const {
    tier,
    language = 'en-ZA',
    rate = 1.08,   // Slightly faster for playground pacing and attention
    pitch = 1.15,  // Playful warmth — like a fun teacher
  } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasBudget, setHasBudget] = useState(true);
  const [remainingCloudActivities, setRemainingCloudActivities] = useState(FREEMIUM_CLOUD_ACTIVITY_LIMIT);
  const [isUsingCloudVoice, setIsUsingCloudVoice] = useState(true);
  const speechQueue = useRef<string[]>([]);
  const isProcessing = useRef(false);
  const mounted = useRef(true);
  const cloudEnabledForCurrentSessionRef = useRef(true);
  const firstSpeechInSessionRef = useRef(true);
  const voiceControllerRef = useRef<DashVoiceController | null>(null);

  const capabilityTier = useMemo(() => getCapabilityTier(String(tier || 'free')), [tier]);
  const isFreemiumTier = capabilityTier === 'free';

  useEffect(() => {
    mounted.current = true;
    if (Speech && typeof Speech.getAvailableVoicesAsync === 'function') {
      void Speech.getAvailableVoicesAsync().catch(() => {});
    }
    return () => {
      mounted.current = false;
      if (voiceControllerRef.current) {
        void voiceControllerRef.current.stopSpeaking().catch(() => {});
      }
    };
  }, []);

  const checkBudget = useCallback(async () => {
    try {
      const available = await hasVoiceBudget();
      if (mounted.current) setHasBudget(available);
      return available;
    } catch {
      return true; // Default to available — never block the child
    }
  }, []);

  useEffect(() => { checkBudget(); }, [checkBudget]);

  const speakWithDevice = useCallback(async (cleaned: string) => {
    const safeLocale = (language || 'en-ZA').trim() || 'en-ZA';
    await withTimeout(
      new Promise<void>((resolve) => {
        Speech.speak(cleaned, {
          language: safeLocale, rate, pitch,
          onDone: resolve,
          onError: () => resolve(),
          onStopped: resolve,
        });
      }),
      12000,
    );
  }, [language, rate, pitch]);

  const speakWithCloud = useCallback(async (cleaned: string) => {
    if (!voiceControllerRef.current) {
      voiceControllerRef.current = new DashVoiceController();
    }

    const message: DashMessage = {
      id: `playground-tts-${Date.now()}`,
      type: 'assistant',
      content: cleaned,
      timestamp: Date.now(),
    };

    await withTimeout(
      new Promise<void>((resolve, reject) => {
        voiceControllerRef.current!.speakResponse(
          message,
          {
            rate,
            pitch,
            language,
          },
          {
            onDone: resolve,
            onStopped: resolve,
            onError: (err) => reject(err instanceof Error ? err : new Error(String(err))),
          },
        ).catch(reject);
      }),
      12000,
    );
  }, [language, rate, pitch]);

  const refreshFreemiumRemaining = useCallback(async () => {
    if (!isFreemiumTier) {
      if (mounted.current) {
        setRemainingCloudActivities(FREEMIUM_CLOUD_ACTIVITY_LIMIT);
        setIsUsingCloudVoice(true);
      }
      return;
    }

    const usage = await loadFreemiumCloudUsage();
    if (mounted.current) {
      setRemainingCloudActivities(Math.max(FREEMIUM_CLOUD_ACTIVITY_LIMIT - usage.length, 0));
    }
  }, [isFreemiumTier]);

  const beginActivitySession = useCallback(async (activitySessionId: string): Promise<VoiceSessionResult> => {
    const previousMode = cloudEnabledForCurrentSessionRef.current;
    firstSpeechInSessionRef.current = true;

    if (!isFreemiumTier) {
      cloudEnabledForCurrentSessionRef.current = true;
      if (mounted.current) {
        setIsUsingCloudVoice(true);
        setRemainingCloudActivities(FREEMIUM_CLOUD_ACTIVITY_LIMIT);
      }
      return {
        useCloudVoice: true,
        remainingCloudActivities: FREEMIUM_CLOUD_ACTIVITY_LIMIT,
        didSwitchToDevice: false,
      };
    }

    const usage = await loadFreemiumCloudUsage();
    let updatedUsage = usage;
    const useCloudVoice = usage.length < FREEMIUM_CLOUD_ACTIVITY_LIMIT;

    if (useCloudVoice) {
      updatedUsage = [...usage, activitySessionId || `session-${Date.now()}`];
      await saveFreemiumCloudUsage(updatedUsage);
    }

    const remaining = Math.max(FREEMIUM_CLOUD_ACTIVITY_LIMIT - updatedUsage.length, 0);
    cloudEnabledForCurrentSessionRef.current = useCloudVoice;
    if (mounted.current) {
      setIsUsingCloudVoice(useCloudVoice);
      setRemainingCloudActivities(remaining);
    }

    return {
      useCloudVoice,
      remainingCloudActivities: remaining,
      didSwitchToDevice: previousMode && !useCloudVoice,
    };
  }, [isFreemiumTier]);

  const processQueue = useCallback(async () => {
    if (isProcessing.current || speechQueue.current.length === 0) return;
    isProcessing.current = true;

    while (speechQueue.current.length > 0 && mounted.current) {
      const text = speechQueue.current.shift();
      if (!text) continue;
      const cleaned = cleanForSpeech(text);
      if (!cleaned) continue;

      const estimatedMs = Math.max(1500, Math.round((cleaned.length / 12.5) * 1000));
      if (mounted.current) setIsSpeaking(true);
      const firstSpeechInSession = firstSpeechInSessionRef.current;
      if (firstSpeechInSession) {
        firstSpeechInSessionRef.current = false;
      }
      const preferDeviceForLatency = firstSpeechInSession || isLatencyCriticalUtterance(cleaned);

      try {
        if (cloudEnabledForCurrentSessionRef.current && !preferDeviceForLatency) {
          try {
            await speakWithCloud(cleaned);
          } catch (cloudError) {
            logger.warn('[KidVoice] Cloud TTS failed in Playground; falling back to device voice.', cloudError);
            await speakWithDevice(cleaned);
          }
        } else {
          await speakWithDevice(cleaned);
        }
      } catch {
        logger.warn('[KidVoice] Speech timed out, continuing');
      }

      try { await trackVoiceUsage(estimatedMs); } catch { /* non-fatal */ }
    }

    if (mounted.current) {
      setIsSpeaking(false);
      isProcessing.current = false;
    }
    checkBudget();
  }, [checkBudget, speakWithCloud, speakWithDevice]);

  const speak = useCallback(async (text: string) => {
    // Refresh budget async without blocking playback startup.
    void checkBudget();

    const prioritizeNow = isLatencyCriticalUtterance(text);
    if (prioritizeNow && (isProcessing.current || speechQueue.current.length > 0)) {
      speechQueue.current = [text];
      try { Speech.stop(); } catch { /* safe */ }
      if (voiceControllerRef.current) {
        void voiceControllerRef.current.stopSpeaking().catch(() => {});
      }
      if (!isProcessing.current) {
        void processQueue();
      }
      return;
    }

    speechQueue.current.push(text);
    void processQueue();
  }, [checkBudget, processQueue]);

  const stop = useCallback(() => {
    try { Speech.stop(); } catch { /* safe */ }
    if (voiceControllerRef.current) {
      void voiceControllerRef.current.stopSpeaking().catch(() => {});
    }
    speechQueue.current = [];
    isProcessing.current = false;
    if (mounted.current) setIsSpeaking(false);
  }, []);

  const speakIntro = useCallback(async (intro: string) => {
    await speak(intro);
  }, [speak]);

  const speakCelebration = useCallback(async (text: string) => {
    await speak(`Yay! ${text}`);
  }, [speak]);

  const speakEncouragement = useCallback(async () => {
    const phrase = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
    await speak(phrase);
  }, [speak]);

  useEffect(() => {
    void refreshFreemiumRemaining();
  }, [refreshFreemiumRemaining]);

  return {
    speak,
    stop,
    isSpeaking,
    hasBudget,
    isUsingCloudVoice,
    remainingCloudActivities,
    beginActivitySession,
    speakIntro,
    speakCelebration,
    speakEncouragement,
  };
}
