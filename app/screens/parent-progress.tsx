/**
 * Parent Progress Dashboard Screen
 * 
 * Comprehensive view of children's learning progress.
 * Shows lesson completion, activity progress, and trends.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useParentProgress, useLessonProgress } from '@/hooks/useLessonProgress';
import { LinearGradient } from 'expo-linear-gradient';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { createProgressStyles, getProgressColor, getStatusColor } from '@/lib/screen-styles/parent-progress.styles';
import { clampPercent } from '@/lib/progress/clampPercent';

export default function ParentProgressScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => createProgressStyles(theme), [theme]);
  const isNextGenParentTheme = String(theme.background).toLowerCase() === '#0f121e';
  const headerGradientColors: [string, string] = isNextGenParentTheme
    ? ['#23214D', '#5A409D']
    : ['#10B981', '#059669'];
  
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
      <SafeAreaView style={[styles.container, styles.centered]} edges={['bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <EduDashSpinner size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading progress...</Text>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <LinearGradient
        colors={headerGradientColors}
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
                <View style={styles.headerBadgeRow}>
                  {selectedChild.grade && (
                    <View style={styles.gradeBadge}>
                      <Text style={styles.gradeBadgeText}>Grade {selectedChild.grade}</Text>
                    </View>
                  )}
                  {!!selectedProgress?.streak && selectedProgress.streak > 0 && (
                    <View style={styles.streakBadge}>
                      <Ionicons name="flame" size={12} color="#F97316" />
                      <Text style={styles.streakBadgeText}>{selectedProgress.streak} day streak</Text>
                    </View>
                  )}
                </View>
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

              {selectedProgress?.averageStars !== null && (
                <View style={styles.starsSummaryRow}>
                  <Ionicons name="star" size={16} color="#F59E0B" />
                  <Text style={styles.starsSummaryText}>
                    Average activity stars: {selectedProgress.averageStars}/3
                  </Text>
                </View>
              )}
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
                <EduDashSpinner size="small" color={theme.primary} style={{ marginVertical: 20 }} />
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

                {selectedProgress?.domainBreakdown?.length > 0 && (
                  <View style={styles.topSubjectsContainer}>
                    <Text style={styles.topSubjectsTitle}>Domain Progress</Text>
                    <View style={styles.domainBreakdownContainer}>
                      {selectedProgress.domainBreakdown.slice(0, 4).filter(Boolean).map((domain) => (
                        <View key={domain?.domain ?? 'unknown'} style={styles.domainItem}>
                          <View style={styles.domainLabelRow}>
                            <Text style={styles.domainLabel}>
                              {(domain?.domain ?? '').replace(/_/g, ' ')}
                            </Text>
                            <Text style={styles.domainMeta}>
                              {domain?.count ?? 0} done
                              {domain?.averageStars != null ? ` • ${domain.averageStars}/3★` : ''}
                            </Text>
                          </View>
                          <View style={styles.domainBarTrack}>
                            <View
                              style={[
                                styles.domainBarFill,
                                { width: `${clampPercent((domain?.count ?? 0) * 20)}%` },
                              ]}
                            />
                          </View>
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
    </SafeAreaView>
  );
}
