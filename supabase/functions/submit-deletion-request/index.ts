/**
 * Submit Data Deletion Request Edge Function
 * 
 * Receives deletion requests from the web form and stores them in the database.
 * Sends confirmation email to user and notification to privacy team.
 * 
 * POST /functions/v1/submit-deletion-request
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface DeletionRequest {
  fullName: string;
  email: string;
  role: 'principal' | 'teacher' | 'parent' | 'student';
  organization?: string;
  deletionTypes: string[];
  reason?: string;
  requestId: string;
  timestamp: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Parse request body
    const body: DeletionRequest = await req.json();

    // Validate required fields
    if (!body.fullName || !body.email || !body.role || !body.deletionTypes?.length || !body.requestId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for inserting
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Check for existing pending requests from this email (rate limiting)
    const { data: existingRequests, error: checkError } = await supabaseAdmin
      .from('deletion_requests')
      .select('id, status, submitted_at')
      .eq('email', body.email.toLowerCase())
      .in('status', ['pending', 'verified', 'processing'])
      .order('submitted_at', { ascending: false })
      .limit(1);

    if (checkError) {
      console.error('Check existing error:', checkError);
    }

    if (existingRequests && existingRequests.length > 0) {
      const existing = existingRequests[0];
      return new Response(
        JSON.stringify({ 
          error: 'You already have a pending deletion request',
          existingRequestId: existing.id,
          status: existing.status,
          submittedAt: existing.submitted_at,
          message: `You submitted a deletion request on ${new Date(existing.submitted_at).toLocaleDateString()}. Please wait for it to be processed, or contact privacy@edudashpro.org.za if you need to update it.`
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user exists and get their ID (use maybeSingle to avoid 406 error)
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', body.email.toLowerCase())
      .maybeSingle();

    // Insert deletion request
    const { data: insertedRequest, error: insertError } = await supabaseAdmin
      .from('deletion_requests')
      .insert({
        request_id: body.requestId,
        full_name: body.fullName,
        email: body.email.toLowerCase(),
        user_id: existingUser?.id || null,
        role: body.role,
        organization: body.organization || null,
        deletion_types: body.deletionTypes,
        reason: body.reason || null,
        submitted_at: body.timestamp || new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      
      // Check for duplicate request
      if (insertError.code === '23505') {
        return new Response(
          JSON.stringify({ error: 'A request with this ID already exists' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw insertError;
    }

    // Format deletion types for email
    const deletionTypeLabels: Record<string, string> = {
      'full_account': 'Full Account Deletion',
      'voice_recordings': 'Voice Recordings',
      'ai_conversations': 'AI Conversations',
      'uploaded_files': 'Uploaded Files',
      'analytics_data': 'Analytics Data',
      'other': 'Other',
    };

    const formattedTypes = body.deletionTypes
      .map(t => deletionTypeLabels[t] || t)
      .join(', ');

    // Send confirmation email to user via Resend (if configured)
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    
    if (RESEND_API_KEY) {
      try {
        // Email to user
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'EduDash Pro <privacy@edudashpro.org.za>',
            to: body.email,
            subject: `Data Deletion Request Received - ${body.requestId}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0f; color: #ffffff; padding: 40px; border-radius: 12px;">
                <h1 style="color: #00f5ff; margin-bottom: 24px;">Data Deletion Request Received</h1>
                
                <p style="color: #9CA3AF; margin-bottom: 16px;">
                  Hello ${body.fullName},
                </p>
                
                <p style="color: #9CA3AF; margin-bottom: 24px;">
                  We have received your data deletion request. Here are the details:
                </p>
                
                <div style="background: #1a1a24; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
                  <p style="margin: 8px 0;"><strong style="color: #00f5ff;">Request ID:</strong> <span style="color: #ffffff;">${body.requestId}</span></p>
                  <p style="margin: 8px 0;"><strong style="color: #00f5ff;">Data to Delete:</strong> <span style="color: #ffffff;">${formattedTypes}</span></p>
                  <p style="margin: 8px 0;"><strong style="color: #00f5ff;">Submitted:</strong> <span style="color: #ffffff;">${new Date(body.timestamp).toLocaleString()}</span></p>
                </div>
                
                <h2 style="color: #00f5ff; font-size: 18px; margin-bottom: 16px;">What Happens Next?</h2>
                
                <ol style="color: #9CA3AF; line-height: 1.8; padding-left: 20px;">
                  <li>We will verify your identity within <strong>72 hours</strong></li>
                  <li>You'll receive a confirmation email to authorize the deletion</li>
                  <li>Your data will be marked for deletion with a <strong>30-day grace period</strong></li>
                  <li>After 30 days, data is permanently deleted</li>
                </ol>
                
                <div style="background: rgba(255, 170, 0, 0.1); padding: 16px; border-radius: 8px; border-left: 4px solid #ffaa00; margin: 24px 0;">
                  <p style="color: #ffaa00; margin: 0;">
                    <strong>⚠️ Changed your mind?</strong><br>
                    Contact us at <a href="mailto:privacy@edudashpro.org.za" style="color: #00f5ff;">privacy@edudashpro.org.za</a> within 30 days to cancel this request.
                  </p>
                </div>
                
                <hr style="border: none; border-top: 1px solid #2a2a3a; margin: 24px 0;">
                
                <p style="color: #6B7280; font-size: 14px; text-align: center;">
                  EduDash Pro Privacy Team<br>
                  <a href="https://edudashpro.org.za/privacy" style="color: #00f5ff;">Privacy Policy</a>
                </p>
              </div>
            `,
          }),
        });

        // Email to privacy team and superadmin
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'EduDash Pro System <noreply@edudashpro.org.za>',
            to: ['privacy@edudashpro.org.za', 'superadmin@edudashpro.org.za'],
            subject: `🗑️ New Deletion Request - ${body.requestId}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1>New Data Deletion Request</h1>
                
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Request ID</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${body.requestId}</td></tr>
                  <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Name</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${body.fullName}</td></tr>
                  <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Email</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${body.email}</td></tr>
                  <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Role</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${body.role}</td></tr>
                  <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Organization</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${body.organization || 'N/A'}</td></tr>
                  <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Delete</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formattedTypes}</td></tr>
                  <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Reason</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${body.reason || 'Not provided'}</td></tr>
                  <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>User ID</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${existingUser?.id || 'Not found'}</td></tr>
                </table>
                
                <p style="margin-top: 24px;">
                  <a href="https://edudashpro.org.za/admin/deletion-requests" style="background: #00f5ff; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                    Process Request
                  </a>
                </p>
              </div>
            `,
          }),
        });

        console.log('Emails sent successfully');
      } catch (emailError) {
        console.error('Email send error:', emailError);
        // Don't fail the request if email fails
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        requestId: body.requestId,
        message: 'Your deletion request has been submitted successfully. You will receive a confirmation email shortly.',
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
