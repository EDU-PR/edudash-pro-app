import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { usePrincipalHub } from '@/hooks/usePrincipalHub';
import { useRecentStudents } from '@/hooks/useRecentStudents';
import { useBirthdayPlanner } from '@/hooks/useBirthdayPlanner';
import { usePrincipalDashboardSections } from '@/hooks/principal/usePrincipalDashboardSections';
import { normalizePersonName } from '@/lib/utils/nameUtils';
import { resolveSchoolTypeFromProfile } from '@/lib/schoolTypeResolver';
import { StudentSummaryCard, CollapsibleSection } from '@/components/dashboard/shared';
import { PendingParentLinkRequests } from '@/components/dashboard/PendingParentLinkRequests';
import { UpcomingBirthdaysCard } from '@/components/dashboard/UpcomingBirthdaysCard';
import { BirthdayDonationSummaryCard } from '@/components/dashboard/principal/BirthdayDonationSummaryCard';
import {
  PrincipalDoNowInbox,
  PrincipalGettingStartedCard,
  PrincipalQuickActions,
  PrincipalSchoolPulse,
} from '@/components/dashboard/principal';
import {
  isPrincipalSectionId,
  type PrincipalSectionConfig,
  type PrincipalSectionId,
} from '@/components/dashboard/principal/sectionTypes';
import type { AttentionPriority } from '@/components/dashboard/shared/SectionAttentionDot';
import TierBadge from '@/components/ui/TierBadge';
import { getApprovalStats } from '@/lib/services/teacherApprovalService';

interface PrincipalDashboardV2Props {
  refreshTrigger?: number;
}

const getAttentionPriority = (
  count: number,
  criticalThreshold = 8,
  importantThreshold = 1
): AttentionPriority => {
  if (count >= criticalThreshold) return 'critical';
  if (count >= importantThreshold) return 'important';
  return 'none';
};

const toAttention = (config: PrincipalSectionConfig) => {
  if (config.attentionPriority === 'none') return undefined;
  return {
    priority: config.attentionPriority,
    count: config.attentionCount,
  };
};

export const PrincipalDashboardV2: React.FC<PrincipalDashboardV2Props> = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const { ready: subscriptionReady } = useSubscription();
  const insets = useSafeAreaInsets();
  const resolvedSchoolType = resolveSchoolTypeFromProfile(profile);

  const {
    data,
    loading,
    refresh,
  } = usePrincipalHub();

  const organizationId = profile?.organization_id || profile?.preschool_id || null;

  const {
    students: recentStudents,
    loading: studentsLoading,
    refresh: refreshStudents,
  } = useRecentStudents({ organizationId, limit: 4 });

  const {
    birthdays,
    loading: birthdaysLoading,
    refresh: refreshBirthdays,
  } = useBirthdayPlanner({
    preschoolId: organizationId || undefined,
    daysAhead: 45,
  });

  const [refreshing, setRefreshing] = useState(false);
  const [pendingTeacherApprovals, setPendingTeacherApprovals] = useState(0);

  const stats = data.stats;

  // Fetch pending teacher approvals count
  useEffect(() => {
    if (!organizationId) return;
    getApprovalStats(organizationId).then(s => setPendingTeacherApprovals(s.pending)).catch(() => {});
  }, [organizationId, refreshing]);

  const totalStudents = stats?.students?.total ?? 0;
  const totalTeachers = stats?.staff?.total ?? 0;
  const totalClasses = stats?.classes?.total ?? 0;
  const attendanceRate = stats?.attendanceRate?.percentage ?? 0;
  const attendancePresent = totalStudents > 0
    ? Math.round((attendanceRate / 100) * totalStudents)
    : 0;

  const pendingApplications = stats?.pendingApplications?.total ?? 0;
  const pendingRegistrations = stats?.pendingRegistrations?.total ?? 0;
  const pendingPayments = stats?.pendingPayments?.total ?? 0;
  const pendingPOPs = stats?.pendingPOPUploads?.total ?? 0;
  const pendingReports = data.pendingReportApprovals ?? 0;
  const pendingActivities = data.pendingActivityApprovals ?? 0;
  const pendingHomework = data.pendingHomeworkApprovals ?? 0;
  const pendingApprovalsTotal = pendingReports + pendingActivities + pendingHomework;

  const urgentCount = pendingPayments + pendingPOPs + pendingApprovalsTotal;
  const urgentQueueCount = pendingRegistrations + pendingPayments + pendingPOPs + pendingApprovalsTotal;
  const admissionsQueueCount = pendingApplications + pendingRegistrations + pendingPayments + pendingPOPs;
  const upcomingBirthdaysCount =
    (birthdays?.today?.length || 0) +
    (birthdays?.thisWeek?.length || 0) +
    (birthdays?.thisMonth?.length || 0);

  const {
    collapsedSections,
    toggleSection,
    expandAll,
    collapseAll,
    isHydrated,
  } = usePrincipalDashboardSections({
    userId: user?.id ?? null,
    orgId: organizationId,
    pendingRegistrations,
    pendingPayments,
    pendingPOPs,
    pendingApprovals: pendingApprovalsTotal,
  });

  const lastUpdatedAt = useMemo(() => {
    if (stats?.timestamp) {
      return new Date(stats.timestamp);
    }
    return new Date();
  }, [stats?.timestamp]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.good_morning', { defaultValue: 'Good morning' });
    if (hour < 18) return t('dashboard.good_afternoon', { defaultValue: 'Good afternoon' });
    return t('dashboard.good_evening', { defaultValue: 'Good evening' });
  }, [t]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), refreshBirthdays(), refreshStudents()]);
    setRefreshing(false);
  }, [refresh, refreshBirthdays, refreshStudents]);

  const schoolName = profile?.organization_name || data.schoolName || t('dashboard.your_school', { defaultValue: 'Your School' });
  const normalizedName = normalizePersonName({
    first: profile?.first_name || user?.user_metadata?.first_name,
    last: profile?.last_name || user?.user_metadata?.last_name,
    full: profile?.full_name || user?.user_metadata?.full_name,
  });
  const userName = normalizedName.fullName || normalizedName.shortName || t('dashboard.principal', { defaultValue: 'Principal' });
  const uniformSummary = data.uniformPayments;
  const isYoungEagles = (schoolName || '').toLowerCase().includes('young eagles');
  const showUniformSection = Boolean(
    uniformSummary &&
    (uniformSummary.paidCount > 0 || uniformSummary.pendingCount > 0 || uniformSummary.pendingUploads > 0 || isYoungEagles)
  );

  const capacity = data.capacityMetrics?.capacity ?? 0;
  const utilization = data.capacityMetrics?.utilization_percentage ?? (capacity > 0 ? Math.round((totalStudents / capacity) * 100) : 0);

  const formatCurrency = (amount?: number | null): string => {
    if (!amount) return 'R0';
    if (amount >= 1000000) return `R${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `R${(amount / 1000).toFixed(0)}k`;
    return `R${amount.toFixed(0)}`;
  };

  const sectionConfigs = useMemo<Record<PrincipalSectionId, PrincipalSectionConfig>>(
    () => ({
      'start-here': {
        id: 'start-here',
        title: t('dashboard.section.start_here.title', { defaultValue: 'Start Here' }),
        hint: t('dashboard.section.start_here.hint', { defaultValue: 'School pulse and setup guidance in one place.' }),
        icon: 'sparkles',
        defaultCollapsed: collapsedSections.has('start-here'),
        attentionPriority: 'none',
        attentionCount: 0,
      },
      'urgent-queue': {
        id: 'urgent-queue',
        title: t('dashboard.section.urgent_queue.title', { defaultValue: 'Urgent Queue' }),
        hint: t('dashboard.section.urgent_queue.hint', { defaultValue: 'Handle priority items first: POPs, unpaid fees, and approvals.' }),
        icon: 'warning-outline',
        defaultCollapsed: collapsedSections.has('urgent-queue'),
        attentionPriority: getAttentionPriority(urgentQueueCount, 10, 1),
        attentionCount: urgentQueueCount,
      },
      'daily-ops': {
        id: 'daily-ops',
        title: t('dashboard.section.daily_ops.title', { defaultValue: 'Daily Ops & Compliance' }),
        hint: t('dashboard.section.daily_ops.hint', { defaultValue: 'Attendance, staffing, and safety checks for today.' }),
        icon: 'shield-checkmark-outline',
        defaultCollapsed: collapsedSections.has('daily-ops'),
        attentionPriority:
          pendingReports > 0 ? 'action' : 'none',
        attentionCount: pendingReports,
      },
      'admissions-cashflow': {
        id: 'admissions-cashflow',
        title: t('dashboard.section.admissions_cashflow.title', { defaultValue: 'Admissions & Cashflow' }),
        hint: t('dashboard.section.admissions_cashflow.hint', { defaultValue: 'Track applications, registrations, fees, POPs, and collections.' }),
        icon: 'wallet-outline',
        defaultCollapsed: collapsedSections.has('admissions-cashflow'),
        attentionPriority: getAttentionPriority(admissionsQueueCount, 8, 1),
        attentionCount: admissionsQueueCount,
      },
      'learners-families': {
        id: 'learners-families',
        title: t('dashboard.section.learners_families.title', { defaultValue: 'Learners & Families' }),
        hint: t('dashboard.section.learners_families.hint', { defaultValue: 'Students in focus, birthdays, and parent link requests.' }),
        icon: 'people-outline',
        defaultCollapsed: collapsedSections.has('learners-families'),
        attentionPriority: upcomingBirthdaysCount > 0 ? 'info' : 'none',
        attentionCount: upcomingBirthdaysCount,
      },
      'quick-actions': {
        id: 'quick-actions',
        title: t('dashboard.quick_actions', { defaultValue: 'Quick Actions' }),
        hint: t('dashboard.qa.money_hint', { defaultValue: 'Open common workflows fast.' }),
        icon: 'flash-outline',
        defaultCollapsed: collapsedSections.has('quick-actions'),
        attentionPriority: urgentQueueCount > 0 ? 'action' : 'none',
        attentionCount: urgentQueueCount,
      },
    }),
    [
      admissionsQueueCount,
      collapsedSections,
      pendingReports,
      t,
      upcomingBirthdaysCount,
      urgentQueueCount,
    ]
  );

  const handleSectionToggle = useCallback(
    (sectionId: string, isCollapsed: boolean) => {
      if (!isPrincipalSectionId(sectionId)) return;
      toggleSection(sectionId, isCollapsed);
    },
    [toggleSection]
  );

  const handleQuickActionsToggle = useCallback(
    (sectionId: string) => {
      if (!isPrincipalSectionId(sectionId)) return;
      toggleSection(sectionId);
    },
    [toggleSection]
  );

  const styles = useMemo(() => createStyles(theme, insets.top, insets.bottom), [theme, insets.top, insets.bottom]);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerTopRow}>
              <Text style={styles.greeting} numberOfLines={1}>
                {greeting}, {userName}
              </Text>
            </View>
            <View style={styles.headerMetaRow}>
              <Text style={styles.schoolName} numberOfLines={1}>
                {schoolName}
              </Text>
              {subscriptionReady ? (
                <TierBadge size="sm" showManageButton={false} />
              ) : null}
              {subscriptionReady ? (
                <TouchableOpacity
                  style={styles.manageButton}
                  onPress={() => router.push('/screens/subscription-upgrade-post')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.manageButtonText}>Manage</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <Text style={styles.updatedAt} numberOfLines={1}>
              {t('dashboard.updated_at', { defaultValue: 'Updated' })}{' '}
              {lastUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>

        <View style={styles.layoutControlsWrap}>
          <Text style={styles.layoutControlsTitle}>
            {t('dashboard.layout_controls', { defaultValue: 'Dashboard layout' })}
          </Text>
          <View style={styles.layoutControlsRow}>
            <TouchableOpacity
              style={[styles.layoutControlButton, !isHydrated && styles.layoutControlButtonDisabled]}
              onPress={expandAll}
              disabled={!isHydrated}
              activeOpacity={0.85}
            >
              <Text style={styles.layoutControlButtonText}>
                {t('dashboard.expand_all', { defaultValue: 'Expand all' })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.layoutControlButton, !isHydrated && styles.layoutControlButtonDisabled]}
              onPress={collapseAll}
              disabled={!isHydrated}
              activeOpacity={0.85}
            >
              <Text style={styles.layoutControlButtonText}>
                {t('dashboard.collapse_all_except_urgent', { defaultValue: 'Collapse all (except urgent)' })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <CollapsibleSection
            title={sectionConfigs['start-here'].title}
            sectionId={sectionConfigs['start-here'].id}
            icon={sectionConfigs['start-here'].icon}
            hint={sectionConfigs['start-here'].hint}
            defaultCollapsed={sectionConfigs['start-here'].defaultCollapsed}
            onToggle={handleSectionToggle}
            attention={toAttention(sectionConfigs['start-here'])}
          >
            <View style={styles.sectionBody}>
              <PrincipalSchoolPulse stats={stats} />
              <PrincipalGettingStartedCard stats={stats} />
            </View>
          </CollapsibleSection>
        </View>

        <View style={styles.sectionBlock}>
          <CollapsibleSection
            title={sectionConfigs['urgent-queue'].title}
            sectionId={sectionConfigs['urgent-queue'].id}
            icon={sectionConfigs['urgent-queue'].icon}
            hint={sectionConfigs['urgent-queue'].hint}
            defaultCollapsed={sectionConfigs['urgent-queue'].defaultCollapsed}
            onToggle={handleSectionToggle}
            attention={toAttention(sectionConfigs['urgent-queue'])}
          >
            <View style={styles.sectionBody}>
              <PrincipalDoNowInbox
                counts={{
                  pendingRegistrations,
                  pendingPaymentProofs: pendingPOPs,
                  pendingUnpaidFees: pendingPayments,
                  pendingApprovals: pendingApprovalsTotal,
                }}
              />
            </View>
          </CollapsibleSection>
        </View>

        <View style={styles.sectionBlock}>
          <CollapsibleSection
            title={sectionConfigs['daily-ops'].title}
            sectionId={sectionConfigs['daily-ops'].id}
            icon={sectionConfigs['daily-ops'].icon}
            hint={sectionConfigs['daily-ops'].hint}
            defaultCollapsed={sectionConfigs['daily-ops'].defaultCollapsed}
            onToggle={handleSectionToggle}
            attention={toAttention(sectionConfigs['daily-ops'])}
          >
            <View style={styles.sectionBody}>
              <Text style={styles.sectionDescriptor}>
                {t('dashboard.section.daily_ops.copy', { defaultValue: 'Keep attendance, staffing, and safety on track for the day.' })}
              </Text>

              <View style={styles.card}>
                <OperationRow
                  icon="checkmark-circle"
                  label={t('dashboard.attendance_rate', { defaultValue: 'Attendance' })}
                  value={`${attendancePresent}/${totalStudents}`}
                  detail={`${attendanceRate.toFixed(0)}% ${t('dashboard.attendance_avg', { defaultValue: 'average' })}`}
                  color={theme.info}
                  theme={theme}
                />
                <OperationRow
                  icon="people"
                  label={t('dashboard.staff_coverage', { defaultValue: 'Staff Coverage' })}
                  value={`${totalTeachers}`}
                  detail={t('dashboard.staff_active', { defaultValue: 'Active staff' })}
                  color={theme.success}
                  theme={theme}
                />
                <OperationRow
                  icon="alert-circle"
                  label={t('dashboard.urgent_items', { defaultValue: 'Urgent Items' })}
                  value={`${urgentCount}`}
                  detail={`${pendingPayments} payments • ${pendingPOPs} POPs • ${pendingApprovalsTotal} approvals`}
                  color={theme.error}
                  theme={theme}
                />
              </View>

              <View style={styles.card}>
                <InfoRow
                  icon="medkit"
                  label={t('dashboard.medical_alerts', { defaultValue: 'Medical Alerts' })}
                  value={t('dashboard.no_alerts', { defaultValue: 'None today' })}
                  tone="success"
                  theme={theme}
                />
                <InfoRow
                  icon="alert"
                  label={t('dashboard.incident_reports', { defaultValue: 'Incident Reports' })}
                  value={`${pendingReports}`}
                  tone={pendingReports > 0 ? 'warning' : 'success'}
                  theme={theme}
                />
                <InfoRow
                  icon="document"
                  label={t('dashboard.expiring_docs', { defaultValue: 'Expiring Documents' })}
                  value={t('dashboard.none_due', { defaultValue: 'None due' })}
                  tone="success"
                  theme={theme}
                />
              </View>
            </View>
          </CollapsibleSection>
        </View>

        <View style={styles.sectionBlock}>
          <CollapsibleSection
            title={sectionConfigs['admissions-cashflow'].title}
            sectionId={sectionConfigs['admissions-cashflow'].id}
            icon={sectionConfigs['admissions-cashflow'].icon}
            hint={sectionConfigs['admissions-cashflow'].hint}
            defaultCollapsed={sectionConfigs['admissions-cashflow'].defaultCollapsed}
            onToggle={handleSectionToggle}
            attention={toAttention(sectionConfigs['admissions-cashflow'])}
          >
            <View style={styles.sectionBody}>
              <Text style={styles.sectionDescriptor}>
                {t('dashboard.section.admissions_cashflow.copy', { defaultValue: 'Track new-family pipeline and payment health month by month.' })}
              </Text>

              <View style={styles.metricGrid}>
                <MetricTile
                  icon="document-text"
                  label={t('dashboard.new_applications', { defaultValue: 'Applications' })}
                  value={`${pendingApplications}`}
                  sublabel={t('dashboard.awaiting_review', { defaultValue: 'Awaiting review' })}
                  color={theme.primary}
                  theme={theme}
                />
                <MetricTile
                  icon="person-add"
                  label={t('dashboard.pending_registrations', { defaultValue: 'Registrations' })}
                  value={`${pendingRegistrations}`}
                  sublabel={t('dashboard.awaiting_payment', { defaultValue: 'Awaiting payment' })}
                  color={theme.warning}
                  theme={theme}
                />
                <MetricTile
                  icon="cash"
                  label={t('dashboard.unpaid_fees', { defaultValue: 'Unpaid Fees' })}
                  value={`${pendingPayments}`}
                  sublabel={t('dashboard.overdue', { defaultValue: 'Overdue' })}
                  color={theme.error}
                  theme={theme}
                />
                <MetricTile
                  icon="card"
                  label={t('dashboard.payment_proofs', { defaultValue: 'POPs' })}
                  value={`${pendingPOPs}`}
                  sublabel={t('dashboard.to_verify', { defaultValue: 'To verify' })}
                  color={theme.info}
                  theme={theme}
                />
              </View>

              <View style={styles.card}>
                <Text style={styles.inlineSectionTitle}>
                  {t('dashboard.money_summary', { defaultValue: 'Finance Snapshot' })}
                </Text>
                <MetricInline label={t('dashboard.money_received', { defaultValue: 'Collected' })} value={formatCurrency(stats?.monthlyRevenue?.total)} theme={theme} />
                <MetricInline label={t('dashboard.money_owed', { defaultValue: 'Outstanding' })} value={`${pendingPayments}`} theme={theme} />
                <MetricInline label={t('dashboard.pending_approvals', { defaultValue: 'Pending Approvals' })} value={`${pendingApprovalsTotal}`} theme={theme} />
                <View style={styles.progressRow}>
                  <Text style={styles.progressLabel}>{t('dashboard.capacity_usage', { defaultValue: 'Capacity Usage' })}</Text>
                  <Text style={styles.progressValue}>{utilization}%</Text>
                </View>
                <ProgressBar progress={Math.min(Math.max(utilization / 100, 0), 1)} color={theme.primary} trackColor={theme.border} />
              </View>

              {showUniformSection && (
                <View style={styles.card}>
                  <Text style={styles.inlineSectionTitle}>
                    {t('dashboard.uniform_collections', { defaultValue: 'Uniform Collections' })}
                  </Text>
                  <Text style={styles.uniformNote}>
                    {isYoungEagles
                      ? t('dashboard.uniform_collections_note', { defaultValue: 'Young Eagles uniform payments are tracked separately from school revenue.' })
                      : t('dashboard.uniform_collections_note', { defaultValue: 'Uniform payments are tracked separately from school revenue.' })}
                  </Text>
                  <MetricInline
                    label={t('dashboard.uniform_paid', { defaultValue: 'Paid (Uniforms)' })}
                    value={formatCurrency(uniformSummary?.totalPaid || 0)}
                    theme={theme}
                  />
                  <MetricInline
                    label={t('dashboard.uniform_outstanding', { defaultValue: 'Outstanding' })}
                    value={formatCurrency(uniformSummary?.totalOutstanding || 0)}
                    theme={theme}
                  />
                  <MetricInline
                    label={t('dashboard.uniform_pending_pops', { defaultValue: 'Pending POPs' })}
                    value={`${uniformSummary?.pendingUploads || 0}${
                      uniformSummary?.pendingUploadAmount ? ` • ${formatCurrency(uniformSummary.pendingUploadAmount)}` : ''
                    }`}
                    theme={theme}
                  />
                </View>
              )}
            </View>
          </CollapsibleSection>
        </View>

        <View style={styles.sectionBlock}>
          <CollapsibleSection
            title={sectionConfigs['learners-families'].title}
            sectionId={sectionConfigs['learners-families'].id}
            icon={sectionConfigs['learners-families'].icon}
            hint={sectionConfigs['learners-families'].hint}
            defaultCollapsed={sectionConfigs['learners-families'].defaultCollapsed}
            onToggle={handleSectionToggle}
            attention={toAttention(sectionConfigs['learners-families'])}
          >
            <View style={styles.sectionBody}>
              <Text style={styles.sectionDescriptor}>
                {t('dashboard.section.learners_families.copy', { defaultValue: 'Review learners in focus and stay ahead of parent-facing moments.' })}
              </Text>

              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.inlineSectionTitle}>
                    {t('dashboard.children_in_focus', { defaultValue: 'Children In Focus' })}
                  </Text>
                  <TouchableOpacity onPress={() => router.push('/screens/student-management' as any)}>
                    <Text style={styles.linkText}>{t('common.view_all', { defaultValue: 'View All' })}</Text>
                  </TouchableOpacity>
                </View>
                {studentsLoading ? (
                  <Text style={styles.loadingText}>{t('common.loading', { defaultValue: 'Loading...' })}</Text>
                ) : (
                  recentStudents.map((student) => (
                    <StudentSummaryCard
                      key={student.id}
                      student={student}
                      onPress={() => router.push(`/screens/student-detail?id=${student.id}` as any)}
                      subtitle={student.className || t('common.noClass', { defaultValue: 'No class assigned' })}
                    />
                  ))
                )}
                {!studentsLoading && recentStudents.length === 0 && (
                  <Text style={styles.emptyText}>{t('dashboard.no_students', { defaultValue: 'No students yet.' })}</Text>
                )}
              </View>

              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.inlineSectionTitle}>
                    {t('dashboard.upcoming_birthdays', { defaultValue: 'Upcoming Birthdays' })}
                  </Text>
                  <TouchableOpacity onPress={() => router.push('/screens/birthday-chart' as any)}>
                    <Text style={styles.linkText}>{t('dashboard.view_chart', { defaultValue: 'View Chart' })}</Text>
                  </TouchableOpacity>
                </View>
                <UpcomingBirthdaysCard
                  birthdays={birthdays}
                  loading={birthdaysLoading}
                  showHeader={false}
                  maxItems={5}
                  compact
                  onViewAll={() => router.push('/screens/birthday-chart' as any)}
                />
              </View>

              <View style={styles.card}>
                <Text style={styles.inlineSectionTitle}>
                  {t('dashboard.birthday_donations.title', { defaultValue: 'Birthday Donations' })}
                </Text>
                <BirthdayDonationSummaryCard organizationId={organizationId} />
              </View>

              <View style={styles.card}>
                <Text style={styles.inlineSectionTitle}>
                  {t('dashboard.parent_requests', { defaultValue: 'Parent Requests' })}
                </Text>
                <PendingParentLinkRequests />
              </View>
            </View>
          </CollapsibleSection>
        </View>

        <View style={styles.sectionBlock}>
          <PrincipalQuickActions
            stats={data.stats}
            pendingRegistrationsCount={pendingRegistrations}
            pendingPaymentsCount={pendingPayments}
            pendingPOPUploadsCount={pendingPOPs}
            pendingTeacherApprovalsCount={pendingTeacherApprovals}
            collapsedSections={collapsedSections as Set<string>}
            onToggleSection={handleQuickActionsToggle}
            resolvedSchoolType={resolvedSchoolType}
            organizationId={organizationId}
          />
        </View>

        {loading && (
          <Text style={styles.loadingText}>{t('common.loading', { defaultValue: 'Loading...' })}</Text>
        )}
      </ScrollView>
    </View>
  );
};

const OperationRow = ({
  icon,
  label,
  value,
  detail,
  color,
  theme,
}: {
  icon: string;
  label: string;
  value: string;
  detail: string;
  color: string;
  theme: any;
}) => (
  <View style={rowStyles.container}>
    <View style={[rowStyles.iconContainer, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon as any} size={18} color={color} />
    </View>
    <View style={rowStyles.info}>
      <Text style={[rowStyles.label, { color: theme.text }]}>{label}</Text>
      <Text style={[rowStyles.detail, { color: theme.textSecondary }]}>{detail}</Text>
    </View>
    <Text style={[rowStyles.value, { color: theme.text }]}>{value}</Text>
  </View>
);

const MetricTile = ({
  icon,
  label,
  value,
  sublabel,
  color,
  theme,
}: {
  icon: string;
  label: string;
  value: string;
  sublabel?: string;
  color: string;
  theme: any;
}) => (
  <View style={[tileStyles.tile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
    <View style={[tileStyles.icon, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon as any} size={18} color={color} />
    </View>
    <Text style={[tileStyles.value, { color: theme.text }]}>{value}</Text>
    <Text style={[tileStyles.label, { color: theme.textSecondary }]}>{label}</Text>
    {sublabel ? <Text style={[tileStyles.sublabel, { color: theme.textTertiary }]}>{sublabel}</Text> : null}
  </View>
);

const MetricInline = ({ label, value, theme }: { label: string; value: string; theme: any }) => (
  <View style={inlineStyles.row}>
    <Text style={[inlineStyles.label, { color: theme.textSecondary }]}>{label}</Text>
    <Text style={[inlineStyles.value, { color: theme.text }]}>{value}</Text>
  </View>
);

const InfoRow = ({
  icon,
  label,
  value,
  tone,
  theme,
}: {
  icon: string;
  label: string;
  value: string;
  tone: 'info' | 'warning' | 'error' | 'success';
  theme: any;
}) => {
  const toneColors: Record<'info' | 'warning' | 'error' | 'success', string> = {
    info: '#3B82F6',
    warning: '#F59E0B',
    error: '#EF4444',
    success: '#10B981',
  };

  return (
    <View style={[infoStyles.row, { borderBottomColor: theme.border }]}>
      <Ionicons name={icon as any} size={16} color={toneColors[tone]} />
      <Text style={[infoStyles.label, { color: theme.text }]}>{label}</Text>
      <Text style={[infoStyles.value, { color: toneColors[tone] }]}>{value}</Text>
    </View>
  );
};

const ProgressBar = ({
  progress,
  color,
  trackColor,
}: {
  progress: number;
  color: string;
  trackColor?: string;
}) => (
  <View style={[progressStyles.track, trackColor ? { backgroundColor: trackColor } : null]}>
    <View style={[progressStyles.fill, { width: `${progress * 100}%`, backgroundColor: color }]} />
  </View>
);

const rowStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  info: { flex: 1 },
  label: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  detail: { fontSize: 12, color: '#9CA3AF' },
  value: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});

const tileStyles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  value: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  label: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  sublabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },
});

const inlineStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  label: { fontSize: 13, color: '#9CA3AF' },
  value: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
});

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  label: { flex: 1, marginLeft: 8, color: '#FFFFFF', fontSize: 13 },
  value: { fontSize: 12, fontWeight: '600' },
});

const progressStyles = StyleSheet.create({
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});

const createStyles = (theme: any, insetTop: number, insetBottom: number) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    scrollContent: {
      paddingTop: insetTop + 12,
      paddingBottom: Math.max(insetBottom, 8),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 6,
    },
    headerLeft: { flex: 1 },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    greeting: { fontSize: 18, fontWeight: '800', color: theme.text },
    headerMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 4,
    },
    schoolName: { fontSize: 14, fontWeight: '800', color: theme.textSecondary },
    manageButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    manageButtonText: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.primary,
    },
    updatedAt: { fontSize: 11, color: theme.textTertiary, marginTop: 4 },
    layoutControlsWrap: {
      marginTop: 8,
      marginHorizontal: 16,
      marginBottom: 8,
      padding: 12,
      borderRadius: 12,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    layoutControlsTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.textSecondary,
      marginBottom: 8,
    },
    layoutControlsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    layoutControlButton: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.primary + '55',
      backgroundColor: theme.primary + '14',
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    layoutControlButtonDisabled: {
      opacity: 0.5,
    },
    layoutControlButtonText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.primary,
    },
    sectionBlock: {
      paddingHorizontal: 16,
      marginTop: 4,
    },
    sectionBody: {
      paddingTop: 12,
      gap: 12,
    },
    sectionDescriptor: {
      fontSize: 12,
      lineHeight: 18,
      color: theme.textSecondary,
      paddingHorizontal: 2,
    },
    card: {
      padding: 14,
      borderRadius: 16,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    rowBetween: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    linkText: {
      color: theme.primary,
      fontWeight: '700',
      fontSize: 12,
    },
    inlineSectionTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 10,
    },
    metricGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    progressRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
      marginBottom: 4,
    },
    progressLabel: { fontSize: 12, color: theme.textSecondary },
    progressValue: { fontSize: 12, color: theme.textSecondary },
    uniformNote: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 10,
      lineHeight: 18,
    },
    loadingText: { textAlign: 'center', color: theme.textSecondary, marginTop: 8 },
    emptyText: { textAlign: 'center', color: theme.textSecondary, marginVertical: 8 },
  });

export default PrincipalDashboardV2;
