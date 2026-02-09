/**
 * usePrincipalHub — Backward-compatible re-export
 *
 * The implementation has been modularised into `hooks/principal-hub/`.
 * This file is kept so existing `import { usePrincipalHub } from '@/hooks/usePrincipalHub'`
 * statements continue to resolve without changes.
 *
 * @see hooks/principal-hub/index.ts
 */

export {
  usePrincipalHub,
  getPendingReportCount,
} from './principal-hub';

export type {
  SchoolStats,
  TeacherSummary,
  FinancialSummary,
  UniformPaymentSummary,
  CapacityMetrics,
  EnrollmentPipeline,
  ActivitySummary,
  PrincipalHubData,
} from './principal-hub';
