// ================================================
// Invoice CRUD & Payment Operations
// Extracted from InvoiceService for WARP compliance
// ================================================

import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { extractOrganizationId } from '@/lib/tenant/compat';
import { logger } from '@/lib/logger';
import type {
  Invoice,
  InvoicePayment,
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
  CreateInvoicePaymentRequest,
  InvoiceFilters,
  InvoiceListResponse,
  InvoiceError,
  PaymentMethod,
} from '@/lib/types/invoice';

const TAG = 'InvoiceCrud';

function supabase() {
  return assertSupabase();
}

// ================================================
// Invoice Notification Helper
// ================================================

export async function notifyInvoiceEvent(
  event: 'new_invoice' | 'invoice_sent' | 'overdue_reminder' | 'payment_confirmed' | 'invoice_viewed',
  invoiceId: string
): Promise<void> {
  try {
    const { error } = await supabase().functions.invoke('notifications-dispatcher', {
      body: { event_type: event, invoice_id: invoiceId }
    });
    if (error) {
      logger.error(TAG, 'Failed to trigger invoice notification:', error);
    }
    track('edudash.invoice.notification_triggered', { invoice_id: invoiceId, event });
  } catch (error) {
    logger.error(TAG, 'Error triggering invoice notification:', error);
    // Don't throw here - notifications are optional and shouldn't break the main flow
  }
}

// ================================================
// Invoice CRUD Operations
// ================================================

/**
 * Create a new invoice with auto-generated invoice number
 */
export async function createInvoice(data: CreateInvoiceRequest): Promise<Invoice> {
  try {
    const sb = supabase();
    const { data: user } = await sb.auth.getUser();
    if (!user?.user) throw new Error('User not authenticated');

    const { data: profile } = await sb
      .from('profiles')
      .select('organization_id, preschool_id')
      .eq('id', user.user.id)
      .single();

    const organizationId = extractOrganizationId(profile);
    if (!organizationId) throw new Error('User not associated with an organization');

    // Generate invoice number using the database function
    const { data: invoiceNumber } = await sb
      .rpc('generate_invoice_number', { p_preschool_id: organizationId });

    if (!invoiceNumber) throw new Error('Failed to generate invoice number');

    // Create the invoice
    const invoiceData = {
      ...data,
      invoice_number: invoiceNumber,
      preschool_id: organizationId, // Database field still named preschool_id
      created_by: user.user.id,
      tax_rate: data.tax_rate || 0,
      discount_amount: data.discount_amount || 0,
    };

    const { data: invoice, error } = await sb
      .from('invoices')
      .insert(invoiceData)
      .select(`
        *,
        student:students(id, first_name, last_name, class_id),
        template:invoice_templates(id, name)
      `)
      .single();

    if (error) throw error;

    // Create invoice items
    if (data.items && data.items.length > 0) {
      const items = data.items.map((item, index) => ({
        ...item,
        invoice_id: invoice.id,
        sort_order: index,
      }));

      const { error: itemsError } = await sb
        .from('invoice_items')
        .insert(items);

      if (itemsError) throw itemsError;
    }

    // Track analytics
    track('edudash.invoice.created', {
      invoice_id: invoice.id,
      total_amount: invoice.total_amount,
      item_count: data.items?.length || 0,
      has_student: !!data.student_id,
    });

    // Trigger invoice notification
    await notifyInvoiceEvent('new_invoice', invoice.id);

    return invoice;
  } catch (error) {
    const invoiceError: InvoiceError = {
      code: 'CREATE_INVOICE_FAILED',
      message: error instanceof Error ? error.message : 'Failed to create invoice',
    };
    throw invoiceError;
  }
}

/**
 * Update an existing invoice
 */
export async function updateInvoice(data: UpdateInvoiceRequest): Promise<Invoice> {
  try {
    const sb = supabase();
    const { id, items, ...updateData } = data;

    // Update the main invoice record
    const { data: invoice, error } = await sb
      .from('invoices')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        student:students(id, first_name, last_name, class_id),
        template:invoice_templates(id, name)
      `)
      .single();

    if (error) throw error;

    // Update items if provided
    if (items) {
      // Delete existing items
      await sb
        .from('invoice_items')
        .delete()
        .eq('invoice_id', id);

      // Insert new items
      if (items.length > 0) {
        const itemsData = items.map((item, index) => ({
          ...item,
          invoice_id: id,
          sort_order: index,
        }));

        const { error: itemsError } = await sb
          .from('invoice_items')
          .insert(itemsData);

        if (itemsError) throw itemsError;
      }
    }

    // Track analytics
    track('edudash.invoice.updated', {
      invoice_id: id,
      status: updateData.status,
    });

    // Trigger overdue notification if status changed to overdue
    if (updateData.status === 'overdue') {
      await notifyInvoiceEvent('overdue_reminder', id);
    }

    return invoice;
  } catch (error) {
    const invoiceError: InvoiceError = {
      code: 'UPDATE_INVOICE_FAILED',
      message: error instanceof Error ? error.message : 'Failed to update invoice',
    };
    throw invoiceError;
  }
}

/**
 * Get invoices with filters and pagination
 */
export async function getInvoices(filters: InvoiceFilters = {}): Promise<InvoiceListResponse> {
  try {
    const sb = supabase();
    const { data: user } = await sb.auth.getUser();
    if (!user?.user) throw new Error('User not authenticated');

    const { data: profile } = await sb
      .from('profiles')
      .select('preschool_id')
      .eq('id', user.user.id)
      .single();

    if (!profile?.preschool_id) throw new Error('User not associated with a preschool');

    let query = sb
      .from('invoices')
      .select(`
        *,
        student:students(id, first_name, last_name),
        items:invoice_items(id, description, quantity, unit_price, total),
        payments:invoice_payments(id, amount, payment_method, payment_date)
      `, { count: 'exact' })
      .eq('preschool_id', profile.preschool_id);

    // Apply filters
    if (filters.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }

    if (filters.payment_status && filters.payment_status.length > 0) {
      query = query.in('payment_status', filters.payment_status);
    }

    if (filters.student_id) {
      query = query.eq('student_id', filters.student_id);
    }

    if (filters.date_from) {
      query = query.gte('issue_date', filters.date_from);
    }

    if (filters.date_to) {
      query = query.lte('issue_date', filters.date_to);
    }

    if (filters.amount_min) {
      query = query.gte('total_amount', filters.amount_min);
    }

    if (filters.amount_max) {
      query = query.lte('total_amount', filters.amount_max);
    }

    if (filters.search) {
      query = query.or(`
        invoice_number.ilike.%${filters.search}%,
        bill_to_name.ilike.%${filters.search}%,
        notes.ilike.%${filters.search}%
      `);
    }

    if (filters.created_by) {
      query = query.eq('created_by', filters.created_by);
    }

    if (filters.overdue_only) {
      const today = new Date().toISOString().split('T')[0];
      query = query.lt('due_date', today).neq('status', 'paid');
    }

    // Apply sorting
    const sortBy = filters.sort_by || 'created_at';
    const sortOrder = filters.sort_order || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data: invoices, error, count } = await query;

    if (error) throw error;

    // Calculate totals
    const totalAmount = invoices?.reduce((sum, invoice) => sum + invoice.total_amount, 0) || 0;
    const totalPaid = invoices?.reduce((sum, invoice) => sum + invoice.paid_amount, 0) || 0;
    const totalOutstanding = totalAmount - totalPaid;

    return {
      invoices: invoices || [],
      total_count: count || 0,
      total_amount: totalAmount,
      total_paid: totalPaid,
      total_outstanding: totalOutstanding,
    };
  } catch (error) {
    const invoiceError: InvoiceError = {
      code: 'GET_INVOICES_FAILED',
      message: error instanceof Error ? error.message : 'Failed to fetch invoices',
    };
    throw invoiceError;
  }
}

/**
 * Get a single invoice by ID with all related data
 */
export async function getInvoiceById(id: string): Promise<Invoice> {
  try {
    const sb = supabase();
    const { data: invoice, error } = await sb
      .from('invoices')
      .select(`
        *,
        student:students(id, first_name, last_name, class_id),
        template:invoice_templates(id, name, description),
        items:invoice_items(*),
        payments:invoice_payments(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!invoice) throw new Error('Invoice not found');

    // Track analytics
    track('edudash.invoice.viewed', {
      invoice_id: id,
      total_amount: invoice.total_amount,
      status: invoice.status,
    });

    // Trigger invoice viewed notification
    await notifyInvoiceEvent('invoice_viewed', id);

    return invoice;
  } catch (error) {
    const invoiceError: InvoiceError = {
      code: 'GET_INVOICE_FAILED',
      message: error instanceof Error ? error.message : 'Failed to fetch invoice',
    };
    throw invoiceError;
  }
}

/**
 * Delete an invoice (only if it's in draft status)
 */
export async function deleteInvoice(id: string): Promise<void> {
  try {
    const sb = supabase();
    // Check if invoice can be deleted (only drafts)
    const { data: invoice } = await sb
      .from('invoices')
      .select('status')
      .eq('id', id)
      .single();

    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status !== 'draft') {
      throw new Error('Only draft invoices can be deleted');
    }

    const { error } = await sb
      .from('invoices')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Track analytics
    track('edudash.invoice.deleted', {
      invoice_id: id,
    });
  } catch (error) {
    const invoiceError: InvoiceError = {
      code: 'DELETE_INVOICE_FAILED',
      message: error instanceof Error ? error.message : 'Failed to delete invoice',
    };
    throw invoiceError;
  }
}

// ================================================
// Payment Operations
// ================================================

/**
 * Record a payment against an invoice
 */
export async function createPayment(data: CreateInvoicePaymentRequest): Promise<InvoicePayment> {
  try {
    const sb = supabase();
    const { data: user } = await sb.auth.getUser();
    if (!user?.user) throw new Error('User not authenticated');

    const paymentData = {
      ...data,
      recorded_by: user.user.id,
    };

    const { data: payment, error } = await sb
      .from('invoice_payments')
      .insert(paymentData)
      .select('*')
      .single();

    if (error) throw error;

    // Track analytics
    track('edudash.invoice.payment_recorded', {
      invoice_id: data.invoice_id,
      amount: data.amount,
      payment_method: data.payment_method,
    });

    return payment;
  } catch (error) {
    const invoiceError: InvoiceError = {
      code: 'CREATE_PAYMENT_FAILED',
      message: error instanceof Error ? error.message : 'Failed to record payment',
    };
    throw invoiceError;
  }
}

/**
 * Mark an invoice as paid
 */
export async function markAsPaid(
  invoiceId: string,
  paymentMethod: PaymentMethod = 'cash',
  referenceNumber?: string
): Promise<void> {
  try {
    // Get the invoice total
    const { data: invoice } = await supabase()
      .from('invoices')
      .select('total_amount, paid_amount')
      .eq('id', invoiceId)
      .single();

    if (!invoice) throw new Error('Invoice not found');

    const remainingAmount = invoice.total_amount - invoice.paid_amount;

    if (remainingAmount > 0) {
      // Create payment record for the remaining amount
      await createPayment({
        invoice_id: invoiceId,
        amount: remainingAmount,
        payment_method: paymentMethod,
        payment_date: new Date().toISOString().split('T')[0],
        reference_number: referenceNumber,
      });
    }

    // Update invoice status
    await updateInvoice({
      id: invoiceId,
      status: 'paid',
    });

    // Track analytics
    track('edudash.invoice.marked_paid', {
      invoice_id: invoiceId,
      payment_amount: remainingAmount,
      payment_method: paymentMethod,
    });

    // Trigger payment confirmation notification
    await notifyInvoiceEvent('payment_confirmed', invoiceId);
  } catch (error) {
    const invoiceError: InvoiceError = {
      code: 'MARK_PAID_FAILED',
      message: error instanceof Error ? error.message : 'Failed to mark invoice as paid',
    };
    throw invoiceError;
  }
}
