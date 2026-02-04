/**
 * Unified Voice Provider Abstraction
 * 
 * Provides TWO voice recognition modes:
 * 
 * 1. SINGLE-USE (mic button in chat):
 *    - MOBILE: Expo Speech Recognition (managed workflow)
 *    - WEB: Deepgram + Claude (handled in web branch)
 *    - Use getSingleUseVoiceProvider()
 * 
 * 2. STREAMING (Interactive Voice Orb):
 *    - MOBILE: Expo Speech Recognition (managed workflow)
 *    - WEB: Deepgram + Claude (handled in web branch)
 *    - Use getStreamingVoiceProvider()
 * 
 * **Production Mode**:
 * - PRIMARY: expo-speech-recognition (managed workflow compatible)
 * - If both fail, returns noop provider (text input only)
 * - No server/API costs for voice transcription
 * - Offline-capable (depends on device capabilities)
 * - SA Languages: Depends on device (most Android devices support en-ZA, af-ZA)
 */

import { createClaudeVoiceSession, type ClaudeVoiceSession } from '@/lib/voice/claudeProvider';
import { expoSpeech } from '@/lib/voice/expoProvider';
import { Platform } from 'react-native';

export type VoicePartialCb = (text: string) => void;
export type VoiceFinalCb = (text: string) => void;

export interface VoiceStartOptions {
  language?: string; // 'en' | 'af' | 'zu' | 'xh' | 'nso'
  onPartial?: VoicePartialCb;
  onFinal?: VoiceFinalCb;
  onError?: (error: string) => void;
}

export interface VoiceSession {
  start(opts: VoiceStartOptions): Promise<boolean>;
  stop(): Promise<void>;
  isActive(): boolean;
  isConnected(): boolean;  // Check if WebSocket/connection is ready
  setMuted(muted: boolean): void;
  updateConfig(cfg: { language?: string }): void;
}

export interface VoiceProvider {
  id: 'expo' | 'claude' | 'azure' | 'noop';
  isAvailable(): Promise<boolean>;
  createSession(): VoiceSession;
}

/**
 * Noop session - graceful fallback when no provider is available
 */
class NoopSession implements VoiceSession {
  async start() {
    if (__DEV__) console.warn('[UnifiedProvider] NoopSession: No voice provider available');
    return false;
  }
  async stop() {}
  isActive() { return false; }
  isConnected() { return false; }
  setMuted() {}
  updateConfig() {}
}

/**
 * Get voice provider for SINGLE-USE input (mic button in chat)
 * 
 * MOBILE: Expo Speech Recognition
 * 
 * WEB: Unchanged (handled in web branch)
 * 
 * Use this for:
 * - Mic button in chat input
 * - Simple record → transcribe → insert text flow
 * - When user will review/edit before sending
 */
export async function getSingleUseVoiceProvider(language?: string): Promise<VoiceProvider> {
  if (__DEV__) {
    console.log('[UnifiedProvider] Getting SINGLE-USE provider:', { language, platform: Platform.OS });
  }

  // MOBILE: Expo Speech Recognition
  if (Platform.OS !== 'web') {
    try {
      const expoAvailable = await expoSpeech.isAvailable();
      if (expoAvailable) {
        if (__DEV__) console.log('[UnifiedProvider] ✅ Using Expo Speech Recognition');
        return expoSpeech;
      } else {
        if (__DEV__) console.warn('[UnifiedProvider] ⚠️ Expo Speech Recognition not available');
      }
    } catch (e) {
      if (__DEV__) console.error('[UnifiedProvider] Expo Speech error:', e);
    }

    // No provider available
    if (__DEV__) console.warn('[UnifiedProvider] ⚠️ No mobile voice provider available');
    return {
      id: 'noop',
      async isAvailable() { return false; },
      createSession() { return new NoopSession(); },
    };
  }

  // WEB: Use Deepgram + Claude (unchanged, handled in web branch)
  try {
    if (__DEV__) console.log('[UnifiedProvider] ✅ Using Deepgram (web)');
    return {
      id: 'claude',
      async isAvailable() { return true; },
      createSession() {
        const sess: ClaudeVoiceSession = createClaudeVoiceSession();
        
        return {
          async start(opts: VoiceStartOptions) {
            return await sess.start({
              language: opts.language,
              onPartialTranscript: opts.onPartial,
              onFinalTranscript: opts.onFinal,
              systemPrompt: '',
            });
          },
          async stop() { await sess.stop(); },
          isActive() { return sess.isActive(); },
          isConnected() { return sess.isConnected(); },
          setMuted(m) { sess.setMuted(m); },
          updateConfig(cfg) { 
            sess.updateTranscriptionConfig({ language: cfg.language }); 
          },
        };
      },
    };
  } catch (e) {
    if (__DEV__) console.error('[UnifiedProvider] Web provider failed:', e);
    return {
      id: 'noop',
      async isAvailable() { return false; },
      createSession() { return new NoopSession(); },
    };
  }
}

/**
 * Get voice provider for STREAMING conversational mode (Interactive Orb)
 * 
 * MOBILE: Expo Speech Recognition
 * 
 * WEB: Uses Deepgram + Claude (unchanged, handled in web branch)
 * 
 * Use this for:
 * - Interactive Voice Mode (long-press FAB)
 * - Real-time streaming conversations
 * - When Dash needs to respond with voice
 * - Continuous listening with interruptions
 */
export async function getStreamingVoiceProvider(language?: string): Promise<VoiceProvider> {
  if (__DEV__) {
    console.log('[UnifiedProvider] Getting STREAMING provider:', { language, platform: Platform.OS });
  }

  // MOBILE: Expo Speech Recognition
  if (Platform.OS !== 'web') {
    try {
      const expoAvailable = await expoSpeech.isAvailable();
      if (expoAvailable) {
        if (__DEV__) console.log('[UnifiedProvider] ✅ Using Expo Speech Recognition (streaming)');
        return expoSpeech;
      } else {
        if (__DEV__) console.warn('[UnifiedProvider] ⚠️ Expo Speech Recognition not available');
      }
    } catch (e) {
      if (__DEV__) console.error('[UnifiedProvider] Expo Speech error:', e);
    }

    // No provider available
    if (__DEV__) console.warn('[UnifiedProvider] ⚠️ No mobile streaming provider available');
    return {
      id: 'noop',
      async isAvailable() { return false; },
      createSession() { return new NoopSession(); },
    };
  }

  // WEB: Use Deepgram + Claude (unchanged, handled in web branch)
  try {
    if (__DEV__) console.log('[UnifiedProvider] ✅ Using Deepgram streaming (web)');
    return {
      id: 'claude',
      async isAvailable() { return true; },
      createSession() {
        const sess: ClaudeVoiceSession = createClaudeVoiceSession();
        
        return {
          async start(opts: VoiceStartOptions) {
            return await sess.start({
              language: opts.language,
              onPartialTranscript: opts.onPartial,
              onFinalTranscript: opts.onFinal,
              systemPrompt: 'You are Dash, a helpful AI assistant for EduDash Pro. Keep responses concise and friendly for voice conversations (2-3 sentences max).',
            });
          },
          async stop() { await sess.stop(); },
          isActive() { return sess.isActive(); },
          isConnected() { return sess.isConnected(); },
          setMuted(m) { sess.setMuted(m); },
          updateConfig(cfg) { 
            sess.updateTranscriptionConfig({ language: cfg.language }); 
          },
        };
      },
    };
  } catch (e) {
    if (__DEV__) console.error('[UnifiedProvider] Web streaming failed:', e);
    return {
      id: 'noop',
      async isAvailable() { return false; },
      createSession() { return new NoopSession(); },
    };
  }
}

/**
 * @deprecated Use getSingleUseVoiceProvider() or getStreamingVoiceProvider() instead
 * Get the default voice provider based on availability and optional override
 */
export async function getDefaultVoiceProvider(language?: string): Promise<VoiceProvider> {
  // Default to single-use provider for backward compatibility
  return getSingleUseVoiceProvider(language);
}
