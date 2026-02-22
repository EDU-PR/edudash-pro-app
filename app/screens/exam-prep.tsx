/**
 * Exam Prep Screen (React Native)
 *
 * Incremental Exam Prep V2 upgrade:
 * - 4-step wizard (grade -> subject -> type -> review)
 * - Mobile-safe two-column subject cards
 * - Teacher-context preview summary before generation
 * - Routes to structured exam generation screen
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { hasCapability, getRequiredTier, type Tier } from '@/lib/ai/capabilities';
import { getCapabilityTier, normalizeTierName } from '@/lib/tiers';
import { assertSupabase } from '@/lib/supabase';
import {
  EXAM_TYPES,
  GRADES,
  LANGUAGE_OPTIONS,
  SUBJECTS_BY_PHASE,
  getPhaseFromGrade,
  type ExamContextSummary,
  type ExamGenerationResponse,
  type SouthAfricanLanguage,
} from '@/components/exam-prep/types';

import EduDashSpinner from '@/components/ui/EduDashSpinner';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SUBJECT_CARD_WIDTH = Math.max(140, Math.floor((SCREEN_WIDTH - 16 * 2 - 12) / 2));

type WizardStep = 'grade' | 'subject' | 'type' | 'review';
type SubjectCategory = 'all' | 'core' | 'languages' | 'sciences' | 'social';

const SUBJECT_CATEGORY_OPTIONS: Array<{ id: SubjectCategory; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'core', label: 'Core' },
  { id: 'languages', label: 'Languages' },
  { id: 'sciences', label: 'Sciences' },
  { id: 'social', label: 'Social' },
];

function getSubjectCategory(subject: string): SubjectCategory {
  const s = subject.toLowerCase();

  if (
    s.includes('language') ||
    s.includes('english') ||
    s.includes('afrikaans') ||
    s.includes('isizulu') ||
    s.includes('isixhosa') ||
    s.includes('sepedi')
  ) {
    return 'languages';
  }

  if (
    s.includes('science') ||
    s.includes('technology') ||
    s.includes('computer') ||
    s.includes('physical') ||
    s.includes('life sciences')
  ) {
    return 'sciences';
  }

  if (
    s.includes('history') ||
    s.includes('geography') ||
    s.includes('economic') ||
    s.includes('business') ||
    s.includes('accounting') ||
    s.includes('tourism')
  ) {
    return 'social';
  }

  if (s.includes('math') || s.includes('life skills') || s.includes('life orientation')) {
    return 'core';
  }

  return 'all';
}

function getSubjectIcon(subject: string): string {
  const s = subject.toLowerCase();
  if (s.includes('math')) return 'calculator';
  if (s.includes('english') || s.includes('language')) return 'book';
  if (s.includes('science')) return 'flask';
  if (s.includes('history')) return 'time';
  if (s.includes('geography')) return 'globe';
  if (s.includes('life')) return 'heart';
  if (s.includes('economic') || s.includes('business') || s.includes('accounting')) return 'cash';
  if (s.includes('technology') || s.includes('computer')) return 'laptop';
  if (s.includes('art') || s.includes('creative')) return 'color-palette';
  return 'book-outline';
}

function toSafeParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default function ExamPrepScreen() {
  const { theme, isDark } = useTheme();
  const { tier } = useSubscription();
  const params = useLocalSearchParams<{
    grade?: string;
    childName?: string;
    studentId?: string;
    classId?: string;
    schoolId?: string;
  }>();

  const gradeParam = toSafeParam(params.grade);
  const childName = toSafeParam(params.childName);
  const studentId = toSafeParam(params.studentId);
  const classId = toSafeParam(params.classId);
  const schoolId = toSafeParam(params.schoolId);

  const hasPrefilledGrade = !!(gradeParam && GRADES.some((g) => g.value === gradeParam));

  const [selectedGrade, setSelectedGrade] = useState<string>(hasPrefilledGrade ? gradeParam! : 'grade_4');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedExamType, setSelectedExamType] = useState<string>('practice_test');
  const [selectedLanguage, setSelectedLanguage] = useState<SouthAfricanLanguage>('en-ZA');
  const [step, setStep] = useState<WizardStep>(hasPrefilledGrade ? 'subject' : 'grade');

  const [subjectSearch, setSubjectSearch] = useState('');
  const [subjectCategory, setSubjectCategory] = useState<SubjectCategory>('all');

  const [useTeacherContext, setUseTeacherContext] = useState(true);
  const [contextPreview, setContextPreview] = useState<ExamContextSummary | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);

  const phase = getPhaseFromGrade(selectedGrade);
  const subjects = SUBJECTS_BY_PHASE[phase] || [];
  const gradeInfo = GRADES.find((g) => g.value === selectedGrade);
  const tierForCaps: Tier = getCapabilityTier(normalizeTierName(tier || 'free'));
  const canUseExamPrep = hasCapability(tierForCaps, 'exam.practice');
  const requiredExamTier = getRequiredTier('exam.practice');
  const selectedExamTypeCard = EXAM_TYPES.find((item) => item.id === selectedExamType);

  const filteredSubjects = useMemo(() => {
    const search = subjectSearch.trim().toLowerCase();

    return subjects.filter((subject) => {
      const category = getSubjectCategory(subject);
      const categoryMatches = subjectCategory === 'all' || category === subjectCategory;
      const searchMatches = !search || subject.toLowerCase().includes(search);
      return categoryMatches && searchMatches;
    });
  }, [subjects, subjectSearch, subjectCategory]);

  const contextPreviewKey = `${selectedGrade}|${selectedSubject}|${selectedExamType}|${selectedLanguage}|${studentId || ''}|${classId || ''}|${schoolId || ''}|${useTeacherContext ? '1' : '0'}`;

  const fetchContextPreview = useCallback(async () => {
    if (!selectedGrade || !selectedSubject || !selectedExamType || !useTeacherContext) {
      setContextPreview(null);
      setContextError(null);
      return;
    }

    setContextLoading(true);
    setContextError(null);

    try {
      const supabase = assertSupabase();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const invokeOptions: {
        body: Record<string, unknown>;
        headers?: Record<string, string>;
      } = {
        body: {
          grade: selectedGrade,
          subject: selectedSubject,
          examType: selectedExamType,
          language: selectedLanguage,
          studentId,
          classId,
          schoolId,
          useTeacherContext: true,
          previewContext: true,
        },
      };

      if (token) {
        invokeOptions.headers = { Authorization: `Bearer ${token}` };
      }

      const { data, error } = await supabase.functions.invoke('generate-exam', invokeOptions);
      if (error) {
        throw new Error(error.message || 'Could not load teacher context');
      }

      const response = data as ExamGenerationResponse;
      if (!response?.success) {
        throw new Error(response?.error || 'Could not load teacher context');
      }

      setContextPreview(
        response.contextSummary || {
          assignmentCount: 0,
          lessonCount: 0,
          focusTopics: [],
          weakTopics: [],
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load teacher context';
      setContextError(message);
      setContextPreview(null);
    } finally {
      setContextLoading(false);
    }
  }, [
    selectedGrade,
    selectedSubject,
    selectedExamType,
    selectedLanguage,
    studentId,
    classId,
    schoolId,
    useTeacherContext,
  ]);

  useEffect(() => {
    if (step !== 'review') return;

    if (!useTeacherContext) {
      setContextPreview(null);
      setContextError(null);
      setContextLoading(false);
      return;
    }

    fetchContextPreview();
  }, [step, useTeacherContext, fetchContextPreview, contextPreviewKey]);

  const moveToStep = useCallback((nextStep: WizardStep) => {
    setStep(nextStep);
  }, []);

  const handleStartGeneration = useCallback(
    (withTeacherContext: boolean) => {
      if (!selectedGrade || !selectedSubject || !selectedExamType) {
        return;
      }

      const generationParams: Record<string, string> = {
        grade: selectedGrade,
        subject: selectedSubject,
        examType: selectedExamType,
        language: selectedLanguage,
        useTeacherContext: withTeacherContext ? '1' : '0',
      };

      if (childName) generationParams.childName = childName;
      if (studentId) generationParams.studentId = studentId;
      if (classId) generationParams.classId = classId;
      if (schoolId) generationParams.schoolId = schoolId;

      router.push({
        pathname: '/screens/exam-generation',
        params: generationParams,
      } as any);
    },
    [selectedGrade, selectedSubject, selectedExamType, selectedLanguage, childName, studentId, classId, schoolId]
  );

  const renderGradeStep = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: theme.text }]}>Select Grade</Text>
      <Text style={[styles.stepSubtitle, { color: theme.muted }]}>Choose the learner grade level first.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gradeScroll}>
        {GRADES.map((grade) => {
          const isSelected = selectedGrade === grade.value;
          return (
            <TouchableOpacity
              key={grade.value}
              style={[
                styles.gradeCard,
                {
                  backgroundColor: isSelected ? theme.primary : theme.surface,
                  borderColor: isSelected ? theme.primary : theme.border,
                },
              ]}
              onPress={() => {
                setSelectedGrade(grade.value);
                setSelectedSubject('');
                setSubjectSearch('');
                setSubjectCategory('all');
              }}
            >
              <Text style={[styles.gradeLabel, { color: isSelected ? '#ffffff' : theme.text }]}>{grade.label}</Text>
              <Text
                style={[
                  styles.gradeAge,
                  { color: isSelected ? 'rgba(255,255,255,0.8)' : theme.muted },
                ]}
              >
                Ages {grade.age}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity style={[styles.nextButton, { backgroundColor: theme.primary }]} onPress={() => moveToStep('subject')}>
        <Text style={styles.nextButtonText}>Next: Choose Subject</Text>
        <Ionicons name="arrow-forward" size={18} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );

  const renderSubjectStep = () => (
    <View style={styles.stepContainer}>
      <TouchableOpacity style={styles.backStepButton} onPress={() => moveToStep('grade')}>
        <Ionicons name="arrow-back" size={18} color={theme.primary} />
        <Text style={[styles.backStepText, { color: theme.primary }]}>Back to Grade</Text>
      </TouchableOpacity>

      <Text style={[styles.stepTitle, { color: theme.text }]}>Select Subject</Text>
      <Text style={[styles.stepSubtitle, { color: theme.muted }]}>
        {gradeInfo?.label} • CAPS curriculum
      </Text>

      <View style={[styles.searchWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
        <Ionicons name="search" size={16} color={theme.muted} />
        <TextInput
          value={subjectSearch}
          onChangeText={setSubjectSearch}
          placeholder="Search subjects"
          placeholderTextColor={theme.muted}
          style={[styles.searchInput, { color: theme.text }]}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
        {SUBJECT_CATEGORY_OPTIONS.map((option) => {
          const isSelected = subjectCategory === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: isSelected ? theme.primary : theme.surface,
                  borderColor: isSelected ? theme.primary : theme.border,
                },
              ]}
              onPress={() => setSubjectCategory(option.id)}
            >
              <Text style={[styles.categoryChipText, { color: isSelected ? '#ffffff' : theme.text }]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.subjectGrid}>
        {filteredSubjects.map((item) => {
          const isSelected = selectedSubject === item;
          return (
            <TouchableOpacity
              key={item}
              style={[
                styles.subjectCard,
                {
                  backgroundColor: isSelected ? theme.primary : theme.surface,
                  borderColor: isSelected ? theme.primary : theme.border,
                },
              ]}
              onPress={() => setSelectedSubject(item)}
            >
              <Ionicons
                name={getSubjectIcon(item) as any}
                size={20}
                color={isSelected ? '#ffffff' : theme.primary}
              />
              <Text
                style={[styles.subjectLabel, { color: isSelected ? '#ffffff' : theme.text }]}
                numberOfLines={3}
              >
                {item}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {filteredSubjects.length === 0 && (
        <View style={[styles.emptySubjects, { borderColor: theme.border, backgroundColor: theme.surface }]}> 
          <Text style={[styles.emptySubjectsText, { color: theme.muted }]}>No subjects match your current filter.</Text>
        </View>
      )}

      {!!selectedSubject && (
        <TouchableOpacity style={[styles.nextButton, { backgroundColor: theme.primary }]} onPress={() => moveToStep('type')}>
          <Text style={styles.nextButtonText}>Next: Choose Exam Type</Text>
          <Ionicons name="arrow-forward" size={18} color="#ffffff" />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderTypeStep = () => (
    <View style={styles.stepContainer}>
      <TouchableOpacity style={styles.backStepButton} onPress={() => moveToStep('subject')}>
        <Ionicons name="arrow-back" size={18} color={theme.primary} />
        <Text style={[styles.backStepText, { color: theme.primary }]}>Back to Subject</Text>
      </TouchableOpacity>

      <Text style={[styles.stepTitle, { color: theme.text }]}>Choose Exam Type</Text>
      <Text style={[styles.stepSubtitle, { color: theme.muted }]}>
        {gradeInfo?.label} • {selectedSubject}
      </Text>

      <View style={styles.examTypeGrid}>
        {EXAM_TYPES.map((examType) => {
          const isSelected = selectedExamType === examType.id;
          return (
            <TouchableOpacity
              key={examType.id}
              style={[
                styles.examTypeCard,
                {
                  backgroundColor: isSelected ? examType.color : theme.surface,
                  borderColor: isSelected ? examType.color : theme.border,
                },
              ]}
              onPress={() => setSelectedExamType(examType.id)}
            >
              <Ionicons name={examType.icon as any} size={24} color={isSelected ? '#ffffff' : examType.color} />
              <Text style={[styles.examTypeLabel, { color: isSelected ? '#ffffff' : theme.text }]}>
                {examType.label}
              </Text>
              <Text
                style={[
                  styles.examTypeDesc,
                  { color: isSelected ? 'rgba(255,255,255,0.9)' : theme.muted },
                ]}
              >
                {examType.description}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.languageSection}>
        <Text style={[styles.languageLabel, { color: theme.text }]}>Response Language</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.languageScroll}>
          {(Object.entries(LANGUAGE_OPTIONS) as [SouthAfricanLanguage, string][]).map(([code, label]) => {
            const isSelected = selectedLanguage === code;
            return (
              <TouchableOpacity
                key={code}
                style={[
                  styles.languageChip,
                  {
                    backgroundColor: isSelected ? theme.primary : theme.surface,
                    borderColor: isSelected ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => setSelectedLanguage(code)}
              >
                <Text style={[styles.languageChipText, { color: isSelected ? '#ffffff' : theme.text }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <TouchableOpacity style={[styles.nextButton, { backgroundColor: theme.primary }]} onPress={() => moveToStep('review')}>
        <Text style={styles.nextButtonText}>Next: Review & Generate</Text>
        <Ionicons name="arrow-forward" size={18} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );

  const renderContextPreview = () => {
    if (!useTeacherContext) {
      return (
        <View style={[styles.contextCard, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
          <Text style={[styles.contextLabel, { color: theme.text }]}>Teacher context disabled</Text>
          <Text style={[styles.contextSubLabel, { color: theme.muted }]}>Exam will use CAPS baseline only.</Text>
        </View>
      );
    }

    if (contextLoading) {
      return (
        <View style={[styles.contextCard, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
          <EduDashSpinner color={theme.primary} />
          <Text style={[styles.contextSubLabel, { color: theme.muted }]}>Loading teacher artifacts for this learner...</Text>
        </View>
      );
    }

    if (contextError) {
      return (
        <View style={[styles.contextCard, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
          <Text style={[styles.contextLabel, { color: theme.text }]}>Could not fetch teacher context</Text>
          <Text style={[styles.contextSubLabel, { color: theme.muted }]}>{contextError}</Text>
        </View>
      );
    }

    const summary = contextPreview;
    return (
      <View style={[styles.contextCard, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
        <Text style={[styles.contextLabel, { color: theme.text }]}>Teacher context found</Text>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryChip, { backgroundColor: `${theme.primary}22` }]}>
            <Text style={[styles.summaryChipText, { color: theme.primary }]}>Assignments: {summary?.assignmentCount ?? 0}</Text>
          </View>
          <View style={[styles.summaryChip, { backgroundColor: `${theme.primary}22` }]}>
            <Text style={[styles.summaryChipText, { color: theme.primary }]}>Lessons: {summary?.lessonCount ?? 0}</Text>
          </View>
        </View>

        {summary?.focusTopics?.length ? (
          <View style={styles.topicBlock}>
            <Text style={[styles.topicHeading, { color: theme.text }]}>Focus topics</Text>
            <Text style={[styles.contextSubLabel, { color: theme.muted }]} numberOfLines={3}>
              {summary.focusTopics.slice(0, 6).join(' • ')}
            </Text>
          </View>
        ) : null}

        {summary?.weakTopics?.length ? (
          <View style={styles.topicBlock}>
            <Text style={[styles.topicHeading, { color: theme.text }]}>Weak-topic signals</Text>
            <Text style={[styles.contextSubLabel, { color: theme.muted }]} numberOfLines={3}>
              {summary.weakTopics.slice(0, 6).join(' • ')}
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  const renderReviewStep = () => (
    <View style={styles.stepContainer}>
      <TouchableOpacity style={styles.backStepButton} onPress={() => moveToStep('type')}>
        <Ionicons name="arrow-back" size={18} color={theme.primary} />
        <Text style={[styles.backStepText, { color: theme.primary }]}>Back to Type</Text>
      </TouchableOpacity>

      <Text style={[styles.stepTitle, { color: theme.text }]}>Review & Generate</Text>
      <Text style={[styles.stepSubtitle, { color: theme.muted }]}>Confirm your setup before generating the practice exam.</Text>

      <View style={[styles.reviewCard, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
        <View style={styles.reviewRow}>
          <Text style={[styles.reviewLabel, { color: theme.muted }]}>Learner</Text>
          <Text style={[styles.reviewValue, { color: theme.text }]}>{childName || 'Current learner'}</Text>
        </View>
        <View style={styles.reviewRow}>
          <Text style={[styles.reviewLabel, { color: theme.muted }]}>Grade</Text>
          <Text style={[styles.reviewValue, { color: theme.text }]}>{gradeInfo?.label || selectedGrade}</Text>
        </View>
        <View style={styles.reviewRow}>
          <Text style={[styles.reviewLabel, { color: theme.muted }]}>Subject</Text>
          <Text style={[styles.reviewValue, { color: theme.text }]}>{selectedSubject}</Text>
        </View>
        <View style={styles.reviewRow}>
          <Text style={[styles.reviewLabel, { color: theme.muted }]}>Type</Text>
          <Text style={[styles.reviewValue, { color: theme.text }]}>{selectedExamTypeCard?.label || selectedExamType}</Text>
        </View>
        <View style={styles.reviewRow}>
          <Text style={[styles.reviewLabel, { color: theme.muted }]}>Language</Text>
          <Text style={[styles.reviewValue, { color: theme.text }]}>{LANGUAGE_OPTIONS[selectedLanguage]}</Text>
        </View>
      </View>

      <View style={styles.contextToggleRow}>
        <TouchableOpacity
          style={[
            styles.contextToggle,
            {
              backgroundColor: useTeacherContext ? theme.primary : theme.surface,
              borderColor: useTeacherContext ? theme.primary : theme.border,
            },
          ]}
          onPress={() => setUseTeacherContext(true)}
        >
          <Text style={[styles.contextToggleText, { color: useTeacherContext ? '#ffffff' : theme.text }]}>Use teacher context</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.contextToggle,
            {
              backgroundColor: !useTeacherContext ? theme.primary : theme.surface,
              borderColor: !useTeacherContext ? theme.primary : theme.border,
            },
          ]}
          onPress={() => setUseTeacherContext(false)}
        >
          <Text style={[styles.contextToggleText, { color: !useTeacherContext ? '#ffffff' : theme.text }]}>CAPS only</Text>
        </TouchableOpacity>
      </View>

      {renderContextPreview()}

      <TouchableOpacity style={[styles.generateButton, { backgroundColor: '#22c55e' }]} onPress={() => handleStartGeneration(useTeacherContext)}>
        <Ionicons name="sparkles" size={22} color="#ffffff" />
        <Text style={styles.generateButtonText}>Generate Practice Exam</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.secondaryGenerateButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
        onPress={() => handleStartGeneration(false)}
      >
        <Text style={[styles.secondaryGenerateText, { color: theme.text }]}>Generate without teacher context</Text>
      </TouchableOpacity>
    </View>
  );

  if (!canUseExamPrep) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        <Stack.Screen options={{ title: 'Exam Prep' }} />
        <View style={styles.disabledContainer}>
          <Ionicons name="lock-closed-outline" size={64} color={theme.muted} />
          <Text style={[styles.disabledText, { color: theme.text }]}>Exam Prep is locked</Text>
          <Text style={[styles.disabledSubtext, { color: theme.muted }]}>Upgrade to {requiredExamTier || 'Starter'} to unlock exam practice features.</Text>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: theme.primary }]} onPress={() => router.push('/screens/manage-subscription')}>
            <Text style={styles.backButtonText}>Manage Plan</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentStep = step === 'grade' ? 1 : step === 'subject' ? 2 : step === 'type' ? 3 : 4;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <Stack.Screen
        options={{
          title: 'Exam Prep',
          headerRight: () => (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>CAPS</Text>
            </View>
          ),
        }}
      />

      <LinearGradient colors={isDark ? ['#1e293b', '#0f172a'] : ['#f0f9ff', '#e0f2fe']} style={styles.header}>
        <View style={styles.headerContent}>
          <Ionicons name="school" size={32} color={theme.primary} />
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>AI-Powered Exam Prep</Text>
            <Text style={[styles.headerSubtitle, { color: theme.muted }]}>Structured CAPS-aligned generation from real teacher artifacts.</Text>
          </View>
        </View>

        <View style={styles.progressSteps}>
          {['Grade', 'Subject', 'Type', 'Review'].map((label, index) => {
            const stepNum = index + 1;
            const isActive = stepNum <= currentStep;
            return (
              <View key={label} style={styles.progressStep}>
                <View style={[styles.progressDot, { backgroundColor: isActive ? theme.primary : theme.border }]}>
                  {stepNum < currentStep ? <Ionicons name="checkmark" size={12} color="#ffffff" /> : null}
                </View>
                <Text style={[styles.progressLabel, { color: isActive ? theme.primary : theme.muted }]}>{label}</Text>
              </View>
            );
          })}
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
        {step === 'grade' && renderGradeStep()}
        {step === 'subject' && renderSubjectStep()}
        {step === 'type' && renderTypeStep()}
        {step === 'review' && renderReviewStep()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  disabledContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  disabledText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  disabledSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  header: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    marginLeft: 16,
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  headerBadge: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  headerBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  progressSteps: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  progressStep: {
    alignItems: 'center',
  },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressLabel: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
    paddingBottom: 40,
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  backStepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backStepText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  gradeScroll: {
    paddingVertical: 8,
  },
  gradeCard: {
    width: 102,
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    marginRight: 12,
    alignItems: 'center',
  },
  gradeLabel: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  gradeAge: {
    fontSize: 11,
    marginTop: 4,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    marginLeft: 8,
  },
  categoryScroll: {
    paddingBottom: 10,
    paddingTop: 2,
  },
  categoryChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  subjectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  subjectCard: {
    width: SUBJECT_CARD_WIDTH,
    minHeight: 112,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    justifyContent: 'space-between',
  },
  subjectLabel: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  emptySubjects: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  emptySubjectsText: {
    fontSize: 13,
  },
  nextButton: {
    marginTop: 14,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  examTypeGrid: {
    gap: 10,
  },
  examTypeCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  examTypeLabel: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '700',
  },
  examTypeDesc: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
  },
  languageSection: {
    marginTop: 14,
  },
  languageLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  languageScroll: {
    paddingBottom: 4,
  },
  languageChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  languageChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  reviewCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  reviewLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  reviewValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    marginLeft: 10,
  },
  contextToggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  contextToggle: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  contextCard: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  contextLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  contextSubLabel: {
    fontSize: 12,
    lineHeight: 18,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  summaryChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  summaryChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  topicBlock: {
    marginTop: 4,
  },
  topicHeading: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  generateButton: {
    marginTop: 14,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  generateButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryGenerateButton: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryGenerateText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
