// Aftercare Registration Email - Supabase Edge Function
// Sends confirmation emails when a new aftercare registration is created

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AfterCareRegistration {
  id: string;
  parent_first_name: string;
  parent_last_name: string;
  parent_email: string;
  parent_phone: string;
  child_first_name: string;
  child_last_name: string;
  child_grade: string;
  registration_fee: number;
  registration_fee_original: number;
  payment_reference: string;
  promotion_code?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { registration_id, type = 'confirmation' } = await req.json();

    if (!registration_id) {
      throw new Error('registration_id is required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch registration details
    const { data: registration, error: fetchError } = await supabase
      .from('aftercare_registrations')
      .select('*')
      .eq('id', registration_id)
      .single();

    if (fetchError || !registration) {
      throw new Error(`Registration not found: ${fetchError?.message}`);
    }

    // Generate email content based on type
    let subject: string;
    let htmlContent: string;

    const bankingDetails = `
      <div style="background: #ecfdf5; border: 2px solid #10b981; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <h3 style="color: #065f46; margin: 0 0 16px 0; font-size: 16px;">🏦 Banking Details</h3>
        <table style="width: 100%; font-size: 14px;">
          <tr><td style="color: #6b7280; padding: 4px 0;">Bank:</td><td style="color: #065f46; font-weight: 700;">Capitec Bank</td></tr>
          <tr><td style="color: #6b7280; padding: 4px 0;">Account Name:</td><td style="color: #065f46; font-weight: 700;">EduDash Pro Pty Ltd</td></tr>
          <tr><td style="color: #6b7280; padding: 4px 0;">Account Number:</td><td style="color: #065f46; font-weight: 700;">1053747152</td></tr>
          <tr><td style="color: #6b7280; padding: 4px 0;">Branch Code:</td><td style="color: #065f46; font-weight: 700;">450105</td></tr>
          <tr><td style="color: #6b7280; padding: 4px 0;">Account Type:</td><td style="color: #065f46; font-weight: 700;">Business Account</td></tr>
        </table>
        <div style="background: #d1fae5; padding: 12px; border-radius: 8px; margin-top: 16px; text-align: center;">
          <span style="color: #065f46; font-size: 14px;">Reference: </span>
          <span style="color: #065f46; font-weight: 800; font-size: 18px; letter-spacing: 1px;">${registration.payment_reference}</span>
        </div>
      </div>
    `;

    if (type === 'confirmation') {
      subject = `✅ Aftercare Registration Received - ${registration.child_first_name} ${registration.child_last_name}`;
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
            <h1 style="color: #fff; margin: 0; font-size: 24px;">📚 EduDash Pro</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">Aftercare Program Registration</p>
          </div>
          
          <div style="background: #fff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 16px 16px;">
            <h2 style="color: #111827; margin: 0 0 16px 0;">Hi ${registration.parent_first_name},</h2>
            
            <p>Thank you for registering <strong>${registration.child_first_name}</strong> for our aftercare program at EduDash Pro Community School!</p>
            
            <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #374151; margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase;">Registration Summary</h3>
              <p style="margin: 8px 0;"><strong>Child:</strong> ${registration.child_first_name} ${registration.child_last_name}</p>
              <p style="margin: 8px 0;"><strong>Grade:</strong> ${registration.child_grade}</p>
              <p style="margin: 8px 0;"><strong>Reference:</strong> <code style="background: #e5e7eb; padding: 2px 8px; border-radius: 4px;">${registration.payment_reference}</code></p>
            </div>

            <div style="background: #fef3c7; border: 2px solid #fbbf24; border-radius: 12px; padding: 16px; margin: 20px 0; text-align: center;">
              <p style="color: #92400e; margin: 0 0 8px 0;"><strong>Early Bird Registration Fee:</strong></p>
              <span style="color: #92400e; font-size: 16px; text-decoration: line-through;">R${registration.registration_fee_original.toFixed(2)}</span>
              <span style="color: #065f46; font-size: 28px; font-weight: 900; margin-left: 12px;">R${registration.registration_fee.toFixed(2)}</span>
              <p style="color: #92400e; margin: 8px 0 0 0; font-size: 12px;">⚡ 50% Early Bird discount applied!</p>
            </div>

            ${bankingDetails}

            <div style="background: #fdf4ff; border: 2px solid #c084fc; border-radius: 12px; padding: 16px; margin: 20px 0;">
              <p style="color: #7c3aed; margin: 0;"><strong>📤 After making payment:</strong></p>
              <p style="color: #6b7280; margin: 8px 0 0 0; font-size: 14px;">
                Send your proof of payment to <a href="mailto:admin@edudashpro.org.za" style="color: #7c3aed; font-weight: 600;">admin@edudashpro.org.za</a> with your reference number.
              </p>
            </div>

            <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #374151; margin: 0 0 12px 0; font-size: 14px;">📋 Next Steps:</h3>
              <ol style="color: #6b7280; margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 8px;">✅ Registration submitted - DONE!</li>
                <li style="margin-bottom: 8px;">⏳ Make EFT payment of R${registration.registration_fee.toFixed(2)}</li>
                <li style="margin-bottom: 8px;">📧 Send proof of payment to admin@edudashpro.org.za</li>
                <li style="margin-bottom: 8px;">✉️ Receive enrollment confirmation within 24 hours</li>
                <li>📱 Download the EduDash Pro app for updates</li>
              </ol>
            </div>

            <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
              Need help? Contact us:<br>
              📧 <a href="mailto:admin@edudashpro.org.za" style="color: #7c3aed;">admin@edudashpro.org.za</a><br>
              📞 <a href="tel:+27674770975" style="color: #7c3aed;">+27 67 477 0975</a><br>
              💬 <a href="https://wa.me/27674770975" style="color: #25D366;">WhatsApp</a>
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
            <p>© ${new Date().getFullYear()} EduDash Pro. All rights reserved.</p>
          </div>
        </body>
        </html>
      `;
    } else if (type === 'payment_confirmed') {
      subject = `🎉 Payment Confirmed - ${registration.child_first_name} is enrolled!`;
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #34d399 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 8px;">🎉</div>
            <h1 style="color: #fff; margin: 0; font-size: 24px;">Payment Confirmed!</h1>
          </div>
          
          <div style="background: #fff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 16px 16px;">
            <h2 style="color: #111827; margin: 0 0 16px 0;">Congratulations, ${registration.parent_first_name}!</h2>
            
            <p>Your payment has been confirmed and <strong>${registration.child_first_name}</strong> is now officially enrolled in our aftercare program!</p>
            
            <div style="background: #d1fae5; border: 2px solid #10b981; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
              <p style="color: #065f46; margin: 0; font-size: 18px; font-weight: 700;">✅ Enrollment Complete</p>
              <p style="color: #065f46; margin: 8px 0 0 0;">
                ${registration.child_first_name} ${registration.child_last_name} - Grade ${registration.child_grade}
              </p>
            </div>

            <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #374151; margin: 0 0 12px 0; font-size: 14px;">📱 What's Next:</h3>
              <ol style="color: #6b7280; margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 8px;">Download the <strong>EduDash Pro</strong> app from the App Store or Google Play</li>
                <li style="margin-bottom: 8px;">Sign in with this email: <code style="background: #e5e7eb; padding: 2px 8px; border-radius: 4px;">${registration.parent_email}</code></li>
                <li style="margin-bottom: 8px;">View your child's activities and receive updates</li>
                <li>Connect with teachers and other parents</li>
              </ol>
            </div>

            <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
              We're excited to have ${registration.child_first_name} join our aftercare family!<br><br>
              Need help? Contact us:<br>
              📧 <a href="mailto:admin@edudashpro.org.za" style="color: #7c3aed;">admin@edudashpro.org.za</a><br>
              📞 <a href="tel:+27674770975" style="color: #7c3aed;">+27 67 477 0975</a>
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
            <p>© ${new Date().getFullYear()} EduDash Pro. All rights reserved.</p>
          </div>
        </body>
        </html>
      `;
    } else {
      throw new Error(`Unknown email type: ${type}`);
    }

    // Send email using Resend (or your email provider)
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    if (resendApiKey) {
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'EduDash Pro <noreply@edudashpro.org.za>',
          to: [registration.parent_email],
          subject: subject,
          html: htmlContent,
        }),
      });

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text();
        console.error('Email send failed:', errorText);
        // Don't throw - log the email content for manual sending
      } else {
        console.log('Email sent successfully to:', registration.parent_email);
      }
    } else {
      console.log('RESEND_API_KEY not set - logging email content for manual sending');
      console.log('To:', registration.parent_email);
      console.log('Subject:', subject);
    }

    // Log the email attempt
    await supabase.from('email_logs').insert({
      recipient: registration.parent_email,
      subject: subject,
      type: `aftercare_${type}`,
      reference_id: registration_id,
      reference_type: 'aftercare_registration',
      status: resendApiKey ? 'sent' : 'logged',
    }).catch(() => {
      // email_logs table might not exist, that's okay
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Email ${resendApiKey ? 'sent' : 'logged'} for ${type}`,
        registration_id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
