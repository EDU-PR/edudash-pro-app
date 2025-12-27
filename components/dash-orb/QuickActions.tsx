import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { styles } from './DashOrb.styles';

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  color: string;
  command: string;
  category: 'devops' | 'platform' | 'users' | 'analytics' | 'ai' | 'education';
}

// Comprehensive quick actions for all platform features
export const QUICK_ACTIONS: QuickAction[] = [
  // DevOps
  { id: 'build-android', label: 'Build Android', icon: 'logo-android', color: '#3ddc84', command: 'Trigger an Android preview build', category: 'devops' },
  { id: 'build-ios', label: 'Build iOS', icon: 'logo-apple', color: '#ffffff', command: 'Trigger an iOS preview build', category: 'devops' },
  { id: 'build-status', label: 'Build Status', icon: 'construct', color: '#06b6d4', command: 'Show current EAS build status', category: 'devops' },
  { id: 'view-commits', label: 'Git Commits', icon: 'git-commit', color: '#f59e0b', command: 'Show recent GitHub commits on main branch', category: 'devops' },
  { id: 'view-prs', label: 'Pull Requests', icon: 'git-pull-request', color: '#ec4899', command: 'List open pull requests', category: 'devops' },
  
  // Platform Analytics
  { id: 'platform-stats', label: 'Platform Stats', icon: 'stats-chart', color: '#8b5cf6', command: 'Show platform statistics for this month', category: 'analytics' },
  { id: 'ai-usage', label: 'AI Usage', icon: 'sparkles', color: '#f59e0b', command: 'Show AI usage statistics for this week grouped by school', category: 'analytics' },
  { id: 'revenue-report', label: 'Revenue Report', icon: 'cash', color: '#10b981', command: 'Generate revenue report for this month', category: 'analytics' },
  
  // User & School Management
  { id: 'list-schools', label: 'All Schools', icon: 'school', color: '#3b82f6', command: 'List all active schools with their metrics', category: 'platform' },
  { id: 'list-users', label: 'Recent Users', icon: 'people', color: '#6366f1', command: 'List the 20 most recently created users', category: 'users' },
  { id: 'principals', label: 'Principals', icon: 'person', color: '#14b8a6', command: 'List all principals with their schools', category: 'users' },
  
  // System
  { id: 'feature-flags', label: 'Feature Flags', icon: 'flag', color: '#ef4444', command: 'Show current feature flag status', category: 'platform' },
  { id: 'health-check', label: 'System Health', icon: 'pulse', color: '#22c55e', command: 'Run a system health check on all services', category: 'platform' },
  
  // Education Content Generation
  { id: 'gen-lesson', label: 'Lesson Plan', icon: 'book', color: '#8b5cf6', command: 'Generate a CAPS-aligned lesson plan for Grade R mathematics about counting', category: 'education' },
  { id: 'gen-stem', label: 'STEM Activity', icon: 'flask', color: '#ec4899', command: 'Generate a beginner robotics activity for ages 5-7 using basic materials', category: 'education' },
  { id: 'gen-curriculum', label: 'Curriculum Module', icon: 'albums', color: '#06b6d4', command: 'Create a 4-week digital skills curriculum for Grade 2', category: 'education' },
  { id: 'gen-worksheet', label: 'Worksheet', icon: 'document-text', color: '#f59e0b', command: 'Generate a Grade 1 mathematics practice worksheet about addition', category: 'education' },
  { id: 'gen-digital', label: 'Digital Skills', icon: 'laptop', color: '#10b981', command: 'Generate a typing skills lesson for ages 8-10 with no prior knowledge', category: 'education' },
];

interface QuickActionsProps {
  onAction: (action: QuickAction) => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ onAction }) => {
  const { theme } = useTheme();

  return (
    <View style={styles.quickActionsContainer}>
      <Text style={[styles.quickActionsTitle, { color: theme.textSecondary }]}>
        Quick Actions
      </Text>
      
      {/* Analytics Section */}
      <Text style={[styles.categoryLabel, { color: theme.primary }]}>📊 Analytics</Text>
      <View style={styles.quickActionsGrid}>
        {QUICK_ACTIONS.filter(a => a.category === 'analytics').map((action) => (
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
      
      {/* Platform Section */}
      <Text style={[styles.categoryLabel, { color: theme.primary }]}>🏫 Platform</Text>
      <View style={styles.quickActionsGrid}>
        {QUICK_ACTIONS.filter(a => a.category === 'platform' || a.category === 'users').slice(0, 4).map((action) => (
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
      
      {/* DevOps Section */}
      <Text style={[styles.categoryLabel, { color: theme.primary }]}>🔨 DevOps</Text>
      <View style={styles.quickActionsGrid}>
        {QUICK_ACTIONS.filter(a => a.category === 'devops').slice(0, 4).map((action) => (
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
      
      {/* Education Section */}
      <Text style={[styles.categoryLabel, { color: theme.primary }]}>📚 Education</Text>
      <View style={styles.quickActionsGrid}>
        {QUICK_ACTIONS.filter(a => a.category === 'education').map((action) => (
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
    </View>
  );
};
