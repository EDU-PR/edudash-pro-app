/**
 * useCurriculumControl Hook
 * 
 * Manages curriculum control settings for principals
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';

export interface PreschoolSettings {
  id: string;
  preschool_id: string;
  enable_ai_program: boolean;
  enable_robotics_program: boolean;
  enable_computer_literacy: boolean;
  require_lesson_approval: boolean;
  default_homework_due_days: number;
  stem_curriculum_version: string;
}

export function useCurriculumControl(preschoolId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['preschool-settings', preschoolId],
    queryFn: async (): Promise<PreschoolSettings | null> => {
      if (!preschoolId) return null;

      const supabase = assertSupabase();
      const { data, error } = await supabase
        .from('preschool_settings')
        .select('*')
        .eq('preschool_id', preschoolId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data as PreschoolSettings | null;
    },
    enabled: !!preschoolId,
    staleTime: 60000,
  });

  const updateSettings = useMutation({
    mutationFn: async (updates: Partial<PreschoolSettings>) => {
      if (!preschoolId) throw new Error('Preschool ID is required');

      const supabase = assertSupabase();
      const { error } = await supabase
        .from('preschool_settings')
        .upsert({
          preschool_id: preschoolId,
          ...updates,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'preschool_id',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preschool-settings', preschoolId] });
    },
  });

  return {
    settings,
    isLoading,
    updateSettings: updateSettings.mutate,
    isUpdating: updateSettings.isPending,
  };
}
