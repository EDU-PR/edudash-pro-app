import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, Image, Platform, Animated } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { SubPageHeader } from '@/components/SubPageHeader';
import { useCreatePOPUpload, CreatePOPUploadData } from '@/hooks/usePOPUploads';
import { formatFileSize } from '@/lib/popUpload';
import { ensureImageLibraryPermission } from '@/lib/utils/mediaLibrary';
import ProfileImageService from '@/services/ProfileImageService';
import { PictureOfProgressAI, ImageAnalysisResult } from '@/services/PictureOfProgressAI';
import { useCelebration } from '@/hooks/useCelebration';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
// Subject options (common subjects for early childhood)
const SUBJECTS = [
  { value: 'mathematics', label: 'Mathematics' },
  { value: 'english', label: 'English' },
  { value: 'afrikaans', label: 'Afrikaans' },
  { value: 'art', label: 'Art & Creativity' },
  { value: 'science', label: 'Science' },
  { value: 'physical_education', label: 'Physical Education' },
  { value: 'life_skills', label: 'Life Skills' },
  { value: 'music', label: 'Music' },
  { value: 'reading', label: 'Reading' },
  { value: 'writing', label: 'Writing' },
  { value: 'social_skills', label: 'Social Skills' },
  { value: 'other', label: 'Other' },
];

// Achievement levels
const ACHIEVEMENT_LEVELS = [
  { value: 'excellent', label: '⭐ Excellent' },
  { value: 'good', label: '👍 Good' },
  { value: 'improving', label: '📈 Improving' },
  { value: 'needs_support', label: '🤝 Needs Support' },
  { value: 'milestone', label: '🎯 Milestone Achieved' },
];

interface SelectedFile {
  uri: string;
  name: string;
  size?: number;
  type?: string;
}

export default function PictureOfProgressScreen() {
  const params = useLocalSearchParams<{
    studentId?: string | string[];
    studentName?: string | string[];
    prefillTitle?: string | string[];
    prefillDescription?: string | string[];
    prefillSubject?: string | string[];
    prefillLearningArea?: string | string[];
    nextStep?: string | string[];
    gradeLevel?: string | string[];
    assignmentTitle?: string | string[];
    submissionTemplate?: string | string[];
    contextTag?: string | string[];
    sourceFlow?: string | string[];
    activityId?: string | string[];
    activityTitle?: string | string[];
  }>();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const createUpload = useCreatePOPUpload();
  const { celebrate, successHaptic, milestoneHaptic, selectionHaptic, lightHaptic } = useCelebration();
  const readParam = useCallback((value?: string | string[]) => {
    const raw = Array.isArray(value) ? value[0] : value;
    if (!raw) return '';
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }, []);
  const studentId = readParam(params.studentId);
  const studentName = readParam(params.studentName);
  const nextStep = readParam(params.nextStep);
  const prefillTitle = readParam(params.prefillTitle);
  const prefillDescription = readParam(params.prefillDescription);
  const prefillSubject = readParam(params.prefillSubject);
  const prefillLearningArea = readParam(params.prefillLearningArea);
  const gradeLevel = readParam(params.gradeLevel);
  const assignmentTitle = readParam(params.assignmentTitle);
  const submissionTemplate = readParam(params.submissionTemplate);
  const contextTag = readParam(params.contextTag);
  const sourceFlow = readParam(params.sourceFlow);
  const activityId = readParam(params.activityId);
  const activityTitle = readParam(params.activityTitle);
  const shouldContinueToGrader = nextStep === 'grade';
  
  // Form state
  const [title, setTitle] = useState(prefillTitle);
  const [description, setDescription] = useState(prefillDescription);
  const [subject, setSubject] = useState<string>(prefillSubject);
  const [achievementLevel, setAchievementLevel] = useState<string>('');
  const [learningArea, setLearningArea] = useState(prefillLearningArea);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [displayUri, setDisplayUri] = useState<string | null>(null);
  const [showSubjects, setShowSubjects] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  
  // AI-powered enhancements state
  const [aiSuggestions, setAiSuggestions] = useState<ImageAnalysisResult | null>(null);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [showMilestoneAlert, setShowMilestoneAlert] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Animation refs for celebrations
  const celebrationScale = useState(new Animated.Value(1))[0];
  const milestoneOpacity = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (prefillTitle && !title) setTitle(prefillTitle);
    if (prefillDescription && !description) setDescription(prefillDescription);
    if (prefillSubject && !subject) setSubject(prefillSubject);
    if (prefillLearningArea && !learningArea) setLearningArea(prefillLearningArea);
  }, [description, learningArea, prefillDescription, prefillLearningArea, prefillSubject, prefillTitle, subject, title]);

  // Convert local image URIs to data URIs for web compatibility
  useEffect(() => {
    const convertImageUri = async () => {
      if (selectedFile?.uri) {
        try {
          // Only convert for web platform and local URIs
          if (Platform.OS === 'web' && (selectedFile.uri.startsWith('blob:') || selectedFile.uri.startsWith('file:'))) {
            const dataUri = await ProfileImageService.convertToDataUri(selectedFile.uri);
            setDisplayUri(dataUri);
          } else {
            // For mobile or remote URIs, use the original URI
            setDisplayUri(selectedFile.uri);
          }
        } catch (error) {
          console.error('Failed to convert image URI:', error);
          setDisplayUri(selectedFile.uri); // Fallback to original URI
        }
      } else {
        setDisplayUri(null);
      }
    };
    
    convertImageUri();
  }, [selectedFile]);
  
  // AI-powered auto-tagging when description or subject changes
  useEffect(() => {
    if (description.trim().length > 10) {
      const tags = PictureOfProgressAI.generateTags(description, subject);
      setSuggestedTags(tags);
      
      // Check for milestone
      const milestoneResult = PictureOfProgressAI.detectMilestone(description);
      if (milestoneResult.detected && !showMilestoneAlert) {
        setShowMilestoneAlert(true);
        triggerMilestoneAnimation();
        milestoneHaptic();
      }
    }
  }, [description, subject]);
  
  // Play celebration animation when milestone detected
  const triggerMilestoneAnimation = useCallback(() => {
    // Pulse animation
    Animated.sequence([
      Animated.spring(celebrationScale, {
        toValue: 1.1,
        useNativeDriver: true,
        friction: 3,
      }),
      Animated.spring(celebrationScale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 3,
      }),
    ]).start();
    
    // Fade in milestone banner
    Animated.timing(milestoneOpacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [celebrationScale, milestoneOpacity]);
  
  // Handle dropdown selection with haptic
  const handleSubjectSelect = useCallback((value: string) => {
    setSubject(value);
    setShowSubjects(false);
    selectionHaptic();
  }, [selectionHaptic]);
  
  const handleAchievementSelect = useCallback((value: string) => {
    setAchievementLevel(value);
    setShowAchievements(false);
    selectionHaptic();
  }, [selectionHaptic]);
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollContent: {
      padding: 20,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 12,
    },
    label: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.text,
      marginBottom: 8,
    },
    input: {
      backgroundColor: theme.surface,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 16,
    },
    textArea: {
      height: 100,
      textAlignVertical: 'top',
    },
    dropdown: {
      backgroundColor: theme.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 16,
    },
    dropdownButton: {
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dropdownButtonText: {
      fontSize: 16,
      color: theme.text,
    },
    dropdownList: {
      borderTopWidth: 1,
      borderTopColor: theme.border,
      maxHeight: 200,
    },
    dropdownItem: {
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    dropdownItemText: {
      fontSize: 16,
      color: theme.text,
    },
    fileSection: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
    },
    fileSectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 12,
    },
    fileButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    fileButton: {
      flex: 1,
      backgroundColor: theme.primary + '20',
      borderRadius: 8,
      padding: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.primary + '40',
    },
    fileButtonText: {
      color: theme.primary,
      fontSize: 14,
      fontWeight: '500',
      marginTop: 4,
    },
    selectedFileContainer: {
      marginTop: 12,
      backgroundColor: theme.elevated,
      borderRadius: 8,
    },
    imagePreview: {
      width: '100%',
      height: 200,
      borderRadius: 8,
      backgroundColor: theme.textSecondary + '20',
    },
    fileInfo: {
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    fileName: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.text,
      flex: 1,
    },
    fileDetails: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    removeFileButton: {
      padding: 8,
      marginLeft: 12,
    },
    submitButton: {
      backgroundColor: theme.primary,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
      marginTop: 12,
    },
    submitButtonDisabled: {
      backgroundColor: theme.textSecondary + '40',
    },
    submitButtonText: {
      color: theme.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    helpText: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 4,
      lineHeight: 20,
    },
    // Milestone celebration styles
    milestoneBanner: {
      backgroundColor: '#FEF3C7',
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderWidth: 2,
      borderColor: '#F59E0B',
      shadowColor: '#F59E0B',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    milestoneContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    milestoneEmoji: {
      fontSize: 32,
      marginRight: 12,
    },
    milestoneTextContainer: {
      flex: 1,
    },
    milestoneTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: '#92400E',
      marginBottom: 4,
    },
    milestoneSubtitle: {
      fontSize: 14,
      color: '#B45309',
      lineHeight: 20,
    },
    // AI Suggested tags
    tagsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 8,
      gap: 8,
    },
    tag: {
      backgroundColor: theme.primary + '20',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.primary + '40',
    },
    tagText: {
      fontSize: 12,
      color: theme.primary,
      fontWeight: '500',
    },
    aiInsightContainer: {
      backgroundColor: theme.surface,
      borderRadius: 8,
      padding: 12,
      marginTop: 12,
      borderLeftWidth: 3,
      borderLeftColor: theme.primary,
    },
    aiInsightText: {
      fontSize: 14,
      color: theme.text,
      lineHeight: 20,
      fontStyle: 'italic',
    },
  });
  
  const handleImagePicker = async () => {
    try {
      const hasPermission = await ensureImageLibraryPermission();
      if (!hasPermission) {
        Alert.alert(
          t('common.error'),
          'Camera roll permission is required to select images.'
        );
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });
      
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.fileName || `progress_${Date.now()}.jpg`,
          size: asset.fileSize,
          type: asset.type || 'image/jpeg',
        });
      }
    } catch (error) {
      Alert.alert(t('common.error'), 'Failed to select image');
    }
  };
  
  const handleCameraPicker = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('common.error'),
          'Camera permission is required to take photos.'
        );
        return;
      }
      
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 1,
      });
      
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.fileName || `progress_${Date.now()}.jpg`,
          size: asset.fileSize,
          type: asset.type || 'image/jpeg',
        });
      }
    } catch (error) {
      Alert.alert(t('common.error'), 'Failed to take photo');
    }
  };
  
  const validateForm = (): string[] => {
    const errors: string[] = [];
    
    if (!title.trim()) {
      errors.push('Title is required');
    }
    if (!subject) {
      errors.push('Subject is required');
    }
    if (!description.trim()) {
      errors.push('Description is required');
    }
    if (!selectedFile) {
      errors.push('Photo is required');
    }
    
    return errors;
  };
  
  const handleSubmit = async () => {
    const errors = validateForm();
    if (errors.length > 0) {
      Alert.alert(t('common.error'), errors.join('\n'));
      return;
    }
    
    if (!studentId || !selectedFile) return;
    
    try {
      // Get AI-generated tags for the upload
      const tags = suggestedTags.length > 0 
        ? suggestedTags 
        : PictureOfProgressAI.generateTags(description, subject);
      
      // Check for milestone
      const milestoneResult = PictureOfProgressAI.detectMilestone(description);
      
      const uploadData: CreatePOPUploadData = {
        student_id: studentId,
        upload_type: 'picture_of_progress',
        title: title.trim(),
        description: description.trim(),
        file_uri: selectedFile.uri,
        file_name: selectedFile.name,
        subject: subject,
        achievement_level: achievementLevel || undefined,
        learning_area: learningArea.trim() || undefined,
        // Include AI-generated metadata
        tags: tags.length > 0 ? tags : undefined,
        is_milestone: milestoneResult.detected,
        milestone_type: milestoneResult.milestone?.name,
      };
      
      const createdUpload = await createUpload.mutateAsync(uploadData);
      
      // Celebrate successful upload! 🎉
      if (milestoneResult.detected) {
        await celebrate({ type: 'milestone' });
      } else {
        await celebrate({ type: 'upload' });
      }
      
      Alert.alert(
        milestoneResult.detected 
          ? '🎉 Milestone Captured!' 
          : t('pop.progressUploadSuccess'),
        milestoneResult.detected
          ? `Amazing! You've captured a special milestone: ${milestoneResult.milestone?.name || 'Achievement'}. This moment has been saved to your child's learning journey!`
          : t('pop.progressUploadSuccessDesc'),
        [
          {
            text: t('common.ok'),
            onPress: () => {
              if (!shouldContinueToGrader) {
                router.back();
                return;
              }

              const fallbackName = studentName || 'Child';
              const finalAssignmentTitle = assignmentTitle || `${title.trim() || 'Family Activity'} Review`;
              const finalSubmissionTemplate = submissionTemplate
                || `${fallbackName} completed ${title.trim() || 'a family activity'} at home. Add what they found easy or difficult and what they learned.`;
              const finalGradeLevel = gradeLevel || 'Age 5';
              const gradingParams: Record<string, string> = {
                assignmentTitle: encodeURIComponent(finalAssignmentTitle),
                gradeLevel: encodeURIComponent(finalGradeLevel),
                submissionContent: encodeURIComponent(finalSubmissionTemplate),
                studentId,
                progressUploadId: createdUpload.id,
                contextTag: encodeURIComponent(contextTag || 'family_activity'),
                sourceFlow: encodeURIComponent(sourceFlow || 'parent_picture_of_progress'),
              };
              if (activityId) gradingParams.activityId = encodeURIComponent(activityId);
              if (activityTitle) gradingParams.activityTitle = encodeURIComponent(activityTitle);

              router.push({
                pathname: '/screens/ai-homework-grader-live',
                params: gradingParams,
              } as any);
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : 'Upload failed'
      );
    }
  };
  
  const getSelectedSubjectLabel = () => {
    const subjectOption = SUBJECTS.find(s => s.value === subject);
    if (subjectOption) return subjectOption.label;
    return subject || t('pop.subject');
  };
  
  const getSelectedAchievementLabel = () => {
    const achievement = ACHIEVEMENT_LEVELS.find(a => a.value === achievementLevel);
    return achievement ? achievement.label : t('pop.selectAchievementLevel');
  };
  
  return (
    <View style={styles.container}>
      <SubPageHeader 
        title={t('pop.uploadPictureOfProgress')} 
      />
      
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Student Info */}
        {studentName && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('pop.progressFor')}: {studentName}
            </Text>
          </View>
        )}
        
        {/* Milestone Celebration Banner */}
        {showMilestoneAlert && (
          <Animated.View 
            style={[
              styles.milestoneBanner, 
              { 
                opacity: milestoneOpacity,
                transform: [{ scale: celebrationScale }] 
              }
            ]}
          >
            <View style={styles.milestoneContent}>
              <Text style={styles.milestoneEmoji}>🎉</Text>
              <View style={styles.milestoneTextContainer}>
                <Text style={styles.milestoneTitle}>Milestone Detected!</Text>
                <Text style={styles.milestoneSubtitle}>
                  {aiSuggestions?.celebrationSuggestion || 
                    PictureOfProgressAI.getCelebrationSuggestion(
                      PictureOfProgressAI.detectMilestone(description).milestone
                    ) ||
                    "What an amazing achievement! 🌟"
                  }
                </Text>
              </View>
            </View>
          </Animated.View>
        )}
        
        {/* Progress Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('pop.progressDetails')}</Text>
          
          <Text style={styles.label}>{t('pop.title')} *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder={t('pop.titlePlaceholder')}
            placeholderTextColor={theme.textSecondary}
          />
          
          <Text style={styles.label}>{t('pop.subject')} *</Text>
          <View style={styles.dropdown}>
            <TouchableOpacity 
              style={styles.dropdownButton}
              onPress={() => {
                setShowSubjects(!showSubjects);
                lightHaptic();
              }}
            >
              <Text style={styles.dropdownButtonText}>
                {getSelectedSubjectLabel()}
              </Text>
              <Ionicons 
                name={showSubjects ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color={theme.textSecondary} 
              />
            </TouchableOpacity>
            {showSubjects && (
              <ScrollView style={styles.dropdownList}>
                {SUBJECTS.map((subjectOption) => (
                  <TouchableOpacity
                    key={subjectOption.value}
                    style={styles.dropdownItem}
                    onPress={() => handleSubjectSelect(subjectOption.value)}
                  >
                    <Text style={styles.dropdownItemText}>{subjectOption.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
          
          <Text style={styles.label}>{t('pop.achievementLevel')}</Text>
          <View style={styles.dropdown}>
            <TouchableOpacity 
              style={styles.dropdownButton}
              onPress={() => {
                setShowAchievements(!showAchievements);
                lightHaptic();
              }}
            >
              <Text style={styles.dropdownButtonText}>
                {getSelectedAchievementLabel()}
              </Text>
              <Ionicons 
                name={showAchievements ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color={theme.textSecondary} 
              />
            </TouchableOpacity>
            {showAchievements && (
              <View style={styles.dropdownList}>
                {ACHIEVEMENT_LEVELS.map((achievement) => (
                  <TouchableOpacity
                    key={achievement.value}
                    style={styles.dropdownItem}
                    onPress={() => handleAchievementSelect(achievement.value)}
                  >
                    <Text style={styles.dropdownItemText}>{achievement.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          
          <Text style={styles.label}>{t('pop.learningArea')}</Text>
          <TextInput
            style={styles.input}
            value={learningArea}
            onChangeText={setLearningArea}
            placeholder={t('pop.learningAreaPlaceholder')}
            placeholderTextColor={theme.textSecondary}
          />
          <Text style={styles.helpText}>
            e.g., "Counting to 20", "Letter recognition", "Color mixing", "Fine motor skills"
          </Text>
          
          <Text style={styles.label}>{t('pop.description')} *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder={t('pop.descriptionPlaceholder')}
            placeholderTextColor={theme.textSecondary}
            multiline
          />
          <Text style={styles.helpText}>
            Tell us what makes you proud of this work. What did your child learn or accomplish?
          </Text>
          
          {/* AI-Generated Tags */}
          {suggestedTags.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={[styles.label, { fontSize: 14 }]}>
                ✨ AI-Suggested Tags
              </Text>
              <View style={styles.tagsContainer}>
                {suggestedTags.map((tag, index) => (
                  <View key={`${tag}-${index}`} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          
          {/* Developmental Insight */}
          {description.trim().length > 20 && (
            <View style={styles.aiInsightContainer}>
              <Text style={styles.aiInsightText}>
                💡 {PictureOfProgressAI.getDevelopmentalInsight(
                  subject, 
                  achievementLevel,
                  PictureOfProgressAI.detectMilestone(description).milestone
                )}
              </Text>
            </View>
          )}
        </View>
        
        {/* Photo Upload */}
        <View style={styles.fileSection}>
          <Text style={styles.fileSectionTitle}>{t('pop.uploadPhoto')} *</Text>
          
          {!selectedFile ? (
            <View style={styles.fileButtons}>
              <TouchableOpacity style={styles.fileButton} onPress={handleCameraPicker}>
                <Ionicons name="camera" size={24} color={theme.primary} />
                <Text style={styles.fileButtonText}>{t('pop.takePhoto')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.fileButton} onPress={handleImagePicker}>
                <Ionicons name="images" size={24} color={theme.primary} />
                <Text style={styles.fileButtonText}>{t('pop.selectPhoto')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.selectedFileContainer}>
              <Image source={{ uri: displayUri || selectedFile.uri }} style={styles.imagePreview} />
              
              <View style={styles.fileInfo}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fileName}>{selectedFile.name}</Text>
                  <Text style={styles.fileDetails}>
                    {selectedFile.size ? formatFileSize(selectedFile.size) : 'Unknown size'}
                  </Text>
                </View>
                
                <TouchableOpacity 
                  style={styles.removeFileButton}
                  onPress={() => {
                    setSelectedFile(null);
                    setDisplayUri(null);
                  }}
                >
                  <Ionicons name="close-circle" size={24} color={theme.error} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          <Text style={styles.helpText}>
            📸 Tip: Take clear, well-lit photos that show your child's work clearly. Include any artwork, worksheets, projects, or activities that demonstrate their progress.
          </Text>
        </View>
        
        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (createUpload.isPending || validateForm().length > 0) && styles.submitButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={createUpload.isPending || validateForm().length > 0}
        >
          {createUpload.isPending ? (
            <EduDashSpinner size="small" color={theme.onPrimary} />
          ) : (
            <Text style={styles.submitButtonText}>{t('pop.uploadProgressPicture')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
