// Custom hook for year planner - WARP.md compliant (≤200 lines)

import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { assertSupabase } from '@/lib/supabase';
import type { AcademicTerm } from '@/types/ecd-planning';
import type {
  TermFormData,
  YearPlannerState,
  YearPlannerActions,
  YearPlanMonthlyEntryRow,
} from '@/components/principal/year-planner/types';

interface UseYearPlannerProps {
  orgId: string | null;
  userId: string | undefined;
}

interface UseYearPlannerReturn extends YearPlannerState, YearPlannerActions {}

export function useYearPlanner({ orgId, userId }: UseYearPlannerProps): UseYearPlannerReturn {
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [monthlyEntries, setMonthlyEntries] = useState<YearPlanMonthlyEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTerms = useCallback(async () => {
    if (!orgId) return;

    try {
      const supabase = assertSupabase();
      const [termsRes, entriesRes] = await Promise.all([
        supabase
          .from('academic_terms')
          .select('*')
          .eq('preschool_id', orgId)
          .order('academic_year', { ascending: false })
          .order('term_number', { ascending: true }),
        supabase
          .from('year_plan_monthly_entries')
          .select('id, preschool_id, academic_year, month_index, bucket, subtype, title, details, start_date, end_date, is_published')
          .eq('preschool_id', orgId)
          .order('academic_year', { ascending: false })
          .order('month_index', { ascending: true }),
      ]);

      if (termsRes.error) throw termsRes.error;
      setTerms(termsRes.data || []);

      if (entriesRes.error) throw entriesRes.error;
      setMonthlyEntries((entriesRes.data as YearPlanMonthlyEntryRow[]) || []);
    } catch (error: unknown) {
      console.error('Error fetching year planner:', error);
      Alert.alert('Error', 'Failed to load year planner');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchTerms();
  }, [fetchTerms]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTerms();
  };

  const handleSubmit = async (
    formData: TermFormData,
    editingTerm: AcademicTerm | null
  ): Promise<boolean> => {
    if (!formData.name.trim()) {
      Alert.alert('Validation Error', 'Please enter a term name');
      return false;
    }

    if (!orgId || !userId) {
      Alert.alert('Error', 'Organization or user not found');
      return false;
    }

    try {
      const supabase = assertSupabase();

      const termData = {
        preschool_id: orgId,
        created_by: userId,
        name: formData.name.trim(),
        academic_year: formData.academic_year,
        term_number: formData.term_number,
        start_date: formData.start_date.toISOString().split('T')[0],
        end_date: formData.end_date.toISOString().split('T')[0],
        description: formData.description.trim() || null,
        is_active: formData.is_active,
        is_published: formData.is_published,
      };

      if (editingTerm) {
        const { error } = await supabase
          .from('academic_terms')
          .update(termData)
          .eq('id', editingTerm.id);

        if (error) throw error;
        Alert.alert('Success', 'Term updated successfully');
      } else {
        const { error } = await supabase.from('academic_terms').insert(termData);

        if (error) throw error;
        Alert.alert('Success', 'Term created successfully');
      }

      await fetchTerms();
      return true;
    } catch (error: any) {
      console.error('Error saving term:', error);
      Alert.alert('Error', error.message || 'Failed to save term');
      return false;
    }
  };

  const handleDelete = (term: AcademicTerm) => {
    Alert.alert('Delete Term', `Are you sure you want to delete "${term.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const supabase = assertSupabase();
            const { error } = await supabase.from('academic_terms').delete().eq('id', term.id);

            if (error) throw error;
            Alert.alert('Success', 'Term deleted successfully');
            fetchTerms();
          } catch (error: any) {
            console.error('Error deleting term:', error);
            Alert.alert('Error', 'Failed to delete term');
          }
        },
      },
    ]);
  };

  const handleTogglePublish = async (term: AcademicTerm) => {
    try {
      const supabase = assertSupabase();
      const { error } = await supabase
        .from('academic_terms')
        .update({ is_published: !term.is_published })
        .eq('id', term.id);

      if (error) throw error;
      fetchTerms();
    } catch (error: any) {
      Alert.alert('Error', 'Failed to update term');
    }
  };

  return {
    terms,
    monthlyEntries,
    loading,
    refreshing,
    fetchTerms,
    handleRefresh,
    handleSubmit,
    handleDelete,
    handleTogglePublish,
  };
}
