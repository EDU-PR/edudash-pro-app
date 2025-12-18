/**
 * Principal Dashboard Hook
 * 
 * Fetches and manages principal dashboard data.
 * Extracted from hooks/useDashboardData.ts per WARP.md standards.
 */

import { useState, useEffect, useCallback } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { offlineCacheService } from '@/lib/services/offlineCacheService';
import { log, warn, debug, error as logError } from '@/lib/debug';
import type { PrincipalDashboardData } from '@/types/dashboard';
import {
  formatTimeAgo,
  calculateEstimatedRevenue,
  calculateAttendanceRate,
  mapActivityType,
  createEmptyPrincipalData,
} from '@/lib/dashboard/utils';
import {
  resolveOrgIdentifier,
  lookupOrganization,
  type OrganizationData,
} from '@/lib/dashboard/organizationLookup';

/**
 * Comprehensive Principal Dashboard Hook with Real Data Integration
 * Provides complete school management analytics and real-time updates
 */
export const usePrincipalDashboard = () => {
  const { user, profile } = useAuth();
  const [data, setData] = useState<PrincipalDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isLoadingFromCache, setIsLoadingFromCache] = useState(false);

  const fetchData = useCallback(async (forceRefresh = false) => {
    const startTime = Date.now();
    
    // Prevent data fetching during dashboard switches
    if (typeof window !== 'undefined' && (window as unknown as { dashboardSwitching?: boolean }).dashboardSwitching) {
      console.log('🏫 Skipping principal dashboard data fetch during switch');
      return;
    }
    
    log('🏫 Loading Principal Dashboard data...');
    
    try {
      setLoading(true);
      setError(null);
      setLastRefresh(new Date());

      // Try to load from cache first (unless forced refresh)
      if (!forceRefresh && user?.id) {
        setIsLoadingFromCache(true);
        const cachedData = await offlineCacheService.getPrincipalDashboard(
          user.id, 
          user.user_metadata?.school_id || 'unknown'
        );
        
        if (cachedData) {
          log('📱 Loading from cache...');
          setData(cachedData);
          setLoading(false);
          setIsLoadingFromCache(false);
          setTimeout(() => fetchData(true), 100);
          return;
        }
        setIsLoadingFromCache(false);
      }

      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      assertSupabase();
      
      log('Using profile from auth context for organization lookup');
      const userProfile = profile;
      
      if (!userProfile) {
        throw new Error('No user profile available - user not properly authenticated');
      }

      // Use centralized organization lookup
      const orgIdentifier = resolveOrgIdentifier(
        userProfile as unknown as Record<string, unknown>,
        user
      );
      
      const principalData: OrganizationData | null = await lookupOrganization(
        orgIdentifier,
        userProfile.id as string,
        user.id
      );

      let dashboardData: PrincipalDashboardData;

      if (principalData) {
        const schoolId = principalData.id;
        const schoolName = principalData.name || 'Unknown School';
        log(`📚 Loading data for ${schoolName} (ID: ${schoolId})`);

        debug('🔍 DEBUG: Starting parallel data fetch for schoolId:', schoolId);
        
        const authenticatedClient = assertSupabase();
        
        try {
          const { data: me } = await authenticatedClient.auth.getUser();
          debug('🔐 RLS DEBUG - auth user id:', me?.user?.id);
        } catch (e) {
          debug('RLS auth getUser failed', e);
        }
        
        const dataPromises = [
          authenticatedClient
            .from('students')
            .select('id, first_name, last_name, created_at, preschool_id, is_active, class_id')
            .eq('preschool_id', schoolId)
            .eq('is_active', true)
            .not('id', 'is', null),

          authenticatedClient
            .from('organization_members')
            .select('user_id')
            .eq('organization_id', schoolId)
            .eq('role', 'teacher'),

          authenticatedClient
            .from('organization_members')
            .select('user_id')
            .eq('organization_id', schoolId)
            .eq('role', 'parent'),

          authenticatedClient
            .from('payments')
            .select('amount, created_at, status, payment_type, school_id, organization_id')
            .or(`school_id.eq.${schoolId},organization_id.eq.${schoolId}`)
            .gte('created_at', new Date(new Date().setDate(new Date().getDate() - 60)).toISOString())
            .not('id', 'is', null),

          authenticatedClient
            .from('preschool_onboarding_requests')
            .select('id, school_name, created_at, status, organization_id')
            .or(`organization_id.eq.${schoolId},preschool_id.eq.${schoolId}`)
            .in('status', ['pending', 'under_review', 'interview_scheduled'])
            .not('id', 'is', null),

          authenticatedClient
            .from('events')
            .select('id, title, event_date, event_type, description, preschool_id, organization_id')
            .or(`preschool_id.eq.${schoolId},organization_id.eq.${schoolId}`)
            .gte('event_date', new Date().toISOString())
            .lte('event_date', new Date(new Date().setDate(new Date().getDate() + 30)).toISOString())
            .not('id', 'is', null),

          authenticatedClient
            .from('activity_logs')
            .select('id, activity_type, description, created_at, user_name, table_name, organization_id')
            .eq('organization_id', schoolId)
            .not('id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(10)
        ];

        const results = await Promise.allSettled(dataPromises);
        const [
          studentsResult, 
          teacherMembersResult, 
          parentMembersResult, 
          paymentsResult, 
          applicationsResult, 
          eventsResult, 
          activitiesResult
        ] = results;

        const studentsData = studentsResult.status === 'fulfilled' ? studentsResult.value.data || [] : [];
        const teacherMembersData = teacherMembersResult.status === 'fulfilled' ? teacherMembersResult.value.data || [] : [];
        const parentMembersData = parentMembersResult.status === 'fulfilled' ? parentMembersResult.value.data || [] : [];
        const paymentsData = paymentsResult.status === 'fulfilled' ? paymentsResult.value.data || [] : [];
        const applicationsData = applicationsResult.status === 'fulfilled' ? applicationsResult.value.data || [] : [];
        const eventsData = eventsResult.status === 'fulfilled' ? eventsResult.value.data || [] : [];
        const activitiesData = activitiesResult.status === 'fulfilled' ? activitiesResult.value.data || [] : [];

        // Fetch teacher and parent users by membership
        let teacherUsersData: Array<Record<string, unknown>> = [];
        let parentUsersData: Array<Record<string, unknown>> = [];
        try {
          if (teacherMembersData.length > 0) {
            const teacherIds = (teacherMembersData as Array<{ user_id: string }>)
              .map((m) => m.user_id)
              .filter((v) => !!v);
            if (teacherIds.length > 0) {
              const { data: tUsers } = await authenticatedClient
                .from('users')
                .select('id, name, email, role, preschool_id, auth_user_id')
                .in('auth_user_id', teacherIds)
                .eq('role', 'teacher');
              teacherUsersData = tUsers || [];
            }
          }
          if (parentMembersData.length > 0) {
            const parentIds = (parentMembersData as Array<{ user_id: string }>)
              .map((m) => m.user_id)
              .filter((v) => !!v);
            if (parentIds.length > 0) {
              const { data: pUsers } = await authenticatedClient
                .from('users')
                .select('id, name, email, role, preschool_id, auth_user_id')
                .in('auth_user_id', parentIds)
                .eq('role', 'parent');
              parentUsersData = pUsers || [];
            }
          }
        } catch (fetchUsersErr) {
          warn('Teacher/Parent user detail fetch by membership failed:', fetchUsersErr);
        }

        debug('🔍 DEBUG DATA RESULTS:');
        debug('- Students:', studentsData.length);
        debug('- Teacher Members:', teacherMembersData.length);
        debug('- Parent Members:', parentMembersData.length);
        debug('- Payments:', paymentsData.length);
        debug('- Applications:', applicationsData.length);
        debug('- Events:', eventsData.length);
        debug('- Activities:', activitiesData.length);

        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            const queries = ['students', 'teacher_members', 'parent_members', 'payments', 'applications', 'events', 'activities'];
            logError(`❌ ${queries[index]} query failed:`, result.reason);
          }
        });

        const totalStudents = studentsData.length;
        const totalTeachers = teacherUsersData.length || teacherMembersData.length;
        const totalParents = parentUsersData.length || parentMembersData.length;

        let attendanceRate = 0;
        try {
          attendanceRate = await calculateAttendanceRate(schoolId);
        } catch (err) {
          warn('Failed to calculate attendance rate:', err);
        }

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        const currentMonthPayments = paymentsData.filter((p: Record<string, unknown>) => {
          if (!p?.created_at || p?.status !== 'completed') return false;
          const paymentDate = new Date(p.created_at as string);
          return paymentDate >= monthStart && paymentDate <= monthEnd;
        });
        
        let monthlyRevenue = currentMonthPayments.reduce((sum: number, payment: Record<string, unknown>) => {
          const amount = (payment?.amount as number) || 0;
          return sum + (amount > 1000 ? amount / 100 : amount);
        }, 0);
        
        if (monthlyRevenue === 0 && paymentsData.length === 0 && totalStudents > 0) {
          monthlyRevenue = calculateEstimatedRevenue(totalStudents);
        }

        const pendingApplications = applicationsData.length;
        const upcomingEvents = eventsData.length;
        const capacity = principalData.capacity ?? 0;
        const enrollmentPercentage = capacity > 0 ? Math.round((totalStudents / capacity) * 100) : 0;

        let recentActivity = activitiesData.map((activity: Record<string, unknown>) => ({
          id: (activity?.id as string) || 'unknown',
          type: mapActivityType((activity?.action_type as string) || 'event') as 'enrollment' | 'payment' | 'teacher' | 'event',
          message: (activity?.description as string) || `${(activity?.action_type as string) || 'Unknown'} activity`,
          time: formatTimeAgo((activity?.created_at as string) || new Date().toISOString()),
          userName: (activity?.user_name as string) || 'System'
        }));

        if (recentActivity.length === 0) {
          recentActivity = [
            {
              id: 'synthetic-students',
              type: 'enrollment' as const,
              message: `${totalStudents} students currently enrolled`,
              time: 'Currently',
              userName: 'System'
            },
            {
              id: 'synthetic-teachers',
              type: 'teacher' as const,
              message: `${totalTeachers} active teaching staff members`,
              time: 'Currently',
              userName: 'System'
            }
          ];
          
          if (pendingApplications > 0) {
            recentActivity.push({
              id: 'synthetic-applications',
              type: 'enrollment' as const,
              message: `${pendingApplications} pending applications awaiting review`,
              time: 'Pending',
              userName: 'System'
            });
          }
        }

        dashboardData = {
          schoolId,
          schoolName,
          totalStudents,
          totalTeachers,
          totalParents,
          attendanceRate: Math.round(attendanceRate * 10) / 10,
          monthlyRevenue: Math.round(monthlyRevenue),
          pendingApplications,
          upcomingEvents,
          capacity,
          enrollmentPercentage,
          lastUpdated: new Date().toISOString(),
          recentActivity: recentActivity.slice(0, 8)
        };

        const loadTime = Date.now() - startTime;
        log(`✅ Dashboard data loaded successfully in ${loadTime}ms`);

        if (user?.id) {
          await offlineCacheService.cachePrincipalDashboard(user.id, schoolId, dashboardData);
          log('💾 Dashboard data cached for offline use');
        }

      } else {
        warn('⚠️ No school found for this principal');
        dashboardData = {
          ...createEmptyPrincipalData('No School Assigned'),
          schoolId: undefined,
          lastUpdated: new Date().toISOString(),
          recentActivity: [
            {
              id: 'no-school',
              type: 'event',
              message: 'No school assigned to this principal account',
              time: 'Now',
              userName: 'System'
            }
          ]
        };
      }

      setData(dashboardData);
    } catch (err) {
      logError('❌ Failed to fetch principal dashboard data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      
      setData({
        ...createEmptyPrincipalData('Database Error'),
        schoolId: 'error-fallback',
        lastUpdated: new Date().toISOString(),
        recentActivity: [
          {
            id: 'error-notice',
            type: 'event',
            message: `Dashboard error: ${errorMessage}`,
            time: 'Just now',
            userName: 'System'
          }
        ]
      });
    } finally {
      setLoading(false);
    }
  }, [user, profile]);

  useEffect(() => {
    if (user?.id) {
      fetchData();
    } else {
      setData(null);
      setLoading(false);
      setError(null);
    }
  }, [fetchData, user]);

  const refresh = useCallback(() => {
    log('🔄 Refreshing Principal Dashboard data...');
    fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    if (!data || loading) return;

    const interval = setInterval(() => {
      log('⏰ Auto-refreshing Principal Dashboard');
      fetchData();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchData, data, loading]);

  return {
    data,
    loading,
    error,
    refresh,
    lastRefresh,
    isLoadingFromCache
  };
};
