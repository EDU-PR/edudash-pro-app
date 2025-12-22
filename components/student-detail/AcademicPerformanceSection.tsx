/**
 * Academic Performance Section Component
 * Shows attendance rate and last attendance date
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StudentDetail } from './types';

interface AcademicPerformanceSectionProps {
  student: StudentDetail;
  theme: any;
}

export const AcademicPerformanceSection: React.FC<AcademicPerformanceSectionProps> = ({
  student,
  theme,
}) => {
  const styles = createStyles(theme);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Academic Performance</Text>
      <View style={styles.performanceGrid}>
        <View style={styles.performanceCard}>
          <Text style={styles.performanceValue}>
            {student.attendance_rate?.toFixed(1) || '0.0'}%
          </Text>
          <Text style={styles.performanceLabel}>Attendance Rate</Text>
        </View>
        <View style={styles.performanceCard}>
          <Text style={styles.performanceValue}>
            {student.last_attendance 
              ? new Date(student.last_attendance).toLocaleDateString()
              : 'N/A'
            }
          </Text>
          <Text style={styles.performanceLabel}>Last Attendance</Text>
        </View>
      </View>
    </View>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
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
  performanceGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  performanceCard: {
    flex: 1,
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  performanceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 4,
  },
  performanceLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
  },
});
