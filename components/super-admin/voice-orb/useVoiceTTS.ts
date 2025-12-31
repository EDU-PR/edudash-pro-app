/**
 * useVoiceTTS Hook
 * 
 * Handles Text-to-Speech with Azure TTS (primary) and device fallback.
 * Uses natural-sounding Azure voices with expo-speech as backup.
 * 
 * @module components/super-admin/voice-orb/useVoiceTTS
 */

import { useCallback, useState, useRef, useEffect } from 'react';
import * as Speech from 'expo-speech';
import { useAudioPlayer } from 'expo-audio';
import { assertSupabase } from '../../../lib/supabase';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from './useVoiceSTT';

export interface TTSOptions {
  voice?: string;
  rate?: number;
  pitch?: number;
}

export interface UseVoiceTTSReturn {
  speak: (text: string, language?: SupportedLanguage) => Promise<void>;
  stop: () => Promise<void>;
  isSpeaking: boolean;
  error: string | null;
}

export function useVoiceTTS(): UseVoiceTTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioPlayer = useAudioPlayer();
  const [useDeviceFallback, setUseDeviceFallback] = useState(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Speech.stop();
      // Only remove audioPlayer if it's actually an object with a remove method
      if (audioPlayer && typeof audioPlayer === 'object' && 'remove' in audioPlayer) {
        try {
          audioPlayer.remove();
        } catch (err) {
          // Silently ignore cleanup errors
        }
      }
    };
  }, [audioPlayer]);

  const stop = useCallback(async () => {
    try {
      Speech.stop();
      audioPlayer.remove();
      setIsSpeaking(false);
    } catch (err) {
      console.error('[VoiceTTS] Error stopping:', err);
    }
  }, [audioPlayer]);

  /**
   * Speak using device TTS as fallback
   */
  const speakWithDevice = useCallback((cleanText: string, language: SupportedLanguage): Promise<void> => {
    return new Promise<void>((resolve) => {
      const langCode = language.split('-')[0]; // en-ZA -> en
      console.log('[VoiceTTS] Using device TTS fallback');
      
      Speech.speak(cleanText, {
        language: langCode,
        pitch: 1.0,
        rate: 0.95,
        onDone: () => {
          console.log('[VoiceTTS] Device speech finished');
          setIsSpeaking(false);
          resolve();
        },
        onError: (error) => {
          console.error('[VoiceTTS] Device speech error:', error);
          setIsSpeaking(false);
          setError('TTS playback failed');
          resolve();
        },
      });
    });
  }, []);

  /**
   * Speak using Azure TTS (primary method)
   */
  const speakWithAzure = useCallback(async (cleanText: string, language: SupportedLanguage): Promise<void> => {
    try {
      const supabase = assertSupabase();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        console.log('[VoiceTTS] No session, falling back to device TTS');
        return speakWithDevice(cleanText, language);
      }

      console.log('[VoiceTTS] Calling Azure TTS via Edge Function');
      
      // Map language to short code (en-ZA -> en)
      const langCode = language.split('-')[0] as 'en' | 'af' | 'zu';
      
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/tts-proxy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            text: cleanText,
            lang: langCode,
            style: 'friendly',
            format: 'mp3',
          }),
        }
      );

      if (!response.ok) {
        console.log('[VoiceTTS] Azure TTS failed, falling back to device');
        setUseDeviceFallback(true);
        return speakWithDevice(cleanText, language);
      }

      const data = await response.json();
      
      // Handle fallback instruction from server
      if (data.fallback === 'device') {
        console.log('[VoiceTTS] Server instructed device fallback');
        return speakWithDevice(cleanText, language);
      }
      
      if (!data.audio_url) {
        console.log('[VoiceTTS] No audio URL in response, falling back');
        return speakWithDevice(cleanText, language);
      }

      console.log('[VoiceTTS] Got audio URL from', data.provider, '- playing...');
      
      // Play the audio URL directly
      return new Promise<void>((resolve) => {
        audioPlayer.replace(data.audio_url);
        audioPlayer.play();

        // Monitor playback completion
        const checkPlayback = setInterval(() => {
          if (!audioPlayer.playing) {
            clearInterval(checkPlayback);
            console.log('[VoiceTTS] Azure playback finished');
            setIsSpeaking(false);
            audioPlayer.remove();
            resolve();
          }
        }, 100);
        
        // Safety timeout
        setTimeout(() => {
          clearInterval(checkPlayback);
          if (audioPlayer.playing) {
            audioPlayer.remove();
          }
          setIsSpeaking(false);
          resolve();
        }, 30000); // 30 second max
      });
      
    } catch (err) {
      console.error('[VoiceTTS] Azure TTS error:', err);
      // Only fallback to device after network/server errors, not for all errors
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('timeout')) {
        console.log('[VoiceTTS] Network error, retrying Azure once before device fallback...');
        // One retry for network issues
        try {
          const supabase = assertSupabase();
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            const langCode = language.split('-')[0] as 'en' | 'af' | 'zu';
            const retryResponse = await fetch(
              `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/tts-proxy`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ text: cleanText, lang: langCode, style: 'friendly', format: 'mp3' }),
              }
            );
            if (retryResponse.ok) {
              const retryData = await retryResponse.json();
              if (retryData.audio_url) {
                console.log('[VoiceTTS] Retry successful - playing Azure audio');
                return new Promise<void>((resolve) => {
                  audioPlayer.replace(retryData.audio_url);
                  audioPlayer.play();
                  const checkPlayback = setInterval(() => {
                    if (!audioPlayer.playing) {
                      clearInterval(checkPlayback);
                      setIsSpeaking(false);
                      audioPlayer.remove();
                      resolve();
                    }
                  }, 100);
                  setTimeout(() => {
                    clearInterval(checkPlayback);
                    if (audioPlayer.playing) audioPlayer.remove();
                    setIsSpeaking(false);
                    resolve();
                  }, 30000);
                });
              }
            }
          }
        } catch (retryErr) {
          console.error('[VoiceTTS] Retry failed:', retryErr);
        }
      }
      // Final fallback to device TTS
      return speakWithDevice(cleanText, language);
    }
  }, [speakWithDevice, audioPlayer]);

  const speak = useCallback(async (text: string, language: SupportedLanguage = 'en-ZA') => {
    setIsSpeaking(true);
    setError(null);
    
    try {
      // Stop any current playback
      await stop();
      
      // IMPORTANT: TTS ONLY supports en, af, zu (South African languages with Azure voices)
      // For ANY other language, TTS is completely disabled - no speech at all
      const SUPPORTED_TTS_LANGS = ['en', 'af', 'zu'];
      const baseLang = language.split('-')[0];
      
      if (!SUPPORTED_TTS_LANGS.includes(baseLang)) {
        console.warn(`[VoiceTTS] Language ${language} not supported - TTS disabled. Only en, af, zu are supported.`);
        setError('TTS not available for this language');
        setIsSpeaking(false);
        return; // Exit early - no TTS for unsupported languages
      }
      
      const effectiveLanguage: SupportedLanguage = language;
      
      // Clean text for TTS - remove markdown, emojis, and special characters for natural speech
      const cleanText = text
        // First: Handle acronyms and special brand names for proper pronunciation
        .replace(/EduDash Pro/gi, 'Edu Dash Pro')  // Spell out for natural speech
        .replace(/\bAPI\b/g, 'A P I')              // Spell out API
        .replace(/\bHTTP\b/g, 'H T T P')           // Spell out HTTP
        .replace(/\bJSON\b/g, 'J S O N')           // Spell out JSON
        .replace(/\bSQL\b/g, 'S Q L')              // Spell out SQL
        .replace(/\bRLS\b/g, 'R L S')              // Spell out RLS (Row Level Security)
        .replace(/\bRBAC\b/g, 'R B A C')           // Spell out RBAC
        .replace(/\bSTEM\b/g, 'S T E M')           // Spell out STEM
        .replace(/\bSTT\b/g, 'speech to text')    // Expand STT
        .replace(/\bTTS\b/g, 'text to speech')    // Expand TTS
        .replace(/\bAI\b/g, 'A I')                 // Spell out AI
        // Then: Remove markdown and formatting
        .replace(/\*\*/g, '')           // Bold markers
        .replace(/\*/g, '')             // Italic markers  
        .replace(/`/g, '')              // Code markers
        .replace(/#{1,6}\s/g, '')       // Headers
        .replace(/>/g, '')              // Blockquotes
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Links
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Emojis
        .replace(/[\ud83d\udcca\ud83d\udc4b\ud83d\udd27\u2699\ufe0f\u2728\ud83c\udfaf\ud83d\udcc8\ud83d\udca1\ud83d\ude80\u26a1\ud83d\udd0d\ud83d\udcdd\u2705\u274c\u26a0\ufe0f]/g, '') // Common icons
        .replace(/\[.*?\]/g, '')       // Bracketed text like [Tools used: ...]
        .replace(/_Tools used:.*?_/gi, '') // Tool usage indicators
        .replace(/_.*?tokens used_/gi, '') // Token usage indicators
        .replace(/🔧\s*/g, '')         // Tool icon prefix
        .replace(/📊\s*/g, '')         // Chart icon prefix
        .replace(/\n+/g, ' ')           // Newlines
        .trim()
        .substring(0, 800);             // Max length
      
      if (!cleanText) {
        console.log('[VoiceTTS] No text to speak');
        setIsSpeaking(false);
        return;
      }
      
      console.log('[VoiceTTS] Speaking text, length:', cleanText.length);
      
      // Try Azure first, with automatic device fallback on error
      if (useDeviceFallback) {
        // Previous Azure call failed, go straight to device
        await speakWithDevice(cleanText, effectiveLanguage);
      } else {
        // Try Azure, will fallback to device on error
        await speakWithAzure(cleanText, effectiveLanguage);
      }
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'TTS failed';
      console.error('[VoiceTTS] Error:', message);
      setError(message);
      setIsSpeaking(false);
    }
  }, [stop, useDeviceFallback, speakWithAzure, speakWithDevice]);

  return { speak, stop, isSpeaking, error };
}

export default useVoiceTTS;
