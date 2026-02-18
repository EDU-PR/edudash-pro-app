/**
 * Daily.co Token Generation Edge Function
 * 
 * Generates Daily.co meeting tokens for mobile app calls.
 * Mirrors functionality from web/src/app/api/daily/token/route.ts
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.12';

const DAILY_API_KEY = Deno.env.get('DAILY_API_KEY');
const DAILY_API_URL = 'https://api.daily.co/v1';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

interface TokenRequest {
  roomName: string;
  userName?: string;
  isOwner?: boolean;
  /** Only mute when explicitly requested by the client */
  startAudioOff?: boolean;
  /** Back-compat for older clients */
  start_audio_off?: boolean;
}

const STAFF_ROLES = new Set(['teacher', 'principal', 'principal_admin', 'admin', 'superadmin', 'super_admin']);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Health check endpoint
  const url = new URL(req.url);
  if (url.pathname.endsWith('/health')) {
    return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Check if Daily API key is configured
    if (!DAILY_API_KEY) {
      console.error('[Daily Token] DAILY_API_KEY is not configured');
      return new Response(
        JSON.stringify({
          error: 'Video service not configured',
          message: 'Video calls are not available. Please contact your administrator.',
          code: 'DAILY_API_KEY_MISSING',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authorization token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Create Supabase client with user token
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Verify the user token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[Daily Token] Auth error:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Authentication failed', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Daily Token] Authenticated user:', user.id, user.email);

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('first_name, last_name, role, preschool_id, organization_id')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[Daily Token] Profile error:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profile) {
      console.error('[Daily Token] Profile not found for user:', user.id);
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: TokenRequest = await req.json();
    const { roomName, userName, isOwner } = body;
    const startAudioOff = body.startAudioOff ?? body.start_audio_off ?? false;

    if (!roomName) {
      return new Response(
        JSON.stringify({ error: 'Room name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const roleLower = String(profile.role || '').toLowerCase();
    const isStaffRole = STAFF_ROLES.has(roleLower);

    // Non-staff users must never mint owner tokens.
    if (isOwner && !isStaffRole) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: owner token not allowed for this role' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure non-staff users can only join rooms linked to their own active call.
    if (!isStaffRole) {
      const { data: activeCall, error: activeCallError } = await supabase
        .from('active_calls')
        .select('call_id')
        .or(`caller_id.eq.${user.id},callee_id.eq.${user.id}`)
        .ilike('meeting_url', `%/${roomName}`)
        .in('status', ['ringing', 'connected', 'initiated'])
        .limit(1)
        .maybeSingle();

      if (activeCallError) {
        console.error('[Daily Token] Active call verification failed:', activeCallError.message);
      }

      if (!activeCall) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: room access not permitted for this user' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Determine if user should be owner
    const shouldBeOwner = Boolean(isOwner) || isStaffRole;
    const displayName = userName || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Participant';

    console.log('[Daily Token] Creating token for room:', roomName, 'user:', displayName, 'isOwner:', shouldBeOwner);

    // Create meeting token via Daily.co API
    const dailyResponse = await fetch(`${DAILY_API_URL}/meeting-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          user_name: displayName,
          user_id: user.id,
          is_owner: shouldBeOwner,
          enable_screenshare: true,
          enable_recording: shouldBeOwner ? 'cloud' : undefined,
          start_video_off: false,
          start_audio_off: startAudioOff === true, // Only mute when explicitly requested
          exp: Math.floor(Date.now() / 1000) + 3600 * 3, // 3 hour token
        },
      }),
    });

    if (!dailyResponse.ok) {
      const errorData = await dailyResponse.json();
      console.error('[Daily Token] Daily.co token creation failed:', errorData);
      return new Response(
        JSON.stringify({
          error: 'Failed to create meeting token',
          details: errorData.error || errorData.info || 'Unknown error',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await dailyResponse.json();
    console.log('[Daily Token] Token created successfully for user:', user.id);

    return new Response(
      JSON.stringify({
        success: true,
        token: tokenData.token,
        isOwner: shouldBeOwner,
        userName: displayName,
        room_name: roomName,
        expires_at: new Date((Math.floor(Date.now() / 1000) + 3600 * 3) * 1000).toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Daily Token] Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
