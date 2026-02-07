import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Image, Linking, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import HiringHubService from '@/lib/services/HiringHubService';
import { EmploymentType } from '@/types/hiring';
import * as Clipboard from 'expo-clipboard';
import { assertSupabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { base64ToUint8Array } from '@/lib/utils/base64';
import { ensureImageLibraryPermission } from '@/lib/utils/mediaLibrary';
import { useAlertModal } from '@/components/ui/AlertModal';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { ImageConfirmModal } from '@/components/ui/ImageConfirmModal';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { buildApplyLink, buildWhatsAppMessage, formatEmploymentType, formatSalaryRange, type ShareableJobPosting, type WhatsAppMessageVariant } from '@/lib/hiring/jobPostingShare';
import { clearJobPostingDraft, isMeaningfulDraft, loadJobPostingDraft, saveJobPostingDraft, type JobPostingDraftV1 } from '@/lib/hiring/jobPostingDraft';
import { DEFAULT_JOB_POSTING_TEMPLATES, loadSavedJobPostingTemplates, saveSavedJobPostingTemplates, type JobPostingTemplate, type SavedJobPostingTemplate } from '@/lib/hiring/jobPostingTemplates';
import { JobPostingAIService, type JobPostingAISuggestions } from '@/lib/services/JobPostingAIService';
export default function JobPostingCreateScreen() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { showAlert, AlertModalComponent } = useAlertModal();

  const preschoolId = profile?.organization_id || (profile as any)?.preschool_id;

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
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareJobPosting, setShareJobPosting] = useState<any | null>(null);
  const [shareMessage, setShareMessage] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [jobLogoUrl, setJobLogoUrl] = useState<string | null>(null);
  const [jobLogoUploading, setJobLogoUploading] = useState(false);
  const [pendingLogoUri, setPendingLogoUri] = useState<string | null>(null);
  const [schoolInfo, setSchoolInfo] = useState<{
    name: string;
    logoUrl?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    city?: string | null;
    province?: string | null;
  } | null>(null);
  const [includeSchoolHeader, setIncludeSchoolHeader] = useState(true);
  const [includeSchoolLogo, setIncludeSchoolLogo] = useState(true);
  const [includeSchoolDetails, setIncludeSchoolDetails] = useState(true);
  const [shareVariant, setShareVariant] = useState<WhatsAppMessageVariant>('short');
  const [polishingShareMessage, setPolishingShareMessage] = useState(false);
  const [sharingPoster, setSharingPoster] = useState(false);

  // Autosave draft
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftLastSavedAt, setDraftLastSavedAt] = useState<string | null>(null);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftPromptedForKeyRef = useRef<string | null>(null);

  // Templates
  const [savedTemplates, setSavedTemplates] = useState<SavedJobPostingTemplate[]>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [templateSaveModalVisible, setTemplateSaveModalVisible] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateCategory, setTemplateCategory] = useState<JobPostingTemplate['category']>('general');
  const [savingTemplate, setSavingTemplate] = useState(false);

  // AI assist
  const [aiBusy, setAiBusy] = useState(false);
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<JobPostingAISuggestions | null>(null);
  const [aiUseSuggestedTitle, setAiUseSuggestedTitle] = useState(true);
  const [aiWhatsAppShort, setAiWhatsAppShort] = useState<string | null>(null);
  const [aiWhatsAppLong, setAiWhatsAppLong] = useState<string | null>(null);

  // Share poster capture
  const posterShotRef = useRef<ViewShot>(null);
  const mountedRef = useRef(true);

  const appWebBaseUrl = process.env.EXPO_PUBLIC_APP_WEB_URL || process.env.EXPO_PUBLIC_WEB_URL || 'https://edudashpro.org.za';

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const draftParams = useMemo(() => {
    if (!preschoolId || !user?.id) return null;
    return { preschoolId: String(preschoolId), userId: String(user.id) };
  }, [preschoolId, user?.id]);

  const hasMeaningfulFormContent = useMemo(() => {
    return isMeaningfulDraft({
      title,
      description,
      requirements,
      salary_min: salaryMin,
      salary_max: salaryMax,
      location,
    });
  }, [title, description, requirements, salaryMin, salaryMax, location]);

  const buildCurrentDraft = useCallback((): JobPostingDraftV1 | null => {
    if (!draftParams) return null;
    return {
      version: 1,
      updated_at: new Date().toISOString(),
      preschool_id: draftParams.preschoolId,
      user_id: draftParams.userId,
      title,
      description,
      requirements,
      salary_min: salaryMin,
      salary_max: salaryMax,
      location,
      employment_type: employmentType,
      expires_at: expiresAt,
      job_logo_url: jobLogoUrl,
    };
  }, [draftParams, description, employmentType, expiresAt, jobLogoUrl, location, requirements, salaryMax, salaryMin, title]);

  const saveDraftNow = useCallback(async () => {
    if (!draftParams) return;
    const draft = buildCurrentDraft();
    if (!draft) return;
    try {
      if (!isMeaningfulDraft(draft)) {
        // Don't clear an existing stored draft before the user chooses "Resume" or "Discard".
        if (draftLastSavedAt) {
          await clearJobPostingDraft(draftParams);
          if (mountedRef.current) setDraftLastSavedAt(null);
        }
        return;
      }
      await saveJobPostingDraft(draft);
      if (mountedRef.current) setDraftLastSavedAt(draft.updated_at);
    } catch (e) {
      console.warn('Failed to autosave job posting draft:', e);
    } finally {
      if (mountedRef.current) setDraftSaving(false);
    }
  }, [buildCurrentDraft, draftLastSavedAt, draftParams]);

  const clearDraftAndResetForm = useCallback(async () => {
    if (!draftParams) return;
    try {
      await clearJobPostingDraft(draftParams);
    } catch {
      /* ignore */
    }
    setDraftLastSavedAt(null);
    setTitle('');
    setDescription('');
    setRequirements('');
    setSalaryMin('');
    setSalaryMax('');
    setLocation('');
    setEmploymentType(EmploymentType.FULL_TIME);
    setExpiresAt('');
    setJobLogoUrl(null);
  }, [draftParams]);

  useEffect(() => {
    if (!draftParams) {
      setDraftLoaded(true);
      return;
    }

    const key = `${draftParams.preschoolId}:${draftParams.userId}`;
    if (draftPromptedForKeyRef.current === key) return;
    draftPromptedForKeyRef.current = key;

    let mounted = true;
    const loadDraft = async () => {
      try {
        const draft = await loadJobPostingDraft(draftParams);
        if (!mounted || !draft || !isMeaningfulDraft(draft)) {
          return;
        }

        showAlert({
          title: 'Resume Draft?',
          message: `We found an autosaved draft from ${new Date(draft.updated_at).toLocaleString()}.`,
          type: 'info',
          buttons: [
            {
              text: 'Discard',
              style: 'destructive',
              onPress: () => {
                void clearDraftAndResetForm();
              },
            },
            {
              text: 'Resume',
              onPress: () => {
                setTitle(draft.title || '');
                setDescription(draft.description || '');
                setRequirements(draft.requirements || '');
                setSalaryMin(draft.salary_min || '');
                setSalaryMax(draft.salary_max || '');
                setLocation(draft.location || '');
                setEmploymentType(draft.employment_type || EmploymentType.FULL_TIME);
                setExpiresAt(draft.expires_at || '');
                setJobLogoUrl(draft.job_logo_url || null);
                setDraftLastSavedAt(draft.updated_at || null);
              },
            },
          ],
        });
      } catch (e) {
        console.warn('Failed to load job posting draft:', e);
      }
    };

    void loadDraft().finally(() => {
      if (mounted) setDraftLoaded(true);
    });

    return () => {
      mounted = false;
    };
  }, [clearDraftAndResetForm, draftParams, showAlert]);

  useEffect(() => {
    if (!draftParams) {
      setTemplatesLoaded(true);
      return;
    }

    let mounted = true;
    const loadTemplates = async () => {
      try {
        const templates = await loadSavedJobPostingTemplates(draftParams);
        if (mounted) setSavedTemplates(templates);
      } catch (e) {
        console.warn('Failed to load job posting templates:', e);
      } finally {
        if (mounted) setTemplatesLoaded(true);
      }
    };

    void loadTemplates();
    return () => {
      mounted = false;
    };
  }, [draftParams]);

  useEffect(() => {
    if (!draftLoaded || !draftParams) return;

    const shouldPersist = hasMeaningfulFormContent || Boolean(draftLastSavedAt);
    if (!shouldPersist) {
      setDraftSaving(false);
      return;
    }

    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
    }

    // Debounced autosave to local storage
    setDraftSaving(true);
    draftSaveTimerRef.current = setTimeout(() => {
      void saveDraftNow();
    }, 850);

    return () => {
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current);
      }
    };
  }, [
    draftLoaded,
    draftParams,
    description,
    draftLastSavedAt,
    employmentType,
    expiresAt,
    hasMeaningfulFormContent,
    jobLogoUrl,
    location,
    requirements,
    salaryMax,
    salaryMin,
    saveDraftNow,
    title,
  ]);

  useEffect(() => {
    if (!draftParams) return;

    const handleStateChange = (nextState: AppStateStatus) => {
      if (nextState !== 'active') {
        void saveDraftNow();
      }
    };

    const sub = AppState.addEventListener('change', handleStateChange);
    return () => {
      sub.remove();
      void saveDraftNow();
    };
  }, [draftParams, saveDraftNow]);

  const validateForm = (): boolean => {
    if (!title.trim()) {
      showAlert({ title: 'Validation Error', message: 'Job title is required', type: 'warning' });
      return false;
    }
    if (!description.trim()) {
      showAlert({ title: 'Validation Error', message: 'Job description is required', type: 'warning' });
      return false;
    }
    if (!employmentType) {
      showAlert({ title: 'Validation Error', message: 'Employment type is required', type: 'warning' });
      return false;
    }

    const minSalary = salaryMin ? parseFloat(salaryMin) : null;
    const maxSalary = salaryMax ? parseFloat(salaryMax) : null;

    if (minSalary && isNaN(minSalary)) {
      showAlert({ title: 'Validation Error', message: 'Minimum salary must be a valid number', type: 'warning' });
      return false;
    }
    if (maxSalary && isNaN(maxSalary)) {
      showAlert({ title: 'Validation Error', message: 'Maximum salary must be a valid number', type: 'warning' });
      return false;
    }
    if (minSalary && maxSalary && minSalary > maxSalary) {
      showAlert({ title: 'Validation Error', message: 'Minimum salary cannot be greater than maximum salary', type: 'warning' });
      return false;
    }

    return true;
  };

  const formatSchoolDetails = (info: typeof schoolInfo) => {
    if (!info) return '';
    const locationParts = [info.city, info.province].filter(Boolean).join(', ');
    const detailParts = [locationParts, info.phone, info.email, info.website].filter(Boolean);
    return detailParts.join(' • ');
  };

  const loadSchoolInfo = useCallback(async () => {
    if (!preschoolId) return;
    try {
      const supabase = assertSupabase();
      const { data: preschool } = await supabase
        .from('preschools')
        .select('name, logo_url, city, province, phone, contact_email, website_url')
        .eq('id', preschoolId)
        .maybeSingle();

      if (preschool) {
        setSchoolInfo({
          name: preschool.name,
          logoUrl: preschool.logo_url,
          city: preschool.city,
          province: preschool.province,
          phone: preschool.phone,
          email: preschool.contact_email,
          website: preschool.website_url,
        });
        setIncludeSchoolLogo(Boolean(jobLogoUrl || preschool.logo_url));
        return;
      }

      const { data: org } = await supabase
        .from('organizations')
        .select('name, logo_url')
        .eq('id', preschoolId)
        .maybeSingle();
      if (org) {
        setSchoolInfo({
          name: org.name,
          logoUrl: org.logo_url,
        });
        setIncludeSchoolLogo(Boolean(jobLogoUrl || org.logo_url));
        return;
      }
    } catch (error) {
      console.warn('Failed to load school info:', error);
    }
    const fallbackName = (profile as any)?.organization_name || (profile as any)?.organization_membership?.organization_name;
    if (fallbackName) {
      setSchoolInfo({
        name: fallbackName,
      });
      setIncludeSchoolLogo(Boolean(jobLogoUrl));
    }
  }, [jobLogoUrl, preschoolId, profile]);

  useEffect(() => {
    void loadSchoolInfo();
  }, [loadSchoolInfo]);

  const savedTemplateIds = useMemo(() => new Set(savedTemplates.map((t) => t.id)), [savedTemplates]);

  const allTemplates = useMemo(() => {
    // Defaults first, then saved templates (saved can override if same id).
    const byId = new Map<string, JobPostingTemplate | SavedJobPostingTemplate>();
    DEFAULT_JOB_POSTING_TEMPLATES.forEach((t) => byId.set(t.id, t));
    savedTemplates.forEach((t) => byId.set(t.id, t));
    return Array.from(byId.values());
  }, [savedTemplates]);

  const applyTemplateToForm = useCallback(
    (template: JobPostingTemplate, mode: 'replace' | 'fill_empty') => {
      const fill = <T,>(prev: T, next: T, isEmpty: (v: T) => boolean) => (mode === 'replace' ? next : isEmpty(prev) ? next : prev);

      setTitle((prev) => fill(prev, template.title, (v) => !String(v || '').trim()));
      setDescription((prev) => fill(prev, template.description, (v) => !String(v || '').trim()));
      setRequirements((prev) => fill(prev, template.requirements, (v) => !String(v || '').trim()));
      setEmploymentType(template.employment_type);
      setSalaryMin((prev) => fill(prev, template.salary_min || '', (v) => !String(v || '').trim()));
      setSalaryMax((prev) => fill(prev, template.salary_max || '', (v) => !String(v || '').trim()));
    },
    []
  );

  const onPressTemplate = useCallback(
    (template: JobPostingTemplate) => {
      if (!hasMeaningfulFormContent) {
        applyTemplateToForm(template, 'replace');
        return;
      }

      showAlert({
        title: 'Apply Template?',
        message: 'This will update your current form fields.',
        type: 'warning',
        buttons: [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Fill empty',
            onPress: () => applyTemplateToForm(template, 'fill_empty'),
          },
          {
            text: 'Replace',
            style: 'destructive',
            onPress: () => applyTemplateToForm(template, 'replace'),
          },
        ],
      });
    },
    [applyTemplateToForm, hasMeaningfulFormContent, showAlert]
  );

  const deleteSavedTemplate = useCallback(
    (templateId: string) => {
      if (!draftParams) return;
      showAlert({
        title: 'Delete Template?',
        message: 'This will remove the template from your saved list.',
        type: 'warning',
        buttons: [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              const next = savedTemplates.filter((t) => t.id !== templateId);
              setSavedTemplates(next);
              void saveSavedJobPostingTemplates({ ...draftParams, templates: next });
            },
          },
        ],
      });
    },
    [draftParams, savedTemplates, showAlert]
  );

  const openSaveTemplateModal = useCallback(() => {
    if (!title.trim() && !description.trim() && !requirements.trim()) {
      showAlert({
        title: 'Nothing to Save',
        message: 'Add some details first, then save as a template.',
        type: 'info',
      });
      return;
    }
    setTemplateName('');
    setTemplateCategory('general');
    setTemplateSaveModalVisible(true);
  }, [description, requirements, showAlert, title]);

  const handleSaveTemplate = useCallback(async () => {
    if (!draftParams) {
      showAlert({ title: 'Error', message: 'Missing school information', type: 'error' });
      return;
    }

    const name = templateName.trim();
    if (!name) {
      showAlert({ title: 'Template Name Required', message: 'Please enter a template name.', type: 'warning' });
      return;
    }

    const now = new Date().toISOString();
    const template: SavedJobPostingTemplate = {
      id: `tpl_saved_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      category: templateCategory,
      title: title.trim() || 'Untitled Job',
      employment_type: employmentType,
      description: description.trim() || '',
      requirements: requirements.trim() || '',
      salary_min: salaryMin.trim() || undefined,
      salary_max: salaryMax.trim() || undefined,
      created_at: now,
      updated_at: now,
    };

    setSavingTemplate(true);
    try {
      const next = [template, ...savedTemplates];
      setSavedTemplates(next);
      await saveSavedJobPostingTemplates({ ...draftParams, templates: next });
      setTemplateSaveModalVisible(false);
      showAlert({ title: 'Saved', message: 'Template saved successfully.', type: 'success' });
    } catch (e) {
      console.warn('Failed to save job posting template:', e);
      showAlert({ title: 'Save Failed', message: 'Could not save template. Please try again.', type: 'error' });
    } finally {
      setSavingTemplate(false);
    }
  }, [
    description,
    draftParams,
    employmentType,
    requirements,
    salaryMax,
    salaryMin,
    savedTemplates,
    showAlert,
    templateCategory,
    templateName,
    title,
  ]);

  const salaryRangeTextForAI = useMemo(() => {
    const min = salaryMin.trim() ? Number(salaryMin) : null;
    const max = salaryMax.trim() ? Number(salaryMax) : null;
    return formatSalaryRange(Number.isFinite(min) ? min : null, Number.isFinite(max) ? max : null);
  }, [salaryMax, salaryMin]);

  const schoolLocationForAI = useMemo(() => {
    const loc = [schoolInfo?.city, schoolInfo?.province].filter(Boolean).join(', ');
    return loc || null;
  }, [schoolInfo?.city, schoolInfo?.province]);

  const canUseAISuggestions = useMemo(() => title.trim().length > 0, [title]);
  const canPolishShareMessageWithAI = useMemo(
    () => Boolean(shareJobPosting?.id) && shareMessage.trim().length > 0,
    [shareJobPosting?.id, shareMessage]
  );

  const handleAISuggest = useCallback(async () => {
    if (!title.trim()) {
      showAlert({
        title: 'Add a Job Title',
        message: 'AI suggestions work best when you have a role title. Add a title or apply a template first.',
        type: 'info',
      });
      return;
    }

    setAiBusy(true);
    setAiUseSuggestedTitle(true);
    try {
      const suggestions = await JobPostingAIService.suggest({
        schoolName: schoolInfo?.name,
        schoolLocation: schoolLocationForAI,
        orgType: 'preschool',
        jobTitle: title.trim(),
        employmentType: formatEmploymentType(String(employmentType)),
        jobLocation: location.trim() || null,
        salaryRange: salaryRangeTextForAI === 'Negotiable' ? null : salaryRangeTextForAI,
        existingDescription: description.trim() || null,
        existingRequirements: requirements.trim() || null,
      });

      setAiSuggestions(suggestions);
      setAiWhatsAppShort(suggestions.whatsapp_short || null);
      setAiWhatsAppLong(suggestions.whatsapp_long || null);
      setAiModalVisible(true);
    } catch (e: any) {
      showAlert({
        title: 'AI Failed',
        message: e?.message || 'Could not generate AI suggestions right now. Please try again.',
        type: 'error',
      });
    } finally {
      setAiBusy(false);
    }
  }, [
    description,
    employmentType,
    location,
    requirements,
    salaryRangeTextForAI,
    schoolInfo?.name,
    schoolLocationForAI,
    showAlert,
    title,
  ]);

  const applyAISuggestions = useCallback(
    (mode: 'replace' | 'fill_empty') => {
      if (!aiSuggestions) return;

      const suggestedTitle = String(aiSuggestions.suggested_title || '').trim();
      if (aiUseSuggestedTitle && suggestedTitle) {
        setTitle((prev) => (mode === 'replace' || !prev.trim() ? suggestedTitle : prev));
      }

      setDescription((prev) => (mode === 'replace' || !prev.trim() ? aiSuggestions.description : prev));
      setRequirements((prev) => (mode === 'replace' || !prev.trim() ? aiSuggestions.requirements : prev));

      if (aiSuggestions.whatsapp_short) setAiWhatsAppShort(aiSuggestions.whatsapp_short);
      if (aiSuggestions.whatsapp_long) setAiWhatsAppLong(aiSuggestions.whatsapp_long);

      setAiModalVisible(false);
      showAlert({ title: 'Applied', message: 'AI suggestions were applied to your posting.', type: 'success' });
    },
    [aiSuggestions, aiUseSuggestedTitle, showAlert]
  );

  const toShareableJobPosting = useCallback((jobPosting: any): ShareableJobPosting => {
    return {
      id: String(jobPosting?.id || ''),
      title: jobPosting?.title ?? null,
      description: jobPosting?.description ?? null,
      requirements: jobPosting?.requirements ?? null,
      location: jobPosting?.location ?? null,
      employment_type: jobPosting?.employment_type ?? null,
      salary_range_min: jobPosting?.salary_range_min ?? null,
      salary_range_max: jobPosting?.salary_range_max ?? null,
    };
  }, []);

  const attachApplyLink = useCallback(
    (baseMessage: string, jobId: string) => {
      const applyLink = buildApplyLink({ baseUrl: appWebBaseUrl, jobId });
      let text = String(baseMessage || '').trim();
      if (!text) {
        return `📝 Apply online (no account required): ${applyLink}\n\nPosted via EduDash Pro Hiring Hub`;
      }

      // Support placeholders, and ensure we always include the real link.
      text = text.replace(/\{\{\s*apply_link\s*\}\}/gi, applyLink).replace(/\[\s*apply_link\s*\]/gi, applyLink);
      if (!text.includes(applyLink)) {
        text = `${text}\n\n📝 Apply online (no account required): ${applyLink}`;
      }
      if (!/posted via/i.test(text)) {
        text = `${text}\n\nPosted via EduDash Pro Hiring Hub`;
      }
      return text;
    },
    [appWebBaseUrl]
  );

  const buildShareMessageForVariant = useCallback(
    (variant: WhatsAppMessageVariant, jobPosting: any) => {
      const job = toShareableJobPosting(jobPosting);
      return buildWhatsAppMessage({ variant, baseUrl: appWebBaseUrl, job, school: schoolInfo });
    },
    [appWebBaseUrl, schoolInfo, toShareableJobPosting]
  );

  const handleSharePoster = useCallback(async () => {
    if (!shareJobPosting?.id) return;
    if (Platform.OS === 'web') {
      showAlert({ title: 'Not Available on Web', message: 'Poster sharing is only available on the mobile app.', type: 'info' });
      return;
    }

    try {
      setSharingPoster(true);
      const uri = await posterShotRef.current?.capture?.();
      if (!uri) throw new Error('Capture failed');

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          UTI: 'public.png',
          dialogTitle: 'Share Job Poster',
        });
      } else {
        showAlert({ title: 'Sharing Unavailable', message: 'Sharing is not available on this device.', type: 'warning' });
      }
    } catch (e) {
      console.warn('Failed to share poster:', e);
      showAlert({ title: 'Poster Failed', message: 'Could not generate/share the poster. Try sharing the message instead.', type: 'error' });
    } finally {
      setSharingPoster(false);
    }
  }, [shareJobPosting?.id, showAlert]);

  const handlePolishMessageWithAI = useCallback(async () => {
    if (!shareJobPosting?.id || !shareMessage.trim()) return;
    try {
      setPolishingShareMessage(true);
      const polished = await JobPostingAIService.polishWhatsAppMessage({
        baseMessage: shareMessage,
        schoolName: schoolInfo?.name,
        jobTitle: shareJobPosting?.title || title,
      });
      setShareMessage(attachApplyLink(polished, String(shareJobPosting.id)));
    } catch (e: any) {
      showAlert({
        title: 'AI Failed',
        message: e?.message || 'Could not polish the message right now. Please try again.',
        type: 'error',
      });
    } finally {
      setPolishingShareMessage(false);
    }
  }, [attachApplyLink, schoolInfo?.name, shareJobPosting?.id, shareJobPosting?.title, shareMessage, showAlert, title]);

  const handlePickJobLogo = async () => {
    try {
      if (!preschoolId) {
        showAlert({ title: 'Error', message: 'Missing school information', type: 'error' });
        return;
      }

      const hasPermission = await ensureImageLibraryPermission();
      if (!hasPermission) {
        showAlert({ title: 'Permission Required', message: 'Please grant photo library access to upload a logo', type: 'warning' });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.9,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      setPendingLogoUri(result.assets[0].uri);
    } catch (error: any) {
      showAlert({ title: 'Error', message: error.message || 'Failed to select image', type: 'error' });
    }
  };

  const confirmLogoUpload = async (uri: string) => {
    setJobLogoUploading(true);
    try {
      const processed = await manipulateAsync(
        uri,
        [{ resize: { width: 512, height: 512 } }],
        { compress: 0.85, format: SaveFormat.PNG }
      );

      const base64Data = await FileSystem.readAsStringAsync(processed.uri, { encoding: 'base64' });
      const body = base64ToUint8Array(base64Data);

      if (body.byteLength === 0) {
        throw new Error('Failed to prepare logo for upload');
      }

      const bucket = 'school-assets';
      const timestamp = Date.now();
      const path = `${preschoolId}/job-postings/logo_${timestamp}.png`;

      const { error: uploadError } = await assertSupabase().storage
        .from(bucket)
        .upload(path, body as any, { contentType: 'image/png', upsert: true });

      if (uploadError) throw new Error(uploadError.message);

      const { data: publicData } = assertSupabase().storage.from(bucket).getPublicUrl(path);
      const publicUrl = publicData?.publicUrl;
      if (!publicUrl) throw new Error('Failed to generate logo URL');

      setJobLogoUrl(publicUrl);
      setIncludeSchoolLogo(true);

      // Sync logo to branding
      try {
        await assertSupabase()
          .from('school_branding')
          .upsert({ preschool_id: preschoolId, logo_url: publicUrl }, { onConflict: 'preschool_id' })
          .select('id')
          .single();
      } catch (e) { console.warn('Failed to sync school branding logo:', e); }

      try {
        await assertSupabase().from('organizations').update({ logo_url: publicUrl }).eq('id', preschoolId);
      } catch (e) { console.warn('Failed to update organization logo:', e); }

      try {
        await assertSupabase().from('preschools').update({ logo_url: publicUrl }).eq('id', preschoolId);
      } catch (e) { console.warn('Failed to update preschool logo:', e); }
    } catch (error: any) {
      showAlert({ title: 'Logo Upload Failed', message: error.message || 'Failed to upload logo', type: 'error' });
    } finally {
      setJobLogoUploading(false);
      setPendingLogoUri(null);
    }
  };

  const handleClearJobLogo = () => {
    setJobLogoUrl(null);
  };

  const openSharePreview = (jobPosting: any) => {
    const initialVariant: WhatsAppMessageVariant = 'short';
    const message = buildShareMessageForVariant(initialVariant, jobPosting);
    setShareJobPosting(jobPosting);
    setShareMessage(message);
    setShareVariant(initialVariant);
    setIncludeSchoolHeader(true);
    setIncludeSchoolDetails(true);
    setShareModalVisible(true);
    void loadSchoolInfo();
  };

  const handleShareToWhatsApp = async () => {
    const message = shareMessage.trim();
    if (!message) return;
    const encoded = encodeURIComponent(message);
    const url = `whatsapp://send?text=${encoded}`;
    const webUrl = `https://wa.me/?text=${encoded}`;
    try {
      if (Platform.OS !== 'web') {
        const canOpen = await Linking.canOpenURL(url);
        await Linking.openURL(canOpen ? url : webUrl);
      } else {
        await Linking.openURL(webUrl);
      }
    } catch {
      await Linking.openURL(webUrl);
    }
  };

  const handleCopyMessage = async () => {
    if (!shareMessage.trim()) return;
    await Clipboard.setStringAsync(shareMessage);
    showAlert({ title: 'Copied', message: 'WhatsApp message copied to clipboard.', type: 'success' });
  };

  const handleCopyApplyLink = async () => {
    if (!shareJobPosting?.id) return;
    const link = buildApplyLink({ baseUrl: appWebBaseUrl, jobId: String(shareJobPosting.id) });
    await Clipboard.setStringAsync(link);
    showAlert({ title: 'Copied', message: 'Apply link copied to clipboard.', type: 'success' });
  };

  const handleWhatsAppBroadcast = async (jobPosting: any, messageOverride?: string): Promise<boolean> => {
    try {
      const baseMessage = messageOverride?.trim() || buildShareMessageForVariant(shareVariant, jobPosting);
      const whatsappMessage = attachApplyLink(baseMessage, String(jobPosting.id));
      if (!whatsappMessage.trim()) {
        throw new Error('Message is empty');
      }

      // Call WhatsApp broadcast service
      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/whatsapp-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          message_type: 'text',
          content: whatsappMessage,
          broadcast: true, // Indicates broadcast to contact list
          preschool_id: preschoolId,
          job_posting_id: jobPosting.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send WhatsApp broadcast');
      }

      // Track distribution event
      await HiringHubService.trackJobDistribution({
        job_posting_id: jobPosting.id,
        channel: 'whatsapp',
        distributed_by: user.id,
        recipients_count: 0, // Will be updated by backend with actual count
      });

      showAlert({
        title: 'Success! 🎉',
        message: 'Job posting has been shared via WhatsApp to your contact list.',
        type: 'success',
        buttons: [{ text: 'OK' }],
      });
      return true;
    } catch (error: any) {
      console.error('Error sharing on WhatsApp:', error);
      showAlert({
        title: 'Sharing Failed',
        message: 'Could not share job posting via WhatsApp. You can still share it manually.',
        type: 'error',
        buttons: [{ text: 'OK' }],
      });
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!preschoolId || !user?.id) {
      showAlert({ title: 'Error', message: 'Missing user or school information', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const minSalary = salaryMin ? parseFloat(salaryMin) : undefined;
      const maxSalary = salaryMax ? parseFloat(salaryMax) : undefined;

      const newJobPosting = await HiringHubService.createJobPosting(
        {
          preschool_id: preschoolId,
          title: title.trim(),
          description: description.trim(),
          requirements: requirements.trim() || undefined,
          logo_url: jobLogoUrl || null,
          salary_range_min: minSalary,
          salary_range_max: maxSalary,
          location: location.trim() || undefined,
          employment_type: employmentType,
          expires_at: expiresAt || undefined,
          age_group: ageGroup.trim() || undefined,
          whatsapp_number: whatsappNumber.trim() || undefined,
        },
        user.id
      );

      if (draftParams) {
        try {
          await clearJobPostingDraft(draftParams);
        } catch {
          /* ignore */
        }
        setDraftLastSavedAt(null);
      }

      openSharePreview(newJobPosting);
    } catch (error: any) {
      console.error('Error creating job posting:', error);
      showAlert({ title: 'Error', message: error.message || 'Failed to create job posting', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Create Job Posting', headerShown: false }} />
      <AlertModalComponent />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Job Posting</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Draft + Templates + AI */}
        {draftParams ? (
          <View style={styles.draftBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.draftBarTitle}>Autosave</Text>
              <Text style={styles.draftBarSubtitle}>
                {!draftLoaded
                  ? 'Loading…'
                  : draftSaving
                  ? 'Saving…'
                  : draftLastSavedAt
                  ? `Saved ${new Date(draftLastSavedAt).toLocaleString()}`
                  : 'No draft saved yet'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.draftBarButton}
              onPress={() => {
                showAlert({
                  title: 'Clear Draft?',
                  message: 'This will clear the saved draft and reset the form.',
                  type: 'warning',
                  buttons: [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Clear',
                      style: 'destructive',
                      onPress: () => {
                        void clearDraftAndResetForm();
                      },
                    },
                  ],
                });
              }}
            >
              <Ionicons name="trash-outline" size={18} color={theme.text} />
              <Text style={styles.draftBarButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="layers-outline" size={18} color={theme.textSecondary} />
              <Text style={styles.sectionTitle}>Templates</Text>
            </View>
            <TouchableOpacity style={styles.sectionHeaderButton} onPress={openSaveTemplateModal}>
              <Ionicons name="bookmark-outline" size={16} color={theme.primary} />
              <Text style={styles.sectionHeaderButtonText}>Save current</Text>
            </TouchableOpacity>
          </View>

          {!templatesLoaded ? (
            <Text style={styles.sectionHint}>Loading templates…</Text>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templatesRow}>
                {allTemplates.map((t) => {
                  const isSaved = savedTemplateIds.has(t.id);
                  return (
                    <TouchableOpacity key={t.id} style={styles.templateCard} activeOpacity={0.85} onPress={() => onPressTemplate(t)}>
                      <View style={styles.templateCardTop}>
                        <Text style={styles.templateName} numberOfLines={1}>
                          {t.name}
                        </Text>
                        {isSaved ? (
                          <TouchableOpacity
                            style={styles.templateDeleteButton}
                            onPress={() => deleteSavedTemplate(t.id)}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Ionicons name="trash-outline" size={16} color={theme.textSecondary} />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                      <Text style={styles.templateMeta} numberOfLines={1}>
                        {formatEmploymentType(String(t.employment_type))}
                        {t.category ? ` • ${t.category.toUpperCase()}` : ''}
                      </Text>
                      <Text style={styles.templateTitle} numberOfLines={2}>
                        {t.title}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <Text style={styles.sectionHint}>Tap a template to start fast. Use “Save current” to reuse your best posts.</Text>
            </>
          )}
        </View>

        <View style={styles.aiCard}>
          <LinearGradient
            colors={[theme.primary + '22', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.aiCardBg}
          />
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="sparkles-outline" size={18} color={theme.primary} />
              <Text style={styles.sectionTitle}>AI Assist</Text>
            </View>
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>Next-gen</Text>
            </View>
          </View>
          <Text style={styles.sectionHint}>
            Generate or improve your description and requirements using your school info and role type.
          </Text>
          <TouchableOpacity
            style={[styles.aiPrimaryButton, (aiBusy || !canUseAISuggestions) && styles.aiPrimaryButtonDisabled]}
            onPress={handleAISuggest}
            disabled={aiBusy || !canUseAISuggestions}
          >
            {aiBusy ? <EduDashSpinner color="#FFFFFF" /> : <Ionicons name="sparkles" size={18} color="#FFFFFF" />}
            <Text style={styles.aiPrimaryButtonText}>
              {description.trim() || requirements.trim() ? 'Improve With AI' : 'Generate With AI'}
            </Text>
          </TouchableOpacity>
          {!canUseAISuggestions ? (
            <Text style={styles.sectionHint}>Add a job title to enable AI suggestions.</Text>
          ) : null}
        </View>

        {/* Title */}
        <View style={styles.field}>
          <Text style={styles.label}>
            Job Title <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Early Childhood Teacher"
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        {/* Job Logo */}
        <View style={styles.field}>
          <Text style={styles.label}>School Logo for This Job (Optional)</Text>
          <View style={styles.logoCard}>
            {jobLogoUrl ? (
              <Image source={{ uri: jobLogoUrl }} style={styles.logoPreview} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Ionicons name="image-outline" size={26} color={theme.textSecondary} />
                <Text style={styles.logoPlaceholderText}>No logo uploaded</Text>
              </View>
            )}
            <View style={styles.logoActions}>
              <TouchableOpacity
                style={[styles.logoButton, jobLogoUploading && styles.logoButtonDisabled]}
                disabled={jobLogoUploading}
                onPress={handlePickJobLogo}
              >
                <Text style={styles.logoButtonText}>
                  {jobLogoUploading ? 'Uploading…' : jobLogoUrl ? 'Change Logo' : 'Upload Logo'}
                </Text>
              </TouchableOpacity>
              {jobLogoUrl ? (
                <TouchableOpacity style={styles.logoSecondaryButton} onPress={handleClearJobLogo}>
                  <Text style={styles.logoSecondaryText}>Remove</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <Text style={styles.hint}>
              If you skip this, we will use your school logo (or EduDash Pro if none exists).
            </Text>
          </View>
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>
            Description <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the role, responsibilities, and expectations..."
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        {/* Requirements */}
        <View style={styles.field}>
          <Text style={styles.label}>Requirements</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={requirements}
            onChangeText={setRequirements}
            placeholder="List qualifications, experience, certifications..."
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Salary Range */}
        <View style={styles.field}>
          <Text style={styles.label}>Salary Range (R)</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <TextInput
                style={styles.input}
                value={salaryMin}
                onChangeText={setSalaryMin}
                placeholder="Min"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
              />
            </View>
            <Text style={[styles.separator, { color: theme.textSecondary }]}>to</Text>
            <View style={{ flex: 1 }}>
              <TextInput
                style={styles.input}
                value={salaryMax}
                onChangeText={setSalaryMax}
                placeholder="Max"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        {/* Location */}
        <View style={styles.field}>
          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholder="e.g. Johannesburg, Gauteng"
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        {/* Employment Type */}
        <View style={styles.field}>
          <Text style={styles.label}>
            Employment Type <Text style={styles.required}>*</Text>
          </Text>
          <View style={[styles.pickerContainer, { backgroundColor: theme.surface }]}>
            <Picker
              selectedValue={employmentType}
              onValueChange={(value) => setEmploymentType(value as EmploymentType)}
              style={styles.picker}
              dropdownIconColor={theme.text}
            >
              <Picker.Item label="Full-Time" value={EmploymentType.FULL_TIME} />
              <Picker.Item label="Part-Time" value={EmploymentType.PART_TIME} />
              <Picker.Item label="Contract" value={EmploymentType.CONTRACT} />
              <Picker.Item label="Temporary" value={EmploymentType.TEMPORARY} />
            </Picker>
          </View>
        </View>

        {/* Age Group */}
        <View style={styles.field}>
          <Text style={styles.label}>Age Group</Text>
          <View style={[styles.pickerContainer, { backgroundColor: theme.surface }]}>
            <Picker
              selectedValue={ageGroup}
              onValueChange={(value) => setAgeGroup(value)}
              style={styles.picker}
              dropdownIconColor={theme.text}
            >
              <Picker.Item label="Select age group (optional)" value="" />
              <Picker.Item label="Babies (0–1 year)" value="0-1" />
              <Picker.Item label="Toddlers (1–2 years)" value="1-2" />
              <Picker.Item label="Toddlers (2–3 years)" value="2-3" />
              <Picker.Item label="Preschool (3–4 years)" value="3-4" />
              <Picker.Item label="Pre-K (4–5 years)" value="4-5" />
              <Picker.Item label="Grade R (5–6 years)" value="Grade R" />
              <Picker.Item label="Grade 1–3" value="Grade 1-3" />
              <Picker.Item label="Grade 4–6" value="Grade 4-6" />
              <Picker.Item label="Grade 7–9" value="Grade 7-9" />
              <Picker.Item label="Grade 10–12" value="Grade 10-12" />
              <Picker.Item label="Mixed / All Ages" value="Mixed" />
            </Picker>
          </View>
          <Text style={styles.hint}>What age group will the teacher be working with?</Text>
        </View>

        {/* WhatsApp Number */}
        <View style={styles.field}>
          <Text style={styles.label}>WhatsApp Number</Text>
          <TextInput
            style={styles.input}
            value={whatsappNumber}
            onChangeText={setWhatsappNumber}
            placeholder="e.g. +27 82 123 4567"
            placeholderTextColor={theme.textSecondary}
            keyboardType="phone-pad"
          />
          <Text style={styles.hint}>For quick communication with shortlisted candidates</Text>
        </View>

        {/* Expires At */}
        <View style={styles.field}>
          <Text style={styles.label}>Expires At (Optional)</Text>
          <TextInput
            style={styles.input}
            value={expiresAt}
            onChangeText={setExpiresAt}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.textSecondary}
          />
          <Text style={styles.hint}>Leave blank for no expiration</Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <EduDashSpinner color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Create Job Posting</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Save Template Modal */}
      <Modal
        visible={templateSaveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTemplateSaveModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setTemplateSaveModalVisible(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="bookmark" size={20} color={theme.primary} />
              <Text style={styles.modalTitle}>Save as Template</Text>
            </View>
            <Text style={styles.modalSubtitle}>Reuse this job post in one tap.</Text>

            <Text style={styles.modalLabel}>Template name</Text>
            <TextInput
              style={styles.modalInput}
              value={templateName}
              onChangeText={setTemplateName}
              placeholder="e.g. ECD Teacher (Full-Time)"
              placeholderTextColor={theme.textSecondary}
            />

            <Text style={styles.modalLabel}>Category</Text>
            <View style={[styles.modalPickerContainer, { backgroundColor: theme.surface }]}>
              <Picker
                selectedValue={templateCategory}
                onValueChange={(v) => setTemplateCategory(v as JobPostingTemplate['category'])}
                style={styles.picker}
                dropdownIconColor={theme.text}
              >
                <Picker.Item label="General" value="general" />
                <Picker.Item label="ECD" value="ecd" />
                <Picker.Item label="Assistant" value="assistant" />
                <Picker.Item label="Aftercare" value="aftercare" />
                <Picker.Item label="Admin" value="admin" />
              </Picker>
            </View>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => setTemplateSaveModalVisible(false)}>
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButtonPrimary, savingTemplate && styles.modalButtonDisabled]}
                disabled={savingTemplate}
                onPress={() => void handleSaveTemplate()}
              >
                {savingTemplate ? <EduDashSpinner size="small" color="#FFFFFF" /> : <Ionicons name="save-outline" size={18} color="#FFFFFF" />}
                <Text style={styles.modalButtonPrimaryText}>{savingTemplate ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* AI Suggestions Modal */}
      <Modal
        visible={aiModalVisible}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setAiModalVisible(false)}
      >
        <SafeAreaView style={styles.aiModalContainer} edges={['top', 'bottom']}>
          <View style={styles.aiModalHeader}>
            <TouchableOpacity style={styles.aiModalClose} onPress={() => setAiModalVisible(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <View style={styles.aiModalHeaderCenter}>
              <Ionicons name="sparkles" size={20} color={theme.primary} />
              <Text style={styles.aiModalTitle}>AI Suggestions</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={styles.aiModalScroll} contentContainerStyle={styles.aiModalContent} showsVerticalScrollIndicator={false}>
            {aiSuggestions?.suggested_title ? (
              <View style={styles.aiSuggestionCard}>
                <View style={styles.aiSuggestionTopRow}>
                  <Text style={styles.aiSuggestionLabel}>Suggested title</Text>
                  <View style={styles.aiSwitchRow}>
                    <Text style={styles.aiSwitchText}>Use</Text>
                    <Switch
                      value={aiUseSuggestedTitle}
                      onValueChange={setAiUseSuggestedTitle}
                      trackColor={{ false: theme.border, true: theme.primary }}
                      thumbColor={aiUseSuggestedTitle ? '#fff' : theme.textSecondary}
                    />
                  </View>
                </View>
                <Text style={styles.aiSuggestionText}>{aiSuggestions.suggested_title}</Text>
              </View>
            ) : null}

            {aiSuggestions?.highlights?.length ? (
              <View style={styles.aiSuggestionCard}>
                <Text style={styles.aiSuggestionLabel}>Highlights</Text>
                {aiSuggestions.highlights.map((h, idx) => (
                  <Text key={idx} style={styles.aiBulletText}>
                    • {h}
                  </Text>
                ))}
              </View>
            ) : null}

            <View style={styles.aiSuggestionCard}>
              <Text style={styles.aiSuggestionLabel}>Description</Text>
              <Text style={styles.aiSuggestionText}>{aiSuggestions?.description || ''}</Text>
            </View>

            <View style={styles.aiSuggestionCard}>
              <Text style={styles.aiSuggestionLabel}>Requirements</Text>
              <Text style={styles.aiSuggestionText}>{aiSuggestions?.requirements || ''}</Text>
            </View>

            {(aiSuggestions?.whatsapp_short || aiSuggestions?.whatsapp_long) ? (
              <View style={styles.aiSuggestionCard}>
                <Text style={styles.aiSuggestionLabel}>WhatsApp (no link)</Text>

                {aiSuggestions?.whatsapp_short ? (
                  <>
                    <Text style={styles.aiSuggestionSubLabel}>Short</Text>
                    <Text style={styles.aiSuggestionText}>{aiSuggestions.whatsapp_short}</Text>
                    <TouchableOpacity
                      style={styles.aiCopyBtn}
                      onPress={async () => {
                        await Clipboard.setStringAsync(aiSuggestions.whatsapp_short || '');
                        showAlert({ title: 'Copied', message: 'AI short message copied.', type: 'success' });
                      }}
                    >
                      <Ionicons name="copy-outline" size={16} color={theme.primary} />
                      <Text style={styles.aiCopyBtnText}>Copy short</Text>
                    </TouchableOpacity>
                  </>
                ) : null}

                {aiSuggestions?.whatsapp_long ? (
                  <>
                    <Text style={[styles.aiSuggestionSubLabel, { marginTop: 10 }]}>Long</Text>
                    <Text style={styles.aiSuggestionText}>{aiSuggestions.whatsapp_long}</Text>
                    <TouchableOpacity
                      style={styles.aiCopyBtn}
                      onPress={async () => {
                        await Clipboard.setStringAsync(aiSuggestions.whatsapp_long || '');
                        showAlert({ title: 'Copied', message: 'AI long message copied.', type: 'success' });
                      }}
                    >
                      <Ionicons name="copy-outline" size={16} color={theme.primary} />
                      <Text style={styles.aiCopyBtnText}>Copy long</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.aiModalFooter}>
            <TouchableOpacity style={styles.aiFooterBtnSecondary} onPress={() => applyAISuggestions('fill_empty')}>
              <Text style={styles.aiFooterBtnSecondaryText}>Fill empty</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.aiFooterBtnPrimary} onPress={() => applyAISuggestions('replace')}>
              <Text style={styles.aiFooterBtnPrimaryText}>Replace</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={shareModalVisible}
        transparent={false}
        animationType="slide"
        onRequestClose={() => {
          setShareModalVisible(false);
          router.back();
        }}
      >
        <SafeAreaView style={styles.shareScreenContainer} edges={['top', 'bottom']}>
          {/* Share Screen Header */}
          <View style={styles.shareHeader}>
            <TouchableOpacity
              style={styles.shareHeaderClose}
              onPress={() => {
                setShareModalVisible(false);
                router.back();
              }}
            >
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <View style={styles.shareHeaderCenter}>
              <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
              <Text style={styles.shareHeaderTitle}>Job Posted!</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            style={styles.shareScrollView}
            contentContainerStyle={styles.shareScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Job Preview Card (also used as a shareable poster) */}
            <ViewShot
              ref={posterShotRef}
              options={{ format: 'png', quality: 0.95, result: 'tmpfile' }}
              style={styles.previewCard}
            >
              <LinearGradient
                colors={[theme.primary + '22', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.previewGradient}
              />
              {includeSchoolHeader && (schoolInfo || jobLogoUrl) ? (
                <View style={styles.schoolHeader}>
                  {includeSchoolLogo ? (
                    (jobLogoUrl || schoolInfo?.logoUrl) ? (
                      <Image source={{ uri: jobLogoUrl || schoolInfo?.logoUrl || undefined }} style={styles.schoolLogo} />
                    ) : (
                      <View style={styles.schoolLogoPlaceholder}>
                        <Text style={styles.schoolLogoText}>
                          {schoolInfo?.name?.slice(0, 2).toUpperCase() || 'ED'}
                        </Text>
                      </View>
                    )
                  ) : null}
                  <View style={styles.schoolHeaderText}>
                    <Text style={styles.schoolName}>{schoolInfo?.name || 'School'}</Text>
                    {includeSchoolDetails ? (
                      <Text style={styles.schoolDetails}>{formatSchoolDetails(schoolInfo) || 'School details unavailable'}</Text>
                    ) : null}
                  </View>
                </View>
              ) : null}

              <View style={styles.previewBody}>
                <Text style={styles.previewTitle}>{shareJobPosting?.title || title || 'Teaching Opportunity'}</Text>
                
                {/* Job Meta Tags */}
                <View style={styles.previewMetaRow}>
                  <View style={styles.previewMetaTag}>
                    <Ionicons name="briefcase-outline" size={13} color={theme.primary} />
                    <Text style={styles.previewMetaTagText}>
                      {formatEmploymentType(shareJobPosting?.employment_type || employmentType)}
                    </Text>
                  </View>
                  <View style={styles.previewMetaTag}>
                    <Ionicons name="location-outline" size={13} color={theme.primary} />
                    <Text style={styles.previewMetaTagText}>
                      {shareJobPosting?.location || location || 'Location TBA'}
                    </Text>
                  </View>
                  <View style={styles.previewMetaTag}>
                    <Ionicons name="cash-outline" size={13} color="#22c55e" />
                    <Text style={[styles.previewMetaTagText, { color: '#22c55e' }]}>
                      {formatSalaryRange(shareJobPosting?.salary_range_min ?? null, shareJobPosting?.salary_range_max ?? null)}
                    </Text>
                  </View>
                </View>

                <View style={styles.previewDivider} />

                <Text style={styles.previewSectionLabel}>Description</Text>
                <Text style={styles.previewText} numberOfLines={6}>
                  {shareJobPosting?.description || description || 'Description will appear here.'}
                </Text>

                {(shareJobPosting?.requirements || requirements) ? (
                  <>
                    <Text style={styles.previewSectionLabel}>Requirements</Text>
                    <Text style={styles.previewText} numberOfLines={5}>
                      {shareJobPosting?.requirements || requirements}
                    </Text>
                  </>
                ) : null}
              </View>
              {shareJobPosting?.id ? (
                <View style={styles.posterFooter}>
                  <View style={styles.posterQr}>
                    <QRCode value={buildApplyLink({ baseUrl: appWebBaseUrl, jobId: String(shareJobPosting.id) })} size={84} />
                  </View>
                  <View style={styles.posterFooterText}>
                    <Text style={styles.posterFooterLabel}>Apply online</Text>
                    <Text style={styles.posterFooterLink} numberOfLines={1}>
                      {buildApplyLink({ baseUrl: appWebBaseUrl, jobId: String(shareJobPosting.id) }).replace(/^https?:\/\//i, '')}
                    </Text>
                    <Text style={styles.posterFooterHint}>No account required</Text>
                  </View>
                </View>
              ) : null}
            </ViewShot>

            {/* Branding Toggles */}
            <View style={styles.toggleGroup}>
              <Text style={styles.toggleGroupTitle}>Customise Preview</Text>
              <View style={styles.toggleRow}>
                <View style={styles.toggleLabelRow}>
                  <Ionicons name="business-outline" size={16} color={theme.textSecondary} />
                  <Text style={styles.toggleLabel}>School header</Text>
                </View>
                <Switch
                  value={includeSchoolHeader}
                  onValueChange={setIncludeSchoolHeader}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor={includeSchoolHeader ? '#fff' : theme.textSecondary}
                />
              </View>
              {includeSchoolHeader && (
                <>
                  <View style={styles.toggleRow}>
                    <View style={styles.toggleLabelRow}>
                      <Ionicons name="image-outline" size={16} color={theme.textSecondary} />
                      <Text style={styles.toggleLabel}>Logo</Text>
                    </View>
                    <Switch
                      value={includeSchoolLogo}
                      onValueChange={setIncludeSchoolLogo}
                      trackColor={{ false: theme.border, true: theme.primary }}
                      thumbColor={includeSchoolLogo ? '#fff' : theme.textSecondary}
                    />
                  </View>
                  <View style={styles.toggleRow}>
                    <View style={styles.toggleLabelRow}>
                      <Ionicons name="information-circle-outline" size={16} color={theme.textSecondary} />
                      <Text style={styles.toggleLabel}>Contact details</Text>
                    </View>
                    <Switch
                      value={includeSchoolDetails}
                      onValueChange={setIncludeSchoolDetails}
                      trackColor={{ false: theme.border, true: theme.primary }}
                      thumbColor={includeSchoolDetails ? '#fff' : theme.textSecondary}
                    />
                  </View>
                </>
              )}
            </View>

            {/* WhatsApp Message Preview */}
            <View style={styles.messageSection}>
              <View style={styles.messageSectionHeader}>
                <Ionicons name="logo-whatsapp" size={18} color="#22c55e" />
                <Text style={styles.messageSectionTitle}>WhatsApp Message</Text>
              </View>

              <View style={styles.messageControlsRow}>
                <View style={styles.variantRow}>
                  <TouchableOpacity
                    style={[styles.variantChip, shareVariant === 'short' && styles.variantChipActive]}
                    onPress={() => {
                      if (!shareJobPosting) return;
                      const v: WhatsAppMessageVariant = 'short';
                      setShareVariant(v);
                      setShareMessage(buildShareMessageForVariant(v, shareJobPosting));
                    }}
                  >
                    <Text style={[styles.variantChipText, shareVariant === 'short' && styles.variantChipTextActive]}>Short</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.variantChip, shareVariant === 'detailed' && styles.variantChipActive]}
                    onPress={() => {
                      if (!shareJobPosting) return;
                      const v: WhatsAppMessageVariant = 'detailed';
                      setShareVariant(v);
                      setShareMessage(buildShareMessageForVariant(v, shareJobPosting));
                    }}
                  >
                    <Text style={[styles.variantChipText, shareVariant === 'detailed' && styles.variantChipTextActive]}>Detailed</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.aiPolishChip, (polishingShareMessage || !canPolishShareMessageWithAI) && styles.aiPolishChipDisabled]}
                  disabled={polishingShareMessage || !canPolishShareMessageWithAI}
                  onPress={handlePolishMessageWithAI}
                >
                  {polishingShareMessage ? (
                    <EduDashSpinner size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                  )}
                  <Text style={styles.aiPolishChipText}>AI Polish</Text>
                </TouchableOpacity>
              </View>
              {!canPolishShareMessageWithAI ? (
                <Text style={styles.sectionHint}>Enter a message first to enable AI polish.</Text>
              ) : null}

              {(aiWhatsAppShort || aiWhatsAppLong) && shareJobPosting?.id ? (
                <View style={styles.aiMessageRow}>
                  {aiWhatsAppShort ? (
                    <TouchableOpacity
                      style={styles.aiMessageChip}
                      onPress={() => setShareMessage(attachApplyLink(aiWhatsAppShort, String(shareJobPosting.id)))}
                    >
                      <Ionicons name="sparkles-outline" size={14} color={theme.primary} />
                      <Text style={styles.aiMessageChipText}>Use AI short</Text>
                    </TouchableOpacity>
                  ) : null}
                  {aiWhatsAppLong ? (
                    <TouchableOpacity
                      style={styles.aiMessageChip}
                      onPress={() => setShareMessage(attachApplyLink(aiWhatsAppLong, String(shareJobPosting.id)))}
                    >
                      <Ionicons name="sparkles-outline" size={14} color={theme.primary} />
                      <Text style={styles.aiMessageChipText}>Use AI long</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}

              <TextInput
                style={styles.messageInput}
                value={shareMessage}
                onChangeText={setShareMessage}
                placeholder="Message preview..."
                placeholderTextColor={theme.textSecondary}
                multiline
                textAlignVertical="top"
              />
            </View>

            {/* Share Actions */}
            <View style={styles.shareActionsSection}>
              <TouchableOpacity style={styles.whatsappShareBtn} onPress={handleShareToWhatsApp}>
                <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                <Text style={styles.whatsappShareText}>Share to WhatsApp</Text>
              </TouchableOpacity>

              <View style={styles.shareSecondaryRow}>
                <TouchableOpacity style={styles.copyMessageBtn} onPress={handleCopyMessage}>
                  <Ionicons name="copy-outline" size={18} color={theme.text} />
                  <Text style={styles.copyMessageText}>Copy Message</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.copyLinkBtn} onPress={handleCopyApplyLink}>
                  <Ionicons name="link-outline" size={18} color={theme.text} />
                  <Text style={styles.copyMessageText}>Copy Link</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.shareSecondaryRow}>
                <TouchableOpacity
                  style={[styles.posterBtn, sharingPoster && styles.posterBtnDisabled]}
                  disabled={sharingPoster}
                  onPress={handleSharePoster}
                >
                  {sharingPoster ? (
                    <EduDashSpinner size="small" color={theme.primary} />
                  ) : (
                    <Ionicons name="image-outline" size={18} color={theme.primary} />
                  )}
                  <Text style={styles.posterBtnText}>{sharingPoster ? 'Preparing…' : 'Share Poster'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.broadcastBtn}
                  disabled={broadcasting}
                  onPress={() => {
                    if (!shareJobPosting) return;
                    showAlert({
                      title: 'Broadcast to all contacts?',
                      message: 'This will send the message to your full WhatsApp contact list. Continue?',
                      type: 'warning',
                      buttons: [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Broadcast',
                          style: 'destructive',
                          onPress: async () => {
                            setBroadcasting(true);
                            const success = await handleWhatsAppBroadcast(shareJobPosting, shareMessage);
                            setBroadcasting(false);
                            if (success) {
                              setShareModalVisible(false);
                              router.back();
                            }
                          },
                        },
                      ],
                    });
                  }}
                >
                  <Ionicons name="megaphone-outline" size={18} color="#f59e0b" />
                  <Text style={styles.broadcastBtnText}>{broadcasting ? 'Sending…' : 'Broadcast'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Done / Footer */}
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => {
                setShareModalVisible(false);
                router.back();
              }}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>

            <Text style={styles.shareFooterText}>Posted via EduDash Pro Hiring Hub</Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Logo confirm modal */}
      <ImageConfirmModal
        visible={!!pendingLogoUri}
        imageUri={pendingLogoUri}
        onConfirm={confirmLogoUpload}
        onCancel={() => setPendingLogoUri(null)}
        title="Job Logo"
        confirmLabel="Set Logo"
        showCrop
        cropAspect={[1, 1]}
        loading={jobLogoUploading}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: 16,
      paddingBottom: 32,
    },
    // ── Draft / Templates / AI ──
    draftBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      marginBottom: 16,
    },
    draftBarTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.text,
    },
    draftBarSubtitle: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    draftBarButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    draftBarButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.text,
    },
    sectionCard: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      backgroundColor: theme.surface,
      padding: 14,
      gap: 12,
      marginBottom: 16,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.text,
    },
    sectionHeaderButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    sectionHeaderButtonText: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.primary,
    },
    sectionHint: {
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 16,
    },
    templatesRow: {
      paddingVertical: 2,
      gap: 12,
    },
    templateCard: {
      width: 220,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 12,
      gap: 6,
    },
    templateCardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    templateName: {
      flex: 1,
      fontSize: 13,
      fontWeight: '900',
      color: theme.text,
    },
    templateDeleteButton: {
      padding: 2,
    },
    templateMeta: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    templateTitle: {
      fontSize: 13,
      color: theme.text,
      lineHeight: 18,
    },
    aiCard: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      backgroundColor: theme.surface,
      padding: 14,
      gap: 12,
      marginBottom: 16,
      overflow: 'hidden',
    },
    aiCardBg: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    aiBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: theme.primary + '1A',
      borderWidth: 1,
      borderColor: theme.primary + '33',
    },
    aiBadgeText: {
      fontSize: 11,
      fontWeight: '900',
      color: theme.primary,
    },
    aiPrimaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: theme.primary,
      borderRadius: 14,
      paddingVertical: 14,
    },
    aiPrimaryButtonDisabled: {
      opacity: 0.6,
    },
    aiPrimaryButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '900',
    },
    field: {
      marginBottom: 24,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
    },
    required: {
      color: theme.error,
    },
    input: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: theme.text,
    },
    textArea: {
      minHeight: 100,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    separator: {
      fontSize: 14,
      paddingHorizontal: 4,
    },
    pickerContainer: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      overflow: 'hidden',
    },
    picker: {
      color: theme.text,
    },
    hint: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 4,
    },
    logoCard: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 12,
    },
    logoPreview: {
      width: 84,
      height: 84,
      borderRadius: 16,
      alignSelf: 'flex-start',
      marginBottom: 12,
    },
    logoPlaceholder: {
      width: 120,
      height: 84,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    logoPlaceholderText: {
      marginTop: 6,
      fontSize: 12,
      color: theme.textSecondary,
    },
    logoActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 8,
    },
    logoButton: {
      backgroundColor: theme.primary,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
    },
    logoButtonDisabled: {
      opacity: 0.6,
    },
    logoButtonText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 14,
    },
    logoSecondaryButton: {
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    logoSecondaryText: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
    submitButton: {
      backgroundColor: theme.primary,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
      marginTop: 16,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    // ── Template Save Modal ──
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 18,
    },
    modalCard: {
      width: '100%',
      maxWidth: 520,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 16,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '900',
      color: theme.text,
    },
    modalSubtitle: {
      marginTop: 8,
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 16,
      marginBottom: 14,
    },
    modalLabel: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.textSecondary,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    modalInput: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 12,
      fontSize: 15,
      color: theme.text,
      marginBottom: 14,
    },
    modalPickerContainer: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 14,
    },
    modalButtonRow: {
      flexDirection: 'row',
      gap: 10,
    },
    modalButtonSecondary: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingVertical: 12,
    },
    modalButtonSecondaryText: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.text,
    },
    modalButtonPrimary: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 14,
      backgroundColor: theme.primary,
      paddingVertical: 12,
    },
    modalButtonPrimaryText: {
      fontSize: 14,
      fontWeight: '900',
      color: '#FFFFFF',
    },
    modalButtonDisabled: {
      opacity: 0.6,
    },
    // ── AI Modal ──
    aiModalContainer: {
      flex: 1,
      backgroundColor: theme.background,
    },
    aiModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    aiModalClose: {
      padding: 8,
    },
    aiModalHeaderCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    aiModalTitle: {
      fontSize: 18,
      fontWeight: '900',
      color: theme.text,
    },
    aiModalScroll: {
      flex: 1,
    },
    aiModalContent: {
      padding: 16,
      paddingBottom: 24,
      gap: 12,
    },
    aiSuggestionCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 14,
      gap: 8,
    },
    aiSuggestionTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    aiSuggestionLabel: {
      fontSize: 12,
      fontWeight: '900',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    aiSuggestionSubLabel: {
      fontSize: 12,
      fontWeight: '900',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    aiSuggestionText: {
      fontSize: 14,
      color: theme.text,
      lineHeight: 20,
    },
    aiBulletText: {
      fontSize: 14,
      color: theme.text,
      lineHeight: 20,
    },
    aiSwitchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    aiSwitchText: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.textSecondary,
    },
    aiCopyBtn: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.card,
    },
    aiCopyBtnText: {
      fontSize: 13,
      fontWeight: '900',
      color: theme.primary,
    },
    aiModalFooter: {
      flexDirection: 'row',
      gap: 12,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.background,
    },
    aiFooterBtnSecondary: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingVertical: 14,
    },
    aiFooterBtnSecondaryText: {
      fontSize: 14,
      fontWeight: '900',
      color: theme.text,
    },
    aiFooterBtnPrimary: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      backgroundColor: theme.primary,
      paddingVertical: 14,
    },
    aiFooterBtnPrimaryText: {
      fontSize: 14,
      fontWeight: '900',
      color: '#FFFFFF',
    },
    // ── Share Screen (full-screen modal) ──
    shareScreenContainer: {
      flex: 1,
      backgroundColor: theme.background,
    },
    shareHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    shareHeaderClose: {
      padding: 8,
    },
    shareHeaderCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    shareHeaderTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
    },
    shareScrollView: {
      flex: 1,
    },
    shareScrollContent: {
      padding: 16,
      paddingBottom: 40,
      gap: 16,
    },
    // Preview Card
    previewCard: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: theme.surface,
      position: 'relative',
    },
    previewGradient: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    schoolHeader: {
      flexDirection: 'row',
      gap: 12,
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.card,
      alignItems: 'center',
    },
    schoolLogo: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: theme.surface,
    },
    schoolLogoPlaceholder: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    schoolLogoText: {
      color: theme.onPrimary,
      fontWeight: '700',
      fontSize: 16,
    },
    schoolHeaderText: {
      flex: 1,
    },
    schoolName: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
    },
    schoolDetails: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    previewBody: {
      padding: 16,
      gap: 8,
    },
    previewTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 4,
    },
    previewMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 4,
    },
    previewMetaTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.card,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    previewMetaTagText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.text,
    },
    previewDivider: {
      height: 1,
      backgroundColor: theme.border,
      marginVertical: 4,
    },
    previewSectionLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.textSecondary,
      marginTop: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    previewText: {
      fontSize: 14,
      color: theme.text,
      lineHeight: 20,
    },
    posterFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.card,
    },
    posterQr: {
      width: 96,
      height: 96,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    posterFooterText: {
      flex: 1,
      gap: 4,
    },
    posterFooterLabel: {
      fontSize: 12,
      fontWeight: '900',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    posterFooterLink: {
      fontSize: 13,
      fontWeight: '900',
      color: theme.text,
    },
    posterFooterHint: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    // Invite Code Card
    inviteCodeCard: {
      backgroundColor: theme.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
    },
    inviteCodeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    inviteCodeIconBg: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: 'rgba(99, 102, 241, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    inviteCodeLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    inviteCodeValue: {
      fontSize: 17,
      fontWeight: '800',
      color: theme.text,
      letterSpacing: 1,
      marginTop: 2,
    },
    inviteCodeCopyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    inviteCodeCopyText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.primary,
    },
    // Toggle Group
    toggleGroup: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      padding: 14,
      backgroundColor: theme.card,
      gap: 10,
    },
    toggleGroupTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    toggleLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    toggleLabel: {
      fontSize: 14,
      color: theme.text,
      fontWeight: '600',
    },
    // Message Section
    messageSection: {
      backgroundColor: theme.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      gap: 10,
    },
    messageSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    messageSectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
    },
    messageControlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    variantRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    variantChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    variantChipActive: {
      borderColor: theme.primary,
      backgroundColor: theme.primary + '14',
    },
    variantChipText: {
      fontSize: 12,
      fontWeight: '900',
      color: theme.textSecondary,
    },
    variantChipTextActive: {
      color: theme.primary,
    },
    aiPolishChip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: theme.primary,
    },
    aiPolishChipDisabled: {
      opacity: 0.65,
    },
    aiPolishChipText: {
      fontSize: 12,
      fontWeight: '900',
      color: '#FFFFFF',
    },
    aiMessageRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    aiMessageChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    aiMessageChipText: {
      fontSize: 12,
      fontWeight: '900',
      color: theme.text,
    },
    messageInput: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 13,
      color: theme.text,
      minHeight: 140,
      textAlignVertical: 'top',
      lineHeight: 19,
    },
    // Share Actions
    shareActionsSection: {
      gap: 10,
    },
    whatsappShareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: '#25D366',
      borderRadius: 14,
      paddingVertical: 16,
    },
    whatsappShareText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '800',
    },
    shareSecondaryRow: {
      flexDirection: 'row',
      gap: 10,
    },
    copyMessageBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      paddingVertical: 13,
      backgroundColor: theme.surface,
    },
    copyMessageText: {
      color: theme.text,
      fontWeight: '700',
      fontSize: 14,
    },
    copyLinkBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      paddingVertical: 13,
      backgroundColor: theme.surface,
    },
    posterBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: theme.primary,
      borderRadius: 12,
      paddingVertical: 13,
      backgroundColor: theme.primary + '10',
    },
    posterBtnDisabled: {
      opacity: 0.65,
    },
    posterBtnText: {
      color: theme.primary,
      fontWeight: '800',
      fontSize: 14,
    },
    broadcastBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: '#f59e0b',
      borderRadius: 12,
      paddingVertical: 13,
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
    },
    broadcastBtnText: {
      color: '#f59e0b',
      fontWeight: '700',
      fontSize: 14,
    },
    // Done Button
    doneButton: {
      alignItems: 'center',
      paddingVertical: 14,
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    doneButtonText: {
      color: theme.textSecondary,
      fontWeight: '700',
      fontSize: 15,
    },
    shareFooterText: {
      textAlign: 'center',
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 4,
    },
  });
