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

    // Create parent user account with temporary password
    const tempPassword = crypto.randomUUID().substring(0, 12) + 'Aa1!'; // 12 chars + complexity
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

    // Send welcome email with temporary password via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'noreply@youngeagles.org.za';
    
    if (resendApiKey) {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .credentials { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; }
            .reference-box { background: #fff; border: 2px solid #667eea; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .reference-number { font-size: 24px; font-weight: bold; color: #667eea; letter-spacing: 2px; margin: 10px 0; }
            .copy-note { font-size: 12px; color: #666; margin-top: 10px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Registration Approved!</h1>
            </div>
            <div class="content">
              <p>Dear ${registration.guardian_name},</p>
              
              <p>Congratulations! Your child <strong>${registration.student_first_name} ${registration.student_last_name}</strong> has been approved for registration at <strong>Young Eagles Preschool</strong>.</p>
              
              <div class="reference-box">
                <h3 style="margin: 0 0 10px 0; color: #667eea;">📋 Your Reference Number</h3>
                <div class="reference-number">${registration.application_number || 'N/A'}</div>
                <p class="copy-note">Please save this reference number for your records</p>
              </div>
              
              <div class="credentials">
                <h3>Your Account Credentials</h3>
                <p><strong>Email:</strong> ${registration.guardian_email}</p>
                <p><strong>Temporary Password:</strong> <code style="background: #f0f0f0; padding: 5px 10px; border-radius: 3px;">${tempPassword}</code></p>
              </div>
              
              <p><strong>⚠️ Important:</strong> Please change your password after your first login for security.</p>
              
              <a href="https://youngeagles.org.za/dashboard" class="button">Login to Your Dashboard</a>
              
              <h3>Next Steps:</h3>
              <ol>
                <li>Log in to your parent dashboard using the credentials above</li>
                <li>Complete any remaining registration forms</li>
                <li>Upload required documents if not already done</li>
                <li>Review the school calendar and upcoming events</li>
              </ol>
              
              <p>If you have any questions, please don't hesitate to contact us.</p>
              
              <p>Welcome to the Young Eagles family!</p>
              
              <div class="footer">
                <p>Young Eagles Preschool<br>
                📧 admin@youngeagles.org.za | 📞 +27 XX XXX XXXX</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      try {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [registration.guardian_email],
            subject: '🎉 Registration Approved - Welcome to Young Eagles!',
            html: emailHtml,
          }),
        });

        if (emailResponse.ok) {
          console.log(`📧 Welcome email sent to ${registration.guardian_email}`);
        } else {
          const errorText = await emailResponse.text();
          console.error('⚠️  Failed to send welcome email:', errorText);
        }
      } catch (emailError) {
        console.error('⚠️  Error sending email:', emailError);
      }
    } else {
      console.warn('⚠️  RESEND_API_KEY not configured, email not sent');
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
