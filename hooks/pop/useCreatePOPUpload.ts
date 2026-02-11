/** useCreatePOPUpload — POP file upload creation with validation */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { uploadPOPFile, UploadResult } from '@/lib/popUpload';
import { logger } from '@/lib/logger';
import { inferFeeCategoryCode } from '@/lib/utils/feeUtils';
import { getDateOnlyISO, getMonthEndISO, getMonthStartISO, parseDateValue } from '@/lib/utils/dateUtils';
import { POP_QUERY_KEYS } from './queryKeys';
import type { POPUpload, CreatePOPUploadData } from './types';
export const useCreatePOPUpload = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreatePOPUploadData): Promise<POPUpload> => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Authentication required');
      }
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('preschool_id')
        .eq('auth_user_id', user.id)
        .single();
        
      if (profileError || !profile?.preschool_id) {
        throw new Error('User profile not found');
      }
      
      if (data.upload_type === 'proof_of_payment') {
        await validatePaymentUpload(data);
      }
      
      logger.info('Starting POP upload process...');
      
      const uploadResult: UploadResult = await uploadPOPFile(
        data.file_uri,
        data.upload_type,
        user.id,
        data.student_id,
        data.file_name
      );
      
      if (!uploadResult.success || !uploadResult.filePath) {
        throw new Error(uploadResult.error || 'File upload failed');
      }
      
      logger.info('File uploaded successfully, creating database record...');
      
      const dbData = buildDatabaseRecord(data, uploadResult, user.id, profile.preschool_id);
      
      const { data: newUpload, error: dbError } = await supabase
        .from('pop_uploads')
        .insert(dbData)
        .select(`
          *,
          student:students (
            first_name,
            last_name
          )
        `)
        .single();
        
      if (dbError) {
        logger.error('Database insert failed:', dbError);
        throw new Error(`Failed to save upload: ${dbError.message}`);
      }
      
      if (newUpload?.upload_type === 'proof_of_payment') {
        try {
          const notifyPayload = {
            event_type: 'pop_uploaded',
            pop_upload_id: newUpload.id,
            preschool_id: profile.preschool_id,
            student_id: newUpload.student_id,
            upload_type: newUpload.upload_type,
            payment_amount: newUpload.payment_amount,
            payment_reference: newUpload.payment_reference,
            send_immediately: true,
          };
          logger.info('[POPUpload] Sending notification:', JSON.stringify(notifyPayload));
          const { data: notifyData, error: notifyError } = await supabase.functions.invoke('notifications-dispatcher', {
            body: notifyPayload,
          });
          if (notifyError) {
            logger.warn('POPUpload', 'Notification dispatch returned error:', notifyError);
          } else {
            logger.info('[POPUpload] Notification dispatch result:', JSON.stringify(notifyData));
          }
        } catch (notifyError) {
          logger.warn('POPUpload', 'Failed to notify POP upload:', notifyError);
        }
      }
      logger.info('POP upload completed successfully');
      return newUpload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POP_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ['parent_dashboard_data'] });
      logger.info('POP upload successful, queries invalidated');
    },
    onError: (error) => {
      logger.error('POP upload failed:', error);
    },
  });
};
// Validate payment-specific rules
async function validatePaymentUpload(data: CreatePOPUploadData): Promise<void> {
  if (!data.payment_for_month && !data.payment_date) {
    throw new Error('Please select the billing month for this payment.');
  }
  if (!data.category_code) {
    throw new Error('Please select a payment category.');
  }
  // Check if fee for this period is already paid
  const periodDateValue = data.payment_for_month || data.payment_date;
  if (periodDateValue) {
    const paymentDate = parseDateValue(periodDateValue);
    if (!paymentDate) {
      throw new Error('Invalid billing month selected.');
    }
    const monthStart = getMonthStartISO(periodDateValue, {
      recoverUtcMonthBoundary: Boolean(data.payment_for_month),
    });
    const monthEnd = getMonthEndISO(periodDateValue, {
      recoverUtcMonthBoundary: Boolean(data.payment_for_month),
    });
    
    const { data: paidFees } = await supabase
      .from('student_fees')
      .select('id, status, description')
      .eq('student_id', data.student_id)
      .eq('status', 'paid')
      .gte('due_date', monthStart)
      .lte('due_date', monthEnd)
      .limit(1);
    
    if (paidFees && paidFees.length > 0) {
      throw new Error(`The fee for this period (${paidFees[0].description || 'Monthly Fee'}) has already been paid.`);
    }
  }
  
  // Check for duplicate payment reference
  if (data.payment_reference?.trim()) {
    const { data: existingByRef } = await supabase
      .from('pop_uploads')
      .select('id, status')
      .eq('payment_reference', data.payment_reference.trim())
      .in('status', ['pending', 'approved'])
      .limit(1);
    
    if (existingByRef && existingByRef.length > 0) {
      const status = existingByRef[0].status === 'approved' ? 'already approved' : 'pending review';
      throw new Error(`Payment reference "${data.payment_reference}" has already been used (${status}).`);
    }
  }
  
  // Check for duplicate within 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: existingUploads } = await supabase
    .from('pop_uploads')
    .select('id, payment_amount, status')
    .eq('student_id', data.student_id)
    .eq('upload_type', 'proof_of_payment')
    .in('status', ['pending', 'approved'])
    .gte('created_at', twentyFourHoursAgo);
  
  if (existingUploads?.length) {
    const duplicate = existingUploads.find(u => u.payment_amount === data.payment_amount && !data.payment_reference);
    if (duplicate) {
      throw new Error('A payment of the same amount was submitted recently. Add a unique payment reference.');
    }
  }
}
// Build database record from upload data
function buildDatabaseRecord(
  data: CreatePOPUploadData,
  uploadResult: UploadResult,
  userId: string,
  preschoolId: string
) {
  return {
    student_id: data.student_id,
    uploaded_by: userId,
    preschool_id: preschoolId,
    upload_type: data.upload_type,
    title: data.title,
    description: data.description,
    file_path: uploadResult.filePath,
    file_name: uploadResult.fileName || data.file_name,
    file_size: uploadResult.fileSize || 0,
    file_type: uploadResult.fileType || 'unknown',
    
    ...(data.upload_type === 'proof_of_payment' && {
      payment_amount: data.payment_amount ?? 0,
      payment_method: data.payment_method,
      payment_date: getDateOnlyISO(data.payment_date),
      payment_for_month: getMonthStartISO(data.payment_for_month || data.payment_date, {
        recoverUtcMonthBoundary: Boolean(data.payment_for_month),
      }),
      category_code: data.category_code || inferFeeCategoryCode(data.description || data.title || 'tuition'),
      payment_reference: data.payment_reference,
      ...(data.advance_months && data.advance_months > 0 && {
        advance_months: data.advance_months,
      }),
      ...(data.covers_months?.length && {
        covers_months: data.covers_months,
      }),
    }),
    
    ...(data.upload_type === 'picture_of_progress' && {
      subject: data.subject || 'General',
      achievement_level: data.achievement_level,
      learning_area: data.learning_area,
    }),
  };
}
