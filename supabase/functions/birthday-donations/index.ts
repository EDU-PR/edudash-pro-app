// Supabase Edge Function: birthday-donations
// Records birthday donation entries and updates daily summary.

// Deno type declaration for Edge Functions
// @ts-ignore
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @ts-ignore
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const recordSchema = z.object({
  action: z.literal('record'),
  donationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().positive(),
  paymentMethod: z.string().max(50).optional(),
  note: z.string().max(500).optional(),
});

type RecordRequest = z.infer<typeof recordSchema>;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization') || '';

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('id, role, organization_id, preschool_id')
      .or(`id.eq.${user.id},auth_user_id.eq.${user.id}`)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ success: false, error: 'Profile not found' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const role = String(profile.role || '');
    const allowedRoles = new Set(['teacher', 'principal', 'principal_admin', 'admin', 'superadmin', 'super_admin', 'staff']);
    if (!allowedRoles.has(role)) {
      return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const organizationId = profile.organization_id || profile.preschool_id;
    if (!organizationId) {
      return new Response(JSON.stringify({ success: false, error: 'Organization not found' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const json = await req.json();
    const parsed = recordSchema.safeParse(json);
    if (!parsed.success) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid request', details: parsed.error.flatten() }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload: RecordRequest = parsed.data;

    const { data: dayRow, error: recordError } = await serviceClient
      .rpc('record_birthday_donation', {
        org_id: organizationId,
        donation_day: payload.donationDate,
        donation_amount: payload.amount,
        donation_method: payload.paymentMethod ?? null,
        donation_note: payload.note ?? null,
        recorded_by_user: user.id,
      })
      .maybeSingle();

    if (recordError) {
      return new Response(JSON.stringify({ success: false, error: recordError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, data: dayRow }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
