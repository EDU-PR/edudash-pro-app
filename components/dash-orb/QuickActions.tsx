import React from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeTier } from '@/hooks/useRealtimeTier';
import { isSuperAdmin } from '@/lib/roleUtils';
import { TIER_HIERARCHY, type SubscriptionTier } from '@/lib/ai/models';
import { normalizeRole } from '@/lib/rbac';
import { getDashAIRoleCopy } from '@/lib/ai/dashRoleCopy';
import { getTutorChallengePlan } from '@/features/dash-assistant/tutorChallengePolicy';
import { createDashOrbStyles } from './DashOrb.styles';

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  color: string;
  command: string;
  defaultTopic?: string;
  category: 'devops' | 'platform' | 'users' | 'analytics' | 'ai' | 'education';
  /** If true, only super_admin can see this action */
  superAdminOnly?: boolean;
  /** Allowed roles for this action (normalized roles from RBAC) */
  allowedRoles?: Array<'parent' | 'student' | 'teacher' | 'principal' | 'principal_admin' | 'super_admin'>;
  /** Minimum subscription tier required for this action */
  minTier?: SubscriptionTier;
}

// Comprehensive quick actions for all platform features
// Actions marked with superAdminOnly: true will only show for super_admin users
export const QUICK_ACTIONS: QuickAction[] = [
  // DevOps - SUPER ADMIN ONLY
  { id: 'build-android', label: 'Build Android', icon: 'logo-android', color: '#3ddc84', command: 'Trigger an Android preview build', category: 'devops', superAdminOnly: true, allowedRoles: ['super_admin'] },
  { id: 'build-ios', label: 'Build iOS', icon: 'logo-apple', color: '#ffffff', command: 'Trigger an iOS preview build', category: 'devops', superAdminOnly: true, allowedRoles: ['super_admin'] },
  { id: 'build-status', label: 'Build Status', icon: 'construct', color: '#06b6d4', command: 'Show current EAS build status', category: 'devops', superAdminOnly: true, allowedRoles: ['super_admin'] },
  { id: 'view-commits', label: 'Git Commits', icon: 'git-commit', color: '#f59e0b', command: 'Show recent GitHub commits on main branch', category: 'devops', superAdminOnly: true, allowedRoles: ['super_admin'] },
  { id: 'view-prs', label: 'Pull Requests', icon: 'git-pull-request', color: '#ec4899', command: 'List open pull requests', category: 'devops', superAdminOnly: true, allowedRoles: ['super_admin'] },
  
  // Platform Analytics - SUPER ADMIN ONLY
  { id: 'platform-stats', label: 'Platform Stats', icon: 'stats-chart', color: '#8b5cf6', command: 'Show platform statistics for this month', category: 'analytics', superAdminOnly: true, allowedRoles: ['super_admin'] },
  { id: 'ai-usage', label: 'AI Usage', icon: 'sparkles', color: '#f59e0b', command: 'Show AI usage statistics for this week grouped by school', category: 'analytics', superAdminOnly: true, allowedRoles: ['super_admin'] },
  { id: 'revenue-report', label: 'Revenue Report', icon: 'cash', color: '#10b981', command: 'Generate revenue report for this month', category: 'analytics', superAdminOnly: true, allowedRoles: ['super_admin'] },
  
  // User & School Management - SUPER ADMIN ONLY
  { id: 'list-schools', label: 'All Schools', icon: 'school', color: '#3b82f6', command: 'List all active schools with their metrics', category: 'platform', superAdminOnly: true, allowedRoles: ['super_admin'] },
  { id: 'list-users', label: 'Recent Users', icon: 'people', color: '#6366f1', command: 'List the 20 most recently created users', category: 'users', superAdminOnly: true, allowedRoles: ['super_admin'] },
  { id: 'principals', label: 'Principals', icon: 'person', color: '#14b8a6', command: 'List all principals with their schools', category: 'users', superAdminOnly: true, allowedRoles: ['super_admin'] },
  
  // System - SUPER ADMIN ONLY
  { id: 'feature-flags', label: 'Feature Flags', icon: 'flag', color: '#ef4444', command: 'Show current feature flag status', category: 'platform', superAdminOnly: true, allowedRoles: ['super_admin'] },
  { id: 'health-check', label: 'System Health', icon: 'pulse', color: '#22c55e', command: 'Run a system health check on all services', category: 'platform', superAdminOnly: true, allowedRoles: ['super_admin'] },
  
  // Education Content Generation - AVAILABLE TO ALL (with quota gating at API level)
  { id: 'gen-lesson', label: 'Lesson Plan', icon: 'book', color: '#8b5cf6', command: 'Create a CAPS-aligned lesson plan', defaultTopic: 'Mathematics: counting', category: 'education', superAdminOnly: false, minTier: 'free', allowedRoles: ['teacher', 'principal_admin', 'super_admin'] },
  { id: 'gen-ecd-theme', label: 'ECD Theme', icon: 'sparkles', color: '#a855f7', command: 'Brainstorm an ECD weekly theme with daily activities, routines, and parent tips', defaultTopic: 'All About Me', category: 'education', superAdminOnly: false, minTier: 'free', allowedRoles: ['teacher', 'principal_admin', 'super_admin'] },
  { id: 'gen-ecd-routine', label: 'Daily Routine', icon: 'time', color: '#38bdf8', command: 'Create a structured ECD daily routine with transitions and classroom management cues', defaultTopic: 'Half-day class schedule', category: 'education', superAdminOnly: false, minTier: 'free', allowedRoles: ['principal_admin', 'super_admin'] },
  { id: 'gen-ecd-workshop', label: 'Parent Workshop', icon: 'people', color: '#22c55e', command: 'Draft a parent workshop plan with objectives, agenda, activities, and take-home tips', defaultTopic: 'Supporting language development at home', category: 'education', superAdminOnly: false, minTier: 'free', allowedRoles: ['teacher', 'principal_admin', 'super_admin'] },
  { id: 'gen-stem', label: 'STEM Activity', icon: 'flask', color: '#ec4899', command: 'Design a hands-on STEM activity', defaultTopic: 'basic robotics with recycled materials', category: 'education', superAdminOnly: false, minTier: 'starter', allowedRoles: ['teacher', 'principal_admin', 'super_admin'] },
  { id: 'gen-curriculum', label: 'Curriculum Module', icon: 'albums', color: '#06b6d4', command: 'Create a 4-week curriculum module', defaultTopic: 'digital skills foundations', category: 'education', superAdminOnly: false, minTier: 'premium', allowedRoles: ['principal_admin', 'super_admin'] },
  { id: 'gen-worksheet', label: 'Worksheet', icon: 'document-text', color: '#f59e0b', command: 'Create a practice activity with worked examples directly in chat', defaultTopic: 'Mathematics: addition', category: 'education', superAdminOnly: false, minTier: 'free', allowedRoles: ['teacher', 'principal_admin', 'parent', 'student', 'super_admin'] },
  { id: 'gen-digital', label: 'Digital Skills', icon: 'laptop', color: '#10b981', command: 'Create a digital skills lesson', defaultTopic: 'typing basics', category: 'education', superAdminOnly: false, minTier: 'premium', allowedRoles: ['teacher', 'principal_admin', 'super_admin'] },

  // Visual Generation — all roles with tier gating
  { id: 'gen-image', label: 'Generate Image', icon: 'image', color: '#e879f9', command: 'Generate an educational image or illustration', defaultTopic: 'Solar system poster for preschoolers', category: 'education', superAdminOnly: false, minTier: 'starter', allowedRoles: ['teacher', 'principal_admin', 'super_admin'] },

  // Principal Command Center — principal_admin only
  { id: 'principal-attendance', label: 'Attendance', icon: 'checkmark-circle', color: '#22c55e', command: 'Show today\'s attendance summary across all classes', category: 'analytics', superAdminOnly: false, minTier: 'free', allowedRoles: ['principal_admin'] },
  { id: 'principal-fees', label: 'Fee Overview', icon: 'cash', color: '#f59e0b', command: 'Show outstanding fees summary and payment status for this month', category: 'analytics', superAdminOnly: false, minTier: 'free', allowedRoles: ['principal_admin'] },
  { id: 'principal-staff', label: 'Staff Summary', icon: 'people-circle', color: '#8b5cf6', command: 'Show staff roster with teaching assignments and leave status', category: 'analytics', superAdminOnly: false, minTier: 'free', allowedRoles: ['principal_admin'] },
  { id: 'principal-enrolment', label: 'Enrolment', icon: 'person-add', color: '#06b6d4', command: 'Show current enrolment numbers and capacity per class', category: 'analytics', superAdminOnly: false, minTier: 'free', allowedRoles: ['principal_admin'] },
  { id: 'principal-report', label: 'School Report', icon: 'analytics', color: '#ef4444', command: 'Generate a comprehensive school performance report for this term', category: 'analytics', superAdminOnly: false, minTier: 'starter', allowedRoles: ['principal_admin'] },
  { id: 'principal-circular', label: 'Draft Circular', icon: 'mail', color: '#14b8a6', command: 'Draft a parent circular or school communication letter', category: 'education', superAdminOnly: false, minTier: 'free', allowedRoles: ['principal_admin'] },
];

interface QuickActionsProps {
  onAction: (action: QuickAction) => void;
  ageGroup?: string;
  onAgeGroupChange?: (ageGroup: string) => void;
  customPrompt?: string;
  onCustomPromptChange?: (value: string) => void;
  onSendPrompt?: (prompt: string, displayLabel?: string) => void;
}

const AGE_OPTIONS = [
  { id: 'auto', label: 'Auto' },
  { id: '3-5', label: '3-5' },
  { id: '6-8', label: '6-8' },
  { id: '9-12', label: '9-12' },
  { id: '13-15', label: '13-15' },
  { id: '16-18', label: '16-18' },
  { id: 'adult', label: 'Adult' },
];

export const QuickActions: React.FC<QuickActionsProps> = ({
  onAction,
  ageGroup = 'auto',
  onAgeGroupChange,
  customPrompt = '',
  onCustomPromptChange,
  onSendPrompt,
}) => {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createDashOrbStyles(theme), [theme]);
  const { profile } = useAuth();
  const { tierStatus } = useRealtimeTier();
  const roleCopy = getDashAIRoleCopy(profile?.role);
  const normalizedRole = normalizeRole(profile?.role || '');
  const isTutorRole = normalizedRole === 'parent' || normalizedRole === 'student';
  const schoolType = String((profile as any)?.school_type || (profile as any)?.organization_type || '').toLowerCase();
  const isPreschool = schoolType.includes('preschool') || schoolType.includes('ecd') || schoolType.includes('early');
  
  // Check if user is super admin - use useMemo to ensure recalculation when profile changes
  const userRole = profile?.role || '';
  const isUserSuperAdmin = React.useMemo(() => {
    const result = isSuperAdmin(userRole);
    // Debug logging - can be removed after verifying fix
    if (__DEV__) {
      console.log('[QuickActions] Role check:', { userRole, isUserSuperAdmin: result, profileExists: !!profile });
    }
    return result;
  }, [userRole, profile]);
  
  // Filter actions based on user role - recalculates when role/super admin changes
  const { analyticsActions, platformActions, devopsActions, educationActions } = React.useMemo(() => {
    const isRoleAllowed = (action: QuickAction) => {
      if (action.superAdminOnly && !isUserSuperAdmin) return false;
      if (isUserSuperAdmin) return true;
      if (!action.allowedRoles || action.allowedRoles.length === 0) return true;
      return normalizedRole ? action.allowedRoles.includes(normalizedRole) : false;
    };

    const visibleActions = QUICK_ACTIONS.filter(isRoleAllowed);
    
    return {
      analyticsActions: visibleActions.filter(a => a.category === 'analytics'),
      platformActions: visibleActions.filter(a => a.category === 'platform' || a.category === 'users'),
      devopsActions: visibleActions.filter(a => a.category === 'devops'),
      educationActions: visibleActions.filter(a => a.category === 'education'),
    };
  }, [isUserSuperAdmin, normalizedRole]);

  const normalizedTier = React.useMemo(
    () => normalizeTier(tierStatus?.isActive ? tierStatus?.tier : 'free'),
    [tierStatus?.tier, tierStatus?.isActive]
  );
  const tierRank = TIER_HIERARCHY[normalizedTier];
  const quizChallengeTarget = React.useMemo(() => {
    const selectedAgeBand = ageGroup && ageGroup !== 'auto' ? ageGroup : null;
    const plan = getTutorChallengePlan({
      mode: 'quiz',
      difficulty: 2,
      learnerContext: {
        ageBand: selectedAgeBand,
        schoolType: isPreschool ? 'preschool' : schoolType || null,
      },
    });
    return plan.maxQuestions;
  }, [ageGroup, isPreschool, schoolType]);
  const quickCtas = isTutorRole
    ? (isPreschool
      ? [
          {
            label: 'Story Time',
            prompt: 'Use a short story and ask one simple question. Keep it playful and age-appropriate for preschool.',
            icon: 'book-outline',
            color: theme.primary,
          },
          {
            label: 'Play & Learn',
            prompt: 'Give one playful practice question using colors, shapes, or counting. Wait for the answer before continuing.',
            icon: 'color-palette-outline',
            color: theme.success || '#16a34a',
          },
          {
            label: 'Quick Quiz',
            prompt: `Quiz with about ${quizChallengeTarget} very easy questions using colors, shapes, or counting. Keep it fun.`,
            icon: 'happy-outline',
            color: theme.warning || '#f59e0b',
          },
          {
            label: 'Recap',
            prompt: 'Summarize in 3 simple bullet points with friendly tone, then ask one short check question.',
            icon: 'sparkles-outline',
            color: theme.info || theme.primary,
          },
        ]
      : [
          {
            label: 'Explain',
            prompt: 'Explain this step-by-step in simple language. Ask one diagnostic question first.',
            icon: 'bulb-outline',
            color: theme.primary,
          },
          {
            label: 'Practice',
            prompt: 'Give me one practice question and wait for my answer before continuing.',
            icon: 'pencil-outline',
            color: theme.success || '#16a34a',
          },
          {
            label: 'Quiz me',
            prompt: `Quiz me with about ${quizChallengeTarget} questions, starting easy and getting harder.`,
            icon: 'school-outline',
            color: theme.warning || '#f59e0b',
          },
          {
            label: 'Summarize',
            prompt: 'Summarize the key ideas in 5 bullet points and ask one quick check question.',
            icon: 'sparkles-outline',
            color: theme.info || theme.primary,
          },
        ])
    : [
        {
          label: 'Draft plan',
          prompt: 'Draft a concise plan with steps, owners, and a timeline.',
          icon: 'map-outline',
          color: theme.primary,
        },
        {
          label: 'Summarize',
          prompt: 'Summarize the key points and list the next actions.',
          icon: 'list-outline',
          color: theme.success || '#16a34a',
        },
        {
          label: 'Template',
          prompt: 'Create a reusable checklist or template for this task.',
          icon: 'document-text-outline',
          color: theme.warning || '#f59e0b',
        },
      ];

  const handleActionPress = (action: QuickAction) => {
    if (isActionLocked(action, tierRank, isUserSuperAdmin)) {
      router.push('/screens/plan-management');
      return;
    }
    onAction(action);
  };

  return (
    <View style={styles.quickActionsContainer}>
      <LinearGradient
        colors={[theme.background, theme.surface, theme.background]}
        style={[styles.quickActionsHeroCard, { borderColor: theme.border }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.quickActionsHeroTop}>
          <View style={[styles.quickActionsHeroIcon, { backgroundColor: theme.primary }]}>
            <Ionicons name="sparkles" size={20} color="#fff" />
          </View>
          <View style={styles.quickActionsHeroText}>
            <Text style={[styles.quickActionsHeroTitle, { color: theme.text }]}>
              {roleCopy.quickActionsTitle}
            </Text>
            <Text style={[styles.quickActionsHeroSubtitle, { color: theme.textSecondary }]}>
              {roleCopy.quickActionsSubtitle}
            </Text>
          </View>
        </View>
        <View style={styles.quickActionsCtasRow}>
          {quickCtas.map((cta) => (
            <TouchableOpacity
              key={cta.label}
              style={[styles.quickActionsCta, { backgroundColor: cta.color }]}
              onPress={() => onSendPrompt?.(cta.prompt, cta.label)}
            >
              <Ionicons name={cta.icon as any} size={16} color={theme.onPrimary || '#fff'} />
              <Text style={[styles.quickActionsCtaText, { color: theme.onPrimary || '#fff' }]}>
                {cta.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      <View style={styles.quickActionsHeader}>
        <Text style={[styles.quickActionsSectionTitle, { color: theme.textSecondary }]}>
          Personalize
        </Text>
        <View style={styles.quickActionsChipsRow}>
          {AGE_OPTIONS.map((option) => {
            const selected = option.id === ageGroup;
            return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.quickActionChip,
                  { backgroundColor: selected ? theme.primary + '22' : theme.background, borderColor: selected ? theme.primary : theme.border },
                ]}
                onPress={() => onAgeGroupChange?.(option.id)}
              >
                <Text style={{ color: selected ? theme.primary : theme.textSecondary, fontSize: 12 }}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TextInput
          style={[styles.quickActionInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
          placeholder="Add topic, grade, or details (optional)"
          placeholderTextColor={theme.textSecondary}
          value={customPrompt}
          onChangeText={(text) => onCustomPromptChange?.(text)}
        />
      </View>
      
      {/* Analytics Section - Super Admin Only */}
      {analyticsActions.length > 0 && (
        <>
          <Text style={[styles.categoryLabel, { color: theme.primary }]}>📊 Analytics</Text>
          <View style={styles.quickActionsGrid}>
            {analyticsActions.map((action) => {
              const locked = isActionLocked(action, tierRank, isUserSuperAdmin);
              const lockLabel = locked ? formatTierLabel(action.minTier) : null;
              return (
              <TouchableOpacity
                key={action.id}
                style={[
                  styles.quickAction,
                  { backgroundColor: theme.surface },
                  locked && styles.quickActionLocked,
                ]}
                onPress={() => handleActionPress(action)}
              >
                <View style={styles.quickActionContent}>
                  <Ionicons name={action.icon as any} size={18} color={action.color} />
                  <Text style={[styles.quickActionText, { color: theme.text }]}>{action.label}</Text>
                </View>
                {locked && (
                  <View style={[styles.quickActionLockBadge, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                    <Ionicons name="lock-closed" size={12} color={theme.textSecondary} />
                    <Text style={[styles.lockBadgeText, { color: theme.textSecondary }]}>{lockLabel}</Text>
                  </View>
                )}
              </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
      
      {/* Platform Section - Super Admin Only */}
      {platformActions.length > 0 && (
        <>
          <Text style={[styles.categoryLabel, { color: theme.primary }]}>🏫 Platform</Text>
          <View style={styles.quickActionsGrid}>
            {platformActions.slice(0, 4).map((action) => {
              const locked = isActionLocked(action, tierRank, isUserSuperAdmin);
              const lockLabel = locked ? formatTierLabel(action.minTier) : null;
              return (
              <TouchableOpacity
                key={action.id}
                style={[
                  styles.quickAction,
                  { backgroundColor: theme.surface },
                  locked && styles.quickActionLocked,
                ]}
                onPress={() => handleActionPress(action)}
              >
                <View style={styles.quickActionContent}>
                  <Ionicons name={action.icon as any} size={18} color={action.color} />
                  <Text style={[styles.quickActionText, { color: theme.text }]}>{action.label}</Text>
                </View>
                {locked && (
                  <View style={[styles.quickActionLockBadge, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                    <Ionicons name="lock-closed" size={12} color={theme.textSecondary} />
                    <Text style={[styles.lockBadgeText, { color: theme.textSecondary }]}>{lockLabel}</Text>
                  </View>
                )}
              </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
      
      {/* DevOps Section - Super Admin Only */}
      {devopsActions.length > 0 && (
        <>
          <Text style={[styles.categoryLabel, { color: theme.primary }]}>🔨 DevOps</Text>
          <View style={styles.quickActionsGrid}>
            {devopsActions.slice(0, 4).map((action) => {
              const locked = isActionLocked(action, tierRank, isUserSuperAdmin);
              const lockLabel = locked ? formatTierLabel(action.minTier) : null;
              return (
              <TouchableOpacity
                key={action.id}
                style={[
                  styles.quickAction,
                  { backgroundColor: theme.surface },
                  locked && styles.quickActionLocked,
                ]}
                onPress={() => handleActionPress(action)}
              >
                <View style={styles.quickActionContent}>
                  <Ionicons name={action.icon as any} size={18} color={action.color} />
                  <Text style={[styles.quickActionText, { color: theme.text }]}>{action.label}</Text>
                </View>
                {locked && (
                  <View style={[styles.quickActionLockBadge, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                    <Ionicons name="lock-closed" size={12} color={theme.textSecondary} />
                    <Text style={[styles.lockBadgeText, { color: theme.textSecondary }]}>{lockLabel}</Text>
                  </View>
                )}
              </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
      
      {/* Education Section - Available to All */}
      {!isTutorRole && educationActions.length > 0 && (
        <>
          <Text style={[styles.categoryLabel, { color: theme.primary }]}>📚 Education tools</Text>
          <View style={styles.quickActionsGrid}>
            {educationActions.map((action) => {
              const locked = isActionLocked(action, tierRank, isUserSuperAdmin);
              const lockLabel = locked ? formatTierLabel(action.minTier) : null;
              return (
              <TouchableOpacity
                key={action.id}
                style={[
                  styles.quickAction,
                  { backgroundColor: theme.surface },
                  locked && styles.quickActionLocked,
                ]}
                onPress={() => handleActionPress(action)}
              >
                <View style={styles.quickActionContent}>
                  <Ionicons name={action.icon as any} size={18} color={action.color} />
                  <Text style={[styles.quickActionText, { color: theme.text }]}>{action.label}</Text>
                </View>
                {locked && (
                  <View style={[styles.quickActionLockBadge, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                    <Ionicons name="lock-closed" size={12} color={theme.textSecondary} />
                    <Text style={[styles.lockBadgeText, { color: theme.textSecondary }]}>{lockLabel}</Text>
                  </View>
                )}
              </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
};

const normalizeTier = (tier?: string | null): SubscriptionTier => {
  const value = (tier || 'free').toLowerCase();
  if (['enterprise', 'school_enterprise'].includes(value)) return 'enterprise';
  if (['premium', 'parent_plus', 'teacher_pro', 'school_premium', 'school_pro', 'pro'].includes(value)) return 'premium';
  if (['starter', 'parent_starter', 'teacher_starter', 'school_starter', 'basic', 'trial'].includes(value)) return 'starter';
  return 'free';
};

const formatTierLabel = (tier?: SubscriptionTier) => {
  if (!tier) return 'Upgrade';
  if (tier === 'starter') return 'Starter+';
  if (tier === 'premium') return 'Premium';
  if (tier === 'enterprise') return 'Enterprise';
  return 'Upgrade';
};

const isActionLocked = (action: QuickAction, tierRank: number, isSuperAdminUser: boolean) => {
  if (isSuperAdminUser) return false;
  if (!action.minTier) return false;
  return tierRank < TIER_HIERARCHY[action.minTier];
};
