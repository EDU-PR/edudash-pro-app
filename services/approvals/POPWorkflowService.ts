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
import { writeApprovalAuditLog } from './auditLogger';

export class POPWorkflowService {
  // NOTE: pop_uploads.uploaded_by has an FK to auth.users (not exposed via PostgREST),
  // so we cannot embed uploader data via a `profiles!pop_uploads_uploaded_by_fkey` join.
  // Instead, we fetch profiles separately (same approach as PettyCashWorkflowService).
  private static async loadProfilesForUploaders(uploaderIds: string[]): Promise<Map<string, { id: string; auth_user_id?: string | null; first_name?: string | null; last_name?: string | null; email?: string | null }>> {
    const ids = Array.from(new Set(uploaderIds.filter(Boolean)));
    const map = new Map<string, { id: string; auth_user_id?: string | null; first_name?: string | null; last_name?: string | null; email?: string | null }>();
    if (!ids.length) return map;

    const byId = await supabase
      .from('profiles')
      .select('id, auth_user_id, first_name, last_name, email')
      .in('id', ids);

    if (Array.isArray(byId.data)) {
      byId.data.forEach((p: any) => {
        if (p?.id) map.set(String(p.id), p);
        if (p?.auth_user_id) map.set(String(p.auth_user_id), p);
      });
    }

    const unresolved = ids.filter((id) => !map.has(id));
    if (!unresolved.length) return map;

    const byAuth = await supabase
      .from('profiles')
      .select('id, auth_user_id, first_name, last_name, email')
      .in('auth_user_id', unresolved as any);

    if (Array.isArray(byAuth.data)) {
      byAuth.data.forEach((p: any) => {
        if (p?.id) map.set(String(p.id), p);
        if (p?.auth_user_id) map.set(String(p.auth_user_id), p);
      });
    }

    return map;
  }
  
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
      payment_for_month?: string;
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
          payment_for_month: popData.payment_for_month || popData.payment_date,
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
        payment_for_month: data.payment_for_month || data.payment_date || new Date().toISOString(),
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

      const rows = Array.isArray(data) ? data : [];
      const profiles = await this.loadProfilesForUploaders(rows.map((row: any) => String(row?.uploaded_by || '')));

      return rows.map((pop: any) => {
        const uploader = profiles.get(String(pop?.uploaded_by || ''));
        const parentName = uploader
          ? `${uploader.first_name || ''} ${uploader.last_name || ''}`.trim() || 'Unknown Parent'
          : 'Unknown Parent';

        return ({
        id: pop.id,
        preschool_id: pop.preschool_id,
        student_id: pop.student_id,
        submitted_by: pop.uploaded_by,
        parent_name: parentName,
        parent_email: uploader?.email || undefined,
        payment_amount: pop.payment_amount || 0,
        payment_date: pop.payment_date || pop.created_at,
        payment_for_month: pop.payment_for_month || pop.payment_date || pop.created_at,
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
      });
      });
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
          student:students (first_name, last_name, grade_level)
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

      const rows = Array.isArray(data) ? data : [];
      const profiles = await this.loadProfilesForUploaders(rows.map((row: any) => String(row?.uploaded_by || '')));

      return rows.map((pop: any) => {
        const uploader = profiles.get(String(pop?.uploaded_by || ''));
        const parentName = uploader
          ? `${uploader.first_name || ''} ${uploader.last_name || ''}`.trim() || 'Unknown Parent'
          : 'Unknown Parent';

        return ({
        id: pop.id,
        preschool_id: pop.preschool_id,
        student_id: pop.student_id,
        submitted_by: pop.uploaded_by,
        parent_name: parentName,
        parent_email: uploader?.email || undefined,
        payment_amount: pop.payment_amount || 0,
        payment_date: pop.payment_date || pop.created_at,
        payment_for_month: pop.payment_for_month || pop.payment_date || pop.created_at,
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
      });
      });
    } catch (error) {
      console.error('Error in getAllPOPs:', error);
      return [];
    }
  }

  /**
   * Approve a proof of payment
   * Uses approve_pop_payment RPC for atomic payment + allocation + fee updates
   */
  static async approvePOP(
    popId: string,
    approvedBy: string,
    approverName: string,
    reviewNotes?: string
  ): Promise<boolean> {
    try {
      const { data: existingPop, error: existingError } = await supabase
        .from('pop_uploads')
        .select(`
          *,
          student:students (first_name, last_name)
        `)
        .eq('id', popId)
        .single();

      if (existingError || !existingPop) {
        console.error('Error loading POP before approval:', existingError);
        return false;
      }

      const uploaderProfiles = await this.loadProfilesForUploaders([String(existingPop.uploaded_by || '')]);
      const uploaderProfile = uploaderProfiles.get(String(existingPop.uploaded_by || ''));

      const previousStatus = String(existingPop.status || 'pending');
      const categoryHint = existingPop.category_code ||
        (String(existingPop.description || '').toLowerCase().includes('uniform') ? 'uniform' : 'tuition');

      const { data: approvalResult, error: approvalError } = await supabase.rpc('approve_pop_payment', {
        p_upload_id: popId,
        p_billing_month: existingPop.payment_for_month || existingPop.payment_date || null,
        p_category_code: categoryHint,
        p_allocations: [],
        p_notes: reviewNotes || null,
      });

      if (approvalError || !approvalResult?.success) {
        console.error('Error approving POP via approve_pop_payment:', approvalError || approvalResult?.error);
        return false;
      }

      const { data, error } = await supabase
        .from('pop_uploads')
        .select(`
          *,
          student:students (first_name, last_name)
        `)
        .eq('id', popId)
        .single();

      if (error || !data) {
        console.error('POP approved but failed to refresh pop_uploads row:', error);
        return false;
      }

      const isUniform = `${data.description || ''} ${data.title || ''}`.toLowerCase().includes('uniform');

      // Log the action
      await this.logAction({
        preschoolId: data.preschool_id,
        entityType: 'proof_of_payment',
        entityId: popId,
        performedBy: approvedBy,
        performerName: approverName,
        performerRole: 'principal_admin',
        action: 'approve',
        previousStatus,
        newStatus: 'approved',
        notes: reviewNotes,
      });

      // Get parent name for notification
      const parentName = uploaderProfile
        ? `${uploaderProfile.first_name || ''} ${uploaderProfile.last_name || ''}`.trim() || 'Parent'
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
        payment_for_month: data.payment_for_month || data.payment_date || new Date().toISOString(),
        payment_method: (data.payment_method || 'bank_transfer') as any,
        payment_purpose: data.title || 'School Fees',
        fee_type: isUniform ? 'uniform' : undefined,
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
        .select(`*`)
        .single();

      if (error) {
        console.error('Error rejecting POP:', error);
        return false;
      }

      const uploaderProfiles = await this.loadProfilesForUploaders([String(data.uploaded_by || '')]);
      const uploaderProfile = uploaderProfiles.get(String(data.uploaded_by || ''));

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
      const parentName = uploaderProfile
        ? `${uploaderProfile.first_name || ''} ${uploaderProfile.last_name || ''}`.trim() || 'Parent'
        : 'Parent';

      // Send notification to parent
      const isUniform = `${data.description || ''} ${data.title || ''}`.toLowerCase().includes('uniform');
      const popForNotification: ProofOfPayment = {
        id: data.id,
        preschool_id: data.preschool_id,
        student_id: data.student_id,
        submitted_by: data.uploaded_by,
        parent_name: parentName,
        payment_amount: data.payment_amount || 0,
        payment_date: data.payment_date || new Date().toISOString(),
        payment_for_month: data.payment_for_month || data.payment_date || new Date().toISOString(),
        payment_method: (data.payment_method || 'bank_transfer') as any,
        payment_purpose: data.title || 'School Fees',
        fee_type: isUniform ? 'uniform' : undefined,
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
    await writeApprovalAuditLog(params);
  }
}
