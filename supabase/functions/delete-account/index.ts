/**
 * Delete Account Edge Function
 * 
 * Permanently deletes a user account and all associated data.
 * Required for POPIA (South Africa) and GDPR compliance.
 * 
 * Expected body: { confirm: true }
 * Auth: Bearer token required (user deletes their own account)
 * 
 * Returns: { success: true }
 */

import { serve } from 'https://deno.land/std@0.214.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return handleCorsOptions(req);
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!);

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    if (!body.confirm) {
      return new Response(JSON.stringify({ error: 'Deletion must be explicitly confirmed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;
    console.log('[delete-account] Starting account deletion for user:', userId);

    // Delete user data from related tables (order matters for FK constraints)
    // These are best-effort — some tables may not exist yet
    const tablesToClean = [
      'ai_request_log',
      'user_ai_usage',
      'user_ai_tiers',
      'push_subscriptions',
      'user_preferences',
      'notifications',
      'student_homework_submissions',
      'conversation_messages',
      'conversations',
      'user_sessions',
    ];

    for (const table of tablesToClean) {
      try {
        await supabase.from(table).delete().eq('user_id', userId);
      } catch {
        // Table may not exist or user may have no rows — continue
      }
    }

    // Clean profile
    try {
      await supabase.from('profiles').delete().eq('id', userId);
    } catch {
      console.warn('[delete-account] Could not delete profile');
    }

    // Delete the auth user (this is the actual account deletion)
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('[delete-account] Failed to delete auth user:', deleteError);
      throw new Error('Failed to delete account. Please contact support.');
    }

    console.log('[delete-account] Account deleted successfully:', userId);

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    console.error('[delete-account] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
