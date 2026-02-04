/**
 * useVoiceTTS Hook
 * 
 * Handles Text-to-Speech with Azure TTS (primary) and device fallback.
 * Uses natural-sounding Azure voices with expo-speech as backup.
 * 
 * @module components/super-admin/voice-orb/useVoiceTTS
 */

import { useCallback, useState, useEffect, useRef } from 'react';
import * as Speech from 'expo-speech';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { assertSupabase } from '../../../lib/supabase';
import { SupportedLanguage } from './useVoiceSTT';

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
  const playerRef = useRef<AudioPlayer | null>(null);
  const stopRequestedRef = useRef(false);
  const playbackIdRef = useRef(0);
  const playbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPlaybackTimers = useCallback(() => {
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
  }, []);

  const cleanupPlayer = useCallback((player?: AudioPlayer | null) => {
    if (!player) return;
    try {
      player.pause();
    } catch {
      // ignore pause errors
    }
    try {
      player.release();
    } catch {
      // ignore release errors
    }
    if (playerRef.current === player) {
      playerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Speech.stop();
      clearPlaybackTimers();
      cleanupPlayer(playerRef.current);
    };
  }, [clearPlaybackTimers, cleanupPlayer]);

  const stopPlayback = useCallback(async () => {
    try {
      Speech.stop();
      playbackIdRef.current += 1; // invalidate any pending intervals
      clearPlaybackTimers();
      cleanupPlayer(playerRef.current);
    } catch (err) {
      console.error('[VoiceTTS] Error stopping playback:', err);
    }
  }, [clearPlaybackTimers, cleanupPlayer]);

  const stop = useCallback(async () => {
    stopRequestedRef.current = true;
    await stopPlayback();
    setIsSpeaking(false);
  }, [stopPlayback]);

  const playAudioUrl = useCallback((audioUrl: string, timeoutMs: number): Promise<void> => {
    return new Promise<void>((resolve) => {
      let settled = false;
      let hasStarted = false;
      const playbackId = playbackIdRef.current + 1;
      playbackIdRef.current = playbackId;

      clearPlaybackTimers();
      cleanupPlayer(playerRef.current);

      const finalize = () => {
        if (settled) return;
        settled = true;
        clearPlaybackTimers();
        cleanupPlayer(playerRef.current);
        resolve();
      };

      let player: AudioPlayer | null = null;
      try {
        player = createAudioPlayer(audioUrl);
        playerRef.current = player;
        player.play();
      } catch (err) {
        console.error('[VoiceTTS] Failed to start audio playback:', err);
        finalize();
        return;
      }

      playbackIntervalRef.current = setInterval(() => {
        if (playbackIdRef.current !== playbackId) {
          finalize();
          return;
        }
        if (!player) {
          finalize();
          return;
        }
        let playing = false;
        try {
          playing = player.playing;
        } catch (err) {
          console.warn('[VoiceTTS] Playback status error, stopping:', err);
          finalize();
          return;
        }
        if (playing) {
          hasStarted = true;
        }
        if (hasStarted && !playing) {
          finalize();
        }
      }, 150);

      playbackTimeoutRef.current = setTimeout(() => {
        finalize();
      }, timeoutMs);
    });
  }, [clearPlaybackTimers, cleanupPlayer]);

  /**
   * Speak using Azure TTS (primary method)
   */
  const speakWithAzure = useCallback(async (cleanText: string, language: SupportedLanguage): Promise<void> => {
    try {
      const supabase = assertSupabase();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        console.log('[VoiceTTS] No session, Azure TTS unavailable');
        throw new Error('TTS unavailable right now');
      }

      console.log('[VoiceTTS] Calling Azure TTS via Edge Function');
      
      // Map language to short code (en-ZA -> en)
      const langCode = language.split('-')[0] as 'en' | 'af' | 'zu';
      
      console.log('[VoiceTTS] Sending TTS request:', {
        language: language,
        langCode: langCode,
        textLength: cleanText.length,
        textPreview: cleanText.substring(0, 50),
      });
      
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
        const errText = await response.text().catch(() => '');
        console.log('[VoiceTTS] Azure TTS failed', {
          status: response.status,
          body: errText,
        });
        throw new Error('TTS unavailable right now');
      }

      const data = await response.json();
      
      // Handle fallback instruction from server
      if (data.fallback === 'device') {
        console.log('[VoiceTTS] Server instructed device fallback (blocked)');
        throw new Error('TTS unavailable right now');
      }
      
      if (!data.audio_url) {
        console.log('[VoiceTTS] No audio URL in response');
        throw new Error('TTS unavailable right now');
      }

      console.log('[VoiceTTS] Got audio URL from', data.provider, '- playing...');
      
      // Play the audio URL directly
      await playAudioUrl(data.audio_url, 60000);
      console.log('[VoiceTTS] Azure playback finished');
      return;
      
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
                await playAudioUrl(retryData.audio_url, 30000);
                setIsSpeaking(false);
                return;
              }
            }
          }
        } catch (retryErr) {
          console.error('[VoiceTTS] Retry failed:', retryErr);
        }
      }
      throw err instanceof Error ? err : new Error('TTS unavailable for this language');
    }
  }, [playAudioUrl]);

  const splitIntoChunks = (text: string, maxLength: number): string[] => {
    const sentences: string[] = [];
    let buffer = '';

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      buffer += char;
      if (char === '.' || char === '!' || char === '?') {
        if (buffer.trim()) {
          sentences.push(buffer.trim());
        }
        buffer = '';
      }
    }
    if (buffer.trim()) {
      sentences.push(buffer.trim());
    }
    const chunks: string[] = [];
    let current = '';

    for (const sentence of sentences) {
      if (!sentence.trim()) continue;
      if ((current + ' ' + sentence).trim().length > maxLength) {
        if (current.trim()) chunks.push(current.trim());
        current = sentence;
      } else {
        current = current ? `${current} ${sentence}` : sentence;
      }
    }

    if (current.trim()) chunks.push(current.trim());

    if (chunks.length === 0) {
      return text.length > 0 ? [text] : [];
    }

    // Hard split any oversized chunks
    const normalized: string[] = [];
    chunks.forEach((chunk) => {
      if (chunk.length <= maxLength) {
        normalized.push(chunk);
      } else {
        for (let i = 0; i < chunk.length; i += maxLength) {
          normalized.push(chunk.slice(i, i + maxLength));
        }
      }
    });

    return normalized;
  };

  const speak = useCallback(async (text: string, language: SupportedLanguage = 'en-ZA') => {
    stopRequestedRef.current = false;
    setIsSpeaking(true);
    setError(null);
    
    try {
      // Stop any current playback without cancelling this session
      await stopPlayback();
      
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
        // Normalize newlines and list formatting before stripping markdown
        .replace(/\r\n/g, '\n')
        .replace(/^\s*[-*•]\s*/gm, '')
        .replace(/^\s*\d+[.)]\s*/gm, '')
        // Then: Remove markdown and formatting
        .replace(/\*\*/g, '')           // Bold markers
        .replace(/\*/g, '')             // Italic markers  
        .replace(/`/g, '')              // Code markers
        .replace(/#{1,6}\s/g, '')       // Headers
        .replace(/>/g, '')              // Blockquotes
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Links
        // Remove punctuation that TTS reads awkwardly
        .replace(/[“”"«»]/g, '')
        .replace(/[‘’]/g, '')
        .replace(/[()[\]{}<>]/g, '')
        .replace(/[•◦▪︎·]/g, '')
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Emojis
        .replace(/[\ud83d\udcca\ud83d\udc4b\ud83d\udd27\u2699\ufe0f\u2728\ud83c\udfaf\ud83d\udcc8\ud83d\udca1\ud83d\ude80\u26a1\ud83d\udd0d\ud83d\udcdd\u2705\u274c\u26a0\ufe0f]/g, '') // Common icons
        .replace(/\[.*?\]/g, '')       // Bracketed text like [Tools used: ...]
        .replace(/_Tools used:.*?_/gi, '') // Tool usage indicators
        .replace(/_.*?tokens used_/gi, '') // Token usage indicators
        .replace(/🔧\s*/g, '')         // Tool icon prefix
        .replace(/📊\s*/g, '')         // Chart icon prefix
        .replace(/\n+/g, '. ')          // Newlines become pauses
        .replace(/\s{2,}/g, ' ')        // Collapse whitespace
        .replace(/\.\s*\./g, '. ')      // Remove repeated dots
        .trim();
      
      if (!cleanText) {
        console.log('[VoiceTTS] No text to speak');
        setIsSpeaking(false);
        return;
      }
      
      console.log('[VoiceTTS] Speaking text, length:', cleanText.length);
      const chunks = splitIntoChunks(cleanText, 1200);
      
      // Speak sequentially to avoid cutoff
      for (const chunk of chunks) {
        if (stopRequestedRef.current) break;
        await speakWithAzure(chunk, effectiveLanguage);
      }
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'TTS failed';
      console.error('[VoiceTTS] Error:', message);
      setError(message);
    } finally {
      setIsSpeaking(false);
    }
  }, [stopPlayback, speakWithAzure]);

  return { speak, stop, isSpeaking, error };
}

export default useVoiceTTS;
