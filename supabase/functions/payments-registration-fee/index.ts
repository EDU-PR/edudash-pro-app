// Edge Function: Create PayFast checkout for registration fees with promotional pricing
// Handles aftercare registration payments (R400 → R200 with 50% promo)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// MD5 hash function - Web Crypto API doesn't support MD5, so we use a JS implementation
// Copied from payments-create-checkout for consistency
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
  
  const x = convertToWordArray(text);
  let a = 0x67452301;
  let b = 0xEFCDAB89;
  let c = 0x98BADCFE;
  let d = 0x10325476;
  
  for (let k = 0; k < x.length; k += 16) {
    const AA = a;
    const BB = b;
    const CC = c;
    const DD = d;
    
    a = ff(a, b, c, d, x[k + 0], 7, 0xD76AA478);
    d = ff(d, a, b, c, x[k + 1], 12, 0xE8C7B756);
    c = ff(c, d, a, b, x[k + 2], 17, 0x242070DB);
    b = ff(b, c, d, a, x[k + 3], 22, 0xC1BDCEEE);
    a = ff(a, b, c, d, x[k + 4], 7, 0xF57C0FAF);
    d = ff(d, a, b, c, x[k + 5], 12, 0x4787C62A);
    c = ff(c, d, a, b, x[k + 6], 17, 0xA8304613);
    b = ff(b, c, d, a, x[k + 7], 22, 0xFD469501);
    a = ff(a, b, c, d, x[k + 8], 7, 0x698098D8);
    d = ff(d, a, b, c, x[k + 9], 12, 0x8B44F7AF);
    c = ff(c, d, a, b, x[k + 10], 17, 0xFFFF5BB1);
    b = ff(b, c, d, a, x[k + 11], 22, 0x895CD7BE);
    a = ff(a, b, c, d, x[k + 12], 7, 0x6B901122);
    d = ff(d, a, b, c, x[k + 13], 12, 0xFD987193);
    c = ff(c, d, a, b, x[k + 14], 17, 0xA679438E);
    b = ff(b, c, d, a, x[k + 15], 22, 0x49B40821);
    
    a = gg(a, b, c, d, x[k + 1], 5, 0xF61E2562);
    d = gg(d, a, b, c, x[k + 6], 9, 0xC040B340);
    c = gg(c, d, a, b, x[k + 11], 14, 0x265E5A51);
    b = gg(b, c, d, a, x[k + 0], 20, 0xE9B6C7AA);
    a = gg(a, b, c, d, x[k + 5], 5, 0xD62F105D);
    d = gg(d, a, b, c, x[k + 10], 9, 0x2441453);
    c = gg(c, d, a, b, x[k + 15], 14, 0xD8A1E681);
    b = gg(b, c, d, a, x[k + 4], 20, 0xE7D3FBC8);
    a = gg(a, b, c, d, x[k + 9], 5, 0x21E1CDE6);
    d = gg(d, a, b, c, x[k + 14], 9, 0xC33707D6);
    c = gg(c, d, a, b, x[k + 3], 14, 0xF4D50D87);
    b = gg(b, c, d, a, x[k + 8], 20, 0x455A14ED);
    a = gg(a, b, c, d, x[k + 13], 5, 0xA9E3E905);
    d = gg(d, a, b, c, x[k + 2], 9, 0xFCEFA3F8);
    c = gg(c, d, a, b, x[k + 7], 14, 0x676F02D9);
    b = gg(b, c, d, a, x[k + 12], 20, 0x8D2A4C8A);
    
    a = hh(a, b, c, d, x[k + 5], 4, 0xFFFA3942);
    d = hh(d, a, b, c, x[k + 8], 11, 0x8771F681);
    c = hh(c, d, a, b, x[k + 11], 16, 0x6D9D6122);
    b = hh(b, c, d, a, x[k + 14], 23, 0xFDE5380C);
    a = hh(a, b, c, d, x[k + 1], 4, 0xA4BEEA44);
    d = hh(d, a, b, c, x[k + 4], 11, 0x4BDECFA9);
    c = hh(c, d, a, b, x[k + 7], 16, 0xF6BB4B60);
    b = hh(b, c, d, a, x[k + 10], 23, 0xBEBFBC70);
    a = hh(a, b, c, d, x[k + 13], 4, 0x289B7EC6);
    d = hh(d, a, b, c, x[k + 0], 11, 0xEAA127FA);
    c = hh(c, d, a, b, x[k + 3], 16, 0xD4EF3085);
    b = hh(b, c, d, a, x[k + 6], 23, 0x4881D05);
    a = hh(a, b, c, d, x[k + 9], 4, 0xD9D4D039);
    d = hh(d, a, b, c, x[k + 12], 11, 0xE6DB99E5);
    c = hh(c, d, a, b, x[k + 15], 16, 0x1FA27CF8);
    b = hh(b, c, d, a, x[k + 2], 23, 0xC4AC5665);
    
    a = ii(a, b, c, d, x[k + 0], 6, 0xF4292244);
    d = ii(d, a, b, c, x[k + 7], 10, 0x432AFF97);
    c = ii(c, d, a, b, x[k + 14], 15, 0xAB9423A7);
    b = ii(b, c, d, a, x[k + 5], 21, 0xFC93A039);
    a = ii(a, b, c, d, x[k + 12], 6, 0x655B59C3);
    d = ii(d, a, b, c, x[k + 3], 10, 0x8F0CCC92);
    c = ii(c, d, a, b, x[k + 10], 15, 0xFFEFF47D);
    b = ii(b, c, d, a, x[k + 1], 21, 0x85845DD1);
    a = ii(a, b, c, d, x[k + 8], 6, 0x6FA87E4F);
    d = ii(d, a, b, c, x[k + 15], 10, 0xFE2CE6E0);
    c = ii(c, d, a, b, x[k + 6], 15, 0xA3014314);
    b = ii(b, c, d, a, x[k + 13], 21, 0x4E0811A1);
    a = ii(a, b, c, d, x[k + 4], 6, 0xF7537E82);
    d = ii(d, a, b, c, x[k + 11], 10, 0xBD3AF235);
    c = ii(c, d, a, b, x[k + 2], 15, 0x2AD7D2BB);
    b = ii(b, c, d, a, x[k + 9], 21, 0xEB86D391);
    
    a = addUnsigned(a, AA);
    b = addUnsigned(b, BB);
    c = addUnsigned(c, CC);
    d = addUnsigned(d, DD);
  }
  
  return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

// RFC1738 encoding for PayFast (spaces as +, not %20)
function encodeRFC1738(v: string): string {
  let encoded = encodeURIComponent(v);
  encoded = encoded.replace(/%20/g, '+');
  encoded = encoded.replace(/!/g, '%21');
  encoded = encoded.replace(/'/g, '%27');
  encoded = encoded.replace(/\(/g, '%28');
  encoded = encoded.replace(/\)/g, '%29');
  encoded = encoded.replace(/\*/g, '%2A');
  encoded = encoded.replace(/%[0-9a-f]{2}/gi, (match) => match.toUpperCase());
  return encoded;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RegistrationFeeCheckoutInput {
  registration_id: string;
  user_id: string;
  original_fee: number; // R400.00
  user_type?: 'parent' | 'teacher' | 'principal' | 'all';
  email_address?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const input = (await req.json()) as RegistrationFeeCheckoutInput;

    if (!input.registration_id || !input.user_id || !input.original_fee) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY=REDACTED
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const s = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    // Validate user
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user || userData.user.id !== input.user_id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user profile for user_type
    const { data: profile } = await s
      .from('profiles')
      .select('role')
      .eq('id', input.user_id)
      .maybeSingle();

    const userType = input.user_type || (profile?.role === 'parent' ? 'parent' : 'all');

    // Get promotional price for registration fee
    let finalFee = input.original_fee;
    let promoApplied = false;
    let campaignCode: string | null = null;
    let discountAmount = 0;

    try {
      const { data: promoPrice, error: promoErr } = await s.rpc('get_promotional_registration_fee', {
        p_user_id: input.user_id,
        p_original_fee: input.original_fee,
        p_user_type: userType,
      });

      if (!promoErr && promoPrice && promoPrice < input.original_fee) {
        finalFee = Number(promoPrice);
        discountAmount = input.original_fee - finalFee;
        promoApplied = true;

        // Get campaign code
        const { data: campaign } = await s
          .from('promotional_campaigns')
          .select('code')
          .eq('applies_to_registration', true)
          .eq('product_type', 'registration')
          .eq('is_active', true)
          .gte('end_date', new Date().toISOString())
          .lte('start_date', new Date().toISOString())
          .order('discount_value', { ascending: false })
          .limit(1)
          .maybeSingle();

        campaignCode = campaign?.code || null;
      }
    } catch (e) {
      console.warn('Promo check failed, using original fee:', e);
    }

    // Get email address
    let emailAddress = input.email_address || userData.user.email || '';
    if (!emailAddress) {
      emailAddress = 'test@edudashpro.org.za';
    }

    // Create payment transaction
    const txId = crypto.randomUUID();
    await s.from('payment_transactions').insert({
      id: txId,
      user_id: input.user_id,
      amount: finalFee,
      currency: 'ZAR',
      status: 'pending',
      tier: 'registration_fee', // Special tier for registration fees
      metadata: {
        registration_id: input.registration_id,
        original_fee: input.original_fee,
        discount_amount: discountAmount,
        campaign_applied: campaignCode,
        promo_applied: promoApplied,
      },
    } as any);

    // Update registration_requests with promo details (before payment)
    if (promoApplied && campaignCode) {
      await s.rpc('record_promotional_registration_payment', {
        p_user_id: input.user_id,
        p_registration_id: input.registration_id,
        p_original_fee: input.original_fee,
        p_user_type: userType,
      });
    } else {
      // Update registration with original fee if no promo
      await s
        .from('registration_requests')
        .update({
          registration_fee_amount: finalFee,
          discount_amount: discountAmount,
          campaign_applied: campaignCode,
        })
        .eq('id', input.registration_id);
    }

    // Create PayFast checkout
    const PAYFAST_MERCHANT_ID = Deno.env.get('PAYFAST_MERCHANT_ID')!;
    const PAYFAST_MERCHANT_KEY=REDACTED
    const PAYFAST_MODE = Deno.env.get('PAYFAST_MODE') || 'sandbox';
    const PAYFAST_RETURN_URL = Deno.env.get('PAYFAST_RETURN_URL') || 'https://www.edudashpro.org.za/landing?flow=payment-return';
    const PAYFAST_CANCEL_URL = Deno.env.get('PAYFAST_CANCEL_URL') || 'https://www.edudashpro.org.za/landing?flow=payment-cancel';
    const PAYFAST_NOTIFY_URL = Deno.env.get('PAYFAST_NOTIFY_URL') || 'https://www.edudashpro.org.za/api/payfast/webhook';

    const baseUrl = PAYFAST_MODE === 'production' 
      ? 'https://www.payfast.co.za/eng/process'
      : 'https://sandbox.payfast.co.za/eng/process';

    const data: Record<string, string> = {
      merchant_id: PAYFAST_MERCHANT_ID,
      merchant_key: PAYFAST_MERCHANT_KEY,
      return_url: PAYFAST_RETURN_URL,
      cancel_url: PAYFAST_CANCEL_URL,
      notify_url: PAYFAST_NOTIFY_URL,
      name_first: userData.user.user_metadata?.first_name || '',
      name_last: userData.user.user_metadata?.last_name || '',
      email_address: emailAddress,
      cell_number: '',
      amount: finalFee.toFixed(2),
      item_name: `Aftercare Registration 2026${promoApplied ? ' (50% Early Bird Discount)' : ''}`,
      custom_str1: txId,
      custom_str2: input.registration_id,
      custom_str3: 'registration_fee',
    };

    // Generate PayFast signature (matching payments-create-checkout logic)
    const passphrase = (Deno.env.get('PAYFAST_PASSPHRASE') || '').trim();
    
    // Build parameter string (sorted keys, exclude signature, filter empty values)
    const sortedKeys = Object.keys(data).filter(k => k !== 'signature' && data[k] !== '').sort();
    let paramString = '';
    
    for (const key of sortedKeys) {
      const value = String(data[key]).trim();
      if (value.length === 0) continue;
      // Use RFC1738 encoding (spaces as +, not %20)
      const encoded = encodeRFC1738(value);
      paramString += `${key}=${encoded}&`;
    }
    
    // Remove trailing & and append passphrase if set
    paramString = paramString.replace(/&$/, '');
    if (passphrase) {
      paramString += `&passphrase=${encodeRFC1738(passphrase)}`;
    }
    
    // Calculate MD5 signature
    const signature = md5(paramString);
    data.signature = signature;

    // Return checkout URL
    const checkoutUrl = `${baseUrl}?${new URLSearchParams(data).toString()}`;

    return new Response(
      JSON.stringify({
        checkout_url: checkoutUrl,
        transaction_id: txId,
        amount: finalFee,
        original_amount: input.original_fee,
        discount_amount: discountAmount,
        promo_applied: promoApplied,
        campaign_code: campaignCode,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Registration fee checkout error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

