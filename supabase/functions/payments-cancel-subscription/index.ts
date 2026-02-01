/**
 * PayFast Subscription Cancellation Edge Function
 *
 * Cancels a PayFast subscription token and marks the local subscription as cancelled.
 *
 * Security:
 * - Requires a valid Supabase session
 * - Parents can only cancel their own subscription
 * - Principals/Admins can cancel their school's subscription
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHash } from 'node:crypto';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CancelInput {
  scope: 'user' | 'school';
  userId?: string;
  schoolId?: string;
  reason?: string;
}

function encodePayfastValue(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*~]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%[0-9a-f]{2}/gi, (m) => m.toUpperCase())
    .replace(/%20/g, '+');
}

function buildParamString(data: Record<string, string | number | undefined>): string {
  const sortedKeys = Object.keys(data).sort();
  const parts: string[] = [];
  for (const key of sortedKeys) {
    const value = data[key];
    if (value !== undefined && value !== null && value !== '' && key !== 'signature') {
      parts.push(`${key}=${encodePayfastValue(String(value).trim())}`);
    }
  }
  return parts.join('&');
}

function generatePayFastSignature(
  data: Record<string, string | number | undefined>,
  passphrase: string | undefined
): string {
  let paramString = buildParamString(data);
  if (passphrase && passphrase.trim() !== '') {
    paramString += `&passphrase=${encodePayfastValue(passphrase.trim())}`;
  }
  return createHash('md5').update(paramString).digest('hex');
}

function computePeriodEnd(billing: string | null): string {
  const now = new Date();
  const days = billing === 'annual' ? 365 : 30;
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const input: CancelInput = await req.json();

    const payfastMode = Deno.env.get('PAYFAST_MODE') || 'sandbox';
    const isProduction = payfastMode === 'production';
    const merchantId = (Deno.env.get('PAYFAST_MERCHANT_ID') || '').trim();
    const passphraseRaw = Deno.env.get('PAYFAST_PASSPHRASE');
    const passphrase = passphraseRaw && passphraseRaw.trim() !== '' ? passphraseRaw.trim() : undefined;
    const passphraseForSignature = isProduction ? passphrase : undefined;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

    if (!merchantId) {
      throw new Error('PayFast credentials not configured');
    }

    // Passphrase is optional; include only if configured in PayFast

    const authHeader = req.headers.get('Authorization') || '';
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, preschool_id')
      .eq('id', authData.user.id)
      .maybeSingle();

    const role = (profile?.role || '').toLowerCase();
    const isPrivileged = ['principal', 'admin', 'super_admin', 'superadmin'].includes(role);

    let targetUserId: string | null = null;
    let targetSchoolId: string | null = null;

    if (input.scope === 'user') {
      targetUserId = input.userId || authData.user.id;
      if (targetUserId !== authData.user.id) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      if (!isPrivileged) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      targetSchoolId = input.schoolId || profile?.preschool_id || null;
      if (!targetSchoolId) {
        return new Response(JSON.stringify({ error: 'Missing schoolId' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Locate active subscription/token
    let subscription: any = null;
    let billingFrequency: string | null = null;
    let payfastToken: string | null = null;
    let fallbackPlanId: string | null = null;

    if (input.scope === 'user' && targetUserId) {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('id, status, next_billing_date, end_date, billing_frequency, payfast_token')
        .eq('user_id', targetUserId)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      subscription = sub || null;
      billingFrequency = subscription?.billing_frequency || null;
      payfastToken = subscription?.payfast_token || null;

      if (!payfastToken) {
        const { data: tx } = await supabase
          .from('payment_transactions')
          .select('id, payfast_token, billing_cycle, subscription_plan_id')
          .eq('user_id', targetUserId)
          .eq('status', 'completed')
          .not('payfast_token', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        payfastToken = tx?.payfast_token || null;
        billingFrequency = billingFrequency || tx?.billing_cycle || null;
        fallbackPlanId = tx?.subscription_plan_id || null;
      }
    }

    if (input.scope === 'school' && targetSchoolId) {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('id, status, next_billing_date, end_date, billing_frequency, payfast_token')
        .eq('school_id', targetSchoolId)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      subscription = sub || null;
      billingFrequency = subscription?.billing_frequency || null;
      payfastToken = subscription?.payfast_token || null;
    }

    if (!payfastToken) {
      return new Response(JSON.stringify({ error: 'No active subscription token found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const timestamp = new Date().toISOString();
    const version = 'v1';
    const signatureParams = {
      'merchant-id': merchantId,
      version,
      timestamp,
    } as Record<string, string | number | undefined>;

    const signature = generatePayFastSignature(signatureParams, passphraseForSignature);

    const baseApiUrl = 'https://api.payfast.co.za';
    const testingSuffix = isProduction ? '' : '?testing=true';
    const cancelUrl = `${baseApiUrl}/subscriptions/${payfastToken}/cancel${testingSuffix}`;

    const response = await fetch(cancelUrl, {
      method: 'PUT',
      headers: {
        'merchant-id': String(merchantId),
        version: String(version),
        timestamp: String(timestamp),
        signature: String(signature),
        'Content-Type': 'application/json',
      },
    });

    const responseText = await response.text();
    let responseJson: any = null;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      responseJson = null;
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: 'PayFast cancellation failed',
          details: responseJson || responseText,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const periodEnd = subscription?.next_billing_date || subscription?.end_date || computePeriodEnd(billingFrequency);

    if (subscription?.id) {
      await supabase
        .from('subscriptions')
        .update({
          status: 'cancelled',
          canceled_at: nowIso,
          end_date: periodEnd,
          updated_at: nowIso,
        })
        .eq('id', subscription.id);
    } else if (input.scope === 'user' && targetUserId && fallbackPlanId) {
      await supabase
        .from('subscriptions')
        .insert({
          user_id: targetUserId,
          plan_id: fallbackPlanId,
          status: 'cancelled',
          billing_frequency: billingFrequency || 'monthly',
          seats_total: 1,
          seats_used: 0,
          payfast_token: payfastToken,
          start_date: nowIso,
          end_date: periodEnd,
          next_billing_date: periodEnd,
          updated_at: nowIso,
          owner_type: 'user',
        });
    }

    if (input.scope === 'school' && targetSchoolId) {
      await supabase
        .from('preschools')
        .update({
          subscription_status: 'cancelled',
          subscription_end_date: periodEnd,
          updated_at: nowIso,
        })
        .eq('id', targetSchoolId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        cancelled_at: nowIso,
        ends_at: periodEnd,
        payfast: responseJson || responseText,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[payments-cancel-subscription] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
