'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface TTSOptions {
  rate?: number; // -50 to +50
  pitch?: number; // -50 to +50
  language?: 'en' | 'af' | 'zu' | 'xh' | 'nso';
  style?: 'friendly' | 'empathetic' | 'professional' | 'cheerful';
  voice?: 'male' | 'female';
}

export interface TTSQuota {
  allowed: boolean;
  remaining: number;
  limit: number;
  tier: 'free' | 'trial' | 'basic' | 'premium' | 'school';
}

// TTS Tier Limits (requests per day)
const TTS_LIMITS = {
  free: 3,        // 3 TTS per day
  trial: 20,      // 20 TTS per day
  basic: 50,      // 50 TTS per day
  premium: 200,   // 200 TTS per day
  school: 1000,   // 1000 TTS per day
};

export function useTTS(userId?: string) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSupported] = useState(true); // Always supported via Azure
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState<TTSQuota | null>(null);
  const [userTier, setUserTier] = useState<'free' | 'trial' | 'basic' | 'premium' | 'school'>('free');
  const [voicePreference, setVoicePreference] = useState<'male' | 'female'>('female');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const supabase = createClient();

  // Fetch user tier and preferences on mount
  useEffect(() => {
    const fetchUserData = async () => {
      if (!userId) return;

      try {
        // Get user tier
        const { data: tierData } = await supabase
          .from('user_ai_tiers')
          .select('tier')
          .eq('user_id', userId)
          .single();

        if (tierData) {
          setUserTier(tierData.tier || 'free');
        }

        // Get voice preference from user_metadata
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.user_metadata?.voice_preference) {
          setVoicePreference(user.user_metadata.voice_preference);
        }
      } catch (err) {
        console.error('[TTS] Failed to fetch user data:', err);
      }
    };

    fetchUserData();

    // Cleanup on unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, [userId, supabase]);

  // Check TTS quota
  const checkTTSQuota = useCallback(async (): Promise<TTSQuota> => {
    if (!userId) {
      return { allowed: false, remaining: 0, limit: 0, tier: 'free' };
    }

    try {
      // Get today's TTS usage
      const today = new Date().toISOString().split('T')[0];
      const { data: usageData, error: usageError } = await supabase
        .from('voice_usage_logs')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('service', 'tts')
        .gte('created_at', `${today}T00:00:00Z`)
        .lt('created_at', `${today}T23:59:59Z`);

      if (usageError) throw usageError;

      const usedToday = usageData?.length || 0;
      const limit = TTS_LIMITS[userTier] || TTS_LIMITS.free;
      const remaining = Math.max(0, limit - usedToday);

      const quotaResult: TTSQuota = {
        allowed: remaining > 0,
        remaining,
        limit,
        tier: userTier,
      };

      setQuota(quotaResult);
      return quotaResult;
    } catch (err) {
      console.error('[TTS] Quota check failed:', err);
      return { allowed: false, remaining: 0, limit: 0, tier: userTier };
    }
  }, [userId, userTier, supabase]);

  // Detect language from text content
  const detectLanguage = useCallback((text: string): 'en' | 'af' | 'zu' | 'xh' | 'nso' => {
    const t = text.toLowerCase();

    // Xhosa markers
    if (/\b(molo|ndiyabulela|uxolo|ewe|hayi|yintoni|ndiza|umntwana)\b/i.test(t)) return 'xh';
    // Zulu markers
    if (/\b(sawubona|ngiyabonga|ngiyaphila|umfundi|siyakusiza|ufunde|yebo|cha)\b/i.test(t)) return 'zu';
    // Afrikaans markers
    if (/\b(hallo|asseblief|baie|goed|graag|ek|jy|nie|met|van|is|dit)\b/i.test(t)) return 'af';
    // Sepedi markers
    if (/\b(thobela|le\s+kae|ke\s+a\s+leboga|hle|ka\s+kgopelo)\b/i.test(t)) return 'nso';

    return 'en'; // Default to English
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    
    setIsSpeaking(false);
    setIsPaused(false);
  }, []);

  const speakWithBrowserTTS = useCallback((text: string, options: TTSOptions) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn('[TTS] Browser TTS not supported');
      return;
    }

    const cleanText = text
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/[🎓💪🌟🤖✓⚠️📚👍]/g, '')
      .replace(/\n+/g, '. ')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Map Azure rate/pitch to browser TTS (Azure: -50 to +50, Browser: 0.1 to 10 / 0 to 2)
    const browserRate = 0.95 + ((options.rate || 0) / 100);
    const browserPitch = 1.0 + ((options.pitch || 0) / 100);
    
    utterance.rate = Math.max(0.1, Math.min(10, browserRate));
    utterance.pitch = Math.max(0, Math.min(2, browserPitch));
    utterance.volume = 1.0;

    // Map language codes
    const langMap: Record<string, string> = {
      en: 'en-ZA',
      af: 'af-ZA',
      zu: 'zu-ZA',
      xh: 'xh-ZA',
      nso: 'nso-ZA',
    };
    utterance.lang = langMap[options.language || 'en'] || 'en-US';

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    utterance.onerror = (event) => {
      console.error('[TTS] Browser speech error:', event);
      setIsSpeaking(false);
      setIsPaused(false);
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  const speak = useCallback(async (text: string, options: TTSOptions = {}) => {
    if (!text) return;

    try {
      // Stop any ongoing speech
      stop();
      setError(null);

      // Check quota for paid feature
      if (userId) {
        const quotaCheck = await checkTTSQuota();
        if (!quotaCheck.allowed) {
          setError(`TTS limit reached (${quotaCheck.limit}/${quotaCheck.tier}). Upgrade for more.`);
          return;
        }
      }

      // Clean markdown formatting from text
      const cleanText = text
        .replace(/#{1,6}\s/g, '') // Remove markdown headers
        .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
        .replace(/\*(.+?)\*/g, '$1') // Remove italic
        .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Remove links, keep text
        .replace(/`(.+?)`/g, '$1') // Remove code formatting
        .replace(/[🎓💪🌟🤖✓⚠️📚👍]/g, '') // Remove emojis
        .replace(/\n+/g, '. ') // Replace line breaks with pauses
        .trim();

      // Auto-detect language if not specified
      const language = options.language || detectLanguage(cleanText);

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Use user's voice preference if not specified in options
      const voiceGender = options.voice || voicePreference;

      // Call Azure TTS via edge function
      const { data, error: ttsError } = await supabase.functions.invoke('tts-proxy', {
        body: {
          text: cleanText,
          language: language,
          voiceId: voiceGender === 'male' ? `${language}-ZA-male` : undefined,
          style: options.style || 'friendly',
          rate: options.rate || 5,
          pitch: options.pitch || 0,
        },
      });

      if (ttsError) {
        console.error('[TTS] Error:', ttsError);
        throw ttsError;
      }

      if (data.fallback === 'device') {
        // Fallback to browser TTS for unsupported languages
        speakWithBrowserTTS(cleanText, options);
        return;
      }

      if (!data.audio_url) {
        throw new Error('No audio URL returned');
      }

      // Play audio
      const audio = new Audio(data.audio_url);
      audioRef.current = audio;

      audio.onloadstart = () => {
        setIsSpeaking(true);
        setIsPaused(false);
      };

      audio.onplay = () => {
        setIsSpeaking(true);
        setIsPaused(false);
      };

      audio.onended = () => {
        setIsSpeaking(false);
        setIsPaused(false);
      };

      audio.onerror = (e) => {
        console.error('[TTS] Audio playback error:', e);
        setError('Failed to play audio');
        setIsSpeaking(false);
        setIsPaused(false);
      };

      await audio.play();

      // Refresh quota after successful use
      if (userId) {
        setTimeout(() => checkTTSQuota(), 1000);
      }
    } catch (err) {
      console.error('[TTS] Error:', err);
      setError(err instanceof Error ? err.message : 'TTS failed');
      setIsSpeaking(false);
      
      // Fallback to browser TTS on error
      speakWithBrowserTTS(text, options);
    }
  }, [supabase, userId, checkTTSQuota, detectLanguage, voicePreference, stop, speakWithBrowserTTS]);

  const pause = useCallback(() => {
    if (!isSpeaking) return;
    
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPaused(true);
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }, [isSpeaking]);

  const resume = useCallback(() => {
    if (!isPaused) return;
    
    if (audioRef.current) {
      audioRef.current.play();
      setIsPaused(false);
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  }, [isPaused]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    
    setIsSpeaking(false);
    setIsPaused(false);
  }, []);

  // Update voice preference
  const setVoice = useCallback(async (voice: 'male' | 'female') => {
    setVoicePreference(voice);
    
    if (userId) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.auth.updateUser({
            data: {
              ...user.user_metadata,
              voice_preference: voice,
            },
          });
        }
      } catch (err) {
        console.error('[TTS] Failed to save voice preference:', err);
      }
    }
  }, [userId, supabase]);

  return {
    speak,
    pause,
    resume,
    stop,
    isSpeaking,
    isPaused,
    isSupported,
    error,
    quota,
    userTier,
    voicePreference,
    setVoice,
    checkQuota: checkTTSQuota,
    detectLanguage,
  };
}
