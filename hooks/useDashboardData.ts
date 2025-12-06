/**
 * Dashboard Data Hooks - Index Re-exports
 *
 * This file provides backwards-compatible exports for all dashboard hooks.
 * Refactored from original 1477-line file into modular components.
 *
 * Architecture:
 * - types/dashboard.ts: Type definitions and factory functions
 * - lib/dashboard/utils.ts: Shared utility functions
 * - hooks/usePrincipalDashboard.ts: Principal-specific data fetching
 * - hooks/useTeacherDashboard.ts: Teacher-specific data fetching
 * - hooks/useParentDashboard.ts: Parent-specific data fetching
 */

// Re-export all dashboard hooks
export { usePrincipalDashboard } from './usePrincipalDashboard';
export { useTeacherDashboard } from './useTeacherDashboard';
export { useParentDashboard } from './useParentDashboard';

// Re-export all types and factory functions
export type {
  PrincipalDashboardData,
  TeacherDashboardData,
  ParentDashboardData,
  DashboardQuickStat,
  RecentActivity,
  UpcomingEvent,
  ChildData,
} from '@/types/dashboard';

export {
  createEmptyPrincipalData,
  createEmptyTeacherData,
  createEmptyParentData,
} from '@/types/dashboard';

// Re-export utility functions for consumers who need them
export {
  formatTimeAgo,
  calculateEstimatedRevenue,
  calculateAttendanceRate,
  getNextLessonTime,
  formatDueDate,
  mapActivityType,
} from '@/lib/dashboard/utils';
