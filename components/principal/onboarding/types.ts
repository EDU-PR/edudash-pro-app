// Types for Principal Onboarding

export type OnboardingStep = 'type_selection' | 'details' | 'invites' | 'templates' | 'subscription' | 'review';

export type SchoolType = 'preschool' | 'k12_school' | 'hybrid';

export type PlanTier = 'free' | 'starter' | 'premium' | 'enterprise';

export interface InviteResult {
  email: string;
  status: 'pending' | 'sent' | 'error';
  id?: string;
}

export interface OnboardingState {
  step: OnboardingStep;
  schoolType: SchoolType;
  schoolName: string;
  adminName: string;
  phone: string;
  planTier: PlanTier;
  emailInput: string;
  emails: string[];
  selectedTemplates: string[];
  schoolId: string | null;
  showSubscriptionStep: boolean;
  creating: boolean;
  sendingInvites: boolean;
  sentInvites: InviteResult[];
}

export const INITIAL_ONBOARDING_STATE: OnboardingState = {
  step: 'type_selection',
  schoolType: 'preschool',
  schoolName: '',
  adminName: '',
  phone: '',
  planTier: 'free',
  emailInput: '',
  emails: [],
  selectedTemplates: [],
  schoolId: null,
  showSubscriptionStep: true,
  creating: false,
  sendingInvites: false,
  sentInvites: [],
};

export interface TemplateOption {
  id: string;
  name: string;
}

export const AVAILABLE_TEMPLATES: TemplateOption[] = [
  { id: 'starter_classes', name: 'Starter Class Groups' },
  { id: 'starter_lessons', name: 'AI Lesson Starters' },
  { id: 'attendance_pack', name: 'Attendance + Reports Pack' },
];

export const SCHOOL_TYPES = [
  { id: 'preschool' as SchoolType, name: 'Preschool', desc: 'Early childhood education (ages 0-6)' },
  { id: 'k12_school' as SchoolType, name: 'K-12 School', desc: 'Primary & secondary education (grades K-12)' },
  { id: 'hybrid' as SchoolType, name: 'Hybrid Institution', desc: 'Combined preschool and K-12 programs' },
];

export const PLAN_TIERS: PlanTier[] = ['free', 'starter', 'premium', 'enterprise'];
