/**
 * useTeacherManagement Hook
 * 
 * Manages all data fetching and state for teacher management screens.
 * Extracted from app/screens/teacher-management.tsx per WARP.md standards.
 */

import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { TeacherInviteService } from '@/lib/services/teacherInviteService';
import { TeacherDocumentsService, TeacherDocument, TeacherDocType } from '@/lib/services/TeacherDocumentsService';
import { useSeatLimits, useTeacherHasSeat } from '@/lib/hooks/useSeatLimits';
import type { 
  Teacher, 
  Candidate, 
  AvailableTeacher, 
  TeacherInvite,
  TeacherManagementView 
} from '@/types/teacher-management';

interface UseTeacherManagementOptions {
  autoFetch?: boolean;
}

interface UseTeacherManagementReturn {
  // State
  teachers: Teacher[];
  candidates: Candidate[];
  invites: TeacherInvite[];
  availableTeachers: AvailableTeacher[];
  currentView: TeacherManagementView;
  selectedTeacher: Teacher | null;
  loading: boolean;
  searchQuery: string;
  filterStatus: string;
  hiringSearch: string;
  radiusKm: number;
  teacherDocsMap: Record<string, TeacherDocument | undefined>;
  isUploadingDoc: boolean;
  showInviteModal: boolean;
  inviteEmail: string;
  
  // Seat management
  seatUsageDisplay: ReturnType<typeof useSeatLimits>['seatUsageDisplay'];
  shouldDisableAssignment: boolean;
  isAssigning: boolean;
  isRevoking: boolean;
  seatLimitsLoading: boolean;
  seatLimitsError: boolean;
  selectedTeacherHasSeat: boolean;
  
  // Actions
  setCurrentView: (view: TeacherManagementView) => void;
  setSelectedTeacher: (teacher: Teacher | null) => void;
  setSearchQuery: (query: string) => void;
  setFilterStatus: (status: string) => void;
  setHiringSearch: (search: string) => void;
  setRadiusKm: (km: number) => void;
  setShowInviteModal: (show: boolean) => void;
  setInviteEmail: (email: string) => void;
  fetchTeachers: () => Promise<void>;
  fetchAvailableCandidates: () => Promise<void>;
  loadInvites: () => Promise<void>;
  refetchSeatLimits: () => void;
  handleAssignSeat: (teacherUserId: string, teacherName: string) => void;
  handleRevokeSeat: (teacherUserId: string, teacherName: string) => void;
  pickAndUploadTeacherDoc: (docType: TeacherDocType) => Promise<void>;
  showAttachDocActionSheet: () => void;
  refreshSelectedTeacherDocs: () => Promise<void>;
  getPreschoolId: () => string | null;
}

/**
 * Hook for managing teacher data and operations
 */
export function useTeacherManagement(
  options: UseTeacherManagementOptions = {}
): UseTeacherManagementReturn {
  const { autoFetch = true } = options;
  const { user, profile } = useAuth();
  
  // Core state
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
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
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  
  // Seat management integration
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
  
  // Get preschool ID from user context
  const getPreschoolId = useCallback((): string | null => {
    if (profile?.organization_id) {
      return profile.organization_id as string;
    }
    return user?.user_metadata?.preschool_id || null;
  }, [profile, user]);

  // Parse classes from comma-separated string
  const parseClasses = (text?: string): string[] => {
    const t = (text || '').trim();
    if (!t) return [];
    return t.split(',').map(s => s.trim()).filter(Boolean);
  };

  // Fetch real teachers from database
  const fetchTeachers = useCallback(async () => {
    const preschoolId = getPreschoolId();
    
    if (!preschoolId) {
      console.warn('No preschool ID available or Supabase not initialized');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      console.log('🔍 Fetching real teachers for preschool:', preschoolId);
      
      // Query teachers table with document columns
      const { data: teachersData, error: teachersError } = await assertSupabase()
        .from('teachers')
        .select(`
          id,
          user_id,
          auth_user_id,
          email,
          full_name,
          preschool_id,
          is_active,
          created_at,
          cv_file_path, cv_file_name, cv_mime_type, cv_file_size, cv_uploaded_at, cv_uploaded_by,
          qualifications_file_path, qualifications_file_name, qualifications_mime_type, qualifications_file_size, qualifications_uploaded_at, qualifications_uploaded_by,
          id_copy_file_path, id_copy_file_name, id_copy_mime_type, id_copy_file_size, id_copy_uploaded_at, id_copy_uploaded_by,
          contracts_file_path, contracts_file_name, contracts_mime_type, contracts_file_size, contracts_uploaded_at, contracts_uploaded_by
        `)
        .eq('preschool_id', preschoolId)
        .eq('is_active', true);
        
      if (teachersError) {
        console.error('Error fetching teachers:', teachersError);
        Alert.alert('Error', 'Failed to load teachers. Please try again.');
        return;
      }
      
      console.log('✅ Real teachers fetched:', teachersData?.length || 0);
      
      // Query secure tenant-isolated view for per-teacher class and student stats
      const { data: overviewRows, error: overviewError } = await assertSupabase()
        .from('vw_teacher_overview')
        .select('email, class_count, student_count, classes_text');
      if (overviewError) {
        console.warn('[TeacherManagement] vw_teacher_overview error:', overviewError);
      }
      const overviewByEmail = new Map<string, { class_count: number; student_count: number; classes_text: string }>();
      (overviewRows || []).forEach((row: { email?: string; class_count?: number; student_count?: number; classes_text?: string }) => {
        if (row?.email) overviewByEmail.set(String(row.email).toLowerCase(), {
          class_count: Number(row.class_count || 0),
          student_count: Number(row.student_count || 0),
          classes_text: String(row.classes_text || ''),
        });
      });
      
      // Transform database data to match Teacher interface
      const transformedTeachersRaw: (Teacher | null)[] = (teachersData || []).map((dbTeacher: Record<string, unknown>) => {
        let fullName = dbTeacher.full_name as string | null;

        if (!fullName) {
          console.log('[fetchTeachers] full_name is null, using fallback for:', dbTeacher.email);
          if (dbTeacher.email) {
            fullName = (dbTeacher.email as string).split('@')[0];
          }
        }

        if (!fullName) {
          console.warn('[fetchTeachers] Using email as fallback for name:', dbTeacher.email);
          fullName = (dbTeacher.email as string)?.split('@')[0] || 'Unknown Teacher';
        }

        // Convert document data from teachers table format to TeacherDocument format
        const documents: Record<string, TeacherDocument> = {};
        const docTypes = ['cv', 'qualifications', 'id_copy', 'contracts'] as const;
        
        for (const docType of docTypes) {
          const pathKey = `${docType}_file_path`;
          if (dbTeacher[pathKey]) {
            documents[docType] = {
              id: `${docType}_${dbTeacher.id}`,
              teacher_user_id: dbTeacher.id as string,
              preschool_id: (dbTeacher.preschool_id as string) || preschoolId || '',
              doc_type: docType,
              file_path: dbTeacher[pathKey] as string,
              file_name: (dbTeacher[`${docType}_file_name`] as string) || docType.replace('_', ' '),
              mime_type: (dbTeacher[`${docType}_mime_type`] as string) || 'application/pdf',
              file_size: (dbTeacher[`${docType}_file_size`] as number) || 0,
              uploaded_by: (dbTeacher[`${docType}_uploaded_by`] as string) || '',
              created_at: (dbTeacher[`${docType}_uploaded_at`] as string) || (dbTeacher.created_at as string),
              updated_at: (dbTeacher.updated_at as string) || (dbTeacher.created_at as string)
            };
          }
        }

        const nameParts = fullName.split(' ');
        const firstName = nameParts[0] || 'Unknown';
        const lastName = nameParts.slice(1).join(' ') || 'Teacher';

        const teacherUserId = dbTeacher.user_id as string;
        const authUserId = (dbTeacher.auth_user_id as string) || null;

        if (!teacherUserId) {
          console.error('[fetchTeachers] Skipping teacher due to missing user_id:', {
            teacherEmail: dbTeacher.email,
            teacherId: dbTeacher.id,
            authUserId
          });
          return null;
        }

        const emailKey = String(dbTeacher.email || '').toLowerCase();
        const overview = overviewByEmail.get(emailKey);

        return {
          id: dbTeacher.id as string,
          teacherUserId,
          authUserId,
          employeeId: `EMP${(dbTeacher.id as string).slice(0, 3)}`,
          firstName,
          lastName,
          email: (dbTeacher.email as string) || 'No email',
          phone: 'No phone',
          address: 'Address not available',
          idNumber: 'ID not available',
          status: 'active' as const,
          contractType: 'permanent' as const,
          classes: parseClasses(overview?.classes_text),
          subjects: ['General Education'],
          qualifications: ['Teaching Qualification'],
          studentCount: overview?.student_count || 0,
          hireDate: (dbTeacher.created_at as string)?.split('T')[0] || '2024-01-01',
          emergencyContact: {
            name: 'Emergency contact not available',
            phone: 'Not available',
            relationship: 'Unknown'
          },
          salary: {
            basic: 25000,
            allowances: 2000,
            deductions: 4000,
            net: 23000,
            payScale: 'Level 3'
          },
          performance: {
            rating: 4.0,
            lastReviewDate: '2024-08-01',
            strengths: ['Dedicated teacher'],
            improvementAreas: ['Professional development'],
            goals: ['Continuous improvement']
          },
          documents,
          attendance: {
            daysPresent: 180,
            daysAbsent: 5,
            lateArrivals: 2,
            leaveBalance: 15
          },
          workload: {
            teachingHours: 25,
            adminDuties: ['General duties'],
            extraCurricular: ['TBD']
          }
        };
      });

      const transformedTeachers = transformedTeachersRaw.filter((teacher): teacher is Teacher => teacher !== null);
      console.log('✅ Valid teachers after filtering:', transformedTeachers.length);
      setTeachers(transformedTeachers);
    } catch (_error) {
      console.error('Failed to fetch teachers:', _error);
      Alert.alert('Error', 'Failed to load teacher data. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [getPreschoolId]);

  // Fetch available candidates for hiring
  const fetchAvailableCandidates = useCallback(async () => {
    try {
      setLoading(true);
      const schoolId = getPreschoolId();
      if (schoolId) {
        const { data, error } = await assertSupabase().rpc('rpc_find_available_teachers_near', {
          school_id: schoolId,
          radius_km: radiusKm,
          subject_filter: null,
        });
        if (!error && Array.isArray(data)) {
          let list = data as Array<{
            user_id?: string;
            full_name?: string;
            email?: string;
            phone?: string;
            home_city?: string | null;
            home_postal_code?: string | null;
            distance_km?: number;
          }>;
          if (hiringSearch && hiringSearch.trim()) {
            const term = hiringSearch.trim().toLowerCase();
            list = list.filter((x) =>
              (x.full_name || '').toLowerCase().includes(term) ||
              (x.email || '').toLowerCase().includes(term) ||
              (x.home_city || '').toLowerCase().includes(term) ||
              (x.home_postal_code || '').toLowerCase().includes(term)
            );
          }
          setAvailableTeachers(list.map((x) => ({
            id: x.user_id || '',
            name: x.full_name || x.email || 'Teacher',
            email: x.email || '',
            phone: x.phone,
            home_city: x.home_city,
            home_postal_code: x.home_postal_code,
            distance_km: x.distance_km,
          })));
          return;
        }
      }
      
      // Fallback when RPC not available or school has no coordinates
      const base = assertSupabase()
        .from('profiles')
        .select('id, email, first_name, last_name, phone, city, postal_code, role, is_active, preschool_id, organization_id')
        .eq('role', 'teacher')
        .eq('is_active', true)
        .is('preschool_id', null)
        .is('organization_id', null)
        .limit(100);
      let query = base;
      if (hiringSearch && hiringSearch.trim().length > 0) {
        const term = hiringSearch.trim();
        query = query.or(`city.ilike.%${term}%,postal_code.ilike.%${term}%,email.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`);
      }
      const { data, error } = await query;
      if (error) {
        console.error('Error loading available teachers:', error);
        setAvailableTeachers([]);
      } else {
        const fallbackList = (data || []).map((u: Record<string, unknown>) => ({
          id: u.id as string,
          name: u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : (u.email as string) || 'Teacher',
          email: u.email as string,
          phone: u.phone as string | undefined,
          home_city: (u.city as string) || null,
          home_postal_code: (u.postal_code as string) || null,
        }));
        setAvailableTeachers(fallbackList);
      }
    } catch (_e) {
      console.error('Failed to load available teachers:', _e);
      setAvailableTeachers([]);
    } finally {
      setLoading(false);
    }
  }, [hiringSearch, radiusKm, getPreschoolId]);

  // Load teacher invites
  const loadInvites = useCallback(async () => {
    try {
      const schoolId = getPreschoolId();
      if (!schoolId) return;
      const list = await TeacherInviteService.listInvites(schoolId);
      setInvites(list.map(i => ({ id: i.id, email: i.email, status: i.status, created_at: i.created_at })));
    } catch {
      // ignore
    }
  }, [getPreschoolId]);

  // Seat management handlers
  const handleAssignSeat = useCallback((teacherUserId: string, teacherName: string) => {
    if (shouldDisableAssignment) {
      Alert.alert(
        'Seat Limit Reached',
        `Cannot assign more teacher seats. You have reached the limit for your current plan.${seatUsageDisplay ? `\n\nCurrent usage: ${seatUsageDisplay.displayText}` : ''}`,
        [
          { text: 'OK', style: 'default' },
          { text: 'Upgrade Plan', onPress: () => {
            Alert.alert('Upgrade Plan', 'Plan upgrade feature coming soon!');
          }}
        ]
      );
      return;
    }
    
    Alert.alert(
      'Assign Teacher Seat',
      `Assign a teacher seat to ${teacherName}?\n\nThis will allow them to use the teacher portal and access student information.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Assign Seat',
          onPress: async () => {
            try {
              await assignSeat({ teacherUserId });
              await fetchTeachers();
            } catch (_error) {
              console.error('Seat assignment failed:', _error);
            }
          }
        }
      ]
    );
  }, [shouldDisableAssignment, seatUsageDisplay, assignSeat, fetchTeachers]);
  
  const handleRevokeSeat = useCallback((teacherUserId: string, teacherName: string) => {
    Alert.alert(
      'Revoke Teacher Seat',
      `Are you sure you want to revoke the teacher seat from ${teacherName}?\n\nThey will lose access to the teacher portal until a new seat is assigned.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke Seat',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[TeacherManagement] Revoking seat from user:', teacherUserId);
              await revokeSeat({ teacherUserId });
              console.log('[TeacherManagement] Seat revoked successfully');
              await fetchTeachers();
              Alert.alert('Success', `Seat revoked from ${teacherName} successfully!`);
            } catch (_error) {
              console.error('[TeacherManagement] Seat revocation failed:', _error);
              Alert.alert('Revocation Failed', _error instanceof Error ? _error.message : 'Unknown error occurred');
            }
          }
        }
      ]
    );
  }, [revokeSeat, fetchTeachers]);

  // Refresh selected teacher documents
  const refreshSelectedTeacherDocs = useCallback(async () => {
    if (!selectedTeacher?.id) return;
    const docs = await TeacherDocumentsService.listDocuments(selectedTeacher.id);
    const map: Record<string, TeacherDocument> = {};
    for (const d of docs) { if (!map[d.doc_type]) map[d.doc_type] = d; }
    setTeacherDocsMap(map);
  }, [selectedTeacher]);

  // Pick and upload teacher document
  const pickAndUploadTeacherDoc = useCallback(async (docType: TeacherDocType) => {
    // This function requires DocumentPicker which is imported in the component
    // The implementation is kept in the component for now due to the dependency
    console.warn('pickAndUploadTeacherDoc should be called from component with DocumentPicker access');
  }, []);

  // Show document attachment action sheet
  const showAttachDocActionSheet = useCallback(() => {
    Alert.alert(
      'Attach Document',
      'Select which document to attach',
      [
        { text: 'CV', onPress: () => pickAndUploadTeacherDoc('cv') },
        { text: 'Qualifications', onPress: () => pickAndUploadTeacherDoc('qualifications') },
        { text: 'ID Copy', onPress: () => pickAndUploadTeacherDoc('id_copy') },
        { text: 'Contracts', onPress: () => pickAndUploadTeacherDoc('contracts') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, [pickAndUploadTeacherDoc]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      loadInvites();
      fetchTeachers();
      fetchAvailableCandidates();
    }
  }, [autoFetch, fetchTeachers, loadInvites, fetchAvailableCandidates]);

  // Load teacher documents when entering profile view
  useEffect(() => {
    if (currentView === 'profile' && selectedTeacher?.id) {
      refreshSelectedTeacherDocs();
    }
  }, [currentView, selectedTeacher?.id, refreshSelectedTeacherDocs]);

  return {
    // State
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
    
    // Seat management
    seatUsageDisplay,
    shouldDisableAssignment,
    isAssigning,
    isRevoking,
    seatLimitsLoading,
    seatLimitsError,
    selectedTeacherHasSeat,
    
    // Actions
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
