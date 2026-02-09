/**
 * New Enhanced Principal Dashboard - Refactored
 * @deprecated Legacy principal dashboard implementation retained for compatibility.
 * Active #NEXT-GEN path is `PrincipalDashboardV2` via `PrincipalDashboardWrapper`.
 * 
 * A modular, clean implementation following WARP.md file size standards.
 * Uses extracted components for better maintainability.
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

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useTranslation } from 'react-i18next';
import { usePrincipalHub } from '@/hooks/usePrincipalHub';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import Feedback from '@/lib/feedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TierBadge from '@/components/ui/TierBadge';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { PendingParentLinkRequests } from './PendingParentLinkRequests';
import { UpcomingBirthdaysCard } from './UpcomingBirthdaysCard';
import { useBirthdayPlanner } from '@/hooks/useBirthdayPlanner';
import { getApprovalStats } from '@/lib/services/teacherApprovalService';

// Import modular components
import { 
  PrincipalWelcomeSection,
  PrincipalMetricsSection,
  PrincipalQuickActions,
  PrincipalDoNowInbox,
  PrincipalRecentActivity,
  PrincipalSchoolPulse,
  PrincipalGettingStartedCard
} from './principal';
import { CollapsibleSection, SearchBar, type SearchBarSuggestion } from './shared';

const { width } = Dimensions.get('window');
const isTablet = width > 768;
const isSmallScreen = width < 380;
const cardPadding = isTablet ? 20 : isSmallScreen ? 10 : 14;
const cardGap = isTablet ? 12 : isSmallScreen ? 6 : 8;

interface NewEnhancedPrincipalDashboardProps {
  refreshTrigger?: number;
}

export const NewEnhancedPrincipalDashboard: React.FC<NewEnhancedPrincipalDashboardProps> = ({ 
  refreshTrigger 
}) => {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { tier, ready: subscriptionReady } = useSubscription();
  const [refreshing, setRefreshing] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingTeacherApprovals, setPendingTeacherApprovals] = useState(0);
  const insets = useSafeAreaInsets();
  
  const styles = useMemo(() => createStyles(theme, insets.top, insets.bottom), [theme, insets.top, insets.bottom]);
  
  // Get organization ID for birthday planner
  const organizationId = profile?.organization_id || profile?.preschool_id;

  // Fetch pending teacher approvals count
  useEffect(() => {
    if (!organizationId) return;
    getApprovalStats(organizationId).then(s => setPendingTeacherApprovals(s.pending)).catch(() => {});
  }, [organizationId, refreshing]);
  
  // Birthday planner hook
  const {
    birthdays,
    loading: birthdaysLoading,
    refresh: refreshBirthdays,
  } = useBirthdayPlanner({
    preschoolId: organizationId,
    daysAhead: 60, // Show birthdays for next 2 months
  });
  
  // Clear any stuck dashboardSwitching flag on mount to prevent loading/navigation issues
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).dashboardSwitching) {
      console.log('[PrincipalDashboard] Clearing stuck dashboardSwitching flag');
      delete (window as any).dashboardSwitching;
    }
  }, []);
  
  const {
    data,
    loading,
    error,
    refresh,
    isEmpty
  } = usePrincipalHub();

  const allSectionIds = useMemo(() => [
    'do-now', 'quick-actions', 'parent-requests', 'birthdays',
    'recent-activity', 'metrics', 'search', 'tips',
  ], []);

  const toggleSection = useCallback((sectionId: string, isCollapsed?: boolean) => {
    setCollapsedSections(prev => {
      const shouldCollapse = typeof isCollapsed === 'boolean' ? isCollapsed : !prev.has(sectionId);
      if (shouldCollapse) {
        // Collapsing — just add it
        const next = new Set(prev);
        next.add(sectionId);
        return next;
      }
      // Expanding — collapse all others (accordion)
      const next = new Set(allSectionIds);
      next.delete(sectionId);
      return next;
    });
  }, [allSectionIds]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
      await refreshBirthdays();
      await Feedback.vibrate(10);
    } catch (_error) {
      console.error('Refresh error:', _error);
    } finally {
      setRefreshing(false);
    }
  };

  // Search suggestions for PWA-style search
  const searchSuggestions: SearchBarSuggestion[] = useMemo(() => [
    { id: 'registrations', label: t('quick_actions.registrations', { defaultValue: 'Registrations' }), icon: 'person-add' },
    { id: 'teachers', label: t('quick_actions.manage_teachers', { defaultValue: 'Manage Teachers' }), icon: 'people' },
    { id: 'students', label: t('dashboard.student_management', { defaultValue: 'Student Management' }), icon: 'school' },
    { id: 'finances', label: t('quick_actions.view_finances', { defaultValue: 'View Finances' }), icon: 'analytics' },
    { id: 'reports', label: t('dashboard.view_reports', { defaultValue: 'View Reports' }), icon: 'bar-chart' },
    { id: 'calendar', label: t('dashboard.calendar', { defaultValue: 'Calendar' }), icon: 'calendar' },
  ], [t]);

  const handleSearchNavigation = (actionId: string) => {
    switch (actionId) {
      case 'registrations':
        router.push('/screens/principal-registrations');
        break;
      case 'teachers':
        router.push('/screens/teacher-management');
        break;
      case 'students':
        router.push('/screens/student-management');
        break;
      case 'finances':
        router.push('/screens/finance-control-center?tab=overview');
        break;
      case 'reports':
        router.push('/screens/teacher-reports');
        break;
      case 'calendar':
        router.push('/screens/calendar');
        break;
    }
  };

  if (loading && isEmpty) {
    return <LoadingScreen message="Loading your dashboard..." />;
  }

  if (error && isEmpty) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning-outline" size={64} color={theme.error} />
        <Text style={styles.errorTitle}>{t('dashboard.load_error')}</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={[styles.scrollContainer, Platform.OS === 'web' && styles.scrollContainerWeb]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* 1. Welcome Section - Always first */}
        <View style={[styles.section, styles.firstSection, Platform.OS === 'web' && styles.firstSectionWeb]}>
          <PrincipalWelcomeSection
            userName={user?.user_metadata?.first_name}
            schoolName={data.schoolName}
            tier={tier}
            subscriptionReady={subscriptionReady}
            pendingRegistrations={data.stats?.pendingRegistrations?.total ?? 0}
            pendingPayments={data.stats?.pendingPayments?.total ?? 0}
            pendingPOPUploads={data.stats?.pendingPOPUploads?.total ?? 0}
          />
        </View>

        {/* 1b. School Pulse + Guided Setup */}
        <View style={styles.section}>
          <PrincipalSchoolPulse stats={data.stats} />
          <PrincipalGettingStartedCard stats={data.stats} />
        </View>

        {/* 2. Do Now Inbox - Prioritized tasks for non-technical principals */}
        <View style={styles.section}>
          <CollapsibleSection 
            title={t('dashboard.do_now.title', { defaultValue: 'Do Now' })} 
            sectionId="do-now" 
            icon="⚡"
            hint={t('dashboard.do_now.subtitle', { defaultValue: 'Your next actions for today' })}
            defaultCollapsed={collapsedSections.has('do-now')}
            onToggle={toggleSection}
          >
            <PrincipalDoNowInbox
              counts={{
                pendingRegistrations: data.stats?.pendingRegistrations?.total ?? 0,
                pendingPaymentProofs: data.stats?.pendingPOPUploads?.total ?? 0,
                pendingUnpaidFees: data.stats?.pendingPayments?.total ?? 0,
                pendingApprovals:
                  (data.pendingReportApprovals ?? 0) +
                  (data.pendingActivityApprovals ?? 0) +
                  (data.pendingHomeworkApprovals ?? 0),
              }}
            />
          </CollapsibleSection>
        </View>

        {/* 2. Quick Actions - Urgent tasks requiring attention */}
        <View style={styles.section}>
          <PrincipalQuickActions
            stats={data.stats}
            pendingRegistrationsCount={data.stats?.pendingRegistrations?.total ?? 0}
            pendingPaymentsCount={data.stats?.pendingPayments?.total ?? 0}
            pendingPOPUploadsCount={data.stats?.pendingPOPUploads?.total ?? 0}
            pendingTeacherApprovalsCount={pendingTeacherApprovals}
            collapsedSections={collapsedSections}
            onToggleSection={toggleSection}
          />
        </View>

        {/* 3. Parent Link Requests - Pending approvals need attention */}
        <View style={styles.section}>
          <CollapsibleSection 
            title={t('dashboard.parent_requests', { defaultValue: 'Parent Requests' })} 
            sectionId="parent-requests" 
            icon="👨‍👩‍👧"
            hint={t('dashboard.hints.parent_requests', { defaultValue: 'Approve parent links and registration requests.' })}
            defaultCollapsed={collapsedSections.has('parent-requests')}
            onToggle={toggleSection}
          >
            <PendingParentLinkRequests />
          </CollapsibleSection>
        </View>

        {/* 4. Upcoming Birthdays - Time-sensitive celebrations */}
        <View style={styles.section}>
          <CollapsibleSection 
            title={birthdays?.today?.length 
              ? t('dashboard.upcoming_birthdays_with_count', { defaultValue: 'Upcoming Birthdays ({{count}} today!)', count: birthdays.today.length })
              : t('dashboard.upcoming_birthdays', { defaultValue: 'Upcoming Birthdays' })} 
            sectionId="birthdays" 
            icon="🎂"
            hint={t('dashboard.hints.birthdays', { defaultValue: 'See birthdays coming up in each class.' })}
            defaultCollapsed={collapsedSections.has('birthdays')}
            onToggle={toggleSection}
            actionLabel={t('dashboard.view_chart', { defaultValue: 'View Chart' })}
            onActionPress={() => router.push('/screens/birthday-chart')}
          >
            <UpcomingBirthdaysCard
              birthdays={birthdays}
              loading={birthdaysLoading}
              showHeader={false}
              maxItems={5}
              compact
              onViewAll={() => router.push('/screens/birthday-chart')}
            />
          </CollapsibleSection>
        </View>

        {/* 5. Recent Activity - What just happened */}
        <View style={styles.section}>
          <PrincipalRecentActivity
            stats={data.stats}
            collapsedSections={collapsedSections}
            onToggleSection={toggleSection}
          />
        </View>

        {/* 6. Metrics/Stats Overview - Summary data */}
        <View style={styles.section}>
          <PrincipalMetricsSection
            stats={data.stats}
            studentsCount={data.stats?.students?.total ?? 0}
            classesCount={data.stats?.classes?.total ?? 0}
            collapsedSections={collapsedSections}
            onToggleSection={toggleSection}
          />
        </View>

        {/* 7. Search Bar - Utility for navigation */}
        <View style={styles.section}>
          <CollapsibleSection 
            title={t('common.search', { defaultValue: 'Search Dashboard' })} 
            sectionId="search" 
            icon="🔍"
            hint={t('dashboard.hints.search', { defaultValue: 'Jump to any module, report, or student.' })}
            defaultCollapsed={collapsedSections.has('search')}
            onToggle={toggleSection}
          >
            <SearchBar
              placeholder={t('common.search_placeholder', { defaultValue: 'Search for anything...' })}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmit={(query) => {
                const match = searchSuggestions.find(s => 
                  s.label.toLowerCase().includes(query.toLowerCase())
                );
                if (match) handleSearchNavigation(match.id);
              }}
              suggestions={searchSuggestions}
              onSuggestionPress={(suggestion) => handleSearchNavigation(suggestion.id)}
            />
          </CollapsibleSection>
        </View>

        {/* 8. Quick Tips Section - Help principals get started */}
        <View style={styles.section}>
          <CollapsibleSection 
            title={t('dashboard.quick_tips', { defaultValue: 'Quick Tips' })} 
            sectionId="tips" 
            icon="💡"
            hint={t('dashboard.hints.tips', { defaultValue: 'Short tips to keep your school running smoothly.' })}
            defaultCollapsed={collapsedSections.has('tips')}
            onToggle={toggleSection}
          >
            <View style={styles.tipsContainer}>
              <View style={styles.tipCard}>
                <Text style={styles.tipIcon}>📱</Text>
                <View style={styles.tipContent}>
                  <Text style={styles.tipTitle}>{t('dashboard.tip_invite_parents', { defaultValue: 'Invite Parents' })}</Text>
                  <Text style={styles.tipText}>
                    {t('dashboard.tip_invite_parents_desc', { defaultValue: 'Share your school code with parents so they can register their children.' })}
                  </Text>
                </View>
              </View>
              <View style={styles.tipCard}>
                <Text style={styles.tipIcon}>📊</Text>
                <View style={styles.tipContent}>
                  <Text style={styles.tipTitle}>{t('dashboard.tip_track_attendance', { defaultValue: 'Track Attendance' })}</Text>
                  <Text style={styles.tipText}>
                    {t('dashboard.tip_track_attendance_desc', { defaultValue: 'Teachers can mark daily attendance. You can view reports anytime.' })}
                  </Text>
                </View>
              </View>
            </View>
          </CollapsibleSection>
        </View>
      </ScrollView>
    </View>
  );
};

const createStyles = (theme: any, insetTop = 0, insetBottom = 0) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollContainer: {
      flex: 1,
    },
    scrollContainerWeb: {
      marginTop: 0,
    },
    scrollContent: {
      paddingTop: isSmallScreen ? 8 : 12,
      paddingBottom: insetBottom + (isSmallScreen ? 56 : 72),
    },
    section: {
      paddingHorizontal: cardPadding,
      paddingVertical: isSmallScreen ? 6 : 8,
    },
    firstSection: {
      paddingTop: 0,
    },
    firstSectionWeb: {
      paddingTop: 0,
    },
    // Tips section styles
    tipsContainer: {
      gap: isSmallScreen ? 10 : 12,
    },
    tipCard: {
      flexDirection: 'row',
      backgroundColor: theme.cardBackground,
      borderRadius: isSmallScreen ? 12 : 14,
      padding: isSmallScreen ? 12 : 16,
      alignItems: 'flex-start',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 1,
    },
    tipIcon: {
      fontSize: isSmallScreen ? 24 : 28,
      marginRight: isSmallScreen ? 10 : 12,
    },
    tipContent: {
      flex: 1,
    },
    tipTitle: {
      fontSize: isSmallScreen ? 14 : 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 4,
    },
    tipText: {
      fontSize: isSmallScreen ? 12 : 13,
      color: theme.textSecondary,
      lineHeight: isSmallScreen ? 16 : 18,
    },
    // Error styles
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
      backgroundColor: theme.background,
    },
    errorTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.text,
      marginTop: 16,
      marginBottom: 8,
      textAlign: 'center',
    },
    errorText: {
      fontSize: 16,
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 22,
    },
    retryButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
    },
    retryButtonText: {
      color: theme.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
  });
};

export default NewEnhancedPrincipalDashboard;
