/**
 * useDashVoice Hook
 * 
 * Manages voice input/output for Dash AI.
 * Handles recording, transcription, TTS, and voice budget tracking.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { getSingleUseVoiceProvider, type VoiceSession, type VoiceProvider } from '@/lib/voice/unifiedProvider';
import { formatTranscript } from '@/lib/voice/formatTranscript';
import { loadVoiceBudget, trackVoiceUsage, hasVoiceBudget as checkVoiceBudget, formatTimeRemaining } from '@/lib/dash-ai/voiceBudget';
import type { DashMessage } from '@/services/dash-ai/types';
import type { IDashAIAssistant } from '@/services/dash-ai/DashAICompat';
import * as Haptics from 'expo-haptics';

export interface UseDashVoiceOptions {
  voiceEnabled: boolean;
  dashInstance: IDashAIAssistant | null;
  isFreeTier: boolean;
  profile?: any;
}

export interface UseDashVoiceReturn {
  // State
  isRecording: boolean;
  partialTranscript: string;
  isSpeaking: boolean;
  speakingMessageId: string | null;
  voiceBudgetRemainingMs: number | null;
  
  // Actions
  startVoiceInput: () => Promise<void>;
  stopVoiceInput: () => Promise<void>;
  speakResponse: (message: DashMessage) => Promise<void>;
  stopSpeaking: () => Promise<void>;
  hasVoiceAccess: () => boolean;
}

export function useDashVoice(options: UseDashVoiceOptions): UseDashVoiceReturn {
  const { voiceEnabled, dashInstance, isFreeTier, profile } = options;
  
  const [isRecording, setIsRecording] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [voiceBudgetRemainingMs, setVoiceBudgetRemainingMs] = useState<number | null>(null);
  
  const voiceSessionRef = useRef<VoiceSession | null>(null);
  const voiceProviderRef = useRef<VoiceProvider | null>(null);
  const voiceInputStartAtRef = useRef<number | null>(null);

  // Load voice budget on mount
  const refreshVoiceBudget = useCallback(async () => {
    if (!isFreeTier) {
      setVoiceBudgetRemainingMs(null);
      return;
    }
    const budget = await loadVoiceBudget();
    setVoiceBudgetRemainingMs(budget.remainingMs);
  }, [isFreeTier]);

  useEffect(() => {
    refreshVoiceBudget();
  }, [refreshVoiceBudget]);

  // Check if user has voice access
  const hasVoiceAccess = useCallback((): boolean => {
    if (!voiceEnabled) return false;
    if (!isFreeTier) return true; // Paid tiers have unlimited
    if (process.env.NODE_ENV === 'development') return true; // Dev mode bypass
    return (voiceBudgetRemainingMs ?? 0) > 1000; // Need at least 1 second
  }, [voiceEnabled, isFreeTier, voiceBudgetRemainingMs]);

  // Start voice input
  const startVoiceInput = useCallback(async () => {
    if (isRecording) return;
    
    if (!hasVoiceAccess()) {
      if (!voiceEnabled) {
        console.log('[Voice] Voice input disabled in settings');
      } else if (isFreeTier && (voiceBudgetRemainingMs ?? 0) <= 0) {
        console.log('[Voice] Free tier voice budget exhausted');
      }
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const provider = await getSingleUseVoiceProvider('en-ZA');

      voiceProviderRef.current = provider;
      voiceInputStartAtRef.current = Date.now();

      const session = provider.createSession();
      await session.start({
        language: 'en-ZA',
        onPartial: (text) => {
          setPartialTranscript(text || '');
        },
        onFinal: async (text) => {
          setIsRecording(false);
          const formatted = formatTranscript(text || '');
          setPartialTranscript(formatted);
          
          // Track usage for free tier
          if (isFreeTier && voiceInputStartAtRef.current) {
            const durationMs = Date.now() - voiceInputStartAtRef.current;
            await trackVoiceUsage(durationMs);
            await refreshVoiceBudget();
          }
          
          voiceSessionRef.current = null;
          voiceInputStartAtRef.current = null;
        },
        onError: (error) => {
          console.error('[Voice] Error:', error);
          setIsRecording(false);
          setPartialTranscript('');
          voiceSessionRef.current = null;
        },
      });

      voiceSessionRef.current = session;
      setIsRecording(true);
      setPartialTranscript('');
      
    } catch (error) {
      console.error('[Voice] Failed to start:', error);
      setIsRecording(false);
      voiceSessionRef.current = null;
    }
  }, [isRecording, hasVoiceAccess, voiceEnabled, isFreeTier, voiceBudgetRemainingMs, refreshVoiceBudget]);

  // Stop voice input
  const stopVoiceInput = useCallback(async () => {
    if (!voiceSessionRef.current) return;
    
    try {
      await voiceSessionRef.current.stop();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('[Voice] Failed to stop:', error);
    }
    
    setIsRecording(false);
  }, []);

  // Speak AI response
  const speakResponse = useCallback(async (message: DashMessage) => {
    if (!voiceEnabled || !dashInstance) return;
    if (!message.content) return;
    
    try {
      setIsSpeaking(true);
      setSpeakingMessageId(message.id);
      
      await dashInstance.speakResponse(
        message,
        {
          onStart: () => {
            console.log('[TTS] Started speaking');
          },
          onDone: () => {
            console.log('[TTS] Finished speaking');
            setIsSpeaking(false);
            setSpeakingMessageId(null);
          },
          onError: (error) => {
            console.error('[TTS] Error:', error);
            setIsSpeaking(false);
            setSpeakingMessageId(null);
          },
        }
      );
    } catch (error) {
      console.error('[TTS] Failed to speak:', error);
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    }
  }, [voiceEnabled, dashInstance]);

  // Stop speaking
  const stopSpeaking = useCallback(async () => {
    if (!dashInstance) return;
    
    try {
      await dashInstance.stopSpeaking();
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    } catch (error) {
      console.error('[TTS] Failed to stop:', error);
    }
  }, [dashInstance]);

  return {
    isRecording,
    partialTranscript,
    isSpeaking,
    speakingMessageId,
    voiceBudgetRemainingMs,
    startVoiceInput,
    stopVoiceInput,
    speakResponse,
    stopSpeaking,
    hasVoiceAccess,
  };
}
