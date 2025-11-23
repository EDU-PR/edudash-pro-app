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

/**
 * Create parent user account in EduSitePro and send welcome email
 */
async function createParentAccountAndSendEmail(registration: any, edusiteClient: any) {
  try {
    console.log(`📧 Creating parent account for ${registration.guardian_email}...`);

    // Check if parent user already exists
    const { data: existingUsers } = await edusiteClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u: any) => u.email === registration.guardian_email);

    if (existingUser) {
      console.log(`✅ Parent user already exists: ${registration.guardian_email}`);
      return;
    }

    // Create parent user account
    const tempPassword = crypto.randomUUID();
    const { data: newUser, error: createError } = await edusiteClient.auth.admin.createUser({
      email: registration.guardian_email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: registration.guardian_name,
        phone: registration.guardian_phone,
        role: 'parent',
      },
    });

    if (createError) {
      console.error('❌ Failed to create parent user:', createError);
      throw createError;
    }

    console.log(`✅ Parent user created: ${newUser.user.id}`);

    // Send password reset email so parent can set their password
    const { error: resetError } = await edusiteClient.auth.admin.generateLink({
      type: 'recovery',
      email: registration.guardian_email,
    });

    if (resetError) {
      console.error('⚠️  Failed to send password reset email:', resetError);
    } else {
      console.log(`📧 Password reset email sent to ${registration.guardian_email}`);
    }

  } catch (error) {
    console.error('❌ Error creating parent account:', error);
    // Don't throw - we still want to sync the status even if account creation fails
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { record, old_record } = await req.json();

    // Only sync if status changed to approved or rejected
    if (old_record && record.status !== old_record.status && 
        ['approved', 'rejected', 'waitlisted'].includes(record.status)) {

      // Check if this registration came from EduSitePro (has edusite_id)
      if (record.edusite_id) {
        // This registration came from EduSitePro, sync status back
        console.log(`Syncing registration ${record.id} back to EduSitePro (edusite_id: ${record.edusite_id})`);

        const edusiteClient = createClient(
          Deno.env.get('EDUSITE_SUPABASE_URL') ?? '',
          Deno.env.get('EDUSITE_SERVICE_ROLE_KEY') ?? ''
        );

        const { error } = await edusiteClient
          .from('registration_requests')
          .update({
            status: record.status,
            reviewed_date: record.reviewed_date || new Date().toISOString(),
            rejection_reason: record.rejection_reason,
            student_birth_certificate_url: record.student_birth_certificate_url,
            student_clinic_card_url: record.student_clinic_card_url,
            guardian_id_document_url: record.guardian_id_document_url,
            documents_uploaded: record.documents_uploaded,
            payment_method: record.payment_method,
            payment_date: record.payment_date,
            proof_of_payment_url: record.proof_of_payment_url,
            registration_fee_paid: record.registration_fee_paid,
            registration_fee_payment_id: record.registration_fee_payment_id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', record.edusite_id);

        if (error) {
          console.error('Error syncing to EduSitePro:', error);
          throw error;
        }

        console.log(`✅ Status ${record.status} synced to EduSitePro`);

        // If approved, create parent account in EduSitePro
        if (record.status === 'approved') {
          await createParentAccountAndSendEmail(record, edusiteClient);
        }
      } else {
        // This registration was created directly in EduDashPro, not from EduSitePro
        // Just create the parent account in EduDashPro itself
        console.log(`Registration ${record.id} created in EduDashPro, creating parent account locally`);
        
        if (record.status === 'approved') {
          // Call sync-registration-to-edudash to create parent/student in EduDashPro
          const edudashUrl = Deno.env.get('SUPABASE_URL') ?? '';
          const edudashKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
          
          await fetch(`${edudashUrl}/functions/v1/sync-registration-to-edudash`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${edudashKey}`
            },
            body: JSON.stringify({ registration_id: record.id })
          });
          
          console.log(`✅ Triggered parent/student creation in EduDashPro`);
        }
      }
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
