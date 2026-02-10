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
import { fetchParentChildren } from '@/lib/parent-children';
import { detectOCRTask, getOCRPromptForTask, isOCRIntent } from '@/lib/dash-ai/ocrPrompts';

// Import facades
import {
  DashAIVoiceFacade,
  DashAIMemoryFacade,
  DashAIConversationFacade,
  DashAITaskFacade,
  DashAINavigationFacade,
} from './facades';

import type { DashAttachment, DashMessage, DashPersonality, DashUserProfile } from './types';

/**
 * Default personality configuration
 */
const DEFAULT_PERSONALITY: DashPersonality = {
  name: 'Dash',
  greeting: "Hi! I'm Dash, your AI teaching assistant. How can I help you today?",
  personality_traits: ['helpful', 'encouraging', 'knowledgeable', 'patient', 'creative'],
  response_style: 'adaptive',
  expertise_areas: ['education', 'lesson planning', 'student assessment'],
  voice_settings: { rate: 1.0, pitch: 1.0, language: 'en-ZA' },
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

type AgeGroup = 'child' | 'teen' | 'adult';

const MAX_CONTEXT_MESSAGES = 20;

function inferAgeGroupFromGrade(gradeLevel?: string): AgeGroup | undefined {
  if (!gradeLevel) return undefined;
  const normalized = gradeLevel.trim().toUpperCase();
  if (normalized.includes('R')) {
    return 'child';
  }
  const match = normalized.match(/\d+/);
  if (!match) return undefined;
  const gradeNum = Number(match[0]);
  if (Number.isNaN(gradeNum)) return undefined;
  if (gradeNum <= 7) return 'child';
  if (gradeNum <= 12) return 'teen';
  return 'adult';
}

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
  private parentChildrenCache: { fetchedAt: number; children: Array<{ id: string; name: string; grade_level?: string; age_group?: 'child' | 'teen' | 'adult' }> } | null = null;
  private parentChildrenInFlight: Promise<Array<{ id: string; name: string; grade_level?: string; age_group?: 'child' | 'teen' | 'adult' }>> | null = null;
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
      const gradeLevel = dashProfile.context?.grade_levels?.[0];
      const inferredAgeGroup = inferAgeGroupFromGrade(gradeLevel);
      const resolvedAgeGroup = dashProfile.context?.age_group || inferredAgeGroup;
      const children = this.parentChildrenCache?.children || [];

      return {
        role: dashProfile.role,
        full_name: dashProfile.name,
        display_name: dashProfile.name,
        grade_level: gradeLevel,
        preferred_language: dashProfile.context?.preferred_language,
        subscription_tier: dashProfile.preferences?.ai_autonomy_level, // Map to subscription context
        organization_name: dashProfile.context?.organization_id, // Will be resolved by caller
        organization_type: dashProfile.context?.organization_type,
        age_group: resolvedAgeGroup,
        children: children.map(child => ({
          name: child.name,
          grade_level: child.grade_level,
          age_group: child.age_group,
        })),
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
    this.conversation = new DashAIConversationFacade(this.conversationManager, config?.currentUser?.id);
    this.tasks = new DashAITaskFacade(this.taskManager);
    this.navigation = new DashAINavigationFacade(this.navigator);
  }

  public static getInstance(): DashAICore | null {
    return DashAICore.instance;
  }

  public static setInstance(instance: DashAICore): void {
    DashAICore.instance = instance;
  }

  private lastInitUserId: string | null = null;

  public async initialize(config?: { supabaseClient?: any; currentUser?: any }): Promise<void> {
    // Determine if config represents a meaningful change (different user).
    // DashAICompat always passes config, so we must check content, not just presence.
    const incomingUserId = config?.currentUser?.id ?? null;
    const isNewUser = incomingUserId && incomingUserId !== this.lastInitUserId;

    // If already initialized and the user hasn't changed, skip re-init
    if (this.isInitialized && !isNewUser) {
      if (this.initializationPromise) {
        return this.initializationPromise;
      }
      return Promise.resolve();
    }

    // If initialization is in progress for the same user, return the existing promise
    if (this.initializationPromise && !isNewUser) {
      return this.initializationPromise;
    }

    // Track which user we're initializing for
    if (incomingUserId) {
      this.lastInitUserId = incomingUserId;
    }

    // Start new initialization
    this.initializationPromise = this._doInitialize(config);
    return this.initializationPromise;
  }

  private async _doInitialize(config?: { supabaseClient?: any; currentUser?: any }): Promise<void> {
    console.log('[DashAICore] Initializing...');

    try {
      // Only re-create services if they don't exist yet.
      // The guard in initialize() already ensures we only reach here
      // when there's a genuine need (first init or user change).
      if (!this.voiceService) {
        this.initializeServices(config);
      } else if (config?.currentUser) {
        // User change: update config references but DON'T re-init audio
        // (audio mode is user-independent)
        this.initializeServices(config);
      }

      // Skip if already initialized (shouldn't happen due to guard, but safety net)
      if (this.isInitialized) {
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

      // Hydrate personality from stored user preferences (if any)
      this.hydratePersonalityFromProfile();

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

  private async hydrateParentChildren(force: boolean = false): Promise<Array<{ id: string; name: string; grade_level?: string; age_group?: 'child' | 'teen' | 'adult' }>> {
    const profile = this.getUserProfile();
    if (!profile || profile.role !== 'parent') {
      return [];
    }

    const now = Date.now();
    if (!force && this.parentChildrenCache && now - this.parentChildrenCache.fetchedAt < 5 * 60 * 1000) {
      return this.parentChildrenCache.children;
    }

    if (this.parentChildrenInFlight) {
      return this.parentChildrenInFlight;
    }

    this.parentChildrenInFlight = (async () => {
      try {
        const schoolId = profile.context?.organization_id;
        const children = await fetchParentChildren(profile.userId, {
          includeInactive: false,
          schoolId,
        });

        const normalized = (children || []).map((child: any) => {
          const classData = Array.isArray(child.classes) ? child.classes[0] : child.classes;
          const gradeLevel = child.grade_level || child.grade || classData?.grade_level || undefined;
          return {
            id: child.id,
            name: `${child.first_name} ${child.last_name}`.trim(),
            grade_level: gradeLevel,
            age_group: inferAgeGroupFromGrade(gradeLevel),
          };
        }).filter((c: any) => c.id);

        this.parentChildrenCache = { fetchedAt: Date.now(), children: normalized };
        return normalized;
      } catch (error) {
        console.warn('[DashAICore] Failed to load parent children:', error);
        return [];
      } finally {
        this.parentChildrenInFlight = null;
      }
    })();

    return this.parentChildrenInFlight;
  }

  private async buildParentChildrenContext(): Promise<string | null> {
    const children = await this.hydrateParentChildren();
    if (!children || children.length === 0) return null;
    const list = children
      .map(child => child.grade_level ? `${child.name} (Grade ${child.grade_level})` : child.name)
      .join(', ');
    return `Children: ${list}`;
  }

  private detectLanguageOverride(userInput: string): 'af-ZA' | null {
    const input = String(userInput || '').toLowerCase();
    if (input.includes('afrikaans') || input.includes('afrikaans:') || input.includes('in afrikaans')) {
      return 'af-ZA';
    }
    return null;
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

  public async updateUserContext(
    context: Partial<DashUserProfile['context']> & Record<string, any>
  ): Promise<void> {
    await this.profileManager.updateContext(context);
  }

  public getLanguage(): string | undefined {
    return this.profileManager.getLanguage();
  }

  public getPersonality(): DashPersonality {
    return this.personality;
  }

  private hydratePersonalityFromProfile(): void {
    const profile = this.profileManager.getUserProfile();
    const prefs = (profile?.preferences as any) || {};
    const overrides: Partial<DashPersonality> = {};

    if (prefs.response_style) overrides.response_style = prefs.response_style;
    if (prefs.personality_traits) overrides.personality_traits = prefs.personality_traits;
    if (prefs.voice_settings) {
      overrides.voice_settings = { ...this.personality.voice_settings, ...prefs.voice_settings };
    }
    if (prefs.response_language) overrides.response_language = prefs.response_language;
    if (typeof prefs.strict_language_mode === 'boolean') {
      overrides.strict_language_mode = prefs.strict_language_mode;
    }

    if (Object.keys(overrides).length > 0) {
      this.updatePersonality(overrides);
    }
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
    try {
      const prefsUpdate: Record<string, any> = {};
      if (personality.response_style) prefsUpdate.response_style = personality.response_style;
      if (personality.personality_traits) prefsUpdate.personality_traits = personality.personality_traits;
      if (personality.voice_settings) prefsUpdate.voice_settings = personality.voice_settings;
      if (personality.response_language) prefsUpdate.response_language = personality.response_language;
      if (typeof personality.strict_language_mode === 'boolean') {
        prefsUpdate.strict_language_mode = personality.strict_language_mode;
      }
      if (Object.keys(prefsUpdate).length > 0) {
        await this.profileManager.updatePreferences(prefsUpdate);
      }
    } catch (error) {
      console.warn('[DashAICore] Failed to persist personality preferences:', error);
    }
  }

  public getPersonalizedGreeting(): string {
    return this.profileManager.getPersonalizedGreeting(this.personality);
  }

  // ==================== AI INTEGRATION ====================

  private sanitizeAttachmentsForStorage(attachments?: any[]) {
    if (!Array.isArray(attachments)) return attachments;
    return attachments.map((att) => {
      if (!att || typeof att !== 'object') return att;
      const meta = (att as any).meta;
      if (!meta || typeof meta !== 'object') return att;
      const { image_base64, image_media_type, ...rest } = meta as Record<string, unknown>;
      const cleanedMeta = Object.keys(rest).length > 0 ? rest : undefined;
      return { ...att, meta: cleanedMeta };
    });
  }

  private mapGeneratedImagesToAttachments(
    generatedImages?: Array<{
      id: string;
      bucket: string;
      path: string;
      signed_url: string;
      mime_type: string;
      prompt: string;
      width: number;
      height: number;
      provider: string;
      model: string;
      expires_at: string;
    }>,
  ): DashAttachment[] | undefined {
    if (!Array.isArray(generatedImages) || generatedImages.length === 0) {
      return undefined;
    }

    return generatedImages.map((image): DashAttachment => ({
      id: `generated_${image.id}`,
      name: `Dash Image ${image.width}x${image.height}`,
      mimeType: image.mime_type || 'image/png',
      size: 0,
      bucket: image.bucket,
      storagePath: image.path,
      kind: 'image',
      status: 'ready',
      previewUri: image.signed_url,
      meta: {
        source: 'dash_image_generation',
        prompt: image.prompt,
        model: image.model,
        provider: image.provider,
        expires_at: image.expires_at,
      },
    }));
  }

  public async sendMessage(
    content: string,
    conversationId?: string,
    attachments?: any[],
    onStreamChunk?: (chunk: string) => void,
    options?: { contextOverride?: string | null; modelOverride?: string | null }
  ): Promise<DashMessage> {
    let convId = conversationId || this.conversation.getCurrentConversationId();
    if (!convId) {
      // Auto-create conversation if none exists (for users without organizations, creates temp conversation)
      convId = await this.conversation.startNewConversation();
      this.conversation.setCurrentConversationId(convId);
    }

    const storedAttachments = this.sanitizeAttachmentsForStorage(attachments);
    const userMessage: DashMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'user',
      content,
      timestamp: Date.now(),
      attachments: storedAttachments,
    };

    await this.conversation.addMessageToConversation(convId, userMessage);

    const assistantMessage = await this.generateAIResponse(
      content,
      convId,
      attachments,
      onStreamChunk,
      options?.contextOverride,
      options?.modelOverride
    );

    await this.conversation.addMessageToConversation(convId, assistantMessage);

    return assistantMessage;
  }

  private async generateAIResponse(
    userInput: string,
    conversationId: string,
    attachments?: any[],
    onStreamChunk?: (chunk: string) => void,
    contextOverride?: string | null,
    modelOverride?: string | null
  ): Promise<DashMessage> {
    try {
      const conversation = await this.conversation.getConversation(conversationId);
      const recentMessages = conversation?.messages?.slice(-MAX_CONTEXT_MESSAGES) || [];

      // Check if strict language mode is enabled in personality settings
      const personality = this.profileManager.getPersonality();
      const strictLanguageMode = personality?.strict_language_mode === true;
      const langDirective = this.promptBuilder.buildLanguageDirective(strictLanguageMode);
      const systemPrompt = this.promptBuilder.buildSystemPrompt();
      const shouldStream = typeof onStreamChunk === 'function';
      const userProfile = this.getUserProfile();
      const languageOverride = strictLanguageMode ? null : this.detectLanguageOverride(userInput);
      const languageOverrideDirective = languageOverride
        ? `LANGUAGE OVERRIDE: Respond fully in Afrikaans (af-ZA) with Afrikaans examples.`
        : null;

      let childrenContext: string | null = null;
      if (userProfile?.role === 'parent') {
        childrenContext = await this.buildParentChildrenContext();
      }

      const tutoringGuidance = (userProfile?.role === 'parent' || userProfile?.role === 'student')
        ? `Tutoring guidance: For homework/math help, use the student_tutor tool. Ask for the exact question and confirm grade/age before proceeding. If the parent has multiple children, ask which child to focus on. Teach step-by-step, include worked examples, then give short practice and ask a follow-up question. IMPORTANT: Ask ONE question at a time and STOP. Do not continue to the next question until the learner answers. Do not include placeholders like "[Wait for the learner's response]". Avoid inventing specific tests unless requested.`
        : '';
      const hasScannableAttachment = Array.isArray(attachments)
        && attachments.some((attachment: any) => {
          const kind = String(attachment?.kind || '').toLowerCase();
          return kind === 'image' || kind === 'pdf' || kind === 'document';
        });
      const detectedOcrTask = hasScannableAttachment ? detectOCRTask(userInput) : null;
      const ocrMode = hasScannableAttachment && (isOCRIntent(userInput) || detectedOcrTask !== null);
      const ocrTask = detectedOcrTask || 'document';
      const serviceType = ocrMode ? 'image_analysis' : 'homework_help';

      const contextParts = [
        systemPrompt,
        `User role: ${userProfile?.role || 'educator'}`,
        childrenContext,
        tutoringGuidance,
        ocrMode ? getOCRPromptForTask(ocrTask) : null,
        languageOverrideDirective || langDirective,
        contextOverride || null,
      ].filter(Boolean);

      const response = await this.aiClient.callAIService({
        action: 'general_assistance',
        messages: this.promptBuilder.buildMessageHistory(recentMessages, userInput),
        context: contextParts.join('\n'),
        attachments,
        serviceType,
        ocrMode,
        ocrTask,
        ocrResponseFormat: ocrMode ? 'json' : undefined,
        stream: shouldStream,
        onChunk: onStreamChunk,
        model: modelOverride || undefined,
      });

      const generatedImages = response.metadata?.generated_images || [];
      const generatedAttachments = this.mapGeneratedImagesToAttachments(generatedImages);
      const responseMetadata: Record<string, unknown> = {};
      if (languageOverride) {
        responseMetadata.detected_language = languageOverride;
      }
      if (generatedImages.length > 0) {
        responseMetadata.generated_images = generatedImages;
      }

      return {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'assistant',
        content: response.content || 'I ran into a hiccup while preparing your help. Please try again or add a bit more detail.',
        timestamp: Date.now(),
        attachments: generatedAttachments,
        metadata: Object.keys(responseMetadata).length > 0 ? responseMetadata as any : undefined,
      };
    } catch (error) {
      console.error('[DashAICore] Failed to generate response:', error);
      return {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'assistant',
        content: "I’m having trouble right now. Please try again, or tell me your grade/subject and I’ll guide you step-by-step.",
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
