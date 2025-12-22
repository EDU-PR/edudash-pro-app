/**
 * CV Builder Screen (React Native)
 * 
 * CV building functionality for learners.
 * Allows creating, editing, and sharing CVs.
 * 
 * Refactored to use extracted components from components/cv-builder/
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { useLearnerCVs, useCreateCV } from '@/hooks/useLearnerData';
import {
  CVSection,
  ViewMode,
  getSectionTitle,
  getDefaultSectionData,
} from '@/components/cv-builder/types';
import {
  PersonalInfoSection,
  SectionCard,
  SectionEditorModal,
} from '@/components/cv-builder/CVComponents';
import { CVPreview } from '@/components/cv-builder/CVPreview';
import { handleShare as shareCV } from '@/components/cv-builder/sharing';

export default function CVBuilderScreen() {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const { data: cvs } = useLearnerCVs();
  const existingCV = cvs?.find((cv) => cv.id === id);
  const createCV = useCreateCV();

  const [cvTitle, setCvTitle] = useState(existingCV?.title || 'My CV');
  const [sections, setSections] = useState<CVSection[]>(
    existingCV?.cv_data?.sections || [
      { id: '1', type: 'personal', title: 'Personal Information', data: {} },
    ]
  );
  const [activeSection, setActiveSection] = useState<CVSection | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [isSharing, setIsSharing] = useState(false);

  const addSection = (type: CVSection['type']) => {
    const newSection: CVSection = {
      id: Date.now().toString(),
      type,
      title: getSectionTitle(type, t),
      data: getDefaultSectionData(type),
    };
    setSections([...sections, newSection]);
    setActiveSection(newSection);
  };

  const updateSection = (sectionId: string, updates: Partial<CVSection>) => {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, ...updates } : s))
    );
  };

  const removeSection = (sectionId: string) => {
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
    if (activeSection?.id === sectionId) {
      setActiveSection(null);
    }
  };

  const handleSave = async () => {
    if (!cvTitle.trim()) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('cv.title_required', { defaultValue: 'Please enter a CV title' })
      );
      return;
    }

    setIsSaving(true);
    try {
      await createCV.mutateAsync({
        title: cvTitle,
        cv_data: { sections },
      });

      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        t('cv.saved', { defaultValue: 'CV saved successfully' }),
        [{ text: t('common.ok', { defaultValue: 'OK' }), onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        error.message || t('common.save_failed', { defaultValue: 'Failed to save CV' })
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSharePress = async (method: 'native' | 'pdf' | 'linkedin' | 'whatsapp' | 'email') => {
    setIsSharing(true);
    try {
      await shareCV(method, sections, cvTitle, profile, theme, t);
    } finally {
      setIsSharing(false);
    }
  };

  const showShareOptions = () => {
    Alert.alert(
      t('cv.share_cv', { defaultValue: 'Share CV' }),
      t('cv.select_share_method', { defaultValue: 'Select sharing method' }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        { text: t('cv.share_as_pdf', { defaultValue: 'Share as PDF' }), onPress: () => handleSharePress('pdf') },
        { text: t('cv.share_as_text', { defaultValue: 'Share as Text' }), onPress: () => handleSharePress('native') },
        { text: 'LinkedIn', onPress: () => handleSharePress('linkedin') },
        { text: 'WhatsApp', onPress: () => handleSharePress('whatsapp') },
        { text: t('cv.email', { defaultValue: 'Email' }), onPress: () => handleSharePress('email') },
      ]
    );
  };

  const showAddSectionOptions = () => {
    Alert.alert(
      t('cv.add_section', { defaultValue: 'Add Section' }),
      t('cv.select_section_type', { defaultValue: 'Select section type' }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        { text: t('cv.experience', { defaultValue: 'Experience' }), onPress: () => addSection('experience') },
        { text: t('cv.education', { defaultValue: 'Education' }), onPress: () => addSection('education') },
        { text: t('cv.skills', { defaultValue: 'Skills' }), onPress: () => addSection('skills') },
        { text: t('cv.certifications', { defaultValue: 'Certifications' }), onPress: () => addSection('certifications') },
        { text: t('cv.languages', { defaultValue: 'Languages' }), onPress: () => addSection('languages') },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <Stack.Screen
        options={{
          title: existingCV
            ? t('cv.edit_cv', { defaultValue: 'Edit CV' })
            : t('cv.create_cv', { defaultValue: 'Create CV' }),
          headerRight: () => (
            <View style={styles.headerRight}>
              <TouchableOpacity onPress={() => setViewMode(viewMode === 'edit' ? 'preview' : 'edit')}>
                <Ionicons
                  name={viewMode === 'edit' ? 'eye-outline' : 'create-outline'}
                  size={24}
                  color={theme.primary}
                />
              </TouchableOpacity>
              {viewMode === 'preview' && (
                <TouchableOpacity onPress={showShareOptions} disabled={isSharing}>
                  {isSharing ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <Ionicons name="share-outline" size={24} color={theme.primary} />
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleSave} disabled={isSaving || createCV.isPending}>
                {isSaving || createCV.isPending ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Text style={[styles.saveText, { color: theme.primary }]}>
                    {t('common.save', { defaultValue: 'Save' })}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      {viewMode === 'edit' ? (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 16 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* CV Title */}
          <Card padding={16} margin={0} elevation="small" style={styles.section}>
            <Text style={[styles.label, { color: theme.text }]}>
              {t('cv.cv_title', { defaultValue: 'CV Title' })}
            </Text>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
              value={cvTitle}
              onChangeText={setCvTitle}
              placeholder={t('cv.cv_title_placeholder', { defaultValue: 'e.g., Software Developer CV' })}
              placeholderTextColor={theme.textSecondary}
            />
          </Card>

          {/* Personal Information */}
          <PersonalInfoSection
            section={sections.find((s) => s.type === 'personal')}
            onUpdate={(data) => {
              const personalSection = sections.find((s) => s.type === 'personal');
              if (personalSection) {
                updateSection(personalSection.id, { data });
              }
            }}
            theme={theme}
            t={t}
          />

          {/* Other Sections */}
          {sections
            .filter((s) => s.type !== 'personal')
            .map((section) => (
              <SectionCard
                key={section.id}
                section={section}
                onEdit={() => setActiveSection(section)}
                onDelete={() => removeSection(section.id)}
                theme={theme}
                t={t}
              />
            ))}

          {/* Add Section Button */}
          <TouchableOpacity
            style={[styles.addSectionButton, { borderColor: theme.border }]}
            onPress={showAddSectionOptions}
          >
            <Ionicons name="add-circle-outline" size={24} color={theme.primary} />
            <Text style={[styles.addSectionText, { color: theme.primary }]}>
              {t('cv.add_section', { defaultValue: 'Add Section' })}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <CVPreview
          sections={sections}
          cvTitle={cvTitle}
          profile={profile}
          theme={theme}
          insets={insets}
          t={t}
        />
      )}

      {/* Section Editor Modal */}
      {activeSection && (
        <SectionEditorModal
          section={activeSection}
          onUpdate={(data) => updateSection(activeSection.id, { data })}
          onClose={() => setActiveSection(null)}
          theme={theme}
          insets={insets}
          t={t}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
    marginRight: 16,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    padding: 16,
    paddingTop: 8,
  },
  section: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
  },
  addSectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    gap: 8,
    marginTop: 8,
  },
  addSectionText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
