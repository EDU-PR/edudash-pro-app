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
  page_id: z.string().min(3),
  page_name: z.string().min(1).optional(),
  page_access_token: z.string().min(20),
  token_expires_at: z.string().datetime().optional(),
});

const encoder = new TextEncoder();
const decoder = new TextDecoder();
let cachedCryptoKey: CryptoKey | null = null;

function base64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function getEncryptionKey(): Promise<CryptoKey> {
  if (cachedCryptoKey) return cachedCryptoKey;

  const raw = Deno.env.get('SOCIAL_TOKEN_ENCRYPTION_KEY') || '';
  if (!raw) {
    throw new Error('Missing SOCIAL_TOKEN_ENCRYPTION_KEY');
  }

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

async function encryptToken(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext));
  return `v1.${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ciphertext))}`;
}

function getFacebookGraphBaseUrl(): string {
  const version = (Deno.env.get('FACEBOOK_GRAPH_VERSION') || 'v20.0').trim();
  return `https://graph.facebook.com/${version}`;
}

async function resolveOrgId(supabase: ReturnType<typeof createClient>, userId: string) {
  // profiles.id is sometimes auth uid; sometimes profiles.auth_user_id is auth uid.
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

  if (!profile) {
    return { profile: null as any, organizationId: null as string | null };
  }

  const organizationId = (profile.organization_id || profile.preschool_id) as string | null;
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

    const { profile, organizationId } = await resolveOrgId(supabase, userData.user.id);
    if (!profile || !organizationId) {
      return jsonResponse(403, { error: 'organization_required' });
    }

    const role = String(profile.role || '');
    const allowedRoles = new Set(['principal', 'principal_admin', 'admin', 'preschool_admin', 'superadmin', 'super_admin']);
    if (!allowedRoles.has(role)) {
      return jsonResponse(403, { error: 'forbidden', message: 'Principal/admin role required' });
    }

    const graphBase = getFacebookGraphBaseUrl();
    const validationUrl = new URL(`${graphBase}/${parsed.data.page_id}`);
    validationUrl.searchParams.set('fields', 'id,name');
    validationUrl.searchParams.set('access_token', parsed.data.page_access_token);

    const validationResp = await fetch(validationUrl.toString(), { method: 'GET' });
    const validationText = await validationResp.text();
    if (!validationResp.ok) {
      return jsonResponse(400, {
        error: 'facebook_token_invalid',
        message: 'Facebook token could not be validated for this Page ID',
        details: (() => {
          try { return JSON.parse(validationText); } catch { return validationText; }
        })(),
      });
    }

    const validationJson = (() => {
      try { return JSON.parse(validationText) as { id?: string; name?: string }; } catch { return {}; }
    })();

    const pageName = parsed.data.page_name || validationJson.name || null;
    const tokenCiphertext = await encryptToken(parsed.data.page_access_token);

    const upsert = await supabase
      .from('social_connections')
      .upsert(
        {
          organization_id: organizationId,
          platform: 'facebook_page',
          page_id: parsed.data.page_id,
          page_name: pageName,
          token_ciphertext: tokenCiphertext,
          token_expires_at: parsed.data.token_expires_at ?? null,
          is_active: true,
          created_by: profile.id,
          last_error: null,
        },
        { onConflict: 'organization_id,platform,page_id' }
      )
      .select('id, organization_id, platform, page_id, page_name, is_active, created_at, updated_at')
      .single();

    if (upsert.error) {
      return jsonResponse(500, { error: 'db_error', message: upsert.error.message });
    }

    return jsonResponse(200, { success: true, connection: upsert.data });
  } catch (error) {
    return jsonResponse(500, {
      error: 'social_facebook_connect_error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

