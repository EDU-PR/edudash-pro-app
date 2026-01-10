/**
 * useHomePractice Hook
 * 
 * Fetches home practice activities for students
 */

import { useQuery } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';

export interface HomePracticeActivity {
  id: string;
  title: string;
  description: string | null;
  activity_type: string;
  stem_category: 'ai' | 'robotics' | 'computer_literacy' | 'none';
  age_group: string;
  difficulty_level: number;
}

export function useHomePractice(preschoolId: string | undefined, ageGroup?: string) {
  return useQuery({
    queryKey: ['home-practice', preschoolId, ageGroup],
    queryFn: async (): Promise<HomePracticeActivity[]> => {
      if (!preschoolId) return [];
      
      const supabase = assertSupabase();
      let query = supabase
        .from('interactive_activities')
        .select('id, title, description, activity_type, stem_category, age_group, difficulty_level')
        .eq('preschool_id', preschoolId)
        .eq('is_published', true)
        .in('stem_category', ['ai', 'robotics', 'computer_literacy']);

      if (ageGroup) {
        query = query.eq('age_group', ageGroup);
      }

      const { data, error } = await query.order('title');
      
      if (error) throw error;
      return (data || []) as HomePracticeActivity[];
    },
    enabled: !!preschoolId,
    staleTime: 300000, // 5 minutes
  });
}
