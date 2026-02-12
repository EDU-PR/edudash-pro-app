/**
 * useDashVoice Hook
 * 
 * Manages voice recording, TTS, and budget tracking for Dash AI.
 * Handles voice session lifecycle and free tier limitations.
 * 
 * Extracted from useDashAssistant.ts for WARP.md compliance (≤200 lines)
 */

import { useState, useCallback, useRef } from 'react';
import { Alert, Platform, PermissionsAndroid } from 'react-native';
import * as Haptics from 'expo-haptics';
import { getSingleUseVoiceProvider, type VoiceSession, type VoiceProvider } from '@/lib/voice/unifiedProvider';
import { formatTranscript } from '@/lib/voice/formatTranscript';
import {
  loadVoiceBudget,
  trackVoiceUsage,
  hasVoiceBudget,
  formatTimeRemaining,
  FREE_VOICE_BUDGET_MS,
} from '@/lib/dash-ai/voiceBudget';
import { logger } from '@/lib/logger';
import { DashVoiceController, type VoiceSettings } from '@/services/modules/DashVoiceController';

export interface UseDashVoiceReturn {
  // State
  isRecording: boolean;
  isSpeaking: boolean;
  speakingMessageId: string | null;
  voiceEnabled: boolean;
  autoSpeakResponses: boolean;
  voiceBudgetMs: number;
  partialTranscript: string;
  
  // Actions
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
  speak: (text: string, messageId?: string) => Promise<void>;
  stopSpeaking: () => void;
  setVoiceEnabled: (enabled: boolean) => void;
  setAutoSpeakResponses: (enabled: boolean) => void;
  
  // Budget
  checkVoiceBudget: (estimatedDurationMs?: number) => Promise<boolean>;
  refreshVoiceBudget: () => Promise<void>;
}

interface UseDashVoiceOptions {
  userId?: string;
  tier?: string;
  canUseVoice?: boolean;
  /** BCP-47 locale for STT recognition (default: 'en-ZA') */
  sttLanguage?: string;
}

export function useDashVoice(options: UseDashVoiceOptions): UseDashVoiceReturn {
  const { userId, tier, canUseVoice, sttLanguage = 'en-ZA' } = options;
  
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [autoSpeakResponses, setAutoSpeakResponses] = useState(true);
  const [voiceBudgetMs, setVoiceBudgetMs] = useState(FREE_VOICE_BUDGET_MS);
  const [partialTranscript, setPartialTranscript] = useState('');
  
  const voiceSessionRef = useRef<VoiceSession | null>(null);
  const voiceProviderRef = useRef<VoiceProvider | null>(null);
  const finalTranscriptRef = useRef<string | null>(null);
  const ttsControllerRef = useRef<DashVoiceController | null>(null);

  /** Lazy-init the TTS controller (singleton per hook instance) */
  const getTTSController = useCallback((): DashVoiceController => {
    if (!ttsControllerRef.current) {
      ttsControllerRef.current = new DashVoiceController();
    }
    return ttsControllerRef.current;
  }, []);

  /**
   * Check if user has voice budget
   */
  const checkVoiceBudget = useCallback(async (estimatedDurationMs: number = 30000): Promise<boolean> => {
    if (!userId) return false;
    
    // Paid tiers have unlimited voice
    if (tier && tier !== 'free') return true;
    
    const hasBudget = await hasVoiceBudget(estimatedDurationMs);
    if (!hasBudget) {
      const remaining = await loadVoiceBudget();
      Alert.alert(
        'Voice Budget Exceeded',
        `You have ${formatTimeRemaining(remaining.remainingMs)} of free voice time remaining today. Upgrade for unlimited voice.`,
        [
          { text: 'OK', style: 'cancel' },
          { text: 'Upgrade', onPress: () => logger.info('Voice upgrade requested') },
        ]
      );
    }
    
    return hasBudget;
  }, [userId, tier]);

  /**
   * Refresh voice budget from storage
   */
  const refreshVoiceBudget = useCallback(async () => {
    if (!userId) return;
    const budget = await loadVoiceBudget();
    setVoiceBudgetMs(budget.remainingMs);
  }, [userId]);

  /**
   * Start voice recording
   */
  const startRecording = useCallback(async () => {
    if (!voiceEnabled || !canUseVoice) {
      Alert.alert('Voice Disabled', 'Voice input is not available.');
      return;
    }
    
    // Check budget
    const hasBudget = await checkVoiceBudget(30000);
    if (!hasBudget) return;
    
    // Request permissions on Android
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'Dash AI needs access to your microphone for voice input.',
          buttonPositive: 'OK',
        }
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Permission Denied', 'Microphone permission is required for voice input.');
        return;
      }
    }
    
    try {
      const provider = await getSingleUseVoiceProvider();
      voiceProviderRef.current = provider;
      
      const session = provider.createSession();
      voiceSessionRef.current = session;
      finalTranscriptRef.current = null;
      await session.start({
        language: sttLanguage,
        onPartial: (text) => {
          if (text) setPartialTranscript(text);
        },
        onFinal: (text) => {
          finalTranscriptRef.current = text || null;
        },
        onError: (error) => {
          logger.error('[DashVoice] Recording error', { error });
        },
      });
      
      setIsRecording(true);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      
      logger.info('[DashVoice] Recording started');
    } catch (error) {
      logger.error('[DashVoice] Failed to start recording', { error });
      Alert.alert('Error', 'Failed to start voice recording. Please try again.');
    }
  }, [voiceEnabled, canUseVoice, checkVoiceBudget]);

  /**
   * Stop voice recording and get transcript
   */
  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (!voiceSessionRef.current || !voiceProviderRef.current) {
      setIsRecording(false);
      return null;
    }
    
    try {
      const startTime = Date.now();
      await voiceSessionRef.current.stop();
      const duration = Date.now() - startTime;
      
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
      // Track usage for free tier
      if (userId && tier === 'free') {
        await trackVoiceUsage(duration);
        await refreshVoiceBudget();
      }
      
      // Clean up
      voiceSessionRef.current = null;
      voiceProviderRef.current = null;
      setIsRecording(false);
      
      if (finalTranscriptRef.current) {
        const formatted = formatTranscript(finalTranscriptRef.current);
        logger.info('[DashVoice] Recording stopped', { transcript: formatted, duration });
        return formatted;
      }
      
      return null;
    } catch (error) {
      logger.error('[DashVoice] Failed to stop recording', { error });
      setIsRecording(false);
      return null;
    }
  }, [userId, tier, refreshVoiceBudget]);

  /**
   * Speak text using Azure TTS via tts-proxy Edge Function
   */
  const speak = useCallback(async (text: string, messageId?: string) => {
    if (!voiceEnabled) return;
    
    setSpeakingMessageId(messageId || null);
    setIsSpeaking(true);
    
    logger.info('[DashVoice] Speaking via Azure TTS', { messageId, textLength: text.length });
    
    try {
      const controller = getTTSController();
      // Build a minimal DashMessage for the controller
      const message = {
        id: messageId || `tts-${Date.now()}`,
        type: 'assistant' as const,
        content: text,
        timestamp: new Date(),
        metadata: {},
      };
      const voiceSettings: VoiceSettings = {
        rate: 0,
        pitch: 0,
        language: 'en',
      };
      
      await controller.speakResponse(message as any, voiceSettings, {
        onStart: () => {
          setIsSpeaking(true);
        },
        onDone: () => {
          setIsSpeaking(false);
          setSpeakingMessageId(null);
        },
        onStopped: () => {
          setIsSpeaking(false);
          setSpeakingMessageId(null);
        },
        onError: (error) => {
          logger.error('[DashVoice] TTS error', { error });
          setIsSpeaking(false);
          setSpeakingMessageId(null);
        },
      });
    } catch (error) {
      logger.error('[DashVoice] speak() failed', { error });
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    }
  }, [voiceEnabled, getTTSController]);

  /**
   * Stop TTS playback
   */
  const stopSpeaking = useCallback(() => {
    try {
      const controller = getTTSController();
      controller.stopSpeaking().catch((err) => {
        logger.error('[DashVoice] stopSpeaking failed', { error: err });
      });
    } catch {
      // Non-fatal
    }
    setIsSpeaking(false);
    setSpeakingMessageId(null);
    logger.info('[DashVoice] Speaking stopped');
  }, [getTTSController]);

  return {
    isRecording,
    isSpeaking,
    speakingMessageId,
    voiceEnabled,
    autoSpeakResponses,
    voiceBudgetMs,
    partialTranscript,
    startRecording,
    stopRecording,
    speak,
    stopSpeaking,
    setVoiceEnabled,
    setAutoSpeakResponses,
    checkVoiceBudget,
    refreshVoiceBudget,
  };
}
