/**
 * Dash Assistant Types & Constants
 *
 * Shared interfaces, return type, and constants for the useDashAssistant hook family.
 *
 * @module hooks/dash-assistant/types
 * @max-lines 200
 */

import type { DashMessage, DashConversation, DashAttachment } from '@/services/dash-ai/types';
import type { IDashAIAssistant } from '@/services/dash-ai/DashAICompat';
import type { AIModelId, AIModelInfo } from '@/lib/ai/models';
import type { AttachmentProgress } from '@/hooks/useDashAttachments';
import type { VoiceSession, VoiceProvider } from '@/lib/voice/unifiedProvider';
import type { TutorSession } from './tutorTypes';
import type { LearnerContext } from '@/lib/dash-ai/learnerContext';
import type { AlertState, DashAssistantState } from './state';
import type { AIQuotaFeature } from '@/lib/ai/limits';

// ---------------------------------------------------------------------------
// Hook options & return type
// ---------------------------------------------------------------------------
export interface UseDashAssistantOptions {
  conversationId?: string;
  initialMessage?: string;
  handoffSource?: string;
  onClose?: () => void;
}

export interface UseDashAssistantReturn {
  // State
  messages: DashMessage[];
  inputText: string;
  setInputText: (text: string) => void;
  isLoading: boolean;
  loadingStatus: 'uploading' | 'analyzing' | 'thinking' | 'responding' | null;
  streamingMessageId: string | null;
  streamingContent: string;
  isSpeaking: boolean;
  speakingMessageId: string | null;
  conversation: DashConversation | null;
  dashInstance: IDashAIAssistant | null;
  isInitialized: boolean;
  enterToSend: boolean;
  setEnterToSend: (value: boolean) => void;
  voiceEnabled: boolean;
  showTypingIndicator: boolean;
  autoSuggestQuestions: boolean;
  contextualHelp: boolean;
  selectedAttachments: DashAttachment[];
  isUploading: boolean;
  attachmentProgress: Map<string, AttachmentProgress>;
  isNearBottom: boolean;
  setIsNearBottom: (value: boolean) => void;
  unreadCount: number;
  setUnreadCount: (value: number | ((prev: number) => number)) => void;

  // Model selection
  availableModels: AIModelInfo[];
  selectedModel: AIModelId;
  setSelectedModel: (modelId: AIModelId) => void;

  // Voice input state
  isRecording: boolean;
  partialTranscript: string;

  // Alert state for premium modals
  alertState: AlertState;
  hideAlert: () => void;
  learnerContext: LearnerContext | null;
  tutorSession: TutorSession | null;

  // Refs
  flashListRef: React.RefObject<any>;
  inputRef: React.RefObject<any>;

  // Actions
  sendMessage: (text?: string) => Promise<void>;
  sendTutorAnswer: (answer: string, sourceMessageId?: string) => Promise<void>;
  speakResponse: (message: DashMessage) => Promise<void>;
  stopSpeaking: () => Promise<void>;
  scrollToBottom: (opts?: { animated?: boolean; delay?: number }) => void;
  handleAttachFile: () => Promise<void>;
  handlePickDocuments: () => Promise<void>;
  handlePickImages: () => Promise<void>;
  handleTakePhoto: () => Promise<void>;
  handleRemoveAttachment: (attachmentId: string) => Promise<void>;
  addAttachments: (attachments: DashAttachment[]) => void;
  handleInputMicPress: () => Promise<void>;
  stopVoiceRecording: () => Promise<void>;
  startNewConversation: () => Promise<void>;
  runTool: (toolName: string, params: Record<string, any>) => Promise<void>;

  // Helpers
  extractFollowUps: (text: string) => string[];
  wantsLessonGenerator: (t: string, assistantText?: string) => boolean;

  // Subscription info
  tier: string | undefined;
  subReady: boolean;
  refreshTier: () => void;
}

// ---------------------------------------------------------------------------
// Shared refs bag — passed between sub-hooks
// ---------------------------------------------------------------------------
export interface VoiceRefs {
  voiceSessionRef: React.MutableRefObject<VoiceSession | null>;
  voiceProviderRef: React.MutableRefObject<VoiceProvider | null>;
  voiceInputStartAtRef: React.MutableRefObject<number | null>;
  lastSpeakStartRef: React.MutableRefObject<number>;
  ttsSessionIdRef: React.MutableRefObject<string | null>;
}

export interface SharedRefs extends VoiceRefs {
  flashListRef: React.RefObject<any>;
  inputRef: React.RefObject<any>;
  scrollTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  requestQueueRef: React.MutableRefObject<Array<{ text: string; attachments: DashAttachment[] }>>;
  isProcessingRef: React.MutableRefObject<boolean>;
  prevLengthRef: React.MutableRefObject<number>;
  messagesLengthRef: React.MutableRefObject<number>;
  isSpeakingStateRef: React.MutableRefObject<boolean>;
  tutorSessionRef: React.MutableRefObject<TutorSession | null>;
  tutorOverridesRef: React.MutableRefObject<Record<string, string>>;
  learnerContextRef: React.MutableRefObject<LearnerContext | null>;
  messagesRef: React.MutableRefObject<DashMessage[]>;
  streamingMessageIdRef: React.MutableRefObject<string | null>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const DASH_AI_SERVICE_TYPE: AIQuotaFeature = 'homework_help';
export const LOCAL_SNAPSHOT_LIMIT = 200;
export const LOCAL_SNAPSHOT_MAX = 200;
