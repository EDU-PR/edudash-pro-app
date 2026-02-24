import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Speech from 'expo-speech';

import { useTheme } from '@/contexts/ThemeContext';

export interface SpellingPracticePayload {
  type: 'spelling_practice';
  word: string;
  prompt?: string;
  hint?: string;
  syllables?: string[];
  sentence?: string;
  letter_bank?: string[];
  language?: string;
  hide_word_reveal?: boolean;
}

interface InlineSpellingPracticeCardProps {
  payload: SpellingPracticePayload;
  onSolved?: (word: string) => void;
}

const SPELLING_FENCE_REGEX = /```spelling\s*\n?([\s\S]*?)```/i;

const normalizeWord = (value: string) =>
  String(value || '')
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{L}]/gu, '');

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const redactWordInText = (text: string | undefined, word: string): string => {
  const source = String(text || '').trim();
  const target = String(word || '').trim();
  if (!source || !target) return source;
  const targetRegex = new RegExp(`\\b${escapeRegex(target)}\\b`, 'gi');
  return source.replace(targetRegex, '____');
};

const detectSpellingLanguage = (payload: SpellingPracticePayload): 'af' | 'zu' | 'en' => {
  const explicit = String(payload.language || '').trim().toLowerCase();
  if (explicit.startsWith('af')) return 'af';
  if (explicit.startsWith('zu')) return 'zu';

  const combined = [
    payload.prompt,
    payload.hint,
    payload.sentence,
    payload.word,
  ]
    .map((entry) => String(entry || '').toLowerCase())
    .join(' ');

  if (/\b(spel|woord|kleur|die|dit|een|n|is|soort)\b/.test(combined) || /[êëïôûáéíóú]/i.test(combined)) {
    return 'af';
  }
  if (/\b(igama|isipelingi|funda|lalela|umbuzo)\b/.test(combined)) {
    return 'zu';
  }
  return 'en';
};

const coerceSpellingPayload = (value: unknown): SpellingPracticePayload | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const word = String(raw.word || '').trim();
  if (!word) return null;
  return {
    type: 'spelling_practice',
    word,
    prompt: typeof raw.prompt === 'string' ? raw.prompt : undefined,
    hint: typeof raw.hint === 'string' ? raw.hint : undefined,
    syllables: Array.isArray(raw.syllables)
      ? raw.syllables.map((entry) => String(entry).trim()).filter(Boolean).slice(0, 6)
      : undefined,
    sentence: typeof raw.sentence === 'string' ? raw.sentence : undefined,
    letter_bank: Array.isArray(raw.letter_bank)
      ? raw.letter_bank.map((entry) => String(entry).trim()).filter(Boolean).slice(0, 20)
      : undefined,
    language: typeof raw.language === 'string' ? raw.language : undefined,
    hide_word_reveal: raw.hide_word_reveal === false ? false : true,
  };
};

export function parseSpellingPayload(content: string): SpellingPracticePayload | null {
  const text = String(content || '').trim();
  if (!text) return null;

  const fenced = text.match(SPELLING_FENCE_REGEX);
  if (fenced?.[1]) {
    try {
      return coerceSpellingPayload(JSON.parse(fenced[1].trim()));
    } catch {
      return null;
    }
  }

  try {
    return coerceSpellingPayload(JSON.parse(text));
  } catch {
    return null;
  }
}

const makeHintPattern = (word: string, showCount: number): string => {
  const chars = word.split('');
  return chars.map((char, index) => (index < showCount ? char : '_')).join(' ');
};

export const InlineSpellingPracticeCard: React.FC<InlineSpellingPracticeCardProps> = ({
  payload,
  onSolved,
}) => {
  const { theme, isDark } = useTheme();
  const [answer, setAnswer] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [solved, setSolved] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [showWordFlash, setShowWordFlash] = useState(false);
  const [isSpeakingWord, setIsSpeakingWord] = useState(false);
  const hideWordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const targetWord = useMemo(() => String(payload.word || '').trim(), [payload.word]);
  const targetNorm = useMemo(() => normalizeWord(targetWord), [targetWord]);
  const detectedLanguage = useMemo(() => detectSpellingLanguage(payload), [payload]);
  const displayPrompt = useMemo(() => {
    const safePrompt = payload.prompt || 'Spell the hidden word.';
    return redactWordInText(safePrompt, targetWord);
  }, [payload.prompt, targetWord]);
  const displayHint = useMemo(() => redactWordInText(payload.hint, targetWord), [payload.hint, targetWord]);
  const shouldRevealWordOnStart = payload.hide_word_reveal === false;

  const clearWordTimer = useCallback(() => {
    if (hideWordTimerRef.current) {
      clearTimeout(hideWordTimerRef.current);
      hideWordTimerRef.current = null;
    }
  }, []);

  const scheduleWordHide = useCallback(() => {
    clearWordTimer();
    if (!shouldRevealWordOnStart) {
      setShowWordFlash(false);
      return;
    }
    setShowWordFlash(true);
    hideWordTimerRef.current = setTimeout(() => {
      setShowWordFlash(false);
    }, 2000);
  }, [clearWordTimer, shouldRevealWordOnStart]);

  useEffect(() => {
    scheduleWordHide();
    return () => {
      clearWordTimer();
      Speech.stop();
    };
  }, [scheduleWordHide, clearWordTimer]);

  const derivedLetterBank = useMemo(() => {
    if (payload.letter_bank && payload.letter_bank.length > 0) {
      return payload.letter_bank;
    }
    return targetWord
      .split('')
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 16);
  }, [payload.letter_bank, targetWord]);

  const hintText = useMemo(() => {
    if (hintLevel <= 0) return '';
    if (hintLevel === 1) {
      const revealCount = Math.max(1, Math.floor(targetWord.length * 0.25));
      return `Hint: ${makeHintPattern(targetWord, revealCount)} (${targetWord.length} letters)`;
    }
    if (hintLevel === 2) {
      if (payload.syllables && payload.syllables.length > 0) {
        return `Syllables: ${payload.syllables.join(' • ')}`;
      }
      const vowelPattern = targetWord.replace(/[bcdfghjklmnpqrstvwxyz]/gi, '_');
      return `Vowel pattern: ${vowelPattern.split('').join(' ')}`;
    }
    return `Word reveal: ${targetWord}`;
  }, [hintLevel, payload.syllables, targetWord]);

  const checkAnswer = useCallback(() => {
    const guessNorm = normalizeWord(answer);
    if (!guessNorm) return;

    const correct = guessNorm === targetNorm;
    setAttempts((prev) => prev + 1);
    setIsCorrect(correct);
    setSolved(correct);

    if (correct) {
      onSolved?.(targetWord);
      return;
    }

    setHintLevel((prev) => Math.min(3, Math.max(prev, 1)));
  }, [answer, onSolved, targetNorm, targetWord]);

  const requestHint = useCallback(() => {
    setHintLevel((prev) => Math.min(3, prev + 1));
  }, []);

  const appendLetter = useCallback((letter: string) => {
    if (solved) return;
    const nextLetter = String(letter || '').trim();
    if (!nextLetter) return;
    setAnswer((prev) => `${prev}${nextLetter}`);
  }, [solved]);

  const reset = useCallback(() => {
    setAnswer('');
    setAttempts(0);
    setSolved(false);
    setIsCorrect(false);
    setHintLevel(0);
    scheduleWordHide();
  }, [scheduleWordHide]);

  const playWordAudio = useCallback(async () => {
    if (!targetWord) return;
    if (isSpeakingWord) {
      await Promise.allSettled([
        Speech.stop(),
        (async () => {
          const { audioManager } = await import('@/lib/voice/audio');
          await audioManager.stop();
        })(),
      ]);
      setIsSpeakingWord(false);
      return;
    }

    setIsSpeakingWord(true);
    await Speech.stop();
    const shortLang: 'af' | 'zu' | 'en' = detectedLanguage;
    const locale = shortLang === 'af' ? 'af-ZA' : shortLang === 'zu' ? 'zu-ZA' : 'en-ZA';

    try {
      const { voiceService } = await import('@/lib/voice/client');
      const { audioManager } = await import('@/lib/voice/audio');
      // Use non-stream synthesize so we get an https:// URL (Supabase Storage).
      // Blob URLs from streamMode fail on React Native; playback would fall back
      // to device TTS, which has poor Afrikaans/native-language pronunciation.
      const ttsResponse = await voiceService.synthesize({
        text: targetWord,
        language: shortLang,
      } as any);
      if (ttsResponse?.audio_url) {
        await audioManager.play(ttsResponse.audio_url);
      }
      setIsSpeakingWord(false);
      return;
    } catch {
      Speech.speak(targetWord, {
        language: locale,
        rate: 0.88,
        pitch: 1.04,
        onDone: () => setIsSpeakingWord(false),
        onStopped: () => setIsSpeakingWord(false),
        onError: () => setIsSpeakingWord(false),
      });
    }
  }, [detectedLanguage, isSpeakingWord, targetWord]);

  const borderColor = isDark ? '#334155' : '#dbe2ea';
  const cardBg = isDark ? '#1e293b' : '#f8fafc';
  const panelBg = isDark ? '#0f172a' : '#ffffff';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const mutedColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <View style={[styles.card, { borderColor, backgroundColor: cardBg }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: textColor }]}>Spelling Practice</Text>
        <Text style={[styles.attemptBadge, { color: mutedColor }]}>
          Attempts: {attempts}
        </Text>
      </View>

      <Text style={[styles.prompt, { color: textColor }]}>
        {displayPrompt}
      </Text>

      <View style={[styles.flashWordBox, { borderColor, backgroundColor: panelBg }]}>
        {showWordFlash ? (
          <>
            <Text style={[styles.flashWordLabel, { color: mutedColor }]}>Memorize the spelling</Text>
            <Text style={[styles.flashWordText, { color: theme.warning || '#facc15' }]}>{targetWord}</Text>
            <Text style={[styles.flashWordHint, { color: mutedColor }]}>This word hides in 2 seconds.</Text>
          </>
        ) : (
          <View style={styles.flashWordHiddenRow}>
            <Text style={[styles.flashWordLabel, { color: mutedColor }]}>Word hidden. Listen and spell.</Text>
            <TouchableOpacity
              style={[styles.listenButton, { borderColor, backgroundColor: theme.surfaceVariant }]}
              onPress={playWordAudio}
              activeOpacity={0.85}
            >
              <Text style={[styles.listenButtonText, { color: textColor }]}>
                {isSpeakingWord ? 'Stop audio' : 'Play word'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {displayHint ? (
        <Text style={[styles.subtleHint, { color: mutedColor }]}>{displayHint}</Text>
      ) : null}

      <View style={[styles.inputWrap, { borderColor, backgroundColor: panelBg }]}>
        <TextInput
          style={[styles.input, { color: textColor }]}
          value={answer}
          onChangeText={setAnswer}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Type the spelling..."
          placeholderTextColor={mutedColor}
          editable={!solved}
          onSubmitEditing={checkAnswer}
          returnKeyType="done"
        />
      </View>

      <View style={styles.buttonRow}>
        {!solved ? (
          <>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
              onPress={checkAnswer}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>Check</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ghostButton, { borderColor }]}
              onPress={requestHint}
              activeOpacity={0.85}
            >
              <Text style={[styles.ghostButtonText, { color: textColor }]}>Hint</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
            onPress={reset}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Practice Again</Text>
          </TouchableOpacity>
        )}
      </View>

      {!solved && hintText ? (
        <View style={[styles.hintBox, { borderColor, backgroundColor: panelBg }]}>
          <Text style={[styles.hintText, { color: textColor }]}>{hintText}</Text>
        </View>
      ) : null}

      <View style={[styles.letterBank, { borderColor, backgroundColor: panelBg }]}>
        {derivedLetterBank.map((letter, idx) => (
          <TouchableOpacity
            key={`${letter}-${idx}`}
            style={[styles.letterChip, { borderColor }]}
            onPress={() => appendLetter(letter)}
            activeOpacity={0.8}
            disabled={solved}
            accessibilityRole="button"
            accessibilityLabel={`Letter ${letter}`}
          >
            <Text style={[styles.letterText, { color: textColor }]}>{letter}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {!solved ? (
        <Text style={[styles.letterBankHint, { color: mutedColor }]}>Tap letters to build the word.</Text>
      ) : null}

      {solved ? (
        <View style={[styles.feedbackBox, { backgroundColor: '#16a34a22', borderColor: '#16a34a66' }]}>
          <Text style={[styles.feedbackTitle, { color: '#22c55e' }]}>Great spelling!</Text>
          <Text style={[styles.feedbackBody, { color: textColor }]}>
            Correct word: <Text style={{ fontWeight: '700' }}>{targetWord}</Text>
          </Text>
          {payload.sentence ? (
            <Text style={[styles.feedbackBody, { color: mutedColor }]}>{payload.sentence}</Text>
          ) : null}
        </View>
      ) : attempts > 0 ? (
        <View style={[styles.feedbackBox, { backgroundColor: '#ef444422', borderColor: '#ef444466' }]}>
          <Text style={[styles.feedbackTitle, { color: '#f87171' }]}>
            {isCorrect ? 'Correct' : 'Not yet'}
          </Text>
          {!isCorrect ? (
            <Text style={[styles.feedbackBody, { color: mutedColor }]}>
              Try again. Listen to each sound and check the letter order.
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    marginVertical: 8,
    marginHorizontal: 4,
    padding: 14,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  attemptBadge: {
    fontSize: 12,
    fontWeight: '600',
  },
  prompt: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  subtleHint: {
    fontSize: 12,
    lineHeight: 18,
  },
  flashWordBox: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  flashWordLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  flashWordText: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  flashWordHint: {
    fontSize: 11,
    fontWeight: '500',
  },
  flashWordHiddenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  listenButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  listenButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  inputWrap: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  input: {
    minHeight: 42,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  ghostButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  ghostButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  hintBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  hintText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  letterBank: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  letterChip: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  letterText: {
    fontSize: 13,
    fontWeight: '700',
  },
  letterBankHint: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: -2,
  },
  feedbackBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  feedbackTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  feedbackBody: {
    fontSize: 12,
    lineHeight: 17,
  },
});

export default InlineSpellingPracticeCard;
