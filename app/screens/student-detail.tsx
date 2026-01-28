/**
 * Individual Student Detail Screen
 * 
 * Features:
 * - View comprehensive student information
 * - Assign/change student class (Principal functionality)
 * - Update student details
 * - View attendance and academic records
 * - Contact parent/guardian
 * - Financial records and fee management
 * 
 * Refactored to use shared components from components/student-detail/
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { AlertModal, type AlertButton } from '@/components/ui/AlertModal';

// Shared components
import {
  StudentDetail,
  Class,
  Transaction,
  calculateAge,
  ProfileCard,
  ClassInfoSection,
  AcademicPerformanceSection,
  ParentContactSection,
  ProgressReportsSection,
  FinancialStatusSection,
  MedicalInfoSection,
  ClassAssignmentModal,
} from '@/components/student-detail';

export default function StudentDetailScreen() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ studentId?: string; id?: string }>();
  const studentId = params.studentId || params.id;

  interface AlertState {
    visible: boolean;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'success' | 'error';
    buttons: AlertButton[];
  }

  const [alertState, setAlertState] = useState<AlertState>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    buttons: [],
  });

  const showAlert = (
    title: string,
    message: string,
    type: AlertState['type'] = 'info',
    buttons: AlertButton[] = [{ text: 'OK', style: 'default' }],
  ) => {
    setAlertState({ visible: true, title, message, type, buttons });
  };

  const hideAlert = () => {
    setAlertState(prev => ({ ...prev, visible: false }));
  };
  
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showClassAssignment, setShowClassAssignment] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  
  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editedStudent, setEditedStudent] = useState<Partial<StudentDetail>>({});
  const [saving, setSaving] = useState(false);
  
  // Financial details state
  const [showFinancialDetails, setShowFinancialDetails] = useState(false);
  const [childTransactions, setChildTransactions] = useState<Transaction[]>([]);
  
  // Role-based checks
  const isPrincipal = ['principal', 'principal_admin', 'admin'].includes(profile?.role || '');

  const loadStudentData = async () => {
    if (!studentId || !user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Get user's preschool by auth_user_id (NOT profiles.id!)
      const { data: userProfile, error: profileError } = await assertSupabase()
        .from('profiles')
        .select('id, preschool_id, organization_id, role')
        .or(`auth_user_id.eq.${user.id},id.eq.${user.id}`)
        .maybeSingle();

      if (profileError) {
        console.error('Error loading profile:', profileError);
      }

      const schoolId =
        userProfile?.preschool_id ||
        userProfile?.organization_id ||
        profile?.preschool_id ||
        profile?.organization_id;
      if (!schoolId) {
        showAlert('Error', 'No school assigned to your account', 'error');
        setLoading(false);
        return;
      }

      // Get student details with class info (simpler query - avoids nested FK issues)
      const { data: studentData, error: studentError } = await assertSupabase()
        .from('students')
        .select(`
          *,
          classes!students_class_id_fkey(id, name, grade_level, teacher_id)
        `)
        .eq('id', studentId)
        .eq('preschool_id', schoolId)
        .single();

      if (studentError) {
        console.error('Error loading student:', studentError);
        showAlert('Error', 'Student not found', 'error', [
          { text: 'OK', style: 'default', onPress: () => router.back() },
        ]);
        setLoading(false);
        return;
      }

      // Fetch teacher info separately if class has teacher
      let teacherName: string | undefined;
      if (studentData.classes?.teacher_id) {
        const { data: teacherData } = await assertSupabase()
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', studentData.classes.teacher_id)
          .single();
        if (teacherData) {
          teacherName = `${teacherData.first_name || ''} ${teacherData.last_name || ''}`.trim();
        }
      }

      // Fetch parent info separately if student has parent_id
      let parentInfo: { name?: string; email?: string } = {};
      if (studentData.parent_id) {
        const { data: parentData } = await assertSupabase()
          .from('profiles')
          .select('first_name, last_name, email')
          .eq('id', studentData.parent_id)
          .single();
        if (parentData) {
          parentInfo = {
            name: `${parentData.first_name || ''} ${parentData.last_name || ''}`.trim(),
            email: parentData.email,
          };
        }
      }

      // Fetch age group info if student has age_group_id
      let ageGroupName: string | undefined;
      if (studentData.age_group_id) {
        const { data: ageGroupData } = await assertSupabase()
          .from('age_groups')
          .select('name')
          .eq('id', studentData.age_group_id)
          .single();
        ageGroupName = ageGroupData?.name;
      }

      // Calculate age information
      const ageInfo = calculateAge(studentData.date_of_birth);
      
      // Get attendance data
      const { data: attendanceData } = await assertSupabase()
        .from('attendance')
        .select('status, attendance_date')
        .eq('student_id', studentId)
        .gte('attendance_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('attendance_date', { ascending: false });

      const totalRecords = attendanceData?.length || 0;
      const presentRecords = attendanceData?.filter(a => a.status === 'present').length || 0;
      const attendanceRate = totalRecords > 0 ? (presentRecords / totalRecords) * 100 : 0;
      const lastAttendance = attendanceData?.[0]?.attendance_date;

      // Get financial data - outstanding fees from student_fees (source of truth)
      const { data: feeData, error: feeError } = await assertSupabase()
        .from('student_fees')
        .select('amount_outstanding, status, final_amount')
        .eq('student_id', studentId);

      if (feeError) {
        console.error('Error loading student fees:', feeError);
      }

      const outstandingFees = (feeData || []).reduce((sum, fee) => {
        const outstanding = fee.amount_outstanding ?? 0;
        return sum + outstanding;
      }, 0);

      // Get child-specific transaction history (last 10)
      const { data: transactionsData } = await assertSupabase()
        .from('financial_transactions')
        .select('*')
        .eq('student_id', studentId)
        .eq('preschool_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(10);

      setChildTransactions(transactionsData || []);

      const processedStudent: StudentDetail = {
        ...studentData,
        age_months: ageInfo.months,
        age_years: ageInfo.years,
        class_name: studentData.classes?.name,
        teacher_name: teacherName,
        parent_name: parentInfo.name,
        parent_email: parentInfo.email,
        parent_phone: undefined,
        age_group_name: ageGroupName,
        attendance_rate: attendanceRate,
        last_attendance: lastAttendance,
        outstanding_fees: outstandingFees,
        payment_status: outstandingFees > 0 ? 'overdue' : 'current',
      };

      setStudent(processedStudent);

      // Load available classes for assignment (Principal only)
      if (['principal', 'principal_admin', 'admin'].includes(userProfile?.role || profile?.role || '')) {
        const { data: classesData } = await assertSupabase()
          .from('classes')
          .select(`
            id,
            name,
            grade_level,
            teacher_id,
            max_capacity
          `)
          .eq('preschool_id', schoolId)
          .eq('active', true);

        // Get teacher names for each class
        const teacherIds = [...new Set((classesData || []).map(c => c.teacher_id).filter(Boolean))];
        let teacherMap: Record<string, string> = {};
        
        if (teacherIds.length > 0) {
          const { data: teachersData } = await assertSupabase()
            .from('profiles')
            .select('id, first_name, last_name')
            .in('id', teacherIds);
          
          teacherMap = (teachersData || []).reduce((acc, t) => {
            acc[t.id] = `${t.first_name} ${t.last_name}`;
            return acc;
          }, {} as Record<string, string>);
        }

        // Get enrollment counts
        const { data: enrollmentData } = await assertSupabase()
          .from('students')
          .select('class_id')
          .eq('preschool_id', schoolId)
          .eq('is_active', true);
        
        const enrollmentMap = (enrollmentData || []).reduce((acc, s) => {
          if (s.class_id) {
            acc[s.class_id] = (acc[s.class_id] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);

        const processedClasses = (classesData || []).map(cls => ({
          id: cls.id,
          name: cls.name,
          grade_level: cls.grade_level,
          teacher_id: cls.teacher_id || null,
          teacher_name: cls.teacher_id ? teacherMap[cls.teacher_id] : undefined,
          capacity: cls.max_capacity || 25,
          current_enrollment: enrollmentMap[cls.id] || 0,
        }));

        setClasses(processedClasses);
      }

    } catch (error) {
      console.error('Error loading student data:', error);
      showAlert('Error', 'Failed to load student information', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAssignClass = async () => {
    if (!selectedClassId || !student) return;

    try {
      const { error } = await assertSupabase()
        .from('students')
        .update({ class_id: selectedClassId })
        .eq('id', student.id);

      if (error) {
        showAlert('Error', 'Failed to assign class', 'error');
        return;
      }

      showAlert('Success', 'Student successfully assigned to class', 'success');
      setShowClassAssignment(false);
      loadStudentData();
    } catch {
      showAlert('Error', 'Failed to assign class', 'error');
    }
  };

  const handleEditToggle = () => {
    if (editMode) {
      setEditMode(false);
      setEditedStudent({});
    } else {
      setEditMode(true);
      setEditedStudent({
        first_name: student?.first_name,
        last_name: student?.last_name,
        medical_conditions: student?.medical_conditions,
        allergies: student?.allergies,
        emergency_contact: student?.emergency_contact,
        emergency_phone: student?.emergency_phone,
      });
    }
  };

  const handleSave = async () => {
    if (!student || !editedStudent) return;

    try {
      setSaving(true);

      const { error } = await assertSupabase()
        .from('students')
        .update({
          first_name: editedStudent.first_name,
          last_name: editedStudent.last_name,
          medical_conditions: editedStudent.medical_conditions,
          allergies: editedStudent.allergies,
          emergency_contact: editedStudent.emergency_contact,
          emergency_phone: editedStudent.emergency_phone,
        })
        .eq('id', student.id);

      if (error) {
        showAlert('Error', 'Failed to save student details', 'error');
        return;
      }

      showAlert('Success', 'Student details updated successfully', 'success');
      setEditMode(false);
      setEditedStudent({});
      loadStudentData();
    } catch (error) {
      console.error('Error saving student:', error);
      showAlert('Error', 'Failed to save student details', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveStudent = async () => {
    if (!student) return;

    showAlert(
      'Remove Student',
      `Are you sure you want to remove ${student.first_name} ${student.last_name} from the school? This will deactivate their account and remove them from their class.`,
      'warning',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);

              // Call the deactivate_student function
              const { error } = await assertSupabase()
                .rpc('deactivate_student', {
                  student_uuid: student.id,
                  reason: 'Removed by principal - left school',
                });

              if (error) {
                console.warn('RPC deactivate_student failed, falling back to direct update:', error);
                const { error: updateError } = await assertSupabase()
                  .from('students')
                  .update({
                    is_active: false,
                    status: 'inactive',
                    class_id: null,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', student.id);

                if (updateError) {
                  console.error('Error deactivating student (fallback):', updateError);
                  showAlert('Error', 'Failed to remove student. Please try again.', 'error');
                  return;
                }
              }

              showAlert(
                'Success',
                `${student.first_name} ${student.last_name} has been removed from the school.`,
                'success',
                [
                  {
                    text: 'OK',
                    style: 'default',
                    onPress: () => router.back(),
                  },
                ]
              );
            } catch (error) {
              console.error('Error removing student:', error);
              showAlert('Error', 'Failed to remove student. Please try again.', 'error');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  // Handle marking a payment as received (Principal only)
  const handleMarkPaymentReceived = async (amount: number, paymentMethod: string, notes: string) => {
    if (!student || !user || !isPrincipal) {
      throw new Error('Unauthorized or missing data');
    }

    // Get user's preschool by auth_user_id
    const { data: userProfile } = await assertSupabase()
      .from('profiles')
      .select('preschool_id, organization_id')
      .eq('auth_user_id', user.id)
      .single();

    const schoolId = userProfile?.preschool_id || userProfile?.organization_id;
    if (!schoolId) {
      throw new Error('No school assigned');
    }

    // Create a financial transaction record
    const { error: transactionError } = await assertSupabase()
      .from('financial_transactions')
      .insert({
        student_id: student.id,
        preschool_id: schoolId,
        type: 'fee_payment',
        amount: amount,
        status: 'completed',
        payment_method: paymentMethod,
        notes: notes ? `Manual payment recorded by principal: ${notes}` : 'Manual payment recorded by principal',
        recorded_by: user.id,
        created_at: new Date().toISOString(),
      });

    if (transactionError) {
      console.error('Error recording payment:', transactionError);
      throw transactionError;
    }

    // Update any pending parent_payments records for this student if they exist
    await assertSupabase()
      .from('parent_payments')
      .update({ 
        status: 'verified',
        verified_by: user.id,
        verified_at: new Date().toISOString(),
        notes: `Marked as paid by principal (${paymentMethod}): ${notes || 'No additional notes'}`
      })
      .eq('student_id', student.id)
      .eq('status', 'pending');

    // Reload the student data to reflect changes
    await loadStudentData();
  };

  useEffect(() => {
    loadStudentData();
  }, [studentId, user]);

  const onRefresh = () => {
    setRefreshing(true);
    loadStudentData();
  };

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Loading state
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Ionicons name="person-outline" size={48} color={theme.textSecondary} />
          <Text style={styles.loadingText}>Loading student details...</Text>
        </View>
        <AlertModal
          visible={alertState.visible}
          title={alertState.title}
          message={alertState.message}
          type={alertState.type}
          buttons={alertState.buttons}
          onClose={hideAlert}
        />
      </SafeAreaView>
    );
  }

  // Error state
  if (!student) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="person-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>Student not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
        <AlertModal
          visible={alertState.visible}
          title={alertState.title}
          message={alertState.message}
          type={alertState.type}
          buttons={alertState.buttons}
          onClose={hideAlert}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Student Details</Text>
        {editMode ? (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={handleEditToggle} disabled={saving}>
              <Ionicons name="close" size={24} color={theme.error} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              <Ionicons name="checkmark" size={24} color={theme.success} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <TouchableOpacity onPress={handleEditToggle}>
              <Ionicons name="create" size={24} color={theme.primary} />
            </TouchableOpacity>
            {isPrincipal && (
              <TouchableOpacity onPress={handleRemoveStudent} disabled={saving}>
                <Ionicons name="person-remove-outline" size={24} color={theme.error} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Profile Card */}
        <ProfileCard
          student={student}
          theme={theme}
          editMode={editMode}
          editedStudent={editedStudent}
          onEditChange={setEditedStudent}
        />

        {/* Class Information */}
        <ClassInfoSection
          student={student}
          classes={classes}
          theme={theme}
          onAssignClass={() => setShowClassAssignment(true)}
        />

        {/* Academic Performance */}
        <AcademicPerformanceSection
          student={student}
          theme={theme}
        />

        {/* Parent/Guardian Contact */}
        <ParentContactSection
          student={student}
          theme={theme}
        />

        {/* Progress Reports */}
        <ProgressReportsSection
          student={student}
          isPrincipal={isPrincipal}
          theme={theme}
        />

        {/* Financial Status */}
        <FinancialStatusSection
          student={student}
          transactions={childTransactions}
          showDetails={showFinancialDetails}
          onToggleDetails={() => setShowFinancialDetails(!showFinancialDetails)}
          theme={theme}
          isPrincipal={isPrincipal}
          onMarkPaymentReceived={handleMarkPaymentReceived}
        />

        {/* Medical & Emergency Information */}
        <MedicalInfoSection
          student={student}
          theme={theme}
          editMode={editMode}
          editedStudent={editedStudent}
          onEditChange={setEditedStudent}
        />
      </ScrollView>

      {/* Class Assignment Modal */}
      <ClassAssignmentModal
        visible={showClassAssignment}
        student={student}
        classes={classes}
        selectedClassId={selectedClassId}
        onSelectClass={setSelectedClassId}
        onSave={handleAssignClass}
        onClose={() => setShowClassAssignment(false)}
        theme={theme}
      />

      <AlertModal
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
        buttons={alertState.buttons}
        onClose={hideAlert}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: theme.error,
    marginTop: 16,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: theme.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.text,
  },
  scrollView: {
    flex: 1,
  },
});
