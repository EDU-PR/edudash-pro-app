import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * PayFast Payment Creation API Route
 * Proxies requests to Supabase Edge Function for secure payment processing
 * 
 * Security: All PayFast credentials are stored in Supabase Edge Function secrets
 */

export async function POST(request: NextRequest) {
  try {
    // Get auth token from request
    const authHeader = request.headers.get('authorization');
    console.log('[PayFast API] Auth header present:', !!authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[PayFast API] Missing or invalid auth header:', authHeader?.substring(0, 20));
      return NextResponse.json(
        { error: 'Authentication required', details: 'No valid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('[PayFast API] Token length:', token.length);
    
    // Create Supabase client WITHOUT setting auth in global headers
    // We'll pass it explicitly to the edge function
    const supabaseForAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Verify authentication using the token
    const { data: { user }, error: authError } = await supabaseForAuth.auth.getUser(token);
    console.log('[PayFast API] User verification:', { 
      hasUser: !!user, 
      userId: user?.id?.substring(0, 8),
      userEmail: user?.email,
      error: authError?.message,
      errorDetails: authError 
    });
    
    if (authError || !user) {
      console.error('[PayFast API] Auth verification failed:', authError);
      return NextResponse.json(
        { error: 'Authentication required', details: authError?.message || 'User not found' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { 
      user_id, 
      tier, 
      amount, 
      email,
      firstName,
      lastName,
      itemName,
      itemDescription,
      subscriptionType,
      frequency,
      cycles,
      billingDate,
    } = body;

    // Validate required fields
    if (!user_id || !tier || !amount || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify user_id matches authenticated user
    if (user_id !== user.id) {
      return NextResponse.json(
        { error: 'User ID mismatch' },
        { status: 403 }
      );
    }

    console.log('[PayFast API] Calling edge function with user:', user.id);
    console.log('[PayFast API] Auth header being sent:', authHeader.substring(0, 30) + '...');

    // Call Supabase Edge Function directly via fetch to avoid header merge issues
    const functionsUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/payfast-create-payment`;
    const efRes = await fetch(functionsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Required headers for Supabase Edge Functions
        'Authorization': authHeader,
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
      body: JSON.stringify({
        user_id,
        tier,
        amount,
        email,
        firstName,
        lastName,
        itemName,
        itemDescription,
        subscriptionType,
        frequency,
        cycles,
        billingDate,
      }),
    });

    if (!efRes.ok) {
      const errText = await efRes.text();
      console.error('[PayFast API] Edge function HTTP error:', efRes.status, errText);
      return NextResponse.json(
        { error: 'Failed to create payment', details: errText || `HTTP ${efRes.status}` },
        { status: 500 }
      );
    }

    const data = await efRes.json();

    console.log('[PayFast API] Payment created via Edge Function:', {
      paymentId: data?.payment_id,
      tier,
      mode: data?.mode,
    });

    return NextResponse.json(data);

  } catch (error) {
    console.error('[PayFast API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
}
