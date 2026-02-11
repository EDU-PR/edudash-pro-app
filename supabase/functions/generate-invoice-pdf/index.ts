/**
 * Generate Invoice PDF Edge Function
 * 
 * Generates a PDF for an invoice and stores it in Supabase Storage.
 * Uses HTML-to-PDF approach via a lightweight HTML template.
 * 
 * Expected body: { invoice_id }
 * Auth: Bearer token required
 * Returns: { pdf_url }
 */

import { serve } from 'https://deno.land/std@0.214.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return handleCorsOptions(req);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { invoice_id } = body;

    if (!invoice_id) {
      return new Response(JSON.stringify({ error: 'Missing invoice_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch invoice with related data
    const { data: invoice, error: invoiceErr } = await supabase
      .from('invoices')
      .select(`
        *,
        students(first_name, last_name),
        profiles!invoices_parent_id_fkey(first_name, last_name, email, phone),
        preschools(name, address, phone, email, logo_url)
      `)
      .eq('id', invoice_id)
      .single();

    if (invoiceErr || !invoice) {
      return new Response(JSON.stringify({ error: 'Invoice not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const inv = invoice as Record<string, any>;
    const school = inv.preschools || {};
    const parent = inv.profiles || {};
    const student = inv.students || {};
    const amount = Number(inv.total_amount || inv.amount || 0).toFixed(2);
    const parentName = `${parent.first_name || ''} ${parent.last_name || ''}`.trim() || 'Parent/Guardian';
    const studentName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';

    // Build line items if available
    let lineItemsHtml = '';
    if (inv.line_items && Array.isArray(inv.line_items)) {
      lineItemsHtml = inv.line_items.map((item: any) => `
        <tr>
          <td style="padding:8px;border:1px solid #dee2e6;">${item.description || 'Item'}</td>
          <td style="padding:8px;border:1px solid #dee2e6;text-align:right;">R ${Number(item.amount || 0).toFixed(2)}</td>
        </tr>
      `).join('');
    } else {
      lineItemsHtml = `
        <tr>
          <td style="padding:8px;border:1px solid #dee2e6;">${inv.description || 'School Fees'}</td>
          <td style="padding:8px;border:1px solid #dee2e6;text-align:right;">R ${amount}</td>
        </tr>
      `;
    }

    // Generate HTML invoice
    const invoiceHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Invoice ${inv.invoice_number || ''}</title></head>
<body style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#1a1a1a;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;">
    <div>
      <h1 style="margin:0;color:#1e3a5f;font-size:28px;">INVOICE</h1>
      <p style="margin:4px 0;color:#64748b;">#${inv.invoice_number || invoice_id.slice(0, 8)}</p>
    </div>
    <div style="text-align:right;">
      <h2 style="margin:0;color:#1e3a5f;">${school.name || 'EduDash Pro School'}</h2>
      <p style="margin:4px 0;color:#64748b;font-size:13px;">${school.address || ''}</p>
      <p style="margin:4px 0;color:#64748b;font-size:13px;">${school.phone || ''}</p>
      <p style="margin:4px 0;color:#64748b;font-size:13px;">${school.email || ''}</p>
    </div>
  </div>
  <hr style="border:none;border-top:2px solid #1e3a5f;margin:16px 0;">
  <div style="display:flex;justify-content:space-between;margin-bottom:24px;">
    <div>
      <p style="margin:4px 0;"><strong>Bill To:</strong></p>
      <p style="margin:4px 0;">${parentName}</p>
      <p style="margin:4px 0;color:#64748b;">${parent.email || ''}</p>
      <p style="margin:4px 0;color:#64748b;">${parent.phone || ''}</p>
    </div>
    <div style="text-align:right;">
      <p style="margin:4px 0;"><strong>Student:</strong> ${studentName}</p>
      <p style="margin:4px 0;"><strong>Date:</strong> ${inv.created_at ? new Date(inv.created_at).toLocaleDateString('en-ZA') : 'N/A'}</p>
      <p style="margin:4px 0;"><strong>Due Date:</strong> ${inv.due_date || 'Upon receipt'}</p>
      <p style="margin:4px 0;"><strong>Status:</strong> <span style="color:${inv.status === 'paid' ? '#16a34a' : '#dc2626'};">${(inv.status || 'pending').toUpperCase()}</span></p>
    </div>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <thead>
      <tr style="background:#1e3a5f;color:white;">
        <th style="padding:10px;text-align:left;">Description</th>
        <th style="padding:10px;text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${lineItemsHtml}
    </tbody>
    <tfoot>
      <tr style="background:#f1f5f9;font-weight:bold;">
        <td style="padding:10px;border:1px solid #dee2e6;">Total Due</td>
        <td style="padding:10px;border:1px solid #dee2e6;text-align:right;">R ${amount}</td>
      </tr>
    </tfoot>
  </table>
  ${inv.notes ? `<p style="color:#64748b;font-size:13px;"><strong>Notes:</strong> ${inv.notes}</p>` : ''}
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
  <p style="text-align:center;color:#94a3b8;font-size:11px;">Generated by EduDash Pro — www.edudashpro.org.za</p>
</body>
</html>`;

    // Store as HTML file (Deno Edge Functions don't have native PDF generation)
    // Consumers can render this HTML or use a client-side PDF library
    const storagePath = `invoices/pdf/${invoice_id}.html`;
    const encoder = new TextEncoder();
    const htmlBytes = encoder.encode(invoiceHtml);

    const { error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(storagePath, htmlBytes, {
        contentType: 'text/html',
        upsert: true,
      });

    if (uploadErr) {
      console.error('[generate-invoice-pdf] Upload error:', uploadErr);
      return new Response(JSON.stringify({ error: 'Failed to store invoice document' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[generate-invoice-pdf] Generated:', storagePath);

    return new Response(JSON.stringify({
      pdf_url: storagePath,
      storage_bucket: 'documents',
      format: 'html',
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[generate-invoice-pdf] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
