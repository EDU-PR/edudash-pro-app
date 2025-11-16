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
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create Supabase client with user's token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
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

    // Get session for auth header
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'No active session' },
        { status: 401 }
      );
    }

    // Call Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('payfast-create-payment', {
      body: {
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
      },
    });

    if (error) {
      console.error('[PayFast API] Edge function error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to create payment' },
        { status: 500 }
      );
    }

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
