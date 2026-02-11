/**
 * Aftercare Email Edge Function
 * 
 * Sends confirmation/notification emails for aftercare registrations.
 * 
 * Expected body: { registration_id, type: 'confirmation' | 'payment_reminder' }
 * Auth: Bearer token required
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

    const { registration_id, type } = await req.json();
    if (!registration_id) {
      return new Response(JSON.stringify({ error: 'Missing registration_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch registration details
    const { data: reg, error: regErr } = await supabase
      .from('aftercare_registrations')
      .select('*')
      .eq('id', registration_id)
      .single();

    if (regErr || !reg) {
      return new Response(JSON.stringify({ error: 'Registration not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const recipientEmail = reg.parent_email || reg.guardian_email;
    if (!recipientEmail) {
      return new Response(JSON.stringify({ success: true, message: 'No email address on file' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const childName = `${reg.child_first_name || ''} ${reg.child_last_name || ''}`.trim();
    const parentName = `${reg.parent_first_name || ''} ${reg.parent_last_name || ''}`.trim();

    const subject = type === 'confirmation'
      ? `Aftercare Registration Confirmed — ${childName}`
      : `Aftercare Payment Reminder — ${childName}`;

    const body = type === 'confirmation'
      ? `Dear ${parentName},\n\nThank you for registering ${childName} for our aftercare program.\n\nYour registration reference: ${reg.payment_reference || registration_id}\n\nWe look forward to welcoming ${childName}!\n\nWarm regards,\nThe School Team`
      : `Dear ${parentName},\n\nThis is a friendly reminder that payment is due for ${childName}'s aftercare registration.\n\nReference: ${reg.payment_reference || registration_id}\n\nPlease submit your proof of payment at your earliest convenience.\n\nWarm regards,\nThe School Team`;

    // Send via send-email Edge Function
    await supabase.functions.invoke('send-email', {
      body: { to: recipientEmail, subject, body, confirmed: true },
    });

    console.log('[aftercare-email] Sent:', { type, registration_id, to: recipientEmail });

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[aftercare-email] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
