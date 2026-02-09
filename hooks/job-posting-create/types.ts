/** Types for job-posting-create hook folder */
import type { EmploymentType } from '@/types/hiring';
import type { WhatsAppMessageVariant } from '@/lib/hiring/jobPostingShare';
import type { JobPostingTemplate, SavedJobPostingTemplate } from '@/lib/hiring/jobPostingTemplates';
import type { JobPostingAISuggestions } from '@/lib/services/JobPostingAIService';
import type { AlertButton } from '@/components/ui/AlertModal';

export type ShowAlert = (cfg: {
  title: string;
  message?: string;
  type?: 'info' | 'warning' | 'success' | 'error';
  buttons?: AlertButton[];
}) => void;

export interface SchoolInfo {
  name: string;
  logoUrl?: string | null;
  type?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  city?: string | null;
  province?: string | null;
}

export interface JobPostingFormState {
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  requirements: string;
  setRequirements: (v: string) => void;
  salaryMin: string;
  setSalaryMin: (v: string) => void;
  salaryMax: string;
  setSalaryMax: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
  employmentType: EmploymentType;
  setEmploymentType: (v: EmploymentType) => void;
  expiresAt: string;
  setExpiresAt: (v: string) => void;
  ageGroup: string;
  setAgeGroup: (v: string) => void;
  whatsappNumber: string;
  setWhatsappNumber: (v: string) => void;
}

export interface DraftState {
  draftLoaded: boolean;
  draftSaving: boolean;
  draftLastSavedAt: string | null;
  draftParams: { preschoolId: string; userId: string } | null;
  hasMeaningfulFormContent: boolean;
  clearDraftAndResetForm: () => Promise<void>;
}

export interface TemplateState {
  savedTemplates: SavedJobPostingTemplate[];
  allTemplates: (JobPostingTemplate | SavedJobPostingTemplate)[];
  savedTemplateIds: Set<string>;
  templatesLoaded: boolean;
  templateSaveModalVisible: boolean;
  setTemplateSaveModalVisible: (v: boolean) => void;
  templateName: string;
  setTemplateName: (v: string) => void;
  templateCategory: JobPostingTemplate['category'];
  setTemplateCategory: (v: JobPostingTemplate['category']) => void;
  savingTemplate: boolean;
  onPressTemplate: (t: JobPostingTemplate) => void;
  deleteSavedTemplate: (id: string) => void;
  openSaveTemplateModal: () => void;
  handleSaveTemplate: () => Promise<void>;
}

export interface AIState {
  aiBusy: boolean;
  aiModalVisible: boolean;
  setAiModalVisible: (v: boolean) => void;
  aiSuggestions: JobPostingAISuggestions | null;
  aiUseSuggestedTitle: boolean;
  setAiUseSuggestedTitle: (v: boolean) => void;
  aiWhatsAppShort: string | null;
  aiWhatsAppLong: string | null;
  canUseAISuggestions: boolean;
  handleAISuggest: () => Promise<void>;
  applyAISuggestions: (mode: 'replace' | 'fill_empty') => void;
}

export interface ShareState {
  shareModalVisible: boolean;
  setShareModalVisible: (v: boolean) => void;
  shareJobPosting: any;
  shareMessage: string;
  setShareMessage: (v: string) => void;
  shareVariant: WhatsAppMessageVariant;
  setShareVariant: (v: WhatsAppMessageVariant) => void;
  broadcasting: boolean;
  polishingShareMessage: boolean;
  canPolishShareMessageWithAI: boolean;
  sharingPoster: boolean;
  schoolInfo: SchoolInfo | null;
  includeSchoolHeader: boolean;
  setIncludeSchoolHeader: (v: boolean) => void;
  includeSchoolLogo: boolean;
  setIncludeSchoolLogo: (v: boolean) => void;
  includeSchoolDetails: boolean;
  setIncludeSchoolDetails: (v: boolean) => void;
  appWebBaseUrl: string;
  posterShotRef: React.RefObject<any>;
  formatSchoolDetails: (info: SchoolInfo | null) => string;
  buildShareMessageForVariant: (variant: WhatsAppMessageVariant, job: any) => string;
  attachApplyLink: (msg: string, jobId: string) => string;
  handleShareToWhatsApp: () => Promise<void>;
  handleCopyMessage: () => Promise<void>;
  handleCopyApplyLink: () => Promise<void>;
  handleSharePoster: () => Promise<void>;
  handlePolishMessageWithAI: () => Promise<void>;
  handleWhatsAppBroadcast: (job: any, msgOverride?: string) => Promise<boolean>;
  openSharePreview: (job: any) => void;
}

export interface LogoState {
  jobLogoUrl: string | null;
  jobLogoUploading: boolean;
  pendingLogoUri: string | null;
  setPendingLogoUri: (v: string | null) => void;
  handlePickJobLogo: () => Promise<void>;
  confirmLogoUpload: (uri: string) => Promise<void>;
  handleClearJobLogo: () => void;
}
