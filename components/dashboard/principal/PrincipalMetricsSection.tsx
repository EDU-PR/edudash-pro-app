/**
 * Principal Dashboard - Metrics Section
 * 
 * School overview and financial metrics grids.
 */

import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
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
    classes?: { total: number };
    pendingPayments?: { total: number };
    registrationFees?: { total: number };
  };
  studentsCount?: number;
  classesCount?: number;
  collapsedSections: Set<string>;
  onToggleSection: (sectionId: string) => void;
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

  // School Overview metrics matching PWA design
  const schoolOverviewMetrics = [
    {
      id: 'students',
      title: t('dashboard.total_students', { defaultValue: 'Total Students' }),
      value: stats?.students?.total ?? studentsCount ?? 0,
      icon: 'people',
      color: '#6366F1',
      trend: 'stable' as const,
    },
    {
      id: 'enrollments',
      title: t('dashboard.active_enrollments', { defaultValue: 'Active Enrollments' }),
      value: stats?.pendingRegistrations?.total ?? 0,
      icon: 'person-add',
      color: '#10B981',
      trend: (stats?.pendingRegistrations?.total ?? 0) > 5 ? 'attention' as const : 'stable' as const,
    },
    {
      id: 'classes',
      title: t('dashboard.active_classes', { defaultValue: 'Active Classes' }),
      value: stats?.classes?.total ?? classesCount ?? 0,
      icon: 'book',
      color: '#8B5CF6',
      trend: 'stable' as const,
    },
    {
      id: 'pending_payments',
      title: t('dashboard.pending_payments', { defaultValue: 'Pending Payments' }),
      value: stats?.pendingPayments?.total ?? 0,
      icon: 'time',
      color: '#F59E0B',
      trend: (stats?.pendingPayments?.total ?? 0) > 3 ? 'attention' as const : 'stable' as const,
    },
  ];

  // Financial Summary metrics matching PWA design  
  const financialMetrics = [
    {
      id: 'fees_collected',
      title: t('dashboard.registration_fees', { defaultValue: 'Registration Fees Collected' }),
      value: `R${(stats?.registrationFees?.total ?? 0).toLocaleString()}`,
      icon: 'cash',
      color: '#10B981',
      valueColor: '#10B981',
      trend: (stats?.registrationFees?.total ?? 0) > 0 ? 'up' as const : 'stable' as const,
    },
    {
      id: 'pending_payments',
      title: t('dashboard.pending_payments', { defaultValue: 'Pending Payments' }),
      value: stats?.pendingPayments?.total ?? 0,
      icon: 'time',
      color: '#F59E0B',
      valueColor: '#F59E0B',
      trend: (stats?.pendingPayments?.total ?? 0) > 3 ? 'attention' as const : 'stable' as const,
    },
    {
      id: 'enrollments',
      title: t('dashboard.active_enrollments', { defaultValue: 'Active Enrollments' }),
      value: stats?.students?.total ?? studentsCount ?? 0,
      icon: 'person-add',
      color: '#6366F1',
      trend: 'stable' as const,
    },
    {
      id: 'events',
      title: t('dashboard.upcoming_events', { defaultValue: 'Upcoming Events' }),
      value: 0,
      icon: 'calendar',
      color: '#EC4899',
      trend: 'stable' as const,
    },
  ];

  const handleMetricPress = (metricId: string) => {
    switch (metricId) {
      case 'students':
        router.push('/screens/student-management');
        break;
      case 'enrollments':
        router.push('/screens/principal-registrations');
        break;
      case 'classes':
        router.push('/screens/class-details');
        break;
      case 'pending_payments':
      case 'fees_collected':
        router.push('/screens/financial-dashboard');
        break;
      case 'events':
        router.push('/screens/calendar');
        break;
    }
  };

  return (
    <>
      {/* School Overview Metrics */}
      <CollapsibleSection 
        title={t('dashboard.school_overview')} 
        sectionId="school-metrics" 
        icon="📊"
        defaultCollapsed={collapsedSections.has('school-metrics')}
        onToggle={onToggleSection}
      >
        <View style={styles.metricsGrid}>
          {schoolOverviewMetrics.map((metric) => (
            <MetricCard
              key={metric.id}
              title={metric.title}
              value={metric.value}
              icon={metric.icon}
              color={metric.color}
              trend={metric.trend}
              onPress={() => handleMetricPress(metric.id)}
            />
          ))}
        </View>
      </CollapsibleSection>

      {/* Financial Summary Metrics */}
      <CollapsibleSection 
        title={t('dashboard.financial_summary', { defaultValue: 'Financial Summary' })} 
        sectionId="financial-summary" 
        icon="💰"
        defaultCollapsed={collapsedSections.has('financial-summary')}
        onToggle={onToggleSection}
      >
        <View style={styles.metricsGrid}>
          {financialMetrics.map((metric) => (
            <MetricCard
              key={metric.id}
              title={metric.title}
              value={metric.value}
              icon={metric.icon}
              color={metric.color}
              valueColor={metric.valueColor}
              trend={metric.trend}
              onPress={() => handleMetricPress(metric.id)}
            />
          ))}
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
});

export default PrincipalMetricsSection;
