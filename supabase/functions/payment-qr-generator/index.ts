/**
 * Payment QR Generator Edge Function
 * 
 * Generates a QR code image for invoice payment.
 * 
 * Expected body: { invoice_id }
 * Auth: Bearer token required
 * Returns: { qr_code_url }
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

    // Fetch invoice details
    const { data: invoice, error: invoiceErr } = await supabase
      .from('invoices')
      .select('id, invoice_number, total_amount, amount, preschool_id')
      .eq('id', invoice_id)
      .single();

    if (invoiceErr || !invoice) {
      return new Response(JSON.stringify({ error: 'Invoice not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch school banking details for payment reference
    const { data: school } = await supabase
      .from('preschools')
      .select('name, bank_name, account_number, branch_code')
      .eq('id', invoice.preschool_id)
      .single();

    const amount = Number(invoice.total_amount || invoice.amount || 0).toFixed(2);
    const reference = invoice.invoice_number || invoice_id;

    // Build payment data string for QR code
    // Use a generic payment QR format with relevant details
    const paymentData = JSON.stringify({
      type: 'edudashpro_invoice',
      invoice_id,
      reference,
      amount,
      school_name: school?.name || '',
      bank_name: school?.bank_name || '',
      account_number: school?.account_number || '',
      branch_code: school?.branch_code || '',
    });

    // Generate QR code using a public API (no dependency needed)
    // Encode the payment reference + amount for scanning
    const qrText = encodeURIComponent(
      `EduDash Pro Payment\nRef: ${reference}\nAmount: R${amount}\nSchool: ${school?.name || 'N/A'}\nBank: ${school?.bank_name || 'N/A'}\nAcc: ${school?.account_number || 'N/A'}\nBranch: ${school?.branch_code || 'N/A'}`
    );

    // Use QR Server API (free, no key needed)
    const qrSize = 300;
    const qr_code_url = `https://api.qrserver.com/v1/create-qr-code/?data=${qrText}&size=${qrSize}x${qrSize}&format=png`;

    // Optionally, download the QR and store in Supabase Storage for permanence
    try {
      const qrResponse = await fetch(qr_code_url);
      if (qrResponse.ok) {
        const qrBlob = await qrResponse.arrayBuffer();
        const storagePath = `invoices/qr/${invoice_id}.png`;

        const { error: uploadErr } = await supabase.storage
          .from('documents')
          .upload(storagePath, qrBlob, {
            contentType: 'image/png',
            upsert: true,
          });

        if (!uploadErr) {
          // Return storage path (consumers should create signed URLs as needed)
          console.log('[payment-qr-generator] QR stored:', storagePath);
          return new Response(JSON.stringify({
            qr_code_url: storagePath,
            storage_bucket: 'documents',
            direct_url: qr_code_url,
          }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    } catch (storageErr) {
      console.warn('[payment-qr-generator] Storage upload failed, returning direct URL:', storageErr);
    }

    // Fallback: return the direct QR API URL
    return new Response(JSON.stringify({ qr_code_url }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[payment-qr-generator] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
