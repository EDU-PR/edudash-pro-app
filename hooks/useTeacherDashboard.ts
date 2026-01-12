/**
 * Teacher Dashboard Hook
 * 
 * Fetches and manages teacher dashboard data.
 * Extracted from hooks/useDashboardData.ts per WARP.md standards.
 */

import { useState, useEffect, useCallback } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { offlineCacheService } from '@/lib/services/offlineCacheService';
import { log, logError, warn } from '@/lib/debug';
import type { TeacherDashboardData } from '@/types/dashboard';
import {
  formatDueDate,
  getNextLessonTime,
  formatEventTime,
  createEmptyTeacherData,
} from '@/lib/dashboard/utils';

/**
 * Hook for fetching Teacher dashboard data
 */
export const useTeacherDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingFromCache, setIsLoadingFromCache] = useState(false);

  const fetchData = useCallback(async (forceRefresh = false) => {
    // Prevent data fetching during dashboard switches
    if (typeof window !== 'undefined' && (window as unknown as { dashboardSwitching?: boolean }).dashboardSwitching) {
      console.log('👨‍🏫 Skipping teacher dashboard data fetch during switch');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);

      if (authLoading) {
        log('🔄 Waiting for auth to complete...');
        return;
      }

      // Try to load from cache first (unless forced refresh)
      if (!forceRefresh && user?.id) {
        setIsLoadingFromCache(true);
        const cachedData = await offlineCacheService.getTeacherDashboard(
          user.id, 
          user.user_metadata?.school_id || 'unknown'
        );
        
        if (cachedData) {
          log('📱 Loading teacher data from cache...');
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
        return;
      }
      
      const supabase = assertSupabase();
      
      const { data: authCheck } = await supabase.auth.getUser();
      if (!authCheck.user) {
        throw new Error('Authentication session invalid');
      }

      // Fetch teacher profile from public.profiles (profiles.id = auth_user_id)
      const { data: teacherProfile, error: teacherError } = await supabase
        .from('profiles')
        .select('id, preschool_id, organization_id, first_name, last_name, role')
        .eq('id', user.id)
        .maybeSingle();

      if (teacherError) {
        logError('Teacher profile fetch error:', teacherError);
      }

      // Resolve teacher organization and role with robust fallbacks
      let resolvedTeacherUser: Record<string, unknown> | null = teacherProfile ? {
        id: teacherProfile.id,
        auth_user_id: teacherProfile.id,
        preschool_id: teacherProfile.preschool_id || teacherProfile.organization_id,
        first_name: teacherProfile.first_name,
        last_name: teacherProfile.last_name,
        role: teacherProfile.role,
      } : null;
      
      log('👨‍🏫 Initial teacher profile:', { 
        teacherProfile: teacherProfile ? { id: teacherProfile.id, preschool_id: teacherProfile.preschool_id, role: teacherProfile.role } : null 
      });
      
      if (!resolvedTeacherUser || (!resolvedTeacherUser.preschool_id && !teacherProfile?.organization_id) || !(String(resolvedTeacherUser.role || '').toLowerCase().includes('teacher'))) {
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('id, preschool_id, role, first_name, last_name, organization_id')
          .eq('id', user.id)
          .maybeSingle();
        
        log('👨‍🏫 Profile fallback:', { 
          prof: prof ? { id: prof.id, preschool_id: prof.preschool_id, organization_id: prof.organization_id, role: prof.role } : null,
          profErr 
        });
        
        if (!profErr && prof) {
          const roleStr = String((prof as Record<string, unknown>).role || '').toLowerCase();
          if (!resolvedTeacherUser || roleStr.includes('teacher')) {
            resolvedTeacherUser = {
              id: teacherProfile?.id || user.id,
              auth_user_id: user.id,
              preschool_id: (prof as Record<string, unknown>).preschool_id || (prof as Record<string, unknown>).organization_id || teacherProfile?.preschool_id || teacherProfile?.organization_id || null,
              first_name: (prof as Record<string, unknown>).first_name || teacherProfile?.first_name || null,
              last_name: (prof as Record<string, unknown>).last_name || teacherProfile?.last_name || null,
              role: (prof as Record<string, unknown>).role || teacherProfile?.role || 'teacher'
            };
          }
        }
      }
      
      log('👨‍🏫 Resolved teacher user:', resolvedTeacherUser);

      let dashboardData: TeacherDashboardData;

      if (resolvedTeacherUser) {
        // Use auth user ID for teacher_id since classes.teacher_id references auth.users(id)
        const teacherId = user.id;
        const usersTableId = resolvedTeacherUser.id as string;
        let schoolName = 'Unknown School';
        let schoolTier: 'free' | 'starter' | 'premium' | 'enterprise' | 'solo' | 'group_5' | 'group_10' = 'free';
        const schoolIdToUse = resolvedTeacherUser.preschool_id as string;
        
        log('👨‍🏫 Using IDs:', { authUserId: teacherId, usersTableId, schoolIdToUse });
        
        if (schoolIdToUse) {
          // First try to get preschool with its subscription
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/f48af9d6-9953-4cb6-83b3-cbebe5169087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTeacherDashboard.ts:146',message:'Before preschool query',data:{schoolIdToUse},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'T1'})}).catch(()=>{});
          // #endregion
          const { data: school } = await supabase
            .from('preschools')
            .select('id, name')
            .eq('id', schoolIdToUse)
            .maybeSingle();
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/f48af9d6-9953-4cb6-83b3-cbebe5169087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTeacherDashboard.ts:154',message:'After preschool query',data:{hasSchool:!!school,schoolName:school?.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'T1'})}).catch(()=>{});
          // #endregion
          if (school) {
            schoolName = school.name || schoolName;
            
            // PRIORITY 1: Get tier from active subscription
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/f48af9d6-9953-4cb6-83b3-cbebe5169087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTeacherDashboard.ts:158',message:'Before subscription query',data:{schoolIdToUse},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'T2'})}).catch(()=>{});
            // #endregion
            const { data: subscription } = await supabase
              .from('subscriptions')
              .select(`
                id,
                plan_id,
                status,
                subscription_plans!inner(tier)
              `)
              .eq('school_id', schoolIdToUse)
              .in('status', ['active', 'trialing'])
              .maybeSingle();
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/f48af9d6-9953-4cb6-83b3-cbebe5169087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTeacherDashboard.ts:170',message:'After subscription query',data:{hasSubscription:!!subscription,subscriptionTier:subscription?.subscription_plans?.tier},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'T2'})}).catch(()=>{});
            // #endregion
            if (subscription?.subscription_plans?.tier) {
              schoolTier = subscription.subscription_plans.tier as any;
              log('🎓 School tier from subscription:', schoolTier);
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/f48af9d6-9953-4cb6-83b3-cbebe5169087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTeacherDashboard.ts:172',message:'Tier set from subscription',data:{schoolTier},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'T2'})}).catch(()=>{});
              // #endregion
            } else {
              // PRIORITY 2: Fallback to preschool's subscription_tier column
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/f48af9d6-9953-4cb6-83b3-cbebe5169087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTeacherDashboard.ts:174',message:'Subscription not found, checking preschool tier',data:{schoolIdToUse},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'T3'})}).catch(()=>{});
              // #endregion
              const { data: preschoolData } = await supabase
                .from('preschools')
                .select('subscription_tier')
                .eq('id', schoolIdToUse)
                .maybeSingle();
              
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/f48af9d6-9953-4cb6-83b3-cbebe5169087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTeacherDashboard.ts:182',message:'After preschool tier query',data:{hasTier:!!preschoolData?.subscription_tier,tier:preschoolData?.subscription_tier},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'T3'})}).catch(()=>{});
              // #endregion
              if (preschoolData?.subscription_tier) {
                schoolTier = preschoolData.subscription_tier as any;
                log('🏫 School tier from preschool.subscription_tier:', schoolTier);
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/f48af9d6-9953-4cb6-83b3-cbebe5169087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTeacherDashboard.ts:184',message:'Tier set from preschool',data:{schoolTier},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'T3'})}).catch(()=>{});
                // #endregion
              }
            }
          } else {
            // Fallback: schoolIdToUse might be an organization ID
            const { data: org } = await supabase
              .from('organizations')
              .select('id, name, plan_tier')
              .eq('id', schoolIdToUse)
              .maybeSingle();
            schoolName = org?.name || schoolName;
            schoolTier = (org?.plan_tier as any) || 'free';
            log('🏢 Fallback tier from organization:', schoolTier);
          }
        }

        // Fetch teacher's classes with student and attendance data
        // Filter by teacher_id, and optionally by preschool_id if available
        let classesQuery = supabase
          .from('classes')
          .select(`
            id,
            name,
            grade_level,
            room_number,
            preschool_id,
            students(id, first_name, last_name)
          `)
          .eq('teacher_id', teacherId);
        
        // Only filter by preschool_id if we have one
        if (schoolIdToUse) {
          classesQuery = classesQuery.eq('preschool_id', schoolIdToUse);
        }
        
        const { data: classesData, error: classesError } = await classesQuery;
        
        if (classesError) {
          logError('Classes fetch error:', classesError);
        }
        
        log('📚 Classes fetched:', { teacherId, schoolIdToUse, classCount: classesData?.length || 0 });

        // Get today's attendance for all teacher's students
        const today = new Date().toISOString().split('T')[0];
        const allStudentIds = classesData?.flatMap(cls => 
          (cls.students as Array<{ id: string }>)?.map((s) => s.id) || []
        ) || [];
        
        let todayAttendanceData: Array<{ student_id: string; status: string }> = [];
        if (allStudentIds.length > 0) {
          const { data: attendanceData } = await supabase
            .from('attendance_records')
            .select('student_id, status')
            .in('student_id', allStudentIds)
            .gte('attendance_date', today + 'T00:00:00')
            .lt('attendance_date', today + 'T23:59:59');
          
          todayAttendanceData = attendanceData || [];
        }

        const myClasses = (classesData || []).map((classItem: Record<string, unknown>) => {
          const classStudents = (classItem.students as Array<{ id: string }>) || [];
          const classStudentIds = classStudents.map((s) => s.id);
          const classAttendance = todayAttendanceData.filter(a => 
            classStudentIds.includes(a.student_id)
          );
          const presentCount = classAttendance.filter(a => a.status === 'present').length;
          const attendanceRate = classStudents.length > 0 
            ? Math.round((presentCount / classStudents.length) * 100)
            : 0;
            
          return {
            id: classItem.id as string,
            name: classItem.name as string,
            studentCount: classStudents.length,
            grade: (classItem.grade_level as string) || 'Grade R',
            room: (classItem.room_number as string) || 'TBD',
            nextLesson: getNextLessonTime(),
            attendanceRate,
            presentToday: presentCount
          };
        }) || [];

        const totalStudents = myClasses.reduce((sum: number, cls) => sum + cls.studentCount, 0);

        // Fetch assignments
        const { data: assignmentsData } = await supabase
          .from('homework_assignments')
          .select(`
            id,
            title,
            due_date,
            is_published,
            homework_submissions!homework_submissions_assignment_id_fkey(
              id,
              status
            )
          `)
          .eq('teacher_id', teacherId)
          .order('created_at', { ascending: false })
          .limit(3);

        // Fetch upcoming events for teacher's school (only if we have a school ID)
        let upcomingEvents: Array<{ id: string; title: string; time: string; type: 'meeting' | 'activity' | 'assessment' }> = [];
        if (schoolIdToUse) {
          const { data: eventsData } = await supabase
            .from('events')
            .select('id, title, event_date, event_type, description')
            .eq('preschool_id', schoolIdToUse)
            .gte('event_date', new Date().toISOString())
            .order('event_date', { ascending: true })
            .limit(5);
          
          upcomingEvents = (eventsData || []).map((event: Record<string, unknown>) => {
            const eventDate = new Date(event.event_date as string);
            
            return {
              id: event.id as string,
              title: event.title as string,
              time: formatEventTime(eventDate),
              type: ((event.event_type as string) || 'event') as 'meeting' | 'activity' | 'assessment'
            };
          });
        }

        const recentAssignments = (assignmentsData || []).map((assignment: Record<string, unknown>) => {
          const submissions = (assignment.homework_submissions as Array<{ status: string }>) || [];
          const submittedCount = submissions.filter((s) => s.status === 'submitted').length;
          const totalCount = submissions.length;

          const derivedStatus = (() => {
            const now = new Date();
            const due = new Date(assignment.due_date as string);
            if (totalCount > 0 && submissions.every((s) => s.status === 'graded')) return 'graded';
            if (due < now) return 'overdue';
            return 'pending';
          })() as 'pending' | 'graded' | 'overdue';
          
          return {
            id: assignment.id as string,
            title: assignment.title as string,
            dueDate: formatDueDate(assignment.due_date as string),
            submitted: submittedCount,
            total: totalCount,
            status: derivedStatus
          };
        }) || [];

        const pendingGrading = recentAssignments
          .filter((a) => a.status === 'pending')
          .reduce((sum: number, a) => sum + a.submitted, 0);

        dashboardData = {
          schoolName,
          schoolTier,
          totalStudents,
          totalClasses: myClasses.length,
          upcomingLessons: Math.min(myClasses.length, 3),
          pendingGrading,
          myClasses,
          recentAssignments,
          upcomingEvents
        };

        if (user?.id && resolvedTeacherUser.preschool_id) {
          await offlineCacheService.cacheTeacherDashboard(
            user.id,
            resolvedTeacherUser.preschool_id as string,
            dashboardData
          );
          log('💾 Teacher dashboard data cached for offline use');
        }
      } else {
        dashboardData = createEmptyTeacherData();
      }

      setData(dashboardData);
    } catch (err) {
      logError('Failed to fetch teacher dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      setData(createEmptyTeacherData());
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

  // Refetch on window focus/visibility change (for web only)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (!document.hidden && data && !loading) {
        log('👁️ Page visible again, refreshing teacher dashboard...');
        fetchData(false);
      }
    };

    const handleFocus = () => {
      if (data && !loading) {
        log('🎯 Window focused, refreshing teacher dashboard...');
        fetchData(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [data, loading, fetchData]);

  return { data, loading, error, refresh, isLoadingFromCache };
};
