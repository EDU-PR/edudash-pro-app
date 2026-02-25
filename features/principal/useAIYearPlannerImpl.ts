// Hook for Principal AI Year Planner — thin orchestration layer
// Composes: generation → normalization → SA holiday injection → display
// Composes: save → persistence

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { assertSupabase } from '@/lib/supabase';
import { generateMockYearPlan } from '@/lib/utils/mock-year-plan';
import type {
  YearPlanConfig,
  GeneratedYearPlan,
} from '@/components/principal/ai-planner/types';
import { normalizeGeneratedPlan } from './year-planner/normalizers';
import { injectSAHolidaysIntoMonthlyEntries } from './year-planner/saHolidays';
import {
  generateYearPlanViaAI,
  isAuthRelatedErrorMessage,
} from './year-planner/generation';
import {
  mapPlanToRpcPayload,
  persistTermsAndThemesFallback,
  loadTermIdMap,
  persistExcursionsMeetingsAndEvents,
} from './year-planner/persistence';

interface UseAIYearPlannerOptions {
  organizationId?: string;
  userId?: string;
  onShowAlert?: (config: {
    title: string;
    message?: string;
    type?: 'info' | 'warning' | 'success' | 'error';
    buttons?: Array<{
      text: string;
      onPress?: () => void;
      style?: 'default' | 'cancel' | 'destructive';
    }>;
  }) => void;
}

interface UseAIYearPlannerReturn {
  generatedPlan: GeneratedYearPlan | null;
  isGenerating: boolean;
  isSaving: boolean;
  expandedTerm: number | null;
  setExpandedTerm: (termNumber: number | null) => void;
  generateYearPlan: (config: YearPlanConfig) => Promise<void>;
  savePlanToDatabase: () => Promise<void>;
  updatePlan: (updater: (plan: GeneratedYearPlan) => GeneratedYearPlan) => void;
}

export function useAIYearPlanner({
  organizationId,
  userId,
  onShowAlert,
}: UseAIYearPlannerOptions): UseAIYearPlannerReturn {
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedYearPlan | null>(null);
  const [generationConfig, setGenerationConfig] = useState<YearPlanConfig | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedTerm, setExpandedTerm] = useState<number | null>(null);

  const showPlannerAlert = useCallback(
    (config: {
      title: string;
      message?: string;
      type?: 'info' | 'warning' | 'success' | 'error';
      buttons?: Array<{
        text: string;
        onPress?: () => void;
        style?: 'default' | 'cancel' | 'destructive';
      }>;
    }) => {
      if (onShowAlert) {
        onShowAlert(config);
        return;
      }
      Alert.alert(config.title, config.message || '', config.buttons as any);
    },
    [onShowAlert],
  );

  // ── Generate → Normalize → Inject SA holidays → Display ────────────────

  const generateYearPlan = useCallback(
    async (config: YearPlanConfig) => {
      if (config.ageGroups.length === 0) {
        showPlannerAlert({ title: 'Validation Error', message: 'Please select at least one age group', type: 'warning' });
        return;
      }
      if (config.focusAreas.length === 0) {
        showPlannerAlert({ title: 'Validation Error', message: 'Please select at least one focus area', type: 'warning' });
        return;
      }

      setIsGenerating(true);

      try {
        const { parsed, rawTermCount } = await generateYearPlanViaAI({
          config,
          organizationId,
        });

        let normalized = normalizeGeneratedPlan(parsed, config);
        normalized = {
          ...normalized,
          monthlyEntries: injectSAHolidaysIntoMonthlyEntries(
            normalized.monthlyEntries,
            config.academicYear,
          ),
        };

        setGeneratedPlan(normalized);
        setGenerationConfig(config);
        setExpandedTerm(normalized.terms[0]?.termNumber ?? null);

        if (rawTermCount !== config.numberOfTerms) {
          showPlannerAlert({
            title: 'Plan normalized',
            message: `Dash returned ${rawTermCount || 0} term(s). The planner normalized this to ${config.numberOfTerms} term(s) so all quarters are fully wired.`,
            type: 'info',
          });
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error || 'Unknown error');
        console.error('AI generation error:', error);

        if (isAuthRelatedErrorMessage(errorMessage)) {
          showPlannerAlert({
            title: 'Session expired',
            message: 'Please sign in again, then generate the year plan again.',
            type: 'error',
            buttons: [{ text: 'OK' }],
          });
          return;
        }

        if (__DEV__) {
          console.warn('[AI Year Planner] Falling back to demo plan due to generation error:', errorMessage);
        }

        let mockPlan = normalizeGeneratedPlan(generateMockYearPlan(config), config);
        mockPlan = {
          ...mockPlan,
          monthlyEntries: injectSAHolidaysIntoMonthlyEntries(
            mockPlan.monthlyEntries,
            config.academicYear,
          ),
        };

        setGeneratedPlan(mockPlan);
        setGenerationConfig(config);
        setExpandedTerm(mockPlan.terms[0]?.termNumber ?? null);

        showPlannerAlert({
          title: 'Using Demo Plan',
          message: 'AI service unavailable. Showing a sample plan instead.',
          type: 'warning',
          buttons: [{ text: 'OK' }],
        });
      } finally {
        setIsGenerating(false);
      }
    },
    [organizationId, showPlannerAlert],
  );

  // ── Save → Persistence ─────────────────────────────────────────────────

  const savePlanToDatabase = useCallback(async () => {
    if (!generatedPlan || !organizationId || !userId) {
      showPlannerAlert({ title: 'Missing details', message: 'Please generate a plan and ensure your profile is loaded.', type: 'warning' });
      return;
    }

    const config = generationConfig || {
      academicYear: generatedPlan.academicYear,
      numberOfTerms: generatedPlan.terms.length || 4,
      ageGroups: ['3-4', '4-5', '5-6'],
      focusAreas: ['Language Development', 'Numeracy & Math', 'Physical Development'],
      planningFramework: 'caps_ncf_hybrid' as const,
      strictTemplateMode: false,
      separateAgeGroupTracks: true,
      includeExcursions: true,
      includeMeetings: true,
      includeAssessmentGuidance: true,
      includeInclusionAdaptations: true,
      includeHomeLinkExtensions: true,
      budgetLevel: 'medium' as const,
      principalRules: '',
      specialConsiderations: '',
    };

    const normalizedPlan = normalizeGeneratedPlan(generatedPlan, config);
    setGeneratedPlan(normalizedPlan);
    setIsSaving(true);

    try {
      const supabase = assertSupabase();
      let termsSaved = 0;
      let themesSaved = 0;
      let monthlySaved = 0;
      let usedRpc = false;
      let usedV2 = false;
      let syncedEvents = 0;
      let syncedMeetings = 0;
      let syncedExcursions = 0;

      try {
        const { data, error } = await supabase.rpc('save_ai_year_plan_v2', {
          p_preschool_id: organizationId,
          p_created_by: userId,
          p_plan: mapPlanToRpcPayload(normalizedPlan, config),
          p_sync_calendar: true,
        });
        if (error) throw error;
        usedRpc = true;
        usedV2 = true;
        termsSaved = Number((data as any)?.terms_saved) || normalizedPlan.terms.length;
        themesSaved = Number((data as any)?.themes_saved) || 0;
        monthlySaved = Number((data as any)?.monthly_entries_saved) || normalizedPlan.monthlyEntries.length;
        syncedEvents = Number((data as any)?.events_synced) || 0;
        syncedMeetings = Number((data as any)?.meetings_synced) || 0;
        syncedExcursions = Number((data as any)?.excursions_synced) || 0;
      } catch (v2Error) {
        try {
          const { data, error } = await supabase.rpc('save_ai_year_plan', {
            p_preschool_id: organizationId,
            p_created_by: userId,
            p_plan: mapPlanToRpcPayload(normalizedPlan, config),
          });
          if (error) throw error;
          usedRpc = true;
          termsSaved = Number((data as any)?.terms_saved) || normalizedPlan.terms.length;
          themesSaved = Number((data as any)?.themes_saved) || 0;
          monthlySaved = normalizedPlan.monthlyEntries.length;
        } catch (legacyRpcError) {
          console.warn('Year plan RPC unavailable, using fallback persistence:', { v2Error, legacyRpcError });
          const fallbackSaved = await persistTermsAndThemesFallback({ organizationId, userId, plan: normalizedPlan, config });
          termsSaved = fallbackSaved.termsSaved;
          themesSaved = fallbackSaved.themesSaved;
          monthlySaved = normalizedPlan.monthlyEntries.length;
        }
      }

      if (!usedV2) {
        const termIdMap = await loadTermIdMap({
          organizationId,
          academicYear: normalizedPlan.academicYear,
          termNumbers: normalizedPlan.terms.map((term) => term.termNumber),
        });
        const extraSaved = await persistExcursionsMeetingsAndEvents({ organizationId, userId, plan: normalizedPlan, config, termIdMap });
        syncedExcursions = extraSaved.excursionsSaved;
        syncedMeetings = extraSaved.meetingsSaved;
        syncedEvents = extraSaved.specialEventsSaved;
      }

      showPlannerAlert({
        title: 'Success',
        message: [
          `Year plan saved successfully (${usedV2 ? 'v2 monthly model' : usedRpc ? 'legacy transactional' : 'fallback'} mode).`,
          `Terms: ${termsSaved}`,
          `Weekly themes: ${themesSaved}`,
          `Monthly items: ${monthlySaved}`,
          `Calendar sync - events: ${syncedEvents}`,
          `Calendar sync - meetings: ${syncedMeetings}`,
          `Calendar sync - excursions: ${syncedExcursions}`,
        ].join('\n'),
        type: 'success',
        buttons: [
          { text: 'View Terms', onPress: () => router.push('/screens/principal-year-planner') },
          { text: 'OK' },
        ],
      });
    } catch (error: unknown) {
      console.error('Error saving plan:', error);
      showPlannerAlert({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to save plan. Please try again.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  }, [generatedPlan, generationConfig, organizationId, userId, showPlannerAlert]);

  const updatePlan = useCallback((updater: (plan: GeneratedYearPlan) => GeneratedYearPlan) => {
    setGeneratedPlan((prev) => (prev ? updater(prev) : prev));
  }, []);

  return {
    generatedPlan,
    isGenerating,
    isSaving,
    expandedTerm,
    setExpandedTerm,
    generateYearPlan,
    savePlanToDatabase,
    updatePlan,
  };
}
