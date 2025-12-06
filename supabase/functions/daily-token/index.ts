/**
 * Daily.co Meeting Token Generation Edge Function
 * 
 * Generates secure meeting tokens for Daily.co video/voice calls
 * Used by React Native app (web uses Next.js API route)
 * 
 * Required Environment Variables:
 * - DAILY_API_KEY: Your Daily.co API key from dashboard.daily.co
 * 
 * Set in Supabase Dashboard → Settings → Edge Functions → Secrets
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TokenRequest {
  roomName: string;
  userName?: string;
  isOwner?: boolean;
}

interface DailyTokenProperties {
  room_name: string;
  user_name?: string;
  user_id: string;
  is_owner?: boolean;
  enable_recording?: boolean;
  start_audio_off?: boolean;
  start_video_off?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get Daily.co API key from environment
    const DAILY_API_KEY = Deno.env.get('DAILY_API_KEY');
    if (!DAILY_API_KEY) {
      console.error('DAILY_API_KEY not configured in Supabase secrets');
      return new Response(
        JSON.stringify({ error: 'Server configuration error: DAILY_API_KEY not set' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Authenticate user via Supabase
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user authentication
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Parse request body
    const { roomName, userName, isOwner }: TokenRequest = await req.json();

    if (!roomName) {
      return new Response(
        JSON.stringify({ error: 'roomName is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get user profile for full name
    const { data: profile } = await supabaseClient
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('user_id', user.id)
      .single();

    const displayName = userName || 
      (profile ? `${profile.first_name} ${profile.last_name}`.trim() : user.email?.split('@')[0]) ||
      'User';

    // Prepare Daily.co token properties
    const tokenProperties: DailyTokenProperties = {
      room_name: roomName,
      user_name: displayName,
      user_id: user.id,
      is_owner: isOwner ?? false,
      enable_recording: false,
      start_audio_off: false,
      start_video_off: false,
    };

    console.log('Creating Daily.co token for:', {
      roomName,
      userId: user.id,
      userName: displayName,
      isOwner: isOwner ?? false,
    });

    // Call Daily.co API to create meeting token
    const dailyResponse = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DAILY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: tokenProperties,
      }),
    });

    if (!dailyResponse.ok) {
      const errorText = await dailyResponse.text();
      console.error('Daily.co API error:', {
        status: dailyResponse.status,
        statusText: dailyResponse.statusText,
        body: errorText,
      });
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create meeting token',
          details: dailyResponse.statusText,
        }),
        { 
          status: dailyResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { token } = await dailyResponse.json();

    console.log('Successfully created Daily.co token for user:', user.id);

    return new Response(
      JSON.stringify({ token }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Unexpected error in daily-token function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
