/**
 * useTeacherSchool Hook
 * 
 * Provides the current teacher's school ID and school information.
 * Used to scope queries to the teacher's assigned school.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';

export interface TeacherSchool {
  schoolId: string | null;
  schoolName: string | null;
  schoolType: 'preschool' | 'primary' | 'secondary' | 'combined' | null;
  teacherId: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to get the teacher's school information
 * Resolves school ID from multiple sources:
 * 1. Profile organization_id
 * 2. Profile preschool_id  
 * 3. Users table preschool_id
 * 4. Profiles table organization_id
 */
export function useTeacherSchool(): TeacherSchool {
  const { user, profile, loading: authLoading } = useAuth();
  const [state, setState] = useState<TeacherSchool>({
    schoolId: null,
    schoolName: null,
    schoolType: null,
    teacherId: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const fetchSchoolInfo = async () => {
      if (authLoading) return;
      
      if (!user?.id) {
        setState({
          schoolId: null,
          schoolName: null,
          schoolType: null,
          teacherId: null,
          loading: false,
          error: 'User not authenticated',
        });
        return;
      }

      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        
        // Try to get school ID from profile first
        let schoolId = (profile as any)?.organization_id || (profile as any)?.preschool_id;
        let teacherId: string | null = user.id;
        
        // If no school ID in profile, fetch from database
        if (!schoolId) {
          const supabase = assertSupabase();
          
          // Try users table first
          const { data: userData } = await supabase
            .from('users')
            .select('id, preschool_id')
            .eq('auth_user_id', user.id)
            .maybeSingle();
          
          if (userData?.preschool_id) {
            schoolId = userData.preschool_id;
            teacherId = userData.id;
          } else {
            // Fall back to profiles table
            const { data: profileData } = await supabase
              .from('profiles')
              .select('id, preschool_id, organization_id')
              .eq('id', user.id)
              .maybeSingle();
            
            schoolId = profileData?.preschool_id || profileData?.organization_id;
          }
        }
        
        // If we have a school ID, fetch school details
        if (schoolId) {
          const supabase = assertSupabase();
          
          // Try preschools table first
          const { data: school } = await supabase
            .from('preschools')
            .select('id, name, school_type')
            .eq('id', schoolId)
            .maybeSingle();
          
          if (school) {
            setState({
              schoolId,
              schoolName: school.name,
              schoolType: school.school_type || 'preschool',
              teacherId,
              loading: false,
              error: null,
            });
          } else {
            // Try organizations table
            const { data: org } = await supabase
              .from('organizations')
              .select('id, name')
              .eq('id', schoolId)
              .maybeSingle();
            
            setState({
              schoolId,
              schoolName: org?.name || null,
              schoolType: null,
              teacherId,
              loading: false,
              error: null,
            });
          }
        } else {
          setState({
            schoolId: null,
            schoolName: null,
            schoolType: null,
            teacherId,
            loading: false,
            error: 'No school assigned to this teacher',
          });
        }
      } catch (error) {
        console.error('[useTeacherSchool] Error:', error);
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'Failed to fetch school information',
        }));
      }
    };

    fetchSchoolInfo();
  }, [user?.id, profile, authLoading]);

  return state;
}

export default useTeacherSchool;
