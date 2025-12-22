/**
 * AI Lesson Generator Types
 * Type definitions for the lesson generation feature
 */

import type { AIModelInfo } from '@/lib/ai/models';

/**
 * Form state for lesson parameters
 */
export interface LessonFormState {
  topic: string;
  subject: string;
  gradeLevel: string;
  duration: string;
  objectives: string;
  language: string;
}

/**
 * Generation state machine
 */
export type GenerationStatus = 
  | 'idle' 
  | 'generating' 
  | 'completed' 
  | 'error' 
  | 'cancelled';

/**
 * Generation progress information
 */
export interface GenerationProgress {
  status: GenerationStatus;
  progress: number; // 0-100
  message?: string;
  startTime?: number;
  elapsedTime?: number;
}

/**
 * Generated lesson content
 */
export interface GeneratedLesson {
  title: string;
  content: string;
  objectives?: string[];
  activities?: string[];
  assessment?: string;
  materials?: string[];
  duration?: string;
  gradeLevel?: string;
  subject?: string;
}

/**
 * Props for LessonParametersForm component
 */
export interface LessonParametersFormProps {
  formState: LessonFormState;
  onFormChange: (field: keyof LessonFormState, value: string) => void;
  isGenerating: boolean;
  onGenerate: () => void;
  disabled?: boolean;
}

/**
 * Props for ModelSelectorCard component
 */
export interface ModelSelectorCardProps {
  selectedModel: AIModelInfo | null;
  availableModels: AIModelInfo[];
  onSelectModel: (model: AIModelInfo) => void;
  isLoading?: boolean;
  disabled?: boolean;
  userTier?: string;
}

/**
 * Props for GenerationProgress component
 */
export interface GenerationProgressProps {
  progress: GenerationProgress;
  onCancel: () => void;
  showCancel?: boolean;
}

/**
 * Props for ErrorRetrySection component
 */
export interface ErrorRetrySectionProps {
  error: string | null;
  onRetry: () => void;
  onDismiss?: () => void;
  retryCount?: number;
  maxRetries?: number;
}

/**
 * Props for GeneratedContentCard component
 */
export interface GeneratedContentCardProps {
  lesson: GeneratedLesson | null;
  generatedContent: string;
  onSave: () => void;
  onCopy: () => void;
  onClear: () => void;
  isSaving?: boolean;
  showActions?: boolean;
}

/**
 * Props for QuotaBar component
 */
export interface QuotaBarProps {
  used: number;
  limit: number;
  label?: string;
  showPercentage?: boolean;
  warningThreshold?: number; // percentage at which to show warning color
  criticalThreshold?: number; // percentage at which to show critical color
}

/**
 * Subject options for dropdown
 */
export const SUBJECT_OPTIONS = [
  { label: 'Mathematics', value: 'mathematics' },
  { label: 'English', value: 'english' },
  { label: 'Science', value: 'science' },
  { label: 'Social Studies', value: 'social_studies' },
  { label: 'Art', value: 'art' },
  { label: 'Music', value: 'music' },
  { label: 'Physical Education', value: 'physical_education' },
  { label: 'Life Skills', value: 'life_skills' },
  { label: 'Technology', value: 'technology' },
  { label: 'Other', value: 'other' },
];

/**
 * Grade level options for dropdown
 */
export const GRADE_LEVEL_OPTIONS = [
  { label: 'Pre-K', value: 'pre_k' },
  { label: 'Kindergarten', value: 'kindergarten' },
  { label: 'Grade 1', value: 'grade_1' },
  { label: 'Grade 2', value: 'grade_2' },
  { label: 'Grade 3', value: 'grade_3' },
  { label: 'Grade 4', value: 'grade_4' },
  { label: 'Grade 5', value: 'grade_5' },
  { label: 'Grade 6', value: 'grade_6' },
  { label: 'Grade 7', value: 'grade_7' },
  { label: 'Grade 8', value: 'grade_8' },
  { label: 'Grade 9', value: 'grade_9' },
  { label: 'Grade 10', value: 'grade_10' },
  { label: 'Grade 11', value: 'grade_11' },
  { label: 'Grade 12', value: 'grade_12' },
];

/**
 * Duration options for dropdown
 */
export const DURATION_OPTIONS = [
  { label: '15 minutes', value: '15' },
  { label: '30 minutes', value: '30' },
  { label: '45 minutes', value: '45' },
  { label: '60 minutes', value: '60' },
  { label: '90 minutes', value: '90' },
  { label: '120 minutes', value: '120' },
];

/**
 * Language options for dropdown
 */
export const LANGUAGE_OPTIONS = [
  { label: 'English', value: 'en' },
  { label: 'Afrikaans', value: 'af' },
  { label: 'Zulu', value: 'zu' },
  { label: 'Xhosa', value: 'xh' },
  { label: 'Sotho', value: 'st' },
  { label: 'Tswana', value: 'tn' },
  { label: 'Sepedi', value: 'nso' },
  { label: 'Venda', value: 've' },
  { label: 'Tsonga', value: 'ts' },
  { label: 'Swati', value: 'ss' },
  { label: 'Ndebele', value: 'nr' },
];

/**
 * Default form values
 */
export const DEFAULT_FORM_STATE: LessonFormState = {
  topic: '',
  subject: 'mathematics',
  gradeLevel: 'grade_1',
  duration: '45',
  objectives: '',
  language: 'en',
};

/**
 * Default generation progress
 */
export const DEFAULT_GENERATION_PROGRESS: GenerationProgress = {
  status: 'idle',
  progress: 0,
};
