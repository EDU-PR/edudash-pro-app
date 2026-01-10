/**
 * Lesson Approval Queue Component
 * 
 * Displays pending lesson approvals for principals
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useLessonApproval } from '@/hooks/useLessonApproval';
import { useAuth } from '@/contexts/AuthContext';

interface LessonApprovalQueueProps {
  preschoolId: string;
  onApprove?: (approvalId: string) => void;
  onReject?: (approvalId: string, reason: string) => void;
}

export function LessonApprovalQueue({ preschoolId, onApprove, onReject }: LessonApprovalQueueProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { approvals, isLoading, approveLesson, rejectLesson, isApproving, isRejecting } = useLessonApproval(
    preschoolId,
    'pending'
  );

  const handleApprove = (approvalId: string) => {
    if (user?.id) {
      approveLesson({ approvalId, userId: user.id });
      onApprove?.(approvalId);
    }
  };

  const handleReject = (approvalId: string, reason: string) => {
    if (user?.id) {
      rejectLesson({ approvalId, userId: user.id, reason });
      onReject?.(approvalId, reason);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (approvals.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-circle-outline" size={48} color={theme.textSecondary} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No pending lesson approvals
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.text }]}>
        Pending Approvals ({approvals.length})
      </Text>
      <FlatList
        data={approvals}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.approvalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.approvalHeader}>
              <View style={styles.approvalInfo}>
                <Text style={[styles.lessonTitle, { color: theme.text }]}>
                  {item.lesson?.title || 'Untitled Lesson'}
                </Text>
                {item.lesson?.subject && (
                  <Text style={[styles.lessonSubject, { color: theme.textSecondary }]}>
                    {item.lesson.subject}
                  </Text>
                )}
              </View>
              <View style={[styles.statusBadge, { backgroundColor: '#fef3c7' }]}>
                <Text style={{ color: '#d97706', fontSize: 11, fontWeight: '600' }}>Pending</Text>
              </View>
            </View>
            {item.lesson?.description && (
              <Text style={[styles.description, { color: theme.textSecondary }]} numberOfLines={2}>
                {item.lesson.description}
              </Text>
            )}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.approveButton, { backgroundColor: '#10b981' }]}
                onPress={() => handleApprove(item.id)}
                disabled={isApproving}
              >
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={styles.buttonText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rejectButton, { backgroundColor: '#ef4444' }]}
                onPress={() => handleReject(item.id, 'Rejected by principal')}
                disabled={isRejecting}
              >
                <Ionicons name="close-circle" size={18} color="#fff" />
                <Text style={styles.buttonText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
  },
  listContent: {
    gap: 12,
  },
  approvalCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  approvalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  approvalInfo: {
    flex: 1,
  },
  lessonTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  lessonSubject: {
    fontSize: 13,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  description: {
    fontSize: 14,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    gap: 6,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    gap: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
