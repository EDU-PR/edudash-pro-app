/**
 * Parent Dashboard Hook
 * 
 * Fetches and manages parent dashboard data.
 * Includes realtime subscription for attendance updates.
 * Extracted from hooks/useDashboardData.ts per WARP.md standards.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { offlineCacheService } from '@/lib/services/offlineCacheService';
import { log, logError } from '@/lib/debug';
import type { ParentDashboardData } from '@/types/dashboard';
import {
  formatDueDate,
  formatEventTime,
  createEmptyParentData,
} from '@/lib/dashboard/utils';

/**
 * Hook for fetching Parent dashboard data
 */
export const useParentDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<ParentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingFromCache, setIsLoadingFromCache] = useState(false);
  const childIdsRef = useRef<string[]>([]);

  const fetchData = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      if (authLoading) {
        log('🔄 Waiting for auth to complete...');
        setLoading(false);
        return;
      }

      // Try to load from cache first (unless forced refresh)
      if (!forceRefresh && user?.id) {
        setIsLoadingFromCache(true);
        const cachedData = await offlineCacheService.getParentDashboard(user.id);
        
        if (cachedData) {
          log('📱 Loading parent data from cache...');
          setData(cachedData);
          setLoading(false);
          setIsLoadingFromCache(false);
          // REMOVED: Background refresh that was causing infinite reloads
          // The pull-to-refresh and manual refresh should be used instead
          // Previously: setTimeout(() => fetchData(true), 100); <-- This caused loops!
          return;
        }
        setIsLoadingFromCache(false);
      }

      if (!user?.id) {
        if (!authLoading) {
          throw new Error('User not authenticated');
        }
        setLoading(false);
        return;
      }
      
      const supabase = assertSupabase();
      
      const { data: authCheck } = await supabase.auth.getUser();
      if (!authCheck.user) {
        throw new Error('Authentication session invalid');
      }

      // Fetch parent user from profiles table
      const { data: parentUser, error: parentError } = await supabase
        .from('profiles')
        .select('id, preschool_id, first_name, last_name, role, organization_id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (parentError) {
        logError('Parent user fetch error:', parentError);
      }

      let dashboardData: ParentDashboardData;

      if (parentUser) {
        const schoolId = (parentUser as Record<string, unknown>).preschool_id || (parentUser as Record<string, unknown>).organization_id;
        let schoolName = 'Unknown School';
        
        if (schoolId) {
          const { data: school } = await supabase
            .from('preschools')
            .select('id, name')
            .eq('id', schoolId as string)
            .maybeSingle();
          
          if (!school) {
            const { data: org } = await supabase
              .from('organizations')
              .select('id, name')
              .eq('id', schoolId as string)
              .maybeSingle();
            schoolName = org?.name || schoolName;
          } else {
            schoolName = school.name || schoolName;
          }
        }

        // Fetch children for this parent
        const parentIdentifiers = new Set<string>();
        if (parentUser.id) parentIdentifiers.add(parentUser.id);
        if (user.id) parentIdentifiers.add(user.id);

        const parentFilters = Array.from(parentIdentifiers).flatMap((id) => [
          `parent_id.eq.${id}`,
          `guardian_id.eq.${id}`,
        ]);

        const { data: childrenData } = await supabase
          .from('students')
          .select(`
            id,
            first_name,
            last_name,
            student_id,
            preschool_id,
            date_of_birth,
            grade_level,
            avatar_url,
            classes!students_class_id_fkey(id, name, teacher_id)
          `)
          .or(parentFilters.join(','));
        
        // Fetch teacher names separately if we have classes
        const classIds = (childrenData || [])
          .map((c: any) => c.classes?.id)
          .filter(Boolean);
        
        let teacherMap: Record<string, string> = {};
        if (classIds.length > 0) {
          const teacherIds = (childrenData || [])
            .map((c: any) => c.classes?.teacher_id)
            .filter(Boolean);
          
          if (teacherIds.length > 0) {
            const { data: teachersData } = await supabase
              .from('profiles')
              .select('id, first_name, last_name')
              .in('id', teacherIds);
            
            (teachersData || []).forEach((t: any) => {
              teacherMap[t.id] = `${t.first_name || ''} ${t.last_name || ''}`.trim();
            });
          }
        }

        const children = (childrenData || []).map((child: Record<string, unknown>) => ({
          id: child.id as string,
          firstName: child.first_name as string,
          lastName: child.last_name as string,
          studentCode: (child.student_id as string | null) ?? null,
          preschoolId: (child.preschool_id as string | null) ?? (schoolId as string | null),
          avatarUrl: (child.avatar_url as string | null) ?? null,
          dateOfBirth: (child.date_of_birth as string | null) ?? null,
          grade: (child.grade_level as string) || 'Grade R',
          className: (child.classes as Record<string, unknown>)?.name as string || 'No Class',
          classId: (child.classes as Record<string, unknown>)?.id as string || null,
          teacher: (child.classes as Record<string, unknown>)?.teacher_id 
            ? teacherMap[(child.classes as Record<string, unknown>).teacher_id as string] || 'No Teacher Assigned'
            : 'No Teacher Assigned'
        }));

        // Get today's attendance for all children
        const today = new Date().toISOString().split('T')[0];
        const childIds = children.map(child => child.id);

        let feesDueSoon: ParentDashboardData['feesDueSoon'] = null;
        if (childIds.length > 0) {
          const todayDate = new Date();
          todayDate.setHours(0, 0, 0, 0);
          const dueSoonDate = new Date(todayDate);
          dueSoonDate.setDate(dueSoonDate.getDate() + 3);
          const dueSoonStr = dueSoonDate.toISOString().split('T')[0];

          const { data: dueSoonFees } = await supabase
            .from('student_fees')
            .select('student_id, due_date, amount, final_amount, status')
            .in('student_id', childIds)
            .in('status', ['pending', 'overdue', 'partially_paid'])
            .gte('due_date', today)
            .lte('due_date', dueSoonStr)
            .order('due_date', { ascending: true })
            .limit(1);

          const dueFee = dueSoonFees && dueSoonFees[0];
          if (dueFee?.due_date) {
            const dueDate = new Date(dueFee.due_date);
            const daysUntil = Math.ceil((dueDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
            const childMatch = children.find(child => child.id === dueFee.student_id);
            feesDueSoon = {
              amount: Number(dueFee.final_amount ?? dueFee.amount ?? 0),
              dueDate: dueFee.due_date,
              daysUntil: Number.isNaN(daysUntil) ? 0 : daysUntil,
              childName: childMatch ? `${childMatch.firstName} ${childMatch.lastName}`.trim() : null,
            };
          }
        }
        
        let todayAttendanceData: Array<{ student_id: string; status: string }> = [];
        if (childIds.length > 0) {
          const { data: attendanceData } = await supabase
            .from('attendance')
            .select('student_id, status')
            .in('student_id', childIds)
            .eq('attendance_date', today);
          
          todayAttendanceData = attendanceData || [];
        }

        // Fetch recent homework assignments for children
        // Using explicit FK to avoid ambiguous relationship error
        const { data: assignmentsData } = await supabase
          .from('homework_assignments')
          .select(`
            id,
            title,
            due_date,
            homework_submissions!homework_submissions_assignment_id_fkey(
              id,
              status,
              student_id
            )
          `)
          .order('due_date', { ascending: false })
          .limit(10);

        // Fetch upcoming events for the school
        const { data: eventsData } = await supabase
          .from('events')
          .select('id, title, event_date, event_type, description')
          .eq('preschool_id', schoolId as string)
          .gte('event_date', new Date().toISOString())
          .order('event_date', { ascending: true })
          .limit(5);

        // Process attendance data
        const totalChildren = children.length;
        const presentToday = todayAttendanceData.filter(a => a.status === 'present').length;
        const attendanceRate = totalChildren > 0 ? Math.round((presentToday / totalChildren) * 100) : 0;

        // Process homework data - filter to only show homework for this parent's children
        const recentHomework = (assignmentsData || [])
          .map((assignment: Record<string, unknown>) => {
            const submissions = (assignment.homework_submissions as Array<{ status: string; student_id: string }>) || [];
            // Find submission for one of our children
            const childSubmission = submissions.find(s => childIds.includes(s.student_id));
            if (!childSubmission) return null; // Skip if no submission from our children
            
            return {
              id: assignment.id as string,
              title: assignment.title as string,
              dueDate: formatDueDate(assignment.due_date as string),
              status: (childSubmission.status || 'not_submitted') as 'submitted' | 'graded' | 'not_submitted',
              studentName: children.find(child => child.id === childSubmission.student_id)?.firstName || 'Unknown'
            };
          })
          .filter(Boolean)
          .slice(0, 5);

        // Process upcoming events
        const upcomingEvents = (eventsData || []).map((event: Record<string, unknown>) => {
          const eventDate = new Date(event.event_date as string);
          
          return {
            id: event.id as string,
            title: event.title as string,
            time: formatEventTime(eventDate),
            type: ((event.event_type as string) || 'event') as 'meeting' | 'activity' | 'assessment'
          };
        });

        dashboardData = {
          schoolName,
          totalChildren,
          feesDueSoon,
          children,
          attendanceRate,
          presentToday,
          recentHomework,
          upcomingEvents,
          unreadMessages: 0
        };

        if (user?.id && schoolId) {
          await offlineCacheService.cacheParentDashboard(user.id, dashboardData);
          log('💾 Parent dashboard data cached for offline use');
        }
      } else {
        dashboardData = createEmptyParentData();
      }

      setData(dashboardData);
    } catch (err) {
      logError('Failed to fetch parent dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      setData(createEmptyParentData());
    } finally {
      setLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (!authLoading && user?.id) {
      fetchData();
    } else if (!authLoading && !user) {
      setData(null);
      setLoading(false);
      setError(null);
    }
  }, [fetchData, authLoading, user]);

  // Set up realtime subscription for attendance updates
  useEffect(() => {
    if (!user?.id || childIdsRef.current.length === 0) return;
    
    const supabase = assertSupabase();
    const childIds = childIdsRef.current;
    
    // Subscribe to attendance changes for this parent's children
    const channel = supabase
      .channel(`parent-dashboard-attendance-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'attendance',
        },
        (payload) => {
          const studentId = (payload.new as any)?.student_id || (payload.old as any)?.student_id;
          // Only refresh if the attendance is for one of this parent's children
          if (childIds.includes(studentId)) {
            log('[ParentDashboard] Attendance updated for child:', studentId);
            fetchData(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchData]);

  // Update childIdsRef when data changes
  useEffect(() => {
    if (data?.children) {
      childIdsRef.current = data.children.map(c => c.id);
    }
  }, [data?.children]);

  const refresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  return { data, loading, error, refresh, isLoadingFromCache };
};
