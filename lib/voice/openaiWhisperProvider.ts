/**
 * OpenAI Whisper Speech-to-Text Provider
 * 
 * DEPRECATED: This provider uses class-based Audio.Recording which is not
 * available in expo-audio SDK 53+. This file now serves as a stub that
 * throws deprecation errors at runtime.
 * 
 * For new implementations, use the useVoiceController hook or useAudioRecorder
 * from expo-audio instead.
 */

import { 
  requestRecordingPermissionsAsync, 
  setAudioModeAsync,
} from 'expo-audio';
import { Platform } from 'react-native';
import type { VoiceProvider, VoiceSession, VoiceStartOptions } from './unifiedProvider';
import { normalizeLanguageCode, type SALanguageCode } from './saLanguages';

export interface WhisperSTTResult {
  text: string;
  language?: string;
  duration?: number;
  provider: 'openai-whisper';
}

/**
 * DEPRECATED: This session class is a stub that throws deprecation errors.
 * Class-based Audio.Recording is not available in expo-audio SDK 53+.
 */
class OpenAIWhisperSession implements VoiceSession {
  private isRecordingActive = false;
  
  async start(_opts: VoiceStartOptions): Promise<boolean> {
    console.error(
      '[WhisperSTT] ❌ DEPRECATED: Class-based recording is not supported with expo-audio SDK 53+.\n' +
      'Please use the useVoiceController hook or useAudioRecorder hook instead.\n' +
      'See: https://docs.expo.dev/versions/latest/sdk/audio/'
    );
    
    // Still request permissions so the error is more actionable
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (permission.status !== 'granted') {
        console.error('[WhisperSTT] Microphone permission denied');
      }
    } catch {
      // Ignore permission errors
    }
    
    throw new Error(
      'OpenAI Whisper provider is deprecated. Use useVoiceController hook or useAudioRecorder from expo-audio.'
    );
  }
  
  async stop(): Promise<void> {
    if (!this.isRecordingActive) {
      console.log('[WhisperSTT] No active recording to stop');
      return;
    }
    this.isRecordingActive = false;
    console.warn('[WhisperSTT] stop() called on deprecated provider');
  }
  
  isActive(): boolean {
    return this.isRecordingActive;
  }
  
  isConnected(): boolean {
    return this.isRecordingActive;
  }
  
  setMuted(_muted: boolean): void {
    console.warn('[WhisperSTT] setMuted() called on deprecated provider (no-op)');
  }
  
  updateConfig(_cfg: { language?: string }): void {
    console.warn('[WhisperSTT] updateConfig() called on deprecated provider (no-op)');
  }
}

/**
 * OpenAI Whisper STT Provider
 * 
 * DEPRECATED: Returns false for isAvailable() to prevent usage.
 */
export const openaiWhisperProvider: VoiceProvider = {
  id: 'openai-whisper' as any,
  
  async isAvailable(): Promise<boolean> {
    // Always return false - this provider is deprecated
    console.warn(
      '[WhisperSTT] ⚠️ OpenAI Whisper provider is deprecated and unavailable.\n' +
      'Use useAudioRecorder from expo-audio for recording functionality.'
    );
    return false;
  },
  
  createSession(): VoiceSession {
    return new OpenAIWhisperSession();
  },
};
