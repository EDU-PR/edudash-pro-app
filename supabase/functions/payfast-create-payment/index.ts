// Supabase Edge Function: payfast-create-payment
// Secure server-side PayFast payment creation with signature generation
// deno-lint-ignore-file no-explicit-any

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { createHash } from "https://deno.land/std@0.208.0/node/crypto.ts";

// PayFast configuration from environment
const PAYFAST_MODE = Deno.env.get('PAYFAST_MODE') || 'sandbox';
const PAYFAST_MERCHANT_ID = Deno.env.get('PAYFAST_MERCHANT_ID') || '';
const PAYFAST_MERCHANT_KEY=REDACTED
const PAYFAST_PASSPHRASE=REDACTED
const BASE_URL = Deno.env.get('BASE_URL') || 'https://edudashpro.org.za';

// PayFast URLs
const PAYFAST_URLS = {
  sandbox: 'https://sandbox.payfast.co.za/eng/process',
  production: 'https://www.payfast.co.za/eng/process',
};

interface PaymentRequest {
  user_id: string;
  tier: string;
  amount: number;
  email: string;
  firstName?: string;
  lastName?: string;
  itemName?: string;
  itemDescription?: string;
  subscriptionType?: string;
  frequency?: string;
  cycles?: string;
  billingDate?: string;
}

/**
 * Generate MD5 signature for PayFast
 * CRITICAL: PayFast sandbox does NOT use passphrase - only production does
 */
function generateSignature(data: Record<string, string>, isSandbox: boolean): string {
  // Sort keys alphabetically (required by PayFast)
  const sortedKeys = Object.keys(data).sort();
  
  let paramString = '';
  for (const key of sortedKeys) {
    if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
      const value = String(data[key]).trim();
      const encodedValue = encodeURIComponent(value).replace(/%20/g, '+');
      paramString += `${key}=${encodedValue}&`;
    }
  }
  
  // Remove trailing &
  paramString = paramString.slice(0, -1);
  
  // CRITICAL: Only add passphrase for production mode
  if (!isSandbox && PAYFAST_PASSPHRASE && PAYFAST_PASSPHRASE.trim() !== '') {
    paramString += `&passphrase=${encodeURIComponent(PAYFAST_PASSPHRASE.trim()).replace(/%20/g, '+')}`;
  }
  
  // Generate MD5 hash using Deno's node-compatible crypto
  const md5 = createHash('md5');
  md5.update(paramString);
  const signature = md5.digest('hex');
  
  console.log('[PayFast Edge] Signature generated:', {
    mode: isSandbox ? 'sandbox' : 'production',
    hasPassphrase: !isSandbox && !!PAYFAST_PASSPHRASE,
    paramStringLength: paramString.length,
    signature,
  });
  
  return signature;
}

serve(async (req) => {
  // Handle CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }), 
        { status: 401, headers: corsHeaders }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }), 
        { status: 401, headers: corsHeaders }
      );
    }

    // Parse request body
    const body: PaymentRequest = await req.json();
    const { 
      user_id, 
      tier, 
      amount, 
      email,
      firstName,
      lastName,
      itemName,
      itemDescription,
      subscriptionType = '1',
      frequency = '3',
      cycles = '0',
      billingDate,
    } = body;

    // Validate required fields
    if (!user_id || !tier || !amount || !email) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }), 
        { status: 400, headers: corsHeaders }
      );
    }

    // Verify user_id matches authenticated user
    if (user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'User ID mismatch' }), 
        { status: 403, headers: corsHeaders }
      );
    }

    // Validate merchant credentials
    if (!PAYFAST_MERCHANT_ID || !PAYFAST_MERCHANT_KEY) {
      console.error('[PayFast Edge] Missing merchant credentials');
      return new Response(
        JSON.stringify({ error: 'Payment system not configured' }), 
        { status: 500, headers: corsHeaders }
      );
    }

    const isSandbox = PAYFAST_MODE === 'sandbox';
    const payFastUrl = isSandbox ? PAYFAST_URLS.sandbox : PAYFAST_URLS.production;

    // Create unique payment reference
    const paymentId = `SUB_${tier.toUpperCase()}_${user_id.slice(0, 8)}_${Date.now()}`;

    // Prepare PayFast data
    const payFastData: Record<string, string> = {
      merchant_id: PAYFAST_MERCHANT_ID,
      merchant_key: PAYFAST_MERCHANT_KEY,
      return_url: `${BASE_URL}/dashboard/parent/subscription?payment=success`,
      cancel_url: `${BASE_URL}/dashboard/parent/subscription?payment=cancelled`,
      notify_url: `${BASE_URL}/api/payfast/webhook`,
      name_first: firstName || email.split('@')[0],
      name_last: lastName || 'User',
      email_address: email,
      m_payment_id: paymentId,
      amount: amount.toFixed(2),
      item_name: itemName || `EduDash Pro ${tier} Subscription`,
      item_description: itemDescription || `Monthly subscription to EduDash Pro ${tier} plan`,
      custom_str1: user_id,
      custom_str2: tier,
      custom_str3: 'monthly_subscription',
    };

    // Add subscription details
    if (subscriptionType) {
      payFastData.subscription_type = subscriptionType;
      payFastData.recurring_amount = amount.toFixed(2);
      payFastData.frequency = frequency;
      payFastData.cycles = cycles;
      
      if (billingDate) {
        payFastData.billing_date = billingDate;
      }
    }

    // Generate signature
    const signature = await generateSignature(payFastData, isSandbox);

    // Build payment URL
    const params = new URLSearchParams({ ...payFastData, signature });
    const paymentUrl = `${payFastUrl}?${params.toString()}`;

    console.log('[PayFast Edge] Payment created:', {
      paymentId,
      tier,
      amount,
      mode: isSandbox ? 'sandbox' : 'production',
      merchantId: PAYFAST_MERCHANT_ID,
      userId: user_id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        payment_url: paymentUrl,
        payment_id: paymentId,
        mode: isSandbox ? 'sandbox' : 'production',
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('[PayFast Edge] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to create payment',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
