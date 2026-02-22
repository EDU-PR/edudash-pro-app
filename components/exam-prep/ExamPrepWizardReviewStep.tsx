import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Text, TouchableOpacity, View } from 'react-native';

import { type ThemeColors } from '@/contexts/ThemeContext';
import { LANGUAGE_OPTIONS, type ExamContextSummary } from '@/components/exam-prep/types';
import { examPrepWizardStyles as styles } from '@/components/exam-prep/examPrepWizard.styles';
import EduDashSpinner from '@/components/ui/EduDashSpinner';

interface ReviewStepProps {
  theme: ThemeColors;
  childName?: string;
  gradeLabel: string;
  selectedGrade: string;
  selectedSubject: string;
  selectedExamTypeLabel: string;
  selectedExamType: string;
  selectedLanguage: keyof typeof LANGUAGE_OPTIONS;
  useTeacherContext: boolean;
  contextPreview: ExamContextSummary | null;
  contextLoading: boolean;
  contextError: string | null;
  onBack: () => void;
  onSetUseTeacherContext: (enabled: boolean) => void;
  onGenerateWithCurrentContext: () => void;
  onGenerateCapsOnly: () => void;
}

function ContextPreviewCard({
  theme,
  useTeacherContext,
  contextPreview,
  contextLoading,
  contextError,
}: Pick<
  ReviewStepProps,
  'theme' | 'useTeacherContext' | 'contextPreview' | 'contextLoading' | 'contextError'
>): React.ReactElement {
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
        <Text style={[styles.contextSubLabel, { color: theme.muted }]}>
          Loading teacher artifacts for this learner...
        </Text>
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

  return (
    <View style={[styles.contextCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.contextLabel, { color: theme.text }]}>Teacher context found</Text>
      <View style={styles.summaryRow}>
        <View style={[styles.summaryChip, { backgroundColor: `${theme.primary}22` }]}>
          <Text style={[styles.summaryChipText, { color: theme.primary }]}>
            Assignments: {contextPreview?.assignmentCount ?? 0}
          </Text>
        </View>
        <View style={[styles.summaryChip, { backgroundColor: `${theme.primary}22` }]}>
          <Text style={[styles.summaryChipText, { color: theme.primary }]}>
            Lessons: {contextPreview?.lessonCount ?? 0}
          </Text>
        </View>
      </View>

      {contextPreview?.focusTopics?.length ? (
        <View style={styles.topicBlock}>
          <Text style={[styles.topicHeading, { color: theme.text }]}>Focus topics</Text>
          <Text style={[styles.contextSubLabel, { color: theme.muted }]} numberOfLines={3}>
            {contextPreview.focusTopics.slice(0, 6).join(' • ')}
          </Text>
        </View>
      ) : null}

      {contextPreview?.weakTopics?.length ? (
        <View style={styles.topicBlock}>
          <Text style={[styles.topicHeading, { color: theme.text }]}>Weak-topic signals</Text>
          <Text style={[styles.contextSubLabel, { color: theme.muted }]} numberOfLines={3}>
            {contextPreview.weakTopics.slice(0, 6).join(' • ')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function ExamPrepReviewStep({
  theme,
  childName,
  gradeLabel,
  selectedGrade,
  selectedSubject,
  selectedExamTypeLabel,
  selectedExamType,
  selectedLanguage,
  useTeacherContext,
  contextPreview,
  contextLoading,
  contextError,
  onBack,
  onSetUseTeacherContext,
  onGenerateWithCurrentContext,
  onGenerateCapsOnly,
}: ReviewStepProps): React.ReactElement {
  return (
    <View style={styles.stepContainer}>
      <TouchableOpacity style={styles.backStepButton} onPress={onBack}>
        <Ionicons name="arrow-back" size={18} color={theme.primary} />
        <Text style={[styles.backStepText, { color: theme.primary }]}>Back to Type</Text>
      </TouchableOpacity>

      <Text style={[styles.stepTitle, { color: theme.text }]}>Review & Generate</Text>
      <Text style={[styles.stepSubtitle, { color: theme.muted }]}>
        Confirm your setup before generating the practice exam.
      </Text>

      <View style={[styles.reviewCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.reviewRow}>
          <Text style={[styles.reviewLabel, { color: theme.muted }]}>Learner</Text>
          <Text style={[styles.reviewValue, { color: theme.text }]}>{childName || 'Current learner'}</Text>
        </View>
        <View style={styles.reviewRow}>
          <Text style={[styles.reviewLabel, { color: theme.muted }]}>Grade</Text>
          <Text style={[styles.reviewValue, { color: theme.text }]}>{gradeLabel || selectedGrade}</Text>
        </View>
        <View style={styles.reviewRow}>
          <Text style={[styles.reviewLabel, { color: theme.muted }]}>Subject</Text>
          <Text style={[styles.reviewValue, { color: theme.text }]}>{selectedSubject}</Text>
        </View>
        <View style={styles.reviewRow}>
          <Text style={[styles.reviewLabel, { color: theme.muted }]}>Type</Text>
          <Text style={[styles.reviewValue, { color: theme.text }]}>
            {selectedExamTypeLabel || selectedExamType}
          </Text>
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
          onPress={() => onSetUseTeacherContext(true)}
        >
          <Text style={[styles.contextToggleText, { color: useTeacherContext ? '#ffffff' : theme.text }]}>
            Use teacher context
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.contextToggle,
            {
              backgroundColor: !useTeacherContext ? theme.primary : theme.surface,
              borderColor: !useTeacherContext ? theme.primary : theme.border,
            },
          ]}
          onPress={() => onSetUseTeacherContext(false)}
        >
          <Text style={[styles.contextToggleText, { color: !useTeacherContext ? '#ffffff' : theme.text }]}>
            CAPS only
          </Text>
        </TouchableOpacity>
      </View>

      <ContextPreviewCard
        theme={theme}
        useTeacherContext={useTeacherContext}
        contextPreview={contextPreview}
        contextLoading={contextLoading}
        contextError={contextError}
      />

      <TouchableOpacity
        style={[styles.generateButton, { backgroundColor: '#22c55e' }]}
        onPress={onGenerateWithCurrentContext}
      >
        <Ionicons name="sparkles" size={22} color="#ffffff" />
        <Text style={styles.generateButtonText}>Generate Practice Exam</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.secondaryGenerateButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
        onPress={onGenerateCapsOnly}
      >
        <Text style={[styles.secondaryGenerateText, { color: theme.text }]}>
          Generate without teacher context
        </Text>
      </TouchableOpacity>
    </View>
  );
}
