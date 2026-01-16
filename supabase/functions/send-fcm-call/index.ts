/**
 * Send FCM Call Edge Function
 * 
 * Sends a high-priority FCM data-only message to wake the callee's Android app
 * when it's killed/closed. This is essential for incoming call functionality.
 * 
 * FCM data-only messages with high priority can wake killed Android apps,
 * whereas Expo push notifications cannot reliably do this.
 * 
 * Requires GOOGLE_SERVICE_ACCOUNT_KEY environment variable containing
 * the Firebase service account JSON (for Admin SDK authentication).
 */

// Deno type declarations for Edge Functions
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

// @ts-ignore - Deno URL import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.12';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY=REDACTED

// Firebase project ID from google-services.json
const FIREBASE_PROJECT_ID = 'edudashpro';

// Parse the service account key from environment variable
let serviceAccountKey: {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
} | null = null;

try {
  const keyJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
  if (keyJson) {
    serviceAccountKey = JSON.parse(keyJson);
  }
} catch (e) {
  console.error('[SendFCMCall] Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY:', e);
}

interface FCMCallRequest {
  callee_user_id: string;
  call_id: string;
  caller_id: string;
  caller_name: string;
  call_type: 'voice' | 'video';
  meeting_url?: string;
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Get an OAuth2 access token using the service account credentials
 * This is required for FCM HTTP v1 API
 */
async function getAccessToken(): Promise<string | null> {
  if (!serviceAccountKey) {
    console.error('[SendFCMCall] No service account key configured');
    return null;
  }

  try {
    // Create a JWT for OAuth2 authentication
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 3600; // 1 hour expiry

    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    const payload = {
      iss: serviceAccountKey.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      exp: exp,
      iat: now,
    };

    // Base64url encode header and payload
    const encoder = new TextEncoder();
    const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    const signatureInput = `${headerB64}.${payloadB64}`;

    // Import the private key and sign
    const privateKeyPem = serviceAccountKey.private_key;
    const privateKeyDer = pemToDer(privateKeyPem);
    
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      privateKeyDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      encoder.encode(signatureInput)
    );

    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    const jwt = `${signatureInput}.${signatureB64}`;

    // Exchange JWT for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('[SendFCMCall] Token exchange failed:', error);
      return null;
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  } catch (error) {
    console.error('[SendFCMCall] Failed to get access token:', error);
    return null;
  }
}

/**
 * Convert PEM private key to DER format for Web Crypto API
 */
function pemToDer(pem: string): ArrayBuffer {
  // Remove PEM header/footer and newlines
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');
  
  // Decode base64
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Send FCM data message to wake the app
 */
async function sendFCMDataMessage(
  fcmToken: string,
  callData: FCMCallRequest
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const accessToken = await getAccessToken();
  
  if (!accessToken) {
    return { success: false, error: 'Failed to get FCM access token - check GOOGLE_SERVICE_ACCOUNT_KEY' };
  }

  // FCM HTTP v1 API endpoint
  const url = `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`;

  // Data-only message with high priority
  // This format is critical for waking killed apps:
  // - NO notification field (data-only)
  // - android.priority: "high" 
  // - data fields as strings
  const message = {
    message: {
      token: fcmToken,
      // DATA ONLY - no notification field
      // This ensures HeadlessJS task runs even when app is killed
      data: {
        type: 'incoming_call',
        call_id: callData.call_id,
        caller_id: callData.caller_id,
        caller_name: callData.caller_name,
        call_type: callData.call_type,
        meeting_url: callData.meeting_url || '',
        timestamp: Date.now().toString(),
      },
      android: {
        priority: 'high', // Required for waking killed apps
        ttl: '60s', // Call expires after 60 seconds
        // Direct boot mode - can wake device from locked state
        direct_boot_ok: true,
      },
      // APNs config for iOS (if needed in future)
      apns: {
        headers: {
          'apns-priority': '10', // Immediate delivery
          'apns-push-type': 'background',
        },
        payload: {
          aps: {
            'content-available': 1, // Background processing
          },
        },
      },
    },
  };

  console.log('[SendFCMCall] Sending FCM message:', {
    callId: callData.call_id,
    callerName: callData.caller_name,
    callType: callData.call_type,
    tokenPrefix: fcmToken.substring(0, 20) + '...',
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SendFCMCall] FCM API error:', response.status, errorText);
      
      // Parse FCM error for better diagnostics
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.details) {
          const fcmError = errorJson.error.details.find((d: any) => d['@type']?.includes('FcmError'));
          if (fcmError?.errorCode === 'UNREGISTERED') {
            return { success: false, error: 'FCM token is invalid/unregistered - user may have reinstalled app' };
          }
        }
        return { success: false, error: errorJson.error?.message || errorText };
      } catch {
        return { success: false, error: errorText };
      }
    }

    const result = await response.json();
    console.log('[SendFCMCall] ✅ FCM message sent successfully:', result.name);
    
    return { success: true, messageId: result.name };
  } catch (error) {
    console.error('[SendFCMCall] Failed to send FCM message:', error);
    return { success: false, error: String(error) };
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Health check endpoint - check URL path or query param
  const url = new URL(req.url);
  const isHealthCheck = url.pathname.endsWith('/health') || 
                        url.pathname.includes('/health') ||
                        url.searchParams.get('health') === 'true';
  
  if (isHealthCheck || req.method === 'GET') {
    // Allow unauthenticated health checks via GET
    return new Response(JSON.stringify({ 
      status: 'ok',
      hasServiceAccount: !!serviceAccountKey,
      projectId: FIREBASE_PROJECT_ID,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Verify authentication (only for POST requests)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create Supabase client to verify user and get FCM token
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Verify the JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: FCMCallRequest = await req.json();
    
    // Validate required fields
    if (!body.callee_user_id || !body.call_id || !body.caller_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: callee_user_id, call_id, caller_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the callee's FCM token from push_devices
    const { data: device, error: deviceError } = await supabase
      .from('push_devices')
      .select('fcm_token, expo_push_token, platform')
      .eq('user_id', body.callee_user_id)
      .eq('is_active', true)
      .eq('platform', 'android') // FCM is primarily for Android
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (deviceError || !device) {
      console.warn('[SendFCMCall] No device found for user:', body.callee_user_id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No registered device for callee',
          fallback_to_expo: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!device.fcm_token) {
      console.warn('[SendFCMCall] User has no FCM token:', body.callee_user_id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No FCM token for callee (app may not have Firebase)',
          fallback_to_expo: true,
          expo_token: device.expo_push_token,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if service account is configured
    if (!serviceAccountKey) {
      console.error('[SendFCMCall] GOOGLE_SERVICE_ACCOUNT_KEY not configured');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'FCM not configured on server - add GOOGLE_SERVICE_ACCOUNT_KEY',
          fallback_to_expo: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send FCM data message
    const result = await sendFCMDataMessage(device.fcm_token, body);

    // If FCM fails due to invalid token, mark device as inactive
    if (!result.success && result.error?.includes('UNREGISTERED')) {
      await supabase
        .from('push_devices')
        .update({ is_active: false })
        .eq('user_id', body.callee_user_id)
        .eq('fcm_token', device.fcm_token);
    }

    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[SendFCMCall] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
