/**
 * Social Publisher Cron
 * Publishes due scheduled posts for connected Facebook Pages.
 *
 * Uses DB-side atomic claim (public.claim_due_social_posts) to avoid double-posting.
 */

import { serve } from 'https://deno.land/std@0.214.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') || 'your-cron-secret';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

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
  if (parts.length !== 3 || parts[0] !== 'v1') throw new Error('Unsupported token ciphertext format');
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

type ClaimedPost = {
  post_id: string;
  organization_id: string;
  platform: 'facebook_page';
  page_id: string;
  token_ciphertext: string;
  content: string;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return jsonResponse(200, { status: 'ok', service: 'social-publisher-cron' });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'method_not_allowed' });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return jsonResponse(401, { error: 'unauthorized' });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse(500, { error: 'server_misconfigured' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const limit = Number((await req.json().catch(() => ({})))?.limit ?? 20);

    const claimed = await supabase.rpc('claim_due_social_posts', { p_limit: Number.isFinite(limit) ? limit : 20 });
    if (claimed.error) {
      return jsonResponse(500, { error: 'db_error', message: claimed.error.message });
    }

    const posts: ClaimedPost[] = (claimed.data || []) as any;
    const results = {
      claimed: posts.length,
      published: 0,
      failed: 0,
      details: [] as Array<{ post_id: string; status: 'published' | 'failed'; error?: string; facebook_id?: string }>,
    };

    const graphBase = getFacebookGraphBaseUrl();

    for (const p of posts) {
      try {
        const fbToken = await decryptToken(p.token_ciphertext);
        const publishUrl = `${graphBase}/${encodeURIComponent(p.page_id)}/feed`;
        const params = new URLSearchParams();
        params.set('message', String(p.content || ''));
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
            .eq('id', p.post_id)
            .eq('organization_id', p.organization_id);

          await supabase
            .from('social_connections')
            .update({ last_error: errorMessage })
            .eq('organization_id', p.organization_id)
            .eq('platform', 'facebook_page')
            .eq('page_id', p.page_id);

          results.failed++;
          results.details.push({ post_id: p.post_id, status: 'failed', error: errorMessage });
          continue;
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
          .eq('id', p.post_id)
          .eq('organization_id', p.organization_id);

        await supabase
          .from('social_connections')
          .update({ last_used_at: new Date().toISOString(), last_error: null })
          .eq('organization_id', p.organization_id)
          .eq('platform', 'facebook_page')
          .eq('page_id', p.page_id);

        results.published++;
        results.details.push({ post_id: p.post_id, status: 'published', facebook_id: externalId || undefined });
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        await supabase
          .from('social_posts')
          .update({ status: 'failed', error_message: errorMessage })
          .eq('id', p.post_id)
          .eq('organization_id', p.organization_id);

        results.failed++;
        results.details.push({ post_id: p.post_id, status: 'failed', error: errorMessage });
      }

      // Avoid platform rate limits and smooth out bursts
      await new Promise((r) => setTimeout(r, 150));
    }

    return jsonResponse(200, { success: true, results });
  } catch (error) {
    return jsonResponse(500, { error: 'social_publisher_cron_error', message: error instanceof Error ? error.message : String(error) });
  }
});

