/**
 * Types for useSuperAdminAICommandCenter hook
 */

import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { ScrollView } from 'react-native';
import type { AlertButton } from '@/components/ui/AlertModal';
import type {
  AIAgent,
  AutonomousTask,
  AIInsight,
  Integration,
  ChatMessage,
} from '@/lib/screen-styles/super-admin-ai-command-center.styles';

export type ActiveTab = 'agents' | 'tasks' | 'insights' | 'integrations';

export type SetState<T> = Dispatch<SetStateAction<T>>;

export interface ShowAlertOptions {
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'success' | 'error';
  buttons?: AlertButton[];
}

export type ShowAlertFn = (opts: ShowAlertOptions) => void;

export interface UseSuperAdminAICommandCenterReturn {
  // Data
  refreshing: boolean;
  loading: boolean;
  agents: AIAgent[];
  tasks: AutonomousTask[];
  insights: AIInsight[];
  integrations: Integration[];
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;

  // Assistant
  assistantVisible: boolean;
  setAssistantVisible: (v: boolean) => void;
  assistantMessage: string;
  setAssistantMessage: (m: string) => void;
  chatHistory: ChatMessage[];
  assistantLoading: boolean;
  chatScrollRef: RefObject<ScrollView | null>;

  // Handlers
  onRefresh: () => Promise<void>;
  toggleAgent: (agentId: string) => Promise<void>;
  toggleTask: (taskId: string) => Promise<void>;
  runAgent: (agent: AIAgent) => void;
  handleInsightAction: (insight: AIInsight) => void;
  dismissInsight: (insightId: string) => Promise<void>;
  configureIntegration: (integration: Integration) => void;
  sendToAssistant: () => Promise<void>;

  // Auth
  profile: any;
}
