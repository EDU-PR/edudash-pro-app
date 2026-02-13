/**
 * Principal Dashboard - Metrics Section
 * 
 * School overview and financial metrics grids.
 * Redesigned for clarity - numbers should be self-explanatory.
 */

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { MetricCard } from '../shared/MetricCard';
import { CollapsibleSection } from '../shared/CollapsibleSection';

const { width } = Dimensions.get('window');
const isTablet = width > 768;
const isSmallScreen = width < 380;
const cardPadding = isTablet ? 20 : isSmallScreen ? 10 : 14;
const cardGap = isTablet ? 12 : isSmallScreen ? 6 : 8;

interface PrincipalMetricsSectionProps {
  stats: {
    students?: { total: number };
    pendingRegistrations?: { total: number };
    pendingApplications?: { total: number };
    classes?: { total: number };
    pendingPayments?: { total: number };
    pendingPOPUploads?: { total: number };
    registrationFees?: { total: number };
    staff?: { total: number };
    attendanceRate?: { percentage: number };
  };
  studentsCount?: number;
  classesCount?: number;
  collapsedSections: Set<string>;
  onToggleSection: (sectionId: string, isCollapsed?: boolean) => void;
}

export const PrincipalMetricsSection: React.FC<PrincipalMetricsSectionProps> = ({
  stats,
  studentsCount = 0,
  classesCount = 0,
  collapsedSections,
  onToggleSection,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = createStyles(theme);

  // Calculate derived values for clarity
  const totalStudents = stats?.students?.total ?? studentsCount ?? 0;
  const totalClasses = stats?.classes?.total ?? classesCount ?? 0;
  const pendingRegistrations = stats?.pendingRegistrations?.total ?? 0;
  const pendingPayments = stats?.pendingPayments?.total ?? 0;
  const pendingPOPUploads = stats?.pendingPOPUploads?.total ?? 0;
  const feesCollected = stats?.registrationFees?.total ?? 0;
  const totalStaff = stats?.staff?.total ?? 0;
  const attendanceRate = stats?.attendanceRate?.percentage ?? 0;

  // ═══════════════════════════════════════════════════════════════
  // SCHOOL OVERVIEW - Your School at a Glance
  // These numbers answer: "How big is my school?"
  // ═══════════════════════════════════════════════════════════════
  const schoolOverviewMetrics = [
    {
      id: 'students',
      title: t('dashboard.enrolled_students', { defaultValue: 'Enrolled Students' }),
      subtitle: t('dashboard.enrolled_students_hint', { defaultValue: 'Currently active' }),
      value: totalStudents,
      icon: 'people',
      color: '#6366F1', // Indigo - represents students
      trend: 'stable' as const,
    },
    {
      id: 'classes',
      title: t('dashboard.active_classes', { defaultValue: 'Active Classes' }),
      subtitle: t('dashboard.active_classes_hint', { defaultValue: 'Running classrooms' }),
      value: totalClasses,
      icon: 'school',
      color: '#8B5CF6', // Purple - represents learning
      trend: 'stable' as const,
    },
    {
      id: 'staff',
      title: t('dashboard.total_staff', { defaultValue: 'Teachers' }),
      subtitle: t('dashboard.total_staff_hint', { defaultValue: 'Active teaching staff' }),
      value: totalStaff,
      icon: 'person-circle',
      color: '#0EA5E9', // Sky blue - represents teachers
      trend: 'stable' as const,
    },
    {
      id: 'attendance',
      title: t('dashboard.attendance_rate', { defaultValue: 'Attendance' }),
      subtitle: t('dashboard.attendance_hint', { defaultValue: 'Last 30 days average' }),
      value: attendanceRate > 0 ? `${attendanceRate}%` : '—',
      icon: 'checkmark-circle',
      color: attendanceRate >= 85 ? '#10B981' : attendanceRate >= 70 ? '#F59E0B' : '#EF4444',
      trend: attendanceRate >= 85 ? 'up' as const : attendanceRate >= 70 ? 'stable' as const : 'attention' as const,
    },
  ];

  // ═══════════════════════════════════════════════════════════════
  // ACTION ITEMS - Things That Need Your Attention
  // These numbers answer: "What do I need to do?"
  // ═══════════════════════════════════════════════════════════════
  const actionItemsMetrics = [
    {
      id: 'pending_registrations',
      title: t('dashboard.new_applications', { defaultValue: 'New Applications' }),
      subtitle: t('dashboard.new_applications_hint', { defaultValue: 'Awaiting your review' }),
      value: pendingRegistrations,
      icon: 'person-add',
      color: '#6366F1', // Indigo
      trend: pendingRegistrations > 5 ? 'attention' as const : pendingRegistrations > 0 ? 'up' as const : 'stable' as const,
      badge: pendingRegistrations > 0 ? pendingRegistrations : undefined,
    },
    {
      id: 'pending_payments',
      title: t('dashboard.unpaid_fees', { defaultValue: 'Unpaid Fees' }),
      subtitle: t('dashboard.unpaid_fees_hint', { defaultValue: 'Parents with outstanding balance' }),
      value: pendingPayments,
      icon: 'alert-circle',
      color: pendingPayments > 3 ? '#EF4444' : '#F59E0B', // Red if many, yellow otherwise
      trend: pendingPayments > 3 ? 'attention' as const : pendingPayments > 0 ? 'stable' as const : 'up' as const,
      badge: pendingPayments > 0 ? pendingPayments : undefined,
    },
    {
      id: 'pop_uploads',
      title: t('dashboard.payment_proofs', { defaultValue: 'Payment Proofs' }),
      subtitle: t('dashboard.payment_proofs_hint', { defaultValue: 'POPs to verify' }),
      value: pendingPOPUploads,
      icon: 'document-text',
      color: '#8B5CF6', // Purple
      trend: pendingPOPUploads > 0 ? 'attention' as const : 'stable' as const,
      badge: pendingPOPUploads > 0 ? pendingPOPUploads : undefined,
    },
  ];

  // ═══════════════════════════════════════════════════════════════
  // MONEY SUMMARY - Simple Financial Picture
  // These numbers answer: "How's the money situation?"
  // ═══════════════════════════════════════════════════════════════
  const financialMetrics = [
    {
      id: 'fees_collected',
      title: t('dashboard.money_received', { defaultValue: 'Money Received' }),
      subtitle: t('dashboard.money_received_hint', { defaultValue: 'Total registration fees paid' }),
      value: `R${feesCollected.toLocaleString()}`,
      icon: 'checkmark-done-circle',
      color: '#10B981', // Green - money in
      valueColor: '#10B981',
      trend: feesCollected > 0 ? 'up' as const : 'stable' as const,
    },
    {
      id: 'outstanding',
      title: t('dashboard.money_owed', { defaultValue: 'Money Owed' }),
      subtitle: t('dashboard.money_owed_hint', { defaultValue: `${pendingPayments} ${pendingPayments === 1 ? 'family' : 'families'} haven't paid` }),
      // Show actual outstanding if we have fee data, otherwise show count
      value: pendingPayments > 0 ? `${pendingPayments} pending` : 'All paid ✓',
      icon: 'time-outline',
      color: pendingPayments > 0 ? '#F59E0B' : '#10B981', // Yellow if pending, green if all paid
      valueColor: pendingPayments > 0 ? '#F59E0B' : '#10B981',
      trend: pendingPayments > 3 ? 'attention' as const : 'stable' as const,
    },
  ];

  const handleMetricPress = (metricId: string) => {
    switch (metricId) {
      case 'students':
        router.push('/screens/student-management');
        break;
      case 'classes':
        router.push('/screens/class-teacher-management');
        break;
      case 'staff':
        router.push('/screens/teacher-management');
        break;
      case 'attendance':
        router.push('/screens/attendance-history');
        break;
      case 'pending_registrations':
        router.push('/screens/principal-registrations');
        break;
      case 'pending_payments':
      case 'outstanding':
        router.push('/screens/finance-control-center?tab=receivables');
        break;
      case 'pop_uploads':
        try {
          router.push('/screens/pop-review' as any);
        } catch (_error) {
          // Navigation to pop-review failed silently
        }
        break;
      case 'fees_collected':
        router.push('/screens/finance-control-center?tab=overview');
        break;
    }
  };

  return (
    <>
      {/* ════════════════════════════════════════════════════════════════
          SCHOOL OVERVIEW - "Your School at a Glance"
          Shows: How big is my school?
          ════════════════════════════════════════════════════════════════ */}
      <CollapsibleSection 
        title={t('dashboard.your_school', { defaultValue: 'Your School' })}
        sectionId="school-metrics" 
        icon="🏫"
        hint={t('dashboard.school_overview_hint', { defaultValue: 'A snapshot of your school today' })}
        defaultCollapsed={collapsedSections.has('school-metrics')}
        onToggle={onToggleSection}
      >
        <Text style={styles.sectionHint}>
          {t('dashboard.school_overview_hint', { defaultValue: 'A snapshot of your school today' })}
        </Text>
        <View style={styles.metricsGrid}>
          {schoolOverviewMetrics.map((metric) => (
            <MetricCard
              key={metric.id}
              title={metric.title}
              subtitle={metric.subtitle}
              value={metric.value}
              icon={metric.icon}
              color={metric.color}
              trend={metric.trend}
              onPress={() => handleMetricPress(metric.id)}
            />
          ))}
        </View>
      </CollapsibleSection>

      {/* ════════════════════════════════════════════════════════════════
          ACTION ITEMS - "Things That Need Attention"
          Shows: What do I need to do?
          ════════════════════════════════════════════════════════════════ */}
      <CollapsibleSection 
        title={t('dashboard.needs_attention', { defaultValue: 'Needs Attention' })}
        sectionId="action-items" 
        icon="⚡"
        hint={t('dashboard.action_items_hint', { defaultValue: 'Tasks waiting for your action' })}
        defaultCollapsed={collapsedSections.has('action-items')}
        onToggle={onToggleSection}
      >
        <Text style={styles.sectionHint}>
          {t('dashboard.action_items_hint', { defaultValue: 'Tasks waiting for your action' })}
        </Text>
        <View style={styles.metricsGrid}>
          {actionItemsMetrics.map((metric) => (
            <MetricCard
              key={metric.id}
              title={metric.title}
              subtitle={metric.subtitle}
              value={metric.value}
              icon={metric.icon}
              color={metric.color}
              trend={metric.trend}
              badge={metric.badge}
              onPress={() => handleMetricPress(metric.id)}
            />
          ))}
        </View>
      </CollapsibleSection>

      {/* ════════════════════════════════════════════════════════════════
          MONEY SUMMARY - "Simple Financial Picture"
          Shows: How's the money situation?
          ════════════════════════════════════════════════════════════════ */}
      <CollapsibleSection 
        title={t('dashboard.money_summary', { defaultValue: 'Money Summary' })}
        sectionId="financial-summary" 
        icon="💰"
        hint={t('dashboard.money_summary_hint', { defaultValue: 'Registration fee collection at a glance' })}
        defaultCollapsed={collapsedSections.has('financial-summary')}
        onToggle={onToggleSection}
      >
        <Text style={styles.sectionHint}>
          {t('dashboard.money_summary_hint', { defaultValue: 'Your registration fee collection at a glance' })}
        </Text>
        <View style={styles.financialRow}>
          {financialMetrics.map((metric) => (
            <MetricCard
              key={metric.id}
              title={metric.title}
              subtitle={metric.subtitle}
              value={metric.value}
              icon={metric.icon}
              color={metric.color}
              valueColor={metric.valueColor}
              trend={metric.trend}
              onPress={() => handleMetricPress(metric.id)}
            />
          ))}
        </View>
        {/* Simple explanation for non-financial users */}
        <View style={styles.financialExplainer}>
          <Text style={styles.explainerText}>
            💡 {t('dashboard.financial_tip', { 
              defaultValue: feesCollected > 0 && pendingPayments === 0 
                ? 'Great job! All families have paid their registration fees.'
                : pendingPayments > 0
                  ? `${pendingPayments} ${pendingPayments === 1 ? 'family still needs' : 'families still need'} to pay. Tap "Payment Proofs" above to verify any submitted payments.`
                  : 'Registration fees will appear here once families start enrolling.'
            })}
          </Text>
        </View>
      </CollapsibleSection>
    </>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -cardGap / 2,
  },
  financialRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -cardGap / 2,
  },
  sectionHint: {
    fontSize: isSmallScreen ? 12 : 13,
    color: theme.textSecondary,
    marginBottom: isSmallScreen ? 8 : 12,
    fontStyle: 'italic',
  },
  financialExplainer: {
    marginTop: isSmallScreen ? 12 : 16,
    padding: isSmallScreen ? 10 : 12,
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: theme.primary,
  },
  explainerText: {
    fontSize: isSmallScreen ? 12 : 13,
    color: theme.textSecondary,
    lineHeight: isSmallScreen ? 18 : 20,
  },
});

export default PrincipalMetricsSection;
