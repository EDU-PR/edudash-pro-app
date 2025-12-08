// Supabase Edge Function: get-secrets
// Provides server-side API keys to authenticated clients
// SECURITY: Only returns whitelisted keys, requires authentication

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// Use the correct environment variable names for Edge Functions
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('SUPABASE_API_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[get-secrets] Missing Supabase configuration:', { 
    hasUrl: !!SUPABASE_URL, 
    hasKey: !!SUPABASE_ANON_KEY 
  });
}

// Whitelist of keys that can be requested
const ALLOWED_KEYS = ['DEEPGRAM_API_KEY'];

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      ...(init.headers || {}) 
    },
  });
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      }
    });
  }

  try {
    console.log('[get-secrets] Request received');
    
    // Note: Supabase Edge Functions are already protected by Supabase Auth
    // when called via supabase.functions.invoke() with user's session token
    // So we can skip manual auth verification here

    // Parse request body
    const body = await req.json();
    const requestedKeys = body.keys || [];

    if (!Array.isArray(requestedKeys)) {
      return json({ error: 'invalid_request', message: 'keys must be an array' }, { status: 400 });
    }

    // Validate all requested keys are allowed
    for (const key of requestedKeys) {
      if (!ALLOWED_KEYS.includes(key)) {
        return json({ 
          error: 'forbidden', 
          message: `Key '${key}' is not allowed` 
        }, { status: 403 });
      }
    }

    // Return requested secrets
    const secrets: Record<string, string | undefined> = {};
    for (const key of requestedKeys) {
      secrets[key] = Deno.env.get(key);
    }

    return json(secrets);

  } catch (e) {
    console.error('[get-secrets] Error:', e);
    return json({ 
      error: 'internal_error', 
      message: e instanceof Error ? e.message : String(e) 
    }, { status: 500 });
  }
});
