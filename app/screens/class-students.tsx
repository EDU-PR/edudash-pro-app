/**
 * Class Students Screen
 * View and manage students enrolled in a specific class
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import { logger } from '@/lib/logger';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
interface Student {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  is_active: boolean;
  parent_name?: string;
  parent_email?: string;
}

interface ClassInfo {
  id: string;
  name: string;
  grade_level: string;
  teacher_name?: string;
}

export default function ClassStudentsScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const { showAlert, alertProps } = useAlertModal();
  
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const styles = createStyles(theme);

  const fetchData = useCallback(async () => {
    if (!classId) return;

    try {
      const supabase = assertSupabase();

      // Fetch class info
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select(`
          id,
          name,
          grade_level,
          teacher_id
        `)
        .eq('id', classId)
        .single();

      if (classError) throw classError;

      // Get teacher name if assigned
      let teacherName: string | undefined;
      if (classData.teacher_id) {
        const { data: teacherProfile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', classData.teacher_id)
          .single();

        if (teacherProfile) {
          teacherName = `${teacherProfile.first_name || ''} ${teacherProfile.last_name || ''}`.trim();
        }
      }

      setClassInfo({
        ...classData,
        teacher_name: teacherName,
      });

      // Fetch students in this class
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select(`
          id,
          first_name,
          last_name,
          date_of_birth,
          gender,
          is_active,
          parent:profiles!students_parent_id_fkey(first_name, last_name, email)
        `)
        .eq('class_id', classId)
        .order('last_name', { ascending: true });

      if (studentsError) throw studentsError;

      // Deduplicate by student ID (safeguard against data issues)
      const seenIds = new Set<string>();
      const uniqueStudentsData = (studentsData || []).filter((s: any) => {
        if (seenIds.has(s.id)) return false;
        seenIds.add(s.id);
        return true;
      });

      const transformedStudents: Student[] = uniqueStudentsData.map((s: any) => ({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        date_of_birth: s.date_of_birth,
        gender: s.gender,
        is_active: s.is_active,
        parent_name: s.parent 
          ? `${s.parent.first_name || ''} ${s.parent.last_name || ''}`.trim() 
          : undefined,
        parent_email: s.parent?.email,
      }));

      setStudents(transformedStudents);
    } catch (error: any) {
      logger.error('ClassStudents', 'Error fetching class students:', error);
      showAlert({ title: 'Error', message: 'Failed to load class information' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [classId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const navigateBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/screens/class-teacher-management');
    }
  };

  const handleViewStudent = (studentId: string) => {
    router.push(`/screens/student-detail?id=${studentId}` as any);
  };

  const calculateAge = (dob: string | null): string => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return `${age} years`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Class Students', headerShown: true }} />
        <View style={styles.loadingContainer}>
          <EduDashSpinner size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading class information...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!classInfo) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Class Students', headerShown: true }} />
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={48} color={theme.error} />
          <Text style={styles.errorText}>Class not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={navigateBack}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: classInfo.name,
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity onPress={navigateBack} style={styles.headerButton}>
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Class Info Card */}
        <View style={styles.classInfoCard}>
          <View style={styles.classInfoRow}>
            <Text style={styles.classInfoLabel}>Grade Level:</Text>
            <Text style={styles.classInfoValue}>{classInfo.grade_level}</Text>
          </View>
          {classInfo.teacher_name && (
            <View style={styles.classInfoRow}>
              <Text style={styles.classInfoLabel}>Teacher:</Text>
              <Text style={styles.classInfoValue}>{classInfo.teacher_name}</Text>
            </View>
          )}
          <View style={styles.classInfoRow}>
            <Text style={styles.classInfoLabel}>Total Students:</Text>
            <Text style={styles.classInfoValue}>{students.length}</Text>
          </View>
        </View>

        {/* Students List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Students</Text>

          {students.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={theme.textSecondary} />
              <Text style={styles.emptyText}>No students enrolled</Text>
              <Text style={styles.emptySubtext}>
                Students can be enrolled through the student management screen
              </Text>
            </View>
          ) : (
            students.map((student) => (
              <TouchableOpacity
                key={student.id}
                style={styles.studentCard}
                onPress={() => handleViewStudent(student.id)}
              >
                <View style={styles.studentAvatar}>
                  <Text style={styles.avatarText}>
                    {student.first_name?.[0]}{student.last_name?.[0]}
                  </Text>
                </View>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>
                    {student.first_name} {student.last_name}
                  </Text>
                  <Text style={styles.studentDetails}>
                    Age: {calculateAge(student.date_of_birth)} • {student.gender || 'N/A'}
                  </Text>
                  {student.parent_name && (
                    <Text style={styles.parentInfo}>
                      Parent: {student.parent_name}
                    </Text>
                  )}
                </View>
                <View style={styles.studentStatus}>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: student.is_active ? '#10b981' : '#ef4444' },
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {student.is_active ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
      <AlertModal {...alertProps} />
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollView: {
      flex: 1,
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
      padding: 24,
    },
    errorText: {
      fontSize: 18,
      color: theme.error,
      marginTop: 16,
    },
    backButton: {
      marginTop: 24,
      paddingHorizontal: 24,
      paddingVertical: 12,
      backgroundColor: theme.primary,
      borderRadius: 8,
    },
    backButtonText: {
      color: '#fff',
      fontWeight: '600',
    },
    headerButton: {
      padding: 8,
    },
    classInfoCard: {
      margin: 16,
      padding: 16,
      backgroundColor: theme.card,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    classInfoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    classInfoLabel: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    classInfoValue: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    section: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 16,
    },
    emptyState: {
      alignItems: 'center',
      padding: 32,
    },
    emptyText: {
      fontSize: 16,
      color: theme.textSecondary,
      marginTop: 16,
    },
    emptySubtext: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
    studentCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: theme.card,
      borderRadius: 12,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    studentAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      fontSize: 18,
      fontWeight: '600',
      color: '#fff',
    },
    studentInfo: {
      flex: 1,
      marginLeft: 12,
    },
    studentName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    studentDetails: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 2,
    },
    parentInfo: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 4,
    },
    studentStatus: {
      alignItems: 'flex-end',
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      marginBottom: 4,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '500',
      color: '#fff',
    },
  });
