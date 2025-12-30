import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

/**
 * Send FCM High-Priority Data Message for Incoming Calls
 * 
 * This function sends Firebase Cloud Messaging data-only messages with high priority.
 * FCM data messages can wake Android apps even when they're completely killed.
 * 
 * IMPORTANT: Unlike Expo push which wraps FCM, this sends RAW FCM messages
 * which have better wake-on-call reliability on Android.
 * 
 * Requirements:
 * - FIREBASE_PROJECT_ID in Supabase secrets
 * - FIREBASE_PRIVATE_KEY in Supabase secrets  
 * - FIREBASE_CLIENT_EMAIL in Supabase secrets
 */

interface SendFCMCallRequest {
  callee_user_id: string;
  call_id: string;
  caller_id: string;
  caller_name: string;
  call_type: 'voice' | 'video';
  meeting_url?: string;
}

interface FCMMessage {
  message: {
    token: string;
    data: Record<string, string>;
    android: {
      priority: 'high';
      ttl: string;
      direct_boot_ok?: boolean;
    };
  };
}

// Get Google OAuth2 access token for FCM
async function getGoogleAccessToken(): Promise<string> {
  const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
  const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL');
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID');

  if (!privateKey || !clientEmail || !projectId) {
    throw new Error('Firebase credentials not configured');
  }

  // Create JWT for Google OAuth2
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: clientEmail,
    sub: clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600, // 1 hour
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  };

  // Encode JWT parts
  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const claimB64 = btoa(JSON.stringify(claim)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const signatureInput = `${headerB64}.${claimB64}`;

  // Import private key for signing
  const keyData = privateKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Sign the JWT
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(signatureInput)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${signatureInput}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const { access_token } = await tokenResponse.json();
  return access_token;
}

// Send FCM message
async function sendFCMMessage(token: string, data: Record<string, string>): Promise<{ success: boolean; error?: string }> {
  try {
    const projectId = Deno.env.get('FIREBASE_PROJECT_ID');
    if (!projectId) {
      throw new Error('FIREBASE_PROJECT_ID not configured');
    }

    const accessToken = await getGoogleAccessToken();

    const message: FCMMessage = {
      message: {
        token,
        data,
        android: {
          priority: 'high',
          ttl: '30s', // 30 seconds for call timeout
          direct_boot_ok: true, // Allow delivery even during direct boot
        },
      },
    };

    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[send-fcm-call] FCM API error:', errorText);
      return { success: false, error: errorText };
    }

    const result = await response.json();
    console.log('[send-fcm-call] FCM message sent:', result);
    return { success: true };
  } catch (error: any) {
    console.error('[send-fcm-call] Failed to send FCM message:', error);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request
    const body: SendFCMCallRequest = await req.json();
    const { callee_user_id, call_id, caller_id, caller_name, call_type, meeting_url } = body;

    if (!callee_user_id || !call_id || !caller_id) {
      return new Response(
        JSON.stringify({ error: 'callee_user_id, call_id, and caller_id are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Look up FCM token from push_devices table
    const { data: devices, error: deviceError } = await supabase
      .from('push_devices')
      .select('fcm_token')
      .eq('user_id', callee_user_id)
      .eq('platform', 'android')
      .not('fcm_token', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (deviceError) {
      console.error('[send-fcm-call] Failed to fetch device:', deviceError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch device token' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const fcmToken = devices?.[0]?.fcm_token;

    if (!fcmToken) {
      console.log('[send-fcm-call] No FCM token found for user:', callee_user_id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No FCM token registered for user',
          fallback: 'expo_push',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Send FCM data message (data-only for reliable wake)
    const result = await sendFCMMessage(fcmToken, {
      type: 'incoming_call',
      call_id,
      caller_id,
      caller_name: caller_name || 'Unknown',
      call_type: call_type || 'voice',
      meeting_url: meeting_url || '',
      timestamp: Date.now().toString(),
    });

    return new Response(
      JSON.stringify({
        success: result.success,
        error: result.error,
        method: 'fcm_direct',
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        } 
      }
    );
  } catch (error: any) {
    console.error('[send-fcm-call] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        } 
      }
    );
  }
});
