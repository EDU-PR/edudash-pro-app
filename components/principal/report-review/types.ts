// Types for Report Review

import type { ProgressReport } from '@/services/ProgressReportService';

export type { ProgressReport };

export interface ReportReviewState {
  selectedReport: ProgressReport | null;
  showApproveModal: boolean;
  showRejectModal: boolean;
  showSignaturePad: boolean;
  principalSignature: string;
  approvalNotes: string;
  rejectionReason: string;
}

export interface ReportReviewActions {
  handleReportPress: (report: ProgressReport) => void;
  handleApprovePress: () => void;
  handleRejectPress: () => void;
  handleSignatureSaved: (signature: string) => void;
  handleConfirmApprove: () => void;
  handleConfirmReject: () => void;
  handleCloseDetail: () => void;
  setShowApproveModal: (show: boolean) => void;
  setShowRejectModal: (show: boolean) => void;
  setShowSignaturePad: (show: boolean) => void;
  setApprovalNotes: (notes: string) => void;
  setRejectionReason: (reason: string) => void;
}

export const INITIAL_REVIEW_STATE: ReportReviewState = {
  selectedReport: null,
  showApproveModal: false,
  showRejectModal: false,
  showSignaturePad: false,
  principalSignature: '',
  approvalNotes: '',
  rejectionReason: '',
};

export const PRINCIPAL_ROLES = ['principal', 'principal_admin', 'superadmin'];
