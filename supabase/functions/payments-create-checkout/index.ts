// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function: payments-create-checkout
// Creates invoice + transaction and returns a PayFast redirect URL (stub)

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

// MD5 hash function - Web Crypto API doesn't support MD5, so we use a JS implementation
function md5(text: string): string {
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Content-Type': 'application/json',
    };

    // Validate authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), { 
        status: 401,
        headers: corsHeaders 
      });
    }
    
    const input = (await req.json()) as CheckoutInput;
    
    // Reject enterprise tier - must go through sales
    if (input.planTier.toLowerCase() === 'enterprise') {
      return new Response(JSON.stringify({ error: 'contact_sales_required' }), { 
        status: 400,
        headers: corsHeaders 
      });
    }

    // Resolve plan price from public.subscription_plans
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY=REDACTED
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: 'Server config missing' }), { 
        status: 500,
        headers: corsHeaders 
      });
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const s = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: plan } = await s
      .from('subscription_plans')
      .select('id, tier, name, price_monthly, price_annual')
      .eq('tier', input.planTier)
      .eq('is_active', true)
      .maybeSingle();

    if (!plan) {
      return new Response(JSON.stringify({ error: 'Plan not found' }), { 
        status: 400,
        headers: corsHeaders 
      });
    }

    // Get base price from plan (stored in cents or as decimal)
    const basePriceCents = (input.billing === 'annual' ? (plan.price_annual || 0) : (plan.price_monthly || 0));
    
    // Check if price is stored as cents (> 100) or as decimal (<= 100)
    const basePrice = basePriceCents > 100 ? basePriceCents / 100 : basePriceCents;
    
    // Apply promotional pricing if user is eligible (for parent plans)
    let finalPriceZAR = basePrice;
    if (input.scope === 'user' && input.userId) {
      try {
        // Check for promotional pricing using database function
        const { data: promoPriceData, error: promoError } = await s.rpc('get_promotional_price', {
          p_user_id: input.userId,
          p_tier: input.planTier,
          p_user_type: 'parent', // Assume parent for user-scoped subscriptions
          p_original_price: basePrice
        });
        
        if (!promoError && promoPriceData !== null && promoPriceData !== undefined) {
          const promoPrice = parseFloat(String(promoPriceData));
          if (!isNaN(promoPrice) && promoPrice > 0 && promoPrice < basePrice) {
            finalPriceZAR = promoPrice;
            console.log('Applied promotional pricing', {
              tier: input.planTier,
              originalPrice: basePrice,
              promoPrice: finalPriceZAR
            });
          }
        }
      } catch (promoErr: any) {
        // If promotional pricing fails, use base price (non-critical)
        console.warn('Could not apply promotional pricing, using base price:', promoErr?.message);
      }
    }
    
    // Convert to cents for PayFast (amount must be in ZAR as decimal string)
    const amountZAR = finalPriceZAR;
    
    console.log('Price calculation:', {
      planTier: input.planTier,
      billing: input.billing,
      basePriceCents,
      basePrice,
      finalPriceZAR: amountZAR,
      scope: input.scope
    });

    // Resolve email address for PayFast (required field)
    let emailAddress = input.email_address || '';
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    // If no valid email provided, try to fetch from user record
    if (!emailAddress || !emailRegex.test(emailAddress)) {
      if (input.scope === 'user' && input.userId) {
        try {
          const { data: userData } = await s.auth.admin.getUserById(input.userId);
          if (userData?.user?.email && emailRegex.test(userData.user.email)) {
            emailAddress = userData.user.email;
          }
        } catch (e) {
          console.warn('Failed to fetch user email:', e);
        }
      }
    }
    
    // Fallback to test email (only in sandbox mode)
    if (!emailAddress || !emailRegex.test(emailAddress)) {
      const mode = Deno.env.get('PAYFAST_MODE') || 'sandbox';
      const testEmail = Deno.env.get('PAYFAST_TEST_EMAIL');
      if (mode === 'sandbox' && testEmail && emailRegex.test(testEmail)) {
        emailAddress = testEmail;
      } else {
        // Last resort: use a valid test email format
        emailAddress = 'test@edudashpro.org.za';
      }
    }

    // Insert a payment_transactions row (pending)
    const txId = crypto.randomUUID();
    // Try to get current school subscription id for invoice (if exists)
    let subscriptionId: string | null = null;
    if (input.scope === 'school' && input.schoolId) {
      const { data: sub } = await s
        .from('subscriptions')
        .select('id')
        .eq('owner_type', 'school')
        .eq('school_id', input.schoolId)
        .maybeSingle();
      subscriptionId = sub?.id ?? null;
    }

    // Create invoice
    const invoiceId = crypto.randomUUID();
    const invoiceNumber = `INV-${txId.substring(0, 8)}`;
    await s.from('billing_invoices').insert({
      id: invoiceId,
      school_id: input.schoolId || null,
      subscription_id: subscriptionId,
      invoice_number: invoiceNumber,
      amount: amountZAR,
      currency: 'ZAR',
      status: 'pending',
      due_date: new Date().toISOString(),
      invoice_data: { plan_tier: plan.tier, billing: input.billing, seats: input.seats || 1 },
    } as any);

    const { error: txErr } = await s.from('payment_transactions').insert({
      id: txId,
      school_id: input.schoolId || null,
      subscription_plan_id: String(plan.id),
      amount: amountZAR,
      currency: 'ZAR',
      status: 'pending',
      metadata: { scope: input.scope, billing: input.billing, seats: input.seats || 1, invoice_number: invoiceNumber },
    } as any);
    if (txErr) {
      return new Response(JSON.stringify({ error: txErr.message }), { 
        status: 400,
        headers: corsHeaders 
      });
    }

    // Build PayFast redirect URL (GET). For production, prefer POSTing a form.
    const mode = (Deno.env.get('PAYFAST_MODE') || 'sandbox').toLowerCase();
    const base = mode === 'live' ? 'https://www.payfast.co.za/eng/process' : 'https://sandbox.payfast.co.za/eng/process';

    // Construct webhook URLs - ensure they use the correct Supabase URL
    const webhookBaseUrl = SUPABASE_URL.replace(/\/$/, ''); // Remove trailing slash if present
    const notifyUrl = Deno.env.get('PAYFAST_NOTIFY_URL') || `${webhookBaseUrl}/functions/v1/payfast-webhook`;
    const returnUrl = input.return_url || Deno.env.get('PAYFAST_RETURN_URL') || `${webhookBaseUrl}/functions/v1/payments-webhook`;
    const cancelUrl = input.cancel_url || Deno.env.get('PAYFAST_CANCEL_URL') || `${webhookBaseUrl}/functions/v1/payments-webhook`;

    console.log('PayFast configuration:', { 
      mode, 
      merchantId: Deno.env.get('PAYFAST_MERCHANT_ID') ? '***SET***' : 'NOT SET',
      merchantKey: Deno.env.get('PAYFAST_MERCHANT_KEY') ? '***SET***' : 'NOT SET',
      passphrase: Deno.env.get('PAYFAST_PASSPHRASE') ? '***SET***' : 'NOT SET',
      notifyUrl, 
      returnUrl, 
      cancelUrl 
    });

    const params: Record<string,string> = {
      merchant_id: Deno.env.get('PAYFAST_MERCHANT_ID') || '',
      merchant_key: Deno.env.get('PAYFAST_MERCHANT_KEY') || '',
      return_url: returnUrl,
      cancel_url: cancelUrl,
      notify_url: notifyUrl,
      m_payment_id: txId,
      amount: amountZAR.toFixed(2),
      item_name: `EduDash Pro - ${plan.name} (${input.billing})`,
      email_confirmation: '1',
      email_address: emailAddress,
      custom_str1: input.planTier,
      custom_str2: input.scope,
      custom_str3: input.schoolId || input.userId || '',
      custom_str4: JSON.stringify({ billing: input.billing, seats: input.seats || 1 }),
    };

    // When a PayFast passphrase is configured, we must sign the request parameters
    // Per PayFast docs: concatenate non-blank vars, URL-encode (spaces as '+'), append passphrase, then MD5
    // Use same encoding as payfast-create-payment function for consistency
    function encodeRFC1738(v: string) {
      return encodeURIComponent(v).replace(/%20/g, '+');
    }

    // Generate signature if passphrase is configured (required for production, optional for sandbox)
    const passphrase = (Deno.env.get('PAYFAST_PASSPHRASE') || '').trim();
    if (passphrase) {
      try {
        // Sort params by key and filter out empty values (PayFast requirement)
        const sortedEntries = Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== null && String(v).length > 0)
          .sort(([a], [b]) => a.localeCompare(b));
        
        // Build query string in sorted order with RFC1738 encoding
        const orderedQs = sortedEntries
          .map(([k, v]) => `${k}=${encodeRFC1738(String(v))}`)
          .join('&');
        
        // Append passphrase (PayFast requirement)
        const signatureBase = `${orderedQs}&passphrase=${encodeRFC1738(passphrase)}`;
        
        // Calculate MD5 hash using our custom MD5 implementation
        const signature = md5(signatureBase);
        
        // Add signature to params (must be added AFTER building orderedQs to avoid including it in signature calculation)
        params.signature = signature;
        
        console.log('PayFast signature generated successfully', { mode, hasPassphrase: true });
      } catch (sigError: any) {
        console.error('Failed to generate PayFast signature:', sigError);
        return new Response(JSON.stringify({ 
          error: 'Failed to generate payment signature',
          details: sigError?.message 
        }), { 
          status: 500,
          headers: corsHeaders 
        });
      }
    } else {
      // CRITICAL: If PayFast merchant account has passphrase enabled, signature is REQUIRED
      // The error "Signature is required" from PayFast means the account has passphrase protection
      console.error('PAYFAST_PASSPHRASE not set or empty - PayFast requires signature when passphrase is enabled in merchant account');
      console.error('Please set PAYFAST_PASSPHRASE secret in Supabase Edge Functions secrets');
      // Continue anyway - PayFast will reject with "Signature is required" error
      // This helps identify the issue clearly
    }

    // Build URL query string manually using the same encoding as signature calculation
    // This ensures PayFast receives exactly what we signed
    const urlQueryParts: string[] = [];
    Object.entries(params).forEach(([k, v]) => {
      const encodedValue = encodeRFC1738(String(v));
      urlQueryParts.push(`${k}=${encodedValue}`);
    });
    const redirect_url = `${base}?${urlQueryParts.join('&')}`;
    
    console.log('PayFast redirect URL generated', { 
      base, 
      paramCount: Object.keys(params).length,
      hasSignature: !!params.signature 
    });

    return new Response(JSON.stringify({ redirect_url }), { 
      status: 200, 
      headers: corsHeaders 
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || 'Failed to create checkout' }), { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Content-Type': 'application/json',
      }
    });
  }
});
