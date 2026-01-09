/**
 * Parent Progress Dashboard Screen
 * 
 * Comprehensive view of children's learning progress.
 * Shows lesson completion, activity progress, and trends.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useParentProgress, useLessonProgress } from '@/hooks/useLessonProgress';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function ParentProgressScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Fetch all children's progress summary
  const {
    childrenProgress,
    isLoading: isLoadingChildren,
    refetch: refetchChildren,
  } = useParentProgress(user?.id);
  
  // Fetch detailed progress for selected child
  const {
    progress: selectedProgress,
    progressDetails,
    summary,
    isLoading: isLoadingDetails,
    refetch: refetchDetails,
  } = useLessonProgress({
    studentId: selectedChildId || undefined,
  });
  
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([refetchChildren(), refetchDetails()]).finally(() => {
      setRefreshing(false);
    });
  }, [refetchChildren, refetchDetails]);
  
  // Auto-select first child if none selected
  React.useEffect(() => {
    if (!selectedChildId && childrenProgress.length > 0) {
      setSelectedChildId(childrenProgress[0].studentId);
    }
  }, [childrenProgress, selectedChildId]);
  
  const selectedChild = childrenProgress.find(c => c.studentId === selectedChildId);
  
  if (isLoadingChildren && !childrenProgress.length) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading progress...</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <LinearGradient
        colors={['#10B981', '#059669']}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Learning Progress</Text>
            <Text style={styles.headerSubtitle}>Track your children's achievements</Text>
          </View>
        </View>
      </LinearGradient>
      
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Child Selector */}
        {childrenProgress.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.childSelector}
            contentContainerStyle={styles.childSelectorContent}
          >
            {childrenProgress.map(child => (
              <TouchableOpacity
                key={child.studentId}
                style={[
                  styles.childTab,
                  selectedChildId === child.studentId && styles.childTabActive
                ]}
                onPress={() => setSelectedChildId(child.studentId)}
              >
                <View style={[
                  styles.childAvatar,
                  selectedChildId === child.studentId && styles.childAvatarActive
                ]}>
                  <Text style={styles.childAvatarText}>
                    {child.studentName.split(' ').map(n => n[0]).join('')}
                  </Text>
                </View>
                <Text style={[
                  styles.childName,
                  selectedChildId === child.studentId && styles.childNameActive
                ]}>
                  {child.studentName.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        
        {/* No Children State */}
        {childrenProgress.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="school-outline" size={64} color={theme.textSecondary} />
            <Text style={styles.emptyTitle}>No Children Enrolled</Text>
            <Text style={styles.emptyText}>
              Your children's progress will appear here once they are enrolled.
            </Text>
          </View>
        )}
        
        {selectedChild && (
          <>
            {/* Progress Overview */}
            <View style={styles.overviewCard}>
              <View style={styles.overviewHeader}>
                <Text style={styles.overviewTitle}>{selectedChild.studentName}</Text>
                {selectedChild.grade && (
                  <View style={styles.gradeBadge}>
                    <Text style={styles.gradeBadgeText}>Grade {selectedChild.grade}</Text>
                  </View>
                )}
              </View>
              
              {/* Completion Ring */}
              <View style={styles.ringContainer}>
                <View style={styles.progressRing}>
                  <View style={[
                    styles.progressRingFill,
                    { 
                      height: `${selectedChild.completionRate}%`,
                      backgroundColor: getProgressColor(selectedChild.completionRate)
                    }
                  ]} />
                  <View style={styles.progressRingInner}>
                    <Text style={styles.progressPercentage}>
                      {selectedChild.completionRate}%
                    </Text>
                    <Text style={styles.progressLabel}>Complete</Text>
                  </View>
                </View>
              </View>
              
              {/* Stats Grid */}
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <View style={[styles.statIcon, { backgroundColor: '#3B82F620' }]}>
                    <Ionicons name="book" size={20} color="#3B82F6" />
                  </View>
                  <Text style={styles.statValue}>{selectedChild.totalAssignments}</Text>
                  <Text style={styles.statLabel}>Lessons</Text>
                </View>
                
                <View style={styles.statItem}>
                  <View style={[styles.statIcon, { backgroundColor: '#10B98120' }]}>
                    <Ionicons name="checkmark-done" size={20} color="#10B981" />
                  </View>
                  <Text style={styles.statValue}>{selectedChild.completedAssignments}</Text>
                  <Text style={styles.statLabel}>Completed</Text>
                </View>
                
                <View style={styles.statItem}>
                  <View style={[styles.statIcon, { backgroundColor: '#F59E0B20' }]}>
                    <Ionicons name="star" size={20} color="#F59E0B" />
                  </View>
                  <Text style={styles.statValue}>
                    {selectedChild.averageScore !== null ? `${selectedChild.averageScore}%` : '-'}
                  </Text>
                  <Text style={styles.statLabel}>Avg Score</Text>
                </View>
                
                <View style={styles.statItem}>
                  <View style={[styles.statIcon, { backgroundColor: '#EF444420' }]}>
                    <Ionicons name="alert-circle" size={20} color="#EF4444" />
                  </View>
                  <Text style={styles.statValue}>{selectedChild.overdueCount}</Text>
                  <Text style={styles.statLabel}>Overdue</Text>
                </View>
              </View>
            </View>
            
            {/* Recent Lessons */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Lessons</Text>
                <TouchableOpacity>
                  <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
              </View>
              
              {isLoadingDetails ? (
                <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 20 }} />
              ) : progressDetails.length === 0 ? (
                <View style={styles.emptySection}>
                  <Ionicons name="book-outline" size={32} color={theme.textSecondary} />
                  <Text style={styles.emptySectionText}>No lessons assigned yet</Text>
                </View>
              ) : (
                progressDetails.slice(0, 5).map((lesson, index) => (
                  <View key={lesson.assignmentId} style={[
                    styles.lessonItem,
                    index !== 0 && styles.lessonItemBorder
                  ]}>
                    <View style={[
                      styles.lessonStatus,
                      { backgroundColor: getStatusColor(lesson.status) }
                    ]} />
                    <View style={styles.lessonContent}>
                      <Text style={styles.lessonTitle}>{lesson.lessonTitle}</Text>
                      <Text style={styles.lessonMeta}>
                        {lesson.lessonSubject} • {
                          lesson.completedAt 
                            ? `Completed ${new Date(lesson.completedAt).toLocaleDateString()}`
                            : lesson.dueDate 
                              ? `Due ${new Date(lesson.dueDate).toLocaleDateString()}`
                              : 'No due date'
                        }
                      </Text>
                    </View>
                    {lesson.score !== null && (
                      <View style={styles.scoreContainer}>
                        <Text style={styles.scoreValue}>{lesson.score}%</Text>
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>
            
            {/* Weekly Summary */}
            {summary && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>This Month's Summary</Text>
                
                <View style={styles.summaryStats}>
                  <View style={styles.summaryRow}>
                    <View style={styles.summaryItem}>
                      <Ionicons name="time-outline" size={20} color={theme.primary} />
                      <Text style={styles.summaryValue}>
                        {Math.round(summary.totalTimeSpent / 60)}h {summary.totalTimeSpent % 60}m
                      </Text>
                      <Text style={styles.summaryLabel}>Time Spent</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Ionicons name="trophy-outline" size={20} color="#F59E0B" />
                      <Text style={styles.summaryValue}>{summary.completedLessons}</Text>
                      <Text style={styles.summaryLabel}>Completed</Text>
                    </View>
                  </View>
                </View>
                
                {/* Top Subjects */}
                {summary.topSubjects.length > 0 && (
                  <View style={styles.topSubjectsContainer}>
                    <Text style={styles.topSubjectsTitle}>Top Subjects</Text>
                    <View style={styles.topSubjectsList}>
                      {summary.topSubjects.map((subject, index) => (
                        <View key={subject.subject} style={styles.subjectBadge}>
                          <Text style={styles.subjectBadgeText}>
                            {subject.subject.charAt(0).toUpperCase() + subject.subject.slice(1)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                
                {/* Improvements & Areas to Work */}
                {summary.improvements.length > 0 && (
                  <View style={styles.feedbackContainer}>
                    {summary.improvements.map((item, index) => (
                      <View key={index} style={styles.feedbackItem}>
                        <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                        <Text style={styles.feedbackText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                )}
                
                {summary.areasToWork.length > 0 && (
                  <View style={styles.feedbackContainer}>
                    {summary.areasToWork.map((item, index) => (
                      <View key={index} style={styles.feedbackItem}>
                        <Ionicons name="alert-circle" size={16} color="#F59E0B" />
                        <Text style={styles.feedbackText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
            
            {/* Quick Actions */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push('/screens/parent-messages')}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#3B82F620' }]}>
                  <Ionicons name="chatbubble" size={24} color="#3B82F6" />
                </View>
                <Text style={styles.actionText}>Message Teacher</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push('/screens/parent-weekly-report')}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#8B5CF620' }]}>
                  <Ionicons name="document-text" size={24} color="#8B5CF6" />
                </View>
                <Text style={styles.actionText}>Weekly Report</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function getProgressColor(percentage: number): string {
  if (percentage >= 80) return '#10B981';
  if (percentage >= 60) return '#F59E0B';
  if (percentage >= 40) return '#3B82F6';
  return '#EF4444';
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed': return '#10B981';
    case 'in_progress': return '#3B82F6';
    case 'overdue': return '#EF4444';
    default: return '#6B7280';
  }
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: theme.textSecondary,
    fontSize: 16,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  childSelector: {
    marginBottom: 16,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  childSelectorContent: {
    gap: 12,
  },
  childTab: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: theme.card,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  childTabActive: {
    borderColor: '#10B981',
    backgroundColor: '#10B98110',
  },
  childAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10B98120',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  childAvatarActive: {
    backgroundColor: '#10B981',
  },
  childAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
  childName: {
    fontSize: 13,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  childNameActive: {
    color: '#10B981',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.text,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  overviewCard: {
    backgroundColor: theme.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  overviewTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
  },
  gradeBadge: {
    backgroundColor: '#10B98120',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  gradeBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  ringContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  progressRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: theme.border,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  progressRingFill: {
    width: '100%',
    position: 'absolute',
    bottom: 0,
    borderRadius: 70,
  },
  progressRingInner: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: 60,
    backgroundColor: theme.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressPercentage: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.text,
  },
  progressLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
  },
  statLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
  },
  viewAllText: {
    fontSize: 14,
    color: theme.primary,
    fontWeight: '500',
  },
  emptySection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptySectionText: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 8,
  },
  lessonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  lessonItemBorder: {
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  lessonStatus: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  lessonContent: {
    flex: 1,
  },
  lessonTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.text,
  },
  lessonMeta: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  scoreContainer: {
    backgroundColor: '#10B98120',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  scoreValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  summaryStats: {
    marginVertical: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
    marginTop: 6,
  },
  summaryLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  topSubjectsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  topSubjectsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 8,
  },
  topSubjectsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subjectBadge: {
    backgroundColor: '#8B5CF620',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  subjectBadgeText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8B5CF6',
  },
  feedbackContainer: {
    marginTop: 12,
    gap: 8,
  },
  feedbackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  feedbackText: {
    fontSize: 14,
    color: theme.text,
    flex: 1,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.text,
  },
});
