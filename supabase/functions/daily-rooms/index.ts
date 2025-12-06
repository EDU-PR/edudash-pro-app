/**
 * Daily.co Room Management Edge Function
 * 
 * Creates Daily.co rooms for voice/video calls
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

interface RoomRequest {
  name?: string;
  isPrivate?: boolean;
  expiryMinutes?: number;
  maxParticipants?: number;
}

interface DailyRoomProperties {
  name: string;
  privacy: 'public' | 'private';
  exp?: number;
  max_participants?: number;
  enable_screenshare?: boolean;
  enable_chat?: boolean;
  enable_recording?: string;
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
    const { 
      name, 
      isPrivate = true, 
      expiryMinutes = 60,
      maxParticipants = 10
    }: RoomRequest = await req.json();

    // Generate room name if not provided
    const roomName = name || `room-${user.id.substring(0, 8)}-${Date.now()}`;

    // Calculate expiry timestamp
    const expiry = Math.floor(Date.now() / 1000) + (expiryMinutes * 60);

    // Prepare Daily.co room properties
    const roomProperties: DailyRoomProperties = {
      name: roomName,
      privacy: isPrivate ? 'private' : 'public',
      exp: expiry,
      max_participants: maxParticipants,
      enable_screenshare: true,
      enable_chat: true,
      enable_recording: 'cloud', // Enable cloud recording if needed
      start_audio_off: false,
      start_video_off: false,
    };

    console.log('Creating Daily.co room:', {
      roomName,
      userId: user.id,
      isPrivate,
      expiryMinutes,
      maxParticipants,
    });

    // Call Daily.co API to create room
    const dailyResponse = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DAILY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: roomName,
        properties: roomProperties,
      }),
    });

    if (!dailyResponse.ok) {
      const errorText = await dailyResponse.text();
      console.error('Daily.co API error:', {
        status: dailyResponse.status,
        statusText: dailyResponse.statusText,
        body: errorText,
      });

      // If room already exists, try to get it
      if (dailyResponse.status === 400 && errorText.includes('already exists')) {
        console.log('Room already exists, fetching existing room...');
        
        const getResponse = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
          headers: {
            'Authorization': `Bearer ${DAILY_API_KEY}`,
          },
        });

        if (getResponse.ok) {
          const existingRoom = await getResponse.json();
          return new Response(
            JSON.stringify({ 
              room: {
                id: existingRoom.id,
                name: existingRoom.name,
                url: existingRoom.url,
                privacy: existingRoom.privacy,
                created_at: existingRoom.created_at,
              }
            }),
            { 
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create room',
          details: dailyResponse.statusText,
        }),
        { 
          status: dailyResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const room = await dailyResponse.json();

    console.log('Successfully created Daily.co room:', room.name);

    return new Response(
      JSON.stringify({ 
        room: {
          id: room.id,
          name: room.name,
          url: room.url,
          privacy: room.privacy,
          created_at: room.created_at,
        }
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Unexpected error in daily-rooms function:', error);
    
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
