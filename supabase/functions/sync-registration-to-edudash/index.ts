/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
/// <reference lib="deno.ns" />

// Sync Registration to EduDash
// Creates parent account with generated password and sends welcome email
// Called when principal approves a registration

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RegistrationRequest {
  id: string;
  organization_id: string;
  guardian_first_name: string;
  guardian_last_name: string;
  guardian_email: string;
  guardian_phone: string;
  student_first_name: string;
  student_last_name: string;
  student_date_of_birth: string | null;
  student_grade: string | null;
  student_allergies: string | null;
  student_medical_conditions: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  status: string;
  edusite_id?: string | null;
}

// Generate a readable, memorable password
// Format: Word + 3 digits + special char (e.g., Welcome2024!)
function generateReadablePassword(): string {
  const words = [
    'Welcome', 'Parent', 'Family', 'School', 'Learn', 'Grow',
    'Happy', 'Bright', 'Smart', 'Eagle', 'Star', 'Shine'
  ];
  const specialChars = ['!', '@', '#', '$'];
  
  const word = words[Math.floor(Math.random() * words.length)];
  const year = new Date().getFullYear();
  const randomNum = Math.floor(Math.random() * 100);
  const specialChar = specialChars[Math.floor(Math.random() * specialChars.length)];
  
  return `${word}${year}${randomNum.toString().padStart(2, '0')}${specialChar}`;
}

// Generate a secure random password for fallback
function generateSecurePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const special = '!@#$';
  let password = '';
  
  // 8 random chars
  for (let i = 0; i < 8; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  // Add a number and special char to ensure complexity
  password += Math.floor(Math.random() * 100).toString().padStart(2, '0');
  password += special[Math.floor(Math.random() * special.length)];
  
  return password;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'EduDash Pro <noreply@edudashpro.org.za>';
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { registration_id } = await req.json();

    if (!registration_id) {
      return new Response(
        JSON.stringify({ error: 'registration_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[sync-registration] Processing registration: ${registration_id}`);

    // Fetch registration from EduDashPro database
    const { data: registration, error: fetchError } = await supabase
      .from('registration_requests')
      .select('*')
      .eq('id', registration_id)
      .single();

    if (fetchError || !registration) {
      console.error('[sync-registration] Registration not found:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Registration not found', details: fetchError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only process approved registrations
    if (registration.status !== 'approved') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Registration is not approved yet',
          status: registration.status 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parentEmail = registration.guardian_email?.toLowerCase() || registration.parent_email?.toLowerCase();
    const parentFirstName = registration.guardian_first_name || registration.parent_first_name;
    const parentLastName = registration.guardian_last_name || registration.parent_last_name;
    const parentPhone = registration.guardian_phone || registration.parent_phone;
    const organizationId = registration.organization_id || registration.preschool_id;

    if (!parentEmail) {
      return new Response(
        JSON.stringify({ error: 'Parent email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let parentUserId: string | null = null;
    let parentAccountCreated = false;
    let generatedPassword: string | null = null;

    // Step 1: Check if parent account already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, email, organization_id, preschool_id')
      .eq('email', parentEmail)
      .maybeSingle();

    if (existingProfile) {
      console.log('[sync-registration] Parent profile already exists:', existingProfile.id);
      parentUserId = existingProfile.id;
      
      // ALWAYS update parent's organization to match registration
      // This fixes cases where parent was created with placeholder org
      const needsOrgUpdate = !existingProfile.organization_id || 
        existingProfile.organization_id !== organizationId ||
        existingProfile.preschool_id !== organizationId;
      
      if (needsOrgUpdate) {
        console.log(`[sync-registration] Updating parent ${parentUserId} org from ${existingProfile.organization_id} to ${organizationId}`);
        await supabase
          .from('profiles')
          .update({ 
            organization_id: organizationId,
            preschool_id: organizationId 
          })
          .eq('id', parentUserId);
      }
    } else {
      // Create parent account with generated password
      generatedPassword = generateReadablePassword();
      
      console.log('[sync-registration] Creating parent account for:', parentEmail);
      
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: parentEmail,
        password: generatedPassword,
        email_confirm: true, // Auto-confirm email so they can login immediately
        user_metadata: {
          first_name: parentFirstName,
          last_name: parentLastName,
          phone: parentPhone,
          role: 'parent',
        },
      });

      if (authError || !authData.user) {
        console.error('[sync-registration] Error creating parent account:', authError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to create parent account', 
            details: authError?.message 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      parentUserId = authData.user.id;
      parentAccountCreated = true;
      console.log('[sync-registration] Parent account created:', parentUserId);

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: parentUserId,
          email: parentEmail,
          first_name: parentFirstName,
          last_name: parentLastName,
          phone: parentPhone,
          role: 'parent',
          preschool_id: organizationId,
          organization_id: organizationId,
        });

      if (profileError) {
        console.error('[sync-registration] Error creating profile:', profileError);
        // Continue - profile might be created by trigger
      }
    }

    // Step 2: Create student record
    const studentFirstName = registration.student_first_name || registration.child_first_name;
    const studentLastName = registration.student_last_name || registration.child_last_name;
    
    // Check if student already exists
    const { data: existingStudent } = await supabase
      .from('students')
      .select('id')
      .eq('first_name', studentFirstName?.trim())
      .eq('last_name', studentLastName?.trim())
      .eq('preschool_id', organizationId)
      .maybeSingle();

    let studentId: string | null = null;
    let studentCreated = false;

    if (existingStudent) {
      studentId = existingStudent.id;
      // Update parent link and payment status from registration
      await supabase
        .from('students')
        .update({ 
          parent_id: parentUserId, 
          guardian_id: parentUserId,
          // Also update payment status from registration
          registration_fee_amount: registration.registration_fee_amount || null,
          registration_fee_paid: registration.registration_fee_paid || false,
          payment_verified: registration.payment_verified || false,
          payment_date: registration.payment_date || null,
        })
        .eq('id', studentId);
      
      console.log('[sync-registration] Updated existing student with payment status:', {
        studentId,
        registration_fee_paid: registration.registration_fee_paid,
        payment_verified: registration.payment_verified,
      });
    } else {
      // Generate student ID code
      const { data: org } = await supabase
        .from('preschools')
        .select('name')
        .eq('id', organizationId)
        .single();

      const orgCode = org?.name?.substring(0, 3).toUpperCase() || 'STU';
      const year = new Date().getFullYear().toString().slice(-2);
      const { count } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('preschool_id', organizationId);
      
      const studentIdCode = `${orgCode}${year}${String((count || 0) + 1).padStart(4, '0')}`;

      // Create student with payment status from registration
      const { data: newStudent, error: studentError } = await supabase
        .from('students')
        .insert({
          first_name: studentFirstName?.trim(),
          last_name: studentLastName?.trim(),
          date_of_birth: registration.student_date_of_birth || registration.child_date_of_birth,
          grade: registration.student_grade || registration.child_grade,
          parent_id: parentUserId,
          guardian_id: parentUserId,
          preschool_id: organizationId,
          student_id: studentIdCode,
          emergency_contact_name: registration.emergency_contact_name,
          emergency_contact_phone: registration.emergency_contact_phone,
          emergency_contact_relation: registration.emergency_contact_relation,
          allergies: registration.student_allergies || registration.child_allergies,
          medical_conditions: registration.student_medical_conditions || registration.child_medical_conditions,
          is_active: true,
          status: 'active',
          enrollment_date: new Date().toISOString(),
          // Carry over payment status from registration so parent dashboard shows correct status
          registration_fee_amount: registration.registration_fee_amount || null,
          registration_fee_paid: registration.registration_fee_paid || false,
          payment_verified: registration.payment_verified || false,
          payment_date: registration.payment_date || null,
        })
        .select('id')
        .single();

      if (studentError) {
        console.error('[sync-registration] Error creating student:', studentError);
      } else {
        studentId = newStudent?.id;
        studentCreated = true;
        console.log('[sync-registration] Student created with payment status:', {
          registration_fee_paid: registration.registration_fee_paid,
          payment_verified: registration.payment_verified,
        });
      }
    }

    // Step 3: Create guardian-student relationship
    if (parentUserId && studentId) {
      await supabase
        .from('guardian_student')
        .upsert({
          parent_id: parentUserId,
          student_id: studentId,
          relationship: 'parent',
          is_primary: true,
        }, { onConflict: 'parent_id,student_id' });
    }

    // Step 4: Update registration with created IDs
    await supabase
      .from('registration_requests')
      .update({
        edudash_parent_id: parentUserId,
        edudash_student_id: studentId,
        synced_at: new Date().toISOString(),
      })
      .eq('id', registration_id);

    // Step 5: Send welcome email with login credentials (if new account)
    if (parentAccountCreated && generatedPassword && resendApiKey) {
      console.log('[sync-registration] Sending welcome email to:', parentEmail);
      
      // Get school name
      const { data: school } = await supabase
        .from('preschools')
        .select('name')
        .eq('id', organizationId)
        .single();
      
      const schoolName = school?.name || 'Young Eagles';
      const parentFullName = `${parentFirstName} ${parentLastName}`.trim();
      const childFullName = `${studentFirstName} ${studentLastName}`.trim();
      
      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .credentials { background: #fff; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .credentials h3 { color: #667eea; margin-top: 0; }
    .credentials p { margin: 10px 0; }
    .credentials .value { font-family: monospace; font-size: 16px; background: #f0f0f0; padding: 8px 12px; border-radius: 4px; display: inline-block; }
    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Welcome to EduDash Pro!</h1>
      <p>Your child's registration has been approved</p>
    </div>
    <div class="content">
      <p>Dear ${parentFullName},</p>
      
      <p>Great news! <strong>${childFullName}'s</strong> registration at <strong>${schoolName}</strong> has been approved.</p>
      
      <p>Your parent account has been created on the EduDash Pro platform. You can now access your child's information, view progress reports, and communicate with teachers.</p>
      
      <div class="credentials">
        <h3>🔐 Your Login Credentials</h3>
        <p><strong>Email:</strong><br><span class="value">${parentEmail}</span></p>
        <p><strong>Temporary Password:</strong><br><span class="value">${generatedPassword}</span></p>
      </div>
      
      <div class="warning">
        <strong>⚠️ Important Security Notice:</strong><br>
        Please change your password after your first login for security purposes. 
        Go to Settings → Change Password after logging in.
      </div>
      
      <p style="text-align: center;">
        <a href="https://edudashpro.org.za/sign-in" class="button">Login to EduDash Pro</a>
      </p>
      
      <p>Or download our mobile app:</p>
      <ul>
        <li><a href="https://play.google.com/store/apps/details?id=com.edudashproapp">Android (Google Play)</a></li>
        <li>iOS (Coming Soon)</li>
      </ul>
      
      <p>If you have any questions, please contact ${schoolName} directly.</p>
      
      <p>Best regards,<br>The EduDash Pro Team</p>
    </div>
    <div class="footer">
      <p>This email was sent because a registration was approved at ${schoolName}.</p>
      <p>© ${new Date().getFullYear()} EduDash Pro. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
      `;
      
      try {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [parentEmail],
            subject: `✅ Registration Approved - Welcome to ${schoolName}!`,
            html: emailHtml,
          }),
        });

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error('[sync-registration] Email send failed:', errorText);
        } else {
          console.log('[sync-registration] Welcome email sent successfully');
        }
      } catch (emailError) {
        console.error('[sync-registration] Error sending welcome email:', emailError);
        // Don't fail the whole operation if email fails
      }
    }

    // Step 6: Update EduSitePro if this was synced from there
    if (registration.edusite_id) {
      try {
        const edusiteUrl = Deno.env.get('EDUSITE_SUPABASE_URL');
        const edusiteServiceKey = Deno.env.get('EDUSITE_SUPABASE_SERVICE_ROLE_KEY');
        
        if (edusiteUrl && edusiteServiceKey) {
          const edusiteClient = createClient(edusiteUrl, edusiteServiceKey);
          
          await edusiteClient
            .from('registration_requests')
            .update({
              synced_to_edudash: true,
              synced_at: new Date().toISOString(),
              edudash_student_id: studentId,
              edudash_parent_id: parentUserId,
            })
            .eq('id', registration.edusite_id);
          
          console.log('[sync-registration] Updated EduSitePro with sync status');
        }
      } catch (edusiteError) {
        console.error('[sync-registration] Error updating EduSitePro:', edusiteError);
        // Don't fail - this is just for tracking
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: parentAccountCreated 
          ? 'Registration synced successfully. Welcome email sent with login credentials.' 
          : 'Registration synced successfully. Parent account already existed.',
        data: {
          parent_user_id: parentUserId,
          parent_account_created: parentAccountCreated,
          student_id: studentId,
          student_created: studentCreated,
          email_sent: parentAccountCreated && !!resendApiKey,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-registration] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
