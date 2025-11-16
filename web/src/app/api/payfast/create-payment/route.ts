import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Server-side only environment variables (NO NEXT_PUBLIC_ prefix)
const PAYFAST_MODE = process.env.PAYFAST_MODE || 'sandbox';
const PAYFAST_MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID || '';
const PAYFAST_MERCHANT_KEY=REDACTED
const PAYFAST_PASSPHRASE=REDACTED
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://edudashpro.org.za';

// PayFast URLs
const PAYFAST_URLS = {
  sandbox: 'https://sandbox.payfast.co.za/eng/process',
  production: 'https://www.payfast.co.za/eng/process',
};

/**
 * Generate MD5 signature for PayFast
 * CRITICAL: PayFast sandbox does NOT use passphrase - only production does
 */
function generateSignature(data: Record<string, any>, isSandbox: boolean): string {
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
  
  const signature = crypto.createHash('md5').update(paramString).digest('hex');
  
  console.log('[PayFast API] Signature generated:', {
    mode: isSandbox ? 'sandbox' : 'production',
    hasPassphrase: !isSandbox && !!PAYFAST_PASSPHRASE,
    paramStringLength: paramString.length,
    signature,
  });
  
  return signature;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      user_id, 
      tier, 
      amount, 
      email,
      firstName,
      lastName,
      // Subscription parameters
      subscriptionType = '1', // 1 = Subscription, 2 = Ad Hoc
      frequency = '3', // 3 = Monthly, 4 = Quarterly, 5 = Biannually, 6 = Annual
      cycles = '0', // 0 = Until cancelled
      billingDate,
      itemName,
      itemDescription,
    } = body;

    if (!user_id || !tier || !amount || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const isSandbox = PAYFAST_MODE === 'sandbox';
    const payFastUrl = isSandbox ? PAYFAST_URLS.sandbox : PAYFAST_URLS.production;

    // Validate merchant credentials
    if (!PAYFAST_MERCHANT_ID || !PAYFAST_MERCHANT_KEY) {
      console.error('[PayFast API] Missing merchant credentials');
      return NextResponse.json({ error: 'Payment system not configured' }, { status: 500 });
    }

    // Create unique payment reference
    const paymentId = `SUB_${tier.toUpperCase()}_${user_id.slice(0, 8)}_${Date.now()}`;

    // Prepare PayFast data (order matters for signature!)
    const payFastData: Record<string, string> = {
      // Merchant details
      merchant_id: PAYFAST_MERCHANT_ID,
      merchant_key: PAYFAST_MERCHANT_KEY,
      
      // URLs
      return_url: `${BASE_URL}/dashboard/parent/subscription?payment=success`,
      cancel_url: `${BASE_URL}/dashboard/parent/subscription?payment=cancelled`,
      notify_url: `${BASE_URL}/api/payfast/webhook`,
      
      // Buyer details
      name_first: firstName || email.split('@')[0],
      name_last: lastName || 'User',
      email_address: email,
      
      // Transaction details
      m_payment_id: paymentId,
      amount: amount.toFixed(2),
      item_name: itemName || `EduDash Pro ${tier} Subscription`,
      item_description: itemDescription || `Monthly subscription to EduDash Pro ${tier} plan`,
      
      // Custom fields for webhook processing
      custom_str1: user_id,
      custom_str2: tier,
      custom_str3: 'monthly_subscription',
    };

    // Add subscription details if this is a recurring payment
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

    // Build payment URL with all parameters
    const params = new URLSearchParams({ ...payFastData, signature });
    const paymentUrl = `${payFastUrl}?${params.toString()}`;

    console.log('[PayFast API] Payment created:', {
      paymentId,
      tier,
      amount,
      mode: isSandbox ? 'sandbox' : 'production',
      merchantId: PAYFAST_MERCHANT_ID,
    });

    return NextResponse.json({
      success: true,
      payment_url: paymentUrl,
      payment_id: paymentId,
      mode: isSandbox ? 'sandbox' : 'production',
    });

  } catch (error) {
    console.error('[PayFast API] Create payment error:', error);
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
}
