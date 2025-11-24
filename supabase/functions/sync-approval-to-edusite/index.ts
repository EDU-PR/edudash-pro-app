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
    // Note: User will set their own password via reset link
    const tempPassword = crypto.randomUUID(); // Temporary, user will reset
    
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
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6; 
              color: #1a1a1a; 
              margin: 0; 
              padding: 0; 
              background-color: #f4f4f5; 
            }
            .email-container { 
              max-width: 600px; 
              margin: 40px auto; 
              background: #ffffff; 
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .header { 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
              padding: 40px 30px; 
              text-align: center; 
            }
            .header h1 { 
              margin: 0 0 10px 0; 
              font-size: 28px; 
              font-weight: 600;
              color: #ffffff;
              letter-spacing: -0.5px;
            }
            .header p { 
              margin: 0; 
              font-size: 16px;
              color: rgba(255,255,255,0.9);
            }
            .content { 
              padding: 40px 30px; 
            }
            .content p {
              margin: 0 0 16px 0;
              font-size: 16px;
              line-height: 1.7;
            }
            .highlight-box { 
              background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
              border-left: 4px solid #667eea; 
              padding: 24px; 
              margin: 28px 0;
              border-radius: 4px;
            }
            .highlight-box p {
              margin: 0 0 8px 0;
              font-size: 15px;
            }
            .highlight-box p:last-child {
              margin: 0;
            }
            .reference-number {
              font-family: 'Courier New', monospace;
              font-size: 13px;
              color: #667eea;
              background: #ffffff;
              padding: 8px 12px;
              border-radius: 4px;
              display: inline-block;
              margin-top: 4px;
            }
            .cta-button { 
              display: inline-block; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: #ffffff !important; 
              padding: 14px 32px; 
              text-decoration: none; 
              border-radius: 6px; 
              font-weight: 600;
              font-size: 16px;
              margin: 24px 0;
              box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
              transition: all 0.3s ease;
            }
            .cta-section {
              text-align: center;
              margin: 32px 0;
            }
            .divider {
              height: 1px;
              background: linear-gradient(to right, transparent, #e5e7eb, transparent);
              margin: 32px 0;
            }
            .next-steps {
              background: #fafafa;
              padding: 24px;
              border-radius: 8px;
              margin: 24px 0;
            }
            .next-steps h3 {
              margin: 0 0 16px 0;
              font-size: 18px;
              color: #1a1a1a;
              font-weight: 600;
            }
            .next-steps ol {
              margin: 0;
              padding-left: 20px;
            }
            .next-steps li {
              margin-bottom: 12px;
              font-size: 15px;
              color: #4a5568;
            }
            .next-steps li:last-child {
              margin-bottom: 0;
            }
            .footer { 
              background: #fafafa;
              text-align: center; 
              padding: 32px 30px; 
              border-top: 1px solid #e5e7eb;
            }
            .footer p {
              margin: 0;
              font-size: 14px;
              color: #6b7280;
              line-height: 1.6;
            }
            .footer strong {
              color: #1a1a1a;
              display: block;
              margin-bottom: 8px;
              font-size: 16px;
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="header">
              <h1>🎉 Registration Approved!</h1>
              <p>Young Eagles Preschool</p>
            </div>
            
            <div class="content">
              <p>Dear <strong>${registration.guardian_name}</strong>,</p>
              
              <p>We are delighted to inform you that <strong>${registration.student_first_name} ${registration.student_last_name}</strong>'s registration has been approved! Welcome to the Young Eagles Preschool family.</p>
              
              <div class="highlight-box">
                <p><strong>📋 Your Reference Number</strong></p>
                <div class="reference-number">${registration.application_number || registration.id}</div>
                <p style="margin-top: 16px;"><strong>📧 Registered Email</strong></p>
                <p style="margin: 4px 0 0 0; color: #667eea;">${registration.guardian_email}</p>
              </div>
              
              <div class="cta-section">
                <a href="https://edudashpro.org.za/reset-password" class="cta-button">Set Up Your Account</a>
                <p style="margin: 12px 0 0 0; font-size: 14px; color: #6b7280;">Click above to create your password and access your dashboard</p>
              </div>
              
              <div class="divider"></div>
              
              <div class="next-steps">
                <h3>🔐 How to Set Up Your Password</h3>
                <ol>
                  <li><strong>Click the "Set Up Your Account" button</strong> above (or visit https://edudashpro.org.za/reset-password)</li>
                  <li><strong>Enter your email address:</strong> ${registration.guardian_email}</li>
                  <li><strong>Click "Reset Password"</strong> - you will receive a password reset email</li>
                  <li><strong>Open the password reset email</strong> and click the link inside</li>
                  <li><strong>Create your new password</strong> (minimum 8 characters)</li>
                  <li><strong>Log in to your dashboard</strong> at https://edudashpro.org.za</li>
                </ol>
                <p style="margin-top: 16px; padding: 12px; background: #fff3cd; border-radius: 4px; font-size: 14px; color: #856404;">
                  ⚠️ <strong>Important:</strong> This is your first time logging in, so you need to set your password using the "Forgot Password" / "Reset Password" option.
                </p>
              </div>
              
              <div class="divider"></div>
              
              <div class="next-steps">
                <h3>📝 After Logging In</h3>
                <ol>
                  <li>Complete your child's profile information</li>
                  <li>Upload any remaining required documents</li>
                  <li>Review the school calendar and upcoming events</li>
                  <li>Download the EduDash Pro mobile app for easier access</li>
                  <li>Explore the parent dashboard features</li>
                </ol>
              </div>
              
              <p style="margin-top: 28px;">If you have any questions or need assistance, please don't hesitate to contact us. We look forward to having ${registration.student_first_name} join our learning community!</p>
              
              <p style="margin-top: 24px; font-size: 15px;">Warm regards,<br><strong>The Young Eagles Team</strong></p>
            </div>
            
            <div class="footer">
              <p><strong>Young Eagles Preschool</strong></p>
              <p>📧 admin@youngeagles.org.za<br>📞 +27 XX XXX XXXX<br>🌐 youngeagles.org.za</p>
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
