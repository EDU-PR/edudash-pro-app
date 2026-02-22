/**
 * ExamInteractiveView Component
 * 
 * Interactive exam display for mobile app with:
 * - Question navigation
 * - Answer submission
 * - Auto-grading
 * - Progress tracking
 * - Math rendering support
 * 
 * Ported from web app for native usage.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ParsedExam, ExamQuestion, ExamSection } from '@/lib/examParser';
import { useExamSession, StudentAnswer } from '@/hooks/useExamSession';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

interface ExamInteractiveViewProps {
  exam: ParsedExam;
  examId: string;
  studentId?: string;
  classId?: string;
  schoolId?: string;
  onComplete?: (results: ExamResults) => void;
  onExit?: () => void;
}

export interface ExamResults {
  examId: string;
  examTitle: string;
  totalMarks: number;
  earnedMarks: number;
  percentage: number;
  answers: Record<string, StudentAnswer>;
  completedAt: string;
  duration: number; // seconds
}

export function ExamInteractiveView({
  exam,
  examId,
  studentId,
  classId,
  schoolId,
  onComplete,
  onExit,
}: ExamInteractiveViewProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const {
    session,
    loading: sessionLoading,
    submitAnswer,
    goToQuestion,
    completeExam,
    getProgress,
  } = useExamSession({
    examId,
    exam,
    userId: user?.id,
    studentId,
    classId,
    schoolId,
    autoSave: true,
  });

  const [currentAnswer, setCurrentAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uiNotice, setUiNotice] = useState<{ type: 'info' | 'success' | 'warning' | 'error'; text: string } | null>(null);
  const [confirmIncompleteSubmit, setConfirmIncompleteSubmit] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);

  // Flatten all questions
  const allQuestions = useMemo(() => {
    return exam.sections.reduce<Array<{ section: ExamSection; question: ExamQuestion }>>((acc, section) => {
      section.questions.forEach(question => {
        acc.push({ section, question });
      });
      return acc;
    }, []);
  }, [exam]);

  // Current question
  const currentQuestionData = allQuestions[session?.currentQuestionIndex || 0];
  const currentQuestion = currentQuestionData?.question;
  const currentSection = currentQuestionData?.section;

  // Get answer for current question
  const currentStudentAnswer = session?.answers[currentQuestion?.id || ''];

  // Update text input when question changes
  React.useEffect(() => {
    if (currentStudentAnswer) {
      setCurrentAnswer(currentStudentAnswer.answer);
    } else {
      setCurrentAnswer('');
    }
  }, [currentQuestion?.id, currentStudentAnswer]);

  /**
   * Handle answer submission
   */
  const handleSubmitAnswer = useCallback(async () => {
    if (!currentQuestion || !currentAnswer.trim()) {
      setUiNotice({ type: 'warning', text: 'Please provide an answer before submitting.' });
      return;
    }

    try {
      setSubmitting(true);
      const result = await submitAnswer(currentQuestion.id, currentAnswer, true);

      setUiNotice({
        type: result?.isCorrect ? 'success' : 'info',
        text: result?.feedback || 'Answer submitted.',
      });

      logger.info('[ExamView] Answer submitted', {
        questionId: currentQuestion.id,
        isCorrect: result?.isCorrect,
      });
    } catch (error) {
      logger.error('[ExamView] Failed to submit answer', { error });
      setUiNotice({ type: 'error', text: 'Failed to submit answer. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }, [currentQuestion, currentAnswer, submitAnswer]);

  /**
   * Navigate to next question
   */
  const handleNext = useCallback(() => {
    const nextIndex = (session?.currentQuestionIndex || 0) + 1;
    if (nextIndex < allQuestions.length) {
      goToQuestion(nextIndex);
      setConfirmIncompleteSubmit(false);
      setConfirmExit(false);
    }
  }, [session, allQuestions, goToQuestion]);

  /**
   * Navigate to previous question
   */
  const handlePrevious = useCallback(() => {
    const prevIndex = (session?.currentQuestionIndex || 0) - 1;
    if (prevIndex >= 0) {
      goToQuestion(prevIndex);
      setConfirmIncompleteSubmit(false);
      setConfirmExit(false);
    }
  }, [session, goToQuestion]);

  /**
   * Complete exam and show results
   */
  const handleCompleteExam = useCallback(async () => {
    const answeredCount = Object.keys(session?.answers || {}).length;
    const totalCount = allQuestions.length;

    if (answeredCount < totalCount && !confirmIncompleteSubmit) {
      setConfirmIncompleteSubmit(true);
      setUiNotice({
        type: 'warning',
        text: `You answered ${answeredCount} of ${totalCount}. Tap Complete again to submit now.`,
      });
      return;
    }

    const completedSession = await completeExam();
    if (completedSession && onComplete) {
      const startTime = new Date(completedSession.startedAt).getTime();
      const endTime = new Date(completedSession.completedAt || new Date().toISOString()).getTime();
      const duration = Math.floor((endTime - startTime) / 1000);
      const safeTotalMarks = Math.max(1, completedSession.totalMarks || 0);

      const results: ExamResults = {
        examId: completedSession.examId,
        examTitle: exam.title,
        totalMarks: safeTotalMarks,
        earnedMarks: completedSession.earnedMarks,
        percentage: Math.round((completedSession.earnedMarks / safeTotalMarks) * 100),
        answers: completedSession.answers,
        completedAt: completedSession.completedAt || new Date().toISOString(),
        duration,
      };

      if (completedSession.persistenceWarning) {
        setUiNotice({ type: 'warning', text: completedSession.persistenceWarning });
      } else {
        setUiNotice({
          type: 'success',
          text: `Exam submitted. Score: ${results.percentage}% (${results.earnedMarks}/${results.totalMarks}).`,
        });
      }
      onComplete(results);
    }
  }, [session, allQuestions, exam, completeExam, onComplete]);

  /**
   * Exit exam with confirmation
   */
  const handleExit = useCallback(() => {
    if (!confirmExit) {
      setConfirmExit(true);
      setUiNotice({
        type: 'warning',
        text: 'Tap close again to exit. Your progress stays saved.',
      });
      return;
    }
    if (onExit) {
      onExit();
    }
  }, [confirmExit, onExit]);

  // Loading state
  if (sessionLoading || !session || !currentQuestion) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Loading exam...
        </Text>
      </View>
    );
  }

  const progress = getProgress();
  const currentIndex = session.currentQuestionIndex;
  const totalQuestions = allQuestions.length;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <TouchableOpacity onPress={handleExit} style={styles.exitButton}>
          <Ionicons name="close" size={24} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.examTitle, { color: theme.text }]}>
            {exam.title}
          </Text>
          <Text style={[styles.examSubtitle, { color: theme.textSecondary }]}>
            Question {currentIndex + 1} of {totalQuestions}
          </Text>
        </View>

        <View style={styles.headerRight}>
          <Text style={[styles.marksText, { color: theme.textSecondary }]}>
            {session.earnedMarks}/{session.totalMarks}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
        <View
          style={[
            styles.progressFill,
            { backgroundColor: theme.primary, width: `${progress}%` },
          ]}
        />
      </View>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Section Title */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>
            {currentSection.title}
          </Text>
          {currentSection.instructions && (
            <Text style={[styles.sectionInstructions, { color: theme.textSecondary }]}>
              {currentSection.instructions}
            </Text>
          )}
        </View>

        {currentSection.readingPassage ? (
          <View style={[styles.readingPassageCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.readingPassageTitle, { color: theme.primary }]}>Reading passage</Text>
            <Text style={[styles.readingPassageText, { color: theme.text }]}>
              {currentSection.readingPassage}
            </Text>
          </View>
        ) : null}

        {/* Question */}
        <View style={[styles.questionCard, { backgroundColor: theme.surface }]}>
          <View style={styles.questionHeader}>
            <Text style={[styles.questionNumber, { color: theme.textSecondary }]}>
              Question {currentIndex + 1}
            </Text>
            <View style={[styles.marksBadge, { backgroundColor: theme.primary + '20' }]}>
              <Text style={[styles.marksLabel, { color: theme.primary }]}>
                {currentQuestion.marks} {currentQuestion.marks === 1 ? 'mark' : 'marks'}
              </Text>
            </View>
          </View>

          <Text style={[styles.questionText, { color: theme.text }]}>
            {currentQuestion.question}
          </Text>

          {/* Multiple Choice Options */}
          {currentQuestion.type === 'multiple_choice' && currentQuestion.options && (
            <View style={styles.optionsContainer}>
              {currentQuestion.options.map((option, index) => {
                const optionLetter = String.fromCharCode(65 + index); // A, B, C, D
                const cleanedOption = option.replace(/^\s*[A-D]\s*[\.\)\-:]\s*/i, '').trim();
                const isSelected = currentAnswer === option || currentAnswer === cleanedOption || currentAnswer === optionLetter;

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.optionButton,
                      {
                        backgroundColor: isSelected
                          ? theme.primary + '20'
                          : theme.background,
                        borderColor: isSelected
                          ? theme.primary
                          : theme.border,
                      },
                    ]}
                    onPress={() => setCurrentAnswer(cleanedOption)}
                  >
                    <View
                      style={[
                        styles.optionCircle,
                        {
                          borderColor: isSelected
                            ? theme.primary
                            : theme.border,
                        },
                      ]}
                    >
                      {isSelected && (
                        <View
                          style={[
                            styles.optionCircleFill,
                            { backgroundColor: theme.primary },
                          ]}
                        />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.optionText,
                        {
                          color: isSelected
                            ? theme.primary
                            : theme.text,
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

          {currentQuestion.type === 'true_false' && (
            <View style={styles.optionsContainer}>
              {['True', 'False'].map((option) => {
                const isSelected = currentAnswer.toLowerCase() === option.toLowerCase();
                return (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.optionButton,
                      {
                        backgroundColor: isSelected ? theme.primary + '20' : theme.background,
                        borderColor: isSelected ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => setCurrentAnswer(option)}
                  >
                    <View
                      style={[
                        styles.optionCircle,
                        { borderColor: isSelected ? theme.primary : theme.border },
                      ]}
                    >
                      {isSelected && (
                        <View style={[styles.optionCircleFill, { backgroundColor: theme.primary }]} />
                      )}
                    </View>
                    <Text style={[styles.optionText, { color: isSelected ? theme.primary : theme.text }]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Text-based Input */}
          {(currentQuestion.type === 'short_answer' ||
            currentQuestion.type === 'essay' ||
            currentQuestion.type === 'fill_blank') && (
            <TextInput
              style={[
                styles.answerInput,
                currentQuestion.type === 'essay' && styles.essayInput,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              value={currentAnswer}
              onChangeText={setCurrentAnswer}
              placeholder="Type your answer here..."
              placeholderTextColor={theme.textTertiary}
              multiline={currentQuestion.type === 'essay'}
              numberOfLines={currentQuestion.type === 'essay' ? 6 : 2}
              editable
            />
          )}

          {/* Feedback */}
          {currentStudentAnswer?.feedback && (
            <View
              style={[
                styles.feedbackCard,
                {
                  backgroundColor: currentStudentAnswer.isCorrect
                    ? '#10b98120'
                    : '#ef444420',
                  borderColor: currentStudentAnswer.isCorrect ? '#10b981' : '#ef4444',
                },
              ]}
            >
              <View style={styles.feedbackHeader}>
                <Ionicons
                  name={currentStudentAnswer.isCorrect ? 'checkmark-circle' : 'close-circle'}
                  size={24}
                  color={currentStudentAnswer.isCorrect ? '#10b981' : '#ef4444'}
                />
                <Text
                  style={[
                    styles.feedbackTitle,
                    {
                      color: currentStudentAnswer.isCorrect ? '#10b981' : '#ef4444',
                    },
                  ]}
                >
                  {currentStudentAnswer.isCorrect ? 'Correct!' : 'Incorrect'}
                </Text>
              </View>
              <Text style={[styles.feedbackText, { color: theme.text }]}>
                {currentStudentAnswer.feedback}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer Navigation */}
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

        <View style={styles.footerNavRow}>
          <TouchableOpacity
            style={[
              styles.navButtonWide,
              { backgroundColor: theme.background },
              currentIndex === 0 && styles.navButtonDisabled,
            ]}
            onPress={handlePrevious}
            disabled={currentIndex === 0}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={currentIndex === 0 ? theme.textTertiary : theme.text}
            />
            <Text
              style={[
                styles.navButtonText,
                {
                  color:
                    currentIndex === 0 ? theme.textTertiary : theme.text,
                },
              ]}
            >
              Previous
              </Text>
          </TouchableOpacity>

          {currentIndex === totalQuestions - 1 ? (
            <TouchableOpacity
              style={[styles.completeButton, { backgroundColor: '#10b981' }]}
              onPress={handleCompleteExam}
            >
              <Text style={styles.completeButtonText}>Complete Exam</Text>
              <Ionicons name="trophy" size={20} color="#ffffff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.navButtonWide,
                { backgroundColor: theme.background },
                currentIndex === totalQuestions - 1 && styles.navButtonDisabled,
              ]}
              onPress={handleNext}
              disabled={currentIndex === totalQuestions - 1}
            >
              <Text
                style={[
                  styles.navButtonText,
                  {
                    color:
                      currentIndex === totalQuestions - 1
                        ? theme.textTertiary
                        : theme.text,
                  },
                ]}
              >
                Next
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={
                  currentIndex === totalQuestions - 1
                    ? theme.textTertiary
                    : theme.text
                }
              />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: theme.primary },
            (!currentAnswer.trim() || submitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmitAnswer}
          disabled={!currentAnswer.trim() || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Text style={styles.submitButtonText}>
                {currentStudentAnswer ? 'Update Answer' : 'Submit Answer'}
              </Text>
              <Ionicons name="checkmark" size={20} color="#ffffff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  exitButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  examTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  examSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  marksText: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBar: {
    height: 4,
  },
  progressFill: {
    height: '100%',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
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
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  readingPassageTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  readingPassageText: {
    fontSize: 15,
    lineHeight: 22,
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
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCircleFill: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  feedbackTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  feedbackText: {
    fontSize: 14,
    lineHeight: 20,
  },
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
