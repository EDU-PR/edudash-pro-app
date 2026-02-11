/**
 * Dash Assistant State Reducer
 *
 * Replaces 29 individual useState calls with a single useReducer.
 * Every UI update goes through a single dispatch → ONE re-render per action batch.
 *
 * @module hooks/dash-assistant/state
 * @max-lines 200
 */

import type { DashMessage, DashConversation } from '@/services/dash-ai/types';
import type { IDashAIAssistant } from '@/services/dash-ai/DashAICompat';
import type { TutorSession } from './tutorTypes';
import type { LearnerContext } from '@/lib/dash-ai/learnerContext';
import type { AIModelId } from '@/lib/ai/models';

// ---------------------------------------------------------------------------
// Chat preferences — previously 7 separate useState calls
// ---------------------------------------------------------------------------
export interface ChatPrefs {
  enterToSend: boolean;
  voiceEnabled: boolean;
  autoSpeakResponses: boolean;
  showTypingIndicator: boolean;
  autoSuggestQuestions: boolean;
  contextualHelp: boolean;
  streamingEnabledPref: boolean;
}

export const DEFAULT_CHAT_PREFS: ChatPrefs = {
  enterToSend: true,
  voiceEnabled: true,
  autoSpeakResponses: true,
  showTypingIndicator: true,
  autoSuggestQuestions: true,
  contextualHelp: true,
  streamingEnabledPref: false,
};

// ---------------------------------------------------------------------------
// Alert state
// ---------------------------------------------------------------------------
export interface AlertState {
  visible: boolean;
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'success' | 'error';
  icon?: string;
  buttons?: Array<{
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }>;
}

const INITIAL_ALERT: AlertState = { visible: false, title: '', message: '' };

// ---------------------------------------------------------------------------
// Loading status
// ---------------------------------------------------------------------------
export type LoadingStatus = 'uploading' | 'analyzing' | 'thinking' | 'responding' | null;

// ---------------------------------------------------------------------------
// Root state
// ---------------------------------------------------------------------------
export interface DashAssistantState {
  messages: DashMessage[];
  inputText: string;
  isLoading: boolean;
  loadingStatus: LoadingStatus;
  statusStartTime: number;
  streamingMessageId: string | null;
  streamingContent: string;
  conversation: DashConversation | null;
  dashInstance: IDashAIAssistant | null;
  isInitialized: boolean;
  isSpeaking: boolean;
  speakingMessageId: string | null;
  isRecording: boolean;
  partialTranscript: string;
  isNearBottom: boolean;
  unreadCount: number;
  tutorSession: TutorSession | null;
  modelPrefLoaded: boolean;
  activeChildId: string | null;
  learnerContext: LearnerContext | null;
  voiceBudgetRemainingMs: number | null;
  alertState: AlertState;
  chatPrefs: ChatPrefs;
}

export const INITIAL_STATE: DashAssistantState = {
  messages: [],
  inputText: '',
  isLoading: false,
  loadingStatus: null,
  statusStartTime: 0,
  streamingMessageId: null,
  streamingContent: '',
  conversation: null,
  dashInstance: null,
  isInitialized: false,
  isSpeaking: false,
  speakingMessageId: null,
  isRecording: false,
  partialTranscript: '',
  isNearBottom: true,
  unreadCount: 0,
  tutorSession: null,
  modelPrefLoaded: false,
  activeChildId: null,
  learnerContext: null,
  voiceBudgetRemainingMs: null,
  alertState: INITIAL_ALERT,
  chatPrefs: DEFAULT_CHAT_PREFS,
};

// ---------------------------------------------------------------------------
// Actions — discriminated union for type safety
// ---------------------------------------------------------------------------
export type DashAction =
  | { type: 'SET_MESSAGES'; messages: DashMessage[] }
  | { type: 'APPEND_MESSAGE'; message: DashMessage }
  | { type: 'UPDATE_MESSAGE'; id: string; patch: Partial<DashMessage> }
  | { type: 'REMOVE_MESSAGE'; id: string }
  | { type: 'SET_INPUT'; text: string }
  | { type: 'SET_LOADING'; isLoading: boolean; status?: LoadingStatus }
  | { type: 'SET_STREAMING'; messageId: string | null; content?: string }
  | { type: 'APPEND_STREAM_CHUNK'; chunk: string }
  | { type: 'SET_CONVERSATION'; conversation: DashConversation | null }
  | { type: 'SET_INSTANCE'; instance?: IDashAIAssistant | null; initialized?: boolean }
  | { type: 'SET_SPEAKING'; isSpeaking: boolean; messageId?: string | null }
  | { type: 'SET_RECORDING'; isRecording: boolean; transcript?: string }
  | { type: 'SET_NEAR_BOTTOM'; value: boolean }
  | { type: 'SET_UNREAD'; count: number }
  | { type: 'SET_TUTOR_SESSION'; session: TutorSession | null }
  | { type: 'SET_LEARNER_CONTEXT'; context: LearnerContext | null }
  | { type: 'SET_CHAT_PREFS'; prefs: Partial<ChatPrefs> }
  | { type: 'SET_ALERT'; alert: AlertState }
  | { type: 'HIDE_ALERT' }
  | { type: 'SET_VOICE_BUDGET'; ms: number | null }
  | { type: 'SET_ACTIVE_CHILD'; id: string | null }
  | { type: 'SET_MODEL_PREF_LOADED'; loaded: boolean }
  | { type: 'BATCH'; actions: DashAction[] }
  | { type: 'RESET' };

// ---------------------------------------------------------------------------
// Reducer — pure function, no side effects
// ---------------------------------------------------------------------------
export function dashReducer(state: DashAssistantState, action: DashAction): DashAssistantState {
  switch (action.type) {
    case 'SET_MESSAGES':
      return { ...state, messages: action.messages };
    case 'APPEND_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] };
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map(m =>
          m.id === action.id ? { ...m, ...action.patch } : m,
        ),
      };
    case 'REMOVE_MESSAGE':
      return { ...state, messages: state.messages.filter(m => m.id !== action.id) };
    case 'SET_INPUT':
      return { ...state, inputText: action.text };
    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading, loadingStatus: action.status ?? null, statusStartTime: action.isLoading ? Date.now() : 0 };
    case 'SET_STREAMING':
      return { ...state, streamingMessageId: action.messageId, streamingContent: action.content ?? '' };
    case 'APPEND_STREAM_CHUNK': {
      const newContent = state.streamingContent + action.chunk;
      return {
        ...state,
        streamingContent: newContent,
        messages: state.streamingMessageId
          ? state.messages.map(m => m.id === state.streamingMessageId ? { ...m, content: newContent } : m)
          : state.messages,
      };
    }
    case 'SET_CONVERSATION':
      return { ...state, conversation: action.conversation };
    case 'SET_INSTANCE':
      return {
        ...state,
        dashInstance: action.instance !== undefined ? action.instance : state.dashInstance,
        isInitialized: action.initialized ?? state.isInitialized,
      };
    case 'SET_SPEAKING':
      return { ...state, isSpeaking: action.isSpeaking, speakingMessageId: action.messageId ?? null };
    case 'SET_RECORDING':
      return { ...state, isRecording: action.isRecording, partialTranscript: action.transcript ?? '' };
    case 'SET_NEAR_BOTTOM':
      return { ...state, isNearBottom: action.value };
    case 'SET_UNREAD':
      return { ...state, unreadCount: action.count };
    case 'SET_TUTOR_SESSION':
      return { ...state, tutorSession: action.session };
    case 'SET_LEARNER_CONTEXT':
      return { ...state, learnerContext: action.context };
    case 'SET_CHAT_PREFS':
      return { ...state, chatPrefs: { ...state.chatPrefs, ...action.prefs } };
    case 'SET_ALERT':
      return { ...state, alertState: action.alert };
    case 'HIDE_ALERT':
      return { ...state, alertState: INITIAL_ALERT };
    case 'SET_VOICE_BUDGET':
      return { ...state, voiceBudgetRemainingMs: action.ms };
    case 'SET_ACTIVE_CHILD':
      return { ...state, activeChildId: action.id };
    case 'SET_MODEL_PREF_LOADED':
      return { ...state, modelPrefLoaded: action.loaded };
    case 'BATCH':
      return action.actions.reduce(dashReducer, state);
    case 'RESET':
      return { ...INITIAL_STATE };
    default:
      return state;
  }
}
