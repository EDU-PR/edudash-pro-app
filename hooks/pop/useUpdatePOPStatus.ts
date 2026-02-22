/**
 * useUpdatePOPStatus Hook
 * Handles POP status updates with payment processing and notifications
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { inferFeeCategoryCode } from '@/lib/utils/feeUtils';
import { getMonthStartISO } from '@/lib/utils/dateUtils';
import { ApprovalNotificationService } from '@/services/approvals/ApprovalNotificationService';
import { POP_QUERY_KEYS } from './queryKeys';
import { createPaymentRecord, updateInvoiceStatus, updateFeeStatus, generateInvoice, getParentName } from './paymentProcessing';
import type { POPUpload, UpdatePOPStatusParams } from './types';
export const useUpdatePOPStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      uploadId,
      status,
      reviewNotes,
      billingMonth,
      categoryCode,
      allocations,
    }: UpdatePOPStatusParams): Promise<POPUpload> => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Authentication required');
      }
      const { data: currentUpload, error: fetchError } = await supabase
        .from('pop_uploads')
        .select(`*, student:students (first_name, last_name)`)
        .eq('id', uploadId)
        .single();
      if (fetchError || !currentUpload) {
        throw new Error(fetchError?.message || 'Could not load payment proof');
      }
      let finalUpload = currentUpload as POPUpload;
      try {
        if (status === 'approved') {
          const hasExplicitMonth = typeof billingMonth === 'string' && billingMonth.trim().length > 0;
          if (!hasExplicitMonth) {
            throw new Error('Select accounting month to continue');
          }
          await processApproval(currentUpload, user.id, uploadId, {
            reviewNotes,
            billingMonth,
            categoryCode,
            allocations,
          });
          const { data: refreshed } = await supabase
            .from('pop_uploads')
            .select(`*, student:students (first_name, last_name)`)
            .eq('id', uploadId)
            .single();
          if (refreshed) {
            finalUpload = refreshed as POPUpload;
          }
        } else if (status === 'rejected' || status === 'needs_revision') {
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
          if (error || !data) {
            throw new Error(error?.message || 'Failed to update status');
          }
          finalUpload = data as POPUpload;
          await processRejection(data as POPUpload, reviewNotes);
        }
      } catch (notifError) {
        logger.error('Failed to process status update:', notifError);
      }
      
      return { ...finalUpload, reviewer_name: undefined };
    },
    onSuccess: () => {
      // Invalidate POP queries
      queryClient.invalidateQueries({ queryKey: POP_QUERY_KEYS.all });
      
      // Also invalidate parent payments queries to trigger dashboard refresh
      // This ensures the parent dashboard updates when POP status changes
      queryClient.invalidateQueries({ 
        queryKey: ['parent-payments'],
        exact: false 
      });
      
      // Invalidate student fees queries as well since fee status may have changed
      queryClient.invalidateQueries({ 
        queryKey: ['student-fees'],
        exact: false 
      });
    },
  });
};
type ApprovalOptions = Pick<UpdatePOPStatusParams, 'reviewNotes' | 'billingMonth' | 'categoryCode' | 'allocations'>;
// Process approved payment
async function processApproval(
  data: POPUpload,
  reviewerId: string,
  uploadId: string,
  options: ApprovalOptions
): Promise<void> {
  const parentName = await getParentName(data.uploaded_by);
  const isUniform = `${data.description || ''} ${data.title || ''}`.toLowerCase().includes('uniform');
  if (!options.billingMonth) {
    throw new Error('Select accounting month to continue');
  }
  const resolvedBillingMonth = getMonthStartISO(options.billingMonth, {
    recoverUtcMonthBoundary: true,
  });
  const resolvedCategoryCode = (
    options.categoryCode ||
    data.category_code ||
    (isUniform ? 'uniform' : inferFeeCategoryCode(data.description || data.title || 'tuition'))
  );
  // Primary path: atomic approval + allocations in DB RPC.
  const { data: rpcResult, error: rpcError } = await supabase.rpc('approve_pop_payment', {
    p_upload_id: uploadId,
    p_billing_month: resolvedBillingMonth,
    p_category_code: resolvedCategoryCode,
    p_allocations: options.allocations || [],
    p_notes: options.reviewNotes || 'Payment verified and approved',
  });
  if (rpcError || !rpcResult?.success) {
    logger.warn('[POP] approve_pop_payment RPC failed, falling back to legacy processing', {
      rpcError: rpcError?.message,
      rpcResult,
    });
    // Fallback keeps legacy behavior for environments where migration is not yet applied.
    await createPaymentRecord({ ...data, category_code: resolvedCategoryCode }, reviewerId, uploadId);
    if (!isUniform) {
      await updateInvoiceStatus(data);
      await updateFeeStatus({ ...data, category_code: resolvedCategoryCode, payment_for_month: resolvedBillingMonth });
    }
    await supabase
      .from('pop_uploads')
      .update({
        status: 'approved',
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        review_notes: options.reviewNotes || 'Payment verified and approved',
        payment_for_month: resolvedBillingMonth,
        category_code: resolvedCategoryCode,
      })
      .eq('id', uploadId);
  }
  
  // Generate invoice and notify parent
  const invoiceNumber = isUniform ? null : await generateInvoice(data, parentName, reviewerId, uploadId);
  await notifyApproval(data, parentName, invoiceNumber ?? undefined);
}
// Process rejection
async function processRejection(data: POPUpload, reviewNotes?: string): Promise<void> {
  const parentName = await getParentName(data.uploaded_by);
  const paymentPurpose = data.description || data.title || 'School Fees';
  
  await ApprovalNotificationService.notifyParentPOPRejected({
      id: data.id,
      preschool_id: data.preschool_id,
      student_id: data.student_id,
      submitted_by: data.uploaded_by,
      parent_name: parentName,
      payment_amount: data.payment_amount || 0,
      payment_date: data.payment_date || new Date().toISOString(),
      payment_method: 'bank_transfer',
      payment_purpose: paymentPurpose,
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
  const paymentPurpose = data.description || data.title || 'School Fees';
  await ApprovalNotificationService.notifyParentPOPApproved({
    id: data.id,
    preschool_id: data.preschool_id,
    student_id: data.student_id,
    submitted_by: data.uploaded_by,
    parent_name: parentName,
    payment_amount: data.payment_amount || 0,
    payment_date: data.payment_date || new Date().toISOString(),
    payment_method: 'bank_transfer',
    payment_purpose: paymentPurpose,
    status: 'approved',
    submitted_at: data.created_at,
    created_at: data.created_at,
    updated_at: new Date().toISOString(),
    auto_matched: false,
    ...(invoiceNumber && { invoice_number: invoiceNumber }),
  });
  logger.info('✅ Parent notified of POP approval');
}
