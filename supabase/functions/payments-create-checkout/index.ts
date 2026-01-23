/**
 * PayFast Checkout Creation Edge Function
 * 
 * Creates PayFast payment URLs for subscription upgrades.
 * Supports both sandbox and production modes based on PAYFAST_MODE secret.
 * 
 * IMPORTANT: Production mode REQUIRES passphrase for signature generation.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHash } from 'node:crypto';

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckoutInput {
  scope: 'school' | 'user';
  schoolId?: string;
  userId?: string;
  planTier: string;
  billing: 'monthly' | 'annual';
  seats?: number;
  return_url?: string;
  cancel_url?: string;
  email_address?: string;
}

interface PayFastPaymentData {
  merchant_id: string;
  merchant_key: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;
  name_first?: string;
  name_last?: string;
  email_address?: string;
  m_payment_id: string;
  amount: string;
  item_name: string;
  item_description?: string;
  custom_str1?: string; // user_id
  custom_str2?: string; // tier
  custom_str3?: string; // scope
  custom_str4?: string; // billing
  custom_str5?: string; // school_id
  custom_int1?: number; // seats
  // Subscription fields
  subscription_type?: string;
  billing_date?: string;
  recurring_amount?: string;
  frequency?: string;
  cycles?: string;
}

/**
 * Generate MD5 signature for PayFast payment
 * CRITICAL: Sandbox does NOT use passphrase, Production REQUIRES it
 */
function generatePayFastSignature(
  data: Record<string, string | number | undefined>,
  passphrase: string | undefined,
  isProduction: boolean
): string {
  // Build param string - must be alphabetically sorted
  const sortedKeys = Object.keys(data).sort();
  let paramString = '';
  
  for (const key of sortedKeys) {
    const value = data[key];
    if (value !== undefined && value !== null && value !== '' && key !== 'signature') {
      const encodedValue = encodeURIComponent(String(value).trim()).replace(/%20/g, '+');
      paramString += `${key}=${encodedValue}&`;
    }
  }
  
  // Remove trailing &
  paramString = paramString.slice(0, -1);
  
  // CRITICAL: Only add passphrase for production mode
  if (isProduction && passphrase && passphrase.trim() !== '') {
    paramString += `&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`;
  }
  
  // Generate MD5 hash
  return createHash('md5').update(paramString).digest('hex');
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const input: CheckoutInput = await req.json();
    
    console.log('[payments-create-checkout] Received input:', {
      scope: input.scope,
      planTier: input.planTier,
      billing: input.billing,
      hasSchoolId: !!input.schoolId,
      hasUserId: !!input.userId,
    });
    
    // Get environment configuration
    const payfastMode = Deno.env.get('PAYFAST_MODE') || 'sandbox';
    const isProduction = payfastMode === 'production';
    const merchantId = Deno.env.get('PAYFAST_MERCHANT_ID');
    const merchantKey = Deno.env.get('PAYFAST_MERCHANT_KEY');
    const passphrase = Deno.env.get('PAYFAST_PASSPHRASE');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const webBaseUrl = Deno.env.get('WEB_BASE_URL') || 'https://www.edudashpro.org.za';
    
    if (!merchantId || !merchantKey) {
      throw new Error('PayFast credentials not configured');
    }
    
    // Production requires passphrase
    if (isProduction && !passphrase) {
      throw new Error('PayFast passphrase required for production mode');
    }
    
    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get subscription plan from database
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .ilike('tier', input.planTier)
      .eq('is_active', true)
      .maybeSingle();
    
    if (planError || !plan) {
      console.error('[payments-create-checkout] Plan not found:', planError);
      throw new Error(`Subscription plan not found: ${input.planTier}`);
    }
    
    // Check for enterprise tier
    if (plan.tier.toLowerCase() === 'enterprise') {
      return new Response(
        JSON.stringify({ error: 'contact_sales_required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    // Calculate price
    const isAnnual = input.billing === 'annual';
    let price = isAnnual ? plan.price_annual : plan.price_monthly;
    
    // Apply launch promo (50% off monthly until Mar 31, 2026)
    const promoEndDate = new Date('2026-03-31T23:59:59.999Z');
    const isPromoActive = new Date() <= promoEndDate;
    if (isPromoActive && !isAnnual) {
      price = Math.round(price * 0.5 * 100) / 100; // 50% off, round to 2 decimals
    }
    
    if (!price || price <= 0) {
      throw new Error('Invalid price for plan');
    }
    
    // Generate unique payment ID
    const paymentId = `edp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Determine return and cancel URLs
    const returnUrl = input.return_url || `${webBaseUrl}/subscription/success?payment_id=${paymentId}`;
    const cancelUrl = input.cancel_url || `${webBaseUrl}/subscription/cancel?payment_id=${paymentId}`;
    const notifyUrl = `${supabaseUrl}/functions/v1/payfast-webhook`;
    
    // Build PayFast payment data
    const paymentData: PayFastPaymentData = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: returnUrl,
      cancel_url: cancelUrl,
      notify_url: notifyUrl,
      email_address: input.email_address,
      m_payment_id: paymentId,
      amount: price.toFixed(2),
      item_name: `EduDash Pro ${plan.name} (${isAnnual ? 'Annual' : 'Monthly'})`,
      item_description: `${plan.name} subscription - ${input.seats || plan.max_teachers || 1} seats`,
      custom_str1: input.userId || '',
      custom_str2: plan.tier,
      custom_str3: input.scope,
      custom_str4: input.billing,
      custom_str5: input.schoolId || '',
      custom_int1: input.seats || plan.max_teachers || 1,
    };
    
    // Add subscription (recurring) fields for non-annual payments
    if (!isAnnual) {
      paymentData.subscription_type = '1'; // Subscription
      paymentData.recurring_amount = price.toFixed(2);
      paymentData.frequency = '3'; // Monthly
      paymentData.cycles = '0'; // Until cancelled
    }
    
    // Generate signature
    const signature = generatePayFastSignature(
      paymentData as unknown as Record<string, string | number | undefined>,
      passphrase,
      isProduction
    );
    
    // Build payment URL
    const baseUrl = isProduction 
      ? 'https://www.payfast.co.za/eng/process'
      : 'https://sandbox.payfast.co.za/eng/process';
    
    const params = new URLSearchParams();
    Object.entries(paymentData).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    params.append('signature', signature);
    
    const redirectUrl = `${baseUrl}?${params.toString()}`;
    
    // Create pending payment record
    const { error: txError } = await supabase
      .from('payment_transactions')
      .insert({
        id: paymentId,
        status: 'pending',
        provider: 'payfast',
        amount: price,
        currency: 'ZAR',
        user_id: input.userId || null,
        school_id: input.schoolId || null,
        tier: plan.tier,
        billing_cycle: input.billing,
        subscription_plan_id: plan.id,
        metadata: {
          mode: payfastMode,
          plan_name: plan.name,
          promo_applied: isPromoActive && !isAnnual,
          seats: input.seats || plan.max_teachers || 1,
        },
      });
    
    if (txError) {
      console.warn('[payments-create-checkout] Failed to create payment record:', txError);
      // Don't fail - payment can still proceed
    }
    
    console.log('[payments-create-checkout] Created checkout:', {
      paymentId,
      mode: payfastMode,
      planTier: plan.tier,
      price,
      isAnnual,
      promoApplied: isPromoActive && !isAnnual,
    });
    
    return new Response(
      JSON.stringify({ 
        redirect_url: redirectUrl,
        payment_id: paymentId,
        mode: payfastMode,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('[payments-create-checkout] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
