/**
 * Supabase Edge Function: sync-payment-to-edusite
 * 
 * Triggered when payment verification status changes in EduDashPro
 * Syncs the payment_verified status back to EduSitePro
 * 
 * Deploy: supabase functions deploy sync-payment-to-edusite --no-verify-jwt
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { record, old_record } = await req.json();
    console.log('[sync-payment-to-edusite] Payment verification changed:', {
      id: record.id,
      old_status: old_record?.payment_verified,
      new_status: record.payment_verified,
    });

    // Get EduSitePro credentials from environment
    const edusiteUrl = Deno.env.get('EDUSITE_SUPABASE_URL');
    const edusiteKey = Deno.env.get('EDUSITE_SERVICE_ROLE_KEY');

    if (!edusiteUrl || !edusiteKey) {
      throw new Error('EduSitePro credentials not configured');
    }

    const edusiteClient = createClient(edusiteUrl, edusiteKey);

    // Find matching registration in EduSitePro by edusite_id
    const edusiteRegistrationId = record.edusite_id;
    
    if (!edusiteRegistrationId) {
      console.log('[sync-payment-to-edusite] No edusite_id found, skipping sync');
      return new Response(
        JSON.stringify({ success: false, message: 'No edusite_id' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update payment verification in EduSitePro registration_requests table
    const { data, error: updateError } = await edusiteClient
      .from('registration_requests')
      .update({
        payment_verified: record.payment_verified,
        payment_date: record.payment_date,
        registration_fee_paid: record.registration_fee_paid || false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', edusiteRegistrationId)
      .select();

    if (updateError) {
      console.error('[sync-payment-to-edusite] Update error:', updateError);
      throw updateError;
    }

    if (!data || data.length === 0) {
      console.log('[sync-payment-to-edusite] Registration not found in EduSitePro:', edusiteRegistrationId);
      return new Response(
        JSON.stringify({ success: false, message: 'Registration not found in EduSitePro' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[sync-payment-to-edusite] ✅ Payment verification synced to EduSitePro:`, edusiteRegistrationId);

    return new Response(
      JSON.stringify({ success: true, data: data[0] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[sync-payment-to-edusite] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
