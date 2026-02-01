import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return jsonResponse(200, { status: 'ok', service: 'dash-context-sync' });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !serviceKey) {
      return jsonResponse(500, { error: 'Supabase service role not configured' });
    }

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer', '').trim();
    if (!token) {
      return jsonResponse(401, { error: 'Unauthorized' });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return jsonResponse(401, { error: 'Invalid token' });
    }

    const body = await req.json().catch(() => ({}));
    const detected_language = body?.detected_language ?? null;
    const traits = body?.traits ?? {};
    const session_id = body?.session_id ?? null;

    // Best-effort: no persistence yet (placeholder for future context storage).
    return jsonResponse(200, {
      success: true,
      user_id: userData.user.id,
      detected_language,
      traits,
      session_id,
      persisted: false,
    });
  } catch (error) {
    return jsonResponse(500, {
      error: 'dash_context_sync_error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
