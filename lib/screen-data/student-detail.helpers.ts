/**
 * Business logic helpers for student-detail screen.
 * Extracted to keep screen under 500 non-SS lines.
 */

import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import {
  StudentDetail,
  StudentFee,
  Class,
  Transaction,
  calculateAge,
} from '@/components/student-detail';

const TAG = 'StudentDetail';

interface FetchStudentParams {
  studentId: string;
  userId: string;
  profileId?: string;
  preschoolId?: string;
  organizationId?: string;
  isParent: boolean;
  canAssignClass: boolean;
  canViewFinancial: boolean;
  profileRole?: string;
}

interface FetchStudentResult {
  student: StudentDetail;
  classes: Class[];
  transactions: Transaction[];
}

/** Fetch all student data, class list, and transactions in one call. */
export async function fetchStudentData(params: FetchStudentParams): Promise<FetchStudentResult> {
  const { studentId, userId, profileId, isParent, canAssignClass, canViewFinancial, profileRole } = params;
  const supabase = assertSupabase();

  // Get user's preschool by auth_user_id (NOT profiles.id!)
  const { data: userProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id, preschool_id, organization_id, role')
    .or(`auth_user_id.eq.${userId},id.eq.${userId}`)
    .maybeSingle();

  if (profileError) {
    logger.error(TAG, 'Error loading profile:', profileError);
  }

  const schoolId =
    userProfile?.preschool_id ||
    userProfile?.organization_id ||
    params.preschoolId ||
    params.organizationId;

  if (!schoolId) {
    throw new Error('No school assigned to your account');
  }

  const viewerProfileId = userProfile?.id || profileId || userId;

  // Get student details with class info
  let studentQuery = supabase
    .from('students')
    .select('*, classes!students_class_id_fkey(id, name, grade_level, teacher_id)')
    .eq('id', studentId);

  // Parent safeguard: only allow viewing linked children
  if (isParent) {
    const parentFilterIds = Array.from(new Set([viewerProfileId, userId].filter(Boolean)));
    if (parentFilterIds.length > 0) {
      const parentFilters = parentFilterIds.flatMap((id) => [`parent_id.eq.${id}`, `guardian_id.eq.${id}`]);
      studentQuery = studentQuery.or(parentFilters.join(','));
    }
  } else {
    studentQuery = studentQuery.or(`preschool_id.eq.${schoolId},organization_id.eq.${schoolId}`);
  }

  const { data: studentData, error: studentError } = await studentQuery.single();

  if (studentError || !studentData) {
    const msg = isParent
      ? 'You can only view your linked child profiles.'
      : 'Student not found';
    throw new Error(msg);
  }

  // Fetch teacher info if class has teacher
  let teacherName: string | undefined;
  if (studentData.classes?.teacher_id) {
    const { data: teacherData } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .or(`id.eq.${studentData.classes.teacher_id},auth_user_id.eq.${studentData.classes.teacher_id}`)
      .single();
    if (teacherData) {
      teacherName = `${teacherData.first_name || ''} ${teacherData.last_name || ''}`.trim();
    }
  }

  // Fetch parent/guardian contact info
  const contactIds = Array.from(new Set([studentData.parent_id, studentData.guardian_id].filter(Boolean)));
  const contactMap: Record<string, { name?: string; email?: string; phone?: string }> = {};

  if (contactIds.length > 0) {
    const { data: contactProfilesById } = await supabase
      .from('profiles')
      .select('id, auth_user_id, first_name, last_name, email, phone')
      .in('id', contactIds);

    (contactProfilesById || []).forEach((cp) => {
      const normalized = {
        name: `${cp.first_name || ''} ${cp.last_name || ''}`.trim(),
        email: cp.email || undefined,
        phone: cp.phone || undefined,
      };
      contactMap[cp.id] = normalized;
      if (cp.auth_user_id) contactMap[cp.auth_user_id] = normalized;
    });

    const unresolvedIds = contactIds.filter((id) => !contactMap[id]);
    if (unresolvedIds.length > 0) {
      const { data: contactProfilesByAuth } = await supabase
        .from('profiles')
        .select('id, auth_user_id, first_name, last_name, email, phone')
        .in('auth_user_id', unresolvedIds);

      (contactProfilesByAuth || []).forEach((cp) => {
        const normalized = {
          name: `${cp.first_name || ''} ${cp.last_name || ''}`.trim(),
          email: cp.email || undefined,
          phone: cp.phone || undefined,
        };
        contactMap[cp.id] = normalized;
        if (cp.auth_user_id) contactMap[cp.auth_user_id] = normalized;
      });
    }
  }

  const parentInfo = studentData.parent_id ? contactMap[studentData.parent_id] || {} : {};
  const guardianInfo = studentData.guardian_id ? contactMap[studentData.guardian_id] || {} : {};

  // Fetch age group info
  let ageGroupName: string | undefined;
  if (studentData.age_group_id) {
    const { data: ageGroupData } = await supabase
      .from('age_groups')
      .select('name')
      .eq('id', studentData.age_group_id)
      .single();
    ageGroupName = ageGroupData?.name;
  }

  // Calculate age
  const ageInfo = calculateAge(studentData.date_of_birth);

  // Attendance data (last 30 days)
  const { data: attendanceData } = await supabase
    .from('attendance')
    .select('status, attendance_date')
    .eq('student_id', studentId)
    .gte('attendance_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('attendance_date', { ascending: false });

  const totalRecords = attendanceData?.length || 0;
  const presentRecords = attendanceData?.filter((a) => a.status === 'present').length || 0;
  const attendanceRate = totalRecords > 0 ? (presentRecords / totalRecords) * 100 : 0;
  const lastAttendance = attendanceData?.[0]?.attendance_date;

  // Financial data
  let outstandingFees = 0;
  let transactions: Transaction[] = [];
  let studentFees: StudentFee[] = [];
  let feeTierName: string | undefined;
  let monthlyFeeAmount: number | undefined;
  let feeStructureId: string | undefined;

  if (canViewFinancial || isParent) {
    // Detailed fees with fee structure info
    const { data: feeData, error: feeError } = await supabase
      .from('student_fees')
      .select('id, fee_structure_id, amount, final_amount, amount_paid, amount_outstanding, status, billing_month, due_date, category_code, fee_structures(name)')
      .eq('student_id', studentId)
      .order('billing_month', { ascending: false });

    if (feeError) {
      logger.error(TAG, 'Error loading student fees:', feeError);
    }

    studentFees = (feeData || []).map((f: any) => ({
      id: f.id,
      fee_structure_id: f.fee_structure_id,
      fee_name: f.fee_structures?.name || 'Monthly Fee',
      amount: f.amount ?? 0,
      final_amount: f.final_amount ?? f.amount ?? 0,
      amount_paid: f.amount_paid ?? 0,
      amount_outstanding: f.amount_outstanding ?? 0,
      status: f.status || 'pending',
      billing_month: f.billing_month || f.due_date || '',
      due_date: f.due_date || f.billing_month || '',
      category_code: f.category_code || 'tuition',
    }));

    outstandingFees = studentFees.reduce((sum, fee) => sum + (fee.amount_outstanding ?? 0), 0);

    // Get current fee tier from most recent tuition fee
    const latestTuition = studentFees.find(f => f.category_code === 'tuition');
    if (latestTuition) {
      feeTierName = latestTuition.fee_name;
      monthlyFeeAmount = latestTuition.amount;
      feeStructureId = latestTuition.fee_structure_id;
    }

    if (canViewFinancial) {
      const { data: txData } = await supabase
        .from('financial_transactions')
        .select('*')
        .eq('student_id', studentId)
        .eq('preschool_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(10);

      transactions = txData || [];
    }
  }

  // Build processed student
  const student: StudentDetail = {
    ...studentData,
    age_months: ageInfo.months,
    age_years: ageInfo.years,
    status: studentData.status || (studentData.is_active ? 'active' : 'inactive') || 'active',
    class_name: studentData.classes?.name,
    teacher_name: teacherName,
    parent_name: parentInfo.name,
    parent_email: parentInfo.email,
    parent_phone: parentInfo.phone,
    guardian_name: guardianInfo.name,
    guardian_email: guardianInfo.email,
    guardian_phone: guardianInfo.phone,
    profile_photo: studentData.avatar_url || studentData.profile_photo,
    age_group_name: ageGroupName,
    fee_tier_name: feeTierName,
    monthly_fee_amount: monthlyFeeAmount,
    fee_structure_id: feeStructureId,
    student_fees: studentFees,
    attendance_rate: attendanceRate,
    last_attendance: lastAttendance,
    outstanding_fees: outstandingFees,
    payment_status: outstandingFees > 0 ? 'overdue' : 'current',
  };

  // Load available classes for assignment
  let classes: Class[] = [];
  if (canAssignClass || ['principal', 'principal_admin', 'admin'].includes(userProfile?.role || profileRole || '')) {
    const { data: classesData } = await supabase
      .from('classes')
      .select('id, name, grade_level, teacher_id, max_capacity')
      .or(`preschool_id.eq.${schoolId},organization_id.eq.${schoolId}`)
      .eq('active', true);

    const teacherIds = [...new Set((classesData || []).map((c) => c.teacher_id).filter(Boolean))];
    let teacherMap: Record<string, string> = {};

    if (teacherIds.length > 0) {
      const { data: teachersData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', teacherIds);

      teacherMap = (teachersData || []).reduce((acc, t) => {
        acc[t.id] = `${t.first_name} ${t.last_name}`;
        return acc;
      }, {} as Record<string, string>);
    }

    const { data: enrollmentData } = await supabase
      .from('students')
      .select('class_id')
      .eq('preschool_id', schoolId)
      .eq('is_active', true);

    const enrollmentMap = (enrollmentData || []).reduce((acc, s) => {
      if (s.class_id) acc[s.class_id] = (acc[s.class_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    classes = (classesData || []).map((cls) => ({
      id: cls.id,
      name: cls.name,
      grade_level: cls.grade_level,
      teacher_id: cls.teacher_id || null,
      teacher_name: cls.teacher_id ? teacherMap[cls.teacher_id] : undefined,
      capacity: cls.max_capacity || 25,
      current_enrollment: enrollmentMap[cls.id] || 0,
    }));
  }

  return { student, classes, transactions };
}

/** Record a manual payment for a student (Principal only). */
export async function markPaymentReceived(
  studentId: string,
  userId: string,
  amount: number,
  paymentMethod: string,
  notes: string,
): Promise<void> {
  const supabase = assertSupabase();

  const { data: userProfile } = await supabase
    .from('profiles')
    .select('preschool_id, organization_id')
    .eq('auth_user_id', userId)
    .single();

  const schoolId = userProfile?.preschool_id || userProfile?.organization_id;
  if (!schoolId) throw new Error('No school assigned');

  const { error: txError } = await supabase
    .from('financial_transactions')
    .insert({
      student_id: studentId,
      preschool_id: schoolId,
      type: 'fee_payment',
      amount,
      status: 'completed',
      payment_method: paymentMethod,
      description: notes
        ? `Manual payment recorded by principal: ${notes}`
        : 'Manual payment recorded by principal',
      created_by: userId,
      created_at: new Date().toISOString(),
    });

  if (txError) {
    logger.error(TAG, 'Error recording payment:', txError);
    throw txError;
  }

  // Update pending parent_payments for this student
  await supabase
    .from('parent_payments')
    .update({
      status: 'verified',
      verified_by: userId,
      verified_at: new Date().toISOString(),
      notes: `Marked as paid by principal (${paymentMethod}): ${notes || 'No additional notes'}`,
    })
    .eq('student_id', studentId)
    .eq('status', 'pending');
}
