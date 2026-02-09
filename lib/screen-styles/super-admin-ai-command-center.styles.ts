/**
 * Styles, types, constants, and pure helpers for SuperAdminAICommandCenter
 */

import { StyleSheet } from 'react-native';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AIAgent {
  id: string;
  name: string;
  description: string;
  agent_type: string;
  status: 'active' | 'idle' | 'running' | 'error' | 'disabled' | 'maintenance';
  configuration: Record<string, unknown>;
  last_run_at?: string;
  last_run_status?: string;
  success_rate: number;
  total_runs: number;
}

export interface AutonomousTask {
  id: string;
  name: string;
  description: string;
  task_type: string;
  schedule_cron: string;
  is_enabled: boolean;
  last_execution_at?: string;
  next_execution_at?: string;
  last_execution_status?: string;
  configuration: Record<string, unknown>;
}

export interface AIInsight {
  id: string;
  insight_type: 'warning' | 'opportunity' | 'info' | 'action' | 'critical' | 'success';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  data: Record<string, unknown>;
  action_label?: string;
  action_route?: string;
  created_at: string;
}

export interface Integration {
  id: string;
  name: string;
  integration_type: string;
  is_enabled: boolean;
  configuration: Record<string, unknown>;
  last_sync_at?: string;
  last_sync_status?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  tool_calls?: unknown[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const AGENT_ICONS: Record<string, string> = {
  content_moderation: 'shield-checkmark',
  usage_optimization: 'analytics',
  churn_prediction: 'trending-down',
  revenue_forecasting: 'cash',
  support_automation: 'chatbubbles',
  security_scanning: 'lock-closed',
  database_maintenance: 'server',
  backup_management: 'cloud-upload',
  deployment_automation: 'rocket',
  code_analysis: 'code-slash',
  custom: 'construct',
};

export const AGENT_COLORS: Record<string, string> = {
  content_moderation: '#10b981',
  usage_optimization: '#3b82f6',
  churn_prediction: '#f59e0b',
  revenue_forecasting: '#10b981',
  support_automation: '#6366f1',
  security_scanning: '#ef4444',
  database_maintenance: '#8b5cf6',
  backup_management: '#06b6d4',
  deployment_automation: '#ec4899',
  code_analysis: '#14b8a6',
  custom: '#6b7280',
};

// ─── Pure Helpers ───────────────────────────────────────────────────────────

export const getStatusColor = (status: AIAgent['status']): string => {
  switch (status) {
    case 'active': return '#10b981';
    case 'running': return '#3b82f6';
    case 'idle': return '#6b7280';
    case 'error': return '#ef4444';
    case 'disabled': return '#374151';
    case 'maintenance': return '#f59e0b';
    default: return '#6b7280';
  }
};

export const getInsightIcon = (type: AIInsight['insight_type']): string => {
  switch (type) {
    case 'warning': return 'warning';
    case 'opportunity': return 'rocket';
    case 'action': return 'hand-left';
    case 'info': return 'information-circle';
    case 'critical': return 'alert-circle';
    case 'success': return 'checkmark-circle';
    default: return 'information-circle';
  }
};

export const getInsightColor = (type: AIInsight['insight_type']): string => {
  switch (type) {
    case 'warning': return '#f59e0b';
    case 'opportunity': return '#10b981';
    case 'action': return '#3b82f6';
    case 'info': return '#6b7280';
    case 'critical': return '#ef4444';
    case 'success': return '#10b981';
    default: return '#6b7280';
  }
};

export const formatTimeAgo = (timestamp?: string): string => {
  if (!timestamp) return 'Never';
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

// ─── Styles ─────────────────────────────────────────────────────────────────

export function createStyles(_theme: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
    },
    backButton: {
      padding: 8,
      marginRight: 8,
    },
    headerTitle: {
      flex: 1,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
    },
    subtitle: {
      fontSize: 13,
      marginTop: 2,
    },
    assistantButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    content: {
      flex: 1,
    },
    section: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 12,
    },

    // Insights
    insightCard: {
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderLeftWidth: 4,
    },
    insightHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    insightTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
    },
    insightTime: {
      fontSize: 11,
    },
    insightDescription: {
      fontSize: 13,
      lineHeight: 18,
    },
    insightAction: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      marginTop: 10,
      gap: 4,
    },
    insightActionText: {
      fontSize: 12,
      fontWeight: '600',
    },

    // Agents
    agentCard: {
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
    },
    agentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    agentIcon: {
      width: 48,
      height: 48,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    agentInfo: {
      flex: 1,
    },
    agentName: {
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 2,
    },
    agentDescription: {
      fontSize: 12,
      lineHeight: 16,
    },
    agentStats: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 10,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.1)',
    },
    agentStat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    agentStatText: {
      fontSize: 11,
    },
    agentActions: {
      flexDirection: 'row',
      gap: 10,
    },
    agentActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      gap: 4,
    },
    agentActionText: {
      fontSize: 12,
      fontWeight: '500',
    },

    // Tasks
    taskCard: {
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
    },
    taskHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    taskInfo: {
      flex: 1,
      marginRight: 12,
    },
    taskName: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 4,
    },
    taskDescription: {
      fontSize: 12,
      marginBottom: 6,
    },
    taskSchedule: {
      fontSize: 11,
      fontWeight: '500',
    },
    taskToggle: {
      width: 50,
      height: 30,
      borderRadius: 15,
      padding: 4,
      justifyContent: 'center',
    },
    taskToggleKnob: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: '#fff',
    },
    taskFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.1)',
    },
    taskTime: {
      fontSize: 11,
    },
    taskStatusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    taskStatusText: {
      fontSize: 10,
      fontWeight: '600',
    },

    // Access Denied
    accessDenied: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    accessDeniedText: {
      fontSize: 18,
      fontWeight: '600',
      marginTop: 16,
    },

    // Assistant Modal
    assistantOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    assistantContainer: {
      height: '70%',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    assistantHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
    },
    assistantTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    assistantTitle: {
      fontSize: 18,
      fontWeight: '700',
    },
    assistantContent: {
      flex: 1,
      padding: 16,
    },
    assistantWelcome: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
    },
    assistantWelcomeText: {
      textAlign: 'center',
      marginTop: 16,
      fontSize: 14,
      lineHeight: 20,
      paddingHorizontal: 24,
    },
    assistantResponseBox: {
      padding: 16,
      borderRadius: 12,
    },
    assistantResponseText: {
      fontSize: 14,
      lineHeight: 22,
    },
    assistantInputRow: {
      flexDirection: 'row',
      padding: 12,
      borderTopWidth: 1,
      gap: 10,
    },
    assistantInput: {
      flex: 1,
      height: 44,
      borderRadius: 22,
      paddingHorizontal: 16,
      fontSize: 14,
      borderWidth: 1,
    },
    assistantSendBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },

    // Tab Bar
    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      paddingHorizontal: 8,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
    },
    tabText: {
      fontSize: 13,
      fontWeight: '600',
    },

    // Loading
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
    },

    // Empty State
    emptyState: {
      padding: 32,
      borderRadius: 12,
      alignItems: 'center',
    },
    emptyText: {
      marginTop: 12,
      fontSize: 14,
      textAlign: 'center',
    },

    // Status Badge
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'capitalize',
    },

    // Stats
    statItem: {
      alignItems: 'center',
    },
    statLabel: {
      fontSize: 10,
      marginBottom: 2,
    },
    statValue: {
      fontSize: 14,
      fontWeight: '600',
    },

    // Action Button
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      gap: 6,
    },
    actionButtonText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
    },

    // Toggle Button
    toggleButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    toggleText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '700',
    },

    // Task Meta
    taskMeta: {
      marginTop: 8,
    },
    taskMetaText: {
      fontSize: 11,
    },

    // Agent Desc
    agentDesc: {
      fontSize: 12,
      lineHeight: 16,
    },

    // Task Desc
    taskDesc: {
      fontSize: 12,
      lineHeight: 16,
      marginTop: 4,
    },

    // Chat
    chatContent: {
      flex: 1,
    },
    chatBubble: {
      maxWidth: '85%',
      padding: 12,
      borderRadius: 16,
      marginBottom: 8,
    },
    userBubble: {
      alignSelf: 'flex-end',
      borderBottomRightRadius: 4,
    },
    assistantBubble: {
      alignSelf: 'flex-start',
      borderBottomLeftRadius: 4,
    },
    chatBubbleText: {
      fontSize: 14,
      lineHeight: 20,
    },
    toolCallsInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      gap: 4,
    },
    toolCallsText: {
      fontSize: 11,
    },
    thinkingText: {
      marginLeft: 8,
      fontSize: 13,
    },

    // Suggestions
    suggestionsContainer: {
      marginTop: 16,
      width: '100%',
      paddingHorizontal: 16,
    },
    suggestionChip: {
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
    },
    suggestionText: {
      fontSize: 13,
    },

    // Assistant Modal additions
    assistantSubtitle: {
      fontSize: 11,
      marginTop: 2,
    },
    assistantWelcomeTitle: {
      fontSize: 20,
      fontWeight: '700',
      marginTop: 12,
    },
  });
}
