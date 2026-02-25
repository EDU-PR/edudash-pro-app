// Year Plan Configuration Modal - Refactored for WARP.md compliance
// Configure AI year plan generation parameters

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { YearPlanConfig } from './types';
import { AGE_GROUPS, FOCUS_AREAS, PLANNING_FRAMEWORKS, getInitialConfig } from './types';
import { createStyles } from './YearPlanConfigModal.styles';

const STORAGE_KEY = 'edudash:year_plan_last_config';

interface YearPlanConfigModalProps {
  visible: boolean;
  onClose: () => void;
  onGenerate: (config: YearPlanConfig) => void;
}

export function YearPlanConfigModal({
  visible,
  onClose,
  onGenerate,
}: YearPlanConfigModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme, insets.top, insets.bottom);

  const [config, setConfig] = useState<YearPlanConfig>(getInitialConfig());

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored) {
          try {
            const parsed = JSON.parse(stored) as Partial<YearPlanConfig>;
            setConfig((prev) => ({ ...prev, ...parsed }));
          } catch {
            // ignore corrupt data
          }
        }
      })
      .catch(() => {});
  }, []);

  const toggleAgeGroup = (group: string) => {
    setConfig(prev => ({
      ...prev,
      ageGroups: prev.ageGroups.includes(group)
        ? prev.ageGroups.filter(g => g !== group)
        : [...prev.ageGroups, group],
    }));
  };

  const toggleFocusArea = (area: string) => {
    setConfig(prev => ({
      ...prev,
      focusAreas: prev.focusAreas.includes(area)
        ? prev.focusAreas.filter(a => a !== area)
        : [...prev.focusAreas, area],
    }));
  };

  const handleGenerate = () => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config)).catch(() => {});
    onClose();
    onGenerate(config);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer} edges={['top', 'left', 'right']}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Configure Year Plan</Text>
          <TouchableOpacity onPress={handleGenerate}>
            <Text style={styles.modalGenerate}>Generate</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentInner}>
          {/* Academic Year */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Academic Year</Text>
            <View style={styles.yearSelector}>
              {[2024, 2025, 2026].map((year) => (
                <TouchableOpacity
                  key={year}
                  style={[
                    styles.yearOption,
                    config.academicYear === year && styles.yearOptionActive,
                  ]}
                  onPress={() => setConfig(prev => ({ ...prev, academicYear: year }))}
                >
                  <Text
                    style={[
                      styles.yearOptionText,
                      config.academicYear === year && styles.yearOptionTextActive,
                    ]}
                  >
                    {year}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          {/* Number of Terms */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Number of Terms (Quarters)</Text>
            <View style={styles.termSelector}>
              {[4].map((num) => (
                <TouchableOpacity
                  key={num}
                  style={[
                    styles.termOption,
                    config.numberOfTerms === num && styles.termOptionActive,
                  ]}
                  onPress={() => setConfig(prev => ({ ...prev, numberOfTerms: num }))}
                >
                  <Text
                    style={[
                      styles.termOptionText,
                      config.numberOfTerms === num && styles.termOptionTextActive,
                    ]}
                  >
                    {num} Terms
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Planning Framework */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Planning Framework</Text>
            <View style={styles.focusAreaSelector}>
              {PLANNING_FRAMEWORKS.map((framework) => (
                <TouchableOpacity
                  key={framework.id}
                  style={[
                    styles.focusAreaOption,
                    config.planningFramework === framework.id && styles.focusAreaOptionActive,
                  ]}
                  onPress={() =>
                    setConfig((prev) => ({
                      ...prev,
                      planningFramework: framework.id,
                      strictTemplateMode: framework.id === 'grade_rr_52_week' ? true : prev.strictTemplateMode,
                    }))
                  }
                >
                  <Text
                    style={[
                      styles.focusAreaOptionText,
                      config.planningFramework === framework.id && styles.focusAreaOptionTextActive,
                    ]}
                  >
                    {framework.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          {/* Age Groups */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Age Groups</Text>
            <View style={styles.ageGroupSelector}>
              {AGE_GROUPS.map((group) => (
                <TouchableOpacity
                  key={group}
                  style={[
                    styles.ageGroupOption,
                    config.ageGroups.includes(group) && styles.ageGroupOptionActive,
                  ]}
                  onPress={() => toggleAgeGroup(group)}
                >
                  <Text
                    style={[
                      styles.ageGroupOptionText,
                      config.ageGroups.includes(group) && styles.ageGroupOptionTextActive,
                    ]}
                  >
                    {group} yrs
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          {/* Focus Areas */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Focus Areas</Text>
            <View style={styles.focusAreaSelector}>
              {FOCUS_AREAS.map((area) => (
                <TouchableOpacity
                  key={area}
                  style={[
                    styles.focusAreaOption,
                    config.focusAreas.includes(area) && styles.focusAreaOptionActive,
                  ]}
                  onPress={() => toggleFocusArea(area)}
                >
                  <Text
                    style={[
                      styles.focusAreaOptionText,
                      config.focusAreas.includes(area) && styles.focusAreaOptionTextActive,
                    ]}
                  >
                    {area}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          {/* Toggles */}
          <View style={styles.togglesGroup}>
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setConfig(prev => ({ ...prev, includeExcursions: !prev.includeExcursions }))}
            >
              <View style={styles.toggleInfo}>
                <Ionicons name="bus-outline" size={20} color={theme.text} />
                <Text style={styles.toggleLabel}>Include Excursions</Text>
              </View>
              <View style={[styles.toggle, config.includeExcursions && styles.toggleActive]}>
                <View style={[styles.toggleThumb, config.includeExcursions && styles.toggleThumbActive]} />
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setConfig(prev => ({ ...prev, includeMeetings: !prev.includeMeetings }))}
            >
              <View style={styles.toggleInfo}>
                <Ionicons name="people-outline" size={20} color={theme.text} />
                <Text style={styles.toggleLabel}>Include Meetings</Text>
              </View>
              <View style={[styles.toggle, config.includeMeetings && styles.toggleActive]}>
                <View style={[styles.toggleThumb, config.includeMeetings && styles.toggleThumbActive]} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setConfig(prev => ({ ...prev, separateAgeGroupTracks: !prev.separateAgeGroupTracks }))}
            >
              <View style={styles.toggleInfo}>
                <Ionicons name="layers-outline" size={20} color={theme.text} />
                <Text style={styles.toggleLabel}>Separate Age-Group Tracks</Text>
              </View>
              <View style={[styles.toggle, config.separateAgeGroupTracks && styles.toggleActive]}>
                <View style={[styles.toggleThumb, config.separateAgeGroupTracks && styles.toggleThumbActive]} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setConfig(prev => ({ ...prev, strictTemplateMode: !prev.strictTemplateMode }))}
            >
              <View style={styles.toggleInfo}>
                <Ionicons name="shield-checkmark-outline" size={20} color={theme.text} />
                <Text style={styles.toggleLabel}>Strict Template Lock</Text>
              </View>
              <View style={[styles.toggle, config.strictTemplateMode && styles.toggleActive]}>
                <View style={[styles.toggleThumb, config.strictTemplateMode && styles.toggleThumbActive]} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() =>
                setConfig(prev => ({ ...prev, includeAssessmentGuidance: !prev.includeAssessmentGuidance }))
              }
            >
              <View style={styles.toggleInfo}>
                <Ionicons name="checkmark-done-outline" size={20} color={theme.text} />
                <Text style={styles.toggleLabel}>Include Assessment Guidance</Text>
              </View>
              <View style={[styles.toggle, config.includeAssessmentGuidance && styles.toggleActive]}>
                <View style={[styles.toggleThumb, config.includeAssessmentGuidance && styles.toggleThumbActive]} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() =>
                setConfig(prev => ({ ...prev, includeInclusionAdaptations: !prev.includeInclusionAdaptations }))
              }
            >
              <View style={styles.toggleInfo}>
                <Ionicons name="accessibility-outline" size={20} color={theme.text} />
                <Text style={styles.toggleLabel}>Include Inclusion Adaptations</Text>
              </View>
              <View style={[styles.toggle, config.includeInclusionAdaptations && styles.toggleActive]}>
                <View style={[styles.toggleThumb, config.includeInclusionAdaptations && styles.toggleThumbActive]} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() =>
                setConfig(prev => ({ ...prev, includeHomeLinkExtensions: !prev.includeHomeLinkExtensions }))
              }
            >
              <View style={styles.toggleInfo}>
                <Ionicons name="home-outline" size={20} color={theme.text} />
                <Text style={styles.toggleLabel}>Include Home-Link Extensions</Text>
              </View>
              <View style={[styles.toggle, config.includeHomeLinkExtensions && styles.toggleActive]}>
                <View style={[styles.toggleThumb, config.includeHomeLinkExtensions && styles.toggleThumbActive]} />
              </View>
            </TouchableOpacity>
          </View>
          
          {/* Budget Level */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Budget Level</Text>
            <View style={styles.budgetSelector}>
              {(['low', 'medium', 'high'] as const).map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.budgetOption,
                    config.budgetLevel === level && styles.budgetOptionActive,
                  ]}
                  onPress={() => setConfig(prev => ({ ...prev, budgetLevel: level }))}
                >
                  <Ionicons
                    name={level === 'low' ? 'wallet-outline' : level === 'medium' ? 'wallet' : 'cash'}
                    size={20}
                    color={config.budgetLevel === level ? '#fff' : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.budgetOptionText,
                      config.budgetLevel === level && styles.budgetOptionTextActive,
                    ]}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Principal Rules for AI (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={config.principalRules}
              onChangeText={(text) => setConfig(prev => ({ ...prev, principalRules: text }))}
              placeholder="Add non-negotiable rules (e.g., separate nap policy by age, fixed reporting milestones, teacher moderation expectations)."
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Special Considerations */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Special Considerations (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={config.specialConsiderations}
              onChangeText={(text) => setConfig(prev => ({ ...prev, specialConsiderations: text }))}
              placeholder="Any specific themes, cultural events, or requirements..."
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={3}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
