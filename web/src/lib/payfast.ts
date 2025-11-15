import crypto from 'crypto';

/**
 * PayFast Payment Integration Utilities
 * Supports both sandbox and production environments
 */

export interface PayFastPaymentData {
  // Merchant details
  merchant_id: string;
  merchant_key: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;

  // Transaction details
  name_first?: string;
  name_last?: string;
  email_address: string;
  cell_number?: string;

  // Item details
  m_payment_id: string; // Unique payment ID
  amount: number;
  item_name: string;
  item_description?: string;

  // Custom fields (passed through to webhook)
  custom_str1?: string; // user_id
  custom_str2?: string; // tier
  custom_str3?: string; // subscription_type
  custom_int1?: number;
  custom_int2?: number;

  // Subscription (recurring) details (optional)
  subscription_type?: '1' | '2'; // 1 = Subscription, 2 = Ad Hoc
  billing_date?: string; // YYYY-MM-DD
  recurring_amount?: number;
  frequency?: '3' | '4' | '5' | '6'; // 3=Monthly, 4=Quarterly, 5=Biannually, 6=Annual
  cycles?: number; // Number of payments (0 = until cancelled)
}

/**
 * Generate MD5 signature for PayFast payment
 */
export function generatePayFastSignature(data: Record<string, any>, passphrase?: string): string {
  // Create parameter string
  let paramString = '';
  
  // Sort keys alphabetically
  const sortedKeys = Object.keys(data).sort();
  
  for (const key of sortedKeys) {
    if (key !== 'signature') {
      const value = data[key];
      if (value !== undefined && value !== null && value !== '') {
        paramString += `${key}=${encodeURIComponent(String(value).trim()).replace(/%20/g, '+')}&`;
      }
    }
  }
  
  // Remove trailing &
  paramString = paramString.slice(0, -1);
  
  // Add passphrase if provided
  if (passphrase) {
    paramString += `&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`;
  }
  
  // Generate MD5 hash
  return crypto.createHash('md5').update(paramString).digest('hex');
}

/**
 * Build PayFast payment URL with all parameters
 */
export function buildPayFastUrl(paymentData: PayFastPaymentData, passphrase?: string): string {
  const isSandbox = process.env.NEXT_PUBLIC_PAYFAST_URL?.includes('sandbox') ?? true;
  const baseUrl = process.env.NEXT_PUBLIC_PAYFAST_URL || 'https://sandbox.payfast.co.za/eng/process';
  
  // Generate signature
  const signature = generatePayFastSignature(paymentData, passphrase);
  
  // Build URL parameters
  const params = new URLSearchParams();
  Object.entries(paymentData).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value));
    }
  });
  params.append('signature', signature);
  
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Create payment data for a subscription
 */
export function createSubscriptionPayment(
  userId: string,
  tier: 'basic' | 'premium' | 'school',
  userEmail: string,
  userName?: string
): PayFastPaymentData {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const merchantId = process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_ID || '10000100'; // Sandbox default
  const merchantKey = process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_KEY || '46f0cd694581a'; // Sandbox default
  
  // Tier pricing (in ZAR)
  const tierPricing: Record<string, { amount: number; name: string; description: string }> = {
    basic: {
      amount: 99.00,
      name: 'Parent Starter',
      description: 'Monthly subscription - 50 exams, 50 explanations, 100 chats per day',
    },
    premium: {
      amount: 199.00,
      name: 'Parent Plus',
      description: 'Monthly subscription - Unlimited exams, explanations, and chats',
    },
    school: {
      amount: 999.00,
      name: 'School Plan',
      description: 'Monthly subscription - Full school management and unlimited AI features',
    },
  };
  
  const pricing = tierPricing[tier];
  const [firstName, ...lastNameParts] = (userName || userEmail.split('@')[0]).split(' ');
  const lastName = lastNameParts.join(' ') || 'User';
  
  // Generate unique payment ID
  const paymentId = `SUB_${tier.toUpperCase()}_${userId.substring(0, 8)}_${Date.now()}`;
  
  return {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: `${baseUrl}/dashboard/parent/subscription?payment=success`,
    cancel_url: `${baseUrl}/dashboard/parent/subscription?payment=cancelled`,
    notify_url: `${baseUrl}/api/payfast/webhook`,
    
    name_first: firstName,
    name_last: lastName,
    email_address: userEmail,
    
    m_payment_id: paymentId,
    amount: pricing.amount,
    item_name: pricing.name,
    item_description: pricing.description,
    
    // Custom fields for webhook
    custom_str1: userId,
    custom_str2: tier,
    custom_str3: 'monthly_subscription',
    
    // Recurring subscription
    subscription_type: '1', // Subscription
    recurring_amount: pricing.amount,
    frequency: '3', // Monthly
    cycles: 0, // Until cancelled
  };
}

/**
 * Initiate PayFast payment (client-side)
 * @throws Error if called server-side or if required environment variables are missing
 */
export function initiatePayFastPayment(
  paymentData: PayFastPaymentData, 
  passphrase?: string,
  onError?: (error: Error) => void
): void {
  try {
    if (typeof window === 'undefined') {
      throw new Error('initiatePayFastPayment can only be called on the client side');
    }
    
    // Validate required fields
    if (!paymentData.merchant_id || !paymentData.merchant_key) {
      throw new Error('PayFast merchant credentials are missing. Please configure PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY.');
    }
    
    if (!paymentData.amount || paymentData.amount <= 0) {
      throw new Error('Invalid payment amount');
    }
    
    if (!paymentData.email_address || !paymentData.email_address.includes('@')) {
      throw new Error('Invalid email address');
    }
    
    const payfastUrl = process.env.NEXT_PUBLIC_PAYFAST_URL || 'https://sandbox.payfast.co.za/eng/process';
    
    // Create form dynamically
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = payfastUrl;
    
    // Add all payment data as hidden fields
    Object.entries(paymentData).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = String(value);
        form.appendChild(input);
      }
    });
    
    // Generate and add signature
    const signature = generatePayFastSignature(paymentData, passphrase);
    const sigInput = document.createElement('input');
    sigInput.type = 'hidden';
    sigInput.name = 'signature';
    sigInput.value = signature;
    form.appendChild(sigInput);
    
    // Submit form
    document.body.appendChild(form);
    
    console.log('[PayFast] Submitting payment:', {
      amount: paymentData.amount,
      tier: paymentData.item_name,
      email: paymentData.email_address,
      url: payfastUrl,
    });
    
    form.submit();
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown payment error');
    console.error('[PayFast] Payment initiation failed:', err);
    
    if (onError) {
      onError(err);
    } else {
      throw err;
    }
  }
}
