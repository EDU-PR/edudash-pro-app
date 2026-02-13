/**
 * New Enhanced Teacher Dashboard - Modern UI/UX Implementation
 * 
 * Features:
 * - Clean grid-based layout with improved visual hierarchy
 * - Mobile-first responsive design with <2s load time
 * - Modern card design with subtle shadows and rounded corners
 * - Streamlined quick actions with contextual grouping
 * - Better information architecture with progressive disclosure
 * - Enhanced loading states and error handling
 * - Optimized for touch interfaces and accessibility
 */

import React, { useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  useWindowDimensions,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useTeacherDashboard } from '@/hooks/useDashboardData';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDashboardPreferences } from '@/contexts/DashboardPreferencesContext';
import { track } from '@/lib/analytics';
import { getTierColor, getTierLabel } from '@/lib/utils/tierUtils';
import { createTeacherDashboardStyles, getLayoutMetrics, type LayoutMetrics } from './teacher/teacherDashboard.styles';
import { PendingParentLinkRequests } from './PendingParentLinkRequests';
import { TeacherMetricsCard } from './teacher/TeacherMetricsCard';
import { TeacherQuickActionCard } from './teacher/TeacherQuickActionCard';
import { BirthdayDonationRegister } from './teacher/BirthdayDonationRegister';
import { useNewEnhancedTeacherState } from '@/hooks/useNewEnhancedTeacherState';
import { useTeacherStudents } from '@/hooks/useTeacherStudents';
import { CollapsibleSection, StudentSummaryCard } from '@/components/dashboard/shared';
import { router } from 'expo-router';

interface NewEnhancedTeacherDashboardProps {
  refreshTrigger?: number;
  preferences?: any;
}

export const NewEnhancedTeacherDashboard: React.FC<NewEnhancedTeacherDashboardProps> = ({ 
  refreshTrigger: _refreshTrigger, 
  preferences: _preferences 
}) => {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { preferences: dashPrefs } = useDashboardPreferences();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const layout = useMemo(() => getLayoutMetrics(width), [width]);
  
  const styles = useMemo(() => createTeacherDashboardStyles(theme, insets.top, insets.bottom, layout), [theme, insets.top, insets.bottom, layout]);
  
  // Clear any stuck dashboardSwitching flag on mount to prevent loading issues after hot reload
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).dashboardSwitching) {
      if (__DEV__) console.log('[TeacherDashboard] Clearing stuck dashboardSwitching flag');
      delete (window as any).dashboardSwitching;
    }
  }, []);
  
  // State management hook
  const state = useNewEnhancedTeacherState();
  
  const {
    data: dashboardData,
    loading,
    error,
    refresh,
    isLoadingFromCache,
  } = useTeacherDashboard();

  const organizationId = profile?.organization_id || (profile as any)?.preschool_id || null;
  const {
    students: teacherStudents,
    loading: teacherStudentsLoading,
  } = useTeacherStudents({ teacherId: user?.id || null, organizationId, limit: 4 });

  // Build metrics and actions from state
  const metrics = state.buildMetrics(dashboardData);
  const quickActions = state.buildQuickActions();

  const highlightItems = useMemo(() => {
    const classes = dashboardData?.myClasses || [];
    const totalStudents = classes.reduce((sum: number, cls: any) => sum + (cls.studentCount || 0), 0);
    const presentToday = classes.reduce((sum: number, cls: any) => sum + (cls.presentToday || 0), 0);
    const attendanceRate = totalStudents > 0 ? Math.round((presentToday / totalStudents) * 100) : 0;
    const nextClass = classes[0];

    return [
      {
        id: 'next_lesson',
        label: t('teacher.next_lesson', { defaultValue: 'Next Lesson' }),
        value: nextClass?.name || t('teacher.no_class', { defaultValue: 'No class yet' }),
        sub: nextClass?.nextLesson || t('teacher.no_upcoming_lessons', { defaultValue: 'No upcoming lesson' }),
        icon: 'time-outline' as const,
        color: theme.primary,
      },
      {
        id: 'attendance',
        label: t('teacher.attendance_today', { defaultValue: 'Attendance' }),
        value: `${attendanceRate}%`,
        sub: totalStudents > 0 ? `${presentToday}/${totalStudents} ${t('teacher.present', { defaultValue: 'present' })}` : t('teacher.no_students', { defaultValue: 'No students yet' }),
        icon: 'checkmark-circle-outline' as const,
        color: theme.success,
      },
      {
        id: 'pending_grading',
        label: t('teacher.pending_grading', { defaultValue: 'Pending Grading' }),
        value: String(dashboardData?.pendingGrading ?? 0),
        sub: t('teacher.needs_review', { defaultValue: 'Needs review' }),
        icon: 'document-text-outline' as const,
        color: theme.warning,
      },
    ];
  }, [dashboardData, t, theme]);

  const groupedActions = useMemo(() => {
    const groups: Record<string, any[]> = {};
    quickActions.forEach((action: any) => {
      if (!action) return;
      const category = action.category || 'other';
      if (!groups[category]) groups[category] = [];
      groups[category].push(action);
    });
    return groups;
  }, [quickActions]);

  const actionSections = useMemo(() => ([
    { id: 'lessons', title: t('teacher.actions_lessons', { defaultValue: 'Lessons & Activities' }), icon: 'book-outline' },
    { id: 'classroom', title: t('teacher.actions_classroom', { defaultValue: 'Classroom' }), icon: 'school-outline' },
    { id: 'communication', title: t('teacher.actions_communication', { defaultValue: 'Communication' }), icon: 'chatbubbles-outline' },
    { id: 'reports', title: t('teacher.actions_reports', { defaultValue: 'Reports' }), icon: 'bar-chart-outline' },
    { id: 'ai', title: t('teacher.actions_ai', { defaultValue: 'AI Tools' }), icon: 'sparkles-outline' },
  ]), [t]);


  if (loading && !dashboardData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>{t('common.loading', { defaultValue: 'Loading dashboard...' })}</Text>
        {isLoadingFromCache && (
          <Text style={[styles.loadingText, { fontSize: 12, marginTop: 4 }]}>
            {t('common.loading_cached', { defaultValue: 'Loading cached data...' })}
          </Text>
        )}
      </View>
    );
  }

  if (error && !dashboardData) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={theme.error || '#DC2626'} />
        <Text style={[styles.loadingText, { color: theme.error || '#DC2626', fontWeight: '600', marginTop: 12 }]}>
          {t('common.error_title', { defaultValue: 'Something went wrong' })}
        </Text>
        <Text style={[styles.loadingText, { fontSize: 13, marginTop: 4 }]}>
          {error}
        </Text>
        <TouchableOpacity
          onPress={refresh}
          style={[styles.retryButton, { backgroundColor: theme.primary }]}
        >
          <Text style={styles.retryButtonText}>
            {t('common.retry', { defaultValue: 'Try Again' })}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={state.refreshing}
            onRefresh={() => state.handleRefresh(async () => { await Promise.resolve(refresh()); })}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Enhanced Header Card */}
        <View style={styles.headerCard}>
          <LinearGradient
            colors={[
              theme.primary + '22',
              theme.secondary + '14',
              theme.background,
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.headerContent}>
              <View style={styles.greetingRow}>
                <Text style={styles.greetingEmoji}>👋</Text>
                <View style={styles.greetingTextContainer}>
                  <Text style={styles.greeting}>{state.getGreeting()}</Text>
                  <Text style={styles.subtitle}>{state.getContextualSubtitle(dashboardData)}</Text>
                </View>
              </View>
              
              {/* School info with tier badge */}
              {dashboardData?.schoolName && (
                <View style={styles.schoolCard}>
                  <View style={styles.schoolIconContainer}>
                    <Text style={styles.schoolIcon}>🏫</Text>
                  </View>
                  <View style={styles.schoolTextContainer}>
                    <Text style={styles.schoolLabel}>{t('teacher.your_school', { defaultValue: 'Your School' })}</Text>
                    <Text style={styles.schoolName}>{dashboardData.schoolName}</Text>
                  </View>
                  {dashboardData?.schoolTier && (
                    <View style={[styles.tierBadge, { backgroundColor: getTierColor(dashboardData.schoolTier, theme) }]}>
                      <Text style={styles.tierBadgeText}>
                        {getTierLabel(dashboardData.schoolTier)}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </LinearGradient>
        </View>

        {/* Today Highlights */}
        <View style={styles.highlightsSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>
              {t('teacher.today_overview', { defaultValue: 'Today' })}
            </Text>
            <Text style={styles.sectionHeaderHint}>
              {t('teacher.today_overview_hint', { defaultValue: 'Quick status at a glance' })}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.highlightsRow}
          >
            {highlightItems.map((item) => (
              <View key={item.id} style={styles.highlightCard}>
                <View style={[styles.highlightIcon, { backgroundColor: item.color + '1A' }]}>
                  <Ionicons name={item.icon} size={18} color={item.color} />
                </View>
                <Text style={styles.highlightLabel}>{item.label}</Text>
                <Text style={styles.highlightValue}>{item.value}</Text>
                <Text style={styles.highlightSub}>{item.sub}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Metrics Grid */}
        <CollapsibleSection
          title={t('dashboard.overview')}
          sectionId="teacher-overview"
          icon="stats-chart"
          hint={t('dashboard.hints.teacher_overview', { defaultValue: 'Class metrics, alerts, and quick status checks.' })}
        >
          <View style={styles.metricsGrid}>
            {metrics.map((metric, index) => (
              <TeacherMetricsCard
                key={index}
                title={metric.title}
                value={metric.value}
                icon={metric.icon}
                color={metric.color}
                trend={metric.trend}
                onPress={() => {
                  track('teacher.dashboard.metric_clicked', { metric: metric.title });
                }}
              />
            ))}
          </View>
        </CollapsibleSection>

        {/* Quick Actions */}
        <CollapsibleSection
          title={t('dashboard.quick_actions')}
          sectionId="teacher-quick-actions"
          icon="flash"
          hint={t('dashboard.hints.teacher_quick_actions', { defaultValue: 'Create lessons, homework, messages, and tasks fast.' })}
        >
          {actionSections.map((section) => {
            const actions = groupedActions[section.id] || [];
            if (actions.length === 0) return null;
            return (
              <View key={section.id} style={styles.actionSection}>
                <View style={styles.actionSectionHeader}>
                  <View style={styles.actionSectionIcon}>
                    <Ionicons name={section.icon as any} size={14} color={theme.textSecondary} />
                  </View>
                  <Text style={styles.actionSectionTitle}>{section.title}</Text>
                </View>
                <View style={styles.actionsGrid}>
                  {actions.map((action: any) => (
                    <TeacherQuickActionCard
                      key={action.id || action.title}
                      title={action.title}
                      icon={action.icon}
                      color={action.color}
                      onPress={action.onPress}
                      disabled={action.disabled}
                      subtitle={action.disabled ? t('dashboard.upgrade_required') : undefined}
                    />
                  ))}
                </View>
              </View>
            );
          })}
        </CollapsibleSection>

        {/* Birthday Donations */}
        <CollapsibleSection
          title={t('dashboard.birthday_donations.title', { defaultValue: 'Birthday Donations' })}
          sectionId="teacher-birthday-donations"
          icon="gift"
          hint={t('dashboard.hints.teacher_birthdays', { defaultValue: 'Track donations and class birthday contributions.' })}
        >
          <BirthdayDonationRegister organizationId={organizationId} />
        </CollapsibleSection>

        {/* My Students */}
        <CollapsibleSection
          title={t('dashboard.my_students', { defaultValue: 'My Students' })}
          sectionId="teacher-students"
          icon="people"
          hint={t('dashboard.hints.teacher_students', { defaultValue: 'Quick access to student profiles and notes.' })}
        >
          {teacherStudentsLoading ? (
            <Text style={styles.loadingText}>{t('common.loading', { defaultValue: 'Loading...' })}</Text>
          ) : (
            teacherStudents.map((student) => (
              <StudentSummaryCard
                key={student.id}
                student={student}
                onPress={() => router.push(`/screens/student-detail?id=${student.id}` as any)}
                subtitle={student.className || t('common.noClass', { defaultValue: 'No class assigned' })}
              />
            ))
          )}
          {!teacherStudentsLoading && teacherStudents.length === 0 && (
            <Text style={styles.emptyText}>{t('dashboard.no_students', { defaultValue: 'No students yet.' })}</Text>
          )}
        </CollapsibleSection>

        {/* Parent Link Requests Widget */}
        <CollapsibleSection
          title={t('dashboard.parent_link_requests', { defaultValue: 'Parent Link Requests' })}
          sectionId="teacher-parent-links"
          icon="link"
          hint={t('dashboard.hints.teacher_parent_links', { defaultValue: 'Approve or review new parent-child links.' })}
          defaultCollapsed
        >
          <PendingParentLinkRequests />
        </CollapsibleSection>

      </ScrollView>
    </View>
  );
};
