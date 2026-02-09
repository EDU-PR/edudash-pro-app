/**
 * buildMetrics – produces the metric cards shown on the Principal dashboard.
 *
 * Extracted to keep the orchestrator hook under the ≤200-line WARP limit.
 * @module hooks/principal-hub/buildMetrics
 */

import { formatCurrencyCompact } from '@/lib/utils/payment-utils';
import type { SchoolStats } from './types';

export interface MetricCard {
  id: string;
  title: string;
  value: string | number;
  icon: string;
  color: string;
  trend: string;
}

type TFn = (key: string, opts?: Record<string, unknown>) => string;

export function buildMetrics(stats: SchoolStats, t: TFn): MetricCard[] {
  return [
    { id: 'students', title: t('metrics.total_students'), value: stats.students.total, icon: 'people-outline', color: '#4F46E5', trend: stats.students.trend },
    { id: 'registrations', title: t('metrics.pending_registrations', { defaultValue: 'Pending Registrations' }), value: stats.pendingRegistrations.total, icon: 'person-add-outline', color: '#10B981', trend: stats.pendingRegistrations.trend },
    { id: 'classes', title: t('metrics.active_classes', { defaultValue: 'Active Classes' }), value: stats.classes.total, icon: 'library-outline', color: '#7C3AED', trend: stats.classes.trend },
    { id: 'payments', title: t('metrics.pending_payments', { defaultValue: 'Pending Payments' }), value: stats.pendingPayments.total, icon: 'wallet-outline', color: '#F59E0B', trend: stats.pendingPayments.trend },
    { id: 'staff', title: t('metrics.teaching_staff'), value: stats.staff.total, icon: 'school-outline', color: '#059669', trend: stats.staff.trend },
    { id: 'registration_fees', title: t('metrics.registration_fees', { defaultValue: 'Registration Fees' }), value: formatCurrencyCompact(stats.registrationFees?.total || 0), icon: 'cash-outline', color: '#10B981', trend: stats.registrationFees?.trend || 'stable' },
    { id: 'attendance', title: t('metrics.attendance_rate'), value: `${stats.attendanceRate.percentage}%`, icon: 'checkmark-circle-outline', color: stats.attendanceRate.percentage >= 90 ? '#059669' : '#DC2626', trend: stats.attendanceRate.trend },
    { id: 'applications', title: t('metrics.pending_applications', { defaultValue: 'Pending Applications' }), value: stats.pendingApplications.total, icon: 'document-text-outline', color: '#EC4899', trend: stats.pendingApplications.trend },
  ];
}
