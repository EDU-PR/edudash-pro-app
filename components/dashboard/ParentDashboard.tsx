import React, { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, View, Text, RefreshControl, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { AdBanner } from '@/components/ui/AdBanner';
import { NativeAdCard } from '@/components/ads/NativeAdCard';
import { PLACEMENT_KEYS } from '@/lib/ads/placements';
import ErrorBanner from '@/components/ui/ErrorBanner';
import WhatsAppOptInModal from '@/components/whatsapp/WhatsAppOptInModal';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { getCurrentLanguage } from '@/lib/i18n';
import { track } from '@/lib/analytics';
import { EnhancedStatsRow } from '@/components/dashboard/EnhancedStats';
import { EnhancedQuickActions } from '@/components/dashboard/EnhancedQuickActions';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUnreadMessageCount } from '@/hooks/useParentMessaging';
import { usePOPStats } from '@/hooks/usePOPUploads';
import { PendingRegistrationRequests } from '@/components/dashboard/PendingRegistrationRequests';
import { HomeworkModal } from '@/components/dashboard/HomeworkModal';
import { useWhatsAppConnection as useRealWhatsAppConnection } from '@/hooks/useWhatsAppConnection';
import { useParentDashboardData } from '@/hooks/useParentDashboardData';
import type { ChildCardData } from '@/hooks/useParentDashboardData';

// Extracted components
import { ChildSwitcher } from '@/components/dashboard/parent/ChildSwitcher';
import { ChildCard } from '@/components/dashboard/parent/ChildCard';
import { LanguageModal } from '@/components/dashboard/parent/LanguageModal';
import { WelcomeSection } from '@/components/dashboard/parent/WelcomeSection';
import { ParentInsightsCard } from '@/components/parent/ParentInsightsCard';
import { InteractiveLessonsWidget } from '@/components/parent/InteractiveLessonsWidget';
import { PendingLinkRequests } from '@/components/dashboard/PendingLinkRequests';
import { PendingParentLinkRequests } from '@/components/dashboard/PendingParentLinkRequests';

// Phase 1: Modular components
import { CollapsibleSection } from '@/components/dashboard/parent/CollapsibleSection';
import { MetricCard } from '@/components/dashboard/parent/MetricCard';
import { DashboardSection } from '@/components/dashboard/parent/DashboardSection';
import { SearchBar } from '@/components/dashboard/parent/SearchBar';

// Shared style system
import { createDashboardStyles, SPACING, RADIUS, FONT_SIZE } from '@/lib/styles/dashboardTheme';

// AI Quota display component
import { AIQuotaOverview } from '@/components/ui/AIQuotaDisplay';

// Extracted helpers
import { 
  getMockWhatsAppConnection, 
  getAttendanceColor,
  getAttendanceIcon 
} from '@/lib/dashboard/parentDashboardHelpers';

// Proactive insights service
import { ProactiveInsightsService } from '@/services/ProactiveInsightsService';
import type { ProactiveInsight, InteractiveLesson } from '@/services/ProactiveInsightsService';

function useTier() {
  // Parent-specific tiers: free, parent-starter, parent-plus
  const [tier, setTier] = useState<'free' | 'parent-starter' | 'parent-plus'>('free');
  useEffect(() => {
    const forced = (process.env.EXPO_PUBLIC_FORCE_TIER || '').toLowerCase();
    if (['parent-starter', 'parent-plus'].includes(forced)) setTier(forced as any);
    (async () => {
      try {
        const { data } = await assertSupabase().auth.getUser();
        const roleTier = (data.user?.user_metadata as any)?.subscription_tier as string | undefined;
        if (roleTier && ['parent-starter', 'parent-plus'].includes(roleTier)) setTier(roleTier as any);
      } catch (error) {
        console.warn('Failed to get tier from user metadata:', error);
      }
    })();
  }, []);
  return tier;
}


export default function ParentDashboard() {
  const { t } = useTranslation();
  const { theme, isDark, toggleTheme } = useTheme();
  const { user, profile } = useAuth();
  const { data: unreadMessageCount = 0 } = useUnreadMessageCount();
  const [refreshing, setRefreshing] = useState(false);
  const [showHomeworkModal, setShowHomeworkModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [limits, setLimits] = useState<{ ai_help: number | 'unlimited'; ai_lessons: number | 'unlimited'; tutoring_sessions: number | 'unlimited' }>({ ai_help: 10, ai_lessons: 5, tutoring_sessions: 2 });
  const tier = useTier();
  
  // Proactive insights state
  const [insights, setInsights] = useState<ProactiveInsight[]>([]);
  const [interactiveLessons, setInteractiveLessons] = useState<InteractiveLesson[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom hook for dashboard data
  const {
    children,
    childrenCards,
    activeChildId,
    setActiveChildId,
    urgentMetrics,
    setUrgentMetrics,
    usage,
    loading,
    error,
    setError,
    loadDashboardData,
  } = useParentDashboardData();
  
  // WhatsApp integration
  const realWhatsApp = useRealWhatsAppConnection();
  const whatsApp = realWhatsApp || getMockWhatsAppConnection();

  const isAndroid = Platform.OS === 'android';
  const adsEnabled = process.env.EXPO_PUBLIC_ENABLE_ADS !== '0';
  const showBanner = isAndroid && adsEnabled && tier === 'free';
  
  // POP stats hook
  const { data: popStats } = usePOPStats(activeChildId || undefined);
  
  // Update urgent metrics with unread messages
  useEffect(() => {
    setUrgentMetrics((prev: typeof urgentMetrics) => ({ ...prev, unreadMessages: unreadMessageCount }));
  }, [unreadMessageCount, setUrgentMetrics]);
  
  // Load proactive insights when active child changes
  useEffect(() => {
    const loadInsights = async () => {
      if (!activeChildId || !profile?.preschool_id) {
        console.log('[ParentDashboard] Cannot load insights:', { activeChildId, hasPreschoolId: !!profile?.preschool_id });
        return;
      }
      
      console.log('[ParentDashboard] Loading insights for child:', activeChildId);
      setLoadingInsights(true);
      try {
        const insightsService = new ProactiveInsightsService(profile.preschool_id);
        const studentInsights = await insightsService.generateProactiveInsights(activeChildId);
        const lessons = await insightsService.getInteractiveLessons(activeChildId, 5);
        
        console.log('[ParentDashboard] Loaded insights:', studentInsights.length, 'lessons:', lessons.length);
        setInsights(studentInsights);
        setInteractiveLessons(lessons);
      } catch (error) {
        console.error('[ParentDashboard] Failed to load proactive insights:', error);
      } finally {
        setLoadingInsights(false);
      }
    };
    
    loadInsights();
  }, [activeChildId, profile?.preschool_id]);


  const onRefresh = useCallback(async () => {
    const refreshStart = Date.now();
    setRefreshing(true);
    
    try {
      await loadDashboardData();
      
      // Track successful refresh
      track('edudash.dashboard.refresh', {
        role: 'parent',
        user_id: user?.id,
        load_time_ms: Date.now() - refreshStart,
        children_count: children.length,
        ai_usage_count: usage.ai_help + usage.ai_lessons,
        platform: Platform.OS,
        tier: 'free', // This dashboard is only for free tier
      });
    } catch (error) {
      // Track failed refresh
      track('edudash.dashboard.refresh_failed', {
        role: 'parent',
        user_id: user?.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: Platform.OS,
      });
    } finally {
      setRefreshing(false);
    }
  }, [loadDashboardData, user?.id, children.length, usage.ai_help, usage.ai_lessons]);

  useEffect(() => {
    // Adjust limits by parent tier - matching parent pricing
    if (tier === 'parent-starter') {
      setLimits({ ai_help: 30, ai_lessons: 20, tutoring_sessions: 5 });
    } else if (tier === 'parent-plus') {
      setLimits({ ai_help: 100, ai_lessons: 50, tutoring_sessions: 10 });
    } else {
      // Free tier
      setLimits({ ai_help: 10, ai_lessons: 5, tutoring_sessions: 2 });
    }
  }, [tier]);






  const handleQuickAction = (action: string) => {
    track('edudash.dashboard.quick_action', {
      action,
      user_id: user?.id,
      role: 'parent',
      children_count: children.length,
      platform: Platform.OS,
      tier: 'free',
    });

    switch (action) {
case 'homework':
        track('edudash.parent.homework_help_requested', {
          subject: 'General Education',
          child_age: children.length > 0 ? 8 : 10,
          user_id: user?.id,
          children_count: children.length,
          source: 'dashboard_quick_action',
        } as any);
        setShowHomeworkModal(true);
        break;
      case 'whatsapp':
        track('edudash.whatsapp.connect_requested', {
          user_id: user?.id,
          source: 'dashboard_quick_action',
        });
        setShowWhatsAppModal(true);
        break;
      case 'language':
        track('edudash.language.selector_opened', {
          user_id: user?.id,
          current_language: getCurrentLanguage(),
          source: 'parent_dashboard',
        });
        setShowLanguageModal(true);
        break;
      case 'upgrade':
        track('edudash.billing.upgrade_viewed', {
          user_id: user?.id,
          current_tier: tier,
          target_tier: 'parent-plus', // Default parent upgrade target
        });
        // Navigate to pricing screen instead of showing placeholder alert
        router.push('/pricing');
        break;
    }
  };
  
  // Enhanced WhatsApp message handler for children
  const handleQuickMessage = async (child: any) => {
    track('child_quick_message', { 
      child_id: child.id, 
      source: 'dashboard_quick_action',
      whatsapp_connected: whatsApp.connectionStatus.isConnected 
    });
    
    // Check if WhatsApp is connected
    if (!whatsApp.connectionStatus.isConnected) {
      // Show WhatsApp opt-in modal if not connected
      setShowWhatsAppModal(true);
      return;
    }
    
    // If connected, show the WhatsApp modal with context of the child
    setShowWhatsAppModal(true);
  };

  // Function to cycle through children when tapping header subtitle
  const cycleToNextChild = () => {
    if (children.length <= 1) return;
    
    const currentIndex: number = children.findIndex((child: typeof children[0]) => child.id === activeChildId);
    const nextIndex = (currentIndex + 1) % children.length;
    const nextChild = children[nextIndex];
    
    if (nextChild) {
      setActiveChildId(nextChild.id);
      track('edudash.dashboard.child_cycled', {
        user_id: user?.id,
        from_child_id: activeChildId,
        to_child_id: nextChild.id,
        total_children: children.length,
        source: 'header_tap'
      });
    }
  };
  
  // Use shared dashboard styles (most styles moved to dashboardTheme)
  const dashStyles = createDashboardStyles(theme);
  
  // All inline styles
  const styles = React.useMemo(() => StyleSheet.create({
    container: dashStyles.container,
    loadingContainer: dashStyles.loadingContainer,
    loadingText: dashStyles.loadingText,
    section: dashStyles.section,
    sectionTitle: dashStyles.sectionTitle,
    sectionHeader: dashStyles.sectionHeader,
    emptyState: { padding: 24, alignItems: 'center' },
    emptyStateTitle: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: theme.text, marginTop: 16 },
    emptyStateSubtitle: { fontSize: FONT_SIZE.sm, color: theme.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
    emptyStateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 24, borderRadius: RADIUS.lg, marginTop: 16, minWidth: 200 },
    emptyStateButtonText: { fontSize: FONT_SIZE.md, fontWeight: '600' },
    emptyCard: { padding: 20, alignItems: 'center' },
    emptyTitle: { fontSize: FONT_SIZE.md, fontWeight: '600', color: theme.text },
    emptySubtitle: { fontSize: FONT_SIZE.sm, color: theme.textSecondary, marginTop: 4 },
    metricsGrid: { gap: 12 },
    metricsRow: { flexDirection: 'row', gap: 12 },
    popActionsGrid: { gap: 12 },
    popActionCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: RADIUS.lg, borderWidth: 1 },
    popActionIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    popActionContent: { flex: 1 },
    popActionTitle: { fontSize: FONT_SIZE.md, fontWeight: '600', color: theme.text },
    popActionSubtitle: { fontSize: FONT_SIZE.sm, color: theme.textSecondary, marginTop: 2 },
    popActionBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.sm, marginTop: 8 },
    popActionBadgeText: { fontSize: FONT_SIZE.xs, fontWeight: '600', color: '#fff' },
    toolsGrid: { gap: 12 },
    toolCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: RADIUS.lg },
    toolIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    toolContent: { flex: 1 },
    toolTitle: { fontSize: FONT_SIZE.md, fontWeight: '600', color: theme.text },
    toolSubtitle: { fontSize: FONT_SIZE.sm, color: theme.textSecondary, marginTop: 2 },
    timelineContainer: { gap: 16 },
    timelineItem: { flexDirection: 'row', alignItems: 'flex-start' },
    timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4, marginRight: 12 },
    timelineContent: { flex: 1 },
    timelineEvent: { fontSize: FONT_SIZE.md, color: theme.text, fontWeight: '500' },
    timelineTime: { fontSize: FONT_SIZE.sm, color: theme.textSecondary, marginTop: 4 },
    upgradeButton: { backgroundColor: theme.primary, paddingVertical: 8, paddingHorizontal: 16, borderRadius: RADIUS.md },
    upgradeButtonText: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: '#fff' },
  }), [theme, dashStyles]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={{ padding: 16 }}>
          <SkeletonLoader width="100%" height={120} borderRadius={20} style={{ marginBottom: 16 }} />
          <SkeletonLoader width="100%" height={80} borderRadius={12} style={{ marginBottom: 16 }} />
          <SkeletonLoader width="100%" height={200} borderRadius={16} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Fixed Header - Hidden for cleaner UI */}
      
      <ScrollView
        contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 0 : 80 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00f5ff"
          />
        }
      >
        {/* Error Banner */}
        {error && (
          <ErrorBanner
            message={t('dashboard.loadError')}
            onRetry={() => loadDashboardData()}
            onDismiss={() => setError(null)}
          />
        )}

        {/* Professional Welcome Section */}
        <WelcomeSection
          userName={`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || t('roles.parent')}
          subtitle={(() => {
            const active = (childrenCards || []).find((c: ChildCardData) => c.id === activeChildId) || (childrenCards.length === 1 ? childrenCards[0] : null);
            if (active) {
              return `Managing ${active.firstName} ${active.lastName}`;
            }
            if (children.length > 0) {
              return t('dashboard.managingChildrenPlural', { count: children.length });
            }
            return 'Welcome to EduDash Pro';
          })()}
          isDark={isDark}
          onThemeToggle={toggleTheme}
          showTierBadge={true}
          tierBadgePlacement="subtitle-inline"
          tierBadgeSize="sm"
        />

        {/* Enhanced Children Section (moved under welcome) - Using Phase 1 DashboardSection */}
        {children.length > 0 ? (
            <DashboardSection
            title={`${t('parent.myChildren')} (${children.length})`}
            icon="people"
            iconColor={theme.primary}
            showViewAll
            onViewAll={() => router.push('/screens/parent-children')}
            >
            {children.length > 1 && (
              <View style={{ marginBottom: 12 }}>
              <ChildSwitcher 
                children={childrenCards}
                activeChildId={activeChildId}
                onChildChange={(childId: string) => setActiveChildId(childId)}
              />
              </View>
            )}
            {(children.length > 1 && activeChildId ? 
              childrenCards.filter((child: ChildCardData) => child.id === activeChildId) : 
              childrenCards
            ).map((child: ChildCardData) => (
              <ChildCard
              key={child.id}
              child={child}
              onAttendancePress={() => console.log('View attendance for', child.id)}
              onHomeworkPress={() => console.log('View homework for', child.id)}
              onMessagePress={() => handleQuickMessage(child)}
              />
            ))}
            </DashboardSection>
        ) : (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('parent.noChildrenFound')}</Text>
            </View>
            <View style={styles.emptyState}>
              <Ionicons name="search" size={48} color={theme.primary} />
              <Text style={styles.emptyStateTitle}>No Children Linked Yet</Text>
              <Text style={styles.emptyStateSubtitle}>
                Search for your child by name to link them to your account. The school will approve your request.
              </Text>
              
              {/* Claim Existing Child Button */}
              <TouchableOpacity 
                style={[styles.emptyStateButton, { backgroundColor: theme.primary, marginBottom: 12, marginTop: 8 }]}
                onPress={() => router.push('/screens/parent-claim-child')}
              >
                <Ionicons name="search" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={[styles.emptyStateButtonText, { color: '#fff' }]}>Search & Claim Child</Text>
              </TouchableOpacity>
              
              {/* Register New Child Button */}
              <TouchableOpacity 
                style={[styles.emptyStateButton, { borderWidth: 1, borderColor: theme.border, backgroundColor: 'transparent' }]}
                onPress={() => {
                  console.log('[ParentDashboard] Register button pressed');
                  console.log('[ParentDashboard] Navigating to /screens/parent-child-registration');
                  try {
                    router.push('/screens/parent-child-registration' as any);
                    console.log('[ParentDashboard] Navigation called successfully');
                  } catch (error) {
                    console.error('[ParentDashboard] Navigation error:', error);
                  }
                }}
              >
                <Ionicons name="person-add" size={20} color={theme.text} style={{ marginRight: 8 }} />
                <Text style={[styles.emptyStateButtonText, { color: theme.text }]}>{t('parent.registerChild')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Parent Link Requests Status */}
        <View style={styles.section}>
          <PendingLinkRequests />
        </View>

        {/* Staff View: Parent Link Requests (Principal/Teacher Approval) */}
        {(profile?.role === 'principal' || profile?.role === 'teacher') && (
          <View style={styles.section}>
            <PendingParentLinkRequests />
          </View>
        )}

        {/* AI-Powered Proactive Insights - Using Phase 1 CollapsibleSection */}
        {activeChildId && (
          <View style={styles.section}>
            <CollapsibleSection
              title="Insights for Your Child"
              icon="bulb"
              iconColor="#00f5ff"
              badgeCount={insights.length}
              defaultExpanded={true}
              subtitle={loadingInsights ? 'Loading...' : insights.length > 0 ? `${insights.length} insights available` : undefined}
              onToggle={(expanded) => {
                track('edudash.parent.insights_section_toggled', {
                  expanded,
                  child_id: activeChildId,
                  user_id: user?.id,
                });
              }}
            >
              {loadingInsights ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Loading insights...</Text>
                </View>
              ) : insights.length > 0 ? (
                insights.slice(0, 3).map((insight, index) => (
                  <ParentInsightsCard
                    key={index}
                    insight={insight}
                    onActionPress={(actionTitle: string) => {
                      track('edudash.parent.insight_action_pressed', {
                        action: actionTitle,
                        insight_type: insight.type,
                        child_id: activeChildId,
                        user_id: user?.id,
                      });
                      // Navigate or perform action based on actionTitle
                      console.log('Action pressed:', actionTitle);
                    }}
                  />
                ))
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No insights available yet</Text>
                  <Text style={styles.emptySubtitle}>Check back later for personalized guidance</Text>
                </View>
              )}
            </CollapsibleSection>
          </View>
        )}

        {/* CAPS-Aligned Interactive Lessons */}
        {activeChildId && (
          <View style={styles.section}>
            {loadingInsights ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Loading lessons...</Text>
              </View>
            ) : (
              <InteractiveLessonsWidget
                lessons={interactiveLessons}
                onLessonPress={(lesson: InteractiveLesson) => {
                  track('edudash.parent.lesson_started', {
                    lesson_id: lesson.id,
                    lesson_title: lesson.title,
                    difficulty: lesson.difficulty,
                    child_id: activeChildId,
                    user_id: user?.id,
                  });
                  // Navigate to lesson detail or start lesson
                  console.log('Lesson pressed:', lesson.title);
                }}
              />
            )}
          </View>
        )}

        {/* Professional Metric Cards - Using Phase 1 MetricCard Component */}
        <DashboardSection
          title="Activity Overview"
          icon="stats-chart"
          iconColor={theme.primary}
          subtitle="Key metrics at a glance"
        >
          <View style={styles.metricsGrid}>
            {/* Row 1: Core metrics */}
            <View style={styles.metricsRow}>
              <MetricCard
                value={unreadMessageCount}
                label="New Messages"
                icon="mail"
                iconColor="#FFFFFF"
                iconBackgroundColor={theme.primary}
                status={unreadMessageCount > 0 ? 'warning' : 'info'}
                statusText={unreadMessageCount > 0 ? 'needs attention' : 'all read'}
                onPress={() => router.push('/messages')}
              />

              <MetricCard
                value={popStats?.proof_of_payment?.approved || 0}
                label="Approved Payments"
                icon="checkmark-circle"
                iconColor="#FFFFFF"
                iconBackgroundColor={theme.success}
                status="success"
                statusText="verified"
                onPress={() => router.push('/pop-history')}
              />
            </View>

            {/* Row 2: POP metrics */}
            <View style={styles.metricsRow}>
              <MetricCard
                value={popStats?.proof_of_payment?.pending || 0}
                label="Pending Payments"
                icon="time"
                iconColor="#FFFFFF"
                iconBackgroundColor={theme.warning}
                status="warning"
                statusText="review needed"
                onPress={() => router.push('/pop-history?type=proof_of_payment&status=pending')}
              />

              <MetricCard
                value={(popStats?.picture_of_progress?.pending || 0) + (popStats?.picture_of_progress?.approved || 0)}
                label="Progress Photos"
                icon="images"
                iconColor="#FFFFFF"
                iconBackgroundColor={theme.accent}
                status="info"
                statusText="shared"
                onPress={() => router.push('/pop-history?type=picture_of_progress')}
              />
            </View>

            {/* Row 3: Activity metrics */}
            <View style={styles.metricsRow}>
              <MetricCard
                value={urgentMetrics.pendingHomework}
                label="Pending Homework"
                icon="book"
                iconColor="#FFFFFF"
                iconBackgroundColor={theme.error}
                status={urgentMetrics.pendingHomework > 0 ? 'error' : 'success'}
                statusText={urgentMetrics.pendingHomework > 0 ? 'overdue' : 'up to date'}
                onPress={() => router.push('/homework')}
              />

              <MetricCard
                value="Today"
                label="Attendance"
                icon={getAttendanceIcon(urgentMetrics.todayAttendance)}
                iconColor="#FFFFFF"
                iconBackgroundColor={getAttendanceColor(urgentMetrics.todayAttendance, theme)}
                subtitle={urgentMetrics.todayAttendance === 'unknown' ? 'not recorded' : urgentMetrics.todayAttendance}
                onPress={() => router.push('/attendance')}
              />
            </View>
          </View>
        </DashboardSection>

        {/* POP Upload Actions - Using Phase 1 DashboardSection */}
        <DashboardSection
          title="Upload & Share"
          icon="camera"
          iconColor={theme.accent}
          subtitle="Manage payments and progress photos"
        >
          <View style={styles.popActionsGrid}>
            <TouchableOpacity 
              style={[styles.popActionCard, { backgroundColor: theme.warning + '10', borderColor: theme.warning }]}
              onPress={() => {
                if (activeChildId) {
                  const child = childrenCards.find((c: ChildCardData) => c.id === activeChildId);
                  router.push(`/screens/parent-proof-of-payment?studentId=${activeChildId}&studentName=${encodeURIComponent(`${child?.firstName || ''} ${child?.lastName || ''}`.trim())}`);
                } else {
                  router.push('/screens/parent-proof-of-payment');
                }
              }}
            >
              <View style={[styles.popActionIcon, { backgroundColor: theme.warning }]}>
                <Ionicons name="receipt" size={28} color="white" />
              </View>
              <View style={styles.popActionContent}>
                <Text style={styles.popActionTitle}>Upload Proof of Payment</Text>
                <Text style={styles.popActionSubtitle}>Share receipts & payment confirmations</Text>
                {popStats?.proof_of_payment?.pending && popStats.proof_of_payment.pending > 0 && (
                  <View style={[styles.popActionBadge, { backgroundColor: theme.warning }]}>
                    <Text style={styles.popActionBadgeText}>{`${popStats.proof_of_payment.pending} pending`}</Text>
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.popActionCard, { backgroundColor: theme.accent + '10', borderColor: theme.accent }]}
              onPress={() => {
                if (activeChildId) {
                  const child = childrenCards.find((c: ChildCardData) => c.id === activeChildId);
                  router.push(`/picture-of-progress?studentId=${activeChildId}&studentName=${encodeURIComponent(`${child?.firstName || ''} ${child?.lastName || ''}`.trim())}`);
                } else {
                  router.push('/picture-of-progress');
                }
              }}
            >
              <View style={[styles.popActionIcon, { backgroundColor: theme.accent }]}>
                <Ionicons name="camera" size={28} color="white" />
              </View>
              <View style={styles.popActionContent}>
                <Text style={styles.popActionTitle}>Share Progress Pictures</Text>
                <Text style={styles.popActionSubtitle}>Document your child's learning journey</Text>
                {popStats?.picture_of_progress?.recent && popStats.picture_of_progress.recent > 0 && (
                  <View style={[styles.popActionBadge, { backgroundColor: theme.accent }]}>
                    <Text style={styles.popActionBadgeText}>{`${popStats.picture_of_progress.recent} this week`}</Text>
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.popActionCard, { backgroundColor: theme.primary + '10', borderColor: theme.primary }]}
              onPress={() => router.push('/pop-history')}
            >
              <View style={[styles.popActionIcon, { backgroundColor: theme.primary }]}>
                <Ionicons name="folder-open" size={28} color="white" />
              </View>
              <View style={styles.popActionContent}>
                <Text style={styles.popActionTitle}>View Upload History</Text>
                <Text style={styles.popActionSubtitle}>Manage all your uploads & approvals</Text>
                {popStats?.total_pending && popStats.total_pending > 0 && (
                  <View style={[styles.popActionBadge, { backgroundColor: theme.primary }]}>
                    <Text style={styles.popActionBadgeText}>{`${popStats.total_pending} to review`}</Text>
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </DashboardSection>

        {/* Native Ad - Inline in content stream */}
        {showBanner && (
          <View style={styles.section}>
            <NativeAdCard 
              placement={PLACEMENT_KEYS.NATIVE_PARENT_FEED}
              style={{ alignSelf: 'center' }}
              itemIndex={1}
              showFallback={true}
            />
          </View>
        )}

        {/* AI Quota Overview */}
        <View style={styles.section}>
          <AIQuotaOverview 
            showUpgradePrompt={tier === 'free'}
          />
        </View>

        {/* Enhanced Usage Stats */}
        <EnhancedStatsRow
          aiHelp={usage.ai_help}
          aiHelpLimit={limits.ai_help}
          aiLessons={usage.ai_lessons}
          aiLessonsLimit={limits.ai_lessons}
        />

        {/* Enhanced Quick Actions */}
        <EnhancedQuickActions
          aiHelpUsage={usage.ai_help}
          aiHelpLimit={limits.ai_help}
          onHomeworkPress={() => handleQuickAction('homework')}
          onWhatsAppPress={() => handleQuickAction('whatsapp')}
          onUpgradePress={() => { /* removed in OTA preview */ }}
        />

        {/* Ad Banner for Free Tier - Middle placement */}
        {showBanner && (
          <View style={styles.section}>
            <AdBanner />
          </View>
        )}

        
        {/* Communication Hub - Using Phase 1 DashboardSection */}
        <DashboardSection
          title={t('parent.communicationHub')}
          icon="chatbubbles"
          iconColor={theme.primary}
          showViewAll
          onViewAll={() => router.push('/screens/parent-messages')}
        >
          <View style={styles.toolsGrid}>
            <TouchableOpacity 
              style={[styles.toolCard, { backgroundColor: theme.primary + '10' }]}
              onPress={() => router.push('/screens/parent-messages')}
            >
              <View style={[styles.toolIcon, { backgroundColor: theme.primary }]}>
                <Ionicons name="mail" size={20} color="white" />
              </View>
              <View style={styles.toolContent}>
                <Text style={styles.toolTitle}>{t('parent.messages')}</Text>
                <Text style={styles.toolSubtitle}>{t('parent.teacherCommunication')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.toolCard, { backgroundColor: theme.success + '10' }]}
              onPress={() => router.push('/screens/parent-announcements')}
            >
              <View style={[styles.toolIcon, { backgroundColor: theme.success }]}>
                <Ionicons name="megaphone" size={20} color="white" />
              </View>
              <View style={styles.toolContent}>
                <Text style={styles.toolTitle}>{t('parent.announcements')}</Text>
                <Text style={styles.toolSubtitle}>{t('parent.schoolUpdates')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.toolCard, { backgroundColor: theme.warning + '10' }]}
              onPress={() => router.push('/screens/parent-meetings')}
            >
              <View style={[styles.toolIcon, { backgroundColor: theme.warning }]}>
                <Ionicons name="calendar" size={20} color="white" />
              </View>
              <View style={styles.toolContent}>
                <Text style={styles.toolTitle}>{t('parent.scheduleMeeting')}</Text>
                <Text style={styles.toolSubtitle}>{t('parent.teacherMeeting')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
            
            {/* Native Ad - List context */}
            {showBanner && (
              <NativeAdCard 
                placement={PLACEMENT_KEYS.NATIVE_PARENT_LIST}
                style={{ marginVertical: 8 }}
                itemIndex={3}
                showFallback={true}
              />
            )}
          </View>
        </DashboardSection>
        
        {/* Banner Ad - Messages/Communication context */}
        {showBanner && (
          <View style={styles.section}>
            <AdBanner 
              placement={PLACEMENT_KEYS.BANNER_PARENT_MESSAGES}
              style={{ marginVertical: 8 }}
              showFallback={true}
            />
          </View>
        )}
        
        {/* Child Registration Requests - Shows pending/approved/rejected requests */}
        <PendingRegistrationRequests />
        
        {/* Recent Activity Timeline - Using Phase 1 DashboardSection */}
        <DashboardSection
          title={t('dashboard.recentActivity')}
          icon="time"
          iconColor={theme.primary}
        >
          <View style={styles.timelineContainer}>
            {(() => {
              const recentActivities = [];
              
              // Add AI help usage if any
              if (usage.ai_help > 0) {
                recentActivities.push({
                  time: 'Today',
                  event: t('dashboard.aiHelpUsed', { count: usage.ai_help }),
                  type: 'success'
                });
              }
              
              // Add children activities if any
              if (children.length > 0) {
                recentActivities.push({
                  time: '1 day ago',
                  event: `Monitoring ${children.length} ${children.length === 1 ? 'child' : 'children'}`,
                  type: 'info'
                });
              }
              
              // Add usage limit warning if needed
              if (usage.ai_help >= (limits.ai_help as number)) {
                recentActivities.push({
                  time: 'Now',
                  event: t('dashboard.upgradeLimitReached'),
                  type: 'warning'
                });
              }
              
              // Fallback activities if no real data
              if (recentActivities.length === 0) {
                recentActivities.push(
                  { time: 'Welcome!', event: 'Account created successfully', type: 'success' },
                  { time: 'Next', event: 'Link your children to start tracking progress', type: 'info' }
                );
              }
              
              return recentActivities.slice(0, 4).map((item, index) => (
                <View key={index} style={styles.timelineItem}>
                  <View style={[
                    styles.timelineDot,
                    { backgroundColor: 
                      item.type === 'success' ? theme.success :
                      item.type === 'warning' ? theme.warning :
                      theme.primary
                    }
                  ]} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineEvent}>{item.event}</Text>
                    <Text style={styles.timelineTime}>{item.time}</Text>
                  </View>
                </View>
              ));
            })()
            }
            
            {/* Upgrade CTA if usage limit reached */}
            {usage.ai_help >= (limits.ai_help as number) && (
              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: theme.warning }]} />
                <View style={styles.timelineContent}>
                  <TouchableOpacity 
                    style={styles.upgradeButton}
                    onPress={() => handleQuickAction('upgrade')}
                  >
                    <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </DashboardSection>

        {/* Ad Banner for Free Tier - Main Dashboard bottom placement */}
        {showBanner && (
          <View style={styles.section}>
            <AdBanner 
              placement={PLACEMENT_KEYS.BANNER_PARENT_DASHBOARD}
              style={{ marginBottom: 16 }}
              showFallback={true}
            />
          </View>
        )}

        {/* Additional spacing for bottom navigation */}
        <View style={{ height: 20 }} />

      </ScrollView>

      {/* Homework Modal */}
      <HomeworkModal 
        visible={showHomeworkModal} 
        onClose={() => setShowHomeworkModal(false)}
        activeChildId={activeChildId}
        children={children}
      />
      
      {/* Language Modal */}
      <LanguageModal 
        visible={showLanguageModal} 
        onClose={() => setShowLanguageModal(false)}
        userId={user?.id}
      />
      
      {/* WhatsApp Modal */}
      <WhatsAppOptInModal visible={showWhatsAppModal} onClose={() => setShowWhatsAppModal(false)} />
      
      {/* VOICETODO: AI Assistant Floating Button now in root layout */}
    </View>
  );
}
