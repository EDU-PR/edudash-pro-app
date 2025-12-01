import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/auth/sign-up-principal
 * 
 * Handle principal sign-up with school creation
 * Uses service role to bypass RLS during initial setup
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, fullName, phoneNumber, schoolName, schoolAddress } = body;

    // Validation
    if (!email || !password || !fullName || !phoneNumber || !schoolName || !schoolAddress) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // 1. Create the user account
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // Require email verification
      user_metadata: {
        full_name: fullName,
        role: 'principal',
      },
    });

    if (authError) {
      console.error('[Sign-up Principal] Auth error:', authError);
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }

    console.log('[Sign-up Principal] User created:', authData.user.id);

    // 2. Create the preschool/school
    const { data: preschoolData, error: preschoolError } = await supabaseAdmin
      .from('preschools')
      .insert({
        name: schoolName,
        address: schoolAddress,
        contact_email: email,
        contact_phone: phoneNumber,
      })
      .select()
      .single();

    if (preschoolError) {
      console.error('[Sign-up Principal] Preschool creation error:', preschoolError);
      // Cleanup: delete the user if preschool creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: `Failed to create school: ${preschoolError.message}` },
        { status: 500 }
      );
    }

    console.log('[Sign-up Principal] Preschool created:', preschoolData.id);

    // 3. Update the user's profile with role and preschool
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        role: 'principal',
        full_name: fullName,
        phone_number: phoneNumber,
        preschool_id: preschoolData.id,
      })
      .eq('id', authData.user.id);

    if (profileError) {
      console.error('[Sign-up Principal] Profile update error:', profileError);
      // Cleanup: delete preschool and user
      await supabaseAdmin.from('preschools').delete().eq('id', preschoolData.id);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: `Failed to update profile: ${profileError.message}` },
        { status: 500 }
      );
    }

    console.log('[Sign-up Principal] Profile updated for user:', authData.user.id);

    // 4. Send verification email
    const { error: emailError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_WEB_URL || request.headers.get('origin')}/dashboard/principal`,
      }
    });

    if (emailError) {
      console.warn('[Sign-up Principal] Email verification link generation failed:', emailError);
      // Don't fail the signup, just log the warning
    }

    return NextResponse.json({
      success: true,
      message: 'Account created successfully. Please check your email to verify your account.',
      userId: authData.user.id,
      preschoolId: preschoolData.id,
    });
  } catch (error) {
    console.error('[Sign-up Principal] Unexpected error:', error);
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
