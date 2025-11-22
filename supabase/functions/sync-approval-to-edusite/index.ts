/**
 * Supabase Edge Function: sync-approval-to-edusite
 * 
 * Triggered when admin approves/rejects a registration in EduDashPro
 * Syncs the status back to EduSitePro so parents can see their application status
 * 
 * Deploy: supabase functions deploy sync-approval-to-edusite
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

    // Only sync if status changed to approved or rejected
    if (old_record && record.status !== old_record.status && 
        ['approved', 'rejected', 'waitlisted'].includes(record.status)) {

      // EduSitePro client
      const edusiteClient = createClient(
        Deno.env.get('EDUSITE_SUPABASE_URL') ?? '',
        Deno.env.get('EDUSITE_SERVICE_ROLE_KEY') ?? ''
      );

      const { error } = await edusiteClient
        .from('registration_requests')
        .update({
          status: record.status,
          reviewed_date: record.reviewed_date || new Date().toISOString(),
          // Skip reviewed_by - it's a UUID in EduSitePro but text in EduDashPro
          rejection_reason: record.rejection_reason,
          
          // Document verification status
          student_birth_certificate_url: record.student_birth_certificate_url,
          student_clinic_card_url: record.student_clinic_card_url,
          guardian_id_document_url: record.guardian_id_document_url,
          documents_uploaded: record.documents_uploaded,
          
          // Payment status
          payment_method: record.payment_method,
          payment_date: record.payment_date,
          proof_of_payment_url: record.proof_of_payment_url,
          registration_fee_paid: record.registration_fee_paid,
          registration_fee_payment_id: record.registration_fee_payment_id,
          
          updated_at: new Date().toISOString(),
        })
        .eq('id', record.id);

      if (error) throw error;

      console.log(`✅ Status ${record.status} synced to EduSitePro for registration ${record.id}`);

      // TODO: Send email notification to parent
      // await sendEmailNotification(record);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Status synced successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error syncing status:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
