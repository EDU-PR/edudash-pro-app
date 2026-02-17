/**
 * DashAICompat
 *
 * Backward-compatibility layer to bridge existing imports that reference the old monolith
 * `DashAIAssistant` and `IDashAIAssistant` to the new modular architecture based on DashAICore.
 *
 * This file exposes:
 * - interface IDashAIAssistant (minimal surface used across codebase)
 * - class DashAIAssistant: thin facade delegating to DashAICore
 */

import DashAICore, { type DashAICoreConfig } from './DashAICore';
import type { TranscriptionResult } from './DashVoiceService';
import type {
  ConversationContextMessage,
  DashMessage,
  DashReminder,
  DashTask,
  DashConversation,
} from './types';
import { assertSupabase } from '@/lib/supabase';
import { getCurrentSession } from '@/lib/sessionManager';

type AgeGroup = 'child' | 'teen' | 'adult';

const LESSON_SUBJECT_PATTERNS: Array<{ key: RegExp; label: string }> = [
  { key: /math|mathematics|algebra|geometry|numbers/i, label: 'Mathematics' },
  { key: /science|physics|chemistry|biology/i, label: 'Science' },
  { key: /english|reading|writing|language|literature/i, label: 'English' },
  { key: /history|social\s+studies|geography/i, label: 'Social Sciences' },
  { key: /life\s+skills|life\s+orientation/i, label: 'Life Skills' },
  { key: /art|creative|drawing|painting/i, label: 'Arts' },
];

function extractLessonParamsFromContext(userInput: string, aiResponse: string) {
  const combined = `${userInput}\n${aiResponse}`.trim();
  const combinedLower = combined.toLowerCase();
  const params: Record<string, string> = {};

  const gradeMatch = combinedLower.match(/grade\s*(r|[0-9]{1,2})/i);
  if (gradeMatch) {
    const rawGrade = gradeMatch[1].toUpperCase();
    params.gradeLevel = rawGrade === 'R' ? '0' : rawGrade;
  } else {
    const ageMatch = combinedLower.match(/age\s*(\d{1,2})/i);
    if (ageMatch) {
      const age = Number(ageMatch[1]);
      if (!Number.isNaN(age)) {
        if (age <= 5) params.gradeLevel = '0';
        else params.gradeLevel = String(Math.max(age - 5, 1));
      }
    }
  }

  const subjectMatch = LESSON_SUBJECT_PATTERNS.find((entry) => entry.key.test(userInput))
    || LESSON_SUBJECT_PATTERNS.find((entry) => entry.key.test(combined));
  if (subjectMatch) params.subject = subjectMatch.label;

  const quoted = userInput.match(/"([^"]{3,})"/) || userInput.match(/'([^']{3,})'/);
  if (quoted?.[1]) {
    params.topic = quoted[1].trim();
  } else {
    const topicMatch = combined.match(/(?:topic|about|on|covering)\s+([a-z0-9][a-z0-9\s-]{2,60})/i);
    if (topicMatch?.[1]) {
      const cleaned = topicMatch[1].split(/[.,;\n]/)[0].trim();
      if (cleaned && !/grade|age|year|class/i.test(cleaned)) {
        params.topic = cleaned;
      }
    }
  }

  return params;
}

function computeAgeGroupFromDob(dob?: string | null): AgeGroup | undefined {
  if (!dob) return undefined;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  if (age <= 12) return 'child';
  if (age <= 17) return 'teen';
  return 'adult';
}

const TRANSIENT_PROFILE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

function isTransientProfileError(error: unknown): boolean {
  const status = Number((error as any)?.status || (error as any)?.code || 0);
  if (TRANSIENT_PROFILE_STATUS_CODES.has(status)) return true;
  const message = String((error as any)?.message || error || '').toLowerCase();
  return (
    message.includes('http_response_incomplete') ||
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('timeout')
  );
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchProfileRecord(
  supabaseClient: any,
  columns: string,
  userId: string,
): Promise<Record<string, any> | null> {
  const lookupFields = ['auth_user_id', 'id'] as const;
  for (const field of lookupFields) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select(columns)
        .eq(field, userId)
        .maybeSingle();

      if (data) return data;
      if (!error) break;

      if (!isTransientProfileError(error) || attempt === 1) {
        console.warn(`[DashAICompat] profile lookup failed on ${field}:`, error);
        break;
      }

      await wait(120 * (attempt + 1));
    }
  }

  return null;
}

// Re-export types for backward compatibility
export type {
  DashMessage,
  DashConversation,
  DashReminder,
  DashTask,
} from './types';

export interface IDashAIAssistant {
  initialize(config?: { supabaseClient?: any; currentUser?: any }): Promise<void>;
  dispose(): void;
  cleanup(): void;

  // Voice
  startRecording(): Promise<void>;
  stopRecording(): Promise<string>;
  isCurrentlyRecording(): boolean;
  transcribeAudio(audioUri: string, userId?: string): Promise<TranscriptionResult>;
  speakText(text: string): Promise<void>;
  stopSpeaking(): Promise<void>;

  // Conversations & Messages
  startNewConversation(title?: string): Promise<string>;
  getCurrentConversationId(): string | null;
  setCurrentConversationId(id: string): void;
  getConversation(conversationId: string): Promise<DashConversation | null>;
  getAllConversations(): Promise<DashConversation[]>;
  deleteConversation(conversationId: string): Promise<void>;
  addMessageToConversation(conversationId: string, message: DashMessage): Promise<void>;
  sendMessage(
    content: string,
    conversationId?: string,
    attachments?: any[],
    onStreamChunk?: (chunk: string) => void,
    options?: {
      contextOverride?: string | null;
      modelOverride?: string | null;
      messagesOverride?: ConversationContextMessage[];
      metadata?: Record<string, unknown>;
      signal?: AbortSignal;
    }
  ): Promise<DashMessage>;

  // Tasks & Reminders
  createTask(title: string, description: string, type?: DashTask['type'], assignedTo?: string): Promise<DashTask>;
  getActiveTasks(): DashTask[];
  createReminder(title: string, message: string, triggerAt: number, priority?: DashReminder['priority']): Promise<DashReminder>;
  getActiveReminders(): DashReminder[];

  // Navigation
  navigateToScreen(route: string, params?: Record<string, any>): Promise<{ success: boolean; screen?: string; error?: string }>;
  navigateByVoice(command: string): Promise<{ success: boolean; screen?: string; error?: string }>;
  openLessonGeneratorFromContext(userInput: string, aiResponse: string): void;

  // Preferences & Personality
  setLanguage(language: string): Promise<void>;
  getLanguage(): string | undefined;
  getPersonality(): any;
  savePersonality(partial: any): Promise<void>;
  updateUserContext(context: Record<string, any>): Promise<void>;
  exportConversation(conversationId: string): Promise<string>;

  // Voice response
  speakResponse(
    message: DashMessage,
    callbacks?: {
      onStart?: () => void;
      onDone?: () => void;
      onStopped?: () => void;
      onError?: (error: any) => void;
    }
  ): Promise<void>;

  // Convenience shim used in some legacy hooks/components
  sendPreparedVoiceMessage(input: { text?: string; audioUri?: string }): Promise<void>;

  // Screen context (for tools); optional for backward compatibility
  getCurrentScreenContext?: () => { screen: string; capabilities: string[]; suggestions: string[] };
}

export class DashAIAssistant implements IDashAIAssistant {
  private static instance: DashAIAssistant | null = null;
  private core: DashAICore;

  constructor(config: DashAICoreConfig) {
    this.core = new DashAICore(config);
    DashAICore.setInstance(this.core);
  }
  
  public static getInstance(): DashAIAssistant {
    if (!DashAIAssistant.instance) {
      // Create with default config - will be properly initialized later
      DashAIAssistant.instance = new DashAIAssistant({
        supabaseClient: null as any, // Will be set on initialize
      });
    }
    return DashAIAssistant.instance;
  }
  
  public static setInstance(instance: DashAIAssistant): void {
    DashAIAssistant.instance = instance;
  }

  async initialize(config?: { supabaseClient?: any; currentUser?: any }): Promise<void> {
    // Auto-get Supabase client and current user if not provided
    const initConfig = config || {};
    if (!initConfig.supabaseClient) {
      try {
        initConfig.supabaseClient = assertSupabase();
      } catch (e) {
        console.warn('[DashAICompat] Failed to get Supabase client');
      }
    }
    if (!initConfig.currentUser) {
      try {
        const session = await getCurrentSession();
        if (session) {
          // Fetch organization_id or preschool_id from profile for tenant isolation
          let organizationId: string | undefined;
          let preschoolId: string | undefined;
          try {
            const profile = await fetchProfileRecord(
              initConfig.supabaseClient,
              'organization_id, preschool_id',
              session.user_id,
            );
            // Use organization_id (standardized) or fallback to preschool_id
            organizationId = profile?.organization_id || profile?.preschool_id;
            preschoolId = profile?.organization_id || profile?.preschool_id;
          } catch (profileError) {
            console.warn('[DashAICompat] Failed to fetch organization_id/preschool_id from profile:', profileError);
          }

          // Fetch full profile to get correct role + age
          let userRole = 'student'; // Default to student for standalone users
          let ageGroup: AgeGroup | undefined;
          let dateOfBirth: string | undefined;
          try {
            const fullProfile = await fetchProfileRecord(
              initConfig.supabaseClient,
              'role, date_of_birth, age_group',
              session.user_id,
            );
            if (fullProfile?.role) {
              userRole = fullProfile.role;
            }
            if (fullProfile?.date_of_birth) {
              dateOfBirth = fullProfile.date_of_birth;
            }
            ageGroup = (fullProfile as any)?.age_group || computeAgeGroupFromDob(fullProfile?.date_of_birth);
          } catch (roleError) {
            console.warn('[DashAICompat] Failed to fetch role from profile, using default:', roleError);
          }

          initConfig.currentUser = {
            id: session.user_id,
            role: userRole, // Use actual role from profile, not default to teacher
            name: undefined, // Not available in session
            email: session.email,
            organizationId: organizationId || session.organization_id,
            preschoolId, // REQUIRED for tenant isolation (use organization_id if available)
            ageGroup,
            dateOfBirth,
          };
        }
      } catch (e) {
        console.warn('[DashAICompat] Failed to get current user session');
      }
    }
    return this.core.initialize(initConfig); 
  }
  dispose = (): void => {
    try {
      this.core?.dispose?.();
    } catch (error) {
      console.warn('[DashAICompat] dispose failed safely:', error);
    }
  };
  cleanup = (): void => { this.dispose(); }; // Alias for dispose

  // Voice - delegate to facade
  async startRecording(): Promise<void> { return this.core.voice.startRecording(); }
  async stopRecording(): Promise<string> { return this.core.voice.stopRecording(); }
  isCurrentlyRecording(): boolean { return this.core.voice.isCurrentlyRecording(); }
  async transcribeAudio(audioUri: string, userId?: string): Promise<TranscriptionResult> { return this.core.voice.transcribeAudio(audioUri, userId); }
  async speakText(text: string): Promise<void> { return this.core.voice.speakText(text); }
  async stopSpeaking(): Promise<void> { return this.core.voice.stopSpeaking(); }

  // Conversations - delegate to facade
  async startNewConversation(title?: string): Promise<string> { return this.core.conversation.startNewConversation(title); }
  getCurrentConversationId(): string | null { return this.core.conversation.getCurrentConversationId(); }
  setCurrentConversationId(id: string): void { return this.core.conversation.setCurrentConversationId(id); }
  async getConversation(conversationId: string): Promise<DashConversation | null> { return this.core.conversation.getConversation(conversationId); }
  async getAllConversations(): Promise<DashConversation[]> { return this.core.conversation.getAllConversations(); }
  async deleteConversation(conversationId: string): Promise<void> { return this.core.conversation.deleteConversation(conversationId); }
  async addMessageToConversation(conversationId: string, message: DashMessage): Promise<void> { return this.core.conversation.addMessageToConversation(conversationId, message); }
  
  async sendMessage(
    content: string, 
    conversationId?: string, 
    attachments?: any[],
    onStreamChunk?: (chunk: string) => void,
    options?: {
      contextOverride?: string | null;
      modelOverride?: string | null;
      messagesOverride?: ConversationContextMessage[];
      metadata?: Record<string, unknown>;
      signal?: AbortSignal;
    }
  ): Promise<DashMessage> {
    // Delegate to DashAICore which now handles AI calls
    return this.core.sendMessage(content, conversationId, attachments, onStreamChunk, options);
  }

  // Tasks & Reminders - delegate to facade
  async createTask(title: string, description: string, type?: DashTask['type'], assignedTo?: string): Promise<DashTask> {
    return this.core.tasks.createTask(title, description, type, assignedTo);
  }
  getActiveTasks(): DashTask[] { return this.core.tasks.getActiveTasks(); }
  async createReminder(title: string, message: string, triggerAt: number, priority?: DashReminder['priority']): Promise<DashReminder> {
    return this.core.tasks.createReminder(title, message, triggerAt, priority);
  }
  getActiveReminders(): DashReminder[] { return this.core.tasks.getActiveReminders(); }

  // Navigation - delegate to facade
  async navigateToScreen(route: string, params?: Record<string, any>) { return this.core.navigation.navigateToScreen(route, params); }
  async navigateByVoice(command: string) { return this.core.navigation.navigateByVoice(command); }
  openLessonGeneratorFromContext(userInput: string, aiResponse: string): void {
    const params = extractLessonParamsFromContext(userInput, aiResponse);
    this.core.navigation.openLessonGenerator(params);
  }

  // Preferences
  async setLanguage(language: string): Promise<void> { return this.core.setLanguage(language); }
  getLanguage(): string | undefined { return this.core.getLanguage(); }
  getPersonality(): any { return this.core.getPersonality(); }
  async savePersonality(partial: any): Promise<void> { return this.core.savePersonality(partial); }
  async updateUserContext(context: Record<string, any>): Promise<void> { return this.core.updateUserContext(context); }
  async exportConversation(conversationId: string): Promise<string> { return this.core.conversation.exportConversation(conversationId); }

  // Screen context (simple default for tools)
  getCurrentScreenContext(): { screen: string; capabilities: string[]; suggestions: string[] } {
    return {
      screen: 'dashboard',
      capabilities: [
        'navigate',
        'open_caps_documents',
        'compose_message',
        'export_pdf',
      ],
      suggestions: [
        'Create a lesson plan',
        'Generate a worksheet',
        'Check assignments',
        'Open CAPS documents',
      ],
    };
  }
  
  /**
   * Speak response (TTS wrapper)
   * @param message Message to speak (only assistant messages are spoken)
   * @param callbacks Optional callbacks for speech events
   */
  async speakResponse(
    message: DashMessage,
    callbacks?: {
      onStart?: () => void;
      onDone?: () => void;
      onStopped?: () => void;
      onError?: (error: any) => void;
    }
  ): Promise<void> {
    // Only speak assistant messages
    if (message.type !== 'assistant') {
      console.log('[DashAICompat] Ignoring non-assistant message for TTS');
      return;
    }
    
    // Extract text content
    const text = message.content;
    if (!text || text.trim().length === 0) {
      console.warn('[DashAICompat] No content to speak');
      callbacks?.onError?.('No content to speak');
      return;
    }
    
    // Language override if provided in metadata
    const langOverride = (message as any)?.metadata?.detected_language as string | undefined;
    
    // Delegate to core.voice speakText with callbacks and language override
    return this.core.voice.speakText(text, callbacks, langOverride ? { language: langOverride } : undefined);
  }

  // Convenience shim
  async sendPreparedVoiceMessage(input: { text?: string; audioUri?: string }): Promise<void> {
    if (input.audioUri) {
      const result = await this.core.voice.transcribeAudio(input.audioUri);
      if (result?.transcript) await this.core.voice.speakText(result.transcript);
      return;
    }
    if (input.text) {
      await this.core.voice.speakText(input.text);
      return;
    }
  }
}

export default DashAIAssistant;
