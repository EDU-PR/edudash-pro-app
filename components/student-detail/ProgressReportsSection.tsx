/**
 * Progress Reports Section Component
 * Links to progress report creation or review
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StudentDetail } from './types';
import type { ThemeColors } from '@/contexts/ThemeContext';

export type ProgressReportMode = 'principal' | 'teacher' | 'parent';

interface ProgressReportsSectionProps {
  student: StudentDetail;
  mode: ProgressReportMode;
  theme: ThemeColors;
}

export const ProgressReportsSection: React.FC<ProgressReportsSectionProps> = ({
  student,
  mode,
  theme,
}) => {
  const router = useRouter();
  const styles = createStyles(theme);
  const isPrincipal = mode === 'principal';
  const isTeacher = mode === 'teacher';
  const isParent = mode === 'parent';

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Academic Reports</Text>
      <TouchableOpacity 
        style={styles.progressReportButton}
        onPress={() => {
          if (isPrincipal) {
            router.push('/screens/principal-report-review');
          } else if (isTeacher) {
            router.push(`/screens/progress-report-creator?student_id=${student.id}`);
          } else {
            router.push('/screens/parent-progress');
          }
        }}
      >
        <View style={styles.progressReportContent}>
          <View style={styles.progressReportIcon}>
            <Ionicons name="document-text" size={24} color="#8B5CF6" />
          </View>
          <View style={styles.progressReportText}>
            <Text style={styles.progressReportTitle}>
              {isPrincipal
                ? 'Review Progress Reports'
                : isTeacher
                ? 'Create Progress Report'
                : 'View Progress Reports'}
            </Text>
            <Text style={styles.progressReportSubtitle}>
              {isPrincipal
                ? 'View and approve student reports'
                : isTeacher
                ? 'Send academic progress to parents'
                : 'Track progress and weekly summaries'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </View>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  section: {
    margin: 16,
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    shadowColor: theme.shadow || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 16,
  },
  progressReportButton: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  progressReportContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressReportIcon: {
    width: 48,
    height: 48,
    backgroundColor: theme.card,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  progressReportText: {
    flex: 1,
  },
  progressReportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  progressReportSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
  },
});
