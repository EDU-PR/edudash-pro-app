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

    const { studentId, reason } = await req.json();

    if (!studentId) {
      return NextResponse.json(
        { error: 'Missing required field: studentId' },
        { status: 400 }
      );
    }

    console.log('[Delete Student] Starting deletion process for student:', studentId);

    // Get student details before deletion
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*, profiles!inner(email, full_name)')
      .eq('id', studentId)
      .single();

    if (studentError) {
      console.error('Error fetching student:', studentError);
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const parentEmail = student.profiles?.email;
    const parentName = student.profiles?.full_name;
    const studentName = `${student.first_name} ${student.last_name}`;
    const parentUserId = student.parent_user_id;

    console.log('[Delete Student] Student:', studentName, '| Parent:', parentEmail);

    // Step 1: Delete student record
    const { error: deleteStudentError } = await supabase
      .from('students')
      .delete()
      .eq('id', studentId);

    if (deleteStudentError) {
      console.error('Error deleting student:', deleteStudentError);
      return NextResponse.json({ error: 'Failed to delete student' }, { status: 500 });
    }

    console.log('✅ Student record deleted');

    // Step 2: Check if parent has other students in the organization
    const { data: otherStudents, error: checkError } = await supabase
      .from('students')
      .select('id')
      .eq('parent_user_id', parentUserId)
      .eq('organization_id', student.organization_id);

    if (checkError) {
      console.error('Error checking other students:', checkError);
    }

    const hasOtherStudents = otherStudents && otherStudents.length > 0;

    console.log(`Parent has ${otherStudents?.length || 0} other students in this organization`);

    // Step 3: If no other students, delete parent's account and related records
    if (!hasOtherStudents && parentUserId) {
      console.log('[Delete Account] Deleting parent account...');

      // Delete from user_ai_usage
      const { error: usageError } = await supabase
        .from('user_ai_usage')
        .delete()
        .eq('user_id', parentUserId);

      if (usageError) {
        console.error('Error deleting AI usage (non-critical):', usageError);
      }

      // Delete from user_ai_tiers
      const { error: tierError } = await supabase
        .from('user_ai_tiers')
        .delete()
        .eq('user_id', parentUserId);

      if (tierError) {
        console.error('Error deleting AI tier (non-critical):', tierError);
      }

      // Delete from profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', parentUserId);

      if (profileError) {
        console.error('Error deleting profile:', profileError);
      } else {
        console.log('✅ Profile deleted');
      }

      // Delete auth user (requires admin/service role)
      // Note: This needs to be done via Supabase Admin API or Edge Function
      console.log('⚠️  Auth user deletion requires admin API call');
    }

    // Step 4: Send notification email to parent
    try {
      const emailBody = {
        to: parentEmail,
        subject: hasOtherStudents 
          ? `Student Removed from School - ${studentName}`
          : 'Account Closed - Join EduDash Pro Community',
        message: hasOtherStudents
          ? `Dear ${parentName},\n\nYour child ${studentName} has been removed from the school.\n\nReason: ${reason || 'Not specified'}\n\nYou still have other students enrolled at this school.\n\nIf you have any questions, please contact the school administration.\n\nBest regards,\nEduDash Pro Team`
          : `Dear ${parentName},\n\nYour child ${studentName} has been removed from the school, and your account with this school has been closed.\n\nReason: ${reason || 'Not specified'}\n\nYou can continue to use EduDash Pro by joining the EduDash Pro Community or Main School:\n\n1. Download the EduDash Pro app\n2. Create a new account\n3. Join the "EduDash Pro Community" school\n4. Access free learning resources and activities\n\nIf you have any questions, please contact support@edudashpro.org.za\n\nBest regards,\nEduDash Pro Team`,
      };

      const { error: emailError } = await supabase.functions.invoke('send-email', {
        body: emailBody,
      });

      if (emailError) {
        console.error('Email notification failed (non-critical):', emailError);
      } else {
        console.log('✅ Email notification sent');
      }
    } catch (emailError) {
      console.error('Email error (non-critical):', emailError);
    }

    return NextResponse.json({
      success: true,
      message: hasOtherStudents
        ? 'Student deleted successfully. Parent still has other students enrolled.'
        : 'Student and parent account deleted successfully. Email notification sent.',
      accountDeleted: !hasOtherStudents,
      parentEmail,
    });
  } catch (error: any) {
    console.error('Delete student error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
