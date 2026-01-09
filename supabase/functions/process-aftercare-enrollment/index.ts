// Process Aftercare Enrollment
// Automatically creates student and parent accounts when aftercare registration is enrolled

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AftercareRegistration {
  id: string;
  preschool_id: string;
  parent_user_id: string | null;
  parent_email: string;
  parent_first_name: string;
  parent_last_name: string;
  parent_phone: string;
  child_first_name: string;
  child_last_name: string;
  child_grade: string;
  child_date_of_birth: string | null;
  child_allergies: string | null;
  child_medical_conditions: string | null;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relation: string;
  status: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { registration_id, registration_data } = await req.json();

    if (!registration_id && !registration_data) {
      return new Response(
        JSON.stringify({ error: 'registration_id or registration_data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch registration if only ID provided
    let registration: AftercareRegistration;
    if (registration_data) {
      registration = registration_data;
    } else {
      const { data, error } = await supabase
        .from('aftercare_registrations')
        .select('*')
        .eq('id', registration_id)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: 'Registration not found', details: error }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      registration = data;
    }

    // Only process if status is 'enrolled' or 'paid' (if auto-enroll)
    if (registration.status !== 'enrolled' && registration.status !== 'paid') {
      return new Response(
        JSON.stringify({ message: 'Registration status is not enrolled or paid, skipping account creation' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let parentUserId = registration.parent_user_id;
    let parentAccountCreated = false;

    // Step 1: Check if parent account exists
    if (!parentUserId) {
      // Check by email
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', registration.parent_email.toLowerCase())
        .maybeSingle();

      if (existingProfile) {
        parentUserId = existingProfile.id;
      } else {
        // Create parent account
        // Generate a random password (parent will need to reset it)
        const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12) + 'A1!';
        
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: registration.parent_email.toLowerCase(),
          password: tempPassword,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            first_name: registration.parent_first_name,
            last_name: registration.parent_last_name,
            phone: registration.parent_phone,
          },
        });

        if (authError || !authData.user) {
          console.error('Error creating parent account:', authError);
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

        // Create profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: parentUserId,
            email: registration.parent_email.toLowerCase(),
            first_name: registration.parent_first_name,
            last_name: registration.parent_last_name,
            phone: registration.parent_phone,
            role: 'parent',
            preschool_id: registration.preschool_id,
            organization_id: registration.preschool_id,
          });

        if (profileError) {
          console.error('Error creating parent profile:', profileError);
          // Continue anyway - profile might be created by trigger
        }
      }
    }

    // Step 2: Check if student already exists
    const { data: existingStudent } = await supabase
      .from('students')
      .select('id, parent_id')
      .eq('first_name', registration.child_first_name.trim())
      .eq('last_name', registration.child_last_name.trim())
      .eq('preschool_id', registration.preschool_id)
      .maybeSingle();

    let studentId: string;
    let studentCreated = false;

    if (existingStudent) {
      studentId = existingStudent.id;
      // Link to parent if not already linked
      if (existingStudent.parent_id !== parentUserId) {
        await supabase
          .from('students')
          .update({
            parent_id: parentUserId,
            guardian_id: parentUserId,
          })
          .eq('id', studentId);
      }
    } else {
      // Create student record
      const { data: newStudent, error: studentError } = await supabase
        .from('students')
        .insert({
          first_name: registration.child_first_name.trim(),
          last_name: registration.child_last_name.trim(),
          date_of_birth: registration.child_date_of_birth || null,
          grade: registration.child_grade,
          parent_id: parentUserId,
          guardian_id: parentUserId,
          preschool_id: registration.preschool_id,
          emergency_contact_name: registration.emergency_contact_name,
          emergency_contact_phone: registration.emergency_contact_phone,
          emergency_contact_relation: registration.emergency_contact_relation,
          allergies: registration.child_allergies || null,
          medical_conditions: registration.child_medical_conditions || null,
          is_active: true,
          status: 'active',
          enrollment_date: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (studentError || !newStudent) {
        console.error('Error creating student:', studentError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to create student record', 
            details: studentError?.message 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      studentId = newStudent.id;
      studentCreated = true;
    }

    // Step 3: Update registration with enrolled_at timestamp
    await supabase
      .from('aftercare_registrations')
      .update({
        enrolled_at: new Date().toISOString(),
        parent_user_id: parentUserId, // Ensure parent_user_id is set
      })
      .eq('id', registration.id);

    // Step 4: Send welcome email if parent account was created
    if (parentAccountCreated) {
      // TODO: Send welcome email with login credentials
      // For now, we'll just log it
      console.log(`Parent account created for ${registration.parent_email}. Welcome email should be sent.`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Enrollment processed successfully',
        data: {
          parent_user_id: parentUserId,
          parent_account_created: parentAccountCreated,
          student_id: studentId,
          student_created: studentCreated,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing enrollment:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
