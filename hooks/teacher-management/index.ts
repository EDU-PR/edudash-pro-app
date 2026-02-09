/**
 * useTeacherManagement — orchestrator hook (barrel module).
 *
 * Composes state, sub-modules, and effects; delegates heavy lifting
 * to fetchTeachers, fetchCandidates, seatHandlers, and documentHandlers.
 *
 * Re-exports all types for consumers.
 */

export type { UseTeacherManagementOptions, UseTeacherManagementReturn } from './types';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { TeacherInviteService } from '@/lib/services/teacherInviteService';
import { useSeatLimits, useTeacherHasSeat } from '@/lib/hooks/useSeatLimits';
import type { TeacherDocument, TeacherDocType } from '@/lib/services/TeacherDocumentsService';
import type { AlertButton } from '@/components/ui/AlertModal';
import type {
  Teacher,
  AvailableTeacher,
  TeacherInvite,
  TeacherManagementView,
} from '@/types/teacher-management';
import type { UseTeacherManagementOptions, UseTeacherManagementReturn, SafeAlert } from './types';

import { fetchTeachersForSchool } from './fetchTeachers';
import { fetchAvailableCandidatesForSchool } from './fetchCandidates';
import { createSeatHandlers } from './seatHandlers';
import {
  refreshSelectedTeacherDocs as refreshDocs,
  pickAndUploadTeacherDoc as pickDoc,
  showAttachDocActionSheet as showDocSheet,
} from './documentHandlers';

export function useTeacherManagement(
  options: UseTeacherManagementOptions = {},
): UseTeacherManagementReturn {
  const { autoFetch = true, showAlert } = options;
  const { user, profile } = useAuth();

  // --- Safe alert wrapper ---
  const safeAlert: SafeAlert = useCallback(
    (config) => {
      if (showAlert) {
        showAlert(config);
      } else {
        console.warn('[TeacherManagement] Alert:', config.title, config.message || '');
      }
    },
    [showAlert],
  );

  // --- Core state ---
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [candidates, setCandidates] = useState<never[]>([]);
  const [invites, setInvites] = useState<TeacherInvite[]>([]);
  const [availableTeachers, setAvailableTeachers] = useState<AvailableTeacher[]>([]);
  const [currentView, setCurrentView] = useState<TeacherManagementView>('overview');
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [hiringSearch, setHiringSearch] = useState('');
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [teacherDocsMap, setTeacherDocsMap] = useState<Record<string, TeacherDocument | undefined>>({});
  const [isUploadingDoc] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  // --- Seat management ---
  const {
    seatUsageDisplay,
    shouldDisableAssignment,
    assignSeat,
    revokeSeat,
    isAssigning,
    isRevoking,
    isLoading: seatLimitsLoading,
    isError: seatLimitsError,
    refetch: refetchSeatLimits,
  } = useSeatLimits();

  const selectedTeacherHasSeat = useTeacherHasSeat(selectedTeacher?.teacherUserId ?? '__none__');

  // --- Preschool ID resolver ---
  const getPreschoolId = useCallback((): string | null => {
    if (profile?.organization_id) return profile.organization_id as string;
    if ((profile as unknown as Record<string, unknown>)?.preschool_id)
      return (profile as unknown as Record<string, unknown>).preschool_id as string;
    return user?.user_metadata?.preschool_id || null;
  }, [profile, user]);

  // --- Data fetchers ---
  const fetchTeachers = useCallback(async () => {
    const pid = getPreschoolId();
    if (!pid) return;
    setLoading(true);
    try {
      const result = await fetchTeachersForSchool(pid);
      setTeachers(result);
    } finally {
      setLoading(false);
    }
  }, [getPreschoolId]);

  const fetchAvailableCandidates = useCallback(async () => {
    const pid = getPreschoolId();
    if (!pid) return;
    try {
      const result = await fetchAvailableCandidatesForSchool(pid, radiusKm, hiringSearch);
      setAvailableTeachers(result);
    } catch {
      // ignore — non-critical
    }
  }, [getPreschoolId, radiusKm, hiringSearch]);

  const loadInvites = useCallback(async () => {
    const pid = getPreschoolId();
    if (!pid) return;
    try {
      const pendingInvites = await TeacherInviteService.listInvites(pid);
      setInvites(
        pendingInvites.map((i) => ({
          id: i.id,
          email: i.email,
          status: i.status,
          created_at: i.created_at,
          token: i.token,
        })),
      );
    } catch {
      // ignore
    }
  }, [getPreschoolId]);

  // --- Seat handlers ---
  const { handleAssignSeat, handleRevokeSeat } = createSeatHandlers({
    shouldDisableAssignment,
    seatUsageDisplay,
    assignSeat,
    revokeSeat,
    fetchTeachers,
    safeAlert,
  });

  // --- Document handlers ---
  const refreshSelectedTeacherDocs = useCallback(
    () => refreshDocs({ selectedTeacher, setTeacherDocsMap, safeAlert }),
    [selectedTeacher, safeAlert],
  );

  const pickAndUploadTeacherDoc = useCallback(
    (docType: TeacherDocType) => pickDoc(docType),
    [],
  );

  const showAttachDocActionSheet = useCallback(
    () => showDocSheet(safeAlert, pickAndUploadTeacherDoc),
    [safeAlert, pickAndUploadTeacherDoc],
  );

  // --- Effects ---
  useEffect(() => {
    if (autoFetch) {
      loadInvites();
      fetchTeachers();
      fetchAvailableCandidates();
    }
  }, [autoFetch, fetchTeachers, loadInvites, fetchAvailableCandidates]);

  useEffect(() => {
    if (currentView === 'profile' && selectedTeacher?.id) {
      refreshSelectedTeacherDocs();
    }
  }, [currentView, selectedTeacher?.id, refreshSelectedTeacherDocs]);

  // --- Public API ---
  return {
    teachers,
    candidates,
    invites,
    availableTeachers,
    currentView,
    selectedTeacher,
    loading,
    searchQuery,
    filterStatus,
    hiringSearch,
    radiusKm,
    teacherDocsMap,
    isUploadingDoc,
    showInviteModal,
    inviteEmail,

    seatUsageDisplay,
    shouldDisableAssignment,
    isAssigning,
    isRevoking,
    seatLimitsLoading,
    seatLimitsError,
    selectedTeacherHasSeat,

    setCurrentView,
    setSelectedTeacher,
    setSearchQuery,
    setFilterStatus,
    setHiringSearch,
    setRadiusKm,
    setShowInviteModal,
    setInviteEmail,
    fetchTeachers,
    fetchAvailableCandidates,
    loadInvites,
    refetchSeatLimits,
    handleAssignSeat,
    handleRevokeSeat,
    pickAndUploadTeacherDoc,
    showAttachDocActionSheet,
    refreshSelectedTeacherDocs,
    getPreschoolId,
  };
}
