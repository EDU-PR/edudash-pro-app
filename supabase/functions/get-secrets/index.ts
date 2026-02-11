/**
 * Get Secrets Edge Function
 * 
 * Securely provides API keys to client-side code that needs them.
 * Only returns whitelisted secrets, never database or service role keys.
 * 
 * Expected body: { keys: ['DEEPGRAM_API_KEY', ...] }
 * Auth: Bearer token required
 */

import { serve } from 'https://deno.land/std@0.214.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

// Only these secrets may be returned to clients
const ALLOWED_SECRETS = new Set([
  'DEEPGRAM_API_KEY',
  'DAILY_API_KEY',
]);

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return handleCorsOptions(req);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const requestedKeys: string[] = body.keys || [];

    const result: Record<string, string | null> = {};
    for (const key of requestedKeys) {
      if (ALLOWED_SECRETS.has(key)) {
        result[key] = Deno.env.get(key) || null;
      } else {
        // Don't reveal that the key exists, just return null
        console.warn(`[get-secrets] Denied access to non-whitelisted key: ${key}`);
        result[key] = null;
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[get-secrets] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
