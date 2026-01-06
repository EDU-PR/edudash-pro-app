/**
 * POP Payment Processing Service
 * Handles payment record creation, invoice generation, and status updates
 */
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { POPUpload } from './types';

// Create payment record for financial tracking
export async function createPaymentRecord(
  data: POPUpload,
  reviewerId: string,
  uploadId: string
): Promise<void> {
  try {
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
    if (error) logger.error('Failed to create payment record:', error);
    else logger.info('✅ Payment record created');
  } catch (err) {
    logger.error('Error creating payment record:', err);
  }
}

// Update invoice status to paid
export async function updateInvoiceStatus(data: POPUpload): Promise<void> {
  try {
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
  } catch (err) {
    logger.error('Error updating invoice:', err);
  }
}

// Update student fee status to paid
export async function updateFeeStatus(data: POPUpload): Promise<void> {
  try {
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
      // Use final_amount if available, otherwise fall back to amount or payment_amount
      const feeAmount = fees[0].final_amount || fees[0].amount || data.payment_amount || 0;
      logger.info(`[updateFeeStatus] Marking fee ${feeId} as paid for student ${data.student_id}`);
      
      const { error: updateError } = await supabase
        .from('student_fees')
        .update({ 
          status: 'paid', 
          paid_date: new Date().toISOString().split('T')[0],
          amount_paid: feeAmount,
          amount_outstanding: 0,
        })
        .eq('id', feeId);
      
      if (updateError) {
        logger.error('Failed to update fee status:', updateError);
      } else {
        logger.info('✅ Student fee marked as paid');
      }
    } else {
      logger.warn(`[updateFeeStatus] No pending fees found for student ${data.student_id}`);
    }
  } catch (err) {
    logger.error('Error updating fee:', err);
  }
}

// Generate invoice for approved payment
export async function generateInvoice(
  data: POPUpload,
  parentName: string,
  reviewerId: string,
  uploadId: string
): Promise<string | null> {
  try {
    const { data: parentProfile } = await supabase
      .from('profiles')
      .select('email, phone_number')
      .eq('id', data.uploaded_by)
      .single();
    
    const { data: student } = await supabase
      .from('students')
      .select('first_name, last_name')
      .eq('id', data.student_id)
      .single();
    
    const paymentDate = data.payment_date ? new Date(data.payment_date) : new Date();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const invoiceMonth = monthNames[paymentDate.getMonth()];
    const invoiceYear = paymentDate.getFullYear();
    const invoiceNumber = `INV-${invoiceYear}${String(paymentDate.getMonth() + 1).padStart(2, '0')}-${uploadId.slice(0, 4).toUpperCase()}`;
    const studentName = student ? `${student.first_name || ''} ${student.last_name || ''}`.trim() : 'Student';
    
    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        preschool_id: data.preschool_id,
        student_id: data.student_id,
        issue_date: new Date().toISOString().split('T')[0],
        due_date: paymentDate.toISOString().split('T')[0],
        bill_to_name: parentName,
        bill_to_email: parentProfile?.email,
        bill_to_phone: parentProfile?.phone_number,
        subtotal: data.payment_amount || 0,
        total_amount: data.payment_amount || 0,
        paid_amount: data.payment_amount || 0,
        status: 'paid',
        payment_status: 'paid',
        notes: `Payment for ${studentName} - ${invoiceMonth} ${invoiceYear} School Fees.`,
        created_by: reviewerId,
      })
      .select('id')
      .single();
    
    if (error) {
      logger.error('Failed to create invoice:', error);
      return null;
    }
    
    // Add invoice item
    await supabase.from('invoice_items').insert({
      invoice_id: invoice.id,
      description: `${invoiceMonth} ${invoiceYear} School Fees - ${studentName}`,
      quantity: 1,
      unit_price: data.payment_amount || 0,
      item_type: 'tuition',
      category: 'School Fees',
    });
    
    logger.info(`✅ Invoice ${invoiceNumber} created`);
    return invoiceNumber;
  } catch (err) {
    logger.error('Error generating invoice:', err);
    return null;
  }
}

// Get parent name from profile
export async function getParentName(parentId: string): Promise<string> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', parentId)
    .single();
  
  return profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Parent';
}
