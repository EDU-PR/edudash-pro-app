/**
 * ExamFooter Component
 *
 * Navigation (Previous/Next), Submit button (text answers only),
 * Complete Exam button on last question, and inline notice card.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ExamQuestion } from '@/lib/examParser';

interface ExamFooterProps {
  currentIndex: number;
  totalQuestions: number;
  questionType: ExamQuestion['type'];
  currentAnswer: string;
  hasExistingAnswer: boolean;
  submitting: boolean;
  uiNotice: { type: 'info' | 'success' | 'warning' | 'error'; text: string } | null;
  onPrevious: () => void;
  onNext: () => void;
  onSubmitAnswer: () => void;
  onCompleteExam: () => void;
  theme: Record<string, string>;
}

const TEXT_QUESTION_TYPES: ExamQuestion['type'][] = [
  'short_answer',
  'essay',
  'fill_blank',
  'fill_in_blank',
];

export function ExamFooter({
  currentIndex,
  totalQuestions,
  questionType,
  currentAnswer,
  hasExistingAnswer,
  submitting,
  uiNotice,
  onPrevious,
  onNext,
  onSubmitAnswer,
  onCompleteExam,
  theme,
}: ExamFooterProps) {
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const isFirstQuestion = currentIndex === 0;
  const isTextType = TEXT_QUESTION_TYPES.includes(questionType);
  const showSubmit = isTextType && currentAnswer.trim().length > 0;

  return (
    <View style={[styles.footer, { backgroundColor: theme.surface }]}>
      {uiNotice ? (
        <View
          style={[
            styles.noticeCard,
            {
              backgroundColor:
                uiNotice.type === 'success'
                  ? '#10b9811f'
                  : uiNotice.type === 'warning'
                  ? '#f59e0b1f'
                  : uiNotice.type === 'error'
                  ? '#ef44441f'
                  : theme.background,
              borderColor:
                uiNotice.type === 'success'
                  ? '#10b981'
                  : uiNotice.type === 'warning'
                  ? '#f59e0b'
                  : uiNotice.type === 'error'
                  ? '#ef4444'
                  : theme.border,
            },
          ]}
        >
          <Text style={[styles.noticeText, { color: theme.text }]}>{uiNotice.text}</Text>
        </View>
      ) : null}

      {showSubmit && (
        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: theme.primary },
            submitting && styles.submitButtonDisabled,
          ]}
          onPress={onSubmitAnswer}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Text style={styles.submitButtonText}>
                {hasExistingAnswer ? 'Update Answer' : 'Submit Answer'}
              </Text>
              <Ionicons name="checkmark" size={20} color="#ffffff" />
            </>
          )}
        </TouchableOpacity>
      )}

      <View style={styles.footerNavRow}>
        <TouchableOpacity
          style={[
            styles.navButtonWide,
            { backgroundColor: theme.background },
            isFirstQuestion && styles.navButtonDisabled,
          ]}
          onPress={onPrevious}
          disabled={isFirstQuestion}
        >
          <Ionicons
            name="chevron-back"
            size={20}
            color={isFirstQuestion ? theme.textTertiary : theme.text}
          />
          <Text
            style={[
              styles.navButtonText,
              { color: isFirstQuestion ? theme.textTertiary : theme.text },
            ]}
          >
            Previous
          </Text>
        </TouchableOpacity>

        {isLastQuestion ? (
          <TouchableOpacity
            style={[styles.completeButton, { backgroundColor: '#10b981' }]}
            onPress={onCompleteExam}
          >
            <Text style={styles.completeButtonText}>Complete Exam</Text>
            <Ionicons name="trophy" size={20} color="#ffffff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.navButtonWide, { backgroundColor: theme.background }]}
            onPress={onNext}
          >
            <Text style={[styles.navButtonText, { color: theme.text }]}>Next</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.text} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 10,
  },
  noticeCard: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  footerNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navButtonWide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 4,
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  completeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  completeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
