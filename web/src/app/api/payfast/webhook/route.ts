import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Lazy initialization to avoid build-time errors
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const PAYFAST_MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID || '';
const PAYFAST_MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY || '';
const PAYFAST_PASSPHRASE = process.env.PAYFAST_PASSPHRASE || '';
const PAYFAST_MODE = (process.env.PAYFAST_MODE || 'sandbox').toLowerCase();

function generateSignature(data: Record<string, string>, passPhrase: string = '') {
  let pfOutput = '';
  
  // CRITICAL: Sort keys alphabetically (required by PayFast)
  const sortedKeys = Object.keys(data).sort();
  
  for (const key of sortedKeys) {
    if (key !== 'signature' && data[key] !== '') {
      pfOutput += `${key}=${encodeURIComponent(data[key].toString().trim()).replace(/%20/g, '+')}&`;
    }
  }
  
  let getString = pfOutput.slice(0, -1);
  if (passPhrase !== '') {
    getString += `&passphrase=${encodeURIComponent(passPhrase.trim()).replace(/%20/g, '+')}`;
  }
  
  console.log('[PayFast Webhook] Signature generation:', {
    sortedKeys,
    paramStringLength: getString.length,
  });
  
  return crypto.createHash('md5').update(getString).digest('hex');
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse form data from PayFast
    const formData = await request.formData();
    const data: Record<string, string> = {};
    
    formData.forEach((value, key) => {
      data[key] = value.toString();
    });
    
    console.log('[PayFast Webhook] Received data:', {
      payment_id: data.m_payment_id,
      pf_payment_id: data.pf_payment_id,
      status: data.payment_status,
      amount: data.amount_gross,
      user_id: data.custom_str1,
      tier: data.custom_str2,
    });

    // Validate required fields
    if (!data.custom_str1 || !data.custom_str2) {
      console.error('[PayFast Webhook] Missing required custom fields:', data);
      return NextResponse.json({ error: 'Missing user_id or tier' }, { status: 400 });
    }

    // Verify signature
    const receivedSignature = data.signature;
    if (!receivedSignature) {
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
    const tier = data.custom_str2;
    const payment_status = data.payment_status;

    console.log('[PayFast Webhook] Processing payment:', { user_id, tier, payment_status });

    // Handle payment success
    if (payment_status === 'COMPLETE') {
      const supabaseAdmin = getSupabaseAdmin();
      
      // Map product tier -> capability tier classification
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
          tier: tier,
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
          current_tier: tier,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (usageError) {
        console.error('[PayFast Webhook] Failed to update usage tier:', usageError);
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

      // Log the payment in subscriptions table
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

      if (subError && subError.code !== '42P01') {
        console.error('[PayFast Webhook] Failed to log subscription:', subError);
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
    console.error(`[PayFast Webhook] Error after ${duration}ms:`, error);
    
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

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse('ok', {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
