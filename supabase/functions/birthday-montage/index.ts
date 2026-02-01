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
  action: z.enum(['queue', 'status', 'approve', 'get_view_url']),
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
    const montageBucket = Deno.env.get('BIRTHDAY_MONTAGE_BUCKET') || 'birthday-memories';

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, supabaseServiceKey);

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
        .select('id, status, output_path, error_message, approved_at, approved_by, sent_at, sent_by, created_at, updated_at')
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
        .select('id, status, created_at, approved_at, approved_by, sent_at, sent_by')
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
        .select('id, status, created_at, approved_at, approved_by, sent_at, sent_by')
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, data: created }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'approve') {
      const eventId = String(payload.event_id || '');
      if (!eventId) {
        return new Response(JSON.stringify({ error: 'event_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const allowedRoles = ['teacher', 'principal', 'admin', 'super_admin', 'principal_admin'];
      if (!allowedRoles.includes(profile.role || '')) {
        return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: job, error: jobError } = await supabase
        .from('birthday_memory_montage_jobs')
        .select('id, status, output_path')
        .eq('event_id', eventId)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (jobError || !job) {
        return new Response(JSON.stringify({ error: 'Montage job not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (job.status !== 'ready' || !job.output_path) {
        return new Response(JSON.stringify({ error: 'Montage not ready' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: updated, error } = await supabase
        .from('birthday_memory_montage_jobs')
        .update({
          approved_at: new Date().toISOString(),
          approved_by: profile.id,
          sent_at: new Date().toISOString(),
          sent_by: profile.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
        .select('id, status, output_path, approved_at, approved_by, sent_at, sent_by, created_at, updated_at')
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, data: updated }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_view_url') {
      const eventId = String(payload.event_id || '');
      if (!eventId) {
        return new Response(JSON.stringify({ error: 'event_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: job, error: jobError } = await supabase
        .from('birthday_memory_montage_jobs')
        .select('id, status, output_path, sent_at, event_id')
        .eq('event_id', eventId)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (jobError || !job) {
        return new Response(JSON.stringify({ error: 'Montage job not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (job.status !== 'ready' || !job.output_path) {
        return new Response(JSON.stringify({ error: 'Montage not ready' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const isParentRole = ['parent', 'guardian', 'sponsor'].includes(profile.role || '');
      if (isParentRole) {
        if (!job.sent_at) {
          return new Response(JSON.stringify({ error: 'Montage not approved' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data: event } = await supabase
          .from('birthday_memory_events')
          .select('birthday_student_id')
          .eq('id', job.event_id)
          .maybeSingle();

        if (!event?.birthday_student_id) {
          return new Response(JSON.stringify({ error: 'Event not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const canView = await isParentOfStudent(supabase, profile.id, event.birthday_student_id);
        if (!canView) {
          return new Response(JSON.stringify({ error: 'Not allowed' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      const outputPath = String(job.output_path || '');
      if (outputPath.startsWith('http')) {
        return new Response(JSON.stringify({ success: true, url: outputPath }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: signed, error: signError } = await admin.storage
        .from(montageBucket)
        .createSignedUrl(outputPath, 60 * 60);

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
    return new Response(JSON.stringify({ error: 'birthday_montage_error', message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
