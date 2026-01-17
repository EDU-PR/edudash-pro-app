// Hook for Principal AI Year Planner - Refactored for WARP.md compliance
// Manages AI-assisted year plan generation and database persistence

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { assertSupabase } from '@/lib/supabase';
import { generateMockYearPlan } from '@/lib/utils/mock-year-plan';
import { YEAR_PLAN_SYSTEM_PROMPT, buildYearPlanUserPrompt } from '@/lib/utils/ai-year-plan-prompts';
import type {
  YearPlanConfig,
  GeneratedYearPlan,
} from '@/components/principal/ai-planner/types';

interface UseAIYearPlannerOptions {
  organizationId?: string;
  userId?: string;
}

interface UseAIYearPlannerReturn {
  generatedPlan: GeneratedYearPlan | null;
  isGenerating: boolean;
  isSaving: boolean;
  expandedTerm: number | null;
  setExpandedTerm: (termNumber: number | null) => void;
  generateYearPlan: (config: YearPlanConfig) => Promise<void>;
  savePlanToDatabase: () => Promise<void>;
}

export function useAIYearPlanner({
  organizationId,
  userId,
}: UseAIYearPlannerOptions): UseAIYearPlannerReturn {
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedYearPlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedTerm, setExpandedTerm] = useState<number | null>(null);

  const generateYearPlan = useCallback(async (config: YearPlanConfig) => {
    if (config.ageGroups.length === 0) {
      Alert.alert('Validation Error', 'Please select at least one age group');
      return;
    }
    
    if (config.focusAreas.length === 0) {
      Alert.alert('Validation Error', 'Please select at least one focus area');
      return;
    }
    
    setIsGenerating(true);
    
    try {
      const supabase = assertSupabase();
      const session = await supabase.auth.getSession();
      
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://lvvvjywrmpcqrpvuptdi.supabase.co'}/functions/v1/ai-proxy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.data.session?.access_token}`,
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            messages: [
              { role: 'system', content: YEAR_PLAN_SYSTEM_PROMPT },
              { role: 'user', content: buildYearPlanUserPrompt(config) },
            ],
            max_tokens: 4000,
          }),
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to generate plan');
      }
      
      const data = await response.json();
      const content = data.content?.[0]?.text || data.message?.content || '';
      
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const plan = JSON.parse(jsonMatch[0]) as GeneratedYearPlan;
        setGeneratedPlan(plan);
      } else {
        throw new Error('Could not parse AI response');
      }
    } catch (error: any) {
      console.error('AI generation error:', error);
      const mockPlan = generateMockYearPlan(config);
      setGeneratedPlan(mockPlan);
      Alert.alert(
        'Using Demo Plan',
        'AI service unavailable. Showing a sample plan instead.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const savePlanToDatabase = useCallback(async () => {
    if (!generatedPlan || !organizationId) return;
    
    setIsSaving(true);
    
    try {
      const supabase = assertSupabase();
      
      for (const term of generatedPlan.terms) {
        const { data: termData, error: termError } = await supabase
          .from('academic_terms')
          .insert({
            preschool_id: organizationId,
            name: term.name,
            academic_year: generatedPlan.academicYear,
            term_number: term.termNumber,
            start_date: term.startDate,
            end_date: term.endDate,
            is_published: false,
          })
          .select()
          .single();
        
        if (termError) {
          console.error('Error saving term:', termError);
          continue;
        }
        
        for (const excursion of term.excursions) {
          await supabase.from('school_excursions').insert({
            preschool_id: organizationId,
            created_by: userId,
            title: excursion.title,
            destination: excursion.destination,
            excursion_date: excursion.suggestedDate,
            learning_objectives: excursion.learningObjectives,
            term_id: termData.id,
            status: 'draft',
          });
        }
        
        for (const meeting of term.meetings) {
          await supabase.from('school_meetings').insert({
            preschool_id: organizationId,
            created_by: userId,
            title: meeting.title,
            meeting_type: meeting.type as any,
            meeting_date: meeting.suggestedDate,
            start_time: '09:00',
            agenda_items: meeting.agenda.map(a => ({ title: a })),
            status: 'draft',
          });
        }
      }
      
      Alert.alert('Success', 'Year plan saved to your database. You can now edit individual items.', [
        { text: 'View Terms', onPress: () => router.push('/screens/principal-year-planner') },
        { text: 'OK' },
      ]);
    } catch (error: any) {
      console.error('Error saving plan:', error);
      Alert.alert('Error', 'Failed to save plan. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [generatedPlan, organizationId, userId]);

  return {
    generatedPlan,
    isGenerating,
    isSaving,
    expandedTerm,
    setExpandedTerm,
    generateYearPlan,
    savePlanToDatabase,
  };
}
