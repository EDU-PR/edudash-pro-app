/**
 * delete-account Edge Function
 *
 * Permanently deletes a user's account and all associated data.
 * Requires `confirm: true` in the request body as a safety guard.
 * Uses service role to cascade through RLS-protected tables.
 */
import { serve } from 'https://deno.land/std@0.214.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleCorsOptions(req);
  const cors = getCorsHeaders(req);

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verify the user from their JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    if (body?.confirm !== true) {
      return new Response(
        JSON.stringify({ error: 'Must include { confirm: true } to delete account' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    const userId = user.id;
    console.log(`[delete-account] Deleting account for user: ${userId}`);

    // 1. Soft-delete profile (mark as deleted, anonymise PII)
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: 'Deleted User',
        email: `deleted-${userId}@removed.edudashpro.org.za`,
        phone: null,
        avatar_url: null,
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (profileError) {
      console.error('[delete-account] Profile update error:', profileError);
    }

    // 2. Remove user from all organization memberships
    const { error: membershipError } = await supabase
      .from('organization_members')
      .delete()
      .eq('user_id', userId);

    if (membershipError) {
      console.error('[delete-account] Membership cleanup error:', membershipError);
    }

    // 3. Anonymise messaging data
    const { error: msgError } = await supabase
      .from('messages')
      .update({ content: '[deleted]', sender_name: 'Deleted User' })
      .eq('sender_id', userId);

    if (msgError) {
      console.error('[delete-account] Message anonymisation error:', msgError);
    }

    // 4. Remove push notification tokens
    const { error: tokenError } = await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', userId);

    if (tokenError) {
      console.error('[delete-account] Push token cleanup error:', tokenError);
    }

    // 5. Remove AI conversation history
    const { error: aiError } = await supabase
      .from('ai_conversations')
      .delete()
      .eq('user_id', userId);

    if (aiError) {
      console.error('[delete-account] AI conversation cleanup error:', aiError);
    }

    // 6. Delete the auth user (cascades sessions, identities)
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('[delete-account] Auth user delete error:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete auth account', details: deleteError.message }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`[delete-account] Successfully deleted user: ${userId}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Account deleted successfully' }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[delete-account] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }
});
