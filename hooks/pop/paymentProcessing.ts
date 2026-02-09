/**
 * POP Payment Processing Service
 * Handles payment record creation, invoice generation, and status updates
 */
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { getUniformItemType, inferPaymentCategory, inferFeeCategoryCode, isTuitionFee } from '@/lib/utils/feeUtils';
import { getDateOnlyISO, getMonthEndISO, getMonthStartISO } from '@/lib/utils/dateUtils';
import type { POPUpload } from './types';

const UNIFORM_KEYWORDS = ['uniform'];

function isUniformPayment(data: POPUpload): boolean {
  const haystack = `${data.description || ''} ${data.title || ''} ${data.payment_reference || ''}`.toLowerCase();
  return UNIFORM_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

function resolvePaymentDate(value?: string | null): Date {
  if (!value) return new Date();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

const DEFAULT_FEE_FREQUENCY = 'one_time';

type FeeStructureRow = {
  id: string;
  amount: number;
  fee_type: string;
  name: string;
  description?: string | null;
  effective_from?: string | null;
  created_at?: string | null;
  is_active?: boolean | null;
};

const pickLatestFeeStructure = (rows: FeeStructureRow[] | null | undefined) => {
  if (!rows || rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => {
    const aEff = a.effective_from ? new Date(a.effective_from).getTime() : 0;
    const bEff = b.effective_from ? new Date(b.effective_from).getTime() : 0;
    if (aEff !== bEff) return bEff - aEff;
    const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bCreated - aCreated;
  });
  return sorted[0];
};

async function findTuitionFeeStructure(preschoolId: string): Promise<FeeStructureRow | null> {
  const { data, error } = await supabase
    .from('fee_structures')
    .select('id, amount, fee_type, name, description, effective_from, created_at, is_active')
    .eq('preschool_id', preschoolId)
    .eq('is_active', true);
  if (error) {
    logger.warn('[POP] Failed to load fee_structures for tuition lookup:', error);
    return null;
  }
  const tuitionFees = (data || []).filter((fee) => isTuitionFee(fee.fee_type, fee.name, fee.description));
  return pickLatestFeeStructure(tuitionFees as FeeStructureRow[]);
}

type UniformFeeResult = {
  feeId: string;
  feeStructureId: string;
};

async function ensureUniformFeeRecord(
  data: POPUpload,
  reviewerId: string
): Promise<UniformFeeResult | null> {
  if (!data.preschool_id || !data.student_id) return null;
  const itemType = getUniformItemType(undefined, data.title, data.description);
  const preferredFeeType =
    itemType === 'tshirt' ? 'uniform_tshirt' :
      itemType === 'shorts' ? 'uniform_shorts' :
        'uniform';

  const { data: feeStructures, error: feeError } = await supabase
    .from('fee_structures')
    .select('id, amount, fee_type, name, description, effective_from, created_at, is_active')
    .eq('preschool_id', data.preschool_id)
    .eq('is_active', true)
    .in('fee_type', preferredFeeType === 'uniform' ? ['uniform', 'uniform_tshirt', 'uniform_shorts'] : [preferredFeeType, 'uniform']);

  if (feeError) {
    logger.warn('[POP] Failed to fetch uniform fee structures:', feeError);
  }

  let feeStructure = pickLatestFeeStructure(feeStructures as FeeStructureRow[]);

  if (!feeStructure) {
    const label =
      preferredFeeType === 'uniform_tshirt' ? 'Uniform T-shirt' :
        preferredFeeType === 'uniform_shorts' ? 'Uniform Shorts' :
          'Uniform';
    const { data: created, error: createError } = await supabase
      .from('fee_structures')
      .insert({
        preschool_id: data.preschool_id,
        created_by: reviewerId,
        name: label,
        description: data.description || label,
        amount: data.payment_amount || 0,
        fee_type: preferredFeeType,
        frequency: DEFAULT_FEE_FREQUENCY,
        is_active: true,
      })
      .select('id, amount, fee_type, name, description, effective_from, created_at, is_active')
      .single();

    if (createError) {
      logger.error('[POP] Failed to create uniform fee structure:', createError);
      return null;
    }
    feeStructure = created as FeeStructureRow;
  }

  if (!feeStructure) return null;

  const targetPeriodValue = data.payment_for_month || data.payment_date;
  const monthStartIso = getMonthStartISO(targetPeriodValue, {
    recoverUtcMonthBoundary: Boolean(data.payment_for_month),
  });
  const monthEndIso = getMonthEndISO(targetPeriodValue, {
    recoverUtcMonthBoundary: Boolean(data.payment_for_month),
  });

  const { data: existingFees, error: existingError } = await supabase
    .from('student_fees')
    .select('id, status')
    .eq('student_id', data.student_id)
    .eq('fee_structure_id', feeStructure.id)
    .gte('due_date', monthStartIso)
    .lte('due_date', monthEndIso)
    .limit(1);

  if (existingError) {
    logger.warn('[POP] Failed to check uniform student fees:', existingError);
  }

  const paymentAmount = data.payment_amount || feeStructure.amount || 0;
  const paidDate = getDateOnlyISO(data.payment_date);

  if (existingFees?.length) {
    const feeId = existingFees[0].id;
    if (existingFees[0].status !== 'paid') {
      const { error: updateError } = await supabase
        .from('student_fees')
        .update({
          status: 'paid',
          paid_date: paidDate,
          amount_paid: paymentAmount,
          amount_outstanding: 0,
        })
        .eq('id', feeId);
      if (updateError) {
        logger.error('[POP] Failed to mark uniform fee as paid:', updateError);
      }
    }
    return { feeId, feeStructureId: feeStructure.id };
  }

  const dueDate = monthStartIso;
  const { data: insertedFee, error: insertError } = await supabase
    .from('student_fees')
    .insert({
      student_id: data.student_id,
      fee_structure_id: feeStructure.id,
      amount: feeStructure.amount || paymentAmount,
      final_amount: feeStructure.amount || paymentAmount,
      due_date: dueDate,
      status: 'paid',
      amount_paid: paymentAmount,
      amount_outstanding: 0,
      paid_date: paidDate,
    })
    .select('id')
    .single();

  if (insertError || !insertedFee) {
    logger.error('[POP] Failed to create uniform student fee:', insertError);
    return null;
  }

  return { feeId: insertedFee.id, feeStructureId: feeStructure.id };
}

// Create payment record for financial tracking
export async function createPaymentRecord(
  data: POPUpload,
  reviewerId: string,
  uploadId: string
): Promise<void> {
  try {
    const uniformPayment = isUniformPayment(data);
    const description = data.description || data.title || (uniformPayment ? 'Uniform payment' : 'School fees payment');
    const feeCategory = inferPaymentCategory(description);
    const categoryCode = inferFeeCategoryCode(data.category_code || description);
    const billingMonth = getMonthStartISO(data.payment_for_month || data.payment_date, {
      recoverUtcMonthBoundary: Boolean(data.payment_for_month),
    });
    const uniformFee = uniformPayment ? await ensureUniformFeeRecord(data, reviewerId) : null;

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
      description,
      attachment_url: data.file_path,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      submitted_at: data.created_at,
      billing_month: billingMonth,
      category_code: categoryCode,
      transaction_date: getDateOnlyISO(data.payment_date),
      fee_ids: uniformFee?.feeId ? [uniformFee.feeId] : (uniformPayment ? [] : undefined),
      metadata: {
        pop_upload_id: uploadId,
        payment_date: data.payment_date,
        payment_for_month: billingMonth,
        fee_type: uniformPayment ? 'uniform' : categoryCode,
        fee_category: feeCategory,
        category_code: categoryCode,
        payment_context: uniformPayment ? 'uniform' : 'school_fees',
        payment_purpose: description,
        fee_structure_id: uniformFee?.feeStructureId || null,
        auto_created: true,
      },
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
    const periodDateValue = data.payment_for_month || data.payment_date;
    const monthStart = getMonthStartISO(periodDateValue, {
      recoverUtcMonthBoundary: Boolean(data.payment_for_month),
    });
    const monthEnd = getMonthEndISO(periodDateValue, {
      recoverUtcMonthBoundary: Boolean(data.payment_for_month),
    });
    
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
    const periodDateValue = data.payment_for_month || data.payment_date;
    const monthStartIso = getMonthStartISO(periodDateValue, {
      recoverUtcMonthBoundary: Boolean(data.payment_for_month),
    });
    const monthEndIso = getMonthEndISO(periodDateValue, {
      recoverUtcMonthBoundary: Boolean(data.payment_for_month),
    });
    const hasExplicitPeriod = Boolean(data.payment_for_month);
    
    // First try to find a fee matching the selected billing month.
    let { data: fees } = await supabase
      .from('student_fees')
      .select('id, due_date, amount, final_amount, amount_paid, amount_outstanding, status')
      .eq('student_id', data.student_id)
      .in('status', ['pending', 'overdue', 'partially_paid', 'pending_verification'])
      .gte('due_date', monthStartIso)
      .lte('due_date', monthEndIso)
      .limit(1);

    // If payment is for a future or explicit month and no fee exists yet, create one
    if (!fees?.length && hasExplicitPeriod && data.preschool_id) {
      const { data: existingAny } = await supabase
        .from('student_fees')
        .select('id, status, amount, final_amount, due_date, amount_paid, amount_outstanding')
        .eq('student_id', data.student_id)
        .gte('due_date', monthStartIso)
        .lte('due_date', monthEndIso)
        .limit(1);

      if (existingAny?.length) {
        if (existingAny[0].status === 'paid') {
          logger.info('[updateFeeStatus] Fee already marked as paid for target month');
          return;
        }
        fees = existingAny as any;
      } else {
        const tuitionFee = await findTuitionFeeStructure(data.preschool_id);
        if (tuitionFee) {
          const feeAmount = tuitionFee.amount || data.payment_amount || 0;
          const { data: insertedFee, error: insertError } = await supabase
            .from('student_fees')
            .insert({
              student_id: data.student_id,
              fee_structure_id: tuitionFee.id,
              amount: feeAmount,
              final_amount: feeAmount,
              due_date: monthStartIso,
              status: 'pending',
              amount_paid: 0,
              amount_outstanding: feeAmount,
              paid_date: null,
              billing_month: monthStartIso,
              category_code: inferFeeCategoryCode(data.category_code || data.description || data.title || 'tuition'),
            })
            .select('id, amount, final_amount, amount_paid, amount_outstanding, status')
            .single();

          if (insertError || !insertedFee) {
            logger.error('[updateFeeStatus] Failed to create fee for prepayment month:', insertError);
          } else {
            logger.info('[updateFeeStatus] Created fee row for selected billing month');
            fees = [insertedFee as any];
          }
        } else {
          logger.warn('[updateFeeStatus] No tuition fee structure found to create prepayment fee');
        }
      }
    }

    if (fees?.length) {
      const feeId = fees[0].id;
      const feeAmount = Number(fees[0].final_amount || fees[0].amount || 0);
      const paymentAmount = Number(data.payment_amount || 0);
      const existingPaid = Number(fees[0].amount_paid || 0);
      const safeIncoming = paymentAmount > 0 ? paymentAmount : feeAmount;
      const newAmountPaid = Math.min(feeAmount, existingPaid + safeIncoming);
      const newOutstanding = Math.max(feeAmount - newAmountPaid, 0);
      const nextStatus = newOutstanding <= 0 ? 'paid' : 'partially_paid';

      logger.info(`[updateFeeStatus] Applying payment to fee ${feeId} for student ${data.student_id}`);
      
      const { error: updateError } = await supabase
        .from('student_fees')
        .update({
          status: nextStatus,
          paid_date: nextStatus === 'paid' ? getDateOnlyISO(data.payment_date) : null,
          amount_paid: newAmountPaid,
          amount_outstanding: newOutstanding,
          billing_month: monthStartIso,
          category_code: inferFeeCategoryCode(data.category_code || data.description || data.title || 'tuition'),
        })
        .eq('id', feeId);
      
      if (updateError) {
        logger.error('Failed to update fee status:', updateError);
      } else {
        logger.info(`✅ Student fee updated (${nextStatus})`);
      }
    } else {
      logger.warn(`[updateFeeStatus] No fee found for selected billing month ${monthStartIso} for student ${data.student_id}`);
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
    
    const periodDateValue = data.payment_for_month || data.payment_date;
    const invoiceMonthIso = getMonthStartISO(periodDateValue, {
      recoverUtcMonthBoundary: Boolean(data.payment_for_month),
    });
    const paymentDate = resolvePaymentDate(invoiceMonthIso);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const invoiceMonth = monthNames[paymentDate.getMonth()];
    const invoiceYear = paymentDate.getFullYear();
    const invoiceNumber = `INV-${invoiceYear}${String(paymentDate.getMonth() + 1).padStart(2, '0')}-${uploadId.slice(0, 4).toUpperCase()}`;
    const studentName = student ? `${student.first_name || ''} ${student.last_name || ''}`.trim() : 'Student';
    
    const today = new Date();
    const issueDate = paymentDate < today ? paymentDate : today;
    const issueDateStr = getDateOnlyISO(issueDate);
    let dueDateStr = getDateOnlyISO(paymentDate);
    if (dueDateStr < issueDateStr) {
      dueDateStr = issueDateStr;
    }

    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        preschool_id: data.preschool_id,
        student_id: data.student_id,
        issue_date: issueDateStr,
        due_date: dueDateStr,
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
