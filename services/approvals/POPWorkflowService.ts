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
import { logger } from '../../lib/logger';

export class POPWorkflowService {
  
  /**
   * Submit a new proof of payment
   * NOTE: This method uses pop_uploads table which is the actual table in the database
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
        .from('pop_uploads')
        .insert({
          preschool_id: preschoolId,
          student_id: studentId,
          uploaded_by: submittedBy,
          upload_type: 'proof_of_payment',
          title: popData.payment_purpose,
          payment_amount: popData.payment_amount,
          payment_date: popData.payment_date,
          payment_method: popData.payment_method,
          payment_reference: popData.payment_reference,
          file_path: popData.receipt_image_path || '',
          file_name: 'proof_of_payment',
          file_size: 0,
          file_type: 'image',
          status: 'pending',
        })
        .select(`
          *,
          student:students (
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
        newStatus: 'pending',
        notes: `POP submitted for ${popData.payment_purpose}`,
      });

      // Send notification to principal - map to expected format
      const popForNotification: ProofOfPayment = {
        id: data.id,
        preschool_id: data.preschool_id,
        student_id: data.student_id,
        submitted_by: data.uploaded_by,
        parent_name: popData.parent_name,
        payment_amount: data.payment_amount || 0,
        payment_date: data.payment_date || new Date().toISOString(),
        payment_method: (popData.payment_method || 'bank_transfer') as any,
        payment_purpose: data.title || 'School Fees',
        status: 'submitted',
        auto_matched: false,
        submitted_at: data.created_at,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
      await ApprovalNotificationService.notifyPrincipalOfNewPOP(popForNotification);

      return {
        ...popForNotification,
        student_name: data.student ? `${data.student.first_name} ${data.student.last_name}` : undefined,
        student_grade: data.student?.grade_level,
      };
    } catch (error) {
      console.error('Error in submitProofOfPayment:', error);
      return null;
    }
  }

  /**
   * Get POPs for principal review
   * Uses pop_uploads table with upload_type='proof_of_payment'
   */
  static async getPendingPOPs(preschoolId: string, limit = 50): Promise<ProofOfPayment[]> {
    try {
      const { data, error } = await supabase
        .from('pop_uploads')
        .select(`
          *,
          student:students (
            first_name,
            last_name,
            grade_level
          ),
          uploader:profiles!pop_uploads_uploaded_by_fkey (
            first_name,
            last_name,
            email
          )
        `)
        .eq('preschool_id', preschoolId)
        .eq('upload_type', 'proof_of_payment')
        .in('status', ['pending', 'needs_revision'])
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error loading pending POPs:', error);
        return [];
      }

      return (data || []).map(pop => ({
        id: pop.id,
        preschool_id: pop.preschool_id,
        student_id: pop.student_id,
        submitted_by: pop.uploaded_by,
        parent_name: pop.uploader ? `${pop.uploader.first_name || ''} ${pop.uploader.last_name || ''}`.trim() || 'Unknown Parent' : 'Unknown Parent',
        parent_email: pop.uploader?.email,
        payment_amount: pop.payment_amount || 0,
        payment_date: pop.payment_date || pop.created_at,
        payment_method: (pop.payment_method || 'bank_transfer') as any,
        payment_reference: pop.payment_reference,
        payment_purpose: pop.title || 'School Fees',
        receipt_image_path: pop.file_path,
        status: pop.status === 'pending' ? 'submitted' : pop.status,
        submitted_at: pop.created_at,
        created_at: pop.created_at,
        updated_at: pop.updated_at,
        auto_matched: false,
        student_name: pop.student ? `${pop.student.first_name} ${pop.student.last_name}` : 'Unknown Student',
        student_grade: pop.student?.grade_level,
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
        .from('pop_uploads')
        .select(`
          *,
          student:students (first_name, last_name, grade_level),
          uploader:profiles!pop_uploads_uploaded_by_fkey (first_name, last_name, email)
        `)
        .eq('preschool_id', preschoolId)
        .eq('upload_type', 'proof_of_payment')
        .order('created_at', { ascending: false });

      if (options?.status?.length) {
        // Map status values to pop_uploads status
        const mappedStatuses = options.status.map(s => 
          s === 'submitted' ? 'pending' : s
        );
        query = query.in('status', mappedStatuses);
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

      return (data || []).map(pop => ({
        id: pop.id,
        preschool_id: pop.preschool_id,
        student_id: pop.student_id,
        submitted_by: pop.uploaded_by,
        parent_name: pop.uploader ? `${pop.uploader.first_name || ''} ${pop.uploader.last_name || ''}`.trim() || 'Unknown Parent' : 'Unknown Parent',
        parent_email: pop.uploader?.email,
        payment_amount: pop.payment_amount || 0,
        payment_date: pop.payment_date || pop.created_at,
        payment_method: (pop.payment_method || 'bank_transfer') as any,
        payment_reference: pop.payment_reference,
        payment_purpose: pop.title || 'School Fees',
        receipt_image_path: pop.file_path,
        status: pop.status === 'pending' ? 'submitted' : pop.status,
        submitted_at: pop.created_at,
        created_at: pop.created_at,
        updated_at: pop.updated_at,
        auto_matched: false,
        student_name: pop.student ? `${pop.student.first_name} ${pop.student.last_name}` : 'Unknown Student',
        student_grade: pop.student?.grade_level,
      }));
    } catch (error) {
      console.error('Error in getAllPOPs:', error);
      return [];
    }
  }

  /**
   * Approve a proof of payment
   * Updates pop_uploads status and creates payment record for financial tracking
   */
  static async approvePOP(
    popId: string,
    approvedBy: string,
    approverName: string,
    reviewNotes?: string
  ): Promise<boolean> {
    try {
      // First, update the POP status
      const { data, error } = await supabase
        .from('pop_uploads')
        .update({
          status: 'approved',
          reviewed_by: approvedBy,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes,
        })
        .eq('id', popId)
        .select(`
          *,
          student:students (first_name, last_name),
          uploader:profiles!pop_uploads_uploaded_by_fkey (first_name, last_name, email)
        `)
        .single();

      if (error) {
        console.error('Error approving POP:', error);
        return false;
      }

      // Create payment record for financial tracking
      try {
        await this.createPaymentRecord(data, approvedBy, popId);
        logger.info('✅ Payment record created for POP approval');
      } catch (paymentError) {
        logger.error('Failed to create payment record:', paymentError);
        // Continue - don't fail the approval if payment record fails
      }

      // Update student fee status
      try {
        await this.updateFeeStatus(data);
        logger.info('✅ Student fee status updated');
      } catch (feeError) {
        logger.error('Failed to update fee status:', feeError);
        // Continue - don't fail the approval if fee update fails
      }

      // Update invoice status if applicable
      try {
        await this.updateInvoiceStatus(data);
        logger.info('✅ Invoice status updated');
      } catch (invoiceError) {
        logger.error('Failed to update invoice status:', invoiceError);
        // Continue - don't fail the approval
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
        previousStatus: 'pending',
        newStatus: 'approved',
        notes: reviewNotes,
      });

      // Get parent name for notification
      const parentName = data.uploader 
        ? `${data.uploader.first_name || ''} ${data.uploader.last_name || ''}`.trim() || 'Parent'
        : 'Parent';

      // Send notification to parent
      const popForNotification: ProofOfPayment = {
        id: data.id,
        preschool_id: data.preschool_id,
        student_id: data.student_id,
        submitted_by: data.uploaded_by,
        parent_name: parentName,
        payment_amount: data.payment_amount || 0,
        payment_date: data.payment_date || new Date().toISOString(),
        payment_method: (data.payment_method || 'bank_transfer') as any,
        payment_purpose: data.title || 'School Fees',
        status: 'approved',
        approved_at: new Date().toISOString(),
        auto_matched: false,
        submitted_at: data.created_at,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
      await ApprovalNotificationService.notifyParentPOPApproved(popForNotification);

      return true;
    } catch (error) {
      console.error('Error in approvePOP:', error);
      return false;
    }
  }

  /**
   * Create payment record for financial tracking when POP is approved
   */
  private static async createPaymentRecord(
    data: any,
    reviewerId: string,
    uploadId: string
  ): Promise<void> {
    const paymentRecord = {
      student_id: data.student_id,
      parent_id: data.uploaded_by,
      preschool_id: data.preschool_id,
      amount: data.payment_amount || 0,
      amount_cents: Math.round((data.payment_amount || 0) * 100),
      currency: 'ZAR',
      payment_method: data.payment_method || 'bank_transfer',
      payment_reference: data.payment_reference || `POP-${uploadId.slice(0, 8)}`,
      status: 'completed',
      description: data.title || 'School fees payment',
      attachment_url: data.file_path,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      submitted_at: data.created_at,
      metadata: { pop_upload_id: uploadId, payment_date: data.payment_date, auto_created: true },
    };
    
    const { error } = await supabase.from('payments').insert(paymentRecord);
    if (error) {
      logger.error('Failed to create payment record:', error);
      throw error;
    }
  }

  /**
   * Update invoice status to paid when POP is approved
   */
  private static async updateInvoiceStatus(data: any): Promise<void> {
    const paymentDate = data.payment_date ? new Date(data.payment_date) : new Date();
    const monthStart = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), 1).toISOString();
    const monthEnd = new Date(paymentDate.getFullYear(), paymentDate.getMonth() + 1, 0).toISOString();
    
    const { data: invoices } = await supabase
      .from('student_invoices')
      .select('id')
      .eq('student_id', data.student_id)
      .eq('status', 'pending')
      .gte('due_date', monthStart)
      .lte('due_date', monthEnd)
      .limit(1);
    
    if (invoices?.length) {
      await supabase
        .from('student_invoices')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', invoices[0].id);
      logger.info('✅ Invoice marked as paid');
    }
  }

  /**
   * Update student fee status to paid when POP is approved
   */
  private static async updateFeeStatus(data: any): Promise<void> {
    const paymentDate = data.payment_date ? new Date(data.payment_date) : new Date();
    const monthStart = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), 1).toISOString();
    const monthEnd = new Date(paymentDate.getFullYear(), paymentDate.getMonth() + 1, 0).toISOString();
    
    // First try to find a fee matching the payment month
    let { data: fees } = await supabase
      .from('student_fees')
      .select('id, due_date, amount, final_amount')
      .eq('student_id', data.student_id)
      .in('status', ['pending', 'overdue', 'partially_paid', 'pending_verification'])
      .gte('due_date', monthStart)
      .lte('due_date', monthEnd)
      .limit(1);
    
    // If no fee found for the payment month, get the oldest pending fee
    if (!fees?.length) {
      logger.info('[updateFeeStatus] No fee found for payment month, looking for oldest pending fee');
      const { data: oldestFees } = await supabase
        .from('student_fees')
        .select('id, due_date, amount, final_amount')
        .eq('student_id', data.student_id)
        .in('status', ['pending', 'overdue', 'partially_paid', 'pending_verification'])
        .order('due_date', { ascending: true })
        .limit(1);
      fees = oldestFees;
    }
    
    if (fees?.length) {
      const feeId = fees[0].id;
      const feeAmount = fees[0].final_amount || fees[0].amount || 0;
      const paymentAmount = data.payment_amount || 0;
      
      // Determine if fully paid or partially paid
      const newStatus = paymentAmount >= feeAmount ? 'paid' : 'partially_paid';
      
      const { error } = await supabase
        .from('student_fees')
        .update({ 
          status: newStatus, 
          paid_at: new Date().toISOString(),
          paid_amount: paymentAmount,
        })
        .eq('id', feeId);
      
      if (error) {
        logger.error('Failed to update fee status:', error);
      } else {
        logger.info(`✅ Fee ${feeId} marked as ${newStatus}`);
      }
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
        .from('pop_uploads')
        .update({
          status: 'rejected',
          reviewed_by: rejectedBy,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes ? `${rejectionReason}\n\n${reviewNotes}` : rejectionReason,
        })
        .eq('id', popId)
        .select(`
          *,
          uploader:profiles!pop_uploads_uploaded_by_fkey (first_name, last_name, email)
        `)
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
        previousStatus: 'pending',
        newStatus: 'rejected',
        notes: reviewNotes,
        reason: rejectionReason,
      });

      // Get parent name for notification
      const parentName = data.uploader 
        ? `${data.uploader.first_name || ''} ${data.uploader.last_name || ''}`.trim() || 'Parent'
        : 'Parent';

      // Send notification to parent
      const popForNotification: ProofOfPayment = {
        id: data.id,
        preschool_id: data.preschool_id,
        student_id: data.student_id,
        submitted_by: data.uploaded_by,
        parent_name: parentName,
        payment_amount: data.payment_amount || 0,
        payment_date: data.payment_date || new Date().toISOString(),
        payment_method: (data.payment_method || 'bank_transfer') as any,
        payment_purpose: data.title || 'School Fees',
        status: 'rejected',
        rejection_reason: rejectionReason,
        auto_matched: false,
        submitted_at: data.created_at,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
      await ApprovalNotificationService.notifyParentPOPRejected(popForNotification);

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
        .from('pop_uploads')
        .update({
          status: 'needs_revision',
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
        previousStatus: 'pending',
        newStatus: 'needs_revision',
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
