/**
 * POP Workflow Service
 * 
 * Handles Proof of Payment submissions, approvals, and rejections
 * For parent payment verification in ECD settings
 * 
 * @module POPWorkflowService
 */

import { supabase } from '../../lib/supabase';
import type { ProofOfPayment, ApprovalActionParams } from './types';
import { ApprovalNotificationService } from './ApprovalNotificationService';

export class POPWorkflowService {
  
  /**
   * Submit a new proof of payment
   */
  static async submitProofOfPayment(
    preschoolId: string,
    studentId: string,
    submittedBy: string,
    popData: {
      parent_name: string;
      parent_email?: string;
      parent_phone?: string;
      payment_amount: number;
      payment_date: string;
      payment_method: string;
      payment_reference?: string;
      bank_name?: string;
      account_number_last_4?: string;
      payment_purpose: string;
      fee_type?: string;
      month_year?: string;
      receipt_image_path?: string;
      bank_statement_path?: string;
    }
  ): Promise<ProofOfPayment | null> {
    try {
      const { data, error } = await supabase
        .from('proof_of_payments')
        .insert({
          preschool_id: preschoolId,
          student_id: studentId,
          submitted_by: submittedBy,
          ...popData,
          status: 'submitted',
        })
        .select(`
          *,
          students (
            first_name,
            last_name,
            grade_level
          )
        `)
        .single();

      if (error) {
        console.error('Error submitting POP:', error);
        return null;
      }

      // Log the action
      await this.logAction({
        preschoolId,
        entityType: 'proof_of_payment',
        entityId: data.id,
        performedBy: submittedBy,
        performerName: popData.parent_name,
        performerRole: 'parent',
        action: 'submit',
        previousStatus: null,
        newStatus: 'submitted',
        notes: `POP submitted for ${popData.payment_purpose}`,
      });

      // Send notification to principal
      await ApprovalNotificationService.notifyPrincipalOfNewPOP(data);

      return {
        ...data,
        student_name: data.students ? `${data.students.first_name} ${data.students.last_name}` : undefined,
        student_grade: data.students?.grade_level,
      };
    } catch (error) {
      console.error('Error in submitProofOfPayment:', error);
      return null;
    }
  }

  /**
   * Get POPs for principal review
   */
  static async getPendingPOPs(preschoolId: string, limit = 50): Promise<ProofOfPayment[]> {
    try {
      const { data, error } = await supabase
        .from('proof_of_payments')
        .select(`
          *,
          students (
            first_name,
            last_name,
            grade_level,
            parent_email,
            parent_id
          )
        `)
        .eq('preschool_id', preschoolId)
        .in('status', ['submitted', 'under_review', 'requires_info'])
        .order('submitted_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error loading pending POPs:', error);
        return [];
      }

      return data.map(pop => ({
        ...pop,
        student_name: pop.students ? `${pop.students.first_name} ${pop.students.last_name}` : 'Unknown Student',
        student_grade: pop.students?.grade_level,
      }));
    } catch (error) {
      console.error('Error in getPendingPOPs:', error);
      return [];
    }
  }

  /**
   * Get all POPs for a preschool (with optional filters)
   */
  static async getAllPOPs(
    preschoolId: string, 
    options?: { 
      status?: string[]; 
      limit?: number; 
      offset?: number;
      studentId?: string;
    }
  ): Promise<ProofOfPayment[]> {
    try {
      let query = supabase
        .from('proof_of_payments')
        .select(`
          *,
          students (first_name, last_name, grade_level)
        `)
        .eq('preschool_id', preschoolId)
        .order('submitted_at', { ascending: false });

      if (options?.status?.length) {
        query = query.in('status', options.status);
      }

      if (options?.studentId) {
        query = query.eq('student_id', options.studentId);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading POPs:', error);
        return [];
      }

      return data.map(pop => ({
        ...pop,
        student_name: pop.students ? `${pop.students.first_name} ${pop.students.last_name}` : 'Unknown Student',
        student_grade: pop.students?.grade_level,
      }));
    } catch (error) {
      console.error('Error in getAllPOPs:', error);
      return [];
    }
  }

  /**
   * Approve a proof of payment
   */
  static async approvePOP(
    popId: string,
    approvedBy: string,
    approverName: string,
    reviewNotes?: string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('proof_of_payments')
        .update({
          status: 'approved',
          reviewed_by: approvedBy,
          reviewed_at: new Date().toISOString(),
          approved_at: new Date().toISOString(),
          review_notes: reviewNotes,
        })
        .eq('id', popId)
        .select()
        .single();

      if (error) {
        console.error('Error approving POP:', error);
        return false;
      }

      // Log the action
      await this.logAction({
        preschoolId: data.preschool_id,
        entityType: 'proof_of_payment',
        entityId: popId,
        performedBy: approvedBy,
        performerName: approverName,
        performerRole: 'principal_admin',
        action: 'approve',
        previousStatus: 'submitted',
        newStatus: 'approved',
        notes: reviewNotes,
      });

      // Send notification to parent
      await ApprovalNotificationService.notifyParentPOPApproved(data);

      return true;
    } catch (error) {
      console.error('Error in approvePOP:', error);
      return false;
    }
  }

  /**
   * Reject a proof of payment
   */
  static async rejectPOP(
    popId: string,
    rejectedBy: string,
    rejectorName: string,
    rejectionReason: string,
    reviewNotes?: string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('proof_of_payments')
        .update({
          status: 'rejected',
          reviewed_by: rejectedBy,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
          review_notes: reviewNotes,
        })
        .eq('id', popId)
        .select()
        .single();

      if (error) {
        console.error('Error rejecting POP:', error);
        return false;
      }

      // Log the action
      await this.logAction({
        preschoolId: data.preschool_id,
        entityType: 'proof_of_payment',
        entityId: popId,
        performedBy: rejectedBy,
        performerName: rejectorName,
        performerRole: 'principal_admin',
        action: 'reject',
        previousStatus: 'submitted',
        newStatus: 'rejected',
        notes: reviewNotes,
        reason: rejectionReason,
      });

      // Send notification to parent
      await ApprovalNotificationService.notifyParentPOPRejected(data);

      return true;
    } catch (error) {
      console.error('Error in rejectPOP:', error);
      return false;
    }
  }

  /**
   * Request more info for a POP
   */
  static async requestInfoPOP(
    popId: string,
    requestedBy: string,
    requestorName: string,
    infoNeeded: string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('proof_of_payments')
        .update({
          status: 'requires_info',
          reviewed_by: requestedBy,
          reviewed_at: new Date().toISOString(),
          review_notes: infoNeeded,
        })
        .eq('id', popId)
        .select()
        .single();

      if (error) {
        console.error('Error requesting info for POP:', error);
        return false;
      }

      await this.logAction({
        preschoolId: data.preschool_id,
        entityType: 'proof_of_payment',
        entityId: popId,
        performedBy: requestedBy,
        performerName: requestorName,
        performerRole: 'principal_admin',
        action: 'request_info',
        previousStatus: 'submitted',
        newStatus: 'requires_info',
        notes: infoNeeded,
      });

      return true;
    } catch (error) {
      console.error('Error in requestInfoPOP:', error);
      return false;
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
