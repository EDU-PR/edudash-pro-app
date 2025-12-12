import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Always return 200 OK (best-effort operation) - errors are logged server-side only
  // This prevents client-side warning spam for expected failures
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    })

    const {
      detected_language,
      traits,
      session_id,
    }: { detected_language?: string; traits?: Record<string, unknown>; session_id?: string } = await req.json()

    // Get authed user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      // Log server-side but return 200 (best-effort)
      console.warn('[dash-context-sync] Unauthorized access attempt')
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized', silent: true }), {
        status: 200, // Always 200 for best-effort operations
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Resolve organization_id from profiles
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profileErr) {
      // Log server-side but return 200 (best-effort)
      console.error('[dash-context-sync] Profile fetch error:', profileErr)
      return new Response(JSON.stringify({ success: false, error: 'Failed to fetch profile', silent: true }), {
        status: 200, // Always 200 for best-effort operations
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Allow users without organization_id (graceful degradation for users not yet assigned to orgs)
    const preschool_id = profile?.organization_id || null

    // If user has no org and no existing context, return success without inserting
    if (!preschool_id) {
      const { data: existingContext } = await supabase
        .from('dash_user_contexts')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (!existingContext) {
        console.log('[dash-context-sync] User has no org yet, skipping upsert')
        return new Response(JSON.stringify({ success: true, message: 'No organization assigned yet' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }
    }

    // Upsert dash_user_contexts
    const { error: upsertErr } = await supabase.from('dash_user_contexts').upsert(
      {
        user_id: user.id,
        preschool_id,
        preferred_language: detected_language || null,
        traits: traits || {},
        last_seen: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    if (upsertErr) {
      // Log server-side but return 200 (best-effort) - don't throw
      console.error('[dash-context-sync] Upsert error:', upsertErr)
      return new Response(JSON.stringify({ success: false, error: 'Failed to sync context', silent: true }), {
        status: 200, // Always 200 for best-effort operations
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Optional: track instance heartbeat (only if user has organization and session_id)
    if (session_id && preschool_id) {
      await supabase.from('dash_agent_instances').insert({
        user_id: user.id,
        preschool_id,
        session_id,
        settings: {},
        last_active: new Date().toISOString(),
      }).select().single().catch((err) => {
        console.warn('[dash-context-sync] Instance insert failed:', err)
        return null
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (e) {
    // Log server-side but always return 200 (best-effort operation)
    // This prevents client-side warning spam for transient errors
    console.error('[dash-context-sync] Unexpected error:', e)
    return new Response(JSON.stringify({ success: false, error: 'Server error', silent: true }), {
      status: 200, // Always 200 for best-effort operations
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
