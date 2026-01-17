// Custom hook for report review - WARP.md compliant (≤200 lines)

import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ProgressReportService, type ProgressReport } from '@/services/ProgressReportService';
import { notifyReportApproved, notifyReportRejected } from '@/services/notification-service';
import type { ReportReviewState, ReportReviewActions } from '@/components/principal/report-review/types';
import { INITIAL_REVIEW_STATE } from '@/components/principal/report-review/types';

interface UseReportReviewProps {
  schoolId: string | null;
  userId: string | undefined;
}

interface UseReportReviewReturn extends ReportReviewState, ReportReviewActions {
  reports: ProgressReport[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  isApproving: boolean;
  isRejecting: boolean;
}

export function useReportReview({ schoolId, userId }: UseReportReviewProps): UseReportReviewReturn {
  const queryClient = useQueryClient();
  const [state, setState] = useState<ReportReviewState>(INITIAL_REVIEW_STATE);

  // Fetch pending reports
  const { data: reports = [], isLoading, error, refetch } = useQuery({
    queryKey: ['pending-reports', schoolId],
    queryFn: async () => {
      if (!schoolId || !userId) return [];
      return ProgressReportService.getReportsForReview(schoolId, userId);
    },
    enabled: !!schoolId && !!userId,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  // Real-time subscription
  useEffect(() => {
    if (!schoolId) return;
    const channel = supabase
      .channel('progress_reports_changes')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'progress_reports',
        filter: `preschool_id=eq.${schoolId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['pending-reports', schoolId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [schoolId, queryClient]);

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!state.selectedReport || !state.principalSignature || !schoolId || !userId) {
        throw new Error('Missing required data');
      }
      const success = await ProgressReportService.approveReport(
        state.selectedReport.id, schoolId, userId,
        state.principalSignature, state.approvalNotes || undefined
      );
      if (!success) throw new Error('Failed to approve report');
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['pending-reports', schoolId] });
      if (state.selectedReport && schoolId) {
        try {
          await notifyReportApproved(state.selectedReport.id, state.selectedReport.student_id, schoolId);
        } catch { /* non-fatal */ }
      }
      setState(INITIAL_REVIEW_STATE);
      Alert.alert('Success', 'Report approved successfully. Teacher has been notified.');
    },
    onError: (error: Error) => Alert.alert('Error', `Failed to approve: ${error.message}`),
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!state.selectedReport || !state.rejectionReason.trim() || !schoolId || !userId) {
        throw new Error('Missing required data');
      }
      if (state.rejectionReason.trim().length < 10) {
        throw new Error('Rejection reason must be at least 10 characters');
      }
      const success = await ProgressReportService.rejectReport(
        state.selectedReport.id, schoolId, userId,
        state.rejectionReason, state.approvalNotes || undefined
      );
      if (!success) throw new Error('Failed to reject report');
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['pending-reports', schoolId] });
      if (state.selectedReport && schoolId && state.rejectionReason) {
        try {
          await notifyReportRejected(state.selectedReport.id, state.selectedReport.student_id, schoolId, state.rejectionReason);
        } catch { /* non-fatal */ }
      }
      setState(INITIAL_REVIEW_STATE);
      Alert.alert('Success', 'Report rejected. Teacher has been notified.');
    },
    onError: (error: Error) => Alert.alert('Error', `Failed to reject: ${error.message}`),
  });

  // Handlers
  const handleReportPress = useCallback((report: ProgressReport) => {
    setState(prev => ({ ...prev, selectedReport: report }));
  }, []);

  const handleApprovePress = useCallback(() => {
    setState(prev => ({ ...prev, showApproveModal: true }));
  }, []);

  const handleRejectPress = useCallback(() => {
    setState(prev => ({ ...prev, showRejectModal: true }));
  }, []);

  const handleSignatureSaved = useCallback((signature: string) => {
    setState(prev => ({ ...prev, principalSignature: signature, showSignaturePad: false }));
  }, []);

  const handleConfirmApprove = useCallback(() => {
    if (!state.principalSignature) {
      Alert.alert('Signature Required', 'Please sign before approving the report.');
      return;
    }
    approveMutation.mutate();
  }, [state.principalSignature, approveMutation]);

  const handleConfirmReject = useCallback(() => {
    if (!state.rejectionReason.trim() || state.rejectionReason.trim().length < 10) {
      Alert.alert('Reason Required', 'Please provide a rejection reason (minimum 10 characters).');
      return;
    }
    rejectMutation.mutate();
  }, [state.rejectionReason, rejectMutation]);

  const handleCloseDetail = useCallback(() => {
    setState(INITIAL_REVIEW_STATE);
  }, []);

  return {
    ...state,
    reports,
    isLoading,
    error: error as Error | null,
    refetch,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    handleReportPress,
    handleApprovePress,
    handleRejectPress,
    handleSignatureSaved,
    handleConfirmApprove,
    handleConfirmReject,
    handleCloseDetail,
    setShowApproveModal: (show) => setState(prev => ({ ...prev, showApproveModal: show })),
    setShowRejectModal: (show) => setState(prev => ({ ...prev, showRejectModal: show })),
    setShowSignaturePad: (show) => setState(prev => ({ ...prev, showSignaturePad: show })),
    setApprovalNotes: (notes) => setState(prev => ({ ...prev, approvalNotes: notes })),
    setRejectionReason: (reason) => setState(prev => ({ ...prev, rejectionReason: reason })),
  };
}
