/**
 * ExamQuestionCard Component
 *
 * Renders the current question: reading passage, question text,
 * answer options / text input, and post-submission feedback.
 */

import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ExamQuestion, ExamSection } from '@/lib/examParser';
import type { StudentAnswer } from '@/hooks/useExamSession';

interface ExamQuestionCardProps {
  section: ExamSection;
  question: ExamQuestion;
  currentIndex: number;
  currentAnswer: string;
  studentAnswer?: StudentAnswer;
  isLocked: boolean;
  onChangeAnswer: (text: string) => void;
  onSelectOption: (option: string) => void;
  theme: Record<string, string>;
}

function questionTypeIcon(type: ExamQuestion['type']): { name: string; label: string } {
  switch (type) {
    case 'multiple_choice':
      return { name: 'radio-button-on', label: 'Multiple Choice' };
    case 'true_false':
      return { name: 'swap-horizontal', label: 'True / False' };
    case 'short_answer':
    case 'fill_blank':
    case 'fill_in_blank':
      return { name: 'pencil', label: 'Short Answer' };
    case 'essay':
      return { name: 'document-text', label: 'Essay' };
    case 'matching':
      return { name: 'git-compare', label: 'Matching' };
    default:
      return { name: 'help-circle', label: '' };
  }
}

export function ExamQuestionCard({
  section,
  question,
  currentIndex,
  currentAnswer,
  studentAnswer,
  isLocked,
  onChangeAnswer,
  onSelectOption,
  theme,
}: ExamQuestionCardProps) {
  const typeInfo = questionTypeIcon(question.type);

  return (
    <>
      {/* Section Title */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.primary }]}>
          {section.title}
        </Text>
        {section.instructions ? (
          <Text style={[styles.sectionInstructions, { color: theme.textSecondary }]}>
            {section.instructions}
          </Text>
        ) : null}
      </View>

      {/* Reading Passage */}
      {section.readingPassage ? (
        <View style={[styles.readingPassageCard, { backgroundColor: theme.surface }]}>
          <View style={styles.passageLabelRow}>
            <Ionicons name="book-outline" size={14} color={theme.primary} />
            <Text style={[styles.readingPassageTitle, { color: theme.primary }]}>
              Passage
            </Text>
          </View>
          <Text style={[styles.readingPassageText, { color: theme.text }]}>
            {section.readingPassage}
          </Text>
        </View>
      ) : null}

      {/* Question Card */}
      <View style={[styles.questionCard, { backgroundColor: theme.surface }]}>
        <View style={styles.questionHeader}>
          <View style={styles.questionNumberRow}>
            <Ionicons
              name={typeInfo.name as any}
              size={14}
              color={theme.textSecondary}
            />
            <Text style={[styles.questionNumber, { color: theme.textSecondary }]}>
              Question {currentIndex + 1}
            </Text>
          </View>
          <View style={[styles.marksBadge, { backgroundColor: theme.primary + '20' }]}>
            <Text style={[styles.marksLabel, { color: theme.primary }]}>
              {question.marks} {question.marks === 1 ? 'mark' : 'marks'}
            </Text>
          </View>
        </View>

        <Text style={[styles.questionText, { color: theme.text }]}>
          {question.question}
        </Text>

        {/* Multiple Choice Options */}
        {question.type === 'multiple_choice' && question.options && (
          <View style={styles.optionsContainer}>
            {question.options.map((option, index) => {
              const optionLetter = String.fromCharCode(65 + index);
              const cleanedOption = option.replace(/^\s*[A-D]\s*[\.\)\-:]\s*/i, '').trim();
              const isSelected =
                currentAnswer === option ||
                currentAnswer === cleanedOption ||
                currentAnswer === optionLetter;

              const isCorrectOption =
                question.correctAnswer === cleanedOption ||
                question.correctAnswer === option ||
                question.correctAnswer === optionLetter;

              let lockedBg = theme.background;
              let lockedBorder = theme.border;
              let lockedTextColor = theme.text;
              let lockedIcon: React.ReactNode = null;

              if (isLocked) {
                if (isSelected && isCorrectOption) {
                  lockedBg = '#10b98120';
                  lockedBorder = '#10b981';
                  lockedTextColor = '#10b981';
                  lockedIcon = <Ionicons name="checkmark" size={12} color="#10b981" />;
                } else if (isSelected && !isCorrectOption) {
                  lockedBg = '#ef444420';
                  lockedBorder = '#ef4444';
                  lockedTextColor = '#ef4444';
                  lockedIcon = <Ionicons name="close" size={12} color="#ef4444" />;
                } else if (isCorrectOption) {
                  lockedBg = '#10b98120';
                  lockedBorder = '#10b981';
                  lockedTextColor = '#10b981';
                  lockedIcon = <Ionicons name="checkmark" size={12} color="#10b981" />;
                }
              }

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.optionButton,
                    {
                      backgroundColor: isLocked
                        ? lockedBg
                        : isSelected ? theme.primary + '20' : theme.background,
                      borderColor: isLocked
                        ? lockedBorder
                        : isSelected ? theme.primary : theme.border,
                      opacity: isLocked && !isSelected && !isCorrectOption ? 0.7 : 1,
                    },
                  ]}
                  onPress={() => { if (!isLocked) onSelectOption(cleanedOption); }}
                  disabled={isLocked}
                  activeOpacity={isLocked ? 1 : 0.7}
                >
                  <View
                    style={[
                      styles.optionCircle,
                      {
                        borderColor: isLocked
                          ? lockedBorder
                          : isSelected ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    {isLocked
                      ? lockedIcon
                      : isSelected && (
                          <Ionicons name="checkmark" size={12} color={theme.primary} />
                        )}
                  </View>
                  <Text
                    style={[
                      styles.optionText,
                      {
                        color: isLocked
                          ? lockedTextColor
                          : isSelected ? theme.primary : theme.text,
                      },
                    ]}
                  >
                    {optionLetter}. {cleanedOption}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* True / False */}
        {question.type === 'true_false' && (
          <View style={styles.optionsContainer}>
            {['True', 'False'].map((option) => {
              const isSelected = currentAnswer.toLowerCase() === option.toLowerCase();
              const isCorrectOption =
                question.correctAnswer?.toLowerCase() === option.toLowerCase();

              let lockedBg = theme.background;
              let lockedBorder = theme.border;
              let lockedTextColor = theme.text;
              let lockedIcon: React.ReactNode = null;

              if (isLocked) {
                if (isSelected && isCorrectOption) {
                  lockedBg = '#10b98120';
                  lockedBorder = '#10b981';
                  lockedTextColor = '#10b981';
                  lockedIcon = <Ionicons name="checkmark" size={12} color="#10b981" />;
                } else if (isSelected && !isCorrectOption) {
                  lockedBg = '#ef444420';
                  lockedBorder = '#ef4444';
                  lockedTextColor = '#ef4444';
                  lockedIcon = <Ionicons name="close" size={12} color="#ef4444" />;
                } else if (isCorrectOption) {
                  lockedBg = '#10b98120';
                  lockedBorder = '#10b981';
                  lockedTextColor = '#10b981';
                  lockedIcon = <Ionicons name="checkmark" size={12} color="#10b981" />;
                }
              }

              return (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.optionButton,
                    {
                      backgroundColor: isLocked
                        ? lockedBg
                        : isSelected ? theme.primary + '20' : theme.background,
                      borderColor: isLocked
                        ? lockedBorder
                        : isSelected ? theme.primary : theme.border,
                      opacity: isLocked && !isSelected && !isCorrectOption ? 0.7 : 1,
                    },
                  ]}
                  onPress={() => { if (!isLocked) onSelectOption(option); }}
                  disabled={isLocked}
                  activeOpacity={isLocked ? 1 : 0.7}
                >
                  <View
                    style={[
                      styles.optionCircle,
                      {
                        borderColor: isLocked
                          ? lockedBorder
                          : isSelected ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    {isLocked
                      ? lockedIcon
                      : isSelected && (
                          <Ionicons name="checkmark" size={12} color={theme.primary} />
                        )}
                  </View>
                  <Text
                    style={[
                      styles.optionText,
                      {
                        color: isLocked
                          ? lockedTextColor
                          : isSelected ? theme.primary : theme.text,
                      },
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Text-based Input */}
        {(question.type === 'short_answer' ||
          question.type === 'essay' ||
          question.type === 'fill_blank') && (
          <TextInput
            style={[
              styles.answerInput,
              question.type === 'essay' && styles.essayInput,
              {
                backgroundColor: isLocked ? theme.background + '80' : theme.background,
                borderColor: theme.border,
                color: theme.text,
              },
              isLocked && { opacity: 0.7 },
            ]}
            value={currentAnswer}
            onChangeText={onChangeAnswer}
            placeholder="Type your answer here..."
            placeholderTextColor={theme.textTertiary}
            multiline={question.type === 'essay'}
            numberOfLines={question.type === 'essay' ? 6 : 2}
            editable={!isLocked}
          />
        )}

        {/* Feedback after submission */}
        {studentAnswer?.feedback && (
          <View
            style={[
              styles.feedbackCard,
              {
                backgroundColor: studentAnswer.isCorrect ? '#10b98120' : '#ef444420',
                borderColor: studentAnswer.isCorrect ? '#10b981' : '#ef4444',
              },
            ]}
          >
            <View style={styles.feedbackHeader}>
              <Ionicons
                name={studentAnswer.isCorrect ? 'checkmark-circle' : 'close-circle'}
                size={24}
                color={studentAnswer.isCorrect ? '#10b981' : '#ef4444'}
              />
              <Text
                style={[
                  styles.feedbackTitle,
                  { color: studentAnswer.isCorrect ? '#10b981' : '#ef4444' },
                ]}
              >
                {studentAnswer.isCorrect ? 'Correct!' : 'Incorrect'}
              </Text>
              {studentAnswer.marks !== undefined && (
                <Text
                  style={[
                    styles.feedbackMarks,
                    { color: studentAnswer.isCorrect ? '#10b981' : '#ef4444' },
                  ]}
                >
                  {studentAnswer.marks}/{question.marks}
                </Text>
              )}
            </View>
            <Text style={[styles.feedbackText, { color: theme.text }]}>
              {studentAnswer.feedback}
            </Text>
            {!studentAnswer.isCorrect && question.correctAnswer && (
              <View style={styles.correctAnswerRow}>
                <Text style={[styles.correctAnswerLabel, { color: '#10b981' }]}>
                  Correct answer:
                </Text>
                <Text style={[styles.correctAnswerValue, { color: theme.text }]}>
                  {question.correctAnswer}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionInstructions: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  readingPassageCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  passageLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  readingPassageTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  readingPassageText: {
    fontSize: 16,
    lineHeight: 24,
  },
  questionCard: {
    borderRadius: 12,
    padding: 16,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  questionNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  questionNumber: {
    fontSize: 14,
    fontWeight: '600',
  },
  marksBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  marksLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  questionText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  optionsContainer: {
    marginTop: 8,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: 8,
  },
  optionCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
    fontSize: 15,
  },
  answerInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginTop: 8,
  },
  essayInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  feedbackCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  feedbackTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  feedbackMarks: {
    fontSize: 14,
    fontWeight: '700',
  },
  feedbackText: {
    fontSize: 14,
    lineHeight: 20,
  },
  correctAnswerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
  },
  correctAnswerLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  correctAnswerValue: {
    fontSize: 13,
    flex: 1,
  },
});
