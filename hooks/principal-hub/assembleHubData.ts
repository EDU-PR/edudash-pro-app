/**
 * Principal Hub — Data Assembly
 *
 * Pure functions that assemble raw query results into the typed
 * dashboard shapes (SchoolStats, CapacityMetrics, EnrollmentPipeline).
 *
 * @module hooks/principal-hub/assembleHubData
 */

import type {
  SchoolStats,
  CapacityMetrics,
  EnrollmentPipeline,
} from './types';
import type { StatsRawResult } from './fetchStatsAndCounts';

type TFunc = (key: string, opts?: Record<string, any>) => string;

/**
 * Build the SchoolStats card values from raw counts + revenue.
 */
export function buildSchoolStats(
  raw: StatsRawResult,
  monthlyRevenue: number,
  previousMonthRevenue: number,
  registrationFeesCollected: number,
  t: TFunc,
): SchoolStats {
  return {
    students: {
      total: raw.studentsCount,
      trend:
        raw.studentsCount > 20
          ? t('trends.up')
          : raw.studentsCount > 10
            ? t('trends.stable')
            : t('trends.low'),
    },
    staff: {
      total: raw.teachersData.length,
      trend: raw.teachersData.length >= 5 ? t('trends.stable') : t('trends.needs_attention'),
    },
    classes: {
      total: raw.classesCount,
      trend:
        raw.classesCount >= raw.studentsCount / 8 ? t('trends.stable') : t('trends.up'),
    },
    pendingApplications: {
      total: raw.applicationsCount,
      trend:
        raw.applicationsCount > 5
          ? t('trends.high')
          : raw.applicationsCount > 2
            ? t('trends.up')
            : t('trends.stable'),
    },
    pendingRegistrations: {
      total: raw.pendingRegistrationsCount,
      trend:
        raw.pendingRegistrationsCount > 5
          ? t('trends.high')
          : raw.pendingRegistrationsCount > 2
            ? t('trends.up')
            : t('trends.stable'),
    },
    pendingPayments: {
      total: raw.combinedPendingPayments,
      amount: raw.pendingPaymentsAmount,
      overdueAmount: raw.pendingPaymentsOverdueAmount,
      trend:
        raw.combinedPendingPayments > 5
          ? t('trends.high')
          : raw.combinedPendingPayments > 2
            ? t('trends.up')
            : t('trends.stable'),
    },
    pendingPOPUploads: {
      total: raw.pendingPOPUploadsCount,
      trend:
        raw.pendingPOPUploadsCount > 3
          ? t('trends.high')
          : raw.pendingPOPUploadsCount > 0
            ? t('trends.up')
            : t('trends.stable'),
    },
    registrationFees: {
      total: registrationFeesCollected,
      trend: registrationFeesCollected > 0 ? t('trends.up') : t('trends.stable'),
    },
    monthlyRevenue: {
      total: monthlyRevenue,
      trend:
        monthlyRevenue > previousMonthRevenue
          ? t('trends.up')
          : monthlyRevenue < previousMonthRevenue
            ? t('trends.down')
            : t('trends.stable'),
    },
    attendanceRate: {
      percentage: raw.attendanceRate || 0,
      trend:
        raw.attendanceRate >= 90
          ? t('trends.excellent')
          : raw.attendanceRate >= 80
            ? t('trends.good')
            : t('trends.needs_attention'),
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build capacity metrics from raw counts + preschool info.
 */
export function buildCapacityMetrics(
  studentsCount: number,
  preschoolCapacity: any,
): CapacityMetrics {
  const cap = preschoolCapacity?.capacity || 60;
  const utilisation = Math.round((studentsCount / cap) * 100);

  return {
    capacity: cap,
    current_enrollment: studentsCount,
    available_spots: cap - studentsCount,
    utilization_percentage: utilisation,
    enrollment_by_age: {
      toddlers: Math.round(studentsCount * 0.3),
      preschool: Math.round(studentsCount * 0.4),
      prekindergarten: Math.round(studentsCount * 0.3),
    },
    status:
      studentsCount >= cap * 0.9
        ? 'full'
        : studentsCount >= cap * 0.7
          ? 'high'
          : 'available',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build enrollment pipeline from application counts.
 */
export function buildEnrollmentPipeline(
  raw: Pick<StatsRawResult, 'applicationsCount' | 'approvedCount' | 'rejectedCount' | 'waitlistedCount'>,
): EnrollmentPipeline {
  return {
    pending: raw.applicationsCount,
    approved: raw.approvedCount,
    rejected: raw.rejectedCount,
    waitlisted: raw.waitlistedCount,
    total:
      raw.applicationsCount + raw.approvedCount + raw.rejectedCount + raw.waitlistedCount,
  };
}
