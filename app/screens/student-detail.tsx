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
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

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
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  
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
  const isPrincipal = profile?.role === 'principal';

  const loadStudentData = async () => {
    if (!studentId || !user) return;

    try {
      setLoading(true);

      // Get user's preschool (profiles.id = auth_user_id)
      const { data: userProfile } = await assertSupabase()
        .from('profiles')
        .select('preschool_id, organization_id, role')
        .eq('id', user.id)
        .single();

      const schoolId = userProfile?.preschool_id || userProfile?.organization_id;
      if (!schoolId) {
        Alert.alert('Error', 'No school assigned to your account');
        return;
      }

      // Get student details with class info (simpler query - avoids nested FK issues)
      const { data: studentData, error: studentError } = await assertSupabase()
        .from('students')
        .select(`
          *,
          classes!left(id, name, grade_level, teacher_id)
        `)
        .eq('id', studentId)
        .eq('preschool_id', schoolId)
        .single();

      if (studentError) {
        console.error('Error loading student:', studentError);
        Alert.alert('Error', 'Student not found');
        router.back();
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
        .from('attendance_records')
        .select('status, date')
        .eq('student_id', studentId)
        .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('date', { ascending: false });

      const totalRecords = attendanceData?.length || 0;
      const presentRecords = attendanceData?.filter(a => a.status === 'present').length || 0;
      const attendanceRate = totalRecords > 0 ? (presentRecords / totalRecords) * 100 : 0;
      const lastAttendance = attendanceData?.[0]?.date;

      // Get financial data - summary for outstanding fees
      const { data: financialData } = await assertSupabase()
        .from('financial_transactions')
        .select('amount, status, type')
        .eq('student_id', studentId)
        .eq('type', 'fee_payment');

      const outstandingFees = financialData
        ?.filter(f => f.status === 'pending')
        ?.reduce((sum, f) => sum + f.amount, 0) || 0;

      // Get child-specific transaction history (last 10)
      const { data: transactionsData } = await assertSupabase()
        .from('financial_transactions')
        .select('*')
        .eq('student_id', studentId)
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
      if (userProfile.role === 'principal') {
        const { data: classesData } = await assertSupabase()
          .from('classes')
          .select(`
            id,
            name,
            grade_level,
            teacher_id,
            capacity
          `)
          .eq('preschool_id', userProfile.preschool_id)
          .eq('is_active', true);

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
          .eq('preschool_id', userProfile.preschool_id)
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
          capacity: cls.capacity || 25,
          current_enrollment: enrollmentMap[cls.id] || 0,
        }));

        setClasses(processedClasses);
      }

    } catch (error) {
      console.error('Error loading student data:', error);
      Alert.alert('Error', 'Failed to load student information');
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
        Alert.alert('Error', 'Failed to assign class');
        return;
      }

      Alert.alert('Success', 'Student successfully assigned to class');
      setShowClassAssignment(false);
      loadStudentData();
    } catch {
      Alert.alert('Error', 'Failed to assign class');
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
        Alert.alert('Error', 'Failed to save student details');
        return;
      }

      Alert.alert('Success', 'Student details updated successfully');
      setEditMode(false);
      setEditedStudent({});
      loadStudentData();
    } catch (error) {
      console.error('Error saving student:', error);
      Alert.alert('Error', 'Failed to save student details');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveStudent = async () => {
    if (!student) return;

    Alert.alert(
      'Remove Student',
      `Are you sure you want to remove ${student.first_name} ${student.last_name} from the school? This will deactivate their account and remove them from their class.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);

              // Call the deactivate_student function
              const { data, error } = await assertSupabase()
                .rpc('deactivate_student', {
                  student_uuid: student.id,
                  reason: 'Removed by principal - left school',
                });

              if (error) {
                console.error('Error deactivating student:', error);
                Alert.alert('Error', 'Failed to remove student. Please try again.');
                return;
              }

              Alert.alert(
                'Success',
                `${student.first_name} ${student.last_name} has been removed from the school.`,
                [
                  {
                    text: 'OK',
                    onPress: () => router.back(),
                  },
                ]
              );
            } catch (error) {
              console.error('Error removing student:', error);
              Alert.alert('Error', 'Failed to remove student. Please try again.');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
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
            {userProfile.role === 'principal' && (
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
