/**
 * Hook for AI term suggestions on Create/Edit Term (ECD-aware, semester-aware).
 * Used by TermFormModal (native) and Year Planner web form.
 */

import { useState, useCallback } from 'react';
import { TermSuggestionAIService, type TermSuggestionResult } from '@/lib/services/TermSuggestionAIService';
import type { TermFormData } from '@/components/principal/year-planner/types';

export interface UseTermSuggestionAIOptions {
  /** ECD vs school context for prompts */
  context?: 'ecd' | 'preschool' | 'school';
  onError?: (message: string) => void;
}

export interface UseTermSuggestionAIReturn {
  suggest: (current: TermFormData) => Promise<TermSuggestionResult | null>;
  isBusy: boolean;
  error: string | null;
  lastResult: TermSuggestionResult | null;
  /** Apply last result to native form (Date for start/end). Pass current form and setter. */
  applyToNativeForm: (current: TermFormData, setFormData: (data: TermFormData) => void) => void;
  /** Apply last result to web form (start_date/end_date as YYYY-MM-DD). Pass current form and setter. */
  applyToWebForm: (current: WebTermFormData, setFormData: (data: WebTermFormData) => void) => void;
}

export interface WebTermFormData {
  name: string;
  academic_year: number;
  term_number: number;
  start_date: string;
  end_date: string;
  description: string;
  is_active: boolean;
  is_published: boolean;
}

export function useTermSuggestionAI(
  options: UseTermSuggestionAIOptions = {}
): UseTermSuggestionAIReturn {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<TermSuggestionResult | null>(null);
  const { context = 'ecd', onError } = options;

  const suggest = useCallback(
    async (current: TermFormData): Promise<TermSuggestionResult | null> => {
      setError(null);
      setLastResult(null);
      setIsBusy(true);
      try {
        const result = await TermSuggestionAIService.suggest({
          academic_year: current.academic_year,
          term_number: current.term_number,
          existing_name: current.name || null,
          existing_description: current.description || null,
          context,
        });
        setLastResult(result);
        return result;
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'AI suggestion failed';
        setError(message);
        onError?.(message);
        return null;
      } finally {
        setIsBusy(false);
      }
    },
    [context, onError]
  );

  const applyToNativeForm = useCallback(
    (current: TermFormData, setFormData: (data: TermFormData) => void) => {
      const r = lastResult;
      if (!r) return;
      setFormData({
        ...current,
        name: r.suggested_name || current.name,
        description: r.suggested_description || current.description,
        start_date: r.suggested_start_date
          ? new Date(r.suggested_start_date + 'T00:00:00.000Z')
          : current.start_date,
        end_date: r.suggested_end_date
          ? new Date(r.suggested_end_date + 'T00:00:00.000Z')
          : current.end_date,
      });
    },
    [lastResult]
  );

  const applyToWebForm = useCallback(
    (current: WebTermFormData, setFormData: (data: WebTermFormData) => void) => {
      const r = lastResult;
      if (!r) return;
      setFormData({
        ...current,
        name: r.suggested_name || current.name,
        description: r.suggested_description || current.description,
        start_date: r.suggested_start_date || current.start_date,
        end_date: r.suggested_end_date || current.end_date,
      });
    },
    [lastResult]
  );

  return {
    suggest,
    isBusy,
    error,
    lastResult,
    applyToNativeForm,
    applyToWebForm,
  };
}
