import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { usePrincipalHub } from '@/hooks/usePrincipalHub';
import { useRecentStudents } from '@/hooks/useRecentStudents';
import { useBirthdayPlanner } from '@/hooks/useBirthdayPlanner';
import { StudentSummaryCard } from '@/components/dashboard/shared';
import { PendingParentLinkRequests } from '@/components/dashboard/PendingParentLinkRequests';
import { UpcomingBirthdaysCard } from '@/components/dashboard/UpcomingBirthdaysCard';
import { BirthdayDonationSummaryCard } from '@/components/dashboard/principal/BirthdayDonationSummaryCard';

interface PrincipalDashboardV2Props {
  refreshTrigger?: number;
}

type Tone = 'info' | 'warning' | 'error' | 'success';
interface NeedsAttentionItem {
  id: string;
  title: string;
  value: number;
  action: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tone: Tone;
  route: string;
}

export const PrincipalDashboardV2: React.FC<PrincipalDashboardV2Props> = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();

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

  const stats = data.stats;

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

  const urgentCount = pendingPayments + pendingPOPs + pendingReports;

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
  const userName = profile?.full_name || profile?.first_name || user?.user_metadata?.first_name || t('dashboard.principal', { defaultValue: 'Principal' });

  const capacity = data.capacityMetrics?.capacity ?? 0;
  const utilization = data.capacityMetrics?.utilization_percentage ?? (capacity > 0 ? Math.round((totalStudents / capacity) * 100) : 0);

  const formatCurrency = (amount?: number | null): string => {
    if (!amount) return 'R0';
    if (amount >= 1000000) return `R${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `R${(amount / 1000).toFixed(0)}k`;
    return `R${amount.toFixed(0)}`;
  };

  const quickActions = [
    { id: 'students', label: t('dashboard.manage_students', { defaultValue: 'Students' }), icon: 'school', route: '/screens/student-management', color: theme.primary },
    { id: 'teachers', label: t('dashboard.manage_teachers', { defaultValue: 'Teachers' }), icon: 'people', route: '/screens/teacher-management', color: theme.success },
    { id: 'registrations', label: t('dashboard.review_registrations', { defaultValue: 'Registrations' }), icon: 'person-add', route: '/screens/principal-registrations', color: theme.warning },
    { id: 'uniforms', label: t('dashboard.uniform_sizes', { defaultValue: 'Uniforms' }), icon: 'shirt-outline', route: '/screens/principal-uniforms', color: theme.info },
    { id: 'parent-links', label: t('dashboard.parent_links', { defaultValue: 'Connect Parent' }), icon: 'link', route: '/screens/principal-parent-requests', color: theme.info },
    { id: 'payments', label: t('dashboard.review_payments', { defaultValue: 'Payments' }), icon: 'card', route: '/screens/principal-fee-overview', color: theme.info },
    { id: 'fee-management', label: t('dashboard.fee_management', { defaultValue: 'Fee Management' }), icon: 'wallet', route: '/screens/admin/fee-management', color: theme.success },
    { id: 'dash-studio', label: t('dashboard.dash_studio', { defaultValue: 'Dash Studio' }), icon: 'sparkles', route: '/screens/dash-studio', color: theme.primary },
  ];

  const needsAttention: NeedsAttentionItem[] = [
    {
      id: 'pendingPayments',
      title: t('dashboard.unpaid_fees', { defaultValue: 'Unpaid Fees' }),
      value: pendingPayments,
      action: t('common.review', { defaultValue: 'Review' }),
      icon: 'cash',
      tone: pendingPayments > 0 ? 'warning' : 'success',
      route: '/screens/principal-fee-overview',
    },
    {
      id: 'pendingRegistrations',
      title: t('dashboard.new_applications', { defaultValue: 'New Applications' }),
      value: pendingRegistrations,
      action: t('common.review', { defaultValue: 'Review' }),
      icon: 'document-text',
      tone: pendingRegistrations > 0 ? 'info' : 'success',
      route: '/screens/principal-registrations',
    },
    {
      id: 'pendingPOPs',
      title: t('dashboard.payment_proofs', { defaultValue: 'POPs to Verify' }),
      value: pendingPOPs,
      action: t('dashboard.verify', { defaultValue: 'Verify' }),
      icon: 'card',
      tone: pendingPOPs > 0 ? 'warning' : 'success',
      route: '/screens/pop-review',
    },
    {
      id: 'pendingReports',
      title: t('dashboard.pending_reports', { defaultValue: 'Reports Pending' }),
      value: pendingReports,
      action: t('dashboard.review', { defaultValue: 'Review' }),
      icon: 'clipboard',
      tone: pendingReports > 0 ? 'error' : 'success',
      route: '/screens/principal-report-review',
    },
  ];

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
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.userName}>{userName}</Text>
            <Text style={styles.schoolName}>{schoolName}</Text>
            <Text style={styles.updatedAt}>
              {t('dashboard.updated_at', { defaultValue: 'Updated' })} {lastUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <TouchableOpacity style={styles.profileButton}>
            <LinearGradient colors={[theme.primary, theme.primaryLight]} style={styles.profileGradient}>
              <Text style={styles.profileInitial}>{userName?.charAt(0)?.toUpperCase() || 'P'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Today's Operations */}
        <SectionHeader
          title={t('dashboard.today_operations', { defaultValue: "Today's Operations" })}
          subtitle={t('dashboard.today_operations_subtitle', { defaultValue: 'Keep the day under control' })}
          theme={theme}
        />
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
            detail={`${pendingPayments} payments • ${pendingPOPs} POPs • ${pendingReports} reports`}
            color={theme.error}
            theme={theme}
          />
        </View>

        {/* Needs Attention */}
        <SectionHeader
          title={t('dashboard.needs_attention', { defaultValue: 'Needs Attention' })}
          subtitle={t('dashboard.action_items_hint', { defaultValue: 'Priority tasks awaiting action' })}
          theme={theme}
        />
        <View style={styles.card}>
          {needsAttention.map((item) => (
            <TriageRow
              key={item.id}
              title={`${item.value} • ${item.title}`}
              actionLabel={item.action}
              icon={item.icon}
              tone={item.tone}
              onPress={() => router.push(item.route as any)}
              theme={theme}
            />
          ))}
        </View>

        {/* Admissions & Payments */}
        <SectionHeader
          title={t('dashboard.admissions_payments', { defaultValue: 'Admissions & Payments' })}
          subtitle={t('dashboard.admissions_payments_subtitle', { defaultValue: 'Pipeline for new families' })}
          theme={theme}
        />
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

        {/* Safety & Compliance */}
        <SectionHeader
          title={t('dashboard.safety_compliance', { defaultValue: 'Safety & Compliance' })}
          subtitle={t('dashboard.safety_compliance_subtitle', { defaultValue: 'Daily checks for peace of mind' })}
          theme={theme}
        />
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

        {/* School Overview */}
        <SectionHeader
          title={t('dashboard.school_overview', { defaultValue: 'School Overview' })}
          subtitle={t('dashboard.school_overview_hint', { defaultValue: 'Snapshot of your school today' })}
          theme={theme}
        />
        <View style={styles.card}>
          <MetricInline label={t('dashboard.enrolled_students', { defaultValue: 'Enrolled Students' })} value={`${totalStudents}`} theme={theme} />
          <MetricInline label={t('dashboard.active_classes', { defaultValue: 'Active Classes' })} value={`${totalClasses}`} theme={theme} />
          <MetricInline label={t('dashboard.total_staff', { defaultValue: 'Total Staff' })} value={`${totalTeachers}`} theme={theme} />
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>{t('dashboard.capacity_usage', { defaultValue: 'Capacity Usage' })}</Text>
            <Text style={styles.progressValue}>{utilization}%</Text>
          </View>
          <ProgressBar progress={Math.min(Math.max(utilization / 100, 0), 1)} color={theme.primary} trackColor={theme.border} />
        </View>

        {/* Children In Focus */}
        <SectionHeader
          title={t('dashboard.children_in_focus', { defaultValue: 'Children In Focus' })}
          subtitle={t('dashboard.children_in_focus_subtitle', { defaultValue: 'Recent learners and profiles' })}
          actionLabel={t('common.view_all', { defaultValue: 'View All' })}
          onActionPress={() => router.push('/screens/student-management' as any)}
          theme={theme}
        />
        <View style={styles.card}>
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

        {/* Upcoming Birthdays */}
        <SectionHeader
          title={t('dashboard.upcoming_birthdays', { defaultValue: 'Upcoming Birthdays' })}
          actionLabel={t('dashboard.view_chart', { defaultValue: 'View Chart' })}
          onActionPress={() => router.push('/screens/birthday-chart' as any)}
          theme={theme}
        />
        <View style={styles.card}>
          <UpcomingBirthdaysCard
            birthdays={birthdays}
            loading={birthdaysLoading}
            showHeader={false}
            maxItems={5}
            compact
            onViewAll={() => router.push('/screens/birthday-chart' as any)}
          />
        </View>

        {/* Birthday Donations */}
        <SectionHeader
          title={t('dashboard.birthday_donations.title', { defaultValue: 'Birthday Donations' })}
          subtitle={t('dashboard.birthday_donations.principal_subtitle', { defaultValue: 'Track daily birthday pack contributions' })}
          theme={theme}
        />
        <View style={styles.card}>
          <BirthdayDonationSummaryCard organizationId={organizationId} />
        </View>

        {/* Parent Requests */}
        <SectionHeader
          title={t('dashboard.parent_requests', { defaultValue: 'Parent Requests' })}
          theme={theme}
        />
        <View style={styles.card}>
          <PendingParentLinkRequests />
        </View>

        {/* Finance Snapshot */}
        <SectionHeader
          title={t('dashboard.money_summary', { defaultValue: 'Finance Snapshot' })}
          subtitle={t('dashboard.money_summary_hint', { defaultValue: 'Registration fee collection at a glance' })}
          theme={theme}
        />
        <View style={styles.card}>
          <MetricInline label={t('dashboard.money_received', { defaultValue: 'Collected' })} value={formatCurrency(stats?.monthlyRevenue?.total)} theme={theme} />
          <MetricInline label={t('dashboard.money_owed', { defaultValue: 'Outstanding' })} value={`${pendingPayments}`} theme={theme} />
          <MetricInline label={t('dashboard.pending_approvals', { defaultValue: 'Pending Approvals' })} value={`${pendingReports}`} theme={theme} />
        </View>

        {/* Quick Actions */}
        <SectionHeader title={t('dashboard.quick_actions', { defaultValue: 'Quick Actions' })} theme={theme} />
        <View style={styles.quickActionsGrid}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={styles.quickActionCard}
              onPress={() => router.push(action.route as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: action.color + '20' }]}>
                <Ionicons name={action.icon as any} size={20} color={action.color} />
              </View>
              <Text style={styles.quickActionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading && (
          <Text style={styles.loadingText}>{t('common.loading', { defaultValue: 'Loading...' })}</Text>
        )}
      </ScrollView>
    </View>
  );
};

const SectionHeader = ({
  title,
  subtitle,
  actionLabel,
  onActionPress,
  theme,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  theme: any;
}) => (
  <View style={headerStyles.container}>
    <View style={headerStyles.titleRow}>
      <Text style={[headerStyles.title, { color: theme.text }]}>{title}</Text>
      {actionLabel && onActionPress && (
        <TouchableOpacity onPress={onActionPress}>
          <Text style={[headerStyles.action, { color: theme.primary }]}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
    {subtitle ? <Text style={[headerStyles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text> : null}
  </View>
);

const headerStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#9CA3AF',
  },
  action: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7C3AED',
  },
});

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

const TriageRow = ({
  title,
  actionLabel,
  icon,
  tone,
  onPress,
  theme,
}: {
  title: string;
  actionLabel: string;
  icon: string;
  tone: Tone;
  onPress: () => void;
  theme: any;
}) => {
  const toneColors: Record<Tone, string> = {
    info: '#3B82F6',
    warning: '#F59E0B',
    error: '#EF4444',
    success: '#10B981',
  };

  return (
    <TouchableOpacity style={[triageStyles.row, { borderBottomColor: theme.border }]} onPress={onPress} activeOpacity={0.7}>
      <View style={[triageStyles.icon, { backgroundColor: toneColors[tone] + '20' }]}>
        <Ionicons name={icon as any} size={16} color={toneColors[tone]} />
      </View>
      <Text style={[triageStyles.title, { color: theme.text }]}>{title}</Text>
      <Text style={[triageStyles.action, { color: toneColors[tone] }]}>{actionLabel}</Text>
    </TouchableOpacity>
  );
};

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
  tone: Tone;
  theme: any;
}) => {
  const toneColors: Record<Tone, string> = {
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

const triageStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  title: { flex: 1, color: '#FFFFFF', fontSize: 13 },
  action: { fontSize: 12, fontWeight: '600' },
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
      paddingBottom: insetBottom + 32,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    headerLeft: { flex: 1 },
    greeting: { fontSize: 14, color: theme.textSecondary },
    userName: { fontSize: 22, fontWeight: '700', color: theme.text },
    schoolName: { fontSize: 14, color: theme.textSecondary, marginTop: 2 },
    updatedAt: { fontSize: 12, color: theme.textTertiary, marginTop: 4 },
    profileButton: { marginLeft: 12 },
    profileGradient: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileInitial: { color: theme.onPrimary, fontWeight: '700' },
    card: {
      marginHorizontal: 16,
      marginTop: 12,
      padding: 14,
      borderRadius: 16,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    metricGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      marginTop: 8,
    },
    quickActionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      paddingHorizontal: 16,
      marginTop: 8,
    },
    quickActionCard: {
      width: '47%',
      backgroundColor: theme.surface,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    quickActionIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    quickActionLabel: { fontSize: 12, fontWeight: '600', color: theme.text },
    progressRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
      marginBottom: 4,
    },
    progressLabel: { fontSize: 12, color: theme.textSecondary },
    progressValue: { fontSize: 12, color: theme.textSecondary },
    loadingText: { textAlign: 'center', color: theme.textSecondary, marginTop: 8 },
    emptyText: { textAlign: 'center', color: theme.textSecondary, marginVertical: 8 },
  });

export default PrincipalDashboardV2;
