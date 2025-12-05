/**
 * Exam Prep Screen (React Native)
 * 
 * CAPS-aligned exam preparation with AI-powered question generation.
 * Features: Grade selection, subject selection, exam type selection.
 * Feature-flagged: Only active when exam_prep_enabled is true.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getFeatureFlagsSync } from '@/lib/featureFlags';
import { useTheme } from '@/contexts/ThemeContext';
import {
  GRADES,
  EXAM_TYPES,
  SUBJECTS_BY_PHASE,
  LANGUAGE_OPTIONS,
  type SouthAfricanLanguage,
  type ExamType,
  type GradeInfo,
} from '@/components/exam-prep/types';
import { buildExamPrompt } from '@/components/exam-prep/prompt-builder';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Get phase from grade
function getPhaseFromGrade(grade: string): 'foundation' | 'intermediate' | 'senior' | 'fet' {
  const gradeNum = parseInt(grade.replace('grade_', ''));
  if (isNaN(gradeNum) || gradeNum <= 3) return 'foundation';
  if (gradeNum <= 6) return 'intermediate';
  if (gradeNum <= 9) return 'senior';
  return 'fet';
}

export default function ExamPrepScreen() {
  const { theme, isDark } = useTheme();
  const flags = getFeatureFlagsSync();

  // State
  const [selectedGrade, setSelectedGrade] = useState<string>('grade_4');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedExamType, setSelectedExamType] = useState<string>('practice_test');
  const [selectedLanguage, setSelectedLanguage] = useState<SouthAfricanLanguage>('en-ZA');
  const [generating, setGenerating] = useState(false);
  const [step, setStep] = useState<'grade' | 'subject' | 'type'>('grade');

  // Feature flag check
  if (!flags.exam_prep_enabled) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'Exam Prep' }} />
        <View style={styles.disabledContainer}>
          <Ionicons name="school-outline" size={64} color={theme.muted} />
          <Text style={[styles.disabledText, { color: theme.text }]}>
            Exam Prep is not available
          </Text>
          <Text style={[styles.disabledSubtext, { color: theme.muted }]}>
            Please upgrade your subscription to access this feature.
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Get subjects for current grade
  const phase = getPhaseFromGrade(selectedGrade);
  const subjects = SUBJECTS_BY_PHASE[phase] || [];

  // Get grade info
  const gradeInfo = GRADES.find((g) => g.value === selectedGrade);

  // Handle generate exam
  const handleGenerate = useCallback(async () => {
    if (!selectedSubject || !selectedExamType) return;

    setGenerating(true);
    try {
      // Build the prompt using the shared prompt builder
      const { prompt, displayTitle } = buildExamPrompt({
        grade: selectedGrade,
        subject: selectedSubject,
        examType: selectedExamType,
        language: selectedLanguage,
        enableInteractive: true,
      });

      // Navigate to Dash AI with the generated prompt
      router.push({
        pathname: '/screens/dash-assistant',
        params: {
          initialPrompt: prompt,
          title: displayTitle,
          examMode: 'true',
        },
      });
    } catch (error) {
      console.error('Error generating exam:', error);
    } finally {
      setGenerating(false);
    }
  }, [selectedGrade, selectedSubject, selectedExamType, selectedLanguage]);

  // Render grade selector
  const renderGradeStep = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: theme.text }]}>Select Grade</Text>
      <Text style={[styles.stepSubtitle, { color: theme.muted }]}>
        Choose your child's grade level
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.gradeScroll}
      >
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
                setSelectedSubject(''); // Reset subject when grade changes
              }}
            >
              <Text
                style={[
                  styles.gradeLabel,
                  { color: isSelected ? '#ffffff' : theme.text },
                ]}
              >
                {grade.label}
              </Text>
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

      <TouchableOpacity
        style={[styles.nextButton, { backgroundColor: theme.primary }]}
        onPress={() => setStep('subject')}
      >
        <Text style={styles.nextButtonText}>Next: Choose Subject</Text>
        <Ionicons name="arrow-forward" size={20} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );

  // Render subject selector
  const renderSubjectStep = () => (
    <View style={styles.stepContainer}>
      <TouchableOpacity
        style={styles.backStepButton}
        onPress={() => setStep('grade')}
      >
        <Ionicons name="arrow-back" size={20} color={theme.primary} />
        <Text style={[styles.backStepText, { color: theme.primary }]}>
          Back to Grade
        </Text>
      </TouchableOpacity>

      <Text style={[styles.stepTitle, { color: theme.text }]}>Select Subject</Text>
      <Text style={[styles.stepSubtitle, { color: theme.muted }]}>
        {gradeInfo?.label} - CAPS Curriculum
      </Text>

      <FlatList
        data={subjects}
        numColumns={2}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.subjectGrid}
        renderItem={({ item }) => {
          const isSelected = selectedSubject === item;
          return (
            <TouchableOpacity
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
                name={getSubjectIcon(item)}
                size={24}
                color={isSelected ? '#ffffff' : theme.primary}
              />
              <Text
                style={[
                  styles.subjectLabel,
                  { color: isSelected ? '#ffffff' : theme.text },
                ]}
                numberOfLines={2}
              >
                {item}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {selectedSubject && (
        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: theme.primary }]}
          onPress={() => setStep('type')}
        >
          <Text style={styles.nextButtonText}>Next: Choose Exam Type</Text>
          <Ionicons name="arrow-forward" size={20} color="#ffffff" />
        </TouchableOpacity>
      )}
    </View>
  );

  // Render exam type selector
  const renderTypeStep = () => (
    <View style={styles.stepContainer}>
      <TouchableOpacity
        style={styles.backStepButton}
        onPress={() => setStep('subject')}
      >
        <Ionicons name="arrow-back" size={20} color={theme.primary} />
        <Text style={[styles.backStepText, { color: theme.primary }]}>
          Back to Subject
        </Text>
      </TouchableOpacity>

      <Text style={[styles.stepTitle, { color: theme.text }]}>
        Choose Exam Type
      </Text>
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
                  backgroundColor: isSelected
                    ? examType.color
                    : theme.surface,
                  borderColor: isSelected ? examType.color : theme.border,
                },
              ]}
              onPress={() => setSelectedExamType(examType.id)}
            >
              <Ionicons
                name={examType.icon as any}
                size={32}
                color={isSelected ? '#ffffff' : examType.color}
              />
              <Text
                style={[
                  styles.examTypeLabel,
                  { color: isSelected ? '#ffffff' : theme.text },
                ]}
              >
                {examType.label}
              </Text>
              <Text
                style={[
                  styles.examTypeDesc,
                  { color: isSelected ? 'rgba(255,255,255,0.8)' : theme.muted },
                ]}
              >
                {examType.description}
              </Text>
              <View
                style={[
                  styles.examTypeDuration,
                  {
                    backgroundColor: isSelected
                      ? 'rgba(255,255,255,0.2)'
                      : theme.background,
                  },
                ]}
              >
                <Ionicons
                  name="time-outline"
                  size={12}
                  color={isSelected ? '#ffffff' : theme.muted}
                />
                <Text
                  style={[
                    styles.examTypeDurationText,
                    { color: isSelected ? '#ffffff' : theme.muted },
                  ]}
                >
                  {examType.duration}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Language Selector */}
      <View style={styles.languageSection}>
        <Text style={[styles.languageLabel, { color: theme.text }]}>
          Response Language
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.languageScroll}
        >
          {(Object.entries(LANGUAGE_OPTIONS) as [SouthAfricanLanguage, string][]).map(
            ([code, label]) => {
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
                  <Text
                    style={[
                      styles.languageChipText,
                      { color: isSelected ? '#ffffff' : theme.text },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            }
          )}
        </ScrollView>
      </View>

      {/* Generate Button */}
      <TouchableOpacity
        style={[
          styles.generateButton,
          { backgroundColor: generating ? theme.muted : '#22c55e' },
        ]}
        onPress={handleGenerate}
        disabled={generating}
      >
        {generating ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <>
            <Ionicons name="sparkles" size={24} color="#ffffff" />
            <Text style={styles.generateButtonText}>
              Generate with Dash AI
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
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

      {/* Header */}
      <LinearGradient
        colors={isDark ? ['#1e293b', '#0f172a'] : ['#f0f9ff', '#e0f2fe']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Ionicons name="school" size={32} color={theme.primary} />
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              AI-Powered Exam Prep
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.muted }]}>
              CAPS-aligned practice tests & study materials
            </Text>
          </View>
        </View>

        {/* Progress Steps */}
        <View style={styles.progressSteps}>
          {['Grade', 'Subject', 'Type'].map((label, index) => {
            const stepNum = index + 1;
            const currentStepNum =
              step === 'grade' ? 1 : step === 'subject' ? 2 : 3;
            const isActive = stepNum <= currentStepNum;
            return (
              <View key={label} style={styles.progressStep}>
                <View
                  style={[
                    styles.progressDot,
                    {
                      backgroundColor: isActive ? theme.primary : theme.border,
                    },
                  ]}
                >
                  {stepNum < currentStepNum && (
                    <Ionicons name="checkmark" size={12} color="#ffffff" />
                  )}
                </View>
                <Text
                  style={[
                    styles.progressLabel,
                    { color: isActive ? theme.primary : theme.muted },
                  ]}
                >
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
      </LinearGradient>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {step === 'grade' && renderGradeStep()}
        {step === 'subject' && renderSubjectStep()}
        {step === 'type' && renderTypeStep()}
      </ScrollView>
    </View>
  );
}

// Get icon for subject
function getSubjectIcon(subject: string): string {
  const s = subject.toLowerCase();
  if (s.includes('math')) return 'calculator';
  if (s.includes('english') || s.includes('language')) return 'book';
  if (s.includes('science')) return 'flask';
  if (s.includes('history')) return 'time';
  if (s.includes('geography')) return 'globe';
  if (s.includes('life')) return 'heart';
  if (s.includes('economic') || s.includes('business') || s.includes('accounting'))
    return 'cash';
  if (s.includes('technology') || s.includes('computer')) return 'laptop';
  if (s.includes('art') || s.includes('creative')) return 'color-palette';
  return 'book-outline';
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
    fontSize: 14,
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
    fontSize: 12,
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
    marginBottom: 20,
  },
  backStepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backStepText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  gradeScroll: {
    paddingVertical: 8,
  },
  gradeCard: {
    width: 100,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginRight: 12,
    alignItems: 'center',
  },
  gradeLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  gradeAge: {
    fontSize: 11,
    marginTop: 4,
  },
  subjectGrid: {
    paddingVertical: 8,
  },
  subjectCard: {
    flex: 1,
    maxWidth: (SCREEN_WIDTH - 48) / 2,
    margin: 4,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    minHeight: 100,
  },
  subjectLabel: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 8,
  },
  examTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 16,
    gap: 12,
  },
  examTypeCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
  },
  examTypeLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
  examTypeDesc: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
  examTypeDuration: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  examTypeDurationText: {
    fontSize: 10,
    marginLeft: 4,
  },
  languageSection: {
    marginTop: 16,
  },
  languageLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  languageScroll: {
    paddingVertical: 4,
  },
  languageChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  languageChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 12,
    marginTop: 24,
  },
  generateButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
  },
});
