/** Draft autosave helpers — extracted from job-posting-create */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { EmploymentType } from '@/types/hiring';
import {
  clearJobPostingDraft, isMeaningfulDraft, loadJobPostingDraft,
  saveJobPostingDraft, type JobPostingDraftV1,
} from '@/lib/hiring/jobPostingDraft';
import type { ShowAlert } from './types';

interface DraftHookParams {
  preschoolId: string | null | undefined;
  userId: string | undefined;
  form: {
    title: string; description: string; requirements: string;
    salaryMin: string; salaryMax: string; location: string;
    employmentType: EmploymentType; expiresAt: string; jobLogoUrl: string | null;
    setTitle: (v: string) => void; setDescription: (v: string) => void;
    setRequirements: (v: string) => void; setSalaryMin: (v: string) => void;
    setSalaryMax: (v: string) => void; setLocation: (v: string) => void;
    setEmploymentType: (v: EmploymentType) => void; setExpiresAt: (v: string) => void;
    setJobLogoUrl: (v: string | null) => void;
  };
  showAlert: ShowAlert;
}

export function useJobPostingDraft({ preschoolId, userId, form, showAlert }: DraftHookParams) {
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftLastSavedAt, setDraftLastSavedAt] = useState<string | null>(null);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftPromptedForKeyRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const draftParams = useMemo(() => {
    if (!preschoolId || !userId) return null;
    return { preschoolId: String(preschoolId), userId: String(userId) };
  }, [preschoolId, userId]);

  const hasMeaningfulFormContent = useMemo(() => isMeaningfulDraft({
    title: form.title, description: form.description, requirements: form.requirements,
    salary_min: form.salaryMin, salary_max: form.salaryMax, location: form.location,
  }), [form.title, form.description, form.requirements, form.salaryMin, form.salaryMax, form.location]);

  const buildCurrentDraft = useCallback((): JobPostingDraftV1 | null => {
    if (!draftParams) return null;
    return {
      version: 1, updated_at: new Date().toISOString(),
      preschool_id: draftParams.preschoolId, user_id: draftParams.userId,
      title: form.title, description: form.description, requirements: form.requirements,
      salary_min: form.salaryMin, salary_max: form.salaryMax, location: form.location,
      employment_type: form.employmentType, expires_at: form.expiresAt,
      job_logo_url: form.jobLogoUrl,
    };
  }, [draftParams, form.description, form.employmentType, form.expiresAt, form.jobLogoUrl, form.location, form.requirements, form.salaryMax, form.salaryMin, form.title]);

  const saveDraftNow = useCallback(async () => {
    if (!draftParams) return;
    const draft = buildCurrentDraft();
    if (!draft) return;
    try {
      if (!isMeaningfulDraft(draft)) {
        if (draftLastSavedAt) { await clearJobPostingDraft(draftParams); if (mountedRef.current) setDraftLastSavedAt(null); }
        return;
      }
      await saveJobPostingDraft(draft);
      if (mountedRef.current) setDraftLastSavedAt(draft.updated_at);
    } catch { /* silent */ } finally { if (mountedRef.current) setDraftSaving(false); }
  }, [buildCurrentDraft, draftLastSavedAt, draftParams]);

  const clearDraftAndResetForm = useCallback(async () => {
    if (!draftParams) return;
    try { await clearJobPostingDraft(draftParams); } catch { /* silent */ }
    setDraftLastSavedAt(null);
    form.setTitle(''); form.setDescription(''); form.setRequirements('');
    form.setSalaryMin(''); form.setSalaryMax(''); form.setLocation('');
    form.setEmploymentType(EmploymentType.FULL_TIME); form.setExpiresAt(''); form.setJobLogoUrl(null);
  }, [draftParams, form]);

  // Load draft on mount
  useEffect(() => {
    if (!draftParams) { setDraftLoaded(true); return; }
    const key = `${draftParams.preschoolId}:${draftParams.userId}`;
    if (draftPromptedForKeyRef.current === key) return;
    draftPromptedForKeyRef.current = key;

    let alive = true;
    const load = async () => {
      try {
        const draft = await loadJobPostingDraft(draftParams);
        if (!alive || !draft || !isMeaningfulDraft(draft)) return;
        showAlert({
          title: 'Resume Draft?',
          message: `We found an autosaved draft from ${new Date(draft.updated_at).toLocaleString()}.`,
          type: 'info',
          buttons: [
            { text: 'Discard', style: 'destructive', onPress: () => { void clearDraftAndResetForm(); } },
            { text: 'Resume', onPress: () => {
              form.setTitle(draft.title || ''); form.setDescription(draft.description || '');
              form.setRequirements(draft.requirements || ''); form.setSalaryMin(draft.salary_min || '');
              form.setSalaryMax(draft.salary_max || ''); form.setLocation(draft.location || '');
              form.setEmploymentType(draft.employment_type || EmploymentType.FULL_TIME);
              form.setExpiresAt(draft.expires_at || ''); form.setJobLogoUrl(draft.job_logo_url || null);
              setDraftLastSavedAt(draft.updated_at || null);
            }},
          ],
        });
      } catch { /* silent */ }
    };
    void load().finally(() => { if (alive) setDraftLoaded(true); });
    return () => { alive = false; };
  }, [clearDraftAndResetForm, draftParams, showAlert, form]);

  // Debounced autosave
  useEffect(() => {
    if (!draftLoaded || !draftParams) return;
    if (!hasMeaningfulFormContent && !draftLastSavedAt) { setDraftSaving(false); return; }
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    setDraftSaving(true);
    draftSaveTimerRef.current = setTimeout(() => { void saveDraftNow(); }, 850);
    return () => { if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current); };
  }, [draftLoaded, draftParams, form.description, draftLastSavedAt, form.employmentType, form.expiresAt, hasMeaningfulFormContent, form.jobLogoUrl, form.location, form.requirements, form.salaryMax, form.salaryMin, saveDraftNow, form.title]);

  // Save on background
  useEffect(() => {
    if (!draftParams) return;
    const handleStateChange = (next: AppStateStatus) => { if (next !== 'active') void saveDraftNow(); };
    const sub = AppState.addEventListener('change', handleStateChange);
    return () => { sub.remove(); void saveDraftNow(); };
  }, [draftParams, saveDraftNow]);

  return {
    draftLoaded, draftSaving, draftLastSavedAt, draftParams,
    hasMeaningfulFormContent, clearDraftAndResetForm, setDraftLastSavedAt,
  };
}
