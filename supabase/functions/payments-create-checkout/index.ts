// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function: payments-create-checkout
// Creates invoice + transaction and returns a PayFast redirect URL (stub)

// @ts-ignore - Deno URL imports work at runtime but TypeScript linter doesn't recognize them
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
// @ts-ignore - Deno URL imports work at runtime but TypeScript linter doesn't recognize them
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// @ts-ignore - Deno is available at runtime in Edge Functions
// TypeScript doesn't recognize Deno global, but it exists in Deno runtime
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

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

type PromoUserType = 'parent' | 'teacher' | 'principal' | 'all';

function mapRoleToPromoUserType(role: string | null | undefined): PromoUserType {
  const r = String(role || '').toLowerCase();
  if (r === 'parent') return 'parent';
  // Learners/students use the consumer (parent) promo bucket.
  // Our DB promo schema doesn't include 'student' as a user_type, so treat them as 'parent'.
  if (r === 'student' || r.includes('student') || r.includes('learner')) return 'parent';
  if (r === 'teacher' || r === 'instructor') return 'teacher';
  if (r === 'principal' || r === 'principal_admin' || r === 'admin' || r === 'super_admin') return 'principal';
  return 'all';
}

function appendQueryParams(urlStr: string, params: Record<string, string>): string {
  try {
    const u = new URL(urlStr);
    for (const [k, v] of Object.entries(params)) {
      if (v) u.searchParams.set(k, v);
    }
    return u.toString();
  } catch {
    // Best-effort fallback (urlStr may already include query)
    const hasQuery = urlStr.includes('?');
    const q = new URLSearchParams(params).toString();
    if (!q) return urlStr;
    return urlStr + (hasQuery ? '&' : '?') + q;
  }
}

serve(async (req: Request) => {
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
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({ error: 'Server config missing' }), { 
        status: 500,
        headers: corsHeaders 
      });
    }

    const s = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    // Validate the bearer token and resolve the requester identity
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    const user = userData?.user;
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Load requester profile for scope validation + promo user_type
    const { data: requesterProfile, error: profileErr } = await s
      .from('profiles')
      .select('id, role, organization_id, preschool_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileErr || !requesterProfile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    // Enforce scope ownership / tenant isolation
    if (input.scope === 'user') {
      if (input.userId && input.userId !== user.id) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
      }
      input.userId = user.id;
    } else {
      const requestedSchoolId = input.schoolId || '';
      const profileSchoolId = (requesterProfile as any).organization_id || (requesterProfile as any).preschool_id || '';
      const role = String(requesterProfile.role || '').toLowerCase();
      const canManageSchool =
        role === 'admin' || role === 'principal' || role === 'principal_admin' || role === 'super_admin';

      if (!requestedSchoolId || !canManageSchool || (profileSchoolId && profileSchoolId !== requestedSchoolId)) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
      }

      // Ensure userId is always the initiating user (used for promos + auditing)
      input.userId = user.id;
    }

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
    
    // Apply promotional pricing (if eligible)
    // Promotions are time-bound "join window" + "promo duration" tracked in DB.
    // The DB function also returns persisted promo pricing for users who joined within the window.
    // NOTE: Annual billing does NOT get promo discount (already has 20% annual discount)
    const promoUserType = mapRoleToPromoUserType(requesterProfile.role);
    let finalPriceZAR = basePrice;
    let promoApplied = false;
    let promoOriginalPrice = basePrice;
    let promoPrice = basePrice;
    try {
      const { data: promoResult, error: promoErr } = await s.rpc('get_promotional_price', {
        p_user_id: user.id,
        p_tier: plan.tier,
        p_user_type: promoUserType,
        p_original_price: basePrice,
        p_billing_frequency: input.billing || 'monthly',
      });
      if (!promoErr) {
        // PostgREST can return DECIMAL as number or string depending on config.
        // Accept both, plus tolerate accidental object shapes.
        const resolvedPromo =
          typeof promoResult === 'number' ? promoResult
            : typeof promoResult === 'string' ? Number(promoResult)
            : promoResult && typeof promoResult === 'object' && 'promo_price' in (promoResult as any)
              ? Number((promoResult as any).promo_price)
              : null;

        if (resolvedPromo !== null && Number.isFinite(resolvedPromo)) {
          promoPrice = resolvedPromo;
          finalPriceZAR = resolvedPromo;
        }
        promoApplied = promoPrice < promoOriginalPrice;
      }
    } catch (e) {
      // Non-fatal: fallback to base price
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
      invoice_data: {
        plan_tier: plan.tier,
        billing: input.billing,
        seats: input.seats || 1,
        promo: {
          applied: promoApplied,
          user_type: promoUserType,
          original_price: promoOriginalPrice,
          promo_price: promoPrice,
        },
      },
    } as any);

    const { error: txErr } = await s.from('payment_transactions').insert({
      id: txId,
      school_id: input.schoolId || null,
      subscription_plan_id: String(plan.id),
      amount: amountZAR,
      currency: 'ZAR',
      status: 'pending',
      // For user-scoped purchases, store these explicitly so:
      // - the app can poll `payment_transactions` under RLS (user_id = auth.uid())
      // - the DB trigger can upgrade tiers when the tx is marked completed
      user_id: input.scope === 'user' ? (input.userId || user.id) : null,
      tier: input.scope === 'user' ? String(plan.tier) : null,
      provider: 'payfast',
      metadata: {
        scope: input.scope,
        billing: input.billing,
        seats: input.seats || 1,
        invoice_number: invoiceNumber,
        plan_tier: plan.tier,
        actor_user_id: user.id,
        promo: {
          applied: promoApplied,
          user_type: promoUserType,
          original_price: promoOriginalPrice,
          promo_price: promoPrice,
        },
      },
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

    // IMPORTANT:
    // Supabase Edge Functions require an Authorization header at the gateway, which PayFast ITN cannot send.
    // So we default notify/return/cancel to the public web domain, and the web will proxy ITN to Supabase.
    const publicBaseUrl = (Deno.env.get('BASE_URL') || 'https://www.edudashpro.org.za').replace(/\/$/, '');
    const notifyUrl = Deno.env.get('PAYFAST_NOTIFY_URL') || `${publicBaseUrl}/api/payfast/webhook`;
    const baseReturnUrl =
      input.return_url ||
      Deno.env.get('PAYFAST_RETURN_URL') ||
      `${publicBaseUrl}/landing?flow=payment-return`;
    const baseCancelUrl =
      input.cancel_url ||
      Deno.env.get('PAYFAST_CANCEL_URL') ||
      `${publicBaseUrl}/landing?flow=payment-cancel`;

    // Always append identifiers so the app can reliably poll and refresh state after PayFast redirects.
    const returnUrl = appendQueryParams(baseReturnUrl, {
      transaction_id: txId,
      invoice_number: invoiceNumber,
      scope: input.scope,
      plan_tier: plan.tier,
    });
    const cancelUrl = appendQueryParams(baseCancelUrl, {
      transaction_id: txId,
      invoice_number: invoiceNumber,
      scope: input.scope,
      plan_tier: plan.tier,
    });

    console.log('PayFast configuration:', { 
      mode, 
      merchantId: Deno.env.get('PAYFAST_MERCHANT_ID') ? '***SET***' : 'NOT SET',
      merchantKey: Deno.env.get('PAYFAST_MERCHANT_KEY') ? '***SET***' : 'NOT SET',
      passphrase: Deno.env.get('PAYFAST_PASSPHRASE') ? '***SET***' : 'NOT SET',
      notifyUrl, 
      returnUrl, 
      cancelUrl 
    });

    // PayFast parameters - using ITN-friendly configuration
    // merchant_key is included for signature but NOT sent in URL (PayFast will reject it)
    const params: Record<string,string> = {
      merchant_id: Deno.env.get('PAYFAST_MERCHANT_ID') || '',
      merchant_key: Deno.env.get('PAYFAST_MERCHANT_KEY') || '', // Only for signature, removed from URL later
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
      custom_str4: JSON.stringify({ billing: input.billing, seats: input.seats || 1, invoice_number: invoiceNumber, promo: { applied: promoApplied, original_price: promoOriginalPrice, promo_price: promoPrice } }),
      custom_str5: user.id,
    };

    // PayFast requires PHP-style urlencode for signature calculation
    // Key differences from standard encodeURIComponent:
    // 1. Spaces become '+' (not %20)
    // 2. Characters !'()* must be percent-encoded (PHP urlencode behavior)
    // 3. Percent-hex must be uppercase
    function encodeRFC1738(v: string) {
      // First apply standard encoding
      let encoded = encodeURIComponent(v);
      
      // Replace %20 with + (PHP urlencode for spaces)
      encoded = encoded.replace(/%20/g, '+');
      
      // Encode !'()* which encodeURIComponent doesn't encode but PHP urlencode does
      encoded = encoded.replace(/!/g, '%21');
      encoded = encoded.replace(/'/g, '%27');
      encoded = encoded.replace(/\(/g, '%28');
      encoded = encoded.replace(/\)/g, '%29');
      encoded = encoded.replace(/\*/g, '%2A');
      
      // Ensure all percent-encoding is uppercase (PayFast requirement)
      encoded = encoded.replace(/%[0-9a-f]{2}/gi, (match) => match.toUpperCase());
      
      return encoded;
    }

    // Generate signature
    const passphrase = (Deno.env.get('PAYFAST_PASSPHRASE') || '').trim();
    const isSandbox = mode === 'sandbox';
    
    try {
      // PayFast signature calculation:
      // 1. Sort keys alphabetically (required by PayFast)
      // 2. Build parameter string excluding 'signature' key
      // 3. Filter out empty/null/undefined values
      // 4. URL encode values (RFC1738: spaces as '+')
      // 5. Concatenate as key=value&key=value (with trailing &, then remove)
      // 6. Append &passphrase=xxx if passphrase is set (both sandbox and production)
      // 7. Calculate MD5 hash
      
      // Get sorted keys (alphabetical order)
      const sortedKeys = Object.keys(params).sort();
      
      // Build parameter string (matching payfast-create-payment logic exactly)
      let paramString = '';
      const includedKeys: string[] = [];
      
      for (const key of sortedKeys) {
        // Exclude 'signature' key from signature calculation
        if (key === 'signature') continue;
        
        // Filter out empty values (check BEFORE trimming, matching payfast-create-payment)
        if (params[key] === undefined || params[key] === null || params[key] === '') continue;
        
        const value = String(params[key]).trim();
        // Skip if trimmed value is empty (whitespace-only)
        if (value.length === 0) continue;
        
        const encodedValue = encodeRFC1738(value);
        paramString += `${key}=${encodedValue}&`;
        includedKeys.push(key);
      }
      
      // Remove trailing & (matching payfast-create-payment)
      paramString = paramString.slice(0, -1);
      
      // Append passphrase if it's set (required for both sandbox and production if passphrase is configured)
      if (passphrase.length > 0) {
        paramString += `&passphrase=${encodeRFC1738(passphrase)}`;
      }
      
      // Calculate MD5 hash using our custom MD5 implementation
      const signature = md5(paramString);
      
      // Validation: Log a test hash to verify MD5 correctness
      // Known test: md5("test") should be "098f6bcd4621d373cade4e832627b4f6"
      const testHash = md5("test");
      const expectedTestHash = "098f6bcd4621d373cade4e832627b4f6";
      if (testHash !== expectedTestHash) {
        console.error('MD5 implementation validation FAILED!', {
          testInput: 'test',
          expected: expectedTestHash,
          actual: testHash
        });
      }
      
      // Add signature to params (must be added AFTER building paramString to avoid including it in signature calculation)
      // NOTE: merchant_key is KEPT in params - PayFast requires it in the URL
      params.signature = signature;
      
      console.log('PayFast signature generated (ITN mode)', { 
        mode, 
        isSandbox,
        hasPassphrase: passphrase.length > 0,
        passphraseUsed: passphrase.length > 0,
        merchantKeyInURL: true,
        md5ValidationPassed: testHash === expectedTestHash,
        includedKeys,
        paramCount: includedKeys.length,
        paramStringLength: paramString.length,
        signature: signature,
        signatureBase: paramString.substring(0, 200) + '...' // Truncate for readability
      });
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

    // Build URL query string using the EXACT SAME logic as signature calculation
    // CRITICAL: PayFast signature validation requires parameter order, filtering, and encoding to match EXACTLY
    const urlSortedKeys = Object.keys(params).sort();
    const urlQueryParts: string[] = [];
    
    for (const key of urlSortedKeys) {
      // Use the SAME filtering logic as signature calculation
      // (signature was already added above, so include it in URL)
      if (params[key] === undefined || params[key] === null || params[key] === '') continue;
      
      const value = String(params[key]).trim();
      // Skip if trimmed value is empty (same as signature calculation)
      if (value.length === 0) continue;
      
      // Use the SAME encoding as signature calculation
      const encodedValue = encodeRFC1738(value);
      urlQueryParts.push(`${key}=${encodedValue}`);
    }
    
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
    const errorMessage = e instanceof Error ? e.message : 'Failed to create checkout';
    return new Response(JSON.stringify({ error: errorMessage }), { 
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
