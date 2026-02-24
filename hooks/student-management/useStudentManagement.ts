/**
 * Orchestrator hook for the Student Management screen.
 *
 * Owns all state, navigation guards, and delegates to extracted helpers.
 * Accepts `showAlert` from the screen so alerts are rendered in the component tree.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { router, useFocusEffect } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { logger } from '@/lib/logger';

import type { Student, AgeGroup, FilterOptions, ShowAlert } from './types';
import { filterStudents, getAgeGroupStats } from './studentHelpers';
import { buildPrintableStudentIdCardsHtml } from './studentIdCardHtml';
import { fetchStudentData } from './fetchStudentData';
import { autoAssignStudentsByDob, promptAutoAssign } from './autoAssignStudents';

interface UseStudentManagementParams {
  showAlert: ShowAlert;
}

export function useStudentManagement({ showAlert }: UseStudentManagementParams) {
  const { user, profile, loading: authLoading, profileLoading } = useAuth();
  const navigationAttempted = useRef(false);

  const orgId =
    profile?.organization_id ||
    (profile as any)?.preschool_id ||
    (profile as any)?.organization_membership?.organization_id ||
    (profile as any)?.organization_membership?.preschool_id ||
    (user?.user_metadata as any)?.organization_id ||
    (user?.user_metadata as any)?.preschool_id ||
    null;

  const isStillLoading = authLoading || profileLoading;

  const [students, setStudents] = useState<Student[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<{
    id: string; name: string; school_type: string; grade_levels: string[];
  } | null>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    searchTerm: '', ageGroup: '', status: '', classId: '',
  });

  // Navigation guard
  useEffect(() => {
    if (isStillLoading || navigationAttempted.current) return;
    if (!user) {
      navigationAttempted.current = true;
      try { router.replace('/(auth)/sign-in'); } catch {
        try { router.replace('/sign-in'); } catch { /* non-fatal */ }
      }
      return;
    }
    if (!orgId) {
      navigationAttempted.current = true;
      logger.debug('StudentMgmt', 'No school, redirecting', {
        organization_id: profile?.organization_id,
      });
      try { router.replace('/screens/principal-onboarding'); } catch (e) {
        logger.debug('StudentMgmt', 'Redirect failed', e);
      }
    }
  }, [isStillLoading, user, orgId, profile]);

  // Data fetching
  const fetchData = useCallback(async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      const result = await fetchStudentData(orgId, showAlert);
      setSchoolInfo(result.school);
      setClasses(result.classes);
      setStudents(result.students);
    } catch (error) {
      logger.error('StudentMgmt', 'Error fetching student data', error);
      showAlert('Error', 'Failed to load student information', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orgId, showAlert]);

  useFocusEffect(
    useCallback(() => {
      if (orgId && user) fetchData();
      return undefined;
    }, [orgId, user?.id, fetchData]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
  };

  // Derived
  const filteredStudents = filterStudents(students, filters);
  const ageGroupStats = getAgeGroupStats(
    filteredStudents,
    schoolInfo?.school_type || 'preschool',
  );

  // Print ID cards
  const handlePrintIdCards = useCallback(async () => {
    if (filteredStudents.length === 0) {
      showAlert('No students', 'There are no student cards to print.', 'info');
      return;
    }
    try {
      const html = buildPrintableStudentIdCardsHtml({
        schoolName: schoolInfo?.name,
        schoolType: schoolInfo?.school_type,
        students: filteredStudents,
      });
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
        return;
      }
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Student ID Cards',
          UTI: 'com.adobe.pdf',
        });
      } else {
        await Print.printAsync({ html });
      }
    } catch (error) {
      logger.error('StudentMgmt', 'Failed to print student cards', error);
      showAlert('Print failed', 'Could not generate printable student cards.', 'error');
    }
  }, [filteredStudents, schoolInfo?.name, schoolInfo?.school_type, showAlert]);

  // Auto-assign by DOB
  const handleAutoAssignByDob = useCallback(() => {
    promptAutoAssign(orgId, students, showAlert, async (candidates) => {
      setAutoAssigning(true);
      const result = await autoAssignStudentsByDob(orgId!, candidates);
      await fetchData();
      setAutoAssigning(false);
      showAlert(
        'Auto-assign complete',
        `Assigned: ${result.updated}\nSkipped: ${result.skipped}\nFailed: ${result.failed}`,
        result.updated > 0 ? 'success' : 'info',
      );
    });
  }, [orgId, students, fetchData, showAlert]);

  const handleStudentPress = useCallback((student: { id: string }) => {
    router.push(`/screens/student-detail?studentId=${student.id}`);
  }, []);

  const handleAddStudent = useCallback(() => {
    router.push('/screens/student-enrollment');
  }, []);

  return {
    user, orgId, isStillLoading,
    students, filteredStudents, schoolInfo, classes, ageGroupStats,
    loading, refreshing, showFilters, setShowFilters,
    autoAssigning, filters, setFilters,
    onRefresh, handlePrintIdCards, handleAutoAssignByDob,
    handleStudentPress, handleAddStudent,
  };
}
