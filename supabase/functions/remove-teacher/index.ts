// Supabase Edge Function: remove-teacher
// Removes a teacher from a school using service role to bypass RLS
// Only callable by principals of the same organization

declare const Deno: {
  env: { get(key: string): string | undefined };
};

// @ts-ignore - Deno URL imports
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore - Deno URL imports
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

interface RemoveTeacherRequest {
  teacher_user_id: string;
  organization_id: string;
  teacher_record_id?: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('[remove-teacher] Request received');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify the caller is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Create a client scoped to the caller to verify their identity
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
    if (authError || !caller) {
      console.error('[remove-teacher] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body: RemoveTeacherRequest = await req.json();
    const { teacher_user_id, organization_id, teacher_record_id } = body;

    if (!teacher_user_id || !organization_id) {
      return new Response(
        JSON.stringify({ error: 'Missing teacher_user_id or organization_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log('[remove-teacher] Caller:', caller.id, 'removing teacher:', teacher_user_id, 'from org:', organization_id);

    // Use service role client for admin operations
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the caller is a principal/admin of this organization
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role, organization_id, preschool_id')
      .eq('id', caller.id)
      .single();

    const isCallerAuthorized =
      callerProfile &&
      ['principal', 'super_admin'].includes(callerProfile.role || '') &&
      (callerProfile.organization_id === organization_id ||
        callerProfile.preschool_id === organization_id);

    if (!isCallerAuthorized) {
      console.error('[remove-teacher] Caller not authorized:', callerProfile?.role, callerProfile?.organization_id);
      return new Response(
        JSON.stringify({ error: 'You must be a principal of this school to remove teachers' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Prevent removing yourself
    if (teacher_user_id === caller.id) {
      return new Response(
        JSON.stringify({ error: 'You cannot remove yourself' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const errors: string[] = [];

    // Step 1: Unassign from classes
    const { error: classError } = await adminClient
      .from('classes')
      .update({ teacher_id: null })
      .eq('teacher_id', teacher_user_id)
      .eq('preschool_id', organization_id);
    if (classError) {
      console.error('[remove-teacher] Class unassign error:', classError);
      errors.push(`Classes: ${classError.message}`);
    } else {
      console.log('[remove-teacher] ✅ Classes unassigned');
    }

    // Step 2: DELETE teacher record (fully remove, not just deactivate)
    if (teacher_record_id) {
      const { error: teacherError } = await adminClient
        .from('teachers')
        .delete()
        .eq('preschool_id', organization_id)
        .or(`user_id.eq.${teacher_user_id},id.eq.${teacher_record_id}`);
      if (teacherError) {
        console.error('[remove-teacher] Teacher delete error:', teacherError);
        errors.push(`Teacher record: ${teacherError.message}`);
      } else {
        console.log('[remove-teacher] ✅ Teacher record deleted');
      }
    } else {
      const { error: teacherError } = await adminClient
        .from('teachers')
        .delete()
        .eq('user_id', teacher_user_id)
        .eq('preschool_id', organization_id);
      if (teacherError) {
        console.error('[remove-teacher] Teacher delete error:', teacherError);
        errors.push(`Teacher record: ${teacherError.message}`);
      } else {
        console.log('[remove-teacher] ✅ Teacher record deleted');
      }
    }

    // Step 3: Remove organization membership (this was silently blocked by RLS before)
    const { error: memberError, count: memberCount } = await adminClient
      .from('organization_members')
      .delete()
      .eq('user_id', teacher_user_id)
      .eq('organization_id', organization_id);
    if (memberError) {
      console.error('[remove-teacher] Membership delete error:', memberError);
      errors.push(`Membership: ${memberError.message}`);
    } else {
      console.log('[remove-teacher] ✅ Organization membership removed, count:', memberCount);
    }

    // Step 4: Clear profile org linkage (this was silently blocked by RLS before)
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({
        organization_id: null,
        preschool_id: null,
        seat_status: 'inactive',
        role: 'parent',
      })
      .eq('id', teacher_user_id);
    if (profileError) {
      console.error('[remove-teacher] Profile update error:', profileError);
      errors.push(`Profile: ${profileError.message}`);
    } else {
      console.log('[remove-teacher] ✅ Profile cleared');
    }

    // Step 5: Revoke subscription seat (full delete via RPC)
    const { error: seatError } = await adminClient
      .rpc('rpc_revoke_teacher_seat', { target_user_id: teacher_user_id });
    if (seatError) {
      // Non-fatal — teacher might not have a seat
      console.warn('[remove-teacher] Seat revoke (non-fatal):', seatError.message);
    } else {
      console.log('[remove-teacher] ✅ Subscription seat revoked');
    }

    // Step 6: Also remove any pending invites for this teacher's email
    const { data: teacherProfile } = await adminClient
      .from('profiles')
      .select('email')
      .eq('id', teacher_user_id)
      .single();

    if (teacherProfile?.email) {
      const { error: inviteError } = await adminClient
        .from('teacher_invites')
        .delete()
        .eq('email', teacherProfile.email)
        .eq('preschool_id', organization_id);
      if (inviteError) {
        console.warn('[remove-teacher] Invite cleanup error (non-fatal):', inviteError);
      } else {
        console.log('[remove-teacher] ✅ Pending invites cleaned up');
      }
    }

    if (errors.length > 0) {
      console.error('[remove-teacher] Completed with errors:', errors);
      return new Response(
        JSON.stringify({ success: false, error: errors.join('; '), partial: true }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log('[remove-teacher] ✅ Teacher fully removed');
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('[remove-teacher] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
