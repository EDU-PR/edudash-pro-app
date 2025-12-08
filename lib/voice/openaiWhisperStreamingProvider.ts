/**
 * OpenAI Whisper Streaming STT Provider
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
} from 'expo-audio';
import type { VoiceProvider, VoiceSession, VoiceStartOptions } from './unifiedProvider';

/**
 * DEPRECATED: This session class is a stub that throws deprecation errors.
 * Class-based Audio.Recording is not available in expo-audio SDK 53+.
 */
class OpenAIWhisperStreamingSession implements VoiceSession {
  private isRecordingActive = false;
  
  async start(_opts: VoiceStartOptions): Promise<boolean> {
    console.error(
      '[WhisperStreaming] ❌ DEPRECATED: Class-based recording is not supported with expo-audio SDK 53+.\n' +
      'Please use the useVoiceController hook or useAudioRecorder hook instead.\n' +
      'See: https://docs.expo.dev/versions/latest/sdk/audio/'
    );
    
    // Still request permissions so the error is more actionable
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (permission.status !== 'granted') {
        console.error('[WhisperStreaming] Microphone permission denied');
      }
    } catch {
      // Ignore permission errors
    }
    
    throw new Error(
      'OpenAI Whisper Streaming provider is deprecated. Use useVoiceController hook or useAudioRecorder from expo-audio.'
    );
  }
  
  async stop(): Promise<void> {
    if (!this.isRecordingActive) {
      console.log('[WhisperStreaming] No active recording to stop');
      return;
    }
    this.isRecordingActive = false;
    console.warn('[WhisperStreaming] stop() called on deprecated provider');
  }
  
  isActive(): boolean {
    return this.isRecordingActive;
  }
  
  isConnected(): boolean {
    return this.isRecordingActive;
  }
  
  setMuted(_muted: boolean): void {
    console.warn('[WhisperStreaming] setMuted() called on deprecated provider (no-op)');
  }
  
  updateConfig(_cfg: { language?: string }): void {
    console.warn('[WhisperStreaming] updateConfig() called on deprecated provider (no-op)');
  }
}

/**
 * OpenAI Whisper Streaming STT Provider
 * 
 * DEPRECATED: Returns false for isAvailable() to prevent usage.
 */
export const openaiWhisperStreamingProvider: VoiceProvider = {
  id: 'openai-whisper-streaming' as any,
  
  async isAvailable(): Promise<boolean> {
    // Always return false - this provider is deprecated
    console.warn(
      '[WhisperStreaming] ⚠️ OpenAI Whisper Streaming provider is deprecated and unavailable.\n' +
      'Use useAudioRecorder from expo-audio for recording functionality.'
    );
    return false;
  },
  
  createSession(): VoiceSession {
    return new OpenAIWhisperStreamingSession();
  },
};
