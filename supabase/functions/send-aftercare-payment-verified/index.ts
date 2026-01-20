// Supabase Edge Function: send-aftercare-payment-verified
// Sends notification email when principal verifies parent's payment
// Informs parent that payment was received and next steps

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY=REDACTED
const FROM_EMAIL = 'EduDash Pro <noreply@edudashpro.org.za>';
const SUPPORT_EMAIL = 'support@edudashpro.org.za';
const WHATSAPP_GROUP_LINK = 'https://chat.whatsapp.com/FQVPXqY6daRLIonPjQqZTv';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PaymentVerifiedEmailRequest {
  registration_id: string;
  parent_email: string;
  parent_name: string;
  child_name: string;
  payment_amount?: number;
  verified_by?: string;
}

function generatePaymentVerifiedEmailHTML(data: PaymentVerifiedEmailRequest): string {
  const currentYear = new Date().getFullYear();
  const amountText = data.payment_amount ? `R${data.payment_amount.toFixed(2)}` : 'your payment';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Verified</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f5;">
  
  <!-- Header -->
  <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 40px 20px; text-align: center;">
    <h1 style="margin: 0; color: white; font-size: 28px;">🎓 EduDash Pro</h1>
    <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Community School Aftercare</p>
  </div>
  
  <!-- Content -->
  <div style="max-width: 600px; margin: 0 auto; padding: 30px 20px;">
    
    <!-- Success Card -->
    <div style="background: white; border-radius: 16px; padding: 30px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
      
      <!-- Success Icon -->
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="display: inline-block; background: #ecfdf5; border-radius: 50%; padding: 20px;">
          <span style="font-size: 48px;">✅</span>
        </div>
      </div>
      
      <h2 style="margin: 0 0 15px 0; color: #065f46; font-size: 24px; text-align: center;">
        Payment Verified!
      </h2>
      
      <p style="color: #4a5568; line-height: 1.6; margin: 0 0 20px 0;">
        Dear <strong>${data.parent_name}</strong>,
      </p>
      
      <p style="color: #4a5568; line-height: 1.6; margin: 0 0 20px 0;">
        Great news! We have verified ${amountText} for <strong>${data.child_name}</strong>'s aftercare registration at EduDash Pro Community School.
      </p>
      
      <div style="background: #ecfdf5; border-left: 4px solid #10B981; padding: 15px; border-radius: 0 8px 8px 0; margin: 20px 0;">
        <p style="margin: 0; color: #065f46; font-weight: 600;">
          🎉 Your payment has been successfully verified and recorded.
        </p>
      </div>
    </div>
    
    <!-- What's Next Card -->
    <div style="background: white; border-radius: 16px; padding: 25px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
      <h3 style="margin: 0 0 15px 0; color: #1a1a2e; font-size: 18px;">
        📝 What Happens Next?
      </h3>
      <p style="color: #4a5568; line-height: 1.6; margin: 0 0 15px 0;">
        The school principal will now process your child's enrollment. You will receive another email with:
      </p>
      <ul style="color: #4a5568; line-height: 1.8; margin: 0; padding-left: 20px;">
        <li>Your parent account login details</li>
        <li>Access to the EduDash Pro parent portal</li>
        <li>Important information about the aftercare schedule</li>
        <li>Emergency contact procedures</li>
      </ul>
      
      <div style="background: #fef3c7; border-radius: 8px; padding: 12px; margin-top: 15px;">
        <p style="margin: 0; color: #92400e; font-size: 14px;">
          ⏰ <strong>Expected timeline:</strong> 1-2 business days
        </p>
      </div>
    </div>
    
    <!-- WhatsApp Reminder -->
    <div style="background: white; border-radius: 16px; padding: 25px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
      <h3 style="margin: 0 0 15px 0; color: #1a1a2e; font-size: 18px;">
        💬 Join Our Community
      </h3>
      <p style="color: #4a5568; line-height: 1.6; margin: 0 0 15px 0;">
        Haven't joined our WhatsApp group yet? Connect with other parents and stay updated!
      </p>
      <a href="${WHATSAPP_GROUP_LINK}" style="display: inline-block; background: #25D366; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        Join WhatsApp Group →
      </a>
    </div>
    
    <!-- Support -->
    <div style="text-align: center; padding: 20px;">
      <p style="color: #718096; margin: 0 0 10px 0;">
        Questions? We're here to help!
      </p>
      <a href="mailto:${SUPPORT_EMAIL}" style="color: #667eea; text-decoration: none; font-weight: 500;">
        ${SUPPORT_EMAIL}
      </a>
    </div>
    
  </div>
  
  <!-- Footer -->
  <div style="text-align: center; padding: 30px 20px; background: #f8fafc;">
    <p style="color: #94a3b8; font-size: 12px; margin: 0;">
      EduDash Pro Community School Aftercare<br>
      © ${currentYear} EduDash Pro. All rights reserved.
    </p>
  </div>
  
</body>
</html>`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: PaymentVerifiedEmailRequest = await req.json();
    console.log('[send-aftercare-payment-verified] Request:', {
      registration_id: body.registration_id,
      parent_email: body.parent_email,
      child_name: body.child_name,
    });

    // Validate required fields
    if (!body.parent_email || !body.parent_name || !body.child_name) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!RESEND_API_KEY) {
      console.error('[send-aftercare-payment-verified] RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate email content
    const emailHtml = generatePaymentVerifiedEmailHTML(body);
    const subject = `✅ Payment Verified - ${body.child_name}'s Aftercare Registration`;

    // Send email via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [body.parent_email],
        subject: subject,
        html: emailHtml,
        reply_to: SUPPORT_EMAIL,
      }),
    });

    const resendData = await resendResponse.json();
    console.log('[send-aftercare-payment-verified] Resend response:', {
      status: resendResponse.status,
      id: resendData.id,
    });

    if (!resendResponse.ok) {
      console.error('[send-aftercare-payment-verified] Resend error:', resendData);
      return new Response(
        JSON.stringify({ success: false, error: resendData.message || 'Failed to send email' }),
        { status: resendResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log to database if available
    if (SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabase.from('email_logs').insert({
          recipient: body.parent_email,
          subject: subject,
          status: 'sent',
          message_id: resendData.id,
          metadata: {
            type: 'aftercare_payment_verified',
            registration_id: body.registration_id,
            child_name: body.child_name,
            payment_amount: body.payment_amount,
          },
        });
      } catch (logErr) {
        console.warn('[send-aftercare-payment-verified] Could not log email:', logErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message_id: resendData.id,
        message: 'Payment verified email sent successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[send-aftercare-payment-verified] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
