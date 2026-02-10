/**
 * Approval Workflow Service (Unified)
 * 
 * Provides backwards-compatible API by re-exporting from modular services
 * Use this for a unified interface, or import specific services directly
 * 
 * Services:
 * - POPWorkflowService: Proof of Payment workflows
 * - PettyCashWorkflowService: Petty cash requests
 * - ApprovalNotificationService: Push notifications
 * 
 * @module ApprovalWorkflowService
 */

import { supabase } from '../../lib/supabase';
import { withPettyCashTenant } from '@/lib/utils/pettyCashTenant';
import { FinancialDataService } from '../FinancialDataService';

// Import modular services
import { POPWorkflowService } from './POPWorkflowService';
import { PettyCashWorkflowService } from './PettyCashWorkflowService';
import { ApprovalNotificationService } from './ApprovalNotificationService';
import { writeApprovalAuditLog } from './auditLogger';

// Re-export types
export type {
  ProofOfPayment,
  PettyCashRequest,
  ProgressReport,
  ApprovalSummary,
  ApprovalActionParams,
  ApprovalEntityType,
  ApprovalAction,
} from './types';

/**
 * Unified Approval Workflow Service
 * 
 * Delegates to modular services while maintaining backwards compatibility
 */
export class ApprovalWorkflowService {
  
  // ============================================================================
  // PROOF OF PAYMENT (POP) METHODS - Delegated to POPWorkflowService
  // ============================================================================

  static submitProofOfPayment = POPWorkflowService.submitProofOfPayment.bind(POPWorkflowService);
  static getPendingPOPs = POPWorkflowService.getPendingPOPs.bind(POPWorkflowService);
  static getAllPOPs = POPWorkflowService.getAllPOPs.bind(POPWorkflowService);
  static approvePOP = POPWorkflowService.approvePOP.bind(POPWorkflowService);
  static rejectPOP = POPWorkflowService.rejectPOP.bind(POPWorkflowService);
  static requestInfoPOP = POPWorkflowService.requestInfoPOP.bind(POPWorkflowService);

  // ============================================================================
  // PETTY CASH METHODS - Delegated to PettyCashWorkflowService
  // ============================================================================

  static submitPettyCashRequest = PettyCashWorkflowService.submitPettyCashRequest.bind(PettyCashWorkflowService);
  static getPendingPettyCashRequests = PettyCashWorkflowService.getPendingPettyCashRequests.bind(PettyCashWorkflowService);
  static getAllPettyCashRequests = PettyCashWorkflowService.getAllPettyCashRequests.bind(PettyCashWorkflowService);
  static approvePettyCashRequest = PettyCashWorkflowService.approvePettyCashRequest.bind(PettyCashWorkflowService);
  static rejectPettyCashRequest = PettyCashWorkflowService.rejectPettyCashRequest.bind(PettyCashWorkflowService);
  static disbursePettyCash = PettyCashWorkflowService.disbursePettyCash.bind(PettyCashWorkflowService);
  static submitReceipt = PettyCashWorkflowService.submitReceipt.bind(PettyCashWorkflowService);
  static getOverdueReceipts = PettyCashWorkflowService.getOverdueReceipts.bind(PettyCashWorkflowService);

  // ============================================================================
  // NOTIFICATION METHODS - Delegated to ApprovalNotificationService
  // ============================================================================

  static notifyPrincipalOfNewPOP = ApprovalNotificationService.notifyPrincipalOfNewPOP.bind(ApprovalNotificationService);
  static notifyParentPOPApproved = ApprovalNotificationService.notifyParentPOPApproved.bind(ApprovalNotificationService);
  static notifyParentPOPRejected = ApprovalNotificationService.notifyParentPOPRejected.bind(ApprovalNotificationService);
  static notifyPrincipalOfNewPettyCashRequest = ApprovalNotificationService.notifyPrincipalOfNewPettyCashRequest.bind(ApprovalNotificationService);
  static notifyTeacherPettyCashApproved = ApprovalNotificationService.notifyTeacherPettyCashApproved.bind(ApprovalNotificationService);
  static notifyTeacherPettyCashRejected = ApprovalNotificationService.notifyTeacherPettyCashRejected.bind(ApprovalNotificationService);
  static notifyPrincipalOfNewReport = ApprovalNotificationService.notifyPrincipalOfNewReport.bind(ApprovalNotificationService);
  static notifyTeacherReportApproved = ApprovalNotificationService.notifyTeacherReportApproved.bind(ApprovalNotificationService);
  static notifyTeacherReportRejected = ApprovalNotificationService.notifyTeacherReportRejected.bind(ApprovalNotificationService);
  static notifyTeacherReportSent = ApprovalNotificationService.notifyTeacherReportSent.bind(ApprovalNotificationService);

  // ============================================================================
  // DASHBOARD AND SUMMARY METHODS
  // ============================================================================

  /**
   * Get approval summary for principal dashboard
   */
  static async getApprovalSummary(preschoolId: string) {
    try {
      const [popResult, pettyResult] = await Promise.all([
        supabase
          .from('pop_uploads')
          .select('id', { count: 'exact', head: true })
          .eq('preschool_id', preschoolId)
          .eq('upload_type', 'proof_of_payment')
          .in('status', ['pending', 'needs_revision', 'under_review']),
        withPettyCashTenant((column, client) =>
          client
            .from('petty_cash_transactions')
            .select('id, amount, status, receipt_url, transaction_type, description, transaction_date, created_at')
            .eq(column, preschoolId)
            .eq('type', 'expense')
            .in('status', ['pending', 'approved', 'completed'])
            .limit(2000)
        ),
      ]);

      if (popResult.error) throw popResult.error;
      if (pettyResult.error) throw pettyResult.error;

      const pettyRows = Array.isArray(pettyResult.data) ? pettyResult.data : [];
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      let pendingPettyCash = 0;
      let totalPendingAmount = 0;
      let urgentRequests = 0;
      let overdueReceipts = 0;

      for (const row of pettyRows) {
        const status = String(row?.status || '').toLowerCase();
        const amount = Math.abs(Number(row?.amount || 0));
        const urgencyText = `${row?.transaction_type || ''} ${row?.description || ''}`.toLowerCase();

        if (status === 'pending') {
          pendingPettyCash += 1;
          totalPendingAmount += amount;
        }

        if ((status === 'pending' || status === 'approved') && urgencyText.includes('urgent')) {
          urgentRequests += 1;
        }

        if (status === 'approved' && !row?.receipt_url) {
          const baseDateRaw = row?.transaction_date || row?.created_at;
          const baseDate = baseDateRaw ? new Date(baseDateRaw) : null;
          if (baseDate && !Number.isNaN(baseDate.getTime())) {
            const deadline = new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);
            if (deadline < todayStart) {
              overdueReceipts += 1;
            }
          }
        }
      }

      return {
        pending_pops: popResult.count || 0,
        pending_petty_cash: pendingPettyCash,
        total_pending_amount: totalPendingAmount,
        urgent_requests: urgentRequests,
        overdue_receipts: overdueReceipts,
      };
    } catch (error) {
      console.error('Error getting approval summary:', error);
      return {
        pending_pops: 0,
        pending_petty_cash: 0,
        total_pending_amount: 0,
        urgent_requests: 0,
        overdue_receipts: 0,
      };
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Log approval actions for audit trail
   */
  static async logApprovalAction(
    preschoolId: string,
    entityType: 'proof_of_payment' | 'petty_cash_request' | 'expense' | 'payment' | 'progress_report',
    entityId: string,
    performedBy: string,
    performerName: string,
    performerRole: string,
    action: 'submit' | 'review' | 'approve' | 'reject' | 'request_info' | 'resubmit' | 'cancel',
    previousStatus: string | null,
    newStatus: string,
    notes?: string,
    reason?: string
  ): Promise<void> {
    await writeApprovalAuditLog({
      preschoolId,
      entityType,
      entityId,
      performedBy,
      performerName,
      performerRole,
      action,
      previousStatus,
      newStatus,
      notes,
      reason,
    });
  }

  // ============================================================================
  // FORMATTING HELPERS
  // ============================================================================

  static formatCurrency = FinancialDataService.formatCurrency;

  static getStatusColor(status: string): string {
    switch (status) {
      case 'approved': 
      case 'matched': 
        return '#10B981'; // Green
      case 'pending': 
      case 'submitted': 
      case 'under_review': 
        return '#F59E0B'; // Yellow
      case 'rejected': 
        return '#EF4444'; // Red
      case 'requires_info': 
        return '#8B5CF6'; // Purple
      case 'disbursed': 
        return '#06B6D4'; // Cyan
      case 'completed': 
        return '#10B981'; // Green
      case 'urgent': 
        return '#DC2626'; // Dark red
      default: 
        return '#6B7280'; // Gray
    }
  }

  static getDisplayStatus(status: string): string {
    switch (status) {
      case 'submitted': return 'Submitted';
      case 'under_review': return 'Under Review';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'requires_info': return 'Info Required';
      case 'matched': return 'Matched';
      case 'pending': return 'Pending';
      case 'disbursed': return 'Disbursed';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return status.replace('_', ' ').toUpperCase();
    }
  }

  static getUrgencyColor(urgency: string): string {
    switch (urgency) {
      case 'urgent': return '#DC2626'; // Dark red
      case 'high': return '#F59E0B'; // Orange
      case 'normal': return '#10B981'; // Green
      case 'low': return '#6B7280'; // Gray
      default: return '#6B7280';
    }
  }
}
