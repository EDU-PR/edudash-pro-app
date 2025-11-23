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
  tempPassword: string; // Always required for new parent accounts
}): string {
  // Temp password section - always shown for approved registrations
  const tempPasswordSection = `
<div style="background:#d4edda;border:2px solid #28a745;border-radius:8px;padding:25px;margin:25px 0">
<p style="margin:0 0 15px;font-size:16px;color:#155724;font-weight:700;text-align:center">🔑 YOUR LOGIN CREDENTIALS</p>
<div style="background:#fff;border-radius:6px;padding:15px;margin:10px 0">
<p style="margin:0 0 10px;font-size:15px;color:#155724"><strong>Email:</strong> <span style="color:#0066cc">${data.email}</span></p>
<p style="margin:0;font-size:15px;color:#155724"><strong>Temporary Password:</strong></p>
<code style="display:block;background:#f8f9fa;padding:12px;border-radius:4px;font-family:monospace;font-size:16px;color:#d63031;margin-top:8px;border:1px dashed #28a745;text-align:center;letter-spacing:1px">${data.tempPassword}</code>
</div>
<p style="margin:15px 0 0;font-size:13px;color:#155724;text-align:center">💡 You can login immediately with these credentials, then change your password to something memorable.</p>
</div>
  `;

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
<p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6">Great news! <strong>${data.studentName}'s</strong> registration at <strong>${data.schoolName}</strong> has been approved! We've created your parent account with a <strong>7-day Premium trial</strong>.</p>
<div style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);border-radius:10px;padding:20px;margin:20px 0;text-align:center">
<p style="margin:0;font-size:18px;color:white;font-weight:700">🎁 7-Day Premium Trial Activated!</p>
<p style="margin:10px 0 0;font-size:14px;color:rgba(255,255,255,0.95)">Full access to all premium features at no cost</p>
</div>
<div style="background:#f8f9fa;border-left:4px solid #667eea;padding:20px;margin:20px 0">
<p style="margin:0 0 10px;font-size:14px;color:#666;font-weight:600">YOUR ACCOUNT</p>
<p style="margin:0;font-size:15px"><strong>Email:</strong> ${data.email}</p>
</div>
${tempPasswordSection}
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
<li><strong>Login Now:</strong> Use the temporary credentials above to access your account at <a href="https://edudashpro.org.za/login" style="color:#667eea">edudashpro.org.za/login</a></li>
<li><strong>Change Password:</strong> Click "Set Your Password" button or update it in your profile settings</li>
<li><strong>Install Mobile App:</strong> Get the app for easy access on your phone</li>
<li><strong>Explore Dashboard:</strong> View your child's progress, attendance, and communicate with teachers</li>
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

    // Connect to EduDashPro database FIRST
    const edudashUrl = Deno.env.get('SUPABASE_URL')!;
    const edudashKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const edudashClient = createClient(edudashUrl, edudashKey);

    // Try to fetch registration from local EduDashPro database first
    const { data: localRegistration, error: localRegError } = await edudashClient
      .from('registration_requests')
      .select('*')
      .eq('id', registration_id)
      .maybeSingle();

    if (localRegError) {
      throw new Error(`Error fetching local registration: ${localRegError.message}`);
    }

    let registration: any = localRegistration;

    // If not found locally, try EduSitePro (backwards compatibility)
    if (!registration) {
      console.log('[sync-registration] Not found locally, checking EduSitePro...');
      
      const { data: edusiteReg, error: regError } = await edusiteproClient
        .from('registration_requests')
        .select('*')
        .eq('id', registration_id)
        .maybeSingle();

      if (regError) {
        throw new Error(`Error fetching registration: ${regError.message}`);
      }
      
      if (!edusiteReg) {
        console.log('[sync-registration] Registration not found in either database:', registration_id);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Registration not found',
            message: 'Registration not found in any database.',
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      registration = edusiteReg;
    }

    console.log('[sync-registration] Fetched registration:', registration.student_first_name, registration.student_last_name, 'Status:', registration.status);

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
    
    // Normalize email to lowercase for consistency
    const normalizedEmail = registration.guardian_email.toLowerCase().trim();
    
    // Check if parent already exists by email (case-insensitive)
    const { data: existingParent } = await edudashClient
      .from('profiles')
      .select('id, auth_user_id')
      .ilike('email', normalizedEmail)
      .eq('role', 'parent')
      .maybeSingle();

    let parentUserId: string;
    let parentProfileId: string;
    let tempPassword: string | null = null;

    if (existingParent) {
      console.log('[sync-registration] Parent profile already exists:', existingParent.id);
      parentUserId = existingParent.auth_user_id || existingParent.id;
      parentProfileId = existingParent.id;
      
      // If auth_user_id is null, update the profile with proper auth_user_id
      if (!existingParent.auth_user_id) {
        console.log('[sync-registration] Fixing orphaned profile - updating auth_user_id');
        await edudashClient
          .from('profiles')
          .update({ auth_user_id: existingParent.id })
          .eq('id', existingParent.id);
      }
      
      // Skip email sending for existing parents - they already have login credentials
    } else {
      // Check if auth user exists but no profile (orphaned user)
      const { data: authUsers } = await edudashClient.auth.admin.listUsers();
      const existingAuthUser = authUsers?.users.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
      
      // Always generate temp password for new accounts (whether auth user exists or not)
      tempPassword = crypto.randomUUID(); // Generate secure random password
      
      if (existingAuthUser) {
        console.log('[sync-registration] Found orphaned auth user, will create profile:', existingAuthUser.id);
        parentUserId = existingAuthUser.id;
        // Update password for orphaned user
        await edudashClient.auth.admin.updateUserById(existingAuthUser.id, {
          password: tempPassword,
        });
      } else {
        // Create new parent user account
        
        const { data: newUser, error: createUserError } = await edudashClient.auth.admin.createUser({
          email: normalizedEmail,
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
      }

      // Split guardian name into first and last name
      // If guardian name is incomplete, use student's last name as fallback
      const nameParts = registration.guardian_name.split(' ');
      const firstName = nameParts[0] || 'Parent';
      let lastName = nameParts.slice(1).join(' ');
      
      // If no last name provided, use student's last name as fallback
      if (!lastName && registration.student_last_name) {
        lastName = registration.student_last_name;
      }

      // Create parent profile - id must match auth_user_id due to FK constraint
      const { data: newProfile, error: profileError } = await edudashClient
        .from('profiles')
        .insert({
          id: parentUserId, // FK constraint: profiles.id -> auth.users.id
          auth_user_id: parentUserId,
          email: normalizedEmail,
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
      
      // Activate 7-day Parent Plus trial for new parent
      console.log('[sync-registration] Activating 7-day Parent Plus trial...');
      try {
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 7);
        
        const { error: trialError } = await edudashClient
          .from('profiles')
          .update({
            is_trial: true,
            trial_ends_at: trialEndDate.toISOString(),
            trial_plan_tier: 'parent_plus',
            trial_started_at: new Date().toISOString(),
            trial_granted_at: new Date().toISOString(),
            seat_status: 'active',
            subscription_tier: 'parent_plus'
          })
          .eq('id', parentUserId);
        
        if (trialError) {
          console.error('[sync-registration] Failed to activate trial:', trialError);
        } else {
          console.log('[sync-registration] ✅ 7-day Parent Plus trial activated');
        }
        
        // Create user_ai_tiers record for AI quota tracking
        const { error: aiTierError } = await edudashClient
          .from('user_ai_tiers')
          .insert({
            user_id: parentUserId,
            tier: 'parent_plus',
            assigned_reason: '7-day trial - parent_plus tier',
            is_active: true,
            expires_at: trialEndDate.toISOString()
          });
        
        if (aiTierError) {
          console.error('[sync-registration] Failed to create user_ai_tiers:', aiTierError);
        } else {
          console.log('[sync-registration] ✅ Created user_ai_tiers record');
        }
        
        // Create user_ai_usage record for AI quota tracking
        const { error: aiUsageError } = await edudashClient
          .from('user_ai_usage')
          .insert({
            user_id: parentUserId,
            current_tier: 'parent_plus'
          });
        
        if (aiUsageError) {
          console.error('[sync-registration] Failed to create user_ai_usage:', aiUsageError);
        } else {
          console.log('[sync-registration] ✅ Created user_ai_usage record');
        }
      } catch (trialErr) {
        console.error('[sync-registration] Trial activation error:', trialErr);
      }
    }

    // Send welcome email ONLY for new parent accounts (when temp password was generated)
    if (tempPassword) {

      // Generate password reset link with actual token
      const { data: resetData, error: resetError } = await edudashClient.auth.admin.generateLink({
        type: 'recovery',
        email: normalizedEmail,
        options: {
          redirectTo: 'https://edudashpro.org.za/reset-password',
        },
      });

      if (resetError) {
        console.error('[sync-registration] Error generating password reset link:', resetError);
        throw new Error(`Failed to generate password reset link: ${resetError.message}`);
      }

      const resetPasswordUrl = resetData?.properties?.action_link || 'https://edudashpro.org.za/reset-password';
      
      console.log('[sync-registration] Generated password reset link for parent');

      // Send welcome email with actual password reset link
      const approvalEmail = generateParentApprovalEmail({
        guardianName: registration.guardian_name,
        studentName: `${registration.student_first_name} ${registration.student_last_name}`,
        email: normalizedEmail,
        schoolName: schoolName,
        resetPasswordUrl: resetPasswordUrl,
        pwaUrl: 'https://edudashpro.org.za',
        tempPassword: tempPassword, // Include temp password if it was generated
      });

      console.log('[sync-registration] Sending welcome email to:', registration.guardian_email);

      const { data: emailResult, error: emailError } = await edudashClient.functions.invoke('send-email', {
        body: {
          to: registration.guardian_email,
          subject: '🎉 Registration Approved - Your EduDash Pro Account is Ready!',
          body: approvalEmail,
          is_html: true,
          confirmed: true,
        },
      });

      if (emailError) {
        console.error('[sync-registration] ⚠️ Failed to send welcome email:', emailError);
        // Don't throw - we still want to complete the sync even if email fails
      } else {
        console.log('[sync-registration] ✅ Successfully sent welcome email to parent');
        if (emailResult) {
          console.log('[sync-registration] Email result:', emailResult);
        }
      }
    } else {
      console.log('[sync-registration] Skipping email - parent account already exists');
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
          registration_fee_amount: registration.registration_fee_amount,
          registration_fee_paid: registration.registration_fee_paid || false,
          payment_verified: registration.payment_verified || false,
          payment_date: registration.payment_date,
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

    // Step 4: Mark registration as synced AND approved in EduSitePro (if it came from there)
    // This ensures both databases stay in sync regardless of which UI approved it
    if (registration.edusite_id || registration.synced_from_edusite) {
      // This registration came from EduSitePro, so update it there too
      const edusiteId = registration.edusite_id || registration.id;
      
      console.log('[sync-registration] Updating EduSitePro registration:', edusiteId);
      
      const { error: edusiteUpdateError } = await edusiteproClient
        .from('registration_requests')
        .update({
          status: 'approved',
          synced_to_edudash: true,
          synced_at: new Date().toISOString(),
          edudash_student_id: newStudent.id,
          edudash_parent_id: parentProfileId,
        })
        .eq('id', edusiteId);

      if (edusiteUpdateError) {
        console.error('[sync-registration] Failed to update EduSitePro:', edusiteUpdateError);
        // Don't fail the whole operation if EduSitePro update fails
      } else {
        console.log('[sync-registration] Successfully updated EduSitePro database');
      }
    }

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
