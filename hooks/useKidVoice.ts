/**
 * useKidVoice — Vibrant Child Voice Hook for Preschool Activities
 *
 * Wraps TTS with energetic kid-appropriate speech:
 * - Natural vibrant rate (0.95) for engagement
 * - Playful warm pitch (1.15) for friendliness
 * - Timeout protection — speech NEVER freezes
 * - Queued speech with auto-recovery
 * - Encouragement phrases between rounds
 *
 * ≤200 lines (WARP.md)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import * as Speech from 'expo-speech';
import { logger } from '@/lib/logger';
import { hasVoiceBudget, trackVoiceUsage } from '@/lib/dash-ai/voiceBudget';

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

interface UseKidVoiceReturn {
  speak: (text: string) => Promise<void>;
  stop: () => void;
  isSpeaking: boolean;
  hasBudget: boolean;
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

export function useKidVoice(options: UseKidVoiceOptions = {}): UseKidVoiceReturn {
  const {
    tier,
    language = 'en-ZA',
    rate = 0.95,   // Vibrant, natural energy — not sluggish
    pitch = 1.15,  // Playful warmth — like a fun teacher
  } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasBudget, setHasBudget] = useState(true);
  const speechQueue = useRef<string[]>([]);
  const isProcessing = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
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

      try {
        await withTimeout(
          new Promise<void>((resolve) => {
            Speech.speak(cleaned, {
              language, rate, pitch,
              onDone: resolve,
              onError: () => resolve(),   // Never hang on error
              onStopped: resolve,
            });
          }),
          12000, // 12s max per utterance — never freeze
        );
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
  }, [language, rate, pitch, checkBudget]);

  const speak = useCallback(async (text: string) => {
    try {
      const budgetOk = await checkBudget();
      if (!budgetOk) return;
    } catch { /* proceed anyway — never block */ }
    speechQueue.current.push(text);
    processQueue();
  }, [checkBudget, processQueue]);

  const stop = useCallback(() => {
    try { Speech.stop(); } catch { /* safe */ }
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

  return { speak, stop, isSpeaking, hasBudget, speakIntro, speakCelebration, speakEncouragement };
}
