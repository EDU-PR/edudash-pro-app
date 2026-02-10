// Supabase Edge Function: create-teacher-account
// Creates teacher accounts with temp password, links to school, sends welcome email.
// Used by principals to directly hire teachers or add temporary/trainee staff.
// VERSION: v2

declare const Deno: {
  env: { get(key: string): string | undefined };
};

// @ts-ignore - Deno URL imports
import { serve } from 'https://deno.land/std@0.214.0/http/server.ts';
// @ts-ignore - Deno URL imports
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { renderEduDashProEmail } from '../_shared/edudashproEmail.ts';

interface CreateTeacherRequest {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  school_id: string;
  teacher_type: 'permanent' | 'temporary' | 'trainee';
  subject_specialization?: string | null;
  notes?: string | null;
}

function generateTempPassword(length = 10): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  let pw = '';
  // Ensure at least one of each category
  pw += upper[Math.floor(Math.random() * upper.length)];
  pw += lower[Math.floor(Math.random() * lower.length)];
  pw += digits[Math.floor(Math.random() * digits.length)];
  for (let i = 3; i < length; i++) {
    pw += all[Math.floor(Math.random() * all.length)];
  }
  // Shuffle
  return pw
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handleCorsOptions(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Auth: verify caller is principal/admin/super_admin ──
    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: caller },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !caller) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized', code: 'AUTH_ERROR' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look up caller profile using admin client (bypass RLS)
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, organization_id, role')
      .eq('auth_user_id', caller.id)
      .maybeSingle();

    const allowedRoles = ['principal', 'principal_admin', 'admin', 'super_admin'];
    if (!callerProfile || !allowedRoles.includes(callerProfile.role)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Only principals and admins can create teacher accounts',
          code: 'UNAUTHORIZED',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Parse & validate request ──
    const body: CreateTeacherRequest = await req.json();
    if (!body.email || !body.first_name || !body.last_name || !body.school_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: email, first_name, last_name, school_id',
          code: 'VALIDATION_ERROR',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify caller has access to this school
    if (
      callerProfile.role !== 'super_admin' &&
      callerProfile.organization_id !== body.school_id
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'You can only create teachers in your own school',
          code: 'SCHOOL_MISMATCH',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get school name for the welcome email
    const { data: school } = await supabaseAdmin
      .from('preschools')
      .select('name')
      .eq('id', body.school_id)
      .maybeSingle();
    const schoolName = school?.name || 'your school';

    const email = body.email.toLowerCase().trim();
    const tempPassword = generateTempPassword(10);
    const teacherType = body.teacher_type || 'permanent';
    const fullName = `${body.first_name} ${body.last_name}`.trim();
    let tempPasswordForLogin: string | null = null;
    let loginMethodHint: string | null = null;
    const provisioningWarnings: string[] = [];

    // ── Check if user already exists ──
    // Query profile directly by email (faster and more reliable than listUsers scans)
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, auth_user_id, role, organization_id')
      .eq('email', email)
      .maybeSingle();

    let userId: string;
    let isExistingUser = false;

    if (existingProfile?.auth_user_id) {
      // User already exists — link them to this school instead of creating a new account
      userId = existingProfile.auth_user_id;
      isExistingUser = true;

      // Update their profile to this school
      const profilePatch: Record<string, unknown> = {
        role: 'teacher',
        preschool_id: body.school_id,
        organization_id: body.school_id,
        first_name: body.first_name,
        last_name: body.last_name,
        full_name: fullName,
        is_active: true,
        hire_date: new Date().toISOString().split('T')[0],
      };
      if (body.phone && body.phone.trim().length > 0) {
        profilePatch.phone = body.phone.trim();
      }
      const { error: existingProfileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update(profilePatch as any)
        .eq('id', existingProfile.id);
      if (existingProfileUpdateError) {
        throw new Error(`Failed to link profile: ${existingProfileUpdateError.message}`);
      }

      // Check auth providers and password state for existing users.
      const { data: existingAuthRow, error: existingAuthLookupError } = await supabaseAdmin
        .schema('auth')
        .from('users')
        .select('id, encrypted_password, raw_app_meta_data')
        .eq('id', userId)
        .maybeSingle();
      if (existingAuthLookupError) {
        provisioningWarnings.push(`Could not inspect auth providers: ${existingAuthLookupError.message}`);
      }

      const appMeta = (existingAuthRow?.raw_app_meta_data || {}) as Record<string, unknown>;
      const providerFromMeta = typeof appMeta.provider === 'string' ? appMeta.provider : null;
      const providersFromMeta = Array.isArray(appMeta.providers)
        ? (appMeta.providers as unknown[]).filter((p): p is string => typeof p === 'string')
        : [];
      const providerList = providersFromMeta.length > 0
        ? providersFromMeta
        : (providerFromMeta ? [providerFromMeta] : []);
      const hasPasswordCredential = Boolean(existingAuthRow?.encrypted_password);
      const isGoogleOnlyAccount = providerList.length > 0 && providerList.every((p) => p === 'google');

      // Existing social-only users do not have password credentials. Issue one for principal handoff.
      if (!hasPasswordCredential) {
        const { data: existingAuthData } = await supabaseAdmin.auth.admin.getUserById(userId);
        const existingMetadata = existingAuthData?.user?.user_metadata || {};
        const { error: setTempPasswordError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: tempPassword,
          user_metadata: {
            ...existingMetadata,
            force_password_change: true,
            temp_password_issued_by_admin: true,
            temp_password_issued_at: new Date().toISOString(),
            teacher_type: teacherType,
          },
        });
        if (setTempPasswordError) {
          provisioningWarnings.push(`Could not issue temporary password for existing account: ${setTempPasswordError.message}`);
          loginMethodHint = isGoogleOnlyAccount
            ? 'This user currently signs in with Google. Ask them to continue with Google Sign-In.'
            : 'Use existing account credentials to sign in.';
        } else {
          tempPasswordForLogin = tempPassword;
          loginMethodHint = 'A temporary password was generated for this existing account.';
        }
      } else {
        loginMethodHint = isGoogleOnlyAccount
          ? 'This user can sign in with Google.'
          : 'This user should continue using existing credentials.';
      }
    } else {
      // ── Create new auth user ──
      const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          first_name: body.first_name,
          last_name: body.last_name,
          phone: body.phone || null,
          force_password_change: true,
          created_by_admin: true,
          teacher_type: teacherType,
        },
      });

      if (createError || !authData.user) {
        const msg = createError?.message || 'Failed to create account';
        if (msg.includes('already been registered')) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'A user with this email already exists.',
              code: 'EMAIL_EXISTS',
            }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({ success: false, error: msg, code: 'CREATE_ERROR' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = authData.user.id;
      tempPasswordForLogin = tempPassword;

      // Wait for profile trigger
      await new Promise((r) => setTimeout(r, 1200));

      // Update profile with school linkage
      const { error: newProfileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({
          role: 'teacher',
          preschool_id: body.school_id,
          organization_id: body.school_id,
          first_name: body.first_name,
          last_name: body.last_name,
          full_name: fullName,
          email,
          phone: body.phone || null,
          is_active: true,
          hire_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', userId);
      if (newProfileUpdateError) {
        throw new Error(`Failed to update profile for new teacher: ${newProfileUpdateError.message}`);
      }

      // Set force_password_change flag
      const { error: updateMetaError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          first_name: body.first_name,
          last_name: body.last_name,
          force_password_change: true,
          created_by_admin: true,
          teacher_type: teacherType,
        },
      });
      if (updateMetaError) {
        throw new Error(`Failed to update auth metadata: ${updateMetaError.message}`);
      }
    }

    // ── Create teachers table record ──
    const { error: teacherUpsertError } = await supabaseAdmin.from('teachers').upsert(
      {
        user_id: userId,
        auth_user_id: userId,
        preschool_id: body.school_id,
        email,
        first_name: body.first_name,
        last_name: body.last_name,
        full_name: fullName,
        phone: body.phone || null,
        role: 'teacher',
        is_active: true,
        subject_specialization: body.subject_specialization || null,
      } as any,
      { onConflict: 'user_id' } as any
    );
    if (teacherUpsertError) {
      throw new Error(`Failed to upsert teacher record: ${teacherUpsertError.message}`);
    }

    // ── Assign active seat ──
    const { error: orgMemberError } = await supabaseAdmin.from('organization_members').upsert(
      {
        organization_id: body.school_id,
        user_id: userId,
        role: 'teacher',
        seat_status: 'active',
        member_type: 'staff',
        membership_status: 'active',
        invited_by: caller.id,
        first_name: body.first_name,
        last_name: body.last_name,
        email,
        phone: body.phone || null,
      } as any,
      { onConflict: 'user_id,organization_id' } as any
    );
    if (orgMemberError) {
      // Keep non-fatal across environments, but return warning so UI can surface partial provisioning.
      provisioningWarnings.push(`organization_members upsert warning: ${orgMemberError.message}`);
    }

    // ── Create approved teacher_approvals record (skip pending queue) ──
    const { error: approvalUpsertError } = await supabaseAdmin.from('teacher_approvals').upsert(
      {
        teacher_id: userId,
        preschool_id: body.school_id,
        status: 'approved',
        reviewed_by: caller.id,
        reviewed_at: new Date().toISOString(),
        seat_assigned: true,
        notes: body.notes || `Direct ${teacherType} hire by principal`,
      } as any,
      { onConflict: 'teacher_id,preschool_id' } as any
    );
    if (approvalUpsertError) {
      throw new Error(`Failed to upsert teacher approval: ${approvalUpsertError.message}`);
    }

    // ── Create employment history ──
    try {
      await supabaseAdmin.from('teacher_employment_history').insert({
        teacher_id: userId,
        preschool_id: body.school_id,
        action: 'hired',
        performed_by: caller.id,
        notes: `${teacherType.charAt(0).toUpperCase() + teacherType.slice(1)} teacher — account created by principal`,
      } as any);
    } catch {
      // Non-fatal
    }

    // ── Send welcome email ──
    let emailSent = false;
    const typeLabel =
      teacherType === 'trainee'
        ? 'Trainee'
        : teacherType === 'temporary'
          ? 'Temporary Teacher'
          : 'Teacher';
    if (resendApiKey) {
      const emailBody = isExistingUser
        ? tempPasswordForLogin
          ? `<p>Hi ${body.first_name},</p>
             <p>Great news! You have been linked to <strong>${schoolName}</strong> as a <strong>${typeLabel}</strong> on EduDash Pro.</p>
             <p>A temporary password has been issued for your account:</p>
             <div style="margin:16px 0;padding:16px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
               <p style="margin:0 0 8px 0;"><strong>Email:</strong> ${email}</p>
               <p style="margin:0 0 8px 0;"><strong>Temporary Password:</strong> <code style="background:#e2e8f0;padding:4px 8px;border-radius:6px;font-size:16px;font-weight:700;">${tempPasswordForLogin}</code></p>
               <p style="margin:0;"><strong>Role:</strong> ${typeLabel}</p>
             </div>
             <p style="color:#ef4444;font-weight:600;">⚠️ Please change your password after your first login.</p>`
          : `<p>Hi ${body.first_name},</p>
             <p>Great news! You have been added as a <strong>${typeLabel}</strong> at <strong>${schoolName}</strong> on EduDash Pro.</p>
             <p>Since you already have an EduDash Pro account, please sign in with your existing login method.</p>
             ${loginMethodHint ? `<p><strong>Login hint:</strong> ${loginMethodHint}</p>` : ''}
             <p style="margin-top:16px;padding:14px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0;">
               <strong>School:</strong> ${schoolName}<br/>
               <strong>Role:</strong> ${typeLabel}<br/>
               <strong>Status:</strong> Active ✅
             </p>`
        : `<p>Hi ${body.first_name},</p>
           <p>Welcome to <strong>EduDash Pro</strong>! Your teacher account has been created at <strong>${schoolName}</strong>.</p>
           <p>Here are your login credentials:</p>
           <div style="margin:16px 0;padding:16px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
             <p style="margin:0 0 8px 0;"><strong>Email:</strong> ${email}</p>
             <p style="margin:0 0 8px 0;"><strong>Temporary Password:</strong> <code style="background:#e2e8f0;padding:4px 8px;border-radius:6px;font-size:16px;font-weight:700;">${tempPasswordForLogin || tempPassword}</code></p>
             <p style="margin:0;"><strong>Role:</strong> ${typeLabel}</p>
           </div>
           <p style="color:#ef4444;font-weight:600;">⚠️ Please change your password after your first login.</p>
           <p>Download the EduDash Pro app and sign in to access your teaching dashboard, create lessons, manage homework, and more.</p>`;

      try {
        const emailHtml = renderEduDashProEmail({
          title: `Welcome to ${schoolName}!`,
          preheader: `Your ${typeLabel} account is ready`,
          subtitle: `You've been added as a ${typeLabel} at ${schoolName}`,
          bodyHtml: emailBody,
          cta: {
            label: 'Open EduDash Pro',
            url: 'https://edudashpro.org.za',
          },
          footerNote: 'This email was sent because an account was created for you on EduDash Pro.',
        });

        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'EduDash Pro <support@edudashpro.org.za>',
            to: [email],
            subject: `Welcome to ${schoolName} — Your Teacher Account is Ready`,
            html: emailHtml,
          }),
        });

        emailSent = emailRes.ok;
        if (!emailRes.ok) {
          console.error('[create-teacher-account] Email send failed:', await emailRes.text());
        }
      } catch (emailErr) {
        console.error('[create-teacher-account] Email error:', emailErr);
      }
    } else {
      provisioningWarnings.push('RESEND_API_KEY is not configured. Welcome email was skipped.');
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        is_existing_user: isExistingUser,
        teacher_type: teacherType,
        temp_password: tempPasswordForLogin,
        email_sent: emailSent,
        school_name: schoolName,
        login_method_hint: loginMethodHint,
        provisioning_warnings: provisioningWarnings,
        message: isExistingUser
          ? tempPasswordForLogin
            ? `${fullName} was already registered and has been linked to ${schoolName}. Temporary credentials were generated for this account.`
            : `${fullName} was already registered and has been linked to ${schoolName}. ${loginMethodHint || 'Use existing credentials to sign in.'}`
          : `Account created for ${fullName}. ${emailSent ? 'Welcome email sent.' : 'Email not sent — share credentials manually.'}`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[create-teacher-account] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unexpected error',
        code: 'UNEXPECTED_ERROR',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
