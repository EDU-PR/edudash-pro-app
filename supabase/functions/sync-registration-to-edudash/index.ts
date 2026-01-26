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
  organization_id: string | null;
  preschool_id?: string | null;
  guardian_first_name: string | null;
  guardian_last_name: string | null;
  guardian_email: string | null;
  guardian_phone: string | null;
  parent_first_name?: string | null;
  parent_last_name?: string | null;
  parent_email?: string | null;
  parent_phone?: string | null;
  student_first_name: string | null;
  student_last_name: string | null;
  student_date_of_birth: string | null;
  student_grade: string | null;
  student_allergies: string | null;
  student_medical_conditions: string | null;
  child_first_name?: string | null;
  child_last_name?: string | null;
  child_date_of_birth?: string | null;
  child_grade?: string | null;
  child_allergies?: string | null;
  child_medical_conditions?: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  registration_fee_amount?: number | string | null;
  registration_fee_paid?: boolean | null;
  payment_verified?: boolean | null;
  payment_date?: string | null;
  status: string;
  edusite_id?: string | null;
  edudash_student_id?: string | null;
  edudash_parent_id?: string | null;
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

const STUDENT_ID_SEQUENCE_LENGTH = 4;
const STUDENT_ID_MAX_ATTEMPTS = 6;

interface PostgrestErrorLike {
  code?: string;
  message?: string;
  details?: string;
}

interface ProfileLinkResult {
  linked: boolean;
  organizationId?: string;
  error?: string;
}

interface ProfileLinkRow {
  id: string;
  organization_id: string | null;
  preschool_id: string | null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeOrgCode(value: string | null | undefined): string {
  const cleaned = (value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
  if (cleaned.length >= 3) return cleaned.slice(0, 3);
  if (cleaned.length > 0) return cleaned.padEnd(3, 'X');
  return 'STU';
}

async function getLastStudentSequence(
  supabase: ReturnType<typeof createClient>,
  prefix: string
): Promise<number> {
  const { data: lastStudent } = await supabase
    .from('students')
    .select('student_id')
    .like('student_id', `${prefix}%`)
    .order('student_id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastStudent?.student_id) {
    const match = lastStudent.student_id.match(
      new RegExp(`^${escapeRegExp(prefix)}(\\d{${STUDENT_ID_SEQUENCE_LENGTH}})$`)
    );
    if (match?.[1]) {
      const parsed = Number.parseInt(match[1], 10);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  const { count } = await supabase
    .from('students')
    .select('id', { count: 'exact', head: true })
    .like('student_id', `${prefix}%`);

  return count ?? 0;
}

function isDuplicateStudentIdError(error: PostgrestErrorLike | null): boolean {
  if (!error) return false;
  if (error.code != '23505') return false;
  return (error.message || error.details || '').includes('students_student_id_key');
}

async function ensureParentProfileLinked(
  supabase: ReturnType<typeof createClient>,
  parentId: string,
  organizationId: string
): Promise<ProfileLinkResult> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        organization_id: organizationId,
        preschool_id: organizationId,
        role: 'parent',
        updated_at: new Date().toISOString(),
      })
      .eq('id', parentId)
      .select('id, organization_id, preschool_id')
      .maybeSingle();

    if (error) {
      console.error('[sync-registration] Parent profile link update failed:', error);
      return { linked: false, organizationId, error: error.message };
    }

    const linkedProfile = data as ProfileLinkRow | null;
    const linked =
      !!linkedProfile?.organization_id &&
      linkedProfile.organization_id === organizationId &&
      linkedProfile.preschool_id === organizationId;

    return { linked, organizationId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[sync-registration] Parent profile link exception:', message);
    return { linked: false, organizationId, error: message };
  }
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
    const { data: registrationData, error: fetchError } = await supabase
      .from('registration_requests')
      .select('*')
      .eq('id', registration_id)
      .single();

    const registration = registrationData as RegistrationRequest | null;

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

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'Organization ID is required' }),
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

    // Ensure parent profile is linked to the correct organization (even if it already existed)
    let parentProfileLinked = false;
    if (parentUserId) {
      const linkResult = await ensureParentProfileLinked(supabase, parentUserId, organizationId);
      parentProfileLinked = linkResult.linked;
      if (!parentProfileLinked) {
        console.warn('[sync-registration] Parent profile not fully linked:', linkResult);
      }
    }

    // Step 2: Create student record
    const studentFirstName = registration.student_first_name || registration.child_first_name;
    const studentLastName = registration.student_last_name || registration.child_last_name;
    const trimmedFirstName = studentFirstName?.trim() || studentFirstName || '';
    const trimmedLastName = studentLastName?.trim() || studentLastName || '';
    
    // Check if student already exists
    let studentId: string | null = null;
    let studentCreated = false;

    // Prefer explicit student ID from registration if available
    if (registration.edudash_student_id) {
      const { data: studentById } = await supabase
        .from('students')
        .select('id')
        .eq('id', registration.edudash_student_id)
        .maybeSingle();
      
      if (studentById?.id) {
        studentId = studentById.id;
      }
    }

    // Fallback: find existing student by name within the preschool
    if (!studentId) {
      const { data: existingStudent } = await supabase
        .from('students')
        .select('id')
        .ilike('first_name', `${trimmedFirstName}%`)
        .ilike('last_name', `${trimmedLastName}%`)
        .eq('preschool_id', organizationId)
        .maybeSingle();

      if (existingStudent?.id) {
        studentId = existingStudent.id;
      }
    }

    if (studentId) {
      // Update parent link and payment status from registration
      const studentUpdate: Record<string, unknown> = {
        // Also update payment status from registration
        registration_fee_amount: registration.registration_fee_amount || null,
        registration_fee_paid: registration.registration_fee_paid || false,
        payment_verified: registration.payment_verified || false,
        payment_date: registration.payment_date || null,
      };
      if (parentUserId) {
        studentUpdate.parent_id = parentUserId;
        studentUpdate.guardian_id = parentUserId;
      }

      await supabase
        .from('students')
        .update(studentUpdate)
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

      const orgCode = normalizeOrgCode(org?.name);
      const year = new Date().getFullYear().toString().slice(-2);
      const prefix = `${orgCode}${year}`;
      const lastSequence = await getLastStudentSequence(supabase, prefix);
      let studentError: PostgrestErrorLike | null = null;

      for (let attempt = 1; attempt <= STUDENT_ID_MAX_ATTEMPTS; attempt += 1) {
        const studentIdCode = `${prefix}${String(lastSequence + attempt).padStart(
          STUDENT_ID_SEQUENCE_LENGTH,
          '0'
        )}`;

        const { data: newStudent, error } = await supabase
          .from('students')
          .insert({
            first_name: trimmedFirstName,
            last_name: trimmedLastName,
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

        if (!error) {
          studentId = newStudent?.id;
          studentCreated = true;
          studentError = null;
          break;
        }

        const typedError = error as PostgrestErrorLike | null;
        if (!isDuplicateStudentIdError(typedError)) {
          studentError = typedError;
          break;
        }
      }

      if (studentError) {
        console.error('[sync-registration] Error creating student:', studentError);
      } else if (studentCreated) {
        console.log('[sync-registration] Student created with payment status:', {
          registration_fee_paid: registration.registration_fee_paid,
          payment_verified: registration.payment_verified,
        });
      }
    }

    // Step 3: Create guardian-student relationship
    if (parentUserId && studentId) {
      await supabase
        .from('student_parent_relationships')
        .upsert({
          parent_id: parentUserId,
          student_id: studentId,
          relationship_type: 'parent',
          is_primary: true,
        }, { onConflict: 'parent_id,student_id' });
    }

    // Step 4: Update registration with created IDs
    const regUpdate: Record<string, unknown> = {
      edudash_student_id: studentId,
      synced_at: new Date().toISOString(),
    };

    if (parentUserId) {
      regUpdate.edudash_parent_id = parentUserId;
    }

    await supabase
      .from('registration_requests')
      .update(regUpdate)
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
          parent_profile_linked: parentProfileLinked,
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
