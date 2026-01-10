// Supabase Edge Function: create-organization-member
// Creates organization members using admin API with email auto-confirmed
// This bypasses email confirmation requirements for admin-created members

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get authenticated user (must be admin/executive)
    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has permission to create members (must be organization admin/executive)
    const { data: profile, error: profileError } = await userClient
      .from('profiles')
      .select('id, organization_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ success: false, error: 'Profile not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is organization member with create_members permission
    const { data: orgMember, error: memberError } = await userClient
      .from('organization_members')
      .select('member_type, membership_status')
      .eq('user_id', user.id)
      .eq('organization_id', profile.organization_id || '')
      .maybeSingle();

    // Only allow executives (president, secretary, etc.) to create members
    const allowedTypes = ['president', 'deputy_president', 'secretary_general', 'treasurer', 'youth_president', 'youth_secretary', 'youth_treasurer'];
    const isAuthorized = orgMember && allowedTypes.some(type => orgMember.member_type?.includes(type));

    if (!isAuthorized && profile.role !== 'super_admin') {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - only organization executives can create members' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestData: CreateMemberRequest = await req.json();

    // Validate required fields
    if (!requestData.email || !requestData.password || !requestData.organization_id || !requestData.member_type) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: email, password, organization_id, member_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
      console.error('[create-organization-member] Auth error:', authError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: authError?.message || 'Failed to create user account',
          code: authError?.status ? 'AUTH_ERROR' : 'UNKNOWN_ERROR'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[create-organization-member] User created:', authData.user.id);

    // 2. Wait briefly for profile trigger to create profile (usually instant, but just in case)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. Call register_organization_member RPC (now user definitely exists)
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('register_organization_member', {
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
      p_role: 'member',
      p_invite_code_used: null,
      p_joined_via: 'admin_add',
    });

    if (rpcError) {
      console.error('[create-organization-member] RPC error:', rpcError);
      // Clean up: delete the user account if member creation failed
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: rpcError.message || 'Failed to create organization member',
          code: 'RPC_ERROR'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!rpcResult?.success) {
      console.error('[create-organization-member] RPC returned error:', rpcResult);
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

    // 4. Return success with user ID and member info
    return new Response(
      JSON.stringify({
        success: true,
        user_id: authData.user.id,
        member_id: rpcResult.id,
        member_number: rpcResult.member_number,
        wing: rpcResult.wing,
        message: 'Member created successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[create-organization-member] Unexpected error:', error);
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
