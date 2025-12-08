/**
 * Petty Cash Workflow Service
 * 
 * Handles teacher petty cash requests, approvals, disbursements
 * For ECD centers managing small purchases and classroom supplies
 * 
 * @module PettyCashWorkflowService
 */

import { supabase } from '../../lib/supabase';
import type { PettyCashRequest, ApprovalActionParams } from './types';
import { ApprovalNotificationService } from './ApprovalNotificationService';

export class PettyCashWorkflowService {
  
  /**
   * Submit a new petty cash request
   */
  static async submitPettyCashRequest(
    preschoolId: string,
    requestedBy: string,
    requestorName: string,
    requestorRole: string,
    requestData: {
      amount: number;
      category: string;
      description: string;
      justification: string;
      urgency: 'low' | 'normal' | 'high' | 'urgent';
      budget_category_id?: string;
      estimated_total_cost?: number;
      needed_by?: string;
      receipt_required?: boolean;
    }
  ): Promise<PettyCashRequest | null> {
    try {
      // Set receipt deadline (7 days from needed_by or 7 days from now)
      const receiptDeadline = requestData.needed_by 
        ? new Date(new Date(requestData.needed_by).getTime() + 7 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('petty_cash_requests')
        .insert({
          preschool_id: preschoolId,
          requested_by: requestedBy,
          requestor_name: requestorName,
          requestor_role: requestorRole,
          ...requestData,
          receipt_required: requestData.receipt_required ?? true,
          receipt_deadline: receiptDeadline.toISOString().split('T')[0],
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        console.error('Error submitting petty cash request:', error);
        return null;
      }

      // Log the action
      await this.logAction({
        preschoolId,
        entityType: 'petty_cash_request',
        entityId: data.id,
        performedBy: requestedBy,
        performerName: requestorName,
        performerRole: requestorRole,
        action: 'submit',
        previousStatus: null,
        newStatus: 'pending',
        notes: `Petty cash request for ${requestData.description}`,
      });

      // Send notification to principal
      await ApprovalNotificationService.notifyPrincipalOfNewPettyCashRequest(data);

      return data;
    } catch (error) {
      console.error('Error in submitPettyCashRequest:', error);
      return null;
    }
  }

  /**
   * Get pending petty cash requests for principal review
   */
  static async getPendingPettyCashRequests(preschoolId: string, limit = 50): Promise<PettyCashRequest[]> {
    try {
      const { data, error } = await supabase
        .from('petty_cash_requests')
        .select('*')
        .eq('preschool_id', preschoolId)
        .in('status', ['pending', 'requires_info'])
        .order('requested_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error loading pending petty cash requests:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getPendingPettyCashRequests:', error);
      return [];
    }
  }

  /**
   * Get all petty cash requests with filters
   */
  static async getAllPettyCashRequests(
    preschoolId: string,
    options?: {
      status?: string[];
      limit?: number;
      offset?: number;
      requestorId?: string;
      urgency?: string;
    }
  ): Promise<PettyCashRequest[]> {
    try {
      let query = supabase
        .from('petty_cash_requests')
        .select('*')
        .eq('preschool_id', preschoolId)
        .order('requested_at', { ascending: false });

      if (options?.status?.length) {
        query = query.in('status', options.status);
      }

      if (options?.requestorId) {
        query = query.eq('requested_by', options.requestorId);
      }

      if (options?.urgency) {
        query = query.eq('urgency', options.urgency);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading petty cash requests:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getAllPettyCashRequests:', error);
      return [];
    }
  }

  /**
   * Approve a petty cash request
   */
  static async approvePettyCashRequest(
    requestId: string,
    approvedBy: string,
    approverName: string,
    approvedAmount?: number,
    approvalNotes?: string
  ): Promise<boolean> {
    try {
      const { data: request, error: fetchError } = await supabase
        .from('petty_cash_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError || !request) {
        console.error('Error fetching petty cash request:', fetchError);
        return false;
      }

      const finalApprovedAmount = approvedAmount ?? request.amount;

      const { data, error } = await supabase
        .from('petty_cash_requests')
        .update({
          status: 'approved',
          approved_by: approvedBy,
          approved_at: new Date().toISOString(),
          approved_amount: finalApprovedAmount,
          approval_notes: approvalNotes,
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) {
        console.error('Error approving petty cash request:', error);
        return false;
      }

      // Log the action
      await this.logAction({
        preschoolId: data.preschool_id,
        entityType: 'petty_cash_request',
        entityId: requestId,
        performedBy: approvedBy,
        performerName: approverName,
        performerRole: 'principal_admin',
        action: 'approve',
        previousStatus: 'pending',
        newStatus: 'approved',
        notes: approvalNotes,
      });

      // Send notification to teacher
      await ApprovalNotificationService.notifyTeacherPettyCashApproved(data);

      return true;
    } catch (error) {
      console.error('Error in approvePettyCashRequest:', error);
      return false;
    }
  }

  /**
   * Reject a petty cash request
   */
  static async rejectPettyCashRequest(
    requestId: string,
    rejectedBy: string,
    rejectorName: string,
    rejectionReason: string,
    approvalNotes?: string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('petty_cash_requests')
        .update({
          status: 'rejected',
          approved_by: rejectedBy,
          approved_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
          approval_notes: approvalNotes,
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) {
        console.error('Error rejecting petty cash request:', error);
        return false;
      }

      // Log the action
      await this.logAction({
        preschoolId: data.preschool_id,
        entityType: 'petty_cash_request',
        entityId: requestId,
        performedBy: rejectedBy,
        performerName: rejectorName,
        performerRole: 'principal_admin',
        action: 'reject',
        previousStatus: 'pending',
        newStatus: 'rejected',
        notes: approvalNotes,
        reason: rejectionReason,
      });

      // Send notification to teacher
      await ApprovalNotificationService.notifyTeacherPettyCashRejected(data);

      return true;
    } catch (error) {
      console.error('Error in rejectPettyCashRequest:', error);
      return false;
    }
  }

  /**
   * Mark petty cash as disbursed
   */
  static async disbursePettyCash(
    requestId: string,
    disbursedBy: string,
    disbursementMethod: 'cash' | 'bank_transfer' | 'petty_cash_float' = 'petty_cash_float'
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('petty_cash_requests')
        .update({
          status: 'disbursed',
          disbursed_by: disbursedBy,
          disbursed_at: new Date().toISOString(),
          disbursement_method: disbursementMethod,
        })
        .eq('id', requestId);

      if (error) {
        console.error('Error disbursing petty cash:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in disbursePettyCash:', error);
      return false;
    }
  }

  /**
   * Submit receipt for disbursed petty cash
   */
  static async submitReceipt(
    requestId: string,
    receiptImagePath: string,
    actualAmountSpent: number,
    changeAmount: number
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('petty_cash_requests')
        .update({
          receipt_submitted: true,
          receipt_image_path: receiptImagePath,
          actual_amount_spent: actualAmountSpent,
          change_amount: changeAmount,
          status: 'completed',
        })
        .eq('id', requestId);

      if (error) {
        console.error('Error submitting receipt:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in submitReceipt:', error);
      return false;
    }
  }

  /**
   * Get overdue receipts
   */
  static async getOverdueReceipts(preschoolId: string): Promise<PettyCashRequest[]> {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('petty_cash_requests')
        .select('*')
        .eq('preschool_id', preschoolId)
        .eq('status', 'disbursed')
        .eq('receipt_submitted', false)
        .lt('receipt_deadline', today)
        .order('receipt_deadline', { ascending: true });

      if (error) {
        console.error('Error loading overdue receipts:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getOverdueReceipts:', error);
      return [];
    }
  }

  /**
   * Log approval action for audit trail
   */
  private static async logAction(params: ApprovalActionParams): Promise<void> {
    try {
      await supabase
        .from('approval_logs')
        .insert({
          preschool_id: params.preschoolId,
          entity_type: params.entityType,
          entity_id: params.entityId,
          performed_by: params.performedBy,
          performer_name: params.performerName,
          performer_role: params.performerRole,
          action: params.action,
          previous_status: params.previousStatus,
          new_status: params.newStatus,
          notes: params.notes,
          reason: params.reason,
        });
    } catch (error) {
      console.error('Error logging approval action:', error);
    }
  }
}
