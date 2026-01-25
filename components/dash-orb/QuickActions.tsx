import React from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { isSuperAdmin } from '@/lib/roleUtils';
import { styles } from './DashOrb.styles';
import { LinearGradient } from 'expo-linear-gradient';

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
}

// Comprehensive quick actions for all platform features
// Actions marked with superAdminOnly: true will only show for super_admin users
export const QUICK_ACTIONS: QuickAction[] = [
  // DevOps - SUPER ADMIN ONLY
  { id: 'build-android', label: 'Build Android', icon: 'logo-android', color: '#3ddc84', command: 'Trigger an Android preview build', category: 'devops', superAdminOnly: true },
  { id: 'build-ios', label: 'Build iOS', icon: 'logo-apple', color: '#ffffff', command: 'Trigger an iOS preview build', category: 'devops', superAdminOnly: true },
  { id: 'build-status', label: 'Build Status', icon: 'construct', color: '#06b6d4', command: 'Show current EAS build status', category: 'devops', superAdminOnly: true },
  { id: 'view-commits', label: 'Git Commits', icon: 'git-commit', color: '#f59e0b', command: 'Show recent GitHub commits on main branch', category: 'devops', superAdminOnly: true },
  { id: 'view-prs', label: 'Pull Requests', icon: 'git-pull-request', color: '#ec4899', command: 'List open pull requests', category: 'devops', superAdminOnly: true },
  
  // Platform Analytics - SUPER ADMIN ONLY
  { id: 'platform-stats', label: 'Platform Stats', icon: 'stats-chart', color: '#8b5cf6', command: 'Show platform statistics for this month', category: 'analytics', superAdminOnly: true },
  { id: 'ai-usage', label: 'AI Usage', icon: 'sparkles', color: '#f59e0b', command: 'Show AI usage statistics for this week grouped by school', category: 'analytics', superAdminOnly: true },
  { id: 'revenue-report', label: 'Revenue Report', icon: 'cash', color: '#10b981', command: 'Generate revenue report for this month', category: 'analytics', superAdminOnly: true },
  
  // User & School Management - SUPER ADMIN ONLY
  { id: 'list-schools', label: 'All Schools', icon: 'school', color: '#3b82f6', command: 'List all active schools with their metrics', category: 'platform', superAdminOnly: true },
  { id: 'list-users', label: 'Recent Users', icon: 'people', color: '#6366f1', command: 'List the 20 most recently created users', category: 'users', superAdminOnly: true },
  { id: 'principals', label: 'Principals', icon: 'person', color: '#14b8a6', command: 'List all principals with their schools', category: 'users', superAdminOnly: true },
  
  // System - SUPER ADMIN ONLY
  { id: 'feature-flags', label: 'Feature Flags', icon: 'flag', color: '#ef4444', command: 'Show current feature flag status', category: 'platform', superAdminOnly: true },
  { id: 'health-check', label: 'System Health', icon: 'pulse', color: '#22c55e', command: 'Run a system health check on all services', category: 'platform', superAdminOnly: true },
  
  // Education Content Generation - AVAILABLE TO ALL (with quota gating at API level)
  { id: 'gen-lesson', label: 'Lesson Plan', icon: 'book', color: '#8b5cf6', command: 'Create a CAPS-aligned lesson plan', defaultTopic: 'Mathematics: counting', category: 'education', superAdminOnly: false },
  { id: 'gen-stem', label: 'STEM Activity', icon: 'flask', color: '#ec4899', command: 'Design a hands-on STEM activity', defaultTopic: 'basic robotics with recycled materials', category: 'education', superAdminOnly: false },
  { id: 'gen-curriculum', label: 'Curriculum Module', icon: 'albums', color: '#06b6d4', command: 'Create a 4-week curriculum module', defaultTopic: 'digital skills foundations', category: 'education', superAdminOnly: false },
  { id: 'gen-worksheet', label: 'Worksheet', icon: 'document-text', color: '#f59e0b', command: 'Generate a practice worksheet with worked examples', defaultTopic: 'Mathematics: addition', category: 'education', superAdminOnly: false },
  { id: 'gen-digital', label: 'Digital Skills', icon: 'laptop', color: '#10b981', command: 'Create a digital skills lesson', defaultTopic: 'typing basics', category: 'education', superAdminOnly: false },
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
  const { profile } = useAuth();
  
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
  
  // Filter actions based on user role - recalculates when isUserSuperAdmin changes
  const { analyticsActions, platformActions, devopsActions, educationActions } = React.useMemo(() => {
    const visibleActions = QUICK_ACTIONS.filter(action => 
      !action.superAdminOnly || isUserSuperAdmin
    );
    
    return {
      analyticsActions: visibleActions.filter(a => a.category === 'analytics'),
      platformActions: visibleActions.filter(a => a.category === 'platform' || a.category === 'users'),
      devopsActions: visibleActions.filter(a => a.category === 'devops'),
      educationActions: visibleActions.filter(a => a.category === 'education'),
    };
  }, [isUserSuperAdmin]);

  return (
    <View style={styles.quickActionsContainer}>
      <LinearGradient
        colors={['#0b1220', '#101b2d', '#0b1220']}
        style={[styles.quickActionsHeroCard, { borderColor: theme.border }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.quickActionsHeroTop}>
          <View style={[styles.quickActionsHeroIcon, { backgroundColor: theme.primary }]}>
            <Ionicons name="sparkles" size={20} color="#fff" />
          </View>
          <View style={styles.quickActionsHeroText}>
            <Text style={[styles.quickActionsHeroTitle, { color: theme.text }]}>Your personal tutor</Text>
            <Text style={[styles.quickActionsHeroSubtitle, { color: theme.textSecondary }]}>
              Ask anything. I’ll diagnose, teach, and practice with you.
            </Text>
          </View>
        </View>
        <View style={styles.quickActionsCtasRow}>
          <TouchableOpacity
            style={[styles.quickActionsCta, { backgroundColor: theme.primary }]}
            onPress={() => onSendPrompt?.('Ask me one short diagnostic question first, then explain step-by-step in simple language.', 'Explain it')}
          >
            <Ionicons name="bulb-outline" size={16} color={theme.onPrimary || '#fff'} />
            <Text style={[styles.quickActionsCtaText, { color: theme.onPrimary || '#fff' }]}>Explain it</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickActionsCta, { backgroundColor: theme.success || '#16a34a' }]}
            onPress={() => onSendPrompt?.('Give me one practice question to diagnose my level. Wait for my answer before continuing.', 'Help me solve')}
          >
            <Ionicons name="pencil-outline" size={16} color={theme.onPrimary || '#fff'} />
            <Text style={[styles.quickActionsCtaText, { color: theme.onPrimary || '#fff' }]}>Help me solve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickActionsCta, { backgroundColor: theme.warning || '#f59e0b' }]}
            onPress={() => onSendPrompt?.('Quiz me with 5 questions, starting easy and getting harder.', 'Test me')}
          >
            <Ionicons name="school-outline" size={16} color={theme.onPrimary || '#fff'} />
            <Text style={[styles.quickActionsCtaText, { color: theme.onPrimary || '#fff' }]}>Test me</Text>
          </TouchableOpacity>
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
            {analyticsActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={[styles.quickAction, { backgroundColor: theme.background }]}
                onPress={() => onAction(action)}
              >
                <Ionicons name={action.icon as any} size={18} color={action.color} />
                <Text style={[styles.quickActionText, { color: theme.text }]}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
      
      {/* Platform Section - Super Admin Only */}
      {platformActions.length > 0 && (
        <>
          <Text style={[styles.categoryLabel, { color: theme.primary }]}>🏫 Platform</Text>
          <View style={styles.quickActionsGrid}>
            {platformActions.slice(0, 4).map((action) => (
              <TouchableOpacity
                key={action.id}
                style={[styles.quickAction, { backgroundColor: theme.background }]}
                onPress={() => onAction(action)}
              >
                <Ionicons name={action.icon as any} size={18} color={action.color} />
                <Text style={[styles.quickActionText, { color: theme.text }]}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
      
      {/* DevOps Section - Super Admin Only */}
      {devopsActions.length > 0 && (
        <>
          <Text style={[styles.categoryLabel, { color: theme.primary }]}>🔨 DevOps</Text>
          <View style={styles.quickActionsGrid}>
            {devopsActions.slice(0, 4).map((action) => (
              <TouchableOpacity
                key={action.id}
                style={[styles.quickAction, { backgroundColor: theme.background }]}
                onPress={() => onAction(action)}
              >
                <Ionicons name={action.icon as any} size={18} color={action.color} />
                <Text style={[styles.quickActionText, { color: theme.text }]}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
      
      {/* Education Section - Available to All */}
      {educationActions.length > 0 && (
        <>
          <Text style={[styles.categoryLabel, { color: theme.primary }]}>📚 Education tools</Text>
          <View style={styles.quickActionsGrid}>
            {educationActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={[styles.quickAction, { backgroundColor: theme.background }]}
                onPress={() => onAction(action)}
              >
                <Ionicons name={action.icon as any} size={18} color={action.color} />
                <Text style={[styles.quickActionText, { color: theme.text }]}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </View>
  );
};
