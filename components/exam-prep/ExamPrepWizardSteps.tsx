import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { type ThemeColors } from '@/contexts/ThemeContext';
import {
  EXAM_TYPES,
  GRADES,
  LANGUAGE_OPTIONS,
  type SouthAfricanLanguage,
} from '@/components/exam-prep/types';
import {
  type SubjectCategory,
  SUBJECT_CATEGORY_OPTIONS,
  getSubjectIcon,
  resolveIoniconName,
} from '@/components/exam-prep/examPrepWizard.helpers';
import { examPrepWizardStyles as styles } from '@/components/exam-prep/examPrepWizard.styles';

interface GradeStepProps {
  theme: ThemeColors;
  selectedGrade: string;
  onSelectGrade: (grade: string) => void;
  onNext: () => void;
}

interface SubjectStepProps {
  theme: ThemeColors;
  gradeLabel: string;
  selectedSubject: string;
  filteredSubjects: string[];
  subjectSearch: string;
  subjectCategory: SubjectCategory;
  onSubjectSearchChange: (value: string) => void;
  onSubjectCategoryChange: (category: SubjectCategory) => void;
  onSelectSubject: (subject: string) => void;
  onBack: () => void;
  onNext: () => void;
}

interface TypeStepProps {
  theme: ThemeColors;
  gradeLabel: string;
  selectedSubject: string;
  selectedExamType: string;
  selectedLanguage: SouthAfricanLanguage;
  onSelectExamType: (examType: string) => void;
  onSelectLanguage: (language: SouthAfricanLanguage) => void;
  onBack: () => void;
  onNext: () => void;
}

export function ExamPrepGradeStep({
  theme,
  selectedGrade,
  onSelectGrade,
  onNext,
}: GradeStepProps): React.ReactElement {
  return (
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
              onPress={() => onSelectGrade(grade.value)}
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

      <TouchableOpacity style={[styles.nextButton, { backgroundColor: theme.primary }]} onPress={onNext}>
        <Text style={styles.nextButtonText}>Next: Choose Subject</Text>
        <Ionicons name="arrow-forward" size={18} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
}

export function ExamPrepSubjectStep({
  theme,
  gradeLabel,
  selectedSubject,
  filteredSubjects,
  subjectSearch,
  subjectCategory,
  onSubjectSearchChange,
  onSubjectCategoryChange,
  onSelectSubject,
  onBack,
  onNext,
}: SubjectStepProps): React.ReactElement {
  return (
    <View style={styles.stepContainer}>
      <TouchableOpacity style={styles.backStepButton} onPress={onBack}>
        <Ionicons name="arrow-back" size={18} color={theme.primary} />
        <Text style={[styles.backStepText, { color: theme.primary }]}>Back to Grade</Text>
      </TouchableOpacity>

      <Text style={[styles.stepTitle, { color: theme.text }]}>Select Subject</Text>
      <Text style={[styles.stepSubtitle, { color: theme.muted }]}>{gradeLabel} • CAPS curriculum</Text>

      <View style={[styles.searchWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Ionicons name="search" size={16} color={theme.muted} />
        <TextInput
          value={subjectSearch}
          onChangeText={onSubjectSearchChange}
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
              onPress={() => onSubjectCategoryChange(option.id)}
            >
              <Text style={[styles.categoryChipText, { color: isSelected ? '#ffffff' : theme.text }]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.subjectGrid}>
        {filteredSubjects.map((subject) => {
          const isSelected = selectedSubject === subject;
          return (
            <TouchableOpacity
              key={subject}
              style={[
                styles.subjectCard,
                {
                  backgroundColor: isSelected ? theme.primary : theme.surface,
                  borderColor: isSelected ? theme.primary : theme.border,
                },
              ]}
              onPress={() => onSelectSubject(subject)}
            >
              <Ionicons name={getSubjectIcon(subject)} size={20} color={isSelected ? '#ffffff' : theme.primary} />
              <Text style={[styles.subjectLabel, { color: isSelected ? '#ffffff' : theme.text }]} numberOfLines={3}>
                {subject}
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
        <TouchableOpacity style={[styles.nextButton, { backgroundColor: theme.primary }]} onPress={onNext}>
          <Text style={styles.nextButtonText}>Next: Choose Exam Type</Text>
          <Ionicons name="arrow-forward" size={18} color="#ffffff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

export function ExamPrepTypeStep({
  theme,
  gradeLabel,
  selectedSubject,
  selectedExamType,
  selectedLanguage,
  onSelectExamType,
  onSelectLanguage,
  onBack,
  onNext,
}: TypeStepProps): React.ReactElement {
  return (
    <View style={styles.stepContainer}>
      <TouchableOpacity style={styles.backStepButton} onPress={onBack}>
        <Ionicons name="arrow-back" size={18} color={theme.primary} />
        <Text style={[styles.backStepText, { color: theme.primary }]}>Back to Subject</Text>
      </TouchableOpacity>

      <Text style={[styles.stepTitle, { color: theme.text }]}>Choose Exam Type</Text>
      <Text style={[styles.stepSubtitle, { color: theme.muted }]}>{gradeLabel} • {selectedSubject}</Text>

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
              onPress={() => onSelectExamType(examType.id)}
            >
              <Ionicons
                name={resolveIoniconName(examType.icon)}
                size={24}
                color={isSelected ? '#ffffff' : examType.color}
              />
              <Text style={[styles.examTypeLabel, { color: isSelected ? '#ffffff' : theme.text }]}>
                {examType.label}
              </Text>
              <Text style={[styles.examTypeDesc, { color: isSelected ? 'rgba(255,255,255,0.9)' : theme.muted }]}>
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
                onPress={() => onSelectLanguage(code)}
              >
                <Text style={[styles.languageChipText, { color: isSelected ? '#ffffff' : theme.text }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <TouchableOpacity style={[styles.nextButton, { backgroundColor: theme.primary }]} onPress={onNext}>
        <Text style={styles.nextButtonText}>Next: Review & Generate</Text>
        <Ionicons name="arrow-forward" size={18} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
}
