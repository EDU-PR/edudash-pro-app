// Supabase Edge Function: sync-registration-to-edudash
// Syncs approved registrations from EduSitePro to EduDashPro database
// Creates student, parent, and class assignments automatically

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Email template for parent approval
function generateParentApprovalEmail(data: {
  guardianName: string;
  studentName: string;
  email: string;
  schoolName: string;
  resetPasswordUrl: string;
  pwaUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f5f5f5">
<div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px 20px;text-align:center">
<h1 style="margin:0;color:white;font-size:28px">🎉 Registration Approved!</h1>
<p style="margin:10px 0 0;color:rgba(255,255,255,0.95);font-size:16px">Welcome to EduDash Pro</p>
</div>
<div style="max-width:600px;margin:0 auto;background:white">
<div style="padding:30px 20px">
<p style="margin:0 0 20px;font-size:16px;color:#333">Dear ${data.guardianName},</p>
<p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6">Great news! <strong>${data.studentName}'s</strong> registration at <strong>${data.schoolName}</strong> has been approved! We've created your parent account.</p>
<div style="background:#f8f9fa;border-left:4px solid #667eea;padding:20px;margin:20px 0">
<p style="margin:0 0 10px;font-size:14px;color:#666;font-weight:600">YOUR ACCOUNT</p>
<p style="margin:0;font-size:15px"><strong>Email:</strong> ${data.email}</p>
</div>
<div style="text-align:center;margin:30px 0">
<a href="${data.resetPasswordUrl}" style="display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:16px 40px;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px">Set Your Password</a>
</div>
<div style="background:linear-gradient(135deg,#f093fb 0%,#f5576c 100%);border-radius:12px;padding:25px;margin:30px 0;text-align:center">
<h2 style="margin:0 0 15px;color:white;font-size:22px">📱 Install Our Mobile App</h2>
<p style="margin:0 0 20px;color:rgba(255,255,255,0.95);font-size:15px">Get the best experience with our mobile app!</p>
<a href="${data.pwaUrl}" style="display:inline-block;background:white;color:#f5576c;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:600">Install App Now</a>
</div>
<div style="margin:30px 0">
<h3 style="margin:0 0 15px;font-size:18px">What's Next?</h3>
<ol style="margin:0;padding-left:20px;color:#555;font-size:15px;line-height:1.8">
<li>Click "Set Your Password" above</li>
<li>Create a secure password</li>
<li>Log in and explore your dashboard</li>
<li>Install the app for quick mobile access</li>
</ol>
</div>
</div>
<div style="background:#f8f9fa;padding:20px;text-align:center;border-top:1px solid #e5e7eb">
<p style="margin:0;font-size:14px;color:#666">Best regards,<br><strong>The EduDash Pro Team</strong></p>
</div>
</div>
</body>
</html>`.trim();
}

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
    // This assumes the organization_id exists in both databases
    const preschoolId = registration.organization_id;

    // Fetch preschool/school name for the email
    const { data: preschool, error: preschoolError } = await edudashClient
      .from('preschools')
      .select('name')
      .eq('id', preschoolId)
      .maybeSingle();

    const schoolName = preschool?.name || 'Your School';

    console.log('[sync-registration] Using school name:', schoolName);

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

      // Send welcome email with password reset link and PWA install instructions
      const approvalEmail = generateParentApprovalEmail({
        guardianName: registration.guardian_name,
        studentName: `${registration.student_first_name} ${registration.student_last_name}`,
        email: registration.guardian_email,
        schoolName: schoolName,
        resetPasswordUrl: `${edudashUrl}/reset-password?email=${encodeURIComponent(registration.guardian_email)}`,
        pwaUrl: 'https://edudashpro.org.za',
      });

      await edudashClient.functions.invoke('send-email', {
        body: {
          to: registration.guardian_email,
          subject: '🎉 Registration Approved - Your EduDash Pro Account is Ready!',
          body: approvalEmail,
          is_html: true,
          confirmed: true,
        },
      });

      console.log('[sync-registration] Sent welcome email to parent');
    }

    // Step 2: Create student profile (check for existing first)
    console.log('[sync-registration] Checking for existing student...');

    // Check if student already exists (by name, DOB, and parent)
    const { data: existingStudent } = await edudashClient
      .from('students')
      .select('id')
      .eq('first_name', registration.student_first_name)
      .eq('last_name', registration.student_last_name)
      .eq('date_of_birth', registration.student_dob)
      .eq('parent_id', parentProfileId)
      .maybeSingle();

    let newStudent;

    if (existingStudent) {
      console.log('[sync-registration] Student already exists:', existingStudent.id);
      newStudent = existingStudent;
    } else {
      console.log('[sync-registration] Creating new student profile...');

      const { data: createdStudent, error: studentError } = await edudashClient
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

      if (studentError || !createdStudent) {
        throw new Error(`Failed to create student: ${studentError?.message}`);
      }

      newStudent = createdStudent;
      console.log('[sync-registration] Created student:', newStudent.id);
    }

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
