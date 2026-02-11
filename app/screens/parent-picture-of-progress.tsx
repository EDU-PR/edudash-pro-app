/**
 * Picture of Progress Screen
 *
 * Parent uploads a photo showing their child's work/progress.
 * AI auto-tags, detects milestones, and provides developmental insights.
 *
 * State/effects extracted → hooks/usePictureOfProgress.ts
 * Styles extracted → parent-picture-of-progress.styles.ts
 */
import React, { useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { SubPageHeader } from '@/components/SubPageHeader';
import { formatFileSize } from '@/lib/popUpload';
import { PictureOfProgressAI } from '@/services/PictureOfProgressAI';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import { usePictureOfProgress } from '@/hooks/usePictureOfProgress';
import { createPictureOfProgressStyles } from '@/lib/screen-styles/parent-picture-of-progress.styles';

const SUBJECTS = [
  { value: 'mathematics', label: 'Mathematics' }, { value: 'english', label: 'English' },
  { value: 'afrikaans', label: 'Afrikaans' }, { value: 'art', label: 'Art & Creativity' },
  { value: 'science', label: 'Science' }, { value: 'physical_education', label: 'Physical Education' },
  { value: 'life_skills', label: 'Life Skills' }, { value: 'music', label: 'Music' },
  { value: 'reading', label: 'Reading' }, { value: 'writing', label: 'Writing' },
  { value: 'social_skills', label: 'Social Skills' }, { value: 'other', label: 'Other' },
];

const ACHIEVEMENT_LEVELS = [
  { value: 'excellent', label: '⭐ Excellent' }, { value: 'good', label: '👍 Good' },
  { value: 'improving', label: '📈 Improving' }, { value: 'needs_support', label: '🤝 Needs Support' },
  { value: 'milestone', label: '🎯 Milestone Achieved' },
];

export default function PictureOfProgressScreen() {
  const rawParams = useLocalSearchParams<any>();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { showAlert, alertProps } = useAlertModal();
  const styles = useMemo(() => createPictureOfProgressStyles(theme), [theme]);

  const readP = useCallback((v?: string | string[]) => { const r = Array.isArray(v) ? v[0] : v; if (!r) return ''; try { return decodeURIComponent(r); } catch { return r; } }, []);
  const params = useMemo(() => ({
    studentId: readP(rawParams.studentId), studentName: readP(rawParams.studentName), nextStep: readP(rawParams.nextStep),
    prefillTitle: readP(rawParams.prefillTitle), prefillDescription: readP(rawParams.prefillDescription),
    prefillSubject: readP(rawParams.prefillSubject), prefillLearningArea: readP(rawParams.prefillLearningArea),
    gradeLevel: readP(rawParams.gradeLevel), assignmentTitle: readP(rawParams.assignmentTitle),
    submissionTemplate: readP(rawParams.submissionTemplate), contextTag: readP(rawParams.contextTag),
    sourceFlow: readP(rawParams.sourceFlow), activityId: readP(rawParams.activityId), activityTitle: readP(rawParams.activityTitle),
  }), [rawParams, readP]);

  const h = usePictureOfProgress(showAlert, t, params);

  const subjectLabel = SUBJECTS.find(s => s.value === h.subject)?.label || h.subject || t('pop.subject');
  const achievementLabel = ACHIEVEMENT_LEVELS.find(a => a.value === h.achievementLevel)?.label || t('pop.selectAchievementLevel');

  return (
    <View style={styles.container}>
      <SubPageHeader title={t('pop.uploadPictureOfProgress')} />
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {params.studentName ? <View style={styles.section}><Text style={styles.sectionTitle}>{t('pop.progressFor')}: {params.studentName}</Text></View> : null}

        {/* Milestone Banner */}
        {h.showMilestoneAlert && (
          <Animated.View style={[styles.milestoneBanner, { opacity: h.milestoneOpacity, transform: [{ scale: h.celebrationScale }] }]}>
            <View style={styles.milestoneContent}>
              <Text style={styles.milestoneEmoji}>🎉</Text>
              <View style={styles.milestoneTextContainer}>
                <Text style={styles.milestoneTitle}>Milestone Detected!</Text>
                <Text style={styles.milestoneSubtitle}>{h.aiSuggestions?.celebrationSuggestion || PictureOfProgressAI.getCelebrationSuggestion(PictureOfProgressAI.detectMilestone(h.description).milestone) || "What an amazing achievement! 🌟"}</Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Form */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('pop.progressDetails')}</Text>

          <Text style={styles.label}>{t('pop.title')} *</Text>
          <TextInput style={styles.input} value={h.title} onChangeText={h.setTitle} placeholder={t('pop.titlePlaceholder')} placeholderTextColor={theme.textSecondary} />

          {/* Subject Dropdown */}
          <Text style={styles.label}>{t('pop.subject')} *</Text>
          <View style={styles.dropdown}>
            <TouchableOpacity style={styles.dropdownButton} onPress={() => { h.setShowSubjects(!h.showSubjects); h.lightHaptic(); }}>
              <Text style={styles.dropdownButtonText}>{subjectLabel}</Text>
              <Ionicons name={h.showSubjects ? 'chevron-up' : 'chevron-down'} size={20} color={theme.textSecondary} />
            </TouchableOpacity>
            {h.showSubjects && (
              <ScrollView style={styles.dropdownList}>
                {SUBJECTS.map(s => <TouchableOpacity key={s.value} style={styles.dropdownItem} onPress={() => h.handleSubjectSelect(s.value)}><Text style={styles.dropdownItemText}>{s.label}</Text></TouchableOpacity>)}
              </ScrollView>
            )}
          </View>

          {/* Achievement Level Dropdown */}
          <Text style={styles.label}>{t('pop.achievementLevel')}</Text>
          <View style={styles.dropdown}>
            <TouchableOpacity style={styles.dropdownButton} onPress={() => { h.setShowAchievements(!h.showAchievements); h.lightHaptic(); }}>
              <Text style={styles.dropdownButtonText}>{achievementLabel}</Text>
              <Ionicons name={h.showAchievements ? 'chevron-up' : 'chevron-down'} size={20} color={theme.textSecondary} />
            </TouchableOpacity>
            {h.showAchievements && (
              <View style={styles.dropdownList}>
                {ACHIEVEMENT_LEVELS.map(a => <TouchableOpacity key={a.value} style={styles.dropdownItem} onPress={() => h.handleAchievementSelect(a.value)}><Text style={styles.dropdownItemText}>{a.label}</Text></TouchableOpacity>)}
              </View>
            )}
          </View>

          <Text style={styles.label}>{t('pop.learningArea')}</Text>
          <TextInput style={styles.input} value={h.learningArea} onChangeText={h.setLearningArea} placeholder={t('pop.learningAreaPlaceholder')} placeholderTextColor={theme.textSecondary} />
          <Text style={styles.helpText}>e.g., "Counting to 20", "Letter recognition", "Color mixing", "Fine motor skills"</Text>

          <Text style={styles.label}>{t('pop.description')} *</Text>
          <TextInput style={[styles.input, styles.textArea]} value={h.description} onChangeText={h.setDescription} placeholder={t('pop.descriptionPlaceholder')} placeholderTextColor={theme.textSecondary} multiline />
          <Text style={styles.helpText}>Tell us what makes you proud of this work. What did your child learn or accomplish?</Text>

          {h.suggestedTags.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={[styles.label, { fontSize: 14 }]}>✨ AI-Suggested Tags</Text>
              <View style={styles.tagsContainer}>{h.suggestedTags.map((tag, i) => <View key={`${tag}-${i}`} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>)}</View>
            </View>
          )}

          {h.description.trim().length > 20 && (
            <View style={styles.aiInsightContainer}>
              <Text style={styles.aiInsightText}>💡 {PictureOfProgressAI.getDevelopmentalInsight(h.subject, h.achievementLevel, PictureOfProgressAI.detectMilestone(h.description).milestone)}</Text>
            </View>
          )}
        </View>

        {/* Photo Upload */}
        <View style={styles.fileSection}>
          <Text style={styles.fileSectionTitle}>{t('pop.uploadPhoto')} *</Text>
          {!h.selectedFile ? (
            <View style={styles.fileButtons}>
              <TouchableOpacity style={styles.fileButton} onPress={h.handleCameraPicker}><Ionicons name="camera" size={24} color={theme.primary} /><Text style={styles.fileButtonText}>{t('pop.takePhoto')}</Text></TouchableOpacity>
              <TouchableOpacity style={styles.fileButton} onPress={h.handleImagePicker}><Ionicons name="images" size={24} color={theme.primary} /><Text style={styles.fileButtonText}>{t('pop.selectPhoto')}</Text></TouchableOpacity>
            </View>
          ) : (
            <View style={styles.selectedFileContainer}>
              <Image source={{ uri: h.displayUri || h.selectedFile.uri }} style={styles.imagePreview} />
              <View style={styles.fileInfo}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fileName}>{h.selectedFile.name}</Text>
                  <Text style={styles.fileDetails}>{h.selectedFile.size ? formatFileSize(h.selectedFile.size) : 'Unknown size'}</Text>
                </View>
                <TouchableOpacity style={styles.removeFileButton} onPress={h.clearFile}><Ionicons name="close-circle" size={24} color={theme.error} /></TouchableOpacity>
              </View>
            </View>
          )}
          {h.selectedFile ? (
            <TouchableOpacity
              style={[
                styles.fileButton,
                {
                  marginTop: 10,
                  opacity: h.analysisReady ? 1 : 0.7,
                },
              ]}
              onPress={h.analyzePhoto}
              disabled={!h.analysisReady}
            >
              {h.isAnalyzing ? (
                <EduDashSpinner size="small" color={theme.primary} />
              ) : (
                <>
                  <Ionicons name="sparkles-outline" size={20} color={theme.primary} />
                  <Text style={styles.fileButtonText}>Analyze Photo</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}
          {h.analysisError ? (
            <Text style={[styles.helpText, { color: theme.error || '#ef4444' }]}>{h.analysisError}</Text>
          ) : null}
          <Text style={styles.helpText}>📸 Tip: Take clear, well-lit photos that show your child's work clearly.</Text>
        </View>

        {/* Submit */}
        <TouchableOpacity style={[styles.submitButton, (h.createUpload.isPending || h.validateForm().length > 0) && styles.submitButtonDisabled]} onPress={h.handleSubmit} disabled={h.createUpload.isPending || h.validateForm().length > 0}>
          {h.createUpload.isPending ? <EduDashSpinner size="small" color={theme.onPrimary} /> : <Text style={styles.submitButtonText}>{t('pop.uploadProgressPicture')}</Text>}
        </TouchableOpacity>
      </ScrollView>
      <AlertModal {...alertProps} />
    </View>
  );
}
