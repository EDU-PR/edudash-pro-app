/**
 * Exam Prep Wizard (React Native)
 *
 * Feature component kept outside route file so screens remain thin per WARP.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { ExamPrepReviewStep } from '@/components/exam-prep/ExamPrepWizardReviewStep';
import {
  ExamPrepGradeStep,
  ExamPrepSubjectStep,
  ExamPrepTypeStep,
} from '@/components/exam-prep/ExamPrepWizardSteps';
import {
  GRADES,
  SUBJECTS_BY_PHASE,
  getPhaseFromGrade,
  type ExamContextSummary,
  type ExamGenerationResponse,
  type SouthAfricanLanguage,
} from '@/components/exam-prep/types';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { hasCapability, getRequiredTier, type Tier } from '@/lib/ai/capabilities';
import { parseExamScopeFromUpload } from '@/lib/services/examScopeParsingService';
import { getCapabilityTier, normalizeTierName } from '@/lib/tiers';
import { assertSupabase } from '@/lib/supabase';
import {
  buildExamGenerationHref,
  buildExamRouteParams,
  getSubjectCategory,
  toSafeParam,
  type SubjectCategory,
  type WizardStep,
} from '@/components/exam-prep/examPrepWizard.helpers';
import { examPrepWizardStyles as styles } from '@/components/exam-prep/examPrepWizard.styles';

const MAX_MANUAL_SCOPE_CHARS = 1800;

function inferMimeType(fileNameOrUri?: string): string {
  const lower = String(fileNameOrUri || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

async function assetToBase64(asset: DocumentPicker.DocumentPickerAsset): Promise<string> {
  if (typeof (asset as { base64?: string }).base64 === 'string' && (asset as { base64?: string }).base64) {
    return ((asset as { base64?: string }).base64 || '').trim();
  }

  const uri = String(asset.uri || '');
  if (uri.startsWith('data:')) {
    return uri.split(',')[1] || '';
  }

  if (Platform.OS === 'web' && (asset as { file?: File }).file instanceof File) {
    const file = (asset as { file: File }).file;
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        resolve(result.split(',')[1] || '');
      };
      reader.onerror = () => reject(new Error('Could not read selected file.'));
      reader.readAsDataURL(file);
    });
    return base64.trim();
  }

  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  return base64.trim();
}

export function ExamPrepWizard(): React.ReactElement {
  const { theme, isDark } = useTheme();
  const { tier } = useSubscription();
  const params = useLocalSearchParams<{
    grade?: string;
    childName?: string;
    studentId?: string;
    classId?: string;
    schoolId?: string;
    manualScopeText?: string;
  }>();

  const gradeParam = toSafeParam(params.grade);
  const childName = toSafeParam(params.childName);
  const studentId = toSafeParam(params.studentId);
  const classId = toSafeParam(params.classId);
  const schoolId = toSafeParam(params.schoolId);
  const manualScopeParam = toSafeParam(params.manualScopeText);

  const hasPrefilledGrade = !!(gradeParam && GRADES.some((grade) => grade.value === gradeParam));

  const [selectedGrade, setSelectedGrade] = useState<string>(hasPrefilledGrade ? gradeParam! : 'grade_4');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedExamType, setSelectedExamType] = useState<string>('practice_test');
  const [selectedLanguage, setSelectedLanguage] = useState<SouthAfricanLanguage>('en-ZA');
  const [step, setStep] = useState<WizardStep>(hasPrefilledGrade ? 'subject' : 'grade');

  const [subjectSearch, setSubjectSearch] = useState('');
  const [subjectCategory, setSubjectCategory] = useState<SubjectCategory>('all');

  const [useTeacherContext, setUseTeacherContext] = useState(true);
  const [manualScopeText, setManualScopeText] = useState<string>(manualScopeParam || '');
  const [scopeParsing, setScopeParsing] = useState(false);
  const [scopeParseError, setScopeParseError] = useState<string | null>(null);
  const [scopeParseSourceName, setScopeParseSourceName] = useState<string | null>(null);
  const [scopeParseConfidence, setScopeParseConfidence] = useState<number | null>(null);
  const [contextPreview, setContextPreview] = useState<ExamContextSummary | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const contextRequestSeqRef = useRef(0);

  const phase = getPhaseFromGrade(selectedGrade);
  const subjects = SUBJECTS_BY_PHASE[phase] || [];
  const gradeInfo = GRADES.find((grade) => grade.value === selectedGrade);
  const tierForCaps: Tier = getCapabilityTier(normalizeTierName(tier || 'free'));
  const canUseExamPrep = hasCapability(tierForCaps, 'exam.practice');
  const requiredExamTier = getRequiredTier('exam.practice');

  const selectedExamTypeLabel = useMemo(() => {
    const examType = selectedExamType === 'practice_test'
      ? 'Practice Test'
      : selectedExamType === 'revision_notes'
        ? 'Revision Notes'
        : selectedExamType === 'study_guide'
          ? 'Study Guide'
          : selectedExamType === 'flashcards'
            ? 'Flashcards'
            : selectedExamType;
    return examType;
  }, [selectedExamType]);

  const quickLaunchLabel = `${gradeInfo?.label || 'Selected Grade'} • ${selectedSubject || 'Afrikaans First Additional Language'}`;

  const filteredSubjects = useMemo(() => {
    const search = subjectSearch.trim().toLowerCase();

    return subjects.filter((subject) => {
      const category = getSubjectCategory(subject);
      const categoryMatches = subjectCategory === 'all' || category === subjectCategory;
      const searchMatches = !search || subject.toLowerCase().includes(search);
      return categoryMatches && searchMatches;
    });
  }, [subjects, subjectSearch, subjectCategory]);

  const fetchContextPreview = useCallback(async () => {
    if (!selectedGrade || !selectedSubject || !selectedExamType || !useTeacherContext) {
      setContextPreview(null);
      setContextError(null);
      return;
    }

    const requestSeq = ++contextRequestSeqRef.current;
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
          manualScopeText: manualScopeText.trim().slice(0, 1800),
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

      if (requestSeq !== contextRequestSeqRef.current) return;
      setContextPreview(
        response.contextSummary || {
          assignmentCount: 0,
          lessonCount: 0,
          focusTopics: [],
          weakTopics: [],
        }
      );
    } catch (error) {
      if (requestSeq !== contextRequestSeqRef.current) return;
      const message = error instanceof Error ? error.message : 'Could not load teacher context';
      setContextError(message);
      setContextPreview(null);
    } finally {
      if (requestSeq !== contextRequestSeqRef.current) return;
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
    manualScopeText,
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
  }, [step, useTeacherContext, fetchContextPreview]);

  const moveToStep = useCallback((nextStep: WizardStep) => {
    setStep(nextStep);
  }, []);

  const handleSelectGrade = useCallback((grade: string) => {
    setSelectedGrade(grade);
    setSelectedSubject('');
    setSubjectSearch('');
    setSubjectCategory('all');
  }, []);

  const handleStartGeneration = useCallback(
    (withTeacherContext: boolean) => {
      if (!selectedGrade || !selectedSubject || !selectedExamType) return;
      const manualScopeForRequest = manualScopeText.trim().slice(0, 1800);

      const generationParams = buildExamRouteParams({
        grade: selectedGrade,
        subject: selectedSubject,
        examType: selectedExamType,
        language: selectedLanguage,
        useTeacherContext: withTeacherContext,
        manualScopeText: manualScopeForRequest,
        contextIds: {
          childName,
          studentId,
          classId,
          schoolId,
        },
      });

      router.push(buildExamGenerationHref(generationParams));
    },
    [selectedGrade, selectedSubject, selectedExamType, selectedLanguage, manualScopeText, childName, studentId, classId, schoolId]
  );

  const handleQuickStartAfrikaansLive = useCallback(() => {
    const quickGrade = selectedGrade || gradeParam || 'grade_6';
      const manualScopeForRequest = manualScopeText.trim().slice(0, 1800);
    const quickParams = buildExamRouteParams({
      grade: quickGrade,
      subject: selectedSubject || 'Afrikaans First Additional Language',
      examType: 'practice_test',
      language: selectedLanguage || 'af-ZA',
      useTeacherContext: true,
      manualScopeText: manualScopeForRequest,
      contextIds: {
        childName,
        studentId,
        classId,
        schoolId,
      },
    });

    router.push(buildExamGenerationHref(quickParams));
  }, [selectedGrade, gradeParam, selectedSubject, selectedLanguage, manualScopeText, childName, studentId, classId, schoolId]);

  const handleParseScopeFromFile = useCallback(async () => {
    setScopeParseError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const base64 = await assetToBase64(asset);

      if (!base64) {
        setScopeParseError('Could not read selected file bytes for OCR parsing.');
        return;
      }

      setScopeParsing(true);
      const parsed = await parseExamScopeFromUpload({
        fileBase64: base64,
        mimeType: asset.mimeType || inferMimeType(asset.name || asset.uri),
        fileName: asset.name || undefined,
        grade: selectedGrade,
        subject: selectedSubject,
      });

      if (!parsed.success || !parsed.scopeText) {
        const issue = parsed.issues.find((item) => item.trim().length > 0) || 'Scope parsing failed. Please type the scope manually.';
        setScopeParseError(issue);
        setScopeParseSourceName(asset.name || 'Uploaded file');
        setScopeParseConfidence(parsed.confidence);
        return;
      }

      setManualScopeText((previous) => {
        const current = previous.trim();
        const next = parsed.scopeText.trim();
        if (!current) return next.slice(0, MAX_MANUAL_SCOPE_CHARS);
        if (current.includes(next)) return current.slice(0, MAX_MANUAL_SCOPE_CHARS);
        return `${current}\n\n${next}`.slice(0, MAX_MANUAL_SCOPE_CHARS);
      });

      const lowConfidenceIssue = parsed.lowConfidence
        ? 'OCR confidence is low. Review and correct extracted text before generating.'
        : null;
      const issue = parsed.issues.find((item) => item.trim().length > 0) || lowConfidenceIssue;
      setScopeParseError(issue || null);
      setScopeParseSourceName(asset.name || 'Uploaded file');
      setScopeParseConfidence(parsed.confidence);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Scope parsing failed unexpectedly.';
      setScopeParseError(message);
    } finally {
      setScopeParsing(false);
    }
  }, [selectedGrade, selectedSubject]);

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
        <View style={[styles.quickLaunchCard, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
          <View style={styles.quickLaunchHeader}>
            <Ionicons name="flash-outline" size={18} color={theme.primary} />
            <Text style={[styles.quickLaunchTitle, { color: theme.text }]}>Quick Live Session</Text>
          </View>
          <Text style={[styles.quickLaunchSubtitle, { color: theme.muted }]}>Open interactive in-canvas practice for {quickLaunchLabel} with instant correct/incorrect markers and explanations.</Text>
          <TouchableOpacity style={[styles.quickLaunchButton, { backgroundColor: theme.primary }]} onPress={handleQuickStartAfrikaansLive}>
            <Ionicons name="play-circle" size={18} color="#ffffff" />
            <Text style={styles.quickLaunchButtonText}>Start Live Practice: {quickLaunchLabel}</Text>
          </TouchableOpacity>
        </View>

        {step === 'grade' ? (
          <ExamPrepGradeStep
            theme={theme}
            selectedGrade={selectedGrade}
            onSelectGrade={handleSelectGrade}
            onNext={() => moveToStep('subject')}
          />
        ) : null}

        {step === 'subject' ? (
          <ExamPrepSubjectStep
            theme={theme}
            gradeLabel={gradeInfo?.label || selectedGrade}
            selectedSubject={selectedSubject}
            filteredSubjects={filteredSubjects}
            subjectSearch={subjectSearch}
            subjectCategory={subjectCategory}
            onSubjectSearchChange={setSubjectSearch}
            onSubjectCategoryChange={setSubjectCategory}
            onSelectSubject={setSelectedSubject}
            onBack={() => moveToStep('grade')}
            onNext={() => moveToStep('type')}
          />
        ) : null}

        {step === 'type' ? (
          <ExamPrepTypeStep
            theme={theme}
            gradeLabel={gradeInfo?.label || selectedGrade}
            selectedSubject={selectedSubject}
            selectedExamType={selectedExamType}
            selectedLanguage={selectedLanguage}
            onSelectExamType={setSelectedExamType}
            onSelectLanguage={setSelectedLanguage}
            onBack={() => moveToStep('subject')}
            onNext={() => moveToStep('review')}
          />
        ) : null}

        {step === 'review' ? (
          <ExamPrepReviewStep
            theme={theme}
            childName={childName}
            gradeLabel={gradeInfo?.label || selectedGrade}
            selectedGrade={selectedGrade}
            selectedSubject={selectedSubject}
            selectedExamTypeLabel={selectedExamTypeLabel}
            selectedExamType={selectedExamType}
            selectedLanguage={selectedLanguage}
            useTeacherContext={useTeacherContext}
            manualScopeText={manualScopeText}
            scopeParsing={scopeParsing}
            scopeParseError={scopeParseError}
            scopeParseSourceName={scopeParseSourceName}
            scopeParseConfidence={scopeParseConfidence}
            contextPreview={contextPreview}
            contextLoading={contextLoading}
            contextError={contextError}
            onBack={() => moveToStep('type')}
            onSetUseTeacherContext={setUseTeacherContext}
            onManualScopeTextChange={setManualScopeText}
            onParseScopeFromFile={handleParseScopeFromFile}
            onGenerateWithCurrentContext={() => handleStartGeneration(useTeacherContext)}
            onGenerateCapsOnly={() => handleStartGeneration(false)}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
