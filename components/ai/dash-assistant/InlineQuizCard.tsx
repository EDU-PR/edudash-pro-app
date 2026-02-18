/**
 * InlineQuizCard
 *
 * Interactive quiz card rendered inline within the DashAssistant chat flow.
 * Parses structured quiz JSON from AI responses and presents tappable
 * answer options with immediate visual feedback (correct/incorrect).
 *
 * Supports: multiple_choice, true_false, fill_blank, matching.
 * Grade-appropriate theming via age band detection.
 *
 * ≤400 lines (excl. StyleSheet) per WARP.md
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Animated,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface QuizQuestionPayload {
  type: 'quiz_question';
  question: string;
  options?: string[];
  correct: string;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard' | 'challenge';
  subject?: string;
  topic?: string;
  grade?: string;
  /** For fill_blank / true_false type hints */
  question_type?: 'multiple_choice' | 'true_false' | 'fill_blank' | 'matching';
}

interface InlineQuizCardProps {
  payload: QuizQuestionPayload;
  questionNumber?: number;
  totalQuestions?: number;
  onAnswer?: (answer: string, isCorrect: boolean) => void;
  disabled?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Try to parse a ```quiz``` JSON block from message content */
export function parseQuizPayload(content: string): QuizQuestionPayload | null {
  const match = content.match(/```quiz\s*\n?([\s\S]*?)```/);
  if (!match?.[1]) return null;
  try {
    const parsed = JSON.parse(match[1].trim());
    if (parsed?.type === 'quiz_question' && parsed.question && parsed.correct) {
      return parsed as QuizQuestionPayload;
    }
  } catch {
    // Not valid JSON
  }
  return null;
}

/** Extract text content before the quiz block (conversational intro) */
export function extractPreQuizText(content: string): string {
  const idx = content.indexOf('```quiz');
  if (idx <= 0) return '';
  return content.substring(0, idx).trim();
}

// ─── Component ───────────────────────────────────────────────────────────────

export const InlineQuizCard: React.FC<InlineQuizCardProps> = ({
  payload,
  questionNumber,
  totalQuestions,
  onAnswer,
  disabled = false,
}) => {
  const { theme, isDark } = useTheme();
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [fillBlankText, setFillBlankText] = useState('');
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const questionType = useMemo(() => {
    if (payload.question_type) return payload.question_type;
    if (payload.options?.length === 2 &&
      payload.options.every((o) => ['true', 'false'].includes(o.toLowerCase()))) {
      return 'true_false';
    }
    if (payload.options && payload.options.length > 0) return 'multiple_choice';
    return 'fill_blank';
  }, [payload]);

  const handleSelectOption = useCallback(
    (option: string) => {
      if (answered || disabled) return;
      setSelectedAnswer(option);

      const correct = option.toLowerCase().trim() === payload.correct.toLowerCase().trim();
      setIsCorrect(correct);
      setAnswered(true);

      if (correct) {
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.05, duration: 150, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        ]).start();
      } else {
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -10, duration: 80, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
        ]).start();
      }

      onAnswer?.(option, correct);
    },
    [answered, disabled, payload.correct, onAnswer, scaleAnim, shakeAnim],
  );

  const handleSubmitFillBlank = useCallback(() => {
    if (answered || disabled || !fillBlankText.trim()) return;
    const answer = fillBlankText.trim();
    setSelectedAnswer(answer);

    const correct = answer.toLowerCase() === payload.correct.toLowerCase().trim();
    setIsCorrect(correct);
    setAnswered(true);
    onAnswer?.(answer, correct);
  }, [answered, disabled, fillBlankText, payload.correct, onAnswer]);

  const difficultyColor = useMemo(() => {
    switch (payload.difficulty) {
      case 'easy': return '#22c55e';
      case 'medium': return '#f59e0b';
      case 'hard': return '#ef4444';
      case 'challenge': return '#8b5cf6';
      default: return '#6b7280';
    }
  }, [payload.difficulty]);

  const cardBg = isDark ? '#1e293b' : '#f8fafc';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const textColor = isDark ? '#f1f5f9' : '#1e293b';
  const mutedColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: cardBg, borderColor: cardBorder, transform: [{ translateX: shakeAnim }, { scale: scaleAnim }] },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {questionNumber != null && (
            <Text style={[styles.questionNum, { color: theme.colors.primary }]}>
              Q{questionNumber}{totalQuestions ? `/${totalQuestions}` : ''}
            </Text>
          )}
          {payload.subject && (
            <Text style={[styles.badge, { color: mutedColor }]}>
              {payload.subject}
            </Text>
          )}
        </View>
        {payload.difficulty && (
          <View style={[styles.diffBadge, { backgroundColor: difficultyColor + '20' }]}>
            <Text style={[styles.diffText, { color: difficultyColor }]}>
              {payload.difficulty.charAt(0).toUpperCase() + payload.difficulty.slice(1)}
            </Text>
          </View>
        )}
      </View>

      {/* Question */}
      <Text style={[styles.question, { color: textColor }]}>{payload.question}</Text>

      {/* Answer area */}
      {questionType === 'fill_blank' ? (
        <View style={styles.fillBlankArea}>
          <TextInput
            style={[
              styles.fillInput,
              {
                color: textColor,
                borderColor: answered ? (isCorrect ? '#22c55e' : '#ef4444') : cardBorder,
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
              },
            ]}
            value={fillBlankText}
            onChangeText={setFillBlankText}
            placeholder="Type your answer..."
            placeholderTextColor={mutedColor}
            editable={!answered && !disabled}
            onSubmitEditing={handleSubmitFillBlank}
            returnKeyType="done"
          />
          {!answered && (
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: theme.colors.primary }]}
              onPress={handleSubmitFillBlank}
              disabled={!fillBlankText.trim()}
            >
              <Text style={styles.submitText}>Submit</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.optionsArea}>
          {(payload.options || []).map((option, idx) => {
            const isSelected = selectedAnswer === option;
            const isCorrectOption = option.toLowerCase().trim() === payload.correct.toLowerCase().trim();
            let optionBg = isDark ? '#0f172a' : '#ffffff';
            let optionBorder = cardBorder;
            let optionTextColor = textColor;

            if (answered) {
              if (isCorrectOption) {
                optionBg = '#22c55e20';
                optionBorder = '#22c55e';
                optionTextColor = '#22c55e';
              } else if (isSelected && !isCorrectOption) {
                optionBg = '#ef444420';
                optionBorder = '#ef4444';
                optionTextColor = '#ef4444';
              }
            }

            const label = String.fromCharCode(65 + idx); // A, B, C, D

            return (
              <TouchableOpacity
                key={`${option}-${idx}`}
                style={[styles.option, { backgroundColor: optionBg, borderColor: optionBorder }]}
                onPress={() => handleSelectOption(option)}
                disabled={answered || disabled}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              >
                <View style={[styles.optionLabel, { borderColor: optionBorder }]}>
                  <Text style={[styles.optionLabelText, { color: optionTextColor }]}>{label}</Text>
                </View>
                <Text style={[styles.optionText, { color: optionTextColor }]}>{option}</Text>
                {answered && isCorrectOption && (
                  <Text style={styles.checkMark}>✓</Text>
                )}
                {answered && isSelected && !isCorrectOption && (
                  <Text style={styles.crossMark}>✗</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Feedback */}
      {answered && (
        <View style={[styles.feedback, { backgroundColor: isCorrect ? '#22c55e15' : '#ef444415' }]}>
          <Text style={[styles.feedbackTitle, { color: isCorrect ? '#22c55e' : '#ef4444' }]}>
            {isCorrect ? '🎉 Correct!' : '❌ Not quite'}
          </Text>
          {payload.explanation && (
            <Text style={[styles.feedbackText, { color: mutedColor }]}>
              {payload.explanation}
            </Text>
          )}
          {!isCorrect && (
            <Text style={[styles.correctAns, { color: textColor }]}>
              Correct answer: <Text style={{ fontWeight: '700' }}>{payload.correct}</Text>
            </Text>
          )}
        </View>
      )}
    </Animated.View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  questionNum: {
    fontSize: 13,
    fontWeight: '700',
  },
  badge: {
    fontSize: 11,
    fontWeight: '500',
  },
  diffBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  diffText: {
    fontSize: 11,
    fontWeight: '600',
  },
  question: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
    marginBottom: 16,
  },
  optionsArea: {
    gap: 10,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    minHeight: 56,
    gap: 12,
  },
  optionLabel: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionLabelText: {
    fontSize: 16,
    fontWeight: '700',
  },
  optionText: {
    fontSize: 17,
    flex: 1,
  },
  checkMark: {
    fontSize: 18,
    color: '#22c55e',
    fontWeight: '700',
  },
  crossMark: {
    fontSize: 18,
    color: '#ef4444',
    fontWeight: '700',
  },
  fillBlankArea: {
    gap: 8,
  },
  fillInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 17,
    minHeight: 52,
  },
  submitBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    minHeight: 52,
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 17,
  },
  feedback: {
    marginTop: 12,
    borderRadius: 10,
    padding: 12,
  },
  feedbackTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  feedbackText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  correctAns: {
    fontSize: 13,
    marginTop: 4,
  },
});

export default InlineQuizCard;
