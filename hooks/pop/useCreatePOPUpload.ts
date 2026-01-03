/**
 * useCreatePOPUpload Hook
 * Handles POP file upload creation with validation
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { uploadPOPFile, UploadResult } from '@/lib/popUpload';
import { logger } from '@/lib/logger';
import { POP_QUERY_KEYS } from './queryKeys';
import type { POPUpload, CreatePOPUploadData } from './types';

export const useCreatePOPUpload = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreatePOPUploadData): Promise<POPUpload> => {
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Authentication required');
      }
      
      // Get user's preschool_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('preschool_id')
        .eq('id', user.id)
        .single();
        
      if (profileError || !profile?.preschool_id) {
        throw new Error('User profile not found');
      }
      
      // Validate payment uploads
      if (data.upload_type === 'proof_of_payment') {
        await validatePaymentUpload(data);
      }
      
      logger.info('Starting POP upload process...');
      
      // Upload file to storage
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
      
      // Create database record
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
        console.error('Database insert failed:', dbError);
        throw new Error(`Failed to save upload: ${dbError.message}`);
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
      console.error('POP upload failed:', error);
    },
  });
};

// Validate payment-specific rules
async function validatePaymentUpload(data: CreatePOPUploadData): Promise<void> {
  // Check if fee for this period is already paid
  if (data.payment_date) {
    const paymentDate = new Date(data.payment_date);
    const monthStart = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), 1).toISOString();
    const monthEnd = new Date(paymentDate.getFullYear(), paymentDate.getMonth() + 1, 0).toISOString();
    
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
      payment_date: data.payment_date || new Date().toISOString().split('T')[0],
      payment_reference: data.payment_reference,
    }),
    
    ...(data.upload_type === 'picture_of_progress' && {
      subject: data.subject || 'General',
      achievement_level: data.achievement_level,
      learning_area: data.learning_area,
    }),
  };
}
