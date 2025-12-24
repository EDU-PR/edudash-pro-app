/**
 * Hook for Class & Teacher Management
 * Extracted from app/screens/class-teacher-management.tsx
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Alert } from 'react-native';
import { assertSupabase } from '@/lib/supabase';
import type {
  ClassInfo,
  Teacher,
  ClassFormData,
  ActiveTab,
  UseClassTeacherManagementResult,
} from './types';
import { INITIAL_CLASS_FORM } from './utils';

interface UseClassTeacherManagementOptions {
  orgId: string | null | undefined;
  userId: string | undefined;
}

export function useClassTeacherManagement({
  orgId,
  userId,
}: UseClassTeacherManagementOptions): UseClassTeacherManagementResult {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [showTeacherAssignment, setShowTeacherAssignment] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('classes');
  const [classForm, setClassForm] = useState<ClassFormData>(INITIAL_CLASS_FORM);

  const loadData = useCallback(async () => {
    if (!userId || !orgId) return;

    try {
      setLoading(true);
      const schoolId = orgId;

      // Load classes with teacher info
      const { data: classesData, error: classesError } = await assertSupabase()
        .from('classes')
        .select(`
          id,
          name,
          grade_level,
          capacity,
          room_number,
          teacher_id,
          is_active,
          users:teacher_id (
            id,
            first_name,
            last_name,
            name,
            email
          )
        `)
        .eq('preschool_id', schoolId);

      if (classesError) {
        console.error('Error loading classes:', classesError);
      }

      // Process classes
      const processedClasses: ClassInfo[] = (classesData || []).map((cls: any) => {
        const teacher = cls.users;
        const teacherName = teacher
          ? `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.name || teacher.email
          : undefined;
        return {
          id: cls.id,
          name: cls.name,
          grade_level: cls.grade_level,
          capacity: cls.capacity,
          current_enrollment: 0, // Will be updated below
          room_number: cls.room_number,
          teacher_id: cls.teacher_id,
          teacher_name: teacherName,
          is_active: cls.is_active ?? true,
        } as ClassInfo;
      });

      // Get student counts per class
      const classIds = processedClasses.map((c) => c.id);
      if (classIds.length > 0) {
        const { data: enrollments } = await assertSupabase()
          .from('students')
          .select('class_id')
          .in('class_id', classIds);

        // Count students per class
        const countMap: Record<string, number> = {};
        (enrollments || []).forEach((e: any) => {
          countMap[e.class_id] = (countMap[e.class_id] || 0) + 1;
        });

        processedClasses.forEach((cls) => {
          cls.current_enrollment = countMap[cls.id] || 0;
        });
      }

      setClasses(processedClasses);

      // Load teachers
      const { data: teacherMembers, error: teacherMembersError } = await assertSupabase()
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', schoolId)
        .ilike('role', '%teacher%');

      if (teacherMembersError) {
        console.error('Error loading teacher memberships:', teacherMembersError);
      }

      const teacherAuthIds: string[] = (teacherMembers || [])
        .map((m: any) => m.user_id)
        .filter((v: any) => !!v);

      let teacherUsers: any[] = [];
      if (teacherAuthIds.length > 0) {
        // Use profiles table (not deprecated users table)
        const { data: usersData } = await assertSupabase()
          .from('profiles')
          .select('id, email, first_name, last_name, role, created_at')
          .in('id', teacherAuthIds);
        teacherUsers = usersData || [];
      }

      // Fallback: if membership is empty, try profiles table by preschool and role
      if (teacherUsers.length === 0) {
        const { data: fallbackUsers } = await assertSupabase()
          .from('profiles')
          .select('id, email, first_name, last_name, role, created_at')
          .eq('preschool_id', schoolId)
          .ilike('role', '%teacher%');
        teacherUsers = fallbackUsers || [];
      }

      // Aggregate classes and student counts per teacher from processedClasses
      const classesByTeacher: Record<string, ClassInfo[]> = {};
      for (const cls of processedClasses) {
        if (!cls.teacher_id) continue;
        if (!classesByTeacher[cls.teacher_id]) classesByTeacher[cls.teacher_id] = [];
        classesByTeacher[cls.teacher_id].push(cls);
      }

      const processedTeachers: Teacher[] = (teacherUsers || []).map((u: any) => {
        const tClasses = classesByTeacher[u.id] || [];
        const classes_assigned = tClasses.length;
        const students_count = tClasses.reduce((sum, c) => sum + (c.current_enrollment || 0), 0);
        const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.name || u.email;
        return {
          id: u.id,
          full_name: fullName,
          email: u.email,
          phone: undefined,
          specialization: '',
          status: 'active',
          hire_date: u.created_at || new Date().toISOString(),
          classes_assigned,
          students_count,
        } as Teacher;
      });

      setTeachers(processedTeachers);
    } catch (error) {
      console.error('Error loading class/teacher data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, orgId]);

  // Load data when org is available
  useEffect(() => {
    if (orgId && userId) {
      loadData();
    }
  }, [orgId, userId, loadData]);

  // Memoize filtered lists for better performance
  const activeTeachers = useMemo(() => teachers.filter((t) => t.status === 'active'), [teachers]);

  const activeClasses = useMemo(() => classes.filter((c) => c.is_active), [classes]);

  const handleCreateClass = useCallback(async () => {
    if (!classForm.name.trim() || !classForm.grade_level.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      const schoolId = orgId;

      const { error } = await assertSupabase()
        .from('classes')
        .insert({
          name: classForm.name.trim(),
          grade_level: classForm.grade_level.trim(),
          capacity: classForm.capacity,
          room_number: classForm.room_number.trim() || null,
          teacher_id: classForm.teacher_id || null,
          preschool_id: schoolId,
          is_active: true,
        });

      if (error) {
        Alert.alert('Error', 'Failed to create class');
        return;
      }

      Alert.alert('Success', 'Class created successfully');
      setShowClassModal(false);
      setClassForm(INITIAL_CLASS_FORM);
      loadData();
    } catch {
      Alert.alert('Error', 'Failed to create class');
    }
  }, [classForm, orgId, loadData]);

  const handleAssignTeacher = useCallback(async () => {
    if (!selectedClass || !classForm.teacher_id) return;

    try {
      const { error } = await assertSupabase()
        .from('classes')
        .update({ teacher_id: classForm.teacher_id })
        .eq('id', selectedClass.id);

      if (error) {
        Alert.alert('Error', 'Failed to assign teacher');
        return;
      }

      Alert.alert('Success', 'Teacher assigned successfully');
      setShowTeacherAssignment(false);
      setSelectedClass(null);
      setClassForm((prev) => ({ ...prev, teacher_id: '' }));
      loadData();
    } catch {
      Alert.alert('Error', 'Failed to assign teacher');
    }
  }, [selectedClass, classForm.teacher_id, loadData]);

  const handleRemoveTeacher = useCallback(
    (classInfo: ClassInfo) => {
      Alert.alert('Remove Teacher', `Remove ${classInfo.teacher_name} from ${classInfo.name}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await assertSupabase()
                .from('classes')
                .update({ teacher_id: null })
                .eq('id', classInfo.id);

              if (error) {
                Alert.alert('Error', 'Failed to remove teacher');
                return;
              }

              Alert.alert('Success', 'Teacher removed from class');
              loadData();
            } catch {
              Alert.alert('Error', 'Failed to remove teacher');
            }
          },
        },
      ]);
    },
    [loadData]
  );

  const handleToggleClassStatus = useCallback(
    async (classInfo: ClassInfo) => {
      try {
        const { error } = await assertSupabase()
          .from('classes')
          .update({ is_active: !classInfo.is_active })
          .eq('id', classInfo.id);

        if (error) {
          Alert.alert('Error', 'Failed to update class status');
          return;
        }

        loadData();
      } catch {
        Alert.alert('Error', 'Failed to update class status');
      }
    },
    [loadData]
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  return {
    // State
    classes,
    teachers,
    loading,
    refreshing,
    showClassModal,
    showTeacherAssignment,
    selectedClass,
    activeTab,
    classForm,
    // Computed
    activeTeachers,
    activeClasses,
    // Actions
    loadData,
    handleCreateClass,
    handleAssignTeacher,
    handleRemoveTeacher,
    handleToggleClassStatus,
    setShowClassModal,
    setShowTeacherAssignment,
    setSelectedClass,
    setActiveTab,
    setClassForm,
    onRefresh,
  };
}
