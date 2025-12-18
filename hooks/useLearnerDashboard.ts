import React from 'react';

import type { UseQueryResult } from '@tanstack/react-query';

import {
  useLearnerEnrollments,
  useLearnerProgress,
  useLearnerSubmissions,
  type LearnerEnrollment,
  type LearnerSubmission,
} from '@/hooks/useLearnerData';

export interface LearnerDashboardData {
  enrollments: LearnerEnrollment[];
  progress: {
    totalPrograms: number;
    completedPrograms: number;
    inProgressPrograms: number;
    avgProgress: number;
    recentSubmissionsCount: number;
    pendingSubmissions: number;
  } | null;
  submissions: LearnerSubmission[];
  draftCount: number;
  upcomingAssignments: LearnerSubmission[];
  recentActivity: LearnerSubmission[];
}

export interface UseLearnerDashboardResult {
  data: LearnerDashboardData | null;
  isLoading: boolean;
  error: unknown;
  refetchAll: () => Promise<unknown>;
  queries: {
    enrollments: UseQueryResult<LearnerEnrollment[], unknown>;
    progress: UseQueryResult<LearnerDashboardData['progress'], unknown>;
    submissions: UseQueryResult<LearnerSubmission[], unknown>;
  };
}

/**
 * Aggregated learner dashboard hook.
 *
 * Today, it composes existing learner hooks and derives:
 * - draft submission count
 * - upcoming assignment deadlines (from submission->assignment relation)
 * - recent activity (from submissions)
 *
 * When a dedicated "assignments feed" and "certificates earned" schema exists,
 * this hook is the single place to wire those in.
 */
export function useLearnerDashboard(): UseLearnerDashboardResult {
  const enrollmentsQuery = useLearnerEnrollments();
  const progressQuery = useLearnerProgress();
  const submissionsQuery = useLearnerSubmissions();

  const isLoading = enrollmentsQuery.isLoading || progressQuery.isLoading || submissionsQuery.isLoading;
  const error = enrollmentsQuery.error ?? progressQuery.error ?? submissionsQuery.error ?? null;

  const data = React.useMemo<LearnerDashboardData | null>(() => {
    const enrollments = enrollmentsQuery.data ?? [];
    const submissions = submissionsQuery.data ?? [];

    const draftCount = submissions.filter((s) => s.status === 'draft').length;

    const upcomingAssignments = getUpcomingAssignmentsFromSubmissions(submissions, 3);
    const recentActivity = submissions.slice(0, 5);

    return {
      enrollments,
      progress: progressQuery.data ?? null,
      submissions,
      draftCount,
      upcomingAssignments,
      recentActivity,
    };
  }, [enrollmentsQuery.data, progressQuery.data, submissionsQuery.data]);

  const refetchAll = React.useCallback(async () => {
    const results = await Promise.all([
      enrollmentsQuery.refetch(),
      progressQuery.refetch(),
      submissionsQuery.refetch(),
    ]);
    return results;
  }, [enrollmentsQuery, progressQuery, submissionsQuery]);

  return {
    data,
    isLoading,
    error,
    refetchAll,
    queries: {
      enrollments: enrollmentsQuery,
      progress: progressQuery,
      submissions: submissionsQuery,
    },
  };
}

function getUpcomingAssignmentsFromSubmissions(submissions: LearnerSubmission[], limit: number): LearnerSubmission[] {
  const now = Date.now();
  return submissions
    .filter((s) => !!s.assignment?.due_date)
    .map((s) => ({ s, dueAt: new Date(s.assignment!.due_date).getTime() }))
    .filter(({ dueAt }) => Number.isFinite(dueAt) && dueAt >= now)
    .sort((a, b) => a.dueAt - b.dueAt)
    .slice(0, limit)
    .map(({ s }) => s);
}



