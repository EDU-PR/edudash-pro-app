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

      // Get user's preschool
      const { data: userProfile } = await assertSupabase()
        .from('users')
        .select('preschool_id, role')
        .eq('auth_user_id', user.id)
        .single();

      if (!userProfile?.preschool_id) {
        Alert.alert('Error', 'No school assigned to your account');
        return;
      }

      // Get student details with related information
      const { data: studentData, error: studentError } = await assertSupabase()
        .from('students')
        .select(`
          *,
          classes (
            id,
            name,
            grade_level,
            teacher_id,
            profiles!classes_teacher_id_fkey (
              id,
              first_name,
              last_name
            )
          ),
          profiles!students_parent_id_fkey (
            id,
            first_name,
            last_name,
            email
          ),
          age_groups!students_age_group_id_fkey (
            name
          )
        `)
        .eq('id', studentId)
        .eq('preschool_id', userProfile.preschool_id)
        .single();

      if (studentError) {
        console.error('Error loading student:', studentError);
        Alert.alert('Error', 'Student not found');
        router.back();
        return;
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
        teacher_name: studentData.classes?.profiles ? `${studentData.classes.profiles.first_name} ${studentData.classes.profiles.last_name}` : undefined,
        parent_name: studentData.profiles ? `${studentData.profiles.first_name} ${studentData.profiles.last_name}` : undefined,
        parent_email: studentData.profiles?.email,
        parent_phone: undefined,
        age_group_name: studentData.age_groups?.name,
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
            *,
            profiles!classes_teacher_id_fkey (
              id,
              first_name,
              last_name
            ),
            students!inner (
              id
            )
          `)
          .eq('preschool_id', userProfile.preschool_id)
          .eq('is_active', true);

        const processedClasses = classesData?.map(cls => ({
          id: cls.id,
          name: cls.name,
          grade_level: cls.grade_level,
          teacher_id: (cls as any).profiles?.id || null,
          teacher_name: (cls as any).profiles ? `${(cls as any).profiles.first_name} ${(cls as any).profiles.last_name}` : undefined,
          capacity: cls.capacity || 25,
          current_enrollment: cls.students?.length || 0,
        })) || [];

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
          <TouchableOpacity onPress={handleEditToggle}>
            <Ionicons name="create" size={24} color={theme.primary} />
          </TouchableOpacity>
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
