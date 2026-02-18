/**
 * Expo Speech Recognition Provider
 * 
 * Uses expo-speech-recognition for on-device speech recognition.
 * Works on iOS, Android, and Web.
 * 
 * Benefits:
 * - Zero native module linking required (Expo managed workflow)
 * - Consistent API across all platforms
 * - On-device recognition (no server costs)
 * - Supports South African languages (device-dependent)
 */

import { STT_CONTEXTUAL_STRINGS, applyPartialCorrections } from '@/lib/voice/sttDictionary';
import {
  ExpoSpeechRecognitionModule,
} from 'expo-speech-recognition';
import type { VoiceProvider, VoiceSession, VoiceStartOptions } from './unifiedProvider';

// Map app language codes to device locale codes
function mapLanguageToLocale(lang?: string): string {
  const base = String(lang || '').toLowerCase();
  if (base.startsWith('af')) return 'af-ZA';
  if (base.startsWith('zu')) return 'zu-ZA';
  if (base.startsWith('xh')) return 'xh-ZA';
  if (base.startsWith('nso')) return 'en-ZA'; // Sepedi not reliably supported on-device → fallback to en-ZA for ASR
  if (base.startsWith('en')) return 'en-ZA';
  return 'en-ZA'; // Default to English (South Africa)
}

class ExpoSpeechSession implements VoiceSession {
  private active = false;
  private muted = false;
  private currentOpts: VoiceStartOptions | null = null;
  /** True when stop() was explicitly called (vs. Android auto-stopping after silence) */
  private explicitlyStopped = false;
  /** Timer for whisper-flow auto-restart after Android ends recognition */
  private autoRestartTimer: ReturnType<typeof setTimeout> | null = null;
  /** How many consecutive auto-restarts (capped to avoid runaway loops) */
  private autoRestartCount = 0;
  private static readonly MAX_AUTO_RESTARTS = 50;
  /** Delay before auto-restart (ms) — short for seamless whisper-flow */
  private static readonly AUTO_RESTART_DELAY_MS = 300;
  /** Delay for network recovery restarts */
  private static readonly NETWORK_RETRY_DELAY_MS = 700;
  /** Cap transient network retries to prevent runaway loops */
  private static readonly MAX_NETWORK_RETRIES = 6;
  private networkRetryCount = 0;

  async start(opts: VoiceStartOptions): Promise<boolean> {
    try {
      if (__DEV__) console.log('[ExpoProvider] Starting speech recognition...');
      
      this.currentOpts = opts;
      this.explicitlyStopped = false;
      
      // Request microphone permissions
      const { status } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (status !== 'granted') {
        console.error('[ExpoProvider] Microphone permission denied');
        return false;
      }
      
      // Get locale for recognition
      const locale = mapLanguageToLocale(opts.language);
      
      if (__DEV__) {
        console.log('[ExpoProvider] Using locale:', locale);
      }
      
      // Configure and start recognition
      try {
        await ExpoSpeechRecognitionModule.start({
          lang: locale,
          interimResults: true, // Enable partial results
          maxAlternatives: 1,
          continuous: true, // Keep listening
          requiresOnDeviceRecognition: false, // Allow cloud if needed
          addsPunctuation: true,
          contextualStrings: STT_CONTEXTUAL_STRINGS,
        });
      } catch (startErr) {
        // If locale unsupported, fallback to en-ZA then en-US
        console.warn('[ExpoProvider] Start failed for locale', locale, startErr);
        try {
          await ExpoSpeechRecognitionModule.start({
            lang: 'en-ZA',
            interimResults: true,
            maxAlternatives: 1,
            continuous: true,
            requiresOnDeviceRecognition: false,
            addsPunctuation: true,
            contextualStrings: STT_CONTEXTUAL_STRINGS,
          });
        } catch (fallbackErr) {
          console.warn('[ExpoProvider] Fallback start failed for en-ZA, trying en-US', fallbackErr);
          await ExpoSpeechRecognitionModule.start({
            lang: 'en-US',
            interimResults: true,
            maxAlternatives: 1,
            continuous: true,
            requiresOnDeviceRecognition: false,
            addsPunctuation: true,
            contextualStrings: STT_CONTEXTUAL_STRINGS,
          });
        }
      }
      
      // Set up event listeners (clear previous listeners first to avoid duplication).
      this.cleanupListeners();
      ExpoSpeechRecognitionModule.addListener('result', (event: any) => {
        if (this.muted) return;
        
        const results = event.results || [];
        if (results.length === 0) return;
        
        const result = results[0];
        const rawTranscript = result.transcript || '';
        // Apply domain-specific corrections at the provider level so every
        // consumer (VoiceOrb, DashOrb, dash-voice) gets corrected text.
        const transcript = applyPartialCorrections(rawTranscript);
        
        if (result.isFinal) {
          if (__DEV__) console.log('[ExpoProvider] Final:', transcript);
          opts.onFinal?.(transcript);
        } else {
          if (__DEV__) console.log('[ExpoProvider] Partial:', transcript.substring(0, 50));
          opts.onPartial?.(transcript);
        }
      });
      
      ExpoSpeechRecognitionModule.addListener('error', (event: any) => {
        const errorText = event?.error ? String(event.error) : 'Speech recognition error';
        const normalized = errorText.toLowerCase();
        // "no-speech" is normal on Android — just means silence; auto-restart handles it
        if (errorText === 'no-speech') {
          if (__DEV__) console.log('[ExpoProvider] No speech detected — will auto-restart');
          return;
        }

        const isNetwork =
          normalized.includes('network') ||
          normalized.includes('timeout') ||
          normalized.includes('connection') ||
          normalized.includes('unreachable') ||
          normalized.includes('service-unavailable');

        // Treat transient network failures as recoverable while live listening is active.
        if (isNetwork && !this.explicitlyStopped && this.currentOpts) {
          if (this.networkRetryCount < ExpoSpeechSession.MAX_NETWORK_RETRIES) {
            this.networkRetryCount += 1;
            if (__DEV__) {
              console.warn(
                `[ExpoProvider] Transient network STT error, retrying (${this.networkRetryCount}/${ExpoSpeechSession.MAX_NETWORK_RETRIES})`
              );
            }
            this.currentOpts?.onError?.(
              `network_retrying_${this.networkRetryCount}/${ExpoSpeechSession.MAX_NETWORK_RETRIES}`
            );
            this.active = false;
            this.cleanupListeners();
            if (this.autoRestartTimer) {
              clearTimeout(this.autoRestartTimer);
            }
            this.autoRestartTimer = setTimeout(() => {
              if (this.explicitlyStopped || !this.currentOpts) return;
              this.start(this.currentOpts).catch((err) => {
                console.error('[ExpoProvider] Network retry failed:', err);
              });
            }, ExpoSpeechSession.NETWORK_RETRY_DELAY_MS);
            return;
          }
        }

        console.error('[ExpoProvider] Recognition error:', errorText);
        this.active = false;
        this.networkRetryCount = 0;
        this.currentOpts?.onError?.(errorText);
        this.stop().catch(() => {});
      });
      
      ExpoSpeechRecognitionModule.addListener('end', () => {
        if (__DEV__) console.log('[ExpoProvider] Recognition ended', {
          explicitlyStopped: this.explicitlyStopped,
          autoRestartCount: this.autoRestartCount,
        });
        this.active = false;

        // Whisper-flow: auto-restart if not explicitly stopped
        // Android frequently fires 'end' after silence even with continuous:true
        if (
          !this.explicitlyStopped &&
          this.currentOpts &&
          this.autoRestartCount < ExpoSpeechSession.MAX_AUTO_RESTARTS
        ) {
          this.autoRestartTimer = setTimeout(() => {
            if (this.explicitlyStopped) return;
            this.autoRestartCount++;
            if (__DEV__) {
              console.log(`[ExpoProvider] Whisper-flow auto-restart #${this.autoRestartCount}`);
            }
            // Re-start with same options (listeners are re-attached inside start())
            this.cleanupListeners();
            this.start(this.currentOpts!).catch((err) => {
              console.error('[ExpoProvider] Auto-restart failed:', err);
            });
          }, ExpoSpeechSession.AUTO_RESTART_DELAY_MS);
        }
      });
      
      this.active = true;
      this.networkRetryCount = 0;
      if (__DEV__) console.log('[ExpoProvider] Recognition started successfully');
      return true;
    } catch (e) {
      console.error('[ExpoProvider] Start failed:', e);
      this.active = false;
      return false;
    }
  }

  /** Remove all listeners without stopping the recognizer */
  private cleanupListeners(): void {
    try {
      ExpoSpeechRecognitionModule.removeAllListeners('result');
      ExpoSpeechRecognitionModule.removeAllListeners('error');
      ExpoSpeechRecognitionModule.removeAllListeners('end');
    } catch {
      // Non-fatal
    }
  }

  async stop(): Promise<void> {
    try {
      if (__DEV__) console.log('[ExpoProvider] Stopping recognition...');
      this.explicitlyStopped = true;
      this.autoRestartCount = 0;
      this.networkRetryCount = 0;
      if (this.autoRestartTimer) {
        clearTimeout(this.autoRestartTimer);
        this.autoRestartTimer = null;
      }
      await ExpoSpeechRecognitionModule.stop();
      this.active = false;
      
      // Remove event listeners
      this.cleanupListeners();
    } catch (e) {
      console.error('[ExpoProvider] Stop failed:', e);
    }
  }

  isActive(): boolean {
    return this.active;
  }
  
  isConnected(): boolean {
    return this.active; // For Expo, active = connected
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (__DEV__) console.log('[ExpoProvider] Muted:', muted);
  }

  updateConfig(cfg: { language?: string }): void {
    // Restart with new language
    if (this.currentOpts && cfg.language) {
      this.stop().then(() => {
        if (this.currentOpts) {
          this.currentOpts.language = cfg.language;
          this.start(this.currentOpts);
        }
      });
    }
  }
}

export const isSpeechRecognitionStateAvailable = (state: unknown): boolean => {
  if (typeof state === 'boolean') {
    return state;
  }

  if (typeof state === 'string') {
    const normalized = state.toLowerCase();
    return !(
      normalized.includes('unavailable') ||
      normalized.includes('denied') ||
      normalized.includes('disabled')
    );
  }

  if (state && typeof state === 'object') {
    const record = state as Record<string, unknown>;
    if (typeof record.isAvailable === 'boolean') {
      return record.isAvailable;
    }
    if (typeof record.available === 'boolean') {
      return record.available;
    }
    if (typeof record.canRecognize === 'boolean') {
      return record.canRecognize;
    }
    if (typeof record.status === 'string') {
      const status = record.status.toLowerCase();
      return !(
        status.includes('unavailable') ||
        status.includes('denied') ||
        status.includes('disabled')
      );
    }
  }

  return false;
};

/**
 * Expo Speech Recognition Provider
 */
export const expoSpeech: VoiceProvider = {
  id: 'expo',
  
  async isAvailable(): Promise<boolean> {
    try {
      // Check if module is available
      if (!ExpoSpeechRecognitionModule) {
        if (__DEV__) console.warn('[ExpoProvider] Module not available');
        return false;
      }
      
      // Check if speech recognition is supported on device
      const state = await ExpoSpeechRecognitionModule.getStateAsync();
      const isAvailable = isSpeechRecognitionStateAvailable(state);
      
      if (__DEV__) {
        console.log('[ExpoProvider] Availability check:', { state, isAvailable });
      }
      
      return isAvailable;
    } catch (e) {
      if (__DEV__) console.warn('[ExpoProvider] Availability check failed:', e);
      return false;
    }
  },
  
  createSession(): VoiceSession {
    return new ExpoSpeechSession();
  },
};
