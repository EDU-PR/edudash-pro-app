import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    // Create Supabase client with service role for server-side operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
        },
      }
    );
    
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { registrationId, verified } = await req.json();

    if (!registrationId || typeof verified !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields: registrationId, verified' },
        { status: 400 }
      );
    }

    console.log(`[Verify Payment] ${verified ? 'Verifying' : 'Unverifying'} payment for registration:`, registrationId);

    // Update payment verification status in registration_requests table
    const { data: regData, error: regError } = await supabase
      .from('registration_requests')
      .update({ 
        payment_verified: verified,
        payment_date: verified ? new Date().toISOString() : null
      })
      .eq('id', registrationId)
      .select()
      .single();

    if (regError) {
      console.error('Error verifying payment in registration_requests:', regError);
      return NextResponse.json({ error: regError.message }, { status: 500 });
    }

    console.log('✅ Updated registration_requests table');

    // Also update in students table if student exists
    // Find student by matching guardian email and student name
    if (regData) {
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .update({
          payment_verified: verified,
          payment_date: verified ? new Date().toISOString() : null,
        })
        .eq('organization_id', regData.organization_id)
        .ilike('first_name', regData.student_first_name)
        .ilike('last_name', regData.student_last_name)
        .select();

      if (studentError) {
        console.error('Error updating students table (non-critical):', studentError);
        // Don't fail the request if student doesn't exist yet
      } else if (studentData && studentData.length > 0) {
        console.log('✅ Updated students table for', studentData.length, 'matching student(s)');
      }
    }

    return NextResponse.json({ 
      success: true, 
      data: regData,
      message: verified ? 'Payment verified successfully' : 'Payment verification removed'
    });
  } catch (error: any) {
    console.error('Verify payment error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
