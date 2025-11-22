// Supabase Edge Function: sync-registration-to-edudash
// Syncs approved registrations from EduSitePro to EduDashPro database
// Creates student, parent, and class assignments automatically

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RegistrationData {
  id: string;
  organization_id: string;
  // Guardian info
  guardian_name: string;
  guardian_email: string;
  guardian_phone: string;
  guardian_address: string;
  // Student info
  student_first_name: string;
  student_last_name: string;
  student_dob: string;
  student_gender: string;
  // Status
  status: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { registration_id } = await req.json();

    if (!registration_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing registration_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[sync-registration] Starting sync for registration:', registration_id);

    // Connect to EduSitePro database
    const edusiteproUrl = Deno.env.get('EDUSITE_SUPABASE_URL') || 'https://bppuzibjlxgfwrujzfsz.supabase.co';
    const edusiteproKey = Deno.env.get('EDUSITE_SUPABASE_SERVICE_ROLE_KEY');

    if (!edusiteproKey) {
      throw new Error('EDUSITE_SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    const edusiteproClient = createClient(edusiteproUrl, edusiteproKey);

    // Fetch registration from EduSitePro
    const { data: registration, error: regError } = await edusiteproClient
      .from('registration_requests')
      .select('*')
      .eq('id', registration_id)
      .eq('status', 'approved')
      .single();

    if (regError || !registration) {
      throw new Error(`Registration not found or not approved: ${regError?.message}`);
    }

    console.log('[sync-registration] Fetched registration:', registration.student_first_name, registration.student_last_name);

    // Connect to EduDashPro database
    const edudashUrl = Deno.env.get('SUPABASE_URL')!;
    const edudashKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const edudashClient = createClient(edudashUrl, edudashKey);

    // Map organization_id from EduSitePro to preschool_id in EduDashPro
    // For now, we'll use a default preschool or create a mapping table
    // This assumes the organization_id exists in both databases
    const preschoolId = registration.organization_id;

    // Step 1: Create or find parent account
    console.log('[sync-registration] Creating/finding parent account...');
    
    // Check if parent already exists by email
    const { data: existingParent } = await edudashClient
      .from('profiles')
      .select('id, user_id')
      .eq('email', registration.guardian_email)
      .eq('role', 'parent')
      .single();

    let parentUserId: string;
    let parentProfileId: string;

    if (existingParent) {
      console.log('[sync-registration] Parent already exists:', existingParent.id);
      parentUserId = existingParent.user_id;
      parentProfileId = existingParent.id;
    } else {
      // Create new parent user account
      const tempPassword = crypto.randomUUID(); // Generate secure random password
      
      const { data: newUser, error: createUserError } = await edudashClient.auth.admin.createUser({
        email: registration.guardian_email,
        password: tempPassword,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name: registration.guardian_name,
          phone: registration.guardian_phone,
        },
      });

      if (createUserError || !newUser.user) {
        throw new Error(`Failed to create parent user: ${createUserError?.message}`);
      }

      parentUserId = newUser.user.id;

      console.log('[sync-registration] Created parent user:', parentUserId);

      // Create parent profile
      const { data: newProfile, error: profileError } = await edudashClient
        .from('profiles')
        .insert({
          user_id: parentUserId,
          email: registration.guardian_email,
          full_name: registration.guardian_name,
          phone: registration.guardian_phone,
          role: 'parent',
          preschool_id: preschoolId,
          address: registration.guardian_address,
          onboarding_completed: false,
        })
        .select()
        .single();

      if (profileError || !newProfile) {
        throw new Error(`Failed to create parent profile: ${profileError?.message}`);
      }

      parentProfileId = newProfile.id;

      console.log('[sync-registration] Created parent profile:', parentProfileId);

      // Send welcome email with password reset link
      await edudashClient.functions.invoke('send-email', {
        body: {
          to: registration.guardian_email,
          subject: 'Welcome to EduDash Pro - Set Your Password',
          body: `
            <h1>Welcome to EduDash Pro!</h1>
            <p>Dear ${registration.guardian_name},</p>
            <p>Your child's registration has been approved! We've created an account for you.</p>
            <p><strong>Email:</strong> ${registration.guardian_email}</p>
            <p>Please click the link below to set your password and access your dashboard:</p>
            <p><a href="${edudashUrl}/reset-password?email=${encodeURIComponent(registration.guardian_email)}">Set Your Password</a></p>
            <p>If you have any questions, please contact your school.</p>
            <p>Best regards,<br>EduDash Pro Team</p>
          `,
          is_html: true,
          confirmed: true,
        },
      });

      console.log('[sync-registration] Sent welcome email to parent');
    }

    // Step 2: Create student profile
    console.log('[sync-registration] Creating student profile...');

    const { data: newStudent, error: studentError } = await edudashClient
      .from('students')
      .insert({
        first_name: registration.student_first_name,
        last_name: registration.student_last_name,
        date_of_birth: registration.student_dob,
        gender: registration.student_gender,
        preschool_id: preschoolId,
        parent_id: parentProfileId,
        enrollment_status: 'active',
        enrollment_date: new Date().toISOString(),
      })
      .select()
      .single();

    if (studentError || !newStudent) {
      throw new Error(`Failed to create student: ${studentError?.message}`);
    }

    console.log('[sync-registration] Created student:', newStudent.id);

    // Step 3: Assign student to default class (if available)
    // This could be based on age group or grade level
    const { data: defaultClass } = await edudashClient
      .from('classes')
      .select('id')
      .eq('preschool_id', preschoolId)
      .limit(1)
      .single();

    if (defaultClass) {
      await edudashClient
        .from('class_students')
        .insert({
          class_id: defaultClass.id,
          student_id: newStudent.id,
        });

      console.log('[sync-registration] Assigned student to class:', defaultClass.id);
    }

    // Step 4: Mark registration as synced in EduSitePro
    await edusiteproClient
      .from('registration_requests')
      .update({
        synced_to_edudash: true,
        synced_at: new Date().toISOString(),
        edudash_student_id: newStudent.id,
        edudash_parent_id: parentProfileId,
      })
      .eq('id', registration_id);

    console.log('[sync-registration] Sync completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        student_id: newStudent.id,
        parent_id: parentProfileId,
        message: 'Registration synced successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-registration] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
