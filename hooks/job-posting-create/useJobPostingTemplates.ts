/** Template management helpers — extracted from job-posting-create */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmploymentType } from '@/types/hiring';
import {
  DEFAULT_JOB_POSTING_TEMPLATES, loadSavedJobPostingTemplates,
  saveSavedJobPostingTemplates, type JobPostingTemplate, type SavedJobPostingTemplate,
} from '@/lib/hiring/jobPostingTemplates';
import type { ShowAlert } from './types';

interface Params {
  draftParams: { preschoolId: string; userId: string } | null;
  hasMeaningfulFormContent: boolean;
  form: {
    title: string; description: string; requirements: string;
    salaryMin: string; salaryMax: string; employmentType: EmploymentType;
    setTitle: (fn: (prev: string) => string) => void;
    setDescription: (fn: (prev: string) => string) => void;
    setRequirements: (fn: (prev: string) => string) => void;
    setSalaryMin: (fn: (prev: string) => string) => void;
    setSalaryMax: (fn: (prev: string) => string) => void;
    setEmploymentType: (v: EmploymentType) => void;
  };
  showAlert: ShowAlert;
}

export function useJobPostingTemplates({ draftParams, hasMeaningfulFormContent, form, showAlert }: Params) {
  const [savedTemplates, setSavedTemplates] = useState<SavedJobPostingTemplate[]>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [templateSaveModalVisible, setTemplateSaveModalVisible] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateCategory, setTemplateCategory] = useState<JobPostingTemplate['category']>('general');
  const [savingTemplate, setSavingTemplate] = useState(false);

  const savedTemplateIds = useMemo(() => new Set(savedTemplates.map((t) => t.id)), [savedTemplates]);

  const allTemplates = useMemo(() => {
    const byId = new Map<string, JobPostingTemplate | SavedJobPostingTemplate>();
    DEFAULT_JOB_POSTING_TEMPLATES.forEach((t) => byId.set(t.id, t));
    savedTemplates.forEach((t) => byId.set(t.id, t));
    return Array.from(byId.values());
  }, [savedTemplates]);

  useEffect(() => {
    if (!draftParams) { setTemplatesLoaded(true); return; }
    let alive = true;
    void (async () => {
      try {
        const t = await loadSavedJobPostingTemplates(draftParams);
        if (alive) setSavedTemplates(t);
      } catch { /* silent */ } finally { if (alive) setTemplatesLoaded(true); }
    })();
    return () => { alive = false; };
  }, [draftParams]);

  const applyTemplateToForm = useCallback((template: JobPostingTemplate, mode: 'replace' | 'fill_empty') => {
    const fill = <T,>(prev: T, next: T, isEmpty: (v: T) => boolean) => (mode === 'replace' ? next : isEmpty(prev) ? next : prev);
    form.setTitle((prev) => fill(prev, template.title, (v) => !String(v || '').trim()));
    form.setDescription((prev) => fill(prev, template.description, (v) => !String(v || '').trim()));
    form.setRequirements((prev) => fill(prev, template.requirements, (v) => !String(v || '').trim()));
    form.setEmploymentType(template.employment_type);
    form.setSalaryMin((prev) => fill(prev, template.salary_min || '', (v) => !String(v || '').trim()));
    form.setSalaryMax((prev) => fill(prev, template.salary_max || '', (v) => !String(v || '').trim()));
  }, [form]);

  const onPressTemplate = useCallback((template: JobPostingTemplate) => {
    if (!hasMeaningfulFormContent) { applyTemplateToForm(template, 'replace'); return; }
    showAlert({
      title: 'Apply Template?', message: 'This will update your current form fields.', type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Fill empty', onPress: () => applyTemplateToForm(template, 'fill_empty') },
        { text: 'Replace', style: 'destructive', onPress: () => applyTemplateToForm(template, 'replace') },
      ],
    });
  }, [applyTemplateToForm, hasMeaningfulFormContent, showAlert]);

  const deleteSavedTemplate = useCallback((id: string) => {
    if (!draftParams) return;
    showAlert({
      title: 'Delete Template?', message: 'This will remove the template from your saved list.', type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
          const next = savedTemplates.filter((t) => t.id !== id);
          setSavedTemplates(next);
          void saveSavedJobPostingTemplates({ ...draftParams, templates: next });
        }},
      ],
    });
  }, [draftParams, savedTemplates, showAlert]);

  const openSaveTemplateModal = useCallback(() => {
    if (!form.title.trim() && !form.description.trim() && !form.requirements.trim()) {
      showAlert({ title: 'Nothing to Save', message: 'Add some details first, then save as a template.', type: 'info' });
      return;
    }
    setTemplateName(''); setTemplateCategory('general'); setTemplateSaveModalVisible(true);
  }, [form.description, form.requirements, form.title, showAlert]);

  const handleSaveTemplate = useCallback(async () => {
    if (!draftParams) { showAlert({ title: 'Error', message: 'Missing school information', type: 'error' }); return; }
    const name = templateName.trim();
    if (!name) { showAlert({ title: 'Template Name Required', message: 'Please enter a template name.', type: 'warning' }); return; }

    const now = new Date().toISOString();
    const template: SavedJobPostingTemplate = {
      id: `tpl_saved_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      name, category: templateCategory,
      title: form.title.trim() || 'Untitled Job', employment_type: form.employmentType,
      description: form.description.trim() || '', requirements: form.requirements.trim() || '',
      salary_min: form.salaryMin.trim() || undefined, salary_max: form.salaryMax.trim() || undefined,
      created_at: now, updated_at: now,
    };
    setSavingTemplate(true);
    try {
      const next = [template, ...savedTemplates];
      setSavedTemplates(next);
      await saveSavedJobPostingTemplates({ ...draftParams, templates: next });
      setTemplateSaveModalVisible(false);
      showAlert({ title: 'Saved', message: 'Template saved successfully.', type: 'success' });
    } catch { showAlert({ title: 'Save Failed', message: 'Could not save template. Please try again.', type: 'error' }); }
    finally { setSavingTemplate(false); }
  }, [draftParams, form, savedTemplates, showAlert, templateCategory, templateName]);

  return {
    savedTemplates, allTemplates, savedTemplateIds, templatesLoaded,
    templateSaveModalVisible, setTemplateSaveModalVisible,
    templateName, setTemplateName, templateCategory, setTemplateCategory,
    savingTemplate, onPressTemplate, deleteSavedTemplate, openSaveTemplateModal, handleSaveTemplate,
  };
}
