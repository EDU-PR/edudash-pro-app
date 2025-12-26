// Supabase Edge Function: admin-invite
// Creates admin/team member invites and sends invitation emails
// Super-admin only - requires RESEND_API_KEY

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SUPABASE_SERVICE_ROLE_KEY=REDACTED
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'noreply@edudashpro.com';
const APP_URL = Deno.env.get('APP_URL') || 'https://edudashpro.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Valid admin roles
const ADMIN_ROLES = [
  'admin',
  'content_moderator',
  'support_admin',
  'billing_admin',
  'system_admin',
  'super_admin',
  'superadmin',
];

// Valid departments
const DEPARTMENTS = [
  'engineering',
  'customer_success',
  'content',
  'operations',
  'marketing',
  'finance',
];

interface AdminInviteRequest {
  email: string;
  full_name: string;
  role: string;
  department: string;
  send_email?: boolean;
}

interface AdminInviteResponse {
  success: boolean;
  invite_id?: string;
  user_id?: string;
  invite_link?: string;
  error?: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only POST allowed
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization') || '';
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is super admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, first_name, last_name')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ success: false, error: 'Profile not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only super admins can invite other admins
    const isSuperAdmin = profile.role === 'super_admin' || profile.role === 'superadmin';
    if (!isSuperAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Only super admins can invite admin users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: AdminInviteRequest = await req.json();
    const { email, full_name, role, department, send_email = true } = body;

    // Validate required fields
    if (!email || !full_name || !role || !department) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: email, full_name, role, department' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate role
    if (!ADMIN_ROLES.includes(role)) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid role. Must be one of: ${ADMIN_ROLES.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate department
    if (!DEPARTMENTS.includes(department)) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid department. Must be one of: ${DEPARTMENTS.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client for admin operations
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if email already exists
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ success: false, error: 'A user with this email already exists' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate invite token
    const inviteToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

    // Parse full name
    const nameParts = full_name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Create admin invite record
    const { data: invite, error: inviteError } = await adminClient
      .from('admin_invites')
      .insert({
        email: email.toLowerCase(),
        full_name,
        first_name: firstName,
        last_name: lastName,
        role,
        department,
        invite_token: inviteToken,
        invited_by: user.id,
        expires_at: expiresAt.toISOString(),
        status: 'pending',
      })
      .select()
      .single();

    // If table doesn't exist, create in-memory and use magic link flow
    if (inviteError && inviteError.code === '42P01') {
      console.log('[admin-invite] admin_invites table not found, using direct user creation');
      
      // Generate a secure temporary password
      const tempPassword = crypto.randomUUID();
      
      // Create user directly with email confirmation
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: email.toLowerCase(),
        password: tempPassword,
        email_confirm: false, // User must verify email
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          role,
          department,
          invited_by: user.id,
          is_admin_invite: true,
        },
      });

      if (createError) {
        console.error('[admin-invite] Failed to create user:', createError);
        return new Response(
          JSON.stringify({ success: false, error: `Failed to create user: ${createError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!newUser?.user) {
        return new Response(
          JSON.stringify({ success: false, error: 'User creation failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create profile for the new admin
      const { error: profileCreateError } = await adminClient
        .from('profiles')
        .insert({
          id: newUser.user.id,
          email: email.toLowerCase(),
          first_name: firstName,
          last_name: lastName,
          role,
          department,
          is_active: true,
          capabilities: getCapabilitiesForRole(role),
          metadata: {
            invited_by: user.id,
            invite_date: new Date().toISOString(),
            is_admin_user: true,
          },
        });

      if (profileCreateError) {
        console.error('[admin-invite] Failed to create profile:', profileCreateError);
        // Don't fail - user was created, profile will be created on first login
      }

      // Generate password reset link for the user to set their password
      const { data: resetData, error: resetError } = await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email: email.toLowerCase(),
        options: {
          redirectTo: `${APP_URL}/auth/reset-password`,
        },
      });

      const inviteLink = resetData?.properties?.action_link || `${APP_URL}/auth/reset-password`;

      // Send invitation email
      if (send_email && RESEND_API_KEY) {
        await sendInviteEmail({
          to: email,
          inviteeName: full_name,
          inviterName: `${profile.first_name} ${profile.last_name}`.trim() || 'EduDash Pro Admin',
          role: formatRoleName(role),
          inviteLink,
        });
      }

      // Log the invite action
      await logAdminAction(adminClient, {
        action: 'admin_invite_sent',
        actor_id: user.id,
        target_id: newUser.user.id,
        metadata: {
          email,
          role,
          department,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          user_id: newUser.user.id,
          invite_link: inviteLink,
          message: `Invitation sent to ${email}`,
        } as AdminInviteResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (inviteError) {
      console.error('[admin-invite] Failed to create invite:', inviteError);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to create invite: ${inviteError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build invite link
    const inviteLink = `${APP_URL}/invite/admin?token=${inviteToken}`;

    // Send invitation email
    if (send_email && RESEND_API_KEY) {
      await sendInviteEmail({
        to: email,
        inviteeName: full_name,
        inviterName: `${profile.first_name} ${profile.last_name}`.trim() || 'EduDash Pro Admin',
        role: formatRoleName(role),
        inviteLink,
      });
    }

    // Log the invite action
    await logAdminAction(adminClient, {
      action: 'admin_invite_sent',
      actor_id: user.id,
      target_id: invite.id,
      metadata: {
        email,
        role,
        department,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        invite_id: invite.id,
        invite_link: inviteLink,
        message: `Invitation sent to ${email}`,
      } as AdminInviteResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[admin-invite] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper to get capabilities based on role
function getCapabilitiesForRole(role: string): string[] {
  const baseCapabilities = [
    'access_web_app',
    'access_admin_dashboard',
  ];

  const roleCapabilities: Record<string, string[]> = {
    'admin': [
      ...baseCapabilities,
      'manage_users',
      'view_analytics',
      'manage_schools',
    ],
    'content_moderator': [
      ...baseCapabilities,
      'moderate_content',
      'view_reports',
      'manage_flags',
    ],
    'support_admin': [
      ...baseCapabilities,
      'view_users',
      'manage_tickets',
      'impersonate_users',
    ],
    'billing_admin': [
      ...baseCapabilities,
      'view_billing',
      'manage_subscriptions',
      'process_refunds',
    ],
    'system_admin': [
      ...baseCapabilities,
      'manage_settings',
      'view_logs',
      'manage_integrations',
    ],
    'super_admin': [
      ...baseCapabilities,
      'manage_users',
      'view_analytics',
      'manage_schools',
      'moderate_content',
      'manage_tickets',
      'view_billing',
      'manage_subscriptions',
      'manage_settings',
      'full_access',
    ],
    'superadmin': [
      ...baseCapabilities,
      'manage_users',
      'view_analytics',
      'manage_schools',
      'moderate_content',
      'manage_tickets',
      'view_billing',
      'manage_subscriptions',
      'manage_settings',
      'full_access',
    ],
  };

  return roleCapabilities[role] || baseCapabilities;
}

// Format role name for display
function formatRoleName(role: string): string {
  const roleNames: Record<string, string> = {
    'admin': 'Administrator',
    'content_moderator': 'Content Moderator',
    'support_admin': 'Support Administrator',
    'billing_admin': 'Billing Administrator',
    'system_admin': 'System Administrator',
    'super_admin': 'Super Administrator',
    'superadmin': 'Super Administrator',
  };
  return roleNames[role] || role;
}

// Send invite email via Resend
async function sendInviteEmail(params: {
  to: string;
  inviteeName: string;
  inviterName: string;
  role: string;
  inviteLink: string;
}): Promise<void> {
  const { to, inviteeName, inviterName, role, inviteLink } = params;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited to Join EduDash Pro</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🎉 You're Invited!</h1>
  </div>
  
  <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 18px; margin-top: 0;">Hi ${inviteeName},</p>
    
    <p>${inviterName} has invited you to join the <strong>EduDash Pro</strong> team as a <strong>${role}</strong>.</p>
    
    <p>EduDash Pro is a comprehensive educational platform that helps schools manage their operations, lessons, and communications effectively.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Accept Invitation</a>
    </div>
    
    <p style="color: #666; font-size: 14px;">This invitation link will expire in 7 days. If you have any questions, please contact your administrator.</p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    
    <p style="color: #999; font-size: 12px; margin-bottom: 0;">
      If you didn't expect this invitation, you can safely ignore this email.<br>
      © ${new Date().getFullYear()} EduDash Pro. All rights reserved.
    </p>
  </div>
</body>
</html>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject: `You're invited to join EduDash Pro as ${role}`,
        html: htmlBody,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[admin-invite] Resend error:', errorText);
    } else {
      console.log('[admin-invite] Email sent successfully to:', to);
    }
  } catch (error) {
    console.error('[admin-invite] Failed to send email:', error);
  }
}

// Log admin action for audit trail
async function logAdminAction(
  client: any,
  params: {
    action: string;
    actor_id: string;
    target_id: string;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  try {
    await client
      .from('admin_audit_logs')
      .insert({
        action: params.action,
        actor_id: params.actor_id,
        target_id: params.target_id,
        metadata: params.metadata || {},
        created_at: new Date().toISOString(),
      });
  } catch (error) {
    // Non-fatal - just log
    console.error('[admin-invite] Failed to log action:', error);
  }
}
