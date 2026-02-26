/**
 * Message Translation Hook (M6)
 * Translates messages between English, Afrikaans, and isiZulu via AI proxy.
 * Caches translations in memory.
 */

import { useState, useCallback } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export type SupportedLanguage = 'en' | 'af' | 'zu';

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  af: 'Afrikaans',
  zu: 'isiZulu',
};

export interface UseMessageTranslationResult {
  translateMessage: (messageId: string, content: string, targetLanguage: SupportedLanguage) => Promise<string>;
  translatedMessages: Map<string, string>;
  translating: Set<string>;
  clearTranslation: (messageId: string) => void;
}

function buildTranslationCacheKey(messageId: string, language: SupportedLanguage): string {
  return `${messageId}:${language}`;
}

export function useMessageTranslation(): UseMessageTranslationResult {
  const [translatedMessages, setTranslatedMessages] = useState<Map<string, string>>(new Map());
  const [translating, setTranslating] = useState<Set<string>>(new Set());

  const translateMessage = useCallback(
    async (messageId: string, content: string, targetLanguage: SupportedLanguage): Promise<string> => {
      const cacheKey = buildTranslationCacheKey(messageId, targetLanguage);

      const cached = translatedMessages.get(cacheKey);
      if (cached) return cached;

      setTranslating((prev) => new Set(prev).add(messageId));

      try {
        const client = assertSupabase();
        const targetName = LANGUAGE_LABELS[targetLanguage];

        const prompt = [
          `Translate the following message to ${targetName}.`,
          `Only return the translated text, no explanations or formatting.`,
          `If the text is already in ${targetName}, return it unchanged.`,
          '',
          content,
        ].join('\n');

        const { data, error } = await client.functions.invoke('ai-proxy', {
          body: {
            scope: 'parent',
            service_type: 'lesson_generation',
            payload: {
              prompt,
              context: `You are a translation assistant for a South African educational platform. Translate accurately between English, Afrikaans, and isiZulu. Preserve the original tone and meaning. Return only the translation.`,
            },
            stream: false,
            enable_tools: false,
            metadata: { source: 'message_translation', target_language: targetLanguage },
          },
        });

        if (error) {
          logger.warn('useMessageTranslation', `Translation failed: ${error.message}`);
          throw error;
        }

        const translated = typeof data === 'string'
          ? data.trim()
          : (data?.content || data?.choices?.[0]?.message?.content || '').trim();

        if (!translated) {
          throw new Error('Empty translation response');
        }

        setTranslatedMessages((prev) => {
          const next = new Map(prev);
          next.set(cacheKey, translated);
          return next;
        });

        return translated;
      } catch (err) {
        logger.error('useMessageTranslation', 'Translation error:', err);
        throw err;
      } finally {
        setTranslating((prev) => {
          const next = new Set(prev);
          next.delete(messageId);
          return next;
        });
      }
    },
    [translatedMessages],
  );

  const clearTranslation = useCallback((messageId: string) => {
    setTranslatedMessages((prev) => {
      const next = new Map(prev);
      for (const key of next.keys()) {
        if (key.startsWith(`${messageId}:`)) {
          next.delete(key);
        }
      }
      return next;
    });
  }, []);

  return { translateMessage, translatedMessages, translating, clearTranslation };
}
