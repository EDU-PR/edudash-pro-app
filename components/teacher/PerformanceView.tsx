/**
 * PerformanceView Component
 * 
 * Displays teacher performance reviews and ratings.
 * Extracted from app/screens/teacher-management.tsx per WARP.md standards.
 */

import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Teacher } from '@/types/teacher-management';
import type { ThemeColors } from '@/contexts/ThemeContext';

interface PerformanceViewProps {
  teachers: Teacher[];
  theme?: ThemeColors;
  onScheduleReview?: (teacherId: string) => void;
}

export function PerformanceView({ teachers, theme, onScheduleReview }: PerformanceViewProps) {
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const handleScheduleReview = (teacherId: string) => {
    if (onScheduleReview) {
      onScheduleReview(teacherId);
    } else {
      Alert.alert(
        '📅 Performance Review',
        'Would you like to schedule a performance review?\n\n• Review preparation checklist\n• Self-assessment forms\n• Goals alignment',
        [
          { text: 'Schedule Now', style: 'default', onPress: () => Alert.alert('Scheduled', 'Review meeting scheduled successfully!') },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  const renderPerformanceCard = ({ item }: { item: Teacher }) => (
    <View style={styles.performanceCard}>
      <View style={styles.performanceHeader}>
        <View style={styles.teacherDetails}>
          <Text style={styles.teacherName}>
            {item.firstName} {item.lastName}
          </Text>
          <Text style={styles.teacherRole}>{item.subjects.join(', ')}</Text>
        </View>
        <View style={styles.ratingContainer}>
          <Text style={styles.ratingScore}>{item.performance.rating}</Text>
          <Text style={styles.ratingLabel}>/5.0</Text>
        </View>
      </View>
      <View style={styles.performanceDetails}>
        <Text style={styles.lastReview}>
          📅 Last Review: {item.performance.lastReviewDate}
        </Text>
        <View style={styles.strengthsContainer}>
          <Text style={styles.strengthsLabel}>Strengths:</Text>
          <Text style={styles.strengthsText}>{item.performance.strengths.join(', ')}</Text>
        </View>
        {item.performance.improvementAreas.length > 0 && (
          <View style={styles.strengthsContainer}>
            <Text style={styles.strengthsLabel}>Areas for Improvement:</Text>
            <Text style={styles.strengthsText}>{item.performance.improvementAreas.join(', ')}</Text>
          </View>
        )}
      </View>
      <TouchableOpacity style={styles.reviewButton} onPress={() => handleScheduleReview(item.id)}>
        <Ionicons name="calendar" size={16} color="white" />
        <Text style={styles.reviewButtonText}>Schedule Review</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Performance Reviews</Text>
        <Text style={styles.sectionSubtitle}>{teachers.length} teachers enrolled</Text>
      </View>
      <FlatList
        data={teachers}
        renderItem={renderPerformanceCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="analytics-outline" size={48} color={theme?.textSecondary || '#9ca3af'} />
            <Text style={styles.emptyText}>No performance data available</Text>
          </View>
        }
      />
    </View>
  );
}

const createStyles = (theme?: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
      marginTop: 8,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme?.text || '#111827',
    },
    sectionSubtitle: {
      fontSize: 14,
      color: theme?.textSecondary || '#6b7280',
    },
    listContent: {
      paddingBottom: 16,
    },
    performanceCard: {
      backgroundColor: theme?.cardBackground || 'white',
      borderRadius: 16,
      padding: 20,
      marginBottom: 12,
      shadowColor: theme?.shadow || '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
      borderWidth: 1,
      borderColor: theme?.border || '#f3f4f6',
    },
    performanceHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    teacherDetails: {
      flex: 1,
    },
    teacherName: {
      fontSize: 16,
      fontWeight: '700',
      color: theme?.text || '#111827',
      marginBottom: 2,
    },
    teacherRole: {
      fontSize: 13,
      color: theme?.textSecondary || '#6b7280',
    },
    ratingContainer: {
      alignItems: 'center',
      backgroundColor: theme?.primary + '10' || '#f0f9ff',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
    },
    ratingScore: {
      fontSize: 20,
      fontWeight: '700',
      color: theme?.primary || '#007AFF',
    },
    ratingLabel: {
      fontSize: 12,
      color: theme?.textSecondary || '#6b7280',
      marginTop: -2,
    },
    performanceDetails: {
      marginBottom: 16,
    },
    lastReview: {
      fontSize: 14,
      color: theme?.textSecondary || '#6b7280',
      marginBottom: 12,
    },
    strengthsContainer: {
      marginTop: 8,
    },
    strengthsLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme?.text || '#333',
      marginBottom: 4,
    },
    strengthsText: {
      fontSize: 13,
      color: theme?.textSecondary || '#6b7280',
      lineHeight: 18,
    },
    reviewButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme?.primary || '#007AFF',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      alignSelf: 'flex-start',
    },
    reviewButtonText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 6,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 48,
    },
    emptyText: {
      fontSize: 14,
      color: theme?.textSecondary || '#9ca3af',
      marginTop: 12,
    },
  });

export default PerformanceView;
