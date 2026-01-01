/**
 * DashAICore (Refactored with Facades)
 * 
 * Slim orchestrator for Dash AI Assistant using facade pattern.
 * All domain-specific operations delegated to facades.
 * 
 * Architecture:
 * DashAICore → Facades → Services
 */

import { DashVoiceService, type VoiceRecordingConfig } from './DashVoiceService';
import { DashMemoryService, type MemoryServiceConfig } from './DashMemoryService';
import { DashConversationManager, type ConversationManagerConfig } from './DashConversationManager';
import { DashTaskManager, type TaskManagerConfig } from './DashTaskManager';
import { DashAINavigator, type NavigatorConfig } from './DashAINavigator';
import { DashUserProfileManager, type UserProfileManagerConfig } from './DashUserProfileManager';
import { DashAIClient } from './DashAIClient';
import { DashPromptBuilder } from './DashPromptBuilder';

// Import facades
import {
  DashAIVoiceFacade,
  DashAIMemoryFacade,
  DashAIConversationFacade,
  DashAITaskFacade,
  DashAINavigationFacade,
} from './facades';

import type { DashMessage, DashPersonality } from './types';

/**
 * Default personality configuration
 */
const DEFAULT_PERSONALITY: DashPersonality = {
  name: 'Dash',
  greeting: "Hi! I'm Dash, your AI teaching assistant. How can I help you today?",
  personality_traits: ['helpful', 'encouraging', 'knowledgeable', 'patient', 'creative'],
  response_style: 'adaptive',
  expertise_areas: ['education', 'lesson planning', 'student assessment'],
  voice_settings: { rate: 0.8, pitch: 1.0, language: 'en-ZA' },
  role_specializations: {
    teacher: {
      greeting: "Hello! I'm Dash, your teaching assistant.",
      capabilities: ['lesson_planning', 'grading_assistance'],
      tone: 'encouraging and professional',
      proactive_behaviors: ['suggest_lesson_improvements'],
      task_categories: ['academic', 'administrative'],
    },
    principal: {
      greeting: "Good day! I'm Dash, here to help you lead your school.",
      capabilities: ['staff_management', 'budget_analysis'],
      tone: 'professional and strategic',
      proactive_behaviors: ['monitor_school_metrics'],
      task_categories: ['administrative', 'strategic'],
    },
    parent: {
      greeting: "Hi! I'm Dash, your family's education assistant.",
      capabilities: ['homework_assistance', 'progress_tracking'],
      tone: 'friendly and supportive',
      proactive_behaviors: ['remind_homework_deadlines'],
      task_categories: ['academic_support', 'communication'],
    },
    student: {
      greeting: "Hey! I'm Dash, your study buddy.",
      capabilities: ['homework_help', 'study_techniques'],
      tone: 'friendly and encouraging',
      proactive_behaviors: ['remind_study_sessions'],
      task_categories: ['academic', 'personal'],
    },
  },
  agentic_settings: {
    autonomy_level: 'medium',
    can_create_tasks: true,
    can_schedule_actions: true,
    can_access_data: true,
    can_send_notifications: false,
    requires_confirmation_for: ['send_external_emails', 'modify_grades'],
  },
};

export interface DashAICoreConfig {
  supabaseClient: any;
  currentUser?: {
    id: string;
    role: string;
    name?: string;
    email?: string;
    organizationId?: string;
    preschoolId?: string;
  };
  personality?: Partial<DashPersonality>;
}

/**
 * DashAICore - Slim orchestrator using facades
 */
export class DashAICore {
  private static instance: DashAICore | null = null;

  // Facades (public API)
  public voice!: DashAIVoiceFacade;
  public memory!: DashAIMemoryFacade;
  public conversation!: DashAIConversationFacade;
  public tasks!: DashAITaskFacade;
  public navigation!: DashAINavigationFacade;

  // Internal services
  private voiceService!: DashVoiceService;
  private memoryService!: DashMemoryService;
  private conversationManager!: DashConversationManager;
  private taskManager!: DashTaskManager;
  private navigator!: DashAINavigator;
  private profileManager!: DashUserProfileManager;
  private aiClient!: DashAIClient;
  private promptBuilder!: DashPromptBuilder;

  // Configuration
  private personality: DashPersonality;
  private supabaseClient: any;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(config: DashAICoreConfig) {
    this.supabaseClient = config.supabaseClient;
    this.personality = { ...DEFAULT_PERSONALITY, ...config.personality };
  }

  private initializeServices(config?: { supabaseClient?: any; currentUser?: any }) {
    if (config?.supabaseClient) {
      this.supabaseClient = config.supabaseClient;
    }

    // Initialize core services
    this.voiceService = new DashVoiceService({
      voiceSettings: this.personality.voice_settings,
      supabaseClient: this.supabaseClient,
    });

    this.memoryService = new DashMemoryService({
      supabaseClient: this.supabaseClient,
      userId: config?.currentUser?.id,
      organizationId: config?.currentUser?.organizationId,
    });

    // Only initialize conversation manager if we have valid userId and organizationId/preschoolId
    const userId = config?.currentUser?.id;
    const organizationId = config?.currentUser?.organizationId || config?.currentUser?.preschoolId;
    
    if (!userId || !organizationId) {
      // Standalone users (no organization) are allowed; avoid noisy warnings.
      if (__DEV__) {
        console.log('[DashAICore] Skipping conversation manager init (standalone user):', {
          hasUserId: !!userId,
          hasOrganizationId: !!organizationId,
        });
      }
      // Create a dummy conversation manager that will fail gracefully
      // Users without organizations can still use other Dash features
      this.conversationManager = null as any;
    } else {
      this.conversationManager = new DashConversationManager({
        userId,
        preschoolId: organizationId,
      });
    }

    this.taskManager = new DashTaskManager({ userId: config?.currentUser?.id });
    this.navigator = new DashAINavigator({});
    this.profileManager = new DashUserProfileManager({ currentUser: config?.currentUser });

    this.aiClient = new DashAIClient({
      supabaseClient: this.supabaseClient,
      getUserProfile: () => this.profileManager.getUserProfile(),
    });

    // Create a mapper function to convert DashUserProfile to the simpler UserProfile format
    // used by DashPromptBuilder (which needs organization_type, age_group, etc. at top level)
    const mapProfileForPromptBuilder = () => {
      const dashProfile = this.profileManager.getUserProfile();
      if (!dashProfile) return undefined;
      
      return {
        role: dashProfile.role,
        full_name: dashProfile.name,
        display_name: dashProfile.name,
        grade_level: dashProfile.context?.grade_levels?.[0],
        preferred_language: dashProfile.context?.preferred_language,
        subscription_tier: dashProfile.preferences?.ai_autonomy_level, // Map to subscription context
        organization_name: dashProfile.context?.organization_id, // Will be resolved by caller
        organization_type: dashProfile.context?.organization_type,
        age_group: dashProfile.context?.age_group,
      };
    };

    this.promptBuilder = new DashPromptBuilder({
      personality: this.personality,
      getUserProfile: mapProfileForPromptBuilder,
    });

    // Initialize facades
    this.voice = new DashAIVoiceFacade(this.voiceService);
    this.memory = new DashAIMemoryFacade(this.memoryService);
    // Create conversation facade - it will handle null manager gracefully
    this.conversation = new DashAIConversationFacade(this.conversationManager);
    this.tasks = new DashAITaskFacade(this.taskManager);
    this.navigation = new DashAINavigationFacade(this.navigator);
  }

  public static getInstance(): DashAICore | null {
    return DashAICore.instance;
  }

  public static setInstance(instance: DashAICore): void {
    DashAICore.instance = instance;
  }

  public async initialize(config?: { supabaseClient?: any; currentUser?: any }): Promise<void> {
    // If already initialized and no new config provided, return existing promise or resolve immediately
    if (this.isInitialized && !config) {
      if (this.initializationPromise) {
        return this.initializationPromise;
      }
      return Promise.resolve();
    }

    // If initialization is in progress, return the existing promise
    if (this.initializationPromise && !config) {
      return this.initializationPromise;
    }

    // Start new initialization
    this.initializationPromise = this._doInitialize(config);
    return this.initializationPromise;
  }

  private async _doInitialize(config?: { supabaseClient?: any; currentUser?: any }): Promise<void> {
    console.log('[DashAICore] Initializing...');

    try {
      // Re-initialize services if config provided (user change, etc.)
      if (!this.voiceService || config) {
        this.initializeServices(config);
        this.isInitialized = false; // Reset flag if re-initializing
      }

      // Skip if already initialized without new config
      if (this.isInitialized && !config) {
        console.log('[DashAICore] Already initialized, skipping...');
        return;
      }

      await Promise.all([
        this.voiceService.initializeAudio(),
        this.memoryService.initialize(),
        this.conversationManager?.initialize().catch(err => {
          console.warn('[DashAICore] Conversation manager initialization failed (user may not have organization):', err);
        }),
        this.taskManager.initialize(),
        this.profileManager.initialize(),
      ]);

      this.isInitialized = true;
      console.log('[DashAICore] Initialization complete');
    } catch (error) {
      this.isInitialized = false;
      this.initializationPromise = null;
      console.error('[DashAICore] Initialization failed:', error);
      throw error;
    }
  }

  // ==================== PROFILE & SETTINGS ====================

  public getUserProfile() {
    return this.profileManager.getUserProfile();
  }

  public async updateUserPreferences(preferences: Partial<any>): Promise<void> {
    return this.profileManager.updatePreferences(preferences);
  }

  public async setLanguage(language: string): Promise<void> {
    await this.profileManager.setLanguage(language);
    this.voiceService.updateConfig({
      voiceSettings: { ...this.personality.voice_settings, language },
      supabaseClient: this.supabaseClient,
    });
  }

  public getLanguage(): string | undefined {
    return this.profileManager.getLanguage();
  }

  public getPersonality(): DashPersonality {
    return this.personality;
  }

  public updatePersonality(personality: Partial<DashPersonality>): void {
    this.personality = { ...this.personality, ...personality };

    if (personality.voice_settings) {
      this.voiceService.updateConfig({
        voiceSettings: this.personality.voice_settings,
        supabaseClient: this.supabaseClient,
      });
    }

    if (this.promptBuilder) {
      this.promptBuilder.updatePersonality(this.personality);
    }
  }

  public async savePersonality(personality: Partial<DashPersonality>): Promise<void> {
    this.updatePersonality(personality);
  }

  public getPersonalizedGreeting(): string {
    return this.profileManager.getPersonalizedGreeting(this.personality);
  }

  // ==================== AI INTEGRATION ====================

  public async sendMessage(
    content: string,
    conversationId?: string,
    attachments?: any[],
    onStreamChunk?: (chunk: string) => void
  ): Promise<DashMessage> {
    let convId = conversationId || this.conversation.getCurrentConversationId();
    if (!convId) {
      // Auto-create conversation if none exists (for users without organizations, creates temp conversation)
      convId = await this.conversation.startNewConversation();
      this.conversation.setCurrentConversationId(convId);
    }

    const userMessage: DashMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'user',
      content,
      timestamp: Date.now(),
      attachments,
    };

    await this.conversation.addMessageToConversation(convId, userMessage);

    const assistantMessage = await this.generateAIResponse(
      content,
      convId,
      attachments,
      onStreamChunk
    );

    await this.conversation.addMessageToConversation(convId, assistantMessage);

    return assistantMessage;
  }

  private async generateAIResponse(
    userInput: string,
    conversationId: string,
    attachments?: any[],
    onStreamChunk?: (chunk: string) => void
  ): Promise<DashMessage> {
    try {
      const conversation = await this.conversation.getConversation(conversationId);
      const recentMessages = conversation?.messages?.slice(-5) || [];

      // Check if strict language mode is enabled in personality settings
      const personality = this.profileManager.getPersonality();
      const strictLanguageMode = personality?.strict_language_mode === true;
      const langDirective = this.promptBuilder.buildLanguageDirective(strictLanguageMode);
      const shouldStream = typeof onStreamChunk === 'function';

      const response = await this.aiClient.callAIService({
        action: 'general_assistance',
        messages: this.promptBuilder.buildMessageHistory(recentMessages, userInput),
        context: `User role: ${this.getUserProfile()?.role || 'educator'}\n${langDirective}`,
        attachments,
        stream: shouldStream,
        onChunk: onStreamChunk,
      });

      return {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'assistant',
        content: response.content || 'I apologize, but I encountered an issue processing your request.',
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('[DashAICore] Failed to generate response:', error);
      return {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'assistant',
        content: "I'm sorry, I'm having trouble processing that right now. Could you please try again?",
        timestamp: Date.now(),
      };
    }
  }

  // ==================== LIFECYCLE ====================

  public dispose(): void {
    console.log('[DashAICore] Disposing...');
    this.voice.dispose();
    this.memory.dispose();
    this.conversation.dispose();
    this.tasks.dispose();
    this.profileManager.dispose();
    console.log('[DashAICore] Disposal complete');
  }
}

export default DashAICore;
