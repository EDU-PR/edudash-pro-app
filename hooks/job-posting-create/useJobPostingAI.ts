/** AI suggestions helpers — extracted from job-posting-create */
import { useCallback, useMemo, useState } from 'react';
import { formatEmploymentType, formatSalaryRange } from '@/lib/hiring/jobPostingShare';
import { JobPostingAIService, type JobPostingAISuggestions } from '@/lib/services/JobPostingAIService';
import type { SchoolInfo, ShowAlert } from './types';

interface Params {
  form: {
    title: string; description: string; requirements: string;
    salaryMin: string; salaryMax: string; location: string; employmentType: string;
    setTitle: (fn: (prev: string) => string) => void;
    setDescription: (fn: (prev: string) => string) => void;
    setRequirements: (fn: (prev: string) => string) => void;
  };
  schoolInfo: SchoolInfo | null;
  profile: any;
  showAlert: ShowAlert;
}

export function useJobPostingAI({ form, schoolInfo, profile, showAlert }: Params) {
  const [aiBusy, setAiBusy] = useState(false);
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<JobPostingAISuggestions | null>(null);
  const [aiUseSuggestedTitle, setAiUseSuggestedTitle] = useState(true);
  const [aiWhatsAppShort, setAiWhatsAppShort] = useState<string | null>(null);
  const [aiWhatsAppLong, setAiWhatsAppLong] = useState<string | null>(null);

  const canUseAISuggestions = useMemo(() => form.title.trim().length > 0, [form.title]);

  const salaryRangeTextForAI = useMemo(() => {
    const min = form.salaryMin.trim() ? Number(form.salaryMin) : null;
    const max = form.salaryMax.trim() ? Number(form.salaryMax) : null;
    return formatSalaryRange(Number.isFinite(min) ? min : null, Number.isFinite(max) ? max : null);
  }, [form.salaryMax, form.salaryMin]);

  const schoolLocationForAI = useMemo(() => {
    const loc = [schoolInfo?.city, schoolInfo?.province].filter(Boolean).join(', ');
    return loc || null;
  }, [schoolInfo?.city, schoolInfo?.province]);

  const aiOrgType = useMemo(() => {
    const raw = String(
      schoolInfo?.type || (profile as any)?.organization_membership?.school_type ||
      (profile as any)?.organization_membership?.organization_kind ||
      (profile as any)?.organization_kind || ''
    ).toLowerCase().trim();
    if (!raw) return 'school';
    if (['k12', 'k12_school', 'combined', 'primary', 'secondary', 'community_school'].includes(raw)) return 'k12_school';
    if (['preschool', 'ecd', 'nursery'].includes(raw)) return 'preschool';
    return raw;
  }, [profile, schoolInfo?.type]);

  const handleAISuggest = useCallback(async () => {
    if (!form.title.trim()) {
      showAlert({ title: 'Add a Job Title', message: 'AI suggestions work best when you have a role title.', type: 'info' });
      return;
    }
    setAiBusy(true); setAiUseSuggestedTitle(true);
    try {
      const suggestions = await JobPostingAIService.suggest({
        schoolName: schoolInfo?.name, schoolLocation: schoolLocationForAI,
        orgType: aiOrgType, jobTitle: form.title.trim(),
        employmentType: formatEmploymentType(String(form.employmentType)),
        jobLocation: form.location.trim() || null,
        salaryRange: salaryRangeTextForAI === 'Negotiable' ? null : salaryRangeTextForAI,
        existingDescription: form.description.trim() || null,
        existingRequirements: form.requirements.trim() || null,
      });
      setAiSuggestions(suggestions);
      setAiWhatsAppShort(suggestions.whatsapp_short || null);
      setAiWhatsAppLong(suggestions.whatsapp_long || null);
      setAiModalVisible(true);
    } catch (e: any) {
      showAlert({ title: 'AI Failed', message: e?.message || 'Could not generate AI suggestions.', type: 'error' });
    } finally { setAiBusy(false); }
  }, [form, aiOrgType, salaryRangeTextForAI, schoolInfo?.name, schoolLocationForAI, showAlert]);

  const applyAISuggestions = useCallback((mode: 'replace' | 'fill_empty') => {
    if (!aiSuggestions) return;
    const suggestedTitle = String(aiSuggestions.suggested_title || '').trim();
    if (aiUseSuggestedTitle && suggestedTitle) {
      form.setTitle((prev) => (mode === 'replace' || !prev.trim() ? suggestedTitle : prev));
    }
    form.setDescription((prev) => (mode === 'replace' || !prev.trim() ? aiSuggestions.description : prev));
    form.setRequirements((prev) => (mode === 'replace' || !prev.trim() ? aiSuggestions.requirements : prev));
    if (aiSuggestions.whatsapp_short) setAiWhatsAppShort(aiSuggestions.whatsapp_short);
    if (aiSuggestions.whatsapp_long) setAiWhatsAppLong(aiSuggestions.whatsapp_long);
    setAiModalVisible(false);
    showAlert({ title: 'Applied', message: 'AI suggestions were applied to your posting.', type: 'success' });
  }, [aiSuggestions, aiUseSuggestedTitle, form, showAlert]);

  return {
    aiBusy, aiModalVisible, setAiModalVisible, aiSuggestions,
    aiUseSuggestedTitle, setAiUseSuggestedTitle,
    aiWhatsAppShort, aiWhatsAppLong, canUseAISuggestions,
    handleAISuggest, applyAISuggestions,
  };
}
