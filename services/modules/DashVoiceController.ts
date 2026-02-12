/**
 * DashVoiceController
 * 
 * Handles voice synthesis (TTS) for Dash AI Assistant responses.
 * 
 * Language routing strategy:
 * - Azure TTS only (consistent voices across platforms and better pronunciation for SA languages)
 * 
 * Extracted from DashAIAssistant.ts as part of Phase 4 modularization.
 */

import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { voiceService } from '@/lib/voice/client';
import type { DashMessage } from '@/services/dash-ai/types';
import { normalizeForTTS } from '@/lib/dash-ai/ttsNormalize';
import { shouldUsePhonicsMode } from '@/lib/dash-ai/phonicsDetection';

// Azure TTS languages (short codes accepted by tts-proxy)
const AZURE_TTS_LANGUAGES = ['en', 'af', 'zu', 'xh', 'nso'];
const DEFAULT_AZURE_RATE = 0;
const DEFAULT_PHONICS_AZURE_RATE = -6;

export interface VoiceSettings {
  rate: number;
  pitch: number;
  language: string;
  voice?: 'male' | 'female';
  phonicsMode?: boolean;
}

export interface SpeechCallbacks {
  onStart?: () => void;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: (error: any) => void;
}

/**
 * Manages voice synthesis and TTS for Dash AI Assistant
 */
export class DashVoiceController {
  private isSpeechAborted = false;
  private isDisposed = false;
  
  /**
   * Speak assistant message with TTS
   * Azure-only to keep pronunciation consistent across platforms
   */
  public async speakResponse(
    message: DashMessage,
    voiceSettings: VoiceSettings,
    callbacks?: SpeechCallbacks
  ): Promise<void> {
    if (message.type !== 'assistant') return;
    
    this.checkDisposed();
    this.isSpeechAborted = false;
    
    try {
      if (this.isSpeechAborted) {
        callbacks?.onStopped?.();
        return;
      }
      
      const tutorQuestion = (message as any)?.metadata?.tutor_question_text as string | undefined;
      let rawText = tutorQuestion || message.content || '';
      if (!tutorQuestion && /next question:/i.test(rawText)) {
        const split = rawText.split(/next question:/i);
        rawText = split[1]?.trim() || rawText;
      }
      const phonicsMode = typeof voiceSettings.phonicsMode === 'boolean'
        ? voiceSettings.phonicsMode
        : shouldUsePhonicsMode(rawText);
      const normalizedText = normalizeForTTS(rawText, {
        phonicsMode,
        preservePhonicsMarkers: phonicsMode,
      });
      if (normalizedText.length === 0) {
        callbacks?.onError?.('No speakable content');
        return;
      }
      
      // Derive language
      const prefs = await voiceService.getPreferences().catch(() => null);
      let language = (prefs?.language as any) || undefined;
      if (!language) {
        const metaLang = (message.metadata?.detected_language || '').toString();
        if (metaLang) language = this.mapLanguageCode(metaLang);
        else language = this.detectLanguageFromText(normalizedText);
      }
      if (!language) language = (voiceSettings.language?.toLowerCase()?.slice(0, 2) as any) || 'en';
      
      let shortCode = this.mapLanguageCode(language);
      const detected = this.detectLanguageFromText(normalizedText);
      if (shortCode === 'en' && detected !== 'en') {
        shortCode = detected;
      }
      
      if (!AZURE_TTS_LANGUAGES.includes(shortCode)) {
        console.warn(`[DashVoiceController] Unsupported TTS language, defaulting to English: ${shortCode}`);
        shortCode = 'en';
      }
      
      console.log(`[DashVoiceController] TTS routing: language=${shortCode}, provider=azure`);
      
      // Azure-only
      try {
        await this.speakWithAzureTTS(normalizedText, shortCode, callbacks, {
          phonicsMode,
          rate: phonicsMode ? DEFAULT_PHONICS_AZURE_RATE : DEFAULT_AZURE_RATE,
          pitch: 0,
        });
        if (this.isSpeechAborted) callbacks?.onStopped?.();
        return;
      } catch (azureError) {
        console.error('[DashVoiceController] Azure TTS failed:', azureError);
        callbacks?.onError?.(azureError);
        return;
      }
    } catch (error) {
      console.error('[DashVoiceController] Failed to speak:', error);
      callbacks?.onError?.(error);
      throw error;
    }
  }
  
  /**
   * Stop all speech playback
   */
  public async stopSpeaking(): Promise<void> {
    try {
      this.isSpeechAborted = true;
      
      if (Speech && typeof Speech.stop === 'function') {
        await Speech.stop();
      }
      
      const { audioManager } = await import('@/lib/voice/audio');
      await audioManager.stop();
    } catch (error) {
      console.error('[DashVoiceController] Failed to stop:', error);
    }
  }
  
  /**
   * Speak using Azure TTS via Edge Function
   */
  private async speakWithAzureTTS(
    text: string,
    language: string,
    callbacks?: SpeechCallbacks,
    options?: {
      phonicsMode?: boolean;
      rate?: number;
      pitch?: number;
    }
  ): Promise<void> {
    const { assertSupabase } = await import('@/lib/supabase');
    const supabase = assertSupabase();
    
    // The Edge Function expects short codes (af, zu, xh, nso, en)
    const shortCode = this.mapLanguageCode(language);
    
    try {
      const { data, error } = await supabase.functions.invoke('tts-proxy', {
        // rate/pitch are in -50..50 scale; 0 = normal (1.0x)
        body: {
          text,
          language: shortCode,
          rate: Number.isFinite(options?.rate as number) ? Number(options?.rate) : 0,
          pitch: Number.isFinite(options?.pitch as number) ? Number(options?.pitch) : 0,
          phonics_mode: options?.phonicsMode === true,
        }
      });
      
      if (error) {
        console.error('[DashVoiceController] TTS proxy error:', error);
        throw new Error(error.message || 'TTS proxy invocation failed');
      }
      
      if (!data) {
        throw new Error('No data returned from TTS proxy');
      }
      
      // Check if Edge Function suggests fallback to device
      if (data.fallback === 'device') {
        console.log('[DashVoiceController] Azure TTS unavailable, Edge Function returned device fallback');
        throw new Error('Edge Function returned device fallback');
      }
      
      if (!data.audio_url) {
        console.error('[DashVoiceController] No audio URL in response:', data);
        throw new Error('No audio URL in TTS response');
      }
      
      // Check if speech was aborted before playing
      if (this.isSpeechAborted) {
        console.log('[DashVoiceController] Speech aborted before playback started');
        callbacks?.onStopped?.();
        return;
      }
      
      callbacks?.onStart?.();
      
      const { audioManager } = await import('@/lib/voice/audio');
      let playbackError = false;
      await audioManager.play(data.audio_url, (state) => {
        if (this.isSpeechAborted) {
          console.log('[DashVoiceController] Speech aborted during playback');
          void audioManager.stop();
          callbacks?.onStopped?.();
          return;
        }
        if (state.error) {
          playbackError = true;
          console.error('[DashVoiceController] Audio playback error:', state.error);
          callbacks?.onError?.(new Error(state.error));
        }
      });
      if (!this.isSpeechAborted && !playbackError) {
        callbacks?.onDone?.();
      }
    } catch (error) {
      console.error('[DashVoiceController] Azure TTS failed:', error);
      throw error;
    }
  }
  
  /**
   * Speak using device TTS (expo-speech)
   */
  private async speakWithDeviceTTS(
    text: string,
    voiceSettings: VoiceSettings,
    callbacks?: SpeechCallbacks
  ): Promise<void> {
    let adjustedPitch = voiceSettings.pitch || 1.0;
    let adjustedRate = voiceSettings.rate || 1.0;
    let selectedVoice: string | undefined;
    
    if (Platform.OS === 'android') {
      adjustedPitch = voiceSettings.voice === 'male' 
        ? Math.max(0.7, adjustedPitch * 0.85)
        : Math.min(1.5, adjustedPitch * 1.15);
    } else if (Speech && typeof Speech.getAvailableVoicesAsync === 'function') {
      try {
        const voices = await Speech.getAvailableVoicesAsync();
        const langCode = voiceSettings.language?.substring(0, 2) || 'en';
        const matching = voices.filter(v => v.language?.startsWith(langCode));
        if (matching.length > 0) {
          const targetGender = voiceSettings.voice;
          if (targetGender === 'male') {
            const male = matching.find(v => 
              v.name?.toLowerCase().includes('male') || 
              (v as any).gender === 'male'
            );
            selectedVoice = male?.identifier || matching[0]?.identifier;
          } else {
            const female = matching.find(v =>
              v.name?.toLowerCase().includes('female') ||
              (v as any).gender === 'female'
            );
            selectedVoice = female?.identifier || matching[0]?.identifier;
          }
        }
      } catch {
        // Use default voice
      }
    }
    
    return new Promise<void>((resolve, reject) => {
      if (this.isSpeechAborted) {
        callbacks?.onStopped?.();
        resolve();
        return;
      }
      
      const options: any = {
        language: voiceSettings.language,
        pitch: adjustedPitch,
        rate: adjustedRate,
        onStart: () => {
          if (this.isSpeechAborted) {
            Speech.stop();
            callbacks?.onStopped?.();
            resolve();
            return;
          }
          callbacks?.onStart?.();
        },
        onDone: () => {
          this.isSpeechAborted ? callbacks?.onStopped?.() : callbacks?.onDone?.();
          resolve();
        },
        onStopped: () => {
          callbacks?.onStopped?.();
          resolve();
        },
        onError: (error: any) => {
          callbacks?.onError?.(error);
          reject(error);
        }
      };
      
      if (Platform.OS === 'ios' && selectedVoice) options.voice = selectedVoice;
      
      if (Speech && typeof Speech.speak === 'function') {
        Speech.speak(text, options);
      } else {
        reject(new Error('Speech module not available'));
      }
    });
  }
  
  /**
   * Normalize text for speech (remove markdown, emojis, icons, fix awkward phrases)
   */
  private normalizeTextForSpeech(text: string): string {
    let normalized = text
      .replace(/```[\s\S]*?```/g, '')       // Remove code blocks
      .replace(/`[^`]+`/g, '')               // Remove inline code
      .replace(/\*\*([^*]+)\*\*/g, '$1')    // Bold
      .replace(/\*([^*]+)\*/g, '$1')         // Italic
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
      .replace(/#{1,6}\s+/g, '')             // Headers
      .replace(/>\s+/g, '')                  // Blockquotes
      .replace(/^\s*[-*+•◦▪︎·]\s+/gm, '')  // List bullets
      .replace(/^\s*\d+[.)]\s+/gm, '')       // Numbered lists
      // Comprehensive emoji removal
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      .replace(/[\u{2700}-\u{27BF}]/gu, '')
      .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
      .replace(/[\u{200D}]/gu, '')
      .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '')
      .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '')
      .replace(/[✅❌⚠️✨🎯📊💡🚀⚡🔍📝🔧📈👋🎤🔇🔊🌟⭐💫📖🎓📚💯❤️✔️✖️👍👎🤔😊🙂🤗🙏]/g, '')
      // Bracketed meta info
      .replace(/\[.*?\]/g, '')
      .replace(/_Tools used:.*?_/gi, '')
      .replace(/_.*?tokens used_/gi, '')
      // Quotes and parens
      .replace(/[“”"«»]/g, '')
      .replace(/[‘’`]/g, "'")
      // Status labels that shouldn't be spoken
      .replace(/\bCorrect answer:\s*/gi, '')
      .replace(/\bNext question:\s*/gi, '')
      .replace(/\bHint:\s*/gi, 'Hint. ')
      .replace(/^\s*User:\s*/gi, '')
      .replace(/\bUser:\s*/gi, '')
      .replace(/^\s*Assistant:\s*/gi, '')
      .replace(/\bAssistant:\s*/gi, '')
      .replace(/\n{2,}/g, '. ')              // Multi-newlines
      .replace(/\n/g, ' ')                   // Single newlines
      .trim();
    
    // Fix awkward age and quantity phrases
    normalized = normalized
      // Fix "X to Y years old" patterns
      .replace(/(\w+)\s+to\s+(\d+)\s+years?\s+old/gi, '$2 year old $1')
      .replace(/(\w+)\s+from\s+(\d+)\s+to\s+(\d+)\s+years?/gi, '$1 aged $2 to $3 years')
      // Fix awkward "aged X-Y years old" patterns
      .replace(/aged\s+(\d+)-(\d+)\s+years?\s+old/gi, '$1 to $2 year old')
      // Fix "students/children/kids of X years"
      .replace(/(students?|children?|kids?)\s+of\s+(\d+)\s+years?/gi, '$2 year old $1')
      // Fix "X year students" -> "X year old students"
      .replace(/(\d+)\s+year\s+(students?|children?|kids?)/gi, '$1 year old $2')
      // Fix plural "years old" when singular needed
      .replace(/(\d+)\s+years\s+old\s+(student|child|kid|boy|girl)/gi, '$1 year old $2')
      // Normalize "X-Y year old" patterns
      .replace(/(\d+)-(\d+)\s+years?\s+old/gi, '$1 to $2 year old');

    normalized = this.normalizeSouthAfricanLanguageNames(normalized);
    
    return normalized;
  }

  /**
   * Normalize South African language names so TTS pronounces them naturally.
   * Prevents "i s i Zulu" style spelling.
   */
  private normalizeSouthAfricanLanguageNames(text: string): string {
    return text
      // Collapse spaced isi-* variants
      .replace(/\bi\s*s\s*i\s+zulu\b/gi, 'isiZulu')
      .replace(/\bi\s*s\s*i\s+xhosa\b/gi, 'isiXhosa')
      .replace(/\bi\s*s\s*i\s+ndebele\b/gi, 'isiNdebele')
      .replace(/\bisi\s+zulu\b/gi, 'isiZulu')
      .replace(/\bisi\s+xhosa\b/gi, 'isiXhosa')
      .replace(/\bisi\s+ndebele\b/gi, 'isiNdebele')
      // Sepedi/Sesotho spacing fixes
      .replace(/\bse\s+pedi\b/gi, 'Sepedi')
      .replace(/\bse\s+sotho\b/gi, 'Sesotho');
  }
  
  /**
   * Detect language from text content
   */
  private detectLanguageFromText(text: string): 'en' | 'af' | 'zu' | 'xh' | 'nso' {
    const t = (text || '').toLowerCase();
    
    // Unique markers
    if (/\b(molo|ndiyabulela|uxolo|ewe|hayi|yintoni|ndiza|umntwana)\b/i.test(t)) return 'xh';
    if (/\b(sawubona|ngiyabonga|ngiyaphila|umfundi|siyakusiza|ufunde|yebo|cha)\b/i.test(t)) return 'zu';
    if (/\b(hallo|asseblief|baie|goed|graag|ek|jy|nie|met|van|is|dit)\b/i.test(t)) return 'af';
    if (/\b(thobela|le\s+kae|ke\s+a\s+leboga|hle|ka\s+kgopelo)\b/i.test(t)) return 'nso';
    
    // Shared Nguni words default to Zulu
    if (/\b(unjani|kakhulu|enkosi)\b/i.test(t)) return 'zu';
    
    return 'en';
  }
  
  /**
   * Map language code to standard format
   */
  private mapLanguageCode(code: string): string {
    const normalized = code.toLowerCase().slice(0, 2);
    const mapping: Record<string, string> = {
      'en': 'en', 'af': 'af', 'zu': 'zu', 'xh': 'xh',
      'ns': 'nso', 'st': 'nso', 'se': 'nso'
    };
    return mapping[normalized] || 'en';
  }
  
  /** Map to device TTS locale (e.g., af -> af-ZA) for expo-speech */
  private mapToDeviceLocale(code: string): string {
    const c = (code || 'en').toLowerCase();
    if (c === 'af') return 'af-ZA';
    if (c === 'zu') return 'zu-ZA';
    if (c === 'xh') return 'xh-ZA';
    if (c === 'en') return 'en-ZA';
    // For nso and others, use en-ZA as fallback for device
    return 'en-ZA';
  }
  
  /** Map to Azure locale (e.g., af -> af-ZA) */
  private mapAzureLocale(code: string): string {
    const c = (code || 'en').toLowerCase();
    if (c.startsWith('af')) return 'af-ZA';
    if (c.startsWith('zu')) return 'zu-ZA';
    if (c.startsWith('xh')) return 'xh-ZA';
    if (c.startsWith('nso') || c.startsWith('ns') || c.startsWith('se') || c.startsWith('st')) return 'nso-ZA';
    if (c.startsWith('en')) return 'en-ZA';
    return 'en-ZA';
  }
  
  /**
   * Dispose and clean up
   */
  public dispose(): void {
    this.stopSpeaking();
    this.isDisposed = true;
  }
  
  private checkDisposed(): void {
    if (this.isDisposed) {
      throw new Error('[DashVoiceController] Instance disposed');
    }
  }
}
