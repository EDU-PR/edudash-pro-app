/**
 * Exam Generation Screen (React Native)
 *
 * Structured generation flow powered by the generate-exam edge function.
 * Handles loading, error+retry, then renders interactive exam view.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';
import { parseExamMarkdown, type ParsedExam } from '@/lib/examParser';
import { ExamInteractiveView, type ExamResults } from '@/components/exam-prep/ExamInteractiveView';
import type { ExamContextSummary, ExamGenerationResponse } from '@/components/exam-prep/types';
import EduDashSpinner from '@/components/ui/EduDashSpinner';

type GenerationState = 'loading' | 'error' | 'ready';

function toSafeParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function toBool(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  return value === '1' || value.toLowerCase() === 'true';
}

export default function ExamGenerationScreen() {
  const { theme, isDark } = useTheme();
  const params = useLocalSearchParams<{
    grade?: string;
    subject?: string;
    examType?: string;
    type?: string;
    language?: string;
    studentId?: string;
    classId?: string;
    schoolId?: string;
    childName?: string;
    useTeacherContext?: string;
  }>();

  const grade = toSafeParam(params.grade);
  const subject = toSafeParam(params.subject);
  const examType = toSafeParam(params.examType) || toSafeParam(params.type) || 'practice_test';
  const language = toSafeParam(params.language) || 'en-ZA';
  const studentId = toSafeParam(params.studentId);
  const classId = toSafeParam(params.classId);
  const schoolId = toSafeParam(params.schoolId);
  const childName = toSafeParam(params.childName);
  const useTeacherContext = toBool(toSafeParam(params.useTeacherContext), true);

  const [state, setState] = useState<GenerationState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [exam, setExam] = useState<ParsedExam | null>(null);
  const [examId, setExamId] = useState<string>('');
  const [contextSummary, setContextSummary] = useState<ExamContextSummary | null>(null);
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null);

  const generationLabel = useMemo(() => {
    if (!grade || !subject) return 'Preparing generation request...';
    return `Generating ${grade.replace('grade_', 'Grade ')} ${subject}`;
  }, [grade, subject]);

  const parseExamPayload = useCallback((payload: unknown): ParsedExam | null => {
    if (!payload) return null;

    if (typeof payload === 'string') {
      return parseExamMarkdown(payload);
    }

    try {
      const asString = JSON.stringify(payload);
      return parseExamMarkdown(asString);
    } catch (err) {
      return null;
    }
  }, []);

  const generateExam = useCallback(async () => {
    if (!grade || !subject || !examType) {
      setError('Missing required exam details. Please return to Exam Prep and try again.');
      setState('error');
      return;
    }

    setState('loading');
    setError(null);

    try {
      const supabase = assertSupabase();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const invokeOptions: {
        body: Record<string, unknown>;
        headers?: Record<string, string>;
      } = {
        body: {
          grade,
          subject,
          examType,
          language,
          studentId,
          classId,
          schoolId,
          useTeacherContext,
        },
      };

      if (token) {
        invokeOptions.headers = { Authorization: `Bearer ${token}` };
      }

      const { data, error } = await supabase.functions.invoke('generate-exam', invokeOptions);
      if (error) {
        throw new Error(error.message || 'Failed to generate exam');
      }

      const response = data as ExamGenerationResponse;
      if (!response?.success || !response?.exam) {
        throw new Error(response?.error || 'Generation failed. Please try again.');
      }

      const parsed = parseExamPayload(response.exam);
      if (!parsed || !parsed.sections?.length) {
        throw new Error('Generated exam format was invalid. Please retry.');
      }

      setExam({
        ...parsed,
        grade: parsed.grade || grade,
        subject: parsed.subject || subject,
      });
      setExamId(response.examId || `temp-${Date.now()}`);
      setContextSummary(response.contextSummary || null);
      setPersistenceWarning(response.persistenceWarning || null);
      setState('ready');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate exam';
      setError(message);
      setState('error');
    }
  }, [grade, subject, examType, language, studentId, classId, schoolId, useTeacherContext, parseExamPayload]);

  useEffect(() => {
    generateExam();
  }, [generateExam]);

  useEffect(() => {
    if (state !== 'ready' || !persistenceWarning) return;
    Alert.alert('Exam generated', persistenceWarning);
  }, [state, persistenceWarning]);

  const handleBack = useCallback(() => {
    router.back();
  }, []);

  const handleComplete = useCallback(
    (results: ExamResults) => {
      Alert.alert(
        'Exam submitted',
        `Score: ${results.percentage}% (${results.earnedMarks}/${results.totalMarks})`,
        [{ text: 'Done', onPress: () => router.back() }]
      );
    },
    []
  );

  if (state === 'ready' && exam) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <ExamInteractiveView exam={exam} examId={examId} onComplete={handleComplete} onExit={handleBack} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient
        colors={isDark ? ['#0f172a', '#111827'] : ['#eff6ff', '#f8fafc']}
        style={[styles.header, { borderBottomColor: theme.border }]}
      >
        <TouchableOpacity style={[styles.backButton, { borderColor: theme.border }]} onPress={handleBack}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Generating Exam</Text>
          <Text style={[styles.headerSubtitle, { color: theme.muted }]}>
            {childName ? `For ${childName}` : 'Structured CAPS exam pipeline'}
          </Text>
        </View>
      </LinearGradient>

      <View style={styles.contentWrap}>
        {state === 'loading' ? (
          <View style={styles.centerBlock}>
            <EduDashSpinner color={theme.primary} />
            <Text style={[styles.loadingTitle, { color: theme.text }]}>Please wait...</Text>
            <Text style={[styles.loadingText, { color: theme.muted }]}>{generationLabel}</Text>
            <Text style={[styles.loadingSubtext, { color: theme.muted }]}>Using {useTeacherContext ? 'teacher artifacts + CAPS' : 'CAPS baseline'} to build this paper.</Text>
          </View>
        ) : (
          <View style={styles.centerBlock}>
            <View style={[styles.errorIconWrap, { backgroundColor: `${theme.error}22` }]}>
              <Ionicons name="alert-circle" size={28} color={theme.error} />
            </View>
            <Text style={[styles.errorTitle, { color: theme.text }]}>Generation failed</Text>
            <Text style={[styles.errorText, { color: theme.muted }]}>{error || 'Please try again.'}</Text>

            {contextSummary ? (
              <Text style={[styles.contextNote, { color: theme.muted }]}>
                Context found: {contextSummary.assignmentCount} assignments • {contextSummary.lessonCount} lessons
              </Text>
            ) : null}

            <View style={styles.errorButtons}>
              <TouchableOpacity style={[styles.secondaryButton, { borderColor: theme.border }]} onPress={handleBack}>
                <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.primary }]} onPress={generateExam}>
                <Text style={styles.primaryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    marginLeft: 12,
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
  },
  contentWrap: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 22,
  },
  centerBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingTitle: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: '700',
  },
  loadingText: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 14,
  },
  loadingSubtext: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 12,
  },
  errorIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: '700',
  },
  errorText: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  contextNote: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 12,
  },
  errorButtons: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
