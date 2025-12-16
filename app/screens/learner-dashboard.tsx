import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Stack, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { useLearnerEnrollments, useLearnerProgress, useLearnerSubmissions } from '@/hooks/useLearnerData';

export default function LearnerDashboard() {
  const { user, profile, profileLoading, loading } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  
  // Guard against React StrictMode double-invoke in development
  const navigationAttempted = useRef(false);

  // Fetch learner data
  const { data: enrollments, isLoading: enrollmentsLoading, refetch: refetchEnrollments } = useLearnerEnrollments();
  const { data: progress, isLoading: progressLoading } = useLearnerProgress();
  const { data: submissions, isLoading: submissionsLoading } = useLearnerSubmissions();

  // Handle both organization_id (new RBAC) and preschool_id (legacy) fields
  const orgId = profile?.organization_id || (profile as any)?.preschool_id;
  
  // Wait for auth and profile to finish loading before making routing decisions
  const isStillLoading = loading || profileLoading;

  // CONSOLIDATED NAVIGATION EFFECT: Single source of truth for all routing decisions
  useEffect(() => {
    // Skip if still loading data
    if (isStillLoading) return;
    
    // Guard against double navigation (React StrictMode in dev)
    if (navigationAttempted.current) return;
    
    // Decision 1: No user -> sign in
    if (!user) {
      navigationAttempted.current = true;
      try { 
        router.replace('/(auth)/sign-in'); 
      } catch (e) {
        try { router.replace('/sign-in'); } catch { /* Intentional: non-fatal */ }
      }
      return;
    }
    
    // Decision 2: User exists but no organization -> allow access with join prompt
    // Learners can access dashboard without organization and join via program codes
    // No redirect needed - dashboard will show join prompt
    
    // Decision 3: All good, stay on dashboard (no navigation needed)
  }, [isStillLoading, user, orgId, profile]);

  const handleRefresh = () => {
    refetchEnrollments();
  };

  // Show loading state while auth/profile is loading
  if (isStillLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('learner.dashboard_title', { defaultValue: 'Learner Dashboard' }) }} />
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>{t('dashboard.loading_profile', { defaultValue: 'Loading your profile...' })}</Text>
        </View>
      </View>
    );
  }

  // Show redirect message if no organization after loading is complete
  if (!orgId) {
    if (!user) {
      return (
        <View style={styles.container}>
          <Stack.Screen options={{ title: t('learner.dashboard_title', { defaultValue: 'Learner Dashboard' }) }} />
          <View style={styles.empty}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>{t('dashboard.loading_profile', { defaultValue: 'Loading your profile...' })}</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('learner.dashboard_title', { defaultValue: 'Learner Dashboard' }) }} />
        <View style={styles.empty}>
          <Text style={styles.loadingText}>{t('dashboard.no_school_found_redirect', { defaultValue: 'No organization found. Redirecting to setup...' })}</Text>
          <TouchableOpacity onPress={() => {
            try { router.replace('/screens/org-onboarding'); } catch (e) { console.debug('Redirect failed', e); }
          }}>
            <Text style={[styles.loadingText, { textDecorationLine: 'underline', marginTop: 12 }]}>{t('common.go_now', { defaultValue: 'Go Now' })}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isLoading = enrollmentsLoading || progressLoading || submissionsLoading;

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: t('learner.dashboard_title', { defaultValue: 'My Learning' }),
          headerRight: () => (
              <TouchableOpacity
                onPress={() => router.push('/screens/account')}
                style={{ marginRight: 16 }}
              >
                <Ionicons name="person-circle-outline" size={28} color={theme.text} />
              </TouchableOpacity>
          ),
        }} 
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
      >
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={styles.greeting}>
            {t('learner.welcome_back', { 
              defaultValue: 'Welcome back',
              name: profile?.first_name || 'Learner'
            })}
          </Text>
          <Text style={styles.subheading}>
            {t('learner.continue_learning', { defaultValue: 'Continue your skills development journey' })}
          </Text>
        </View>

        {/* Progress Overview */}
        {progress && (
          <Card padding={20} margin={0} elevation="medium" style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>{t('learner.progress_overview', { defaultValue: 'Progress Overview' })}</Text>
              <Ionicons name="trending-up-outline" size={24} color={theme.primary} />
            </View>
            <View style={styles.progressGrid}>
              <View style={styles.progressItem}>
                <Text style={styles.progressValue}>{progress.totalPrograms}</Text>
                <Text style={styles.progressLabel}>{t('learner.programs', { defaultValue: 'Programs' })}</Text>
              </View>
              <View style={styles.progressItem}>
                <Text style={styles.progressValue}>{progress.completedPrograms}</Text>
                <Text style={styles.progressLabel}>{t('learner.completed', { defaultValue: 'Completed' })}</Text>
              </View>
              <View style={styles.progressItem}>
                <Text style={styles.progressValue}>{progress.inProgressPrograms}</Text>
                <Text style={styles.progressLabel}>{t('learner.in_progress', { defaultValue: 'In Progress' })}</Text>
              </View>
              <View style={styles.progressItem}>
                <Text style={styles.progressValue}>{progress.avgProgress}%</Text>
                <Text style={styles.progressLabel}>{t('learner.avg_progress', { defaultValue: 'Avg Progress' })}</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('learner.quick_actions', { defaultValue: 'Quick Actions' })}</Text>
          <View style={styles.quickActionsGrid}>
            <QuickActionCard
              icon="school-outline"
              title={t('learner.my_programs', { defaultValue: 'My Programs' })}
              subtitle={t('learner.view_enrollments', { defaultValue: 'View enrollments' })}
              onPress={() => router.push('/screens/learner/programs')}
              theme={theme}
            />
            <QuickActionCard
              icon="document-text-outline"
              title={t('learner.submissions', { defaultValue: 'Submissions' })}
              subtitle={t('learner.view_assignments', { defaultValue: 'View assignments' })}
              onPress={() => router.push('/screens/learner/submissions')}
              badge={submissions?.filter(s => s.status === 'draft').length}
              theme={theme}
            />
            <QuickActionCard
              icon="people-outline"
              title={t('learner.connections', { defaultValue: 'Connections' })}
              subtitle={t('learner.network_peers', { defaultValue: 'Network with peers' })}
              onPress={() => router.push('/screens/learner/connections')}
              theme={theme}
            />
            <QuickActionCard
              icon="book-outline"
              title={t('learner.courses', { defaultValue: 'Online Courses' })}
              subtitle={t('learner.browse_courses', { defaultValue: 'Browse courses' })}
              onPress={() => router.push('/screens/learner/courses')}
              theme={theme}
            />
            <QuickActionCard
              icon="briefcase-outline"
              title={t('learner.my_cv', { defaultValue: 'My CV' })}
              subtitle={t('learner.manage_cv', { defaultValue: 'Manage CV' })}
              onPress={() => router.push('/screens/learner/cv')}
              theme={theme}
            />
            <QuickActionCard
              icon="folder-outline"
              title={t('learner.portfolio', { defaultValue: 'Portfolio' })}
              subtitle={t('learner.showcase_work', { defaultValue: 'Showcase your work' })}
              onPress={() => router.push('/screens/learner/portfolio')}
              theme={theme}
            />
          </View>
        </View>

        {/* Recent Enrollments */}
        {enrollments && enrollments.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('learner.recent_programs', { defaultValue: 'Recent Programs' })}</Text>
              <TouchableOpacity onPress={() => router.push('/screens/learner/programs')}>
                <Text style={styles.seeAll}>{t('common.see_all', { defaultValue: 'See All' })}</Text>
              </TouchableOpacity>
            </View>
            {enrollments.slice(0, 3).map((enrollment) => (
              <Card key={enrollment.id} padding={16} margin={0} elevation="small" style={styles.enrollmentCard}>
                <TouchableOpacity
                  onPress={() => router.push(`/screens/learner/program-detail?id=${enrollment.program_id}`)}
                >
                  <View style={styles.enrollmentHeader}>
                    <View style={styles.enrollmentInfo}>
                      <Text style={styles.enrollmentTitle}>{enrollment.program?.title || 'Program'}</Text>
                      <Text style={styles.enrollmentCode}>{enrollment.program?.code || ''}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(enrollment.status, theme) }]}>
                      <Text style={styles.statusText}>{enrollment.status}</Text>
                    </View>
                  </View>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressBarFill, 
                        { width: `${enrollment.progress_percentage || 0}%`, backgroundColor: theme.primary }
                      ]} 
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {enrollment.progress_percentage || 0}% {t('learner.complete', { defaultValue: 'complete' })}
                  </Text>
                </TouchableOpacity>
              </Card>
            ))}
          </View>
        )}

        {/* Loading State */}
        {isLoading && enrollments?.length === 0 && (
          <View style={styles.empty}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>{t('dashboard.loading', { defaultValue: 'Loading...' })}</Text>
          </View>
        )}

        {/* No Organization - Join Prompt */}
        {!orgId && (
          <Card padding={32} margin={0} elevation="small" style={{ marginBottom: 24 }}>
            <View style={styles.empty}>
              <Ionicons name="school-outline" size={64} color={theme.primary} />
              <Text style={styles.emptyTitle}>{t('learner.join_organization', { defaultValue: 'Join a Program' })}</Text>
              <Text style={styles.emptyDescription}>
                {t('learner.join_prompt', { defaultValue: 'Enter a program code to join an organization and start learning' })}
              </Text>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                onPress={() => router.push('/register')}
              >
                <Text style={styles.primaryButtonText}>{t('learner.join_with_code', { defaultValue: 'Join with Program Code' })}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: theme.border }]}
                onPress={() => router.push('/screens/student-join-by-code')}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                  {t('learner.join_with_invite', { defaultValue: 'Join with Invitation Code' })}
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Empty State - Has Org but No Enrollments */}
        {!isLoading && orgId && (!enrollments || enrollments.length === 0) && (
          <Card padding={32} margin={0} elevation="small">
            <View style={styles.empty}>
              <Ionicons name="school-outline" size={64} color={theme.textSecondary} />
              <Text style={styles.emptyTitle}>{t('learner.no_enrollments', { defaultValue: 'No Enrollments Yet' })}</Text>
              <Text style={styles.emptyDescription}>
                {t('learner.enroll_prompt', { defaultValue: 'Browse available programs and start your learning journey' })}
              </Text>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                onPress={() => router.push('/register')}
              >
                <Text style={styles.primaryButtonText}>{t('learner.browse_programs', { defaultValue: 'Browse Programs' })}</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

// Quick Action Card Component
function QuickActionCard({
  icon,
  title,
  subtitle,
  onPress,
  badge,
  theme,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  badge?: number;
  theme: any;
}) {
  const styles = createStyles(theme);
  
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card padding={16} margin={0} elevation="small" style={styles.quickActionCard}>
        <View style={styles.quickActionIcon}>
          <Ionicons name={icon as any} size={28} color={theme.primary} />
          {badge && badge > 0 && (
            <View style={[styles.badge, { backgroundColor: theme.error }]}>
              <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
            </View>
          )}
        </View>
        <Text style={styles.quickActionTitle}>{title}</Text>
        <Text style={styles.quickActionSubtitle}>{subtitle}</Text>
      </Card>
    </TouchableOpacity>
  );
}

function getStatusColor(status: string, theme: any): string {
  switch (status) {
    case 'completed':
      return theme.success || '#10B981';
    case 'enrolled':
      return theme.primary;
    case 'withdrawn':
      return theme.textSecondary;
    default:
      return theme.border;
  }
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: theme?.background || '#0b1220' 
  },
  content: { 
    padding: 16,
    paddingBottom: 32,
  },
  empty: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: { 
    color: theme?.textSecondary || '#9CA3AF', 
    fontSize: 16,
    marginTop: 12,
  },
  welcomeSection: {
    marginBottom: 24,
  },
  greeting: {
    color: theme?.text || '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 6,
  },
  subheading: {
    color: theme?.textSecondary || '#9CA3AF',
    fontSize: 16,
  },
  progressCard: {
    marginBottom: 24,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  progressTitle: {
    color: theme?.text || '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  progressGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  progressItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme?.surface || theme?.card,
    borderRadius: 12,
  },
  progressValue: {
    color: theme?.text || '#fff',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 4,
  },
  progressLabel: {
    color: theme?.textSecondary || '#9CA3AF',
    fontSize: 14,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: theme?.text || '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  seeAll: {
    color: theme?.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionCard: {
    width: '47%',
    alignItems: 'center',
    minHeight: 120,
  },
  quickActionIcon: {
    marginBottom: 12,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  quickActionTitle: {
    color: theme?.text || '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  quickActionSubtitle: {
    color: theme?.textSecondary || '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
  },
  enrollmentCard: {
    marginBottom: 12,
  },
  enrollmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  enrollmentInfo: {
    flex: 1,
  },
  enrollmentTitle: {
    color: theme?.text || '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  enrollmentCode: {
    color: theme?.textSecondary || '#9CA3AF',
    fontSize: 13,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  progressBar: {
    height: 8,
    backgroundColor: theme?.border || '#374151',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    color: theme?.textSecondary || '#9CA3AF',
    fontSize: 12,
  },
  emptyTitle: {
    color: theme?.text || '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    color: theme?.textSecondary || '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  primaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
