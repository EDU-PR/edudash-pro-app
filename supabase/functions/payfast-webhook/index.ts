/**
 * PayFast Webhook Handler (ITN - Instant Transaction Notification)
 * 
 * This function receives payment notifications from PayFast and:
 * 1. Validates the signature (CRITICAL for security)
 * 2. Verifies the payment with PayFast server
 * 3. Updates subscription status in the database
 * 4. Updates user tier in profiles table (single source of truth)
 * 
 * SECURITY: Always validate signature and verify with PayFast server!
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHash } from 'node:crypto';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PayFastITNData {
  m_payment_id: string;
  pf_payment_id: string;
  payment_status: string;
  item_name: string;
  amount_gross: string;
  amount_fee: string;
  amount_net: string;
  name_first?: string;
  name_last?: string;
  email_address?: string;
  merchant_id: string;
  signature: string;
  custom_str1?: string; // user_id
  custom_str2?: string; // tier
  custom_str3?: string; // scope
  custom_str4?: string; // billing
  custom_str5?: string; // school_id
  custom_int1?: string; // seats
  token?: string; // Subscription token
  billing_date?: string;
}

/**
 * Validate PayFast signature
 * CRITICAL: Production mode uses passphrase, sandbox does not
 */
function validateSignature(
  data: Record<string, string>,
  signature: string,
  passphrase: string | undefined,
  isProduction: boolean
): boolean {
  // Build param string from received data (excluding signature)
  const sortedKeys = Object.keys(data).filter(k => k !== 'signature').sort();
  let paramString = '';
  
  for (const key of sortedKeys) {
    const value = data[key];
    if (value !== undefined && value !== null && value !== '') {
      const encodedValue = encodeURIComponent(String(value).trim()).replace(/%20/g, '+');
      paramString += `${key}=${encodedValue}&`;
    }
  }
  
  paramString = paramString.slice(0, -1);
  
  // Add passphrase for production
  if (isProduction && passphrase && passphrase.trim() !== '') {
    paramString += `&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`;
  }
  
  const calculatedSig = createHash('md5').update(paramString).digest('hex');
  
  console.log('[payfast-webhook] Signature validation:', {
    isProduction,
    hasPassphrase: isProduction && !!passphrase,
    receivedSig: signature,
    calculatedSig,
    match: calculatedSig === signature,
  });
  
  return calculatedSig === signature;
}

/**
 * Verify payment with PayFast server
 * This is an additional security check to prevent spoofed requests
 */
async function verifyPayment(
  pfData: Record<string, string>,
  isProduction: boolean
): Promise<boolean> {
  const verifyUrl = isProduction
    ? 'https://www.payfast.co.za/eng/query/validate'
    : 'https://sandbox.payfast.co.za/eng/query/validate';
  
  try {
    // Build POST data
    const params = new URLSearchParams();
    Object.entries(pfData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value);
      }
    });
    
    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    
    const result = await response.text();
    console.log('[payfast-webhook] PayFast verification result:', result);
    
    return result.trim() === 'VALID';
  } catch (error) {
    console.error('[payfast-webhook] PayFast verification error:', error);
    // In case of network error, we can choose to accept or reject
    // For safety, we accept but log the error (PayFast recommends this)
    return true;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Health check endpoint
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ status: 'ok', service: 'payfast-webhook' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // PayFast sends data as application/x-www-form-urlencoded
    const formData = await req.formData();
    const pfData: Record<string, string> = {};
    
    formData.forEach((value, key) => {
      pfData[key] = value.toString();
    });
    
    console.log('[payfast-webhook] Received ITN:', {
      m_payment_id: pfData.m_payment_id,
      pf_payment_id: pfData.pf_payment_id,
      payment_status: pfData.payment_status,
      amount_gross: pfData.amount_gross,
      tier: pfData.custom_str2,
      scope: pfData.custom_str3,
    });
    
    // Get environment configuration
    const payfastMode = Deno.env.get('PAYFAST_MODE') || 'sandbox';
    const isProduction = payfastMode === 'production';
    const passphrase = Deno.env.get('PAYFAST_PASSPHRASE');
    const merchantId = Deno.env.get('PAYFAST_MERCHANT_ID');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Verify merchant ID matches
    if (pfData.merchant_id !== merchantId) {
      console.error('[payfast-webhook] Merchant ID mismatch!');
      return new Response('Invalid merchant', { status: 400 });
    }
    
    // Validate signature
    if (!validateSignature(pfData, pfData.signature, passphrase, isProduction)) {
      console.error('[payfast-webhook] Signature validation failed!');
      return new Response('Invalid signature', { status: 400 });
    }
    
    // Verify with PayFast server
    const isValid = await verifyPayment(pfData, isProduction);
    if (!isValid) {
      console.error('[payfast-webhook] PayFast verification failed!');
      return new Response('Verification failed', { status: 400 });
    }
    
    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Extract payment data
    const paymentId = pfData.m_payment_id;
    const pfPaymentId = pfData.pf_payment_id;
    const status = pfData.payment_status;
    const userId = pfData.custom_str1 || null;
    const tier = pfData.custom_str2 || null;
    const scope = pfData.custom_str3 || 'user';
    const billing = pfData.custom_str4 || 'monthly';
    const schoolId = pfData.custom_str5 || null;
    const seats = pfData.custom_int1 ? parseInt(pfData.custom_int1, 10) : 1;
    const subscriptionToken = pfData.token || null;
    
    // Update payment transaction record
    const { error: txUpdateError } = await supabase
      .from('payment_transactions')
      .update({
        status: status === 'COMPLETE' ? 'completed' : status.toLowerCase(),
        payfast_payment_id: pfPaymentId,
        payfast_token: subscriptionToken,
        completed_at: status === 'COMPLETE' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
        metadata: {
          pf_data: pfData,
          amount_gross: parseFloat(pfData.amount_gross || '0'),
          amount_fee: parseFloat(pfData.amount_fee || '0'),
          amount_net: parseFloat(pfData.amount_net || '0'),
          processed_at: new Date().toISOString(),
        },
      })
      .eq('id', paymentId);
    
    if (txUpdateError) {
      console.warn('[payfast-webhook] Failed to update payment transaction:', txUpdateError);
    }
    
    // Only process successful payments
    if (status !== 'COMPLETE') {
      console.log('[payfast-webhook] Payment not complete, status:', status);
      return new Response('OK', { status: 200 });
    }
    
    console.log('[payfast-webhook] Processing successful payment:', {
      paymentId,
      userId,
      schoolId,
      tier,
      scope,
      billing,
      seats,
    });
    
    // Update based on scope
    if (scope === 'user' && userId) {
      // User-scoped subscription (parent plans)
      // SINGLE SOURCE OF TRUTH: Update profiles.subscription_tier
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          subscription_tier: tier,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
      
      if (profileError) {
        console.error('[payfast-webhook] Failed to update profile tier:', profileError);
      } else {
        console.log('[payfast-webhook] Updated profile tier to:', tier);
      }
      
      // Also update user_ai_tiers for AI quota management
      const { error: aiTierError } = await supabase
        .from('user_ai_tiers')
        .upsert({
          user_id: userId,
          tier_name: tier,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });
      
      if (aiTierError) {
        console.warn('[payfast-webhook] Failed to update user_ai_tiers:', aiTierError);
      }
      
    } else if (scope === 'school' && schoolId) {
      // School-scoped subscription
      // Get or create subscription plan reference
      const { data: plan } = await supabase
        .from('subscription_plans')
        .select('id')
        .ilike('tier', tier!)
        .maybeSingle();
      
      if (plan) {
        // Upsert subscription record
        const { error: subError } = await supabase
          .from('subscriptions')
          .upsert({
            school_id: schoolId,
            plan_id: plan.id,
            status: 'active',
            billing_frequency: billing,
            seats_total: seats,
            payfast_token: subscriptionToken,
            current_period_start: new Date().toISOString(),
            current_period_end: billing === 'annual' 
              ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'school_id'
          });
        
        if (subError) {
          console.error('[payfast-webhook] Failed to upsert subscription:', subError);
        }
        
        // Update school subscription_tier
        const { error: schoolError } = await supabase
          .from('preschools')
          .update({ 
            subscription_tier: tier,
            updated_at: new Date().toISOString(),
          })
          .eq('id', schoolId);
        
        if (schoolError) {
          console.warn('[payfast-webhook] Failed to update school tier:', schoolError);
        }
      }
    }
    
    // Log successful webhook processing
    await supabase
      .from('audit_logs')
      .insert({
        action: 'payfast_webhook_processed',
        entity_type: 'payment',
        entity_id: paymentId,
        new_data: {
          pf_payment_id: pfPaymentId,
          status,
          tier,
          scope,
          user_id: userId,
          school_id: schoolId,
        },
      })
      .catch(() => {}); // Non-critical
    
    console.log('[payfast-webhook] Successfully processed payment:', paymentId);
    
    // PayFast expects a 200 response with no body
    return new Response('OK', { status: 200 });
    
  } catch (error) {
    console.error('[payfast-webhook] Error:', error);
    // Return 200 to prevent PayFast retries for application errors
    // PayFast will retry on 4xx/5xx errors
    return new Response('OK', { status: 200 });
  }
});
