/**
 * useUpdatePOPStatus Hook
 * Handles POP status updates with payment processing and notifications
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { ApprovalNotificationService } from '@/services/approvals/ApprovalNotificationService';
import { POP_QUERY_KEYS } from './queryKeys';
import { createPaymentRecord, updateInvoiceStatus, updateFeeStatus, generateInvoice, getParentName } from './paymentProcessing';
import type { POPUpload, UpdatePOPStatusParams } from './types';

export const useUpdatePOPStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ uploadId, status, reviewNotes }: UpdatePOPStatusParams): Promise<POPUpload> => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Authentication required');
      }
      
      // Update POP status
      const { data, error } = await supabase
        .from('pop_uploads')
        .update({
          status,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes,
        })
        .eq('id', uploadId)
        .select(`*, student:students (first_name, last_name)`)
        .single();
        
      if (error) {
        throw new Error(`Failed to update status: ${error.message}`);
      }
      
      // Process approval or rejection
      try {
        if (status === 'approved') {
          await processApproval(data, user.id, uploadId);
        } else if (status === 'rejected' || status === 'needs_revision') {
          await processRejection(data, reviewNotes);
        }
      } catch (notifError) {
        logger.error('Failed to process status update:', notifError);
      }
      
      return { ...data, reviewer_name: undefined };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POP_QUERY_KEYS.all });
    },
  });
};

// Process approved payment
async function processApproval(data: POPUpload, reviewerId: string, uploadId: string): Promise<void> {
  const parentName = await getParentName(data.uploaded_by);
  
  // Create payment record and update statuses
  await createPaymentRecord(data, reviewerId, uploadId);
  await updateInvoiceStatus(data);
  await updateFeeStatus(data);
  
  // Generate invoice and notify parent
  const invoiceNumber = await generateInvoice(data, parentName, reviewerId, uploadId);
  await notifyApproval(data, parentName, invoiceNumber ?? undefined);
}

// Process rejection
async function processRejection(data: POPUpload, reviewNotes?: string): Promise<void> {
  const parentName = await getParentName(data.uploaded_by);
  
  await ApprovalNotificationService.notifyParentPOPRejected({
      id: data.id,
      preschool_id: data.preschool_id,
      student_id: data.student_id,
      submitted_by: data.uploaded_by,
      parent_name: parentName,
      payment_amount: data.payment_amount || 0,
      payment_date: data.payment_date || new Date().toISOString(),
      payment_method: 'bank_transfer',
      payment_purpose: data.title || 'School Fees',
      status: 'rejected',
      rejection_reason: reviewNotes || 'Please review and resubmit',
      submitted_at: data.created_at,
      created_at: data.created_at,
      updated_at: new Date().toISOString(),
      auto_matched: false
  });
  logger.info('✅ Parent notified of POP rejection');
}

// Send approval notification
async function notifyApproval(data: POPUpload, parentName: string, invoiceNumber?: string): Promise<void> {
  await ApprovalNotificationService.notifyParentPOPApproved({
    id: data.id,
    preschool_id: data.preschool_id,
    student_id: data.student_id,
    submitted_by: data.uploaded_by,
    parent_name: parentName,
    payment_amount: data.payment_amount || 0,
    payment_date: data.payment_date || new Date().toISOString(),
    payment_method: 'bank_transfer',
    payment_purpose: data.title || 'School Fees',
    status: 'approved',
    submitted_at: data.created_at,
    created_at: data.created_at,
    updated_at: new Date().toISOString(),
    auto_matched: false,
    ...(invoiceNumber && { invoice_number: invoiceNumber }),
  });
  logger.info('✅ Parent notified of POP approval');
}
