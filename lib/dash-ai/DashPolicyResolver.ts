import { getOrganizationType } from '@/lib/tenant/compat';
import type { OrganizationType } from '@/lib/tenant/types';

export type DashUnifiedMode = 'advisor' | 'tutor' | 'orb';
export type VoiceProvider = 'azure' | 'device';

export interface DashPolicyFlags {
  dash_unified_shell_v1?: boolean;
  dash_voice_policy_v1?: boolean;
  dash_phonics_quality_v1?: boolean;
  dash_context_window_v1?: boolean;
  [key: string]: boolean | undefined;
}

export interface DashPolicyProfile {
  role?: string | null;
  subscription_tier?: string | null;
  organization_type?: string | null;
  school_type?: string | null;
  preschool?: {
    organization_type?: string | null;
    school_type?: string | null;
  } | null;
}

export interface DashPolicyLearnerContext {
  ageBand?: string | null;
  grade?: string | null;
}

export interface DashVoiceUsageState {
  premiumVoiceUsed?: number;
  premiumVoiceQuota?: number;
}

export interface DashPolicyQuickAction {
  id: string;
  label: string;
  icon: string;
  prompt: string;
}

export interface DashVoicePolicy {
  enabled: boolean;
  providerOrder: VoiceProvider[];
  allowDeviceFallback: boolean;
  minRate: number;
  defaultRate: number;
  phonicsRate: number;
}

export interface DashSafetyPolicy {
  piiRedaction: boolean;
  parentConsentRequired: boolean;
  escalationRequired: boolean;
}

export interface ResolvedDashPolicy {
  orgType: OrganizationType;
  role: string;
  effectiveTier: string;
  defaultMode: DashUnifiedMode;
  availableModes: DashUnifiedMode[];
  systemPromptAddendum: string;
  toolShortcuts: string[];
  quickActions: DashPolicyQuickAction[];
  voicePolicy: DashVoicePolicy;
  safetyPolicy: DashSafetyPolicy;
}

export interface ResolveDashPolicyInput {
  profile?: DashPolicyProfile | null;
  role?: string | null;
  orgType?: string | null;
  orgTier?: string | null;
  learnerContext?: DashPolicyLearnerContext;
  usageState?: DashVoiceUsageState;
  flags?: DashPolicyFlags;
}

const STAFF_ROLES = new Set([
  'teacher',
  'principal',
  'principal_admin',
  'admin',
  'super_admin',
  'superadmin',
  'staff',
]);

const LEARNER_ROLES = new Set(['student', 'learner']);

const PREMIUM_LIKE_TIERS = new Set([
  'starter',
  'premium',
  'pro',
  'enterprise',
  'parent_starter',
  'parent_premium',
  'teacher_premium',
  'principal_premium',
  'admin_premium',
]);

const MEMBERSHIP_ORG_TYPES = new Set<OrganizationType>([
  'skills_development',
  'community_org',
  'training_center',
  'corporate',
  'sports_club',
  'university',
]);

function normalizeRole(role: string | null | undefined): string {
  return String(role || '').trim().toLowerCase();
}

function normalizeTier(tier: string | null | undefined): string {
  return String(tier || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
}

function normalizeOrgType(orgType: string | null | undefined): OrganizationType {
  const normalized = String(orgType || '').trim();
  if (!normalized) return 'preschool';
  const direct = normalized.toLowerCase().replace(/-/g, '_');
  const knownOrgTypes = new Set<OrganizationType>([
    'preschool',
    'k12_school',
    'university',
    'corporate',
    'sports_club',
    'community_org',
    'training_center',
    'tutoring_center',
    'skills_development',
  ]);
  if (knownOrgTypes.has(direct as OrganizationType)) {
    return direct as OrganizationType;
  }
  // getOrganizationType already handles fallback/legacy variants.
  return getOrganizationType({ organization_type: normalized, school_type: normalized });
}

export function resolveEffectiveTier(
  role: string | null | undefined,
  profileTier?: string | null,
  orgTier?: string | null
): string {
  const normalizedProfileTier = normalizeTier(profileTier);
  if (normalizedProfileTier) return normalizedProfileTier;

  const normalizedOrgTier = normalizeTier(orgTier);
  if (normalizedOrgTier) return normalizedOrgTier;

  const normalizedRole = normalizeRole(role);
  if (STAFF_ROLES.has(normalizedRole)) return 'premium';
  if (normalizedRole === 'parent') return 'parent_starter';
  if (LEARNER_ROLES.has(normalizedRole)) return 'starter';
  return 'free';
}

export function shouldAllowPremiumVoice(
  tier: string,
  usageState?: DashVoiceUsageState
): boolean {
  const normalizedTier = normalizeTier(tier);
  if (PREMIUM_LIKE_TIERS.has(normalizedTier)) return true;

  const quota = Math.max(0, usageState?.premiumVoiceQuota ?? 3);
  const used = Math.max(0, usageState?.premiumVoiceUsed ?? 0);
  return used < quota;
}

function resolveDefaultMode(role: string, orgType: OrganizationType): DashUnifiedMode {
  if (LEARNER_ROLES.has(role) || role === 'parent') return 'tutor';
  if (MEMBERSHIP_ORG_TYPES.has(orgType)) return 'advisor';
  if (STAFF_ROLES.has(role)) return 'advisor';
  return 'orb';
}

function resolveAvailableModes(role: string, orgType: OrganizationType): DashUnifiedMode[] {
  if (LEARNER_ROLES.has(role) || role === 'parent') return ['tutor', 'orb'];
  if (MEMBERSHIP_ORG_TYPES.has(orgType)) return ['advisor', 'orb'];
  return ['advisor', 'tutor', 'orb'];
}

function buildPromptAddendum(
  orgType: OrganizationType,
  mode: DashUnifiedMode,
  role: string,
  learnerContext?: DashPolicyLearnerContext
): string {
  const gradeNote = learnerContext?.grade ? ` Current grade context: ${learnerContext.grade}.` : '';
  const ageBandNote = learnerContext?.ageBand ? ` Age band context: ${learnerContext.ageBand}.` : '';

  if (orgType === 'preschool') {
    if (mode === 'advisor') {
      return (
        'PRESCHOOL OPERATIONS POLICY: Optimize for principal/teacher execution. ' +
        'Prioritize weekly programs, daily routines, class transitions, parent communication, menu updates, and low-cost material plans. ' +
        'Output practical actions that can be executed in one school day.' +
        ageBandNote
      );
    }
    return (
      'PRESCHOOL TUTOR POLICY: Keep teaching play-based, short, and concrete. ' +
      'Use phonics-friendly guidance, visual prompts, and one instruction at a time. ' +
      'Always include parent-support phrasing when child practice is requested.' +
      ageBandNote
    );
  }

  if (orgType === 'k12_school') {
    return (
      'K12 POLICY: Keep responses CAPS-aligned, grade appropriate, and assessment ready. ' +
      'Use scaffolded steps for learner support and clear rubric language for staff support.' +
      gradeNote
    );
  }

  return (
    'MEMBERSHIP/SKILLS POLICY: Prioritize governance, meeting workflows, compliance summaries, member communication, and practical action lists.' +
    gradeNote +
    ageBandNote
  );
}

function resolveToolShortcuts(orgType: OrganizationType, role: string, mode: DashUnifiedMode): string[] {
  if (mode === 'tutor' && orgType === 'preschool') {
    return ['phonics_tutor', 'worksheet_builder', 'activity_generator', 'caps_lookup'];
  }
  if (mode === 'tutor') {
    return ['homework_helper', 'exam_prep', 'caps_lookup', 'worksheet_builder'];
  }
  if (mode === 'advisor' && orgType === 'preschool') {
    return ['caps_lookup', 'menu_publish', 'weekly_program_builder', 'announcement_compose'];
  }
  if (mode === 'advisor' && MEMBERSHIP_ORG_TYPES.has(orgType)) {
    return ['governance_summary', 'meeting_minutes', 'member_broadcast', 'finance_snapshot'];
  }
  if (STAFF_ROLES.has(role)) {
    return ['caps_lookup', 'announcement_compose', 'lesson_planner'];
  }
  return ['homework_helper', 'caps_lookup'];
}

function resolveQuickActions(orgType: OrganizationType, role: string, mode: DashUnifiedMode): DashPolicyQuickAction[] {
  const isStaff = STAFF_ROLES.has(role);

  if (role === 'super_admin' || role === 'superadmin') {
    return [
      {
        id: 'ops_health',
        label: 'System Health',
        icon: 'pulse-outline',
        prompt: 'Summarize current platform health (DB, edge functions, auth, push/calls) and list the next 3 recommended actions.',
      },
      {
        id: 'ops_usage',
        label: 'AI Usage',
        icon: 'flash-outline',
        prompt: 'Show the top 5 schools by AI usage this month and propose quota adjustments or suspensions if needed.',
      },
      {
        id: 'ops_incident',
        label: 'Incident Draft',
        icon: 'warning-outline',
        prompt: 'Draft an incident update message for internal staff: what happened, impact, mitigation, and next update time.',
      },
    ];
  }

  if (isStaff && orgType === 'preschool' && mode !== 'orb') {
    return [
      {
        id: 'week-program',
        label: 'Week Program',
        icon: 'calendar-outline',
        prompt: 'Create a Monday to Friday preschool program with circle time, play, snack, outdoor, and parent tip blocks.',
      },
      {
        id: 'hotfix-lesson',
        label: 'Hotfix Lesson',
        icon: 'flash-outline',
        prompt: 'Generate a quick rescue lesson aligned to this week theme and monthly focus for a mixed 3-5 class.',
      },
      {
        id: 'parent-digest',
        label: 'Parent Digest',
        icon: 'megaphone-outline',
        prompt: 'Draft a concise parent update for today activities, tomorrow prep, and reminders.',
      },
    ];
  }

  if (isStaff && mode === 'advisor') {
    return [
      { id: 'lesson-plan', label: 'Lesson Plan', icon: 'book-outline', prompt: 'Build a lesson plan with objective, activity flow, and quick assessment.' },
      { id: 'rubric', label: 'Rubric', icon: 'clipboard-outline', prompt: 'Create a simple rubric aligned to the current grade and subject objective.' },
      { id: 'message', label: 'Message', icon: 'chatbubble-outline', prompt: 'Draft a parent/staff message with clear call-to-action and date.' },
    ];
  }

  if ((LEARNER_ROLES.has(role) || role === 'parent') && orgType === 'preschool') {
    return [
      { id: 'phonics', label: 'Phonics', icon: 'volume-high-outline', prompt: 'Teach one preschool letter sound with playful examples and one practice prompt.' },
      { id: 'counting', label: 'Counting', icon: 'calculator-outline', prompt: 'Give a short counting activity for preschool learners using household items.' },
      { id: 'story', label: 'Story', icon: 'book-outline', prompt: 'Tell a very short story and ask one easy comprehension question for a preschool child.' },
    ];
  }

  return [
    { id: 'explain', label: 'Explain', icon: 'bulb-outline', prompt: 'Explain this in simple steps and check my understanding with one question.' },
    { id: 'practice', label: 'Practice', icon: 'pencil-outline', prompt: 'Give me one practice task and then evaluate my answer.' },
    { id: 'summarize', label: 'Summarize', icon: 'document-text-outline', prompt: 'Summarize this into key points and one next action.' },
  ];
}

export function resolveDashPolicy(input: ResolveDashPolicyInput): ResolvedDashPolicy {
  const profile = input.profile || null;
  const role = normalizeRole(input.role || profile?.role || 'guest');
  const orgType = normalizeOrgType(input.orgType || profile?.organization_type || profile?.school_type || String(profile?.preschool?.school_type || profile?.preschool?.organization_type || ''));
  const effectiveTier = resolveEffectiveTier(role, profile?.subscription_tier as string | null, input.orgTier);
  const defaultMode = resolveDefaultMode(role, orgType);
  const availableModes = resolveAvailableModes(role, orgType);
  const toolShortcuts = resolveToolShortcuts(orgType, role, defaultMode);
  const quickActions = resolveQuickActions(orgType, role, defaultMode);
  const systemPromptAddendum = buildPromptAddendum(orgType, defaultMode, role, input.learnerContext);
  const allowPremiumVoice = shouldAllowPremiumVoice(effectiveTier, input.usageState);

  const voicePolicy: DashVoicePolicy = {
    enabled: input.flags?.dash_voice_policy_v1 !== false,
    providerOrder: allowPremiumVoice ? ['azure', 'device'] : ['device'],
    allowDeviceFallback: !allowPremiumVoice,
    minRate: 1.0,
    defaultRate: defaultMode === 'tutor' && orgType === 'preschool' ? 1.0 : 1.05,
    phonicsRate: 0.94,
  };

  const safetyPolicy: DashSafetyPolicy = {
    piiRedaction: true,
    parentConsentRequired: LEARNER_ROLES.has(role) && orgType === 'preschool',
    escalationRequired: STAFF_ROLES.has(role) || MEMBERSHIP_ORG_TYPES.has(orgType),
  };

  return {
    orgType,
    role,
    effectiveTier,
    defaultMode,
    availableModes,
    systemPromptAddendum,
    toolShortcuts,
    quickActions,
    voicePolicy,
    safetyPolicy,
  };
}
