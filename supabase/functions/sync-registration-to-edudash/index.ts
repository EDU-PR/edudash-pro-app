// Supabase Edge Function: sync-registration-to-edudash
// Syncs approved registrations from EduSitePro to EduDashPro database
// Creates student, parent, and class assignments automatically

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

Deno.serve(async (req) => {
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
    const edusiteproKey = Deno.env.get('EDUSITE_SERVICE_ROLE_KEY');

    if (!edusiteproKey) {
      throw new Error('EDUSITE_SERVICE_ROLE_KEY not configured');
    }

    const edusiteproClient = createClient(edusiteproUrl, edusiteproKey);

    // Fetch registration from EduSitePro (don't check status - we just approved it)
    const { data: registration, error: regError } = await edusiteproClient
      .from('registration_requests')
      .select('*')
      .eq('id', registration_id)
      .maybeSingle();

    if (regError) {
      throw new Error(`Error fetching registration: ${regError.message}`);
    }
    
    if (!registration) {
      console.log('[sync-registration] Registration not found in EduSitePro - may have been deleted:', registration_id);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Registration not found in source database',
          message: 'This registration may have been deleted from EduSitePro. Please create student account manually.',
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[sync-registration] Fetched registration:', registration.student_first_name, registration.student_last_name, 'Status:', registration.status);

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
      .select('id, auth_user_id')
      .eq('email', registration.guardian_email)
      .eq('role', 'parent')
      .maybeSingle();

    let parentUserId: string;
    let parentProfileId: string;

    if (existingParent) {
      console.log('[sync-registration] Parent already exists:', existingParent.id);
      parentUserId = existingParent.auth_user_id;
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

      // Split guardian name into first and last name
      const nameParts = registration.guardian_name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Create parent profile
      const { data: newProfile, error: profileError } = await edudashClient
        .from('profiles')
        .insert({
          auth_user_id: parentUserId,
          email: registration.guardian_email,
          first_name: firstName,
          last_name: lastName,
          phone: registration.guardian_phone,
          role: 'parent',
          preschool_id: preschoolId,
          address: registration.guardian_address,
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
        guardian_id: parentProfileId,
        status: 'active',
        is_active: true,
        enrollment_date: new Date().toISOString().split('T')[0], // date only
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
      .maybeSingle();

    if (defaultClass) {
      await edudashClient
        .from('class_assignments')
        .insert({
          class_id: defaultClass.id,
          student_id: newStudent.id,
          assigned_date: new Date().toISOString().split('T')[0],
          start_date: new Date().toISOString().split('T')[0],
          status: 'active',
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
