/** Main orchestrator — composes all sub-hooks for job-posting-create screen */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlertModal } from '@/components/ui/AlertModal';
import { EmploymentType } from '@/types/hiring';
import { assertSupabase } from '@/lib/supabase';
import HiringHubService from '@/lib/services/HiringHubService';
import { clearJobPostingDraft } from '@/lib/hiring/jobPostingDraft';
import { logger } from '@/lib/logger';
import { useJobPostingDraft } from './useJobPostingDraft';
import { useJobPostingTemplates } from './useJobPostingTemplates';
import { useJobPostingAI } from './useJobPostingAI';
import { useJobPostingLogo } from './useJobPostingLogo';
import { useJobPostingShare } from './useJobPostingShareActions';
import type { SchoolInfo } from './types';

export function useJobPostingCreate() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const { showAlert, AlertModalComponent } = useAlertModal();

  const preschoolId = profile?.organization_id || (profile as any)?.preschool_id;

  // ── Form state ───────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [location, setLocation] = useState('');
  const [employmentType, setEmploymentType] = useState<EmploymentType>(EmploymentType.FULL_TIME);
  const [expiresAt, setExpiresAt] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── SchoolInfo ───────────────────────────────────────────────
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);

  // ── Logo ─────────────────────────────────────────────────────
  const logo = useJobPostingLogo({ preschoolId, showAlert });

  // ── loadSchoolInfo (needed before share hook) ────────────────
  const loadSchoolInfo = useCallback(async () => {
    if (!preschoolId) return;
    try {
      const supabase = assertSupabase();
      const { data: preschool } = await supabase
        .from('preschools')
        .select('name, logo_url, city, province, phone, contact_email, website_url')
        .eq('id', preschoolId).maybeSingle();
      if (preschool) {
        setSchoolInfo({
          name: preschool.name, type: 'preschool', logoUrl: preschool.logo_url,
          city: preschool.city, province: preschool.province, phone: preschool.phone,
          email: preschool.contact_email, website: preschool.website_url,
        });
        return;
      }
      const { data: org } = await supabase.from('organizations')
        .select('name, logo_url, type').eq('id', preschoolId).maybeSingle();
      if (org) {
        setSchoolInfo({ name: org.name, type: (org as any).type || null, logoUrl: org.logo_url });
        return;
      }
    } catch (e) { logger.warn('JobPostingCreate', 'Failed to load school info', e); }
    const fallbackName = (profile as any)?.organization_name || (profile as any)?.organization_membership?.organization_name;
    if (fallbackName) {
      const fType = (profile as any)?.organization_membership?.school_type
        || (profile as any)?.organization_membership?.organization_kind
        || (profile as any)?.organization_kind || null;
      setSchoolInfo({ name: fallbackName, type: fType });
    }
  }, [preschoolId, profile]);

  useEffect(() => { void loadSchoolInfo(); }, [loadSchoolInfo]);

  // ── Draft ────────────────────────────────────────────────────
  const draftForm = useMemo(() => ({
    title, description, requirements, salaryMin, salaryMax, location,
    employmentType, expiresAt, jobLogoUrl: logo.jobLogoUrl,
    setTitle, setDescription, setRequirements, setSalaryMin, setSalaryMax,
    setLocation, setEmploymentType, setExpiresAt, setJobLogoUrl: logo.setJobLogoUrl,
  }), [title, description, requirements, salaryMin, salaryMax, location, employmentType, expiresAt, logo.jobLogoUrl, logo.setJobLogoUrl]);

  const draft = useJobPostingDraft({ preschoolId, userId: user?.id, form: draftForm, showAlert });

  // ── Templates ────────────────────────────────────────────────
  const tplForm = useMemo(() => ({
    title, description, requirements, salaryMin, salaryMax, employmentType,
    setTitle, setDescription, setRequirements, setSalaryMin, setSalaryMax, setEmploymentType,
  }), [title, description, requirements, salaryMin, salaryMax, employmentType]);

  const templates = useJobPostingTemplates({
    draftParams: draft.draftParams, hasMeaningfulFormContent: draft.hasMeaningfulFormContent,
    form: tplForm, showAlert,
  });

  // ── AI ───────────────────────────────────────────────────────
  const aiForm = useMemo(() => ({
    title, description, requirements, salaryMin, salaryMax,
    location, employmentType: String(employmentType),
    setTitle, setDescription, setRequirements,
  }), [title, description, requirements, salaryMin, salaryMax, location, employmentType]);

  const ai = useJobPostingAI({ form: aiForm, schoolInfo, profile, showAlert });

  // ── Share ────────────────────────────────────────────────────
  const share = useJobPostingShare({
    preschoolId, userId: user?.id, title, schoolInfo, showAlert, loadSchoolInfo,
  });

  // ── Validation ───────────────────────────────────────────────
  const validateForm = useCallback((): boolean => {
    if (!title.trim()) { showAlert({ title: 'Validation Error', message: 'Job title is required', type: 'warning' }); return false; }
    if (!description.trim()) { showAlert({ title: 'Validation Error', message: 'Job description is required', type: 'warning' }); return false; }
    if (!employmentType) { showAlert({ title: 'Validation Error', message: 'Employment type is required', type: 'warning' }); return false; }
    const minS = salaryMin ? parseFloat(salaryMin) : null;
    const maxS = salaryMax ? parseFloat(salaryMax) : null;
    if (minS && isNaN(minS)) { showAlert({ title: 'Validation Error', message: 'Minimum salary must be a valid number', type: 'warning' }); return false; }
    if (maxS && isNaN(maxS)) { showAlert({ title: 'Validation Error', message: 'Maximum salary must be a valid number', type: 'warning' }); return false; }
    if (minS && maxS && minS > maxS) { showAlert({ title: 'Validation Error', message: 'Minimum salary cannot be greater than maximum salary', type: 'warning' }); return false; }
    return true;
  }, [description, employmentType, salaryMax, salaryMin, showAlert, title]);

  // ── Submit ───────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;
    if (!preschoolId || !user?.id) { showAlert({ title: 'Error', message: 'Missing user or school information', type: 'error' }); return; }
    setSubmitting(true);
    try {
      const minSalary = salaryMin ? parseFloat(salaryMin) : undefined;
      const maxSalary = salaryMax ? parseFloat(salaryMax) : undefined;
      const newJob = await HiringHubService.createJobPosting({
        preschool_id: preschoolId, title: title.trim(), description: description.trim(),
        requirements: requirements.trim() || undefined, logo_url: logo.jobLogoUrl || null,
        salary_range_min: minSalary, salary_range_max: maxSalary,
        location: location.trim() || undefined, employment_type: employmentType,
        expires_at: expiresAt || undefined, age_group: ageGroup.trim() || undefined,
        whatsapp_number: whatsappNumber.trim() || undefined,
      }, user.id);
      if (draft.draftParams) {
        try { await clearJobPostingDraft(draft.draftParams); } catch { /* silent */ }
        draft.setDraftLastSavedAt(null);
      }
      share.openSharePreview(newJob);
    } catch (e: any) {
      logger.error('JobPostingCreate', 'Error creating job posting', e);
      showAlert({ title: 'Error', message: e.message || 'Failed to create job posting', type: 'error' });
    } finally { setSubmitting(false); }
  }, [
    validateForm, preschoolId, user?.id, showAlert, salaryMin, salaryMax,
    title, description, requirements, logo.jobLogoUrl, location, employmentType,
    expiresAt, ageGroup, whatsappNumber, draft.draftParams, draft.setDraftLastSavedAt, share,
  ]);

  return {
    theme, profile, preschoolId, user, AlertModalComponent, showAlert,
    // Form
    title, setTitle, description, setDescription, requirements, setRequirements,
    salaryMin, setSalaryMin, salaryMax, setSalaryMax, location, setLocation,
    employmentType, setEmploymentType, expiresAt, setExpiresAt,
    ageGroup, setAgeGroup, whatsappNumber, setWhatsappNumber,
    submitting, handleSubmit,
    // Composed
    schoolInfo, draft, templates, ai, logo, share,
  };
}
