// ================================================
// Invoice Operations: Stats, Templates, Branding, Utilities
// Extracted from InvoiceService for WARP compliance
// ================================================

import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { notifyInvoiceEvent, updateInvoice } from './invoiceCrudService';
import type {
  InvoiceTemplate,
  SchoolBranding,
  CreateInvoiceTemplateRequest,
  UpdateSchoolBrandingRequest,
  InvoiceStats,
  InvoiceError,
  PaymentMethod,
  InvoiceStatus,
} from '@/lib/types/invoice';

function supabase() {
  return assertSupabase();
}

// ================================================
// Invoice Statistics
// ================================================

/**
 * Get comprehensive invoice statistics
 */
export async function getInvoiceStats(): Promise<InvoiceStats> {
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

    // Get basic stats
    const { data: invoices } = await sb
      .from('invoices')
      .select('total_amount, paid_amount, status, payment_status, created_at')
      .eq('preschool_id', profile.preschool_id);

    if (!invoices) throw new Error('Failed to fetch invoice statistics');

    // Get payment method breakdown
    const { data: payments } = await sb
      .from('invoice_payments')
      .select('amount, payment_method')
      .in('invoice_id',
        (await sb
          .from('invoices')
          .select('id')
          .eq('preschool_id', profile.preschool_id)
        ).data?.map(i => i.id) || []
      );

    // Calculate stats
    const totalInvoices = invoices.length;
    const totalRevenue = invoices.reduce((sum, inv) => sum + inv.total_amount, 0);
    const totalPaid = invoices.reduce((sum, inv) => sum + inv.paid_amount, 0);
    const totalOutstanding = totalRevenue - totalPaid;
    const averageInvoiceValue = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;

    // Status breakdown
    const statusCounts = invoices.reduce((counts, inv) => {
      counts[inv.status] = (counts[inv.status] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    // Payment status amounts
    const paymentAmounts = invoices.reduce((amounts, inv) => {
      if (inv.payment_status === 'paid') amounts.paid += inv.total_amount;
      else if (inv.payment_status === 'partial') amounts.partial += inv.paid_amount;
      else amounts.unpaid += inv.total_amount - inv.paid_amount;
      return amounts;
    }, { paid: 0, partial: 0, unpaid: 0 });

    // Time-based revenue
    const currentMonth = new Date();
    const lastMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    const thisMonthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);

    const thisMonthRevenue = invoices
      .filter(inv => new Date(inv.created_at) >= thisMonthStart)
      .reduce((sum, inv) => sum + inv.paid_amount, 0);

    const lastMonthRevenue = invoices
      .filter(inv => {
        const date = new Date(inv.created_at);
        return date >= lastMonth && date < thisMonthStart;
      })
      .reduce((sum, inv) => sum + inv.paid_amount, 0);

    const revenueGrowth = lastMonthRevenue > 0
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : 0;

    // Payment method breakdown
    const paymentMethods = (payments || []).reduce((methods, payment) => {
      if (!methods[payment.payment_method]) {
        methods[payment.payment_method] = { count: 0, amount: 0 };
      }
      methods[payment.payment_method].count += 1;
      methods[payment.payment_method].amount += payment.amount;
      return methods;
    }, {} as Record<PaymentMethod, { count: number; amount: number }>);

    const stats: InvoiceStats = {
      total_invoices: totalInvoices,
      total_revenue: totalRevenue,
      total_outstanding: totalOutstanding,
      average_invoice_value: averageInvoiceValue,
      draft_count: statusCounts.draft || 0,
      sent_count: statusCounts.sent || 0,
      paid_count: statusCounts.paid || 0,
      overdue_count: statusCounts.overdue || 0,
      unpaid_amount: paymentAmounts.unpaid,
      partial_amount: paymentAmounts.partial,
      paid_amount: paymentAmounts.paid,
      this_month_revenue: thisMonthRevenue,
      last_month_revenue: lastMonthRevenue,
      revenue_growth: revenueGrowth,
      payment_methods: paymentMethods,
    };

    return stats;
  } catch (error) {
    const invoiceError: InvoiceError = {
      code: 'GET_STATS_FAILED',
      message: error instanceof Error ? error.message : 'Failed to fetch invoice statistics',
    };
    throw invoiceError;
  }
}

// ================================================
// Template Operations
// ================================================

/**
 * Get invoice templates for the current school
 */
export async function getTemplates(): Promise<InvoiceTemplate[]> {
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

    const { data: templates, error } = await sb
      .from('invoice_templates')
      .select('*')
      .eq('preschool_id', profile.preschool_id)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('name');

    if (error) throw error;

    return templates || [];
  } catch (error) {
    const invoiceError: InvoiceError = {
      code: 'GET_TEMPLATES_FAILED',
      message: error instanceof Error ? error.message : 'Failed to fetch templates',
    };
    throw invoiceError;
  }
}

/**
 * Create a new invoice template
 */
export async function createTemplate(data: CreateInvoiceTemplateRequest): Promise<InvoiceTemplate> {
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

    const templateData = {
      ...data,
      preschool_id: profile.preschool_id,
      created_by: user.user.id,
    };

    const { data: template, error } = await sb
      .from('invoice_templates')
      .insert(templateData)
      .select('*')
      .single();

    if (error) throw error;

    // Track analytics
    track('edudash.invoice.template_created', {
      template_id: template.id,
      template_name: template.name,
      is_default: template.is_default,
    });

    return template;
  } catch (error) {
    const invoiceError: InvoiceError = {
      code: 'CREATE_TEMPLATE_FAILED',
      message: error instanceof Error ? error.message : 'Failed to create template',
    };
    throw invoiceError;
  }
}

// ================================================
// School Branding Operations
// ================================================

/**
 * Get school branding settings
 */
export async function getSchoolBranding(): Promise<SchoolBranding | null> {
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

    const { data: branding, error } = await sb
      .from('school_branding')
      .select('*')
      .eq('preschool_id', profile.preschool_id)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned

    return branding;
  } catch (error) {
    const invoiceError: InvoiceError = {
      code: 'GET_BRANDING_FAILED',
      message: error instanceof Error ? error.message : 'Failed to fetch branding',
    };
    throw invoiceError;
  }
}

/**
 * Update school branding settings
 */
export async function updateSchoolBranding(data: UpdateSchoolBrandingRequest): Promise<SchoolBranding> {
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

    const { data: branding, error } = await sb
      .from('school_branding')
      .upsert(
        {
          preschool_id: profile.preschool_id,
          ...data,
        },
        { onConflict: 'preschool_id' }
      )
      .select('*')
      .single();

    if (error) throw error;

    // Track analytics
    track('edudash.invoice.branding_updated', {
      preschool_id: profile.preschool_id,
      has_logo: !!data.logo_url,
      has_custom_colors: !!(data.primary_color || data.secondary_color),
    });

    return branding;
  } catch (error) {
    const invoiceError: InvoiceError = {
      code: 'UPDATE_BRANDING_FAILED',
      message: error instanceof Error ? error.message : 'Failed to update branding',
    };
    throw invoiceError;
  }
}

// ================================================
// Utility Functions
// ================================================

/**
 * Send invoice via email
 */
export async function sendInvoiceEmail(invoiceId: string, recipientEmail?: string): Promise<void> {
  try {
    const sb = supabase();
    const { data, error } = await sb.functions.invoke('send-invoice-email', {
      body: {
        invoice_id: invoiceId,
        recipient_email: recipientEmail,
      },
    });

    if (error) throw error;

    // Update invoice status to sent
    await updateInvoice({
      id: invoiceId,
      status: 'sent' as InvoiceStatus,
    });

    // Track analytics
    track('edudash.invoice.sent_email', {
      invoice_id: invoiceId,
      recipient_provided: !!recipientEmail,
    });

    // Trigger invoice sent notification
    await notifyInvoiceEvent('invoice_sent', invoiceId);
  } catch (error) {
    const invoiceError: InvoiceError = {
      code: 'SEND_EMAIL_FAILED',
      message: error instanceof Error ? error.message : 'Failed to send invoice email',
    };
    throw invoiceError;
  }
}

/**
 * Generate QR code for payment tracking
 */
export async function generateQRCode(invoiceId: string): Promise<string> {
  try {
    const { data, error } = await supabase().functions.invoke('payment-qr-generator', {
      body: {
        invoice_id: invoiceId,
      },
    });

    if (error) throw error;

    return data.qr_code_url;
  } catch (error) {
    const invoiceError: InvoiceError = {
      code: 'GENERATE_QR_FAILED',
      message: error instanceof Error ? error.message : 'Failed to generate QR code',
    };
    throw invoiceError;
  }
}

/**
 * Generate PDF for invoice
 */
export async function generateInvoicePDF(invoiceId: string): Promise<string> {
  try {
    const { data, error } = await supabase().functions.invoke('generate-invoice-pdf', {
      body: {
        invoice_id: invoiceId,
      },
    });

    if (error) throw error;

    // Track analytics
    track('edudash.invoice.pdf_generated', {
      invoice_id: invoiceId,
    });

    return data.pdf_url;
  } catch (error) {
    const invoiceError: InvoiceError = {
      code: 'GENERATE_PDF_FAILED',
      message: error instanceof Error ? error.message : 'Failed to generate PDF',
    };
    throw invoiceError;
  }
}
