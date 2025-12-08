// Supabase Edge Function: payfast-create-payment
// Secure server-side PayFast payment creation with signature generation

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// MD5 hash function using a proper MD5 implementation
// Web Crypto API doesn't support MD5, so we use a JS implementation
function md5(text: string): string {
  // Simple MD5 implementation for PayFast signature generation
  // This is a simplified version suitable for PayFast's requirements
  
  function rotateLeft(value: number, amount: number): number {
    const lbits = (value << amount) | (value >>> (32 - amount));
    return lbits;
  }
  
  function addUnsigned(x: number, y: number): number {
    const x4 = x & 0x40000000;
    const y4 = y & 0x40000000;
    const x8 = x & 0x80000000;
    const y8 = y & 0x80000000;
    const result = (x & 0x3fffffff) + (y & 0x3fffffff);
    
    if (x4 & y4) {
      return result ^ 0x80000000 ^ x8 ^ y8;
    }
    if (x4 | y4) {
      if (result & 0x40000000) {
        return result ^ 0xc0000000 ^ x8 ^ y8;
      } else {
        return result ^ 0x40000000 ^ x8 ^ y8;
      }
    } else {
      return result ^ x8 ^ y8;
    }
  }
  
  function f(x: number, y: number, z: number): number {
    return (x & y) | (~x & z);
  }
  
  function g(x: number, y: number, z: number): number {
    return (x & z) | (y & ~z);
  }
  
  function h(x: number, y: number, z: number): number {
    return x ^ y ^ z;
  }
  
  function i(x: number, y: number, z: number): number {
    return y ^ (x | ~z);
  }
  
  function ff(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(f(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(g(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(h(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(i(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  
  function convertToWordArray(string: string): number[] {
    const wordArray: number[] = [];
    const messageLength = string.length;
    const numberOfWords = (((messageLength + 8) - ((messageLength + 8) % 64)) / 64 + 1) * 16;
    
    for (let i = 0; i < numberOfWords; i++) {
      wordArray[i] = 0;
    }
    
    for (let i = 0; i < messageLength; i++) {
      const bytePosition = (i - (i % 4)) / 4;
      const byteOffset = (i % 4) * 8;
      wordArray[bytePosition] = wordArray[bytePosition] | (string.charCodeAt(i) << byteOffset);
    }
    
    const bytePosition = (messageLength - (messageLength % 4)) / 4;
    const byteOffset = (messageLength % 4) * 8;
    wordArray[bytePosition] = wordArray[bytePosition] | (0x80 << byteOffset);
    wordArray[numberOfWords - 2] = messageLength << 3;
    wordArray[numberOfWords - 1] = messageLength >>> 29;
    
    return wordArray;
  }
  
  function wordToHex(value: number): string {
    let wordToHexValue = '';
    let byte: number;
    
    for (let i = 0; i <= 3; i++) {
      byte = (value >>> (i * 8)) & 255;
      wordToHexValue = wordToHexValue + (byte < 16 ? '0' : '') + byte.toString(16);
    }
    return wordToHexValue;
  }
  
  // Convert string to UTF-8
  const utf8String = unescape(encodeURIComponent(text));
  const x = convertToWordArray(utf8String);
  
  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;
  
  for (let k = 0; k < x.length; k += 16) {
    const aa = a;
    const bb = b;
    const cc = c;
    const dd = d;
    
    a = ff(a, b, c, d, x[k], 7, 0xd76aa478);
    d = ff(d, a, b, c, x[k + 1], 12, 0xe8c7b756);
    c = ff(c, d, a, b, x[k + 2], 17, 0x242070db);
    b = ff(b, c, d, a, x[k + 3], 22, 0xc1bdceee);
    a = ff(a, b, c, d, x[k + 4], 7, 0xf57c0faf);
    d = ff(d, a, b, c, x[k + 5], 12, 0x4787c62a);
    c = ff(c, d, a, b, x[k + 6], 17, 0xa8304613);
    b = ff(b, c, d, a, x[k + 7], 22, 0xfd469501);
    a = ff(a, b, c, d, x[k + 8], 7, 0x698098d8);
    d = ff(d, a, b, c, x[k + 9], 12, 0x8b44f7af);
    c = ff(c, d, a, b, x[k + 10], 17, 0xffff5bb1);
    b = ff(b, c, d, a, x[k + 11], 22, 0x895cd7be);
    a = ff(a, b, c, d, x[k + 12], 7, 0x6b901122);
    d = ff(d, a, b, c, x[k + 13], 12, 0xfd987193);
    c = ff(c, d, a, b, x[k + 14], 17, 0xa679438e);
    b = ff(b, c, d, a, x[k + 15], 22, 0x49b40821);
    
    a = gg(a, b, c, d, x[k + 1], 5, 0xf61e2562);
    d = gg(d, a, b, c, x[k + 6], 9, 0xc040b340);
    c = gg(c, d, a, b, x[k + 11], 14, 0x265e5a51);
    b = gg(b, c, d, a, x[k], 20, 0xe9b6c7aa);
    a = gg(a, b, c, d, x[k + 5], 5, 0xd62f105d);
    d = gg(d, a, b, c, x[k + 10], 9, 0x2441453);
    c = gg(c, d, a, b, x[k + 15], 14, 0xd8a1e681);
    b = gg(b, c, d, a, x[k + 4], 20, 0xe7d3fbc8);
    a = gg(a, b, c, d, x[k + 9], 5, 0x21e1cde6);
    d = gg(d, a, b, c, x[k + 14], 9, 0xc33707d6);
    c = gg(c, d, a, b, x[k + 3], 14, 0xf4d50d87);
    b = gg(b, c, d, a, x[k + 8], 20, 0x455a14ed);
    a = gg(a, b, c, d, x[k + 13], 5, 0xa9e3e905);
    d = gg(d, a, b, c, x[k + 2], 9, 0xfcefa3f8);
    c = gg(c, d, a, b, x[k + 7], 14, 0x676f02d9);
    b = gg(b, c, d, a, x[k + 12], 20, 0x8d2a4c8a);
    
    a = hh(a, b, c, d, x[k + 5], 4, 0xfffa3942);
    d = hh(d, a, b, c, x[k + 8], 11, 0x8771f681);
    c = hh(c, d, a, b, x[k + 11], 16, 0x6d9d6122);
    b = hh(b, c, d, a, x[k + 14], 23, 0xfde5380c);
    a = hh(a, b, c, d, x[k + 1], 4, 0xa4beea44);
    d = hh(d, a, b, c, x[k + 4], 11, 0x4bdecfa9);
    c = hh(c, d, a, b, x[k + 7], 16, 0xf6bb4b60);
    b = hh(b, c, d, a, x[k + 10], 23, 0xbebfbc70);
    a = hh(a, b, c, d, x[k + 13], 4, 0x289b7ec6);
    d = hh(d, a, b, c, x[k], 11, 0xeaa127fa);
    c = hh(c, d, a, b, x[k + 3], 16, 0xd4ef3085);
    b = hh(b, c, d, a, x[k + 6], 23, 0x4881d05);
    a = hh(a, b, c, d, x[k + 9], 4, 0xd9d4d039);
    d = hh(d, a, b, c, x[k + 12], 11, 0xe6db99e5);
    c = hh(c, d, a, b, x[k + 15], 16, 0x1fa27cf8);
    b = hh(b, c, d, a, x[k + 2], 23, 0xc4ac5665);
    
    a = ii(a, b, c, d, x[k], 6, 0xf4292244);
    d = ii(d, a, b, c, x[k + 7], 10, 0x432aff97);
    c = ii(c, d, a, b, x[k + 14], 15, 0xab9423a7);
    b = ii(b, c, d, a, x[k + 5], 21, 0xfc93a039);
    a = ii(a, b, c, d, x[k + 12], 6, 0x655b59c3);
    d = ii(d, a, b, c, x[k + 3], 10, 0x8f0ccc92);
    c = ii(c, d, a, b, x[k + 10], 15, 0xffeff47d);
    b = ii(b, c, d, a, x[k + 1], 21, 0x85845dd1);
    a = ii(a, b, c, d, x[k + 8], 6, 0x6fa87e4f);
    d = ii(d, a, b, c, x[k + 15], 10, 0xfe2ce6e0);
    c = ii(c, d, a, b, x[k + 6], 15, 0xa3014314);
    b = ii(b, c, d, a, x[k + 13], 21, 0x4e0811a1);
    a = ii(a, b, c, d, x[k + 4], 6, 0xf7537e82);
    d = ii(d, a, b, c, x[k + 11], 10, 0xbd3af235);
    c = ii(c, d, a, b, x[k + 2], 15, 0x2ad7d2bb);
    b = ii(b, c, d, a, x[k + 9], 21, 0xeb86d391);
    
    a = addUnsigned(a, aa);
    b = addUnsigned(b, bb);
    c = addUnsigned(c, cc);
    d = addUnsigned(d, dd);
  }
  
  return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

// PayFast configuration from environment
const PAYFAST_MODE = Deno.env.get('PAYFAST_MODE') || 'sandbox';
const PAYFAST_MERCHANT_ID = Deno.env.get('PAYFAST_MERCHANT_ID') || '';
const PAYFAST_MERCHANT_KEY = Deno.env.get('PAYFAST_MERCHANT_KEY') || '';
const PAYFAST_PASSPHRASE = Deno.env.get('PAYFAST_PASSPHRASE') || '';
const BASE_URL = Deno.env.get('BASE_URL') || 'https://edudashpro.org.za';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';

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
  
  // Generate MD5 hash
  const signature = md5(paramString);
  
  console.log('[PayFast Edge] Signature generated:', {
    mode: isSandbox ? 'sandbox' : 'production',
    hasPassphrase: !isSandbox && !!PAYFAST_PASSPHRASE,
    paramStringLength: paramString.length,
    signature,
  });
  return signature;
}


serve(async (req: Request) => {
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
    console.log('[PayFast Edge] Headers received:', {
      hasAuth: !!authHeader,
      authPreview: authHeader?.substring(0, 20),
      allHeaders: Object.fromEntries(req.headers.entries())
    });
    
    if (!authHeader) {
      console.error('[PayFast Edge] No Authorization header');
      return new Response(
        JSON.stringify({ error: 'Authentication required' }), 
        { status: 401, headers: corsHeaders }
      );
    }

    // Extract bearer token explicitly to avoid header merge issues
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    console.log('[PayFast Edge] Auth header received:', {
      hasHeader: !!authHeader,
      headerPrefix: authHeader.slice(0, 10),
      tokenLength: token.length,
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('[PayFast Edge] User verification failed:', authError?.message);
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

    // No normalization - use database enum value (parent_plus, not parent-plus)
    console.log('[PayFast Create] Using tier:', tier);
    
    // Create unique payment reference
    const paymentId = `SUB_${tier.toUpperCase()}_${user_id.slice(0, 8)}_${Date.now()}`;

    // Prepare PayFast data
    const payFastData: Record<string, string> = {
      merchant_id: PAYFAST_MERCHANT_ID,
      merchant_key: PAYFAST_MERCHANT_KEY,
      return_url: `${BASE_URL}/dashboard/parent?payment=success`,
      cancel_url: `${BASE_URL}/dashboard/parent?payment=cancelled`,
      notify_url: `${SUPABASE_URL}/functions/v1/payfast-webhook`,
      name_first: firstName || email.split('@')[0],
      name_last: lastName || 'User',
      email_address: email,
      m_payment_id: paymentId,
      amount: amount.toFixed(2),
      item_name: itemName || `EduDash Pro ${tier} Subscription`,
      item_description: itemDescription || `Monthly subscription to EduDash Pro ${tier} plan`,
      custom_str1: tier, // Plan tier for webhook (database enum value: parent_plus)
      custom_str2: 'user', // Scope: 'user' or 'school'
      custom_str3: user_id, // Owner user ID
      custom_str4: JSON.stringify({ billing: 'monthly', seats: 1 }), // Additional data
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
    const signature = generateSignature(payFastData, isSandbox);

    // Add signature to data
    payFastData.signature = signature;

    // Create payment transaction record in database
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey!, {
      auth: { persistSession: false }
    });

    const { error: txError } = await supabaseAdmin
      .from('payment_transactions')
      .insert({
        id: paymentId,
        user_id: user_id,
        subscription_plan_id: tier, // Required: use tier as plan identifier
        amount: amount,
        currency: 'ZAR',
        status: 'pending',
        provider: 'payfast',
        provider_payment_id: null, // Will be updated by webhook
        tier: tier, // Use tier directly (database enum value like parent_plus)
        billing_cycle: 'monthly',
        metadata: {
          item_name: payFastData.item_name,
          item_description: payFastData.item_description,
          merchant_id: PAYFAST_MERCHANT_ID,
        },
      });

    if (txError) {
      console.error('[PayFast Edge] Failed to create transaction record:', txError);
      return new Response(
        JSON.stringify({ error: 'Failed to create payment record' }), 
        { status: 500, headers: corsHeaders }
      );
    }

    console.log('[PayFast Edge] Payment transaction created:', paymentId);

    console.log('[PayFast Edge] Data being sent to PayFast:', {
      amount: payFastData.amount,
      recurring_amount: payFastData.recurring_amount,
      merchant_id: payFastData.merchant_id,
      item_name: payFastData.item_name,
      signature: signature.substring(0, 10) + '...',
      allKeys: Object.keys(payFastData).sort(),
    });

    // Build payment URL with properly encoded parameters
    const params = new URLSearchParams();
    Object.keys(payFastData).sort().forEach(key => {
      if (payFastData[key] !== undefined && payFastData[key] !== null && payFastData[key] !== '') {
        params.append(key, payFastData[key]);
      }
    });
    
    const paymentUrl = `${payFastUrl}?${params.toString()}`;

    console.log('[PayFast Edge] Payment URL preview:', paymentUrl.substring(0, 150) + '...');

    console.log('[PayFast Edge] Payment created:', {
      paymentId,
      tier,
      amount,
      mode: isSandbox ? 'sandbox' : 'production',
      merchantId: PAYFAST_MERCHANT_ID,
      userId: user_id,
      signaturePreview: signature.substring(0, 10),
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
