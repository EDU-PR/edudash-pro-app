import { serve } from 'https://deno.land/std@0.214.0/http/server.ts';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

type JsonRecord = Record<string, unknown>;

type ProfileRow = {
  id: string;
  role: string | null;
  organization_id: string | null;
  preschool_id: string | null;
};

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': Deno.env.get('CORS_ALLOW_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const RequestSchema = z.object({
  action: z.enum(['queue', 'status']),
  payload: z.record(z.unknown()).optional(),
});

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function normalizeOrgId(profile: ProfileRow): string | null {
  return profile.organization_id || profile.preschool_id || null;
}

async function fetchProfile(supabase: ReturnType<typeof createClient>, authUserId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, organization_id, preschool_id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (error || !data) return null;
  return data as ProfileRow;
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    const parsed = RequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: 'Invalid request payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, payload = {} } = parsed.data;
    const authHeader = req.headers.get('Authorization') || '';

    const supabaseUrl = getEnv('SUPABASE_URL');
    const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY');

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const profile = await fetchProfile(supabase, userData.user.id);
    if (!profile) {
      return new Response(JSON.stringify({ error: 'Organization membership required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orgId = normalizeOrgId(profile);
    if (!orgId) {
      return new Response(JSON.stringify({ error: 'Organization membership required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'status') {
      const eventId = String(payload.event_id || '');
      if (!eventId) {
        return new Response(JSON.stringify({ error: 'event_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data, error } = await supabase
        .from('birthday_memory_montage_jobs')
        .select('id, status, output_path, error_message, created_at, updated_at')
        .eq('event_id', eventId)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'queue') {
      const eventId = String(payload.event_id || '');
      if (!eventId) {
        return new Response(JSON.stringify({ error: 'event_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: existing } = await supabase
        .from('birthday_memory_montage_jobs')
        .select('id, status, created_at')
        .eq('event_id', eventId)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing && ['queued', 'processing', 'ready'].includes(String(existing.status || ''))) {
        return new Response(JSON.stringify({ success: true, data: existing, message: 'Already queued' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: created, error } = await supabase
        .from('birthday_memory_montage_jobs')
        .insert({
          event_id: eventId,
          organization_id: orgId,
          status: 'queued',
          requested_by: profile.id,
        })
        .select('id, status, created_at')
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, data: created }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unsupported action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: 'birthday_montage_error', message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
