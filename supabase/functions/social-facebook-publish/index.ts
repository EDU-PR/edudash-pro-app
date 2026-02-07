import { serve } from 'https://deno.land/std@0.214.0/http/server.ts';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': Deno.env.get('CORS_ALLOW_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const RequestSchema = z.object({
  post_id: z.string().uuid(),
});

let cachedCryptoKey: CryptoKey | null = null;

function base64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function getEncryptionKey(): Promise<CryptoKey> {
  if (cachedCryptoKey) return cachedCryptoKey;
  const raw = Deno.env.get('SOCIAL_TOKEN_ENCRYPTION_KEY') || '';
  if (!raw) throw new Error('Missing SOCIAL_TOKEN_ENCRYPTION_KEY');
  const keyBytes = base64ToBytes(raw);
  if (keyBytes.byteLength !== 32) {
    throw new Error('SOCIAL_TOKEN_ENCRYPTION_KEY must be base64 for exactly 32 bytes (AES-256-GCM)');
  }
  cachedCryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
  return cachedCryptoKey;
}

async function decryptToken(ciphertext: string): Promise<string> {
  const trimmed = String(ciphertext || '').trim();
  const parts = trimmed.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') {
    throw new Error('Unsupported token ciphertext format');
  }
  const iv = base64ToBytes(parts[1]);
  const data = base64ToBytes(parts[2]);
  const key = await getEncryptionKey();
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(plainBuf);
}

function getFacebookGraphBaseUrl(): string {
  const version = (Deno.env.get('FACEBOOK_GRAPH_VERSION') || 'v20.0').trim();
  return `https://graph.facebook.com/${version}`;
}

async function resolveOrgAndProfile(
  supabase: ReturnType<typeof createClient>,
  userId: string,
) {
  const byAuthUserId = await supabase
    .from('profiles')
    .select('id, role, organization_id, preschool_id')
    .eq('auth_user_id', userId)
    .maybeSingle();

  const profile = byAuthUserId.data?.id
    ? byAuthUserId.data
    : (
      await supabase
        .from('profiles')
        .select('id, role, organization_id, preschool_id')
        .eq('id', userId)
        .maybeSingle()
    ).data;

  const organizationId = (profile?.organization_id || profile?.preschool_id) as string | null;
  return { profile, organizationId };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'method_not_allowed' });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse(500, { error: 'server_misconfigured', message: 'Missing Supabase env' });
    }

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer', '').trim();
    if (!token) {
      return jsonResponse(401, { error: 'unauthorized' });
    }

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return jsonResponse(401, { error: 'unauthorized' });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(400, { error: 'invalid_request', details: parsed.error.flatten() });
    }

    const { profile, organizationId } = await resolveOrgAndProfile(supabase, userData.user.id);
    if (!profile || !organizationId) {
      return jsonResponse(403, { error: 'organization_required' });
    }

    const role = String(profile.role || '');
    const allowedRoles = new Set(['principal', 'principal_admin', 'admin', 'preschool_admin', 'superadmin', 'super_admin']);
    if (!allowedRoles.has(role)) {
      return jsonResponse(403, { error: 'forbidden', message: 'Principal/admin role required' });
    }

    const postRes = await supabase
      .from('social_posts')
      .select('*')
      .eq('id', parsed.data.post_id)
      .eq('organization_id', organizationId)
      .single();

    if (postRes.error || !postRes.data) {
      return jsonResponse(404, { error: 'post_not_found' });
    }

    const post = postRes.data as any;
    if (post.status === 'published') {
      return jsonResponse(200, { success: true, post, already_published: true });
    }

    const connectionId = post.connection_id as string | null;
    if (!connectionId) {
      return jsonResponse(400, { error: 'no_connection', message: 'Post has no Facebook connection' });
    }

    // Claim publishing state first (best-effort; avoids double clicks)
    await supabase
      .from('social_posts')
      .update({
        status: 'publishing',
        approved_by: post.requires_approval ? profile.id : post.approved_by,
        approved_at: post.requires_approval ? new Date().toISOString() : post.approved_at,
        error_message: null,
      })
      .eq('id', post.id)
      .eq('organization_id', organizationId);

    const connRes = await supabase
      .from('social_connections')
      .select('id, page_id, token_ciphertext, is_active')
      .eq('id', connectionId)
      .eq('organization_id', organizationId)
      .eq('platform', 'facebook_page')
      .single();

    if (connRes.error || !connRes.data) {
      await supabase
        .from('social_posts')
        .update({ status: 'failed', error_message: 'Facebook connection not found' })
        .eq('id', post.id)
        .eq('organization_id', organizationId);
      return jsonResponse(400, { error: 'invalid_connection' });
    }

    if (!connRes.data.is_active) {
      await supabase
        .from('social_posts')
        .update({ status: 'failed', error_message: 'Facebook connection is inactive' })
        .eq('id', post.id)
        .eq('organization_id', organizationId);
      return jsonResponse(400, { error: 'connection_inactive' });
    }

    const pageId = connRes.data.page_id as string;
    const fbToken = await decryptToken(connRes.data.token_ciphertext as string);

    const graphBase = getFacebookGraphBaseUrl();
    const publishUrl = `${graphBase}/${encodeURIComponent(pageId)}/feed`;
    const params = new URLSearchParams();
    params.set('message', String(post.content || ''));
    params.set('access_token', fbToken);

    const publishResp = await fetch(publishUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const publishText = await publishResp.text();
    const publishJson = (() => {
      try { return JSON.parse(publishText) as any; } catch { return { raw: publishText }; }
    })();

    if (!publishResp.ok) {
      const errorMessage =
        publishJson?.error?.message ||
        publishJson?.message ||
        `Facebook publish failed (${publishResp.status})`;

      await supabase
        .from('social_posts')
        .update({ status: 'failed', error_message: errorMessage })
        .eq('id', post.id)
        .eq('organization_id', organizationId);

      await supabase
        .from('social_connections')
        .update({ last_error: errorMessage })
        .eq('id', connectionId)
        .eq('organization_id', organizationId);

      return jsonResponse(502, { error: 'facebook_publish_failed', message: errorMessage, details: publishJson });
    }

    const externalId = String(publishJson?.id || '');
    await supabase
      .from('social_posts')
      .update({
        status: 'published',
        external_post_id: externalId || null,
        published_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', post.id)
      .eq('organization_id', organizationId);

    await supabase
      .from('social_connections')
      .update({
        last_used_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('id', connectionId)
      .eq('organization_id', organizationId);

    const refreshed = await supabase
      .from('social_posts')
      .select('*')
      .eq('id', post.id)
      .eq('organization_id', organizationId)
      .single();

    return jsonResponse(200, {
      success: true,
      post: refreshed.data || post,
      facebook: { id: externalId || null },
    });
  } catch (error) {
    return jsonResponse(500, {
      error: 'social_facebook_publish_error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

