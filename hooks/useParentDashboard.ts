/**
 * Parent Dashboard Hook
 * 
 * Fetches and manages parent dashboard data.
 * Extracted from hooks/useDashboardData.ts per WARP.md standards.
 */

import { useState, useEffect, useCallback } from 'react';
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
          setTimeout(() => fetchData(true), 100);
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
        .eq('id', user.id)
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
        const { data: childrenData } = await supabase
          .from('students')
          .select(`
            id,
            first_name,
            last_name,
            grade_level,
            student_class:classes(id, name, teacher:profiles!classes_teacher_id_fkey(first_name, last_name))
          `)
          .eq('parent_id', user.id);

        const children = (childrenData || []).map((child: Record<string, unknown>) => ({
          id: child.id as string,
          firstName: child.first_name as string,
          lastName: child.last_name as string,
          grade: (child.grade_level as string) || 'Grade R',
          className: (child.student_class as Record<string, unknown>)?.name as string || 'No Class',
          teacher: (child.student_class as Record<string, unknown>)?.teacher ? 
            `${((child.student_class as Record<string, unknown>).teacher as Record<string, unknown>).first_name} ${((child.student_class as Record<string, unknown>).teacher as Record<string, unknown>).last_name}` : 
            'No Teacher Assigned'
        }));

        // Get today's attendance for all children
        const today = new Date().toISOString().split('T')[0];
        const childIds = children.map(child => child.id);
        
        let todayAttendanceData: Array<{ student_id: string; status: string }> = [];
        if (childIds.length > 0) {
          const { data: attendanceData } = await supabase
            .from('attendance_records')
            .select('student_id, status')
            .in('student_id', childIds)
            .gte('date', today + 'T00:00:00')
            .lt('date', today + 'T23:59:59');
          
          todayAttendanceData = attendanceData || [];
        }

        // Fetch recent homework assignments for children
        const { data: assignmentsData } = await supabase
          .from('homework_assignments')
          .select(`
            id,
            title,
            due_date,
            homework_submissions!inner(
              id,
              status,
              student_id
            )
          `)
          .in('homework_submissions.student_id', childIds)
          .order('due_date', { ascending: false })
          .limit(5);

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

        // Process homework data
        const recentHomework = (assignmentsData || []).map((assignment: Record<string, unknown>) => {
          const submissions = (assignment.homework_submissions as Array<{ status: string; student_id: string }>)?.[0];
          return {
            id: assignment.id as string,
            title: assignment.title as string,
            dueDate: formatDueDate(assignment.due_date as string),
            status: (submissions?.status || 'not_submitted') as 'submitted' | 'graded' | 'not_submitted',
            studentName: children.find(child => child.id === submissions?.student_id)?.firstName || 'Unknown'
          };
        });

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

  const refresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  return { data, loading, error, refresh, isLoadingFromCache };
};
