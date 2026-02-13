/**
 * Account Creation & Auth Validation Utilities
 *
 * Standalone functions for student/instructor registration,
 * password validation, friendly error messages, and security event logging.
 *
 * @module accountCreation
 */

import { AuthError, SupabaseClient, User } from '@supabase/supabase-js';
import { getAppConfiguration } from '../config';
import type { AuthResponse, RegisterCredentials, CreateInstructorCredentials, UserProfile } from './AuthService';

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

export function validatePassword(
  password: string,
): { valid: boolean; error?: string } {
  if (!password) {
    return { valid: false, error: 'Password is required' };
  }
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }

  const hasLowerCase = /[a-z]/.test(password);
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumbers = /\d/.test(password);
  // ASCII punctuation ranges to detect symbols reliably without unnecessary escapes
  const hasSymbols = /[!-/:-@[-`{-~]/.test(password);

  if (!hasLowerCase) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }
  if (!hasUpperCase) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }
  if (!hasNumbers) {
    return { valid: false, error: 'Password must contain at least one number' };
  }
  if (!hasSymbols) {
    return { valid: false, error: 'Password must contain at least one symbol' };
  }
  return { valid: true };
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function getFriendlyErrorMessage(error: AuthError): string {
  switch (error.message) {
    case 'Invalid login credentials':
      return 'Invalid email or password. Please check your credentials and try again.';
    case 'Email not confirmed':
      return 'Please check your email and click the confirmation link before signing in.';
    case 'User already registered':
      return 'An account with this email already exists. Try signing in instead.';
    case 'Password should be at least 6 characters':
      return 'Password must be at least 8 characters long with uppercase, lowercase, number, and symbol.';
    default:
      return error.message || 'An unexpected error occurred. Please try again.';
  }
}

// ---------------------------------------------------------------------------
// Security event logging
// ---------------------------------------------------------------------------

export async function recordSecurityEvent(
  supabase: SupabaseClient,
  userId: string | null,
  eventType: string,
  description: string,
): Promise<void> {
  try {
    const { error } = await supabase.from('security_events').insert({
      user_id: userId,
      event_type: eventType,
      event_category: 'authentication',
      severity: eventType.includes('failed') ? 'warning' : 'info',
      description,
      ip_address: null,
      user_agent: null,
      success: !eventType.includes('failed'),
      metadata: {
        timestamp: new Date().toISOString(),
        app_version: getAppConfiguration().environment,
      },
    });

    if (
      error &&
      !error.message.includes('relation "security_events" does not exist')
    ) {
      console.error('Failed to record security event:', error);
    }
  } catch (error) {
    console.debug('Security event recording skipped:', error);
  }
}

// ---------------------------------------------------------------------------
// Profile loading
// ---------------------------------------------------------------------------

export async function loadUserProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Failed to load user profile:', error);
      return null;
    }
    return data as UserProfile;
  } catch (error) {
    console.error('Profile loading error:', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Account creation flows
// ---------------------------------------------------------------------------

/**
 * Student self-service registration
 */
export async function registerStudentAccount(
  supabase: SupabaseClient,
  credentials: RegisterCredentials,
): Promise<AuthResponse<{ user: User; requiresVerification: boolean }>> {
  try {
    const passwordValidation = validatePassword(credentials.password);
    if (!passwordValidation.valid) {
      return { success: false, error: passwordValidation.error };
    }

    if (!isValidEmail(credentials.email)) {
      return { success: false, error: 'Please enter a valid email address' };
    }

    const { data: existingUser } = await supabase
      .from('profiles')
      .select('email')
      .eq('email', credentials.email.toLowerCase())
      .single();

    if (existingUser) {
      return {
        success: false,
        error: 'An account with this email already exists',
      };
    }

    const { data, error } = await supabase.auth.signUp({
      email: credentials.email.toLowerCase(),
      password: credentials.password,
      options: {
        emailRedirectTo:
          'https://www.edudashpro.org.za/landing?flow=email-confirm',
        data: {
          first_name: credentials.firstName,
          last_name: credentials.lastName,
          role: 'student',
        },
      },
    });

    if (error) {
      recordSecurityEvent(supabase, null, 'registration_failed', error.message);
      return { success: false, error: getFriendlyErrorMessage(error) };
    }

    if (!data.user) {
      return {
        success: false,
        error: 'Registration failed - user not created',
      };
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      email: credentials.email.toLowerCase(),
      first_name: credentials.firstName,
      last_name: credentials.lastName,
      role: 'student',
      capabilities: [
        'access_mobile_app',
        'view_assignments',
        'submit_assignments',
        'view_grades',
        'view_courses',
      ],
      metadata: {
        registration_method: 'self_service',
        account_type: 'student',
        created_via: 'mobile_app',
      },
    });

    if (profileError) {
      console.error('Profile creation failed:', profileError);
    }

    recordSecurityEvent(
      supabase,
      data.user.id,
      'registration_success',
      'Student account created',
    );

    return {
      success: true,
      data: {
        user: data.user,
        requiresVerification: !data.session,
      },
      requiresEmailVerification: !data.session,
    };
  } catch (error) {
    console.error('Registration error:', error);
    return {
      success: false,
      error: 'Registration failed due to an unexpected error',
    };
  }
}

/**
 * Admin-only instructor account creation
 */
export async function createInstructorAccountFlow(
  supabase: SupabaseClient,
  credentials: CreateInstructorCredentials,
  createdBy: string,
): Promise<AuthResponse<{ user: User }>> {
  try {
    const creatorProfile = await loadUserProfile(supabase, createdBy);
    if (!creatorProfile || creatorProfile.role !== 'admin') {
      return {
        success: false,
        error:
          'Unauthorized - only administrators can create instructor accounts',
      };
    }

    const passwordValidation = validatePassword(credentials.password);
    if (!passwordValidation.valid) {
      return { success: false, error: passwordValidation.error };
    }

    const { data: existingUser } = await supabase
      .from('profiles')
      .select('email')
      .eq('email', credentials.email.toLowerCase())
      .single();

    if (existingUser) {
      return {
        success: false,
        error: 'An account with this email already exists',
      };
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: credentials.email.toLowerCase(),
      password: credentials.password,
      email_confirm: true,
      user_metadata: {
        first_name: credentials.firstName,
        last_name: credentials.lastName,
        role: 'instructor',
        created_by: createdBy,
      },
    });

    if (error) {
      recordSecurityEvent(
        supabase,
        createdBy,
        'instructor_creation_failed',
        error.message,
      );
      return { success: false, error: getFriendlyErrorMessage(error) };
    }

    if (!data.user) {
      return {
        success: false,
        error: 'Account creation failed - user not created',
      };
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      email: credentials.email.toLowerCase(),
      first_name: credentials.firstName,
      last_name: credentials.lastName,
      role: 'instructor',
      capabilities: [
        'access_mobile_app',
        'manage_classes',
        'create_assignments',
        'grade_assignments',
        'view_student_progress',
        'manage_courses',
        'manage_enrollments',
      ],
      metadata: {
        registration_method: 'admin_created',
        account_type: 'instructor',
        created_by: createdBy,
        organization_id: credentials.organizationId,
      },
    });

    if (profileError) {
      console.error('Instructor profile creation failed:', profileError);
    }

    recordSecurityEvent(
      supabase,
      createdBy,
      'instructor_created',
      `Instructor account created for ${credentials.email}`,
    );

    return { success: true, data: { user: data.user } };
  } catch (error) {
    console.error('Instructor creation error:', error);
    return {
      success: false,
      error: 'Account creation failed due to an unexpected error',
    };
  }
}
