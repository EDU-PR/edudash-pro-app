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
  action: z.enum(['list_events', 'get_or_create_event', 'list_media', 'get_view_url', 'get_download_url']),
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

async function isParentOfStudent(
  supabase: ReturnType<typeof createClient>,
  parentProfileId: string,
  studentId: string
): Promise<boolean> {
  const { data: student, error } = await supabase
    .from('students')
    .select('id, parent_id, guardian_id')
    .eq('id', studentId)
    .maybeSingle();

  if (error || !student) return false;

  if (student.parent_id === parentProfileId || student.guardian_id === parentProfileId) return true;

  const { data: rel } = await supabase
    .from('student_parent_relationships')
    .select('student_id, parent_id')
    .eq('student_id', studentId)
    .eq('parent_id', parentProfileId)
    .maybeSingle();

  return !!rel;
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
    const supabaseServiceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

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

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    if (action === 'list_events') {
      const { data, error } = await supabase
        .from('birthday_memory_events')
        .select('id, birthday_student_id, event_date, created_at')
        .eq('organization_id', orgId)
        .order('event_date', { ascending: false });

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_or_create_event') {
      const birthdayStudentId = String(payload.birthday_student_id || '');
      const eventDate = String(payload.event_date || '');
      if (!birthdayStudentId || !eventDate) {
        return new Response(JSON.stringify({ error: 'birthday_student_id and event_date required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: existing } = await supabase
        .from('birthday_memory_events')
        .select('id, birthday_student_id, event_date, created_at')
        .eq('organization_id', orgId)
        .eq('birthday_student_id', birthdayStudentId)
        .eq('event_date', eventDate)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ success: true, data: existing }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: created, error } = await supabase
        .from('birthday_memory_events')
        .insert({
          organization_id: orgId,
          preschool_id: profile.preschool_id,
          birthday_student_id: birthdayStudentId,
          event_date: eventDate,
          created_by: profile.id,
        })
        .select('id, birthday_student_id, event_date, created_at')
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, data: created }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'list_media') {
      const eventId = String(payload.event_id || '');
      if (!eventId) {
        return new Response(JSON.stringify({ error: 'event_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data, error } = await supabase
        .from('birthday_memory_media')
        .select('id, event_id, media_type, storage_path, preview_path, created_at, created_by')
        .eq('event_id', eventId)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_view_url') {
      const mediaId = String(payload.media_id || '');
      if (!mediaId) {
        return new Response(JSON.stringify({ error: 'media_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: media, error } = await supabase
        .from('birthday_memory_media')
        .select('storage_path, organization_id')
        .eq('id', mediaId)
        .maybeSingle();

      if (error || !media || media.organization_id !== orgId) {
        return new Response(JSON.stringify({ error: 'Media not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: signed, error: signError } = await admin.storage
        .from('birthday-memories')
        .createSignedUrl(media.storage_path, 10 * 60); // 10 minutes

      if (signError || !signed?.signedUrl) {
        return new Response(JSON.stringify({ error: 'Failed to sign URL' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, url: signed.signedUrl }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_download_url') {
      const mediaId = String(payload.media_id || '');
      if (!mediaId) {
        return new Response(JSON.stringify({ error: 'media_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: media, error } = await supabase
        .from('birthday_memory_media')
        .select('storage_path, organization_id, event_id')
        .eq('id', mediaId)
        .maybeSingle();

      if (error || !media || media.organization_id !== orgId) {
        return new Response(JSON.stringify({ error: 'Media not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: event } = await supabase
        .from('birthday_memory_events')
        .select('birthday_student_id')
        .eq('id', media.event_id)
        .maybeSingle();

      if (!event?.birthday_student_id) {
        return new Response(JSON.stringify({ error: 'Event not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const isParent = await isParentOfStudent(supabase, profile.id, event.birthday_student_id);
      if (!isParent) {
        return new Response(JSON.stringify({ error: 'Not allowed' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: signed, error: signError } = await admin.storage
        .from('birthday-memories')
        .createSignedUrl(media.storage_path, 60 * 60); // 1 hour

      if (signError || !signed?.signedUrl) {
        return new Response(JSON.stringify({ error: 'Failed to sign URL' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, url: signed.signedUrl }), {
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
    return new Response(JSON.stringify({ error: 'birthday_memories_error', message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
