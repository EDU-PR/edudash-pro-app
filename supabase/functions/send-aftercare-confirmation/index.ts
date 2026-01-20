// Supabase Edge Function: send-aftercare-confirmation
// Sends confirmation email when parent registers for aftercare
// Includes banking details for payment and WhatsApp group link

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY=REDACTED
const FROM_EMAIL = 'EduDash Pro <noreply@edudashpro.org.za>';
const SUPPORT_EMAIL = 'support@edudashpro.org.za';
const WHATSAPP_GROUP_LINK = 'https://chat.whatsapp.com/FQVPXqY6daRLIonPjQqZTv';

// Community School banking details (EduDash Pro Pty Ltd - Capitec Business)
const BANK_DETAILS = {
  bank_name: 'Capitec Bank',
  account_holder: 'EduDash Pro Pty Ltd',
  account_number: '1053747152',
  branch_code: '450105',
  account_type: 'Business',
  reference_prefix: 'AC-',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConfirmationEmailRequest {
  registration_id: string;
  parent_email: string;
  parent_name: string;
  child_name: string;
  payment_reference: string;
  has_proof: boolean;
  registration_fee?: number;
  is_early_bird?: boolean;
}

function generateConfirmationEmailHTML(data: ConfirmationEmailRequest): string {
  const currentYear = new Date().getFullYear();
  const feeAmount = data.registration_fee || (data.is_early_bird ? 200 : 400);
  const originalFee = 400;
  const discountText = data.is_early_bird 
    ? `<span style="color: #10B981; font-weight: bold;">R${feeAmount}</span> <span style="text-decoration: line-through; color: #999;">R${originalFee}</span> (50% Early Bird Discount!)`
    : `<strong>R${feeAmount}</strong>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aftercare Registration Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f5;">
  
  <!-- Header -->
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
    <h1 style="margin: 0; color: white; font-size: 28px;">🎓 EduDash Pro</h1>
    <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Community School Aftercare</p>
  </div>
  
  <!-- Content -->
  <div style="max-width: 600px; margin: 0 auto; padding: 30px 20px;">
    
    <!-- Welcome Card -->
    <div style="background: white; border-radius: 16px; padding: 30px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
      <h2 style="margin: 0 0 15px 0; color: #1a1a2e; font-size: 24px;">
        Registration Received! ✅
      </h2>
      
      <p style="color: #4a5568; line-height: 1.6; margin: 0 0 20px 0;">
        Dear <strong>${data.parent_name}</strong>,
      </p>
      
      <p style="color: #4a5568; line-height: 1.6; margin: 0 0 20px 0;">
        Thank you for registering <strong>${data.child_name}</strong> for the EduDash Pro Community School 2026 Aftercare Program! We're excited to have your child join us.
      </p>
      
      <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 15px; border-radius: 0 8px 8px 0; margin: 20px 0;">
        <p style="margin: 0; color: #1e40af; font-weight: 600;">
          📋 Your Payment Reference: <code style="background: #dbeafe; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${data.payment_reference}</code>
        </p>
      </div>
      
      ${!data.has_proof ? `
      <!-- Banking Details (only if no proof uploaded) -->
      <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px 0; color: #92400e; font-size: 18px;">
          💳 Banking Details for Payment
        </h3>
        <p style="color: #78350f; margin: 0 0 15px 0;">
          Registration Fee: ${discountText}
        </p>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #78350f; font-weight: 500;">Bank:</td>
            <td style="padding: 8px 0; color: #1a1a2e;">${BANK_DETAILS.bank_name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #78350f; font-weight: 500;">Account Name:</td>
            <td style="padding: 8px 0; color: #1a1a2e;">${BANK_DETAILS.account_holder}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #78350f; font-weight: 500;">Account Number:</td>
            <td style="padding: 8px 0; color: #1a1a2e; font-family: monospace;">${BANK_DETAILS.account_number}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #78350f; font-weight: 500;">Branch Code:</td>
            <td style="padding: 8px 0; color: #1a1a2e; font-family: monospace;">${BANK_DETAILS.branch_code}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #78350f; font-weight: 500;">Account Type:</td>
            <td style="padding: 8px 0; color: #1a1a2e;">${BANK_DETAILS.account_type}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #78350f; font-weight: 500;">Reference:</td>
            <td style="padding: 8px 0; color: #1a1a2e; font-family: monospace; font-weight: bold;">${data.payment_reference}</td>
          </tr>
        </table>
        
        <div style="background: #fef3c7; border-radius: 8px; padding: 12px; margin-top: 15px;">
          <p style="margin: 0; color: #92400e; font-size: 14px;">
            ⚠️ <strong>Important:</strong> Please use the reference above when making payment so we can match your payment to this registration.
          </p>
        </div>
      </div>
      ` : `
      <!-- Proof Received Confirmation -->
      <div style="background: #ecfdf5; border: 1px solid #34d399; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #065f46; font-size: 18px;">
          ✅ Proof of Payment Received
        </h3>
        <p style="color: #047857; margin: 0;">
          We have received your proof of payment. Our team will verify it and process your registration within 1-2 business days.
        </p>
      </div>
      `}
    </div>
    
    <!-- WhatsApp Group Card -->
    <div style="background: white; border-radius: 16px; padding: 25px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
      <h3 style="margin: 0 0 15px 0; color: #1a1a2e; font-size: 18px;">
        💬 Join Our WhatsApp Group
      </h3>
      <p style="color: #4a5568; line-height: 1.6; margin: 0 0 15px 0;">
        Stay connected with other parents and receive important updates about the aftercare program.
      </p>
      <a href="${WHATSAPP_GROUP_LINK}" style="display: inline-block; background: #25D366; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        Join WhatsApp Group →
      </a>
    </div>
    
    <!-- Next Steps -->
    <div style="background: white; border-radius: 16px; padding: 25px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
      <h3 style="margin: 0 0 15px 0; color: #1a1a2e; font-size: 18px;">
        📝 What Happens Next?
      </h3>
      <ol style="color: #4a5568; line-height: 1.8; margin: 0; padding-left: 20px;">
        ${!data.has_proof ? `<li>Make payment using the banking details above</li>
        <li>Send proof of payment via the app or reply to this email</li>` : ''}
        <li>Our team will verify your payment (1-2 business days)</li>
        <li>You'll receive a welcome email with your login details</li>
        <li>Access the parent portal to view schedules and updates</li>
      </ol>
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
    const body: ConfirmationEmailRequest = await req.json();
    console.log('[send-aftercare-confirmation] Request:', {
      registration_id: body.registration_id,
      parent_email: body.parent_email,
      child_name: body.child_name,
      has_proof: body.has_proof,
    });

    // Validate required fields
    if (!body.parent_email || !body.parent_name || !body.child_name || !body.payment_reference) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!RESEND_API_KEY) {
      console.error('[send-aftercare-confirmation] RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate email content
    const emailHtml = generateConfirmationEmailHTML(body);
    const subject = body.has_proof
      ? `✅ Aftercare Registration Received - ${body.child_name}`
      : `📋 Aftercare Registration Received - Payment Required for ${body.child_name}`;

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
    console.log('[send-aftercare-confirmation] Resend response:', {
      status: resendResponse.status,
      id: resendData.id,
    });

    if (!resendResponse.ok) {
      console.error('[send-aftercare-confirmation] Resend error:', resendData);
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
            type: 'aftercare_confirmation',
            registration_id: body.registration_id,
            child_name: body.child_name,
            has_proof: body.has_proof,
          },
        });
      } catch (logErr) {
        console.warn('[send-aftercare-confirmation] Could not log email:', logErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message_id: resendData.id,
        message: 'Confirmation email sent successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[send-aftercare-confirmation] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
