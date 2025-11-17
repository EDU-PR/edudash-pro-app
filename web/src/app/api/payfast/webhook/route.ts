import { NextRequest, NextResponse } from 'next/server';import { NextRequest, NextResponse } from 'next/server';import { NextRequest, NextResponse } from 'next/server';



/**import crypto from 'crypto';

 * PayFast ITN Webhook Proxy

 * /**import { createClient } from '@supabase/supabase-js';

 * PayFast allows setting a global ITN URL in the merchant dashboard.

 * This route acts as a proxy, forwarding ITN requests to our Supabase Edge Function. * PayFast ITN Webhook Proxy

 * 

 * Why proxy instead of direct edge function? * // Lazy initialization to avoid build-time errors

 * - PayFast merchant dashboard webhook URL may be set to /api/payfast/webhook

 * - This ensures backward compatibility and catches ITNs sent to either URL * PayFast allows setting a global ITN URL in the merchant dashboard.function getSupabaseAdmin() {

 */

export async function POST(request: NextRequest) { * This route acts as a proxy, forwarding ITN requests to our Supabase Edge Function.  return createClient(

  console.log('[PayFast Proxy] Received ITN, forwarding to edge function...');

 *     process.env.NEXT_PUBLIC_SUPABASE_URL!,

  try {

    // Get the raw body * Why proxy instead of direct edge function?    process.env.SUPABASE_SERVICE_ROLE_KEY!

    const body = await request.text();

     * - PayFast merchant dashboard webhook URL may be set to /api/payfast/webhook  );

    console.log('[PayFast Proxy] Body length:', body.length);

     * - This ensures backward compatibility and catches ITNs sent to either URL}

    // Forward to Supabase Edge Function

    const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/payfast-webhook`; */

    

    const response = await fetch(edgeFunctionUrl, {export async function POST(request: NextRequest) {const PAYFAST_MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID || '';

      method: 'POST',

      headers: {  console.log('[PayFast Proxy] Received ITN, forwarding to edge function...');const PAYFAST_MERCHANT_KEY=REDACTED

        'Content-Type': 'application/x-www-form-urlencoded',

        'x-forwarded-for': request.headers.get('x-forwarded-for') || '',const PAYFAST_PASSPHRASE=REDACTED

        'x-real-ip': request.headers.get('x-real-ip') || '',

      },  try {const PAYFAST_MODE = (process.env.PAYFAST_MODE || 'sandbox').toLowerCase();

      body: body,

    });    // Get the raw body



    const responseText = await response.text();    const body = await request.text();function generateSignature(data: Record<string, any>, passPhrase: string = '') {

    

    console.log('[PayFast Proxy] Edge function response:', {      let pfOutput = '';

      status: response.status,

      statusText: response.statusText,    console.log('[PayFast Proxy] Body length:', body.length);  

      body: responseText.substring(0, 100),

    });      // CRITICAL: Sort keys alphabetically (required by PayFast)



    // Return the same response from edge function    // Forward to Supabase Edge Function  const sortedKeys = Object.keys(data).sort();

    return new NextResponse(responseText, {

      status: response.status,    const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/payfast-webhook`;  

      headers: {

        'Content-Type': 'text/plain',      for (const key of sortedKeys) {

      },

    });    const response = await fetch(edgeFunctionUrl, {    if (key !== 'signature' && data[key] !== '') {

  } catch (error) {

    console.error('[PayFast Proxy] Error forwarding to edge function:', error);      method: 'POST',      pfOutput += `${key}=${encodeURIComponent(data[key].toString().trim()).replace(/%20/g, '+')}&`;

    

    return new NextResponse('Internal Server Error', {      headers: {    }

      status: 500,

      headers: {        'Content-Type': 'application/x-www-form-urlencoded',  }

        'Content-Type': 'text/plain',

      },        'x-forwarded-for': request.headers.get('x-forwarded-for') || '',  

    });

  }        'x-real-ip': request.headers.get('x-real-ip') || '',  let getString = pfOutput.slice(0, -1);

}

      },  if (passPhrase !== '') {

// Handle OPTIONS for CORS

export async function OPTIONS() {      body: body,    getString += `&passphrase=${encodeURIComponent(passPhrase.trim()).replace(/%20/g, '+')}`;

  return new NextResponse('ok', {

    status: 200,    });  }

    headers: {

      'Access-Control-Allow-Origin': '*',  

      'Access-Control-Allow-Methods': 'POST, OPTIONS',

      'Access-Control-Allow-Headers': 'Content-Type',    const responseText = await response.text();  console.log('[PayFast Webhook] Signature generation:', {

    },

  });        sortedKeys,

}

    console.log('[PayFast Proxy] Edge function response:', {    paramStringLength: getString.length,

      status: response.status,  });

      statusText: response.statusText,  

      body: responseText.substring(0, 100),  return crypto.createHash('md5').update(getString).digest('hex');

    });}



    // Return the same response from edge functionexport async function POST(request: NextRequest) {

    return new NextResponse(responseText, {  const startTime = Date.now();

      status: response.status,  

      headers: {  try {

        'Content-Type': 'text/plain',    // Parse form data from PayFast

      },    const formData = await request.formData();

    });    const data: Record<string, any> = {};

  } catch (error) {    

    console.error('[PayFast Proxy] Error forwarding to edge function:', error);    formData.forEach((value, key) => {

          data[key] = value.toString();

    return new NextResponse('Internal Server Error', {    });

      status: 500,

      headers: {    console.log('[PayFast Webhook] Received data:', {

        'Content-Type': 'text/plain',      payment_id: data.m_payment_id,

      },      pf_payment_id: data.pf_payment_id,

    });      status: data.payment_status,

  }      amount: data.amount_gross,

}      user_id: data.custom_str1,

      tier: data.custom_str2,

// Handle OPTIONS for CORS    });

export async function OPTIONS() {

  return new NextResponse('ok', {    // Validate required fields

    status: 200,    if (!data.custom_str1 || !data.custom_str2) {

    headers: {      console.error('[PayFast Webhook] Missing required custom fields:', data);

      'Access-Control-Allow-Origin': '*',      return NextResponse.json({ error: 'Missing user_id or tier' }, { status: 400 });

      'Access-Control-Allow-Methods': 'POST, OPTIONS',    }

      'Access-Control-Allow-Headers': 'Content-Type',

    },    // Verify signature

  });    const receivedSignature = data.signature;

}    if (!receivedSignature) {

      console.error('[PayFast Webhook] Missing signature');
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }
    
    delete data.signature;
    // Sandbox signatures must NOT include passphrase
    const sigPassphrase = PAYFAST_MODE === 'production' ? PAYFAST_PASSPHRASE : '';
    const calculatedSignature = generateSignature(data, sigPassphrase);

    if (receivedSignature !== calculatedSignature) {
      console.error('[PayFast Webhook] Invalid signature:', {
        received: receivedSignature,
        calculated: calculatedSignature,
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Verify merchant details
    if (data.merchant_id !== PAYFAST_MERCHANT_ID) {
      console.error('[PayFast Webhook] Invalid merchant ID:', {
        received: data.merchant_id,
        expected: PAYFAST_MERCHANT_ID,
      });
      return NextResponse.json({ error: 'Invalid merchant' }, { status: 400 });
    }

    const user_id = data.custom_str1;
    const tier = data.custom_str2; // e.g. parent_starter, parent_plus, school_starter
    const payment_status = data.payment_status;

    console.log('[PayFast Webhook] Processing payment:', { user_id, tier, payment_status });

    // Handle payment success
    if (payment_status === 'COMPLETE') {
      const supabaseAdmin = getSupabaseAdmin();
      
      // Use tier as-is (already matches tier_name_aligned enum)
      // Values: parent_starter, parent_plus, school_starter, school_premium, school_pro

      // Map product tier -> capability tier classification used by AI gating system
      const capabilityTierMap: Record<string, 'free' | 'starter' | 'premium' | 'enterprise'> = {
        free: 'free',
        parent_starter: 'starter',
        parent_plus: 'premium',
        school_starter: 'starter',
        school_premium: 'premium',
        school_pro: 'enterprise'
      };

      const capabilityTier = capabilityTierMap[tier] || 'free';
      console.log('[PayFast Webhook] Tier normalization:', { originalTier: tier, capabilityTier });
      
      // Update user tier in user_ai_tiers table
      const { error: tierError } = await supabaseAdmin
        .from('user_ai_tiers')
        .upsert({
          user_id,
          tier: tier, // Store product tier for display / billing alignment
          // If the table has a separate capability column, include it (ignore error if column absent)
          capability_tier: capabilityTier as any,
          assigned_reason: `PayFast subscription payment ${data.pf_payment_id}`,
          is_active: true,
          metadata: {
            payment_id: data.m_payment_id,
            pf_payment_id: data.pf_payment_id,
            amount: data.amount_gross,
            payment_date: new Date().toISOString(),
            capability_tier: capabilityTier
          },
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (tierError) {
        console.error('[PayFast Webhook] Failed to update user tier:', tierError);
        return NextResponse.json({ 
          error: 'Failed to update tier', 
          details: tierError.message 
        }, { status: 500 });
      } else {
        console.log('[PayFast Webhook] Successfully updated user tier to:', tier);
      }

      // Also update current_tier in user_ai_usage for quota tracking
      const { error: usageError } = await supabaseAdmin
        .from('user_ai_usage')
        .upsert({
          user_id,
          current_tier: capabilityTier, // normalized tier for capability gating (free|starter|premium|enterprise)
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (usageError) {
        console.error('[PayFast Webhook] Failed to update usage tier:', usageError);
        // Don't fail the webhook - tier update succeeded
      }

      // Disable trial for the user after successful subscription
      try {
        const { error: trialError } = await supabaseAdmin
          .from('profiles')
          .update({ is_trial: false })
          .eq('id', user_id);
        if (trialError) {
          console.warn('[PayFast Webhook] Failed to disable trial flag:', trialError.message);
        }
      } catch (e) {
        console.warn('[PayFast Webhook] Trial flag update exception:', e);
      }

      // Log the payment in subscriptions table (create if doesn't exist)
      const { error: subError } = await supabaseAdmin
        .from('subscriptions')
        .insert({
          user_id,
          tier,
          status: 'active',
          payment_method: 'payfast',
          amount: parseFloat(data.amount_gross),
          payment_id: data.m_payment_id,
          pf_payment_id: data.pf_payment_id,
          subscription_start: new Date().toISOString(),
          metadata: data,
        });

      if (subError && subError.code !== '42P01') { // Ignore table doesn't exist error
        console.error('[PayFast Webhook] Failed to log subscription:', subError);
        // Don't fail the webhook - main tier update succeeded
      }

      const duration = Date.now() - startTime;
      console.log(`[PayFast Webhook] Payment processed successfully in ${duration}ms`);
      return NextResponse.json({ 
        success: true, 
        message: 'Payment processed',
        tier: tier,
      });
    }

    // Handle payment cancellation or failure
    if (payment_status === 'CANCELLED' || payment_status === 'FAILED') {
      console.log('[PayFast Webhook] Payment cancelled or failed:', {
        status: payment_status,
        payment_id: data.m_payment_id,
      });
      return NextResponse.json({ 
        success: true, 
        message: 'Payment status recorded',
        status: payment_status,
      });
    }

    return NextResponse.json({ success: true, message: 'Webhook received' });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[PayFast Webhook] Error after ${duration}ms:', error);
    
    // Log error details
    if (error instanceof Error) {
      console.error('[PayFast Webhook] Error details:', {
        message: error.message,
        stack: error.stack,
      });
    }
    
    return NextResponse.json(
      { 
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
