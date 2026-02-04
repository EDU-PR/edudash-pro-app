/**
 * Custom hook for managing teachers directory state and logic
 */

import { useState, useEffect, useCallback } from 'react';
import { Alert, Linking } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { offlineCacheService } from '@/lib/services/offlineCacheService';
import { removeTeacherFromSchool } from '@/lib/services/teacherRemovalService';
import {
  Teacher,
  FilterOptions,
  createInitialFilters,
} from '@/components/teachers-directory/teachers-directory.types';

export interface UseTeachersDirectoryReturn {
  // State
  teachers: Teacher[];
  filteredTeachers: Teacher[];
  loading: boolean;
  refreshing: boolean;
  isLoadingFromCache: boolean;
  filters: FilterOptions;
  showFilters: boolean;
  viewMode: 'list' | 'grid';
  selectedTeacher: Teacher | null;
  showTeacherModal: boolean;

  // Actions
  loadTeachers: (forceRefresh?: boolean) => Promise<void>;
  setFilters: React.Dispatch<React.SetStateAction<FilterOptions>>;
  setShowFilters: (show: boolean) => void;
  setViewMode: (mode: 'list' | 'grid') => void;
  clearFilters: () => void;
  getActiveFiltersCount: () => number;

  // Teacher actions
  handleCallTeacher: (phone: string) => void;
  handleEmailTeacher: (email: string) => void;
  handleEditTeacher: (teacher: Teacher) => void;
  handleDeleteTeacher: (teacherId: string) => void;
  toggleTeacherStatus: (teacherId: string, currentStatus: string) => void;
  setShowTeacherModal: (show: boolean) => void;

  // Permission checks
  canManageTeacher: () => boolean;
  canViewFullDetails: () => boolean;
}

export function useTeachersDirectory(): UseTeachersDirectoryReturn {
  const { user, profile } = useAuth();
  
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [filteredTeachers, setFilteredTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoadingFromCache, setIsLoadingFromCache] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>(createInitialFilters());
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [showTeacherModal, setShowTeacherModal] = useState(false);

  // ====================================================================
  // DATA LOADING
  // ====================================================================

  const loadTeachers = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(!forceRefresh);
      if (forceRefresh) setRefreshing(true);

      const userRole = profile?.role || 'parent';
      const schoolId = profile?.organization_id || 'school-123';

      // Try cache first
      if (!forceRefresh && user?.id) {
        setIsLoadingFromCache(true);
        const identifier = userRole === 'principal_admin' 
          ? `${schoolId}` 
          : `${schoolId}_${userRole}`;
        
        const cached = await offlineCacheService.get<Teacher[]>(
          'teacher_data_',
          identifier,
          user.id
        );
        
        if (cached) {
          setTeachers(cached);
          setIsLoadingFromCache(false);
          // Continue to fetch fresh data in background
          setTimeout(() => loadTeachers(true), 100);
          return;
        }
        setIsLoadingFromCache(false);
      }

      // TODO: Implement real Supabase-backed fetch for teachers directory.
      // For now, do not include mock data in production builds.
      setTeachers([]);

    } catch (error) {
      console.error('Failed to load teachers:', error);
      Alert.alert('Error', 'Failed to load teachers directory');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, profile?.role, profile?.organization_id]);

  // ====================================================================
  // FILTERING
  // ====================================================================

  const applyFilters = useCallback(() => {
    let filtered = teachers;

    // Filter by subjects
    if (filters.subjects.length > 0) {
      filtered = filtered.filter(teacher => 
        teacher.subjects.some(subject => filters.subjects.includes(subject))
      );
    }

    // Filter by grades
    if (filters.grades.length > 0) {
      filtered = filtered.filter(teacher => 
        teacher.grades.some(grade => filters.grades.includes(grade))
      );
    }

    // Filter by employment status
    if (filters.employmentStatus.length > 0) {
      filtered = filtered.filter(teacher => 
        filters.employmentStatus.includes(teacher.employmentStatus)
      );
    }

    // Filter by search
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(teacher =>
        teacher.firstName.toLowerCase().includes(searchLower) ||
        teacher.lastName.toLowerCase().includes(searchLower) ||
        teacher.teacherId.toLowerCase().includes(searchLower) ||
        teacher.email.toLowerCase().includes(searchLower) ||
        teacher.subjects.some(subject => subject.toLowerCase().includes(searchLower))
      );
    }

    // Sort by last name
    filtered.sort((a, b) => a.lastName.localeCompare(b.lastName));

    setFilteredTeachers(filtered);
  }, [teachers, filters]);

  useEffect(() => {
    loadTeachers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [teachers, filters, applyFilters]);

  const clearFilters = useCallback(() => {
    setFilters(createInitialFilters());
  }, []);

  const getActiveFiltersCount = useCallback((): number => {
    return filters.subjects.length + 
           filters.grades.length + 
           filters.employmentStatus.length + 
           (filters.search ? 1 : 0);
  }, [filters]);

  // ====================================================================
  // PERMISSION CHECKS
  // ====================================================================

  const canManageTeacher = useCallback((): boolean => {
    return ['principal', 'principal_admin', 'admin', 'super_admin'].includes(profile?.role || '');
  }, [profile?.role]);

  const canViewFullDetails = useCallback((): boolean => {
    return ['principal', 'principal_admin', 'teacher', 'admin', 'super_admin'].includes(profile?.role || '');
  }, [profile?.role]);

  // ====================================================================
  // TEACHER ACTIONS
  // ====================================================================

  const handleCallTeacher = useCallback((phone: string) => {
    Linking.openURL(`tel:${phone}`);
  }, []);

  const handleEmailTeacher = useCallback((email: string) => {
    Linking.openURL(`mailto:${email}`);
  }, []);

  const handleEditTeacher = useCallback((teacher: Teacher) => {
    if (!canManageTeacher()) {
      Alert.alert('Access Denied', 'Only principals can edit teacher information.');
      return;
    }
    
    setSelectedTeacher(teacher);
    setShowTeacherModal(true);
  }, [canManageTeacher]);

  const handleDeleteTeacher = useCallback((teacherId: string) => {
    if (!canManageTeacher()) {
      Alert.alert('Access Denied', 'Only principals can delete teachers.');
      return;
    }

    const organizationId = profile?.organization_id || (profile as any)?.preschool_id;
    if (!organizationId) {
      Alert.alert('Error', 'No school found for this account.');
      return;
    }

    Alert.alert(
      'Delete Teacher',
      'Are you sure you want to delete this teacher? This will unassign their classes and revoke their seat.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeTeacherFromSchool({
                teacherUserId: teacherId,
                organizationId,
              });
              setTeachers(prev => prev.filter(t => t.id !== teacherId));
              loadTeachers(true);
            } catch (error) {
              console.error('Failed to delete teacher:', error);
              Alert.alert('Error', 'Failed to delete teacher');
            }
          },
        }
      ]
    );
  }, [canManageTeacher, loadTeachers, profile, setTeachers]);

  const toggleTeacherStatus = useCallback((teacherId: string, currentStatus: string) => {
    if (!canManageTeacher()) {
      Alert.alert('Access Denied', 'Only principals can change teacher status.');
      return;
    }

    const newStatus = currentStatus === 'inactive' ? 'full-time' : 'inactive';
    setTeachers(prev => prev.map(teacher => 
      teacher.id === teacherId 
        ? { ...teacher, employmentStatus: newStatus as Teacher['employmentStatus'] }
        : teacher
    ));
  }, [canManageTeacher]);

  return {
    // State
    teachers,
    filteredTeachers,
    loading,
    refreshing,
    isLoadingFromCache,
    filters,
    showFilters,
    viewMode,
    selectedTeacher,
    showTeacherModal,

    // Actions
    loadTeachers,
    setFilters,
    setShowFilters,
    setViewMode,
    clearFilters,
    getActiveFiltersCount,

    // Teacher actions
    handleCallTeacher,
    handleEmailTeacher,
    handleEditTeacher,
    handleDeleteTeacher,
    toggleTeacherStatus,
    setShowTeacherModal,

    // Permission checks
    canManageTeacher,
    canViewFullDetails,
  };
}
