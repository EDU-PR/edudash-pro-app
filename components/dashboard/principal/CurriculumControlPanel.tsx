/**
 * Curriculum Control Panel Component
 * 
 * Allows principals to manage curriculum settings and lesson approval requirements
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useCurriculumControl } from '@/hooks/useCurriculumControl';

interface CurriculumControlPanelProps {
  preschoolId: string;
}

export function CurriculumControlPanel({ preschoolId }: CurriculumControlPanelProps) {
  const { theme } = useTheme();
  const { settings, isLoading, updateSettings, isUpdating } = useCurriculumControl(preschoolId);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={{ color: theme.textSecondary }}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.text }]}>Curriculum Control</Text>

      <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
        <View style={styles.settingInfo}>
          <Text style={[styles.settingLabel, { color: theme.text }]}>Require Lesson Approval</Text>
          <Text style={[styles.settingDescription, { color: theme.textSecondary }]}>
            All lessons must be approved before teachers can assign them
          </Text>
        </View>
        <Switch
          value={settings?.require_lesson_approval || false}
          onValueChange={(value) => updateSettings({ require_lesson_approval: value })}
          disabled={isUpdating}
        />
      </View>

      <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
        <View style={styles.settingInfo}>
          <Text style={[styles.settingLabel, { color: theme.text }]}>Default Homework Due Days</Text>
          <Text style={[styles.settingDescription, { color: theme.textSecondary }]}>
            Default number of days until homework is due
          </Text>
        </View>
        <Text style={[styles.settingValue, { color: theme.text }]}>
          {settings?.default_homework_due_days || 7} days
        </Text>
      </View>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={[styles.settingLabel, { color: theme.text }]}>STEM Curriculum Version</Text>
          <Text style={[styles.settingDescription, { color: theme.textSecondary }]}>
            Current curriculum version
          </Text>
        </View>
        <Text style={[styles.settingValue, { color: theme.text }]}>
          {settings?.stem_curriculum_version || 'v1.0'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
  },
  settingValue: {
    fontSize: 16,
    fontWeight: '600',
  },
});
