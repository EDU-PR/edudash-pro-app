/**
 * useSuperAdminAICommandCenter — orchestrator hook
 *
 * Composes fetch + handler modules into a single hook for the screen.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { ScrollView } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { toast } from '@/components/ui/ToastProvider';
import type {
  AIAgent,
  AutonomousTask,
  AIInsight,
  Integration,
  ChatMessage,
} from '@/lib/screen-styles/super-admin-ai-command-center.styles';
import type { ActiveTab, ShowAlertFn, UseSuperAdminAICommandCenterReturn } from './types';
import { fetchCommandCenterData } from './fetchData';
import * as handlers from './handlers';
import { sendAssistantMessage } from './sendToAssistant';

export type { UseSuperAdminAICommandCenterReturn } from './types';

export function useSuperAdminAICommandCenter(
  showAlert: ShowAlertFn,
): UseSuperAdminAICommandCenterReturn {
  const { profile, user } = useAuth();

  // ── State ───────────────────────────────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assistantVisible, setAssistantVisible] = useState(false);
  const [assistantMessage, setAssistantMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const chatScrollRef = useRef<ScrollView>(null);

  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [tasks, setTasks] = useState<AutonomousTask[]>([]);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('agents');

  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCommandCenterData();
      setAgents(data.agents);
      setTasks(data.tasks);
      setInsights(data.insights);
      setIntegrations(data.integrations);
    } catch (error) {
      logger.error('Failed to fetch AI command center data:', error);
      toast.error('Failed to load AI data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleToggleAgent = useCallback(
    (agentId: string) => handlers.toggleAgent(agentId, agents, setAgents),
    [agents],
  );

  const handleToggleTask = useCallback(
    (taskId: string) => handlers.toggleTask(taskId, tasks, setTasks),
    [tasks],
  );

  const handleRunAgent = useCallback(
    (agent: AIAgent) => handlers.runAgent(agent, setAgents, showAlert),
    [showAlert],
  );

  const handleDismissInsight = useCallback(
    (insightId: string) => handlers.dismissInsight(insightId, user?.id, setInsights),
    [user?.id],
  );

  const handleConfigureIntegration = useCallback(
    (integration: Integration) => handlers.configureIntegration(integration, showAlert),
    [showAlert],
  );

  const handleSendToAssistant = useCallback(async () => {
    await sendAssistantMessage({
      message: assistantMessage,
      chatHistory,
      setChatHistory,
      setAssistantMessage,
      setAssistantLoading,
      chatScrollRef,
    });
  }, [assistantMessage, chatHistory]);

  // ── Return ──────────────────────────────────────────────────────────────────
  return {
    refreshing, loading,
    agents, tasks, insights, integrations,
    activeTab, setActiveTab,
    assistantVisible, setAssistantVisible,
    assistantMessage, setAssistantMessage,
    chatHistory, assistantLoading, chatScrollRef,
    onRefresh,
    toggleAgent: handleToggleAgent,
    toggleTask: handleToggleTask,
    runAgent: handleRunAgent,
    handleInsightAction: handlers.handleInsightAction,
    dismissInsight: handleDismissInsight,
    configureIntegration: handleConfigureIntegration,
    sendToAssistant: handleSendToAssistant,
    profile,
  };
}
