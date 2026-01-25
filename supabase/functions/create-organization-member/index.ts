// Supabase Edge Function: create-organization-member
// Creates organization members using admin API with email auto-confirmed
// This bypasses email confirmation requirements for admin-created members
// VERSION: v18 - Added more comprehensive logging

// Deno type declaration for Edge Functions
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// @ts-ignore - Deno URL imports
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore - Deno URL imports
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateMemberRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  id_number?: string | null;
  date_of_birth?: string | null;
  physical_address?: string | null;
  organization_id: string;
  region_id?: string | null;
  member_number?: string | null;
  member_type: string;
  membership_tier?: string;
  membership_status?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('[create-organization-member v18] Request received');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    console.log('[create-organization-member v18] Environment check:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      hasAnonKey: !!supabaseAnonKey,
    });
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get authenticated user (must be admin/executive)
    const authHeader = req.headers.get('Authorization') || '';
    console.log('[create-organization-member v18] Auth header present:', !!authHeader);
    
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: getUserError } = await userClient.auth.getUser();
    console.log('[create-organization-member v18] Auth result:', { 
      hasUser: !!user, 
      userId: user?.id?.substring(0, 8),
      error: getUserError?.message 
    });
    
    if (getUserError || !user) {
      console.error('[create-organization-member v18] Auth failed:', getUserError);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - no valid session', code: 'AUTH_ERROR' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has permission to create members (must be organization admin/executive)
    // Use supabaseAdmin to bypass any RLS issues when querying the user's own profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, organization_id, role')
      .eq('auth_user_id', user.id)
      .single();

    console.log('[create-organization-member v18] Profile lookup result:', {
      profile,
      profileError: profileError?.message,
    });

    if (profileError || !profile) {
      console.error('[create-organization-member v18] Profile error:', profileError);
      console.error('[create-organization-member v18] User ID being queried:', user.id);
      return new Response(
        JSON.stringify({ success: false, error: 'Profile not found', code: 'PROFILE_NOT_FOUND', userId: user.id }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[create-organization-member v18] User profile:', { userId: user.id, orgId: profile.organization_id, role: profile.role });

    // Check if user is organization member with create_members permission
    // First try to get organization_id from profile, if not found, query organization_members directly
    let targetOrgId = profile.organization_id;
    
    // If no org_id in profile, try to find it from organization_members table
    if (!targetOrgId) {
      const { data: memberRecord } = await supabaseAdmin
        .from('organization_members')
        .select('organization_id, member_type, membership_status')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (memberRecord?.organization_id) {
        targetOrgId = memberRecord.organization_id;
        console.log('[create-organization-member v18] Found org_id from organization_members:', targetOrgId);
      }
    }

    if (!targetOrgId) {
      console.error('[create-organization-member v18] No organization associated with user:', user.id);
      return new Response(
        JSON.stringify({ success: false, error: 'User is not associated with any organization', code: 'NO_ORGANIZATION' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: orgMember, error: memberError } = await supabaseAdmin
      .from('organization_members')
      .select('member_type, membership_status')
      .eq('user_id', user.id)
      .eq('organization_id', targetOrgId)
      .maybeSingle();

    console.log('[create-organization-member v18] Organization member lookup:', { orgMember, memberError });

    // Only allow executives (president, secretary, etc.) to create members
    // Use exact match instead of includes() for security
    const allowedTypes = [
      'president', 'deputy_president', 'secretary_general', 'treasurer',
      'youth_president', 'youth_deputy', 'youth_secretary', 'youth_treasurer',
      'women_president', 'women_secretary', 'women_treasurer',
      'veterans_president',
      'ceo', 'national_admin'
    ];
    const memberType = orgMember?.member_type || '';
    const isAuthorized = orgMember && allowedTypes.includes(memberType);

    console.log('[create-organization-member v18] Authorization check:', { memberType, isAuthorized, profileRole: profile.role });

    if (!isAuthorized && profile.role !== 'super_admin' && profile.role !== 'admin') {
      console.error('[create-organization-member v18] Authorization failed:', {
        memberType,
        orgMember,
        memberError,
        allowedTypes,
        profileRole: profile.role,
        targetOrgId,
      });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Unauthorized - only organization executives can create members. Your member_type: ${memberType || 'none'}`,
          code: 'UNAUTHORIZED',
          debug: { 
            member_type: memberType, 
            org_id: targetOrgId,
            has_org_member: !!orgMember,
            profile_role: profile.role,
          }
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestData: CreateMemberRequest = await req.json();

    // Validate required fields
    if (!requestData.email || !requestData.password || !requestData.organization_id || !requestData.member_type) {
      console.error('[create-organization-member v18] Missing required fields:', requestData);
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: email, password, organization_id, member_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[create-organization-member v18] Request data validated:', requestData);

    // 1. Create user account using admin API with email auto-confirmed
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: requestData.email.toLowerCase().trim(),
      password: requestData.password,
      email_confirm: true, // Auto-confirm email for admin-created accounts
      user_metadata: {
        first_name: requestData.first_name,
        last_name: requestData.last_name,
        phone: requestData.phone || null,
      },
    });

    if (authError || !authData.user) {
      console.error('[create-organization-member v18] Auth error:', authError);
      
      // Check for specific error codes and provide user-friendly messages
      const errorMessage = authError?.message || 'Failed to create user account';
      const errorCode = (authError as { code?: string })?.code || 'UNKNOWN_ERROR';
      
      // Handle duplicate email error
      if (errorCode === 'email_exists' || errorMessage.includes('already been registered')) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'A user with this email address already exists. Please use a different email or contact the existing user.',
            code: 'EMAIL_EXISTS'
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Handle weak password error
      if (errorCode === 'weak_password' || errorMessage.includes('password')) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Password is too weak. Please use at least 6 characters with a mix of letters and numbers.',
            code: 'WEAK_PASSWORD'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Handle invalid email format
      if (errorCode === 'invalid_email' || errorMessage.includes('invalid') && errorMessage.includes('email')) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Invalid email format. Please enter a valid email address.',
            code: 'INVALID_EMAIL'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Generic auth error
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage,
          code: errorCode
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[create-organization-member v18] User created:', authData.user.id);

    // 2. Wait briefly for profile trigger to create profile (usually instant, but just in case)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. Prepare date_of_birth - ensure it's a valid date string or null
    let dateOfBirth: string | null = null;
    if (requestData.date_of_birth) {
      // Try to parse and format the date
      const dateStr = String(requestData.date_of_birth).trim();
      if (dateStr && dateStr !== 'null' && dateStr !== 'undefined') {
        // If already in YYYY-MM-DD format, use directly
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          dateOfBirth = dateStr;
        } else {
          // Try to parse and format the date
          const parsed = new Date(dateStr);
          if (!isNaN(parsed.getTime())) {
            // Format as YYYY-MM-DD using local date components (not UTC)
            const year = parsed.getFullYear();
            const month = String(parsed.getMonth() + 1).padStart(2, '0');
            const day = String(parsed.getDate()).padStart(2, '0');
            dateOfBirth = `${year}-${month}-${day}`;
          }
        }
      }
    }
    
    console.log('[create-organization-member v18] Prepared date_of_birth:', dateOfBirth);

    // 4. Call register_organization_member RPC (now user definitely exists)
    const rpcParams = {
      p_organization_id: requestData.organization_id,
      p_user_id: authData.user.id,
      p_region_id: requestData.region_id || null,
      p_member_number: requestData.member_number || null,
      p_member_type: requestData.member_type,
      p_membership_tier: requestData.membership_tier || 'standard',
      p_membership_status: requestData.membership_status || 'active',
      p_first_name: requestData.first_name,
      p_last_name: requestData.last_name,
      p_email: requestData.email.toLowerCase().trim(),
      p_phone: requestData.phone || null,
      p_id_number: requestData.id_number || null,
      p_date_of_birth: dateOfBirth,
      p_physical_address: requestData.physical_address || null,
      p_role: 'member',
      p_invite_code_used: null,
      p_joined_via: 'admin_add',
    };
    
    console.log('[create-organization-member v18] RPC params:', JSON.stringify(rpcParams, null, 2));
    
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('register_organization_member', rpcParams);

    if (rpcError) {
      console.error('[create-organization-member v18] RPC error:', JSON.stringify(rpcError, null, 2));
      console.error('[create-organization-member v18] RPC error details:', {
        message: rpcError.message,
        details: (rpcError as any).details,
        hint: (rpcError as any).hint,
        code: (rpcError as any).code,
      });
      // Clean up: delete the user account if member creation failed
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: rpcError.message || 'Failed to create organization member',
          details: (rpcError as any).details || null,
          hint: (rpcError as any).hint || null,
          pgCode: (rpcError as any).code || null,
          code: 'RPC_ERROR'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!rpcResult?.success) {
      console.error('[create-organization-member v18] RPC returned error:', rpcResult);
      // Clean up: delete the user account if member creation failed
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: rpcResult?.error || 'Failed to create organization member',
          code: rpcResult?.code || 'UNKNOWN_ERROR'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Mark user as needing password change on first login
    // Store this in user metadata so the app can detect it
    await supabaseAdmin.auth.admin.updateUserById(authData.user.id, {
      user_metadata: {
        ...authData.user.user_metadata,
        force_password_change: true,
        created_by_admin: true,
        created_at: new Date().toISOString(),
      },
    });

    // 5. Return success with user ID, member info, and temporary password
    // IMPORTANT: The password is included so the admin can securely share it with the new member
    return new Response(
      JSON.stringify({
        success: true,
        user_id: authData.user.id,
        member_id: rpcResult.id,
        member_number: rpcResult.member_number,
        wing: rpcResult.wing,
        temp_password: requestData.password, // Include for admin to share with member
        force_password_change: true,
        message: 'Member created successfully. Please share the temporary password with the member.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[create-organization-member v18] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unexpected error occurred',
        code: 'UNEXPECTED_ERROR'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
