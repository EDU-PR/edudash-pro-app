/**
 * payfast-create-payment Edge Function
 *
 * Creates a PayFast payment session for subscription upgrades.
 * Returns a payment URL that the client redirects to.
 */
import { serve } from 'https://deno.land/std@0.214.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts';

const PAYFAST_BASE_URL = Deno.env.get('PAYFAST_SANDBOX') === 'true'
  ? 'https://sandbox.payfast.co.za/eng/process'
  : 'https://www.payfast.co.za/eng/process';

// Tier pricing in ZAR (rands)
const TIER_PRICES: Record<string, number> = {
  starter: 99,
  basic: 199,
  premium: 399,
  pro: 599,
  enterprise: 999,
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleCorsOptions(req);
  const cors = getCorsHeaders(req);

  try {
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

    // Verify the user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { tier, amount, email } = body;

    if (!tier || !TIER_PRICES[tier]) {
      return new Response(JSON.stringify({ error: 'Invalid tier' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const expectedAmount = amount || TIER_PRICES[tier];
    const merchantId = Deno.env.get('PAYFAST_MERCHANT_ID');
    const merchantKey = Deno.env.get('PAYFAST_MERCHANT_KEY');

    if (!merchantId || !merchantKey) {
      return new Response(
        JSON.stringify({ error: 'Payment gateway not configured' }),
        { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    // Create a payment transaction record
    const { data: txn, error: txnError } = await supabase
      .from('payment_transactions')
      .insert({
        user_id: user.id,
        amount: expectedAmount,
        currency: 'ZAR',
        status: 'pending',
        payment_method: 'payfast',
        metadata: { tier, source: 'upgrade' },
      })
      .select('id')
      .single();

    if (txnError) {
      console.error('[payfast-create-payment] Transaction insert error:', txnError);
      return new Response(
        JSON.stringify({ error: 'Failed to create payment record' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    const returnUrl = Deno.env.get('PAYFAST_RETURN_URL') || 'https://edudashpro.org.za/payment/success';
    const cancelUrl = Deno.env.get('PAYFAST_CANCEL_URL') || 'https://edudashpro.org.za/payment/cancel';
    const notifyUrl = Deno.env.get('PAYFAST_NOTIFY_URL') ||
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/payfast-webhook`;

    // Build PayFast form parameters
    const params = new URLSearchParams({
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: returnUrl,
      cancel_url: cancelUrl,
      notify_url: notifyUrl,
      m_payment_id: txn.id,
      amount: expectedAmount.toFixed(2),
      item_name: `EduDash Pro ${tier.charAt(0).toUpperCase() + tier.slice(1)} Plan`,
      email_address: email || user.email || '',
      custom_str1: user.id,
      custom_str2: tier,
    });

    const paymentUrl = `${PAYFAST_BASE_URL}?${params.toString()}`;

    return new Response(
      JSON.stringify({
        success: true,
        payment_url: paymentUrl,
        transaction_id: txn.id,
      }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[payfast-create-payment] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }
});
