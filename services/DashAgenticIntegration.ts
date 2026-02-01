/**
 * DashAgenticIntegration
 * 
 * Integration layer that wires all agentic services into the Dash AI Assistant.
 * This provides a unified API for enhanced capabilities.
 */

import { DashEduDashKnowledge } from './DashEduDashKnowledge';
import { DashConversationState } from './DashConversationState';
import { DashCapabilityDiscovery } from './DashCapabilityDiscovery';
import { DashAutonomyManager } from './DashAutonomyManager';
import { DashTelemetry } from './DashTelemetry';
import DashRealTimeAwareness from './DashRealTimeAwareness';
import { SuperAdminAIControl, SuperAdminAIControlState } from './superadmin/SuperAdminAIControl';

export interface AgenticContext {
  userId: string;
  profile?: any;
  tier: string;
  role: string;
  currentScreen?: string;
  language?: string;
}

/**
 * Role-based agentic capabilities
 * Superadmin gets full agentic mode, others get assistant mode
 */
export interface AgenticCapabilities {
  mode: 'assistant' | 'agent';
  canRunDiagnostics: boolean;
  canMakeCodeChanges: boolean;
  canAccessSystemLevel: boolean;
  canAutoExecuteHighRisk: boolean;
  autonomyLevel: 'limited' | 'moderate' | 'full';
}

export class DashAgenticIntegration {
  private static initialized = false;
  private static readonly SUPERADMIN_ROLES = new Set(['super_admin', 'superadmin']);

  static getRoleBasedCapabilities(role?: string): AgenticCapabilities {
    const normalizedRole = (role || '').toLowerCase();
    const isSuperadmin = this.SUPERADMIN_ROLES.has(normalizedRole);

    if (!isSuperadmin) {
      return {
        mode: 'assistant',
        canRunDiagnostics: false,
        canMakeCodeChanges: false,
        canAccessSystemLevel: false,
        canAutoExecuteHighRisk: false,
        autonomyLevel: 'limited'
      };
    }

    return {
      mode: 'assistant',
      canRunDiagnostics: true,
      canMakeCodeChanges: false,
      canAccessSystemLevel: false,
      canAutoExecuteHighRisk: false,
      autonomyLevel: 'limited'
    };
  }
  
  /**
   * Get role-based agentic capabilities
   * Superadmin: Full agentic mode with all capabilities
   * Others: Assistant mode with limited autonomy
   */
  static async getAgenticCapabilities(
    context: AgenticContext,
    control?: SuperAdminAIControlState
  ): Promise<AgenticCapabilities> {
    const role = (context.role || '').toLowerCase();
    const isSuperadmin = this.SUPERADMIN_ROLES.has(role);

    if (!isSuperadmin) {
      return this.getRoleBasedCapabilities(role);
    }

    // Superadmin exists, but only the platform owner can enable full autonomy
    const controlState = control ?? await SuperAdminAIControl.getControlState();
    const isOwner = !!controlState.owner_user_id && controlState.owner_user_id === context.userId;
    const autonomyEnabled = controlState.autonomy_enabled && isOwner;

    if (!autonomyEnabled) {
      return this.getRoleBasedCapabilities(role);
    }

    const autonomyLevel =
      controlState.autonomy_mode === 'full'
        ? 'full'
        : controlState.autonomy_mode === 'copilot'
          ? 'moderate'
          : 'limited';

    return {
      mode: 'agent',
      canRunDiagnostics: true,
      canMakeCodeChanges: true,
      canAccessSystemLevel: true,
      canAutoExecuteHighRisk:
        controlState.autonomy_mode === 'full' && controlState.auto_execute_high === true,
      autonomyLevel
    };
  }

  private static async syncAutonomySettings(
    context: AgenticContext,
    control?: SuperAdminAIControlState
  ): Promise<SuperAdminAIControlState | null> {
    const role = (context.role || '').toLowerCase();
    const isSuperadmin = this.SUPERADMIN_ROLES.has(role);

    const baseSettings = {
      mode: 'assistant' as const,
      autoExecuteLowRisk: true,
      autoExecuteMediumRisk: false,
      autoExecuteHighRisk: false,
      requireConfirmForNavigation: false
    };

    if (!isSuperadmin) {
      await this.applyAutonomySettingsIfChanged(baseSettings);
      return null;
    }

    const controlState = control ?? await SuperAdminAIControl.getControlState();
    const isOwner = !!controlState.owner_user_id && controlState.owner_user_id === context.userId;
    const autonomyEnabled = controlState.autonomy_enabled && isOwner;

    if (!autonomyEnabled) {
      await this.applyAutonomySettingsIfChanged({
        ...baseSettings,
        requireConfirmForNavigation: controlState.require_confirm_navigation ?? false
      });
      return controlState;
    }

    const mode = controlState.autonomy_mode === 'assistant' ? 'assistant' : 'copilot';
    const allowHighRisk = controlState.autonomy_mode === 'full';

    await this.applyAutonomySettingsIfChanged({
      mode,
      autoExecuteLowRisk: controlState.auto_execute_low,
      autoExecuteMediumRisk:
        controlState.autonomy_mode !== 'assistant' && controlState.auto_execute_medium,
      autoExecuteHighRisk: allowHighRisk && controlState.auto_execute_high,
      requireConfirmForNavigation: controlState.require_confirm_navigation
    });

    return controlState;
  }

  private static async applyAutonomySettingsIfChanged(
    nextSettings: Awaited<ReturnType<typeof DashAutonomyManager.getSettings>>
  ): Promise<void> {
    const current = await DashAutonomyManager.getSettings();
    const changed =
      current.mode !== nextSettings.mode ||
      current.autoExecuteLowRisk !== nextSettings.autoExecuteLowRisk ||
      current.autoExecuteMediumRisk !== nextSettings.autoExecuteMediumRisk ||
      current.autoExecuteHighRisk !== nextSettings.autoExecuteHighRisk ||
      current.requireConfirmForNavigation !== nextSettings.requireConfirmForNavigation;

    if (changed) {
      await DashAutonomyManager.updateSettings(nextSettings);
    }
  }
  
  /**
   * Check if agentic mode is enabled for user
   */
  static async isAgenticEnabled(context: AgenticContext): Promise<boolean> {
    const capabilities = await this.getAgenticCapabilities(context);
    return capabilities.mode === 'agent';
  }
  
  /**
   * Initialize all agentic services
   */
  static async initialize(context: AgenticContext): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Initialize conversation state
      await DashConversationState.initializeSession(
        context.userId,
        context.profile
      );
      
      // Initialize autonomy manager
      await DashAutonomyManager.initialize();
      
      // Initialize telemetry
      await DashTelemetry.initialize();
      
      this.initialized = true;
      console.log('[DashAgenticIntegration] All services initialized');
    } catch (error) {
      console.error('[DashAgenticIntegration] Initialization failed:', error);
      // Continue gracefully - services will use defaults
    }
  }
  
  /**
   * Build enhanced system prompt with all agentic context
   * Integrates with existing DashRealTimeAwareness
   */
  static async buildEnhancedSystemPrompt(
    awareness: any,
    context: AgenticContext
  ): Promise<string> {
    const targetLanguage = context.language || context.profile?.preferred_language || 'en';
    console.log(`[AgenticIntegration] 🎯 Building prompt for language: ${targetLanguage}`);
    
    // Start with real-time awareness prompt
    let prompt = DashRealTimeAwareness.buildAwareSystemPrompt(awareness);
    
    // Get conversation context
    const conversationContext = DashConversationState.getConversationContext();
    
    // Get language and voice context (this sets multilingual behavior)
    const languageContext = DashConversationState.getLanguageAndVoiceContext(targetLanguage);
    
    // Build platform knowledge context
    const platformContext = DashEduDashKnowledge.buildPromptContext(
      context.profile,
      awareness,
      context.tier,
      conversationContext,
      languageContext
    );
    
    // Combine all contexts
    prompt += '\n\n' + platformContext;
    
    // Add capability summary
    const capabilitySummary = DashCapabilityDiscovery.getCapabilitySummary(
      context.role,
      context.tier
    );
    prompt += '\n\n' + capabilitySummary;
    
    // Get role-based agentic capabilities
    const normalizedRole = (context.role || '').toLowerCase();
    const isSuperadmin = this.SUPERADMIN_ROLES.has(normalizedRole);
    const controlState = isSuperadmin ? await SuperAdminAIControl.getControlState() : undefined;
    const capabilities = await this.getAgenticCapabilities(context, controlState);
    await this.syncAutonomySettings(context, controlState);
    
    // Add role-based autonomy guidelines
    const autonomySettings = await DashAutonomyManager.getSettings();
    prompt += '\n\n## AUTONOMY SETTINGS\n\n';
    prompt += `**Role:** ${context.role}\n`;
    prompt += `**Agentic Mode:** ${capabilities.mode.toUpperCase()} (${capabilities.mode === 'assistant' ? 'cautious, asks approval' : 'autonomous, can take proactive actions'})\n`;
    prompt += `**Autonomy Level:** ${capabilities.autonomyLevel}\n`;
    prompt += `**Auto-execute Low Risk:** ${autonomySettings.autoExecuteLowRisk ? 'YES' : 'NO'}\n`;
    prompt += `**Auto-execute Medium Risk:** ${autonomySettings.autoExecuteMediumRisk ? 'YES' : 'NO'}\n`;
    prompt += `**Auto-execute High Risk:** ${capabilities.canAutoExecuteHighRisk ? 'YES (OWNER ONLY)' : 'NO'}\n`;
    
    // Add superadmin-specific capabilities
    if (capabilities.mode === 'agent') {
      prompt += '\n\n## AGENTIC CAPABILITIES (PLATFORM OWNER)\n\n';
      prompt += '**System-Level Access:** You have full system-level access and can:\n';
      prompt += '- Run comprehensive app diagnostics\n';
      prompt += '- Execute database health checks\n';
      prompt += '- Inspect and modify system configurations\n';
      prompt += '- Access and analyze logs and telemetry\n';
      prompt += '- Suggest and implement code-level fixes\n';
      prompt += '- Execute administrative commands\n\n';
      prompt += '**Diagnostic Commands:**\n';
      prompt += '- "run diagnostics" - Full app health check\n';
      prompt += '- "check database" - Verify database integrity\n';
      prompt += '- "inspect logs" - Review error logs and telemetry\n';
      prompt += '- "system status" - Overall system health report\n\n';
      prompt += '**IMPORTANT:** When user requests diagnostics or system-level operations:\n';
      prompt += '1. Acknowledge their platform owner status\n';
      prompt += '2. Execute comprehensive checks proactively\n';
      prompt += '3. Provide detailed technical analysis\n';
      prompt += '4. Suggest specific fixes with code examples if applicable\n';
      prompt += '5. Ask for confirmation before making changes\n';
    }
    
    return prompt;
  }
  
  /**
   * Handle post-response actions
   * Called after Dash generates a response
   */
  static async handlePostResponse(
    success: boolean,
    responseTime: number,
    context: {
      intent?: string;
      featureUsed?: string;
      action?: any;
    }
  ): Promise<void> {
    // Mark as greeted if this was first interaction
    if (DashConversationState.shouldGreet()) {
      await DashConversationState.markGreeted();
    }
    
    // Update session activity
    await DashConversationState.touchSession();
    
    // Track interaction in telemetry
    await DashTelemetry.trackInteraction({
      success,
      responseTime,
      intent: context.intent,
      featureUsed: context.featureUsed
    });
    
    // Record action if provided
    if (context.action) {
      await DashConversationState.recordAction(context.action.type);
    }
  }
  
  /**
   * Check if an action can be auto-executed
   */
  static async checkActionExecution(
    action: {
    type: string;
    description: string;
    parameters?: Record<string, any>;
  },
    context?: AgenticContext
  ): Promise<{
    canAutoExecute: boolean;
    reason: string;
    riskLevel: 'low' | 'medium' | 'high';
    actionId?: string;
  }> {
    if (context) {
      await this.syncAutonomySettings(context);
    }

    const { canAutoExecute, reason, riskLevel } = 
      await DashAutonomyManager.canAutoExecute(action);
    
    if (!canAutoExecute) {
      // Request approval
      const actionId = await DashAutonomyManager.requestApproval({
        type: action.type,
        description: action.description,
        parameters: action.parameters || {}
      });
      
      return {
        canAutoExecute: false,
        reason,
        riskLevel,
        actionId
      };
    }
    
    return {
      canAutoExecute: true,
      reason,
      riskLevel
    };
  }
  
  /**
   * Record successful action execution
   */
  static async recordActionSuccess(
    actionType: string,
    riskLevel: 'low' | 'medium' | 'high',
    autoExecuted: boolean
  ): Promise<void> {
    await DashAutonomyManager.recordAction(
      actionType,
      riskLevel,
      autoExecuted,
      true // success
    );
  }
  
  /**
   * Record failed action execution
   */
  static async recordActionFailure(
    actionType: string,
    riskLevel: 'low' | 'medium' | 'high',
    autoExecuted: boolean,
    error: string
  ): Promise<void> {
    await DashAutonomyManager.recordAction(
      actionType,
      riskLevel,
      autoExecuted,
      false // failure
    );
    
    await DashTelemetry.logError(error, { actionType, riskLevel });
  }
  
  /**
   * Discover capabilities for user intent
   */
  static async discoverForIntent(
    userQuery: string,
    context: AgenticContext
  ): Promise<{
    primaryMatch: any;
    relatedMatches: any[];
    suggestions: string[];
  }> {
    const recentActions = DashConversationState.getRecentActions(5);
    
    const { primaryMatch, relatedMatches } = 
      DashCapabilityDiscovery.discoverForIntent(userQuery, {
        role: context.role,
        tier: context.tier,
        currentScreen: context.currentScreen,
        recentActions
      });
    
    // Generate suggestions based on matches
    const suggestions: string[] = [];
    
    if (primaryMatch) {
      suggestions.push(`I can help you with ${primaryMatch.name}`);
    }
    
    if (relatedMatches.length > 0) {
      suggestions.push(
        `Related features: ${relatedMatches.map(m => m.name).join(', ')}`
      );
    }
    
    return {
      primaryMatch,
      relatedMatches,
      suggestions
    };
  }
  
  /**
   * Get proactive suggestions based on context
   */
  static async getProactiveSuggestions(
    context: AgenticContext & {
      hour?: number;
      dayOfWeek?: number;
    }
  ): Promise<any[]> {
    const recentActions = DashConversationState.getRecentActions(5);
    
    const suggestions = DashCapabilityDiscovery.autoDiscover({
      role: context.role,
      tier: context.tier,
      currentScreen: context.currentScreen,
      recentActions,
      hour: context.hour,
      dayOfWeek: context.dayOfWeek
    });
    
    return suggestions;
  }
  
  /**
   * Record a topic discussion
   */
  static async recordTopic(topic: string): Promise<void> {
    await DashConversationState.recordTopic(topic);
  }
  
  /**
   * Check if should greet user
   */
  static shouldGreet(): boolean {
    return DashConversationState.shouldGreet();
  }
  
  /**
   * Get user's preferred name
   */
  static getUserName(): string | undefined {
    return DashConversationState.getUserName();
  }
  
  /**
   * Get autonomy statistics
   */
  static getAutonomyStats() {
    return DashAutonomyManager.getStats();
  }
  
  /**
   * Get telemetry insights
   */
  static async getTelemetryInsights() {
    return await DashTelemetry.getInsights();
  }
  
  /**
   * Approve pending action
   */
  static async approvePendingAction(actionId: string): Promise<any> {
    return DashAutonomyManager.approvePendingAction(actionId);
  }
  
  /**
   * Reject pending action
   */
  static rejectPendingAction(actionId: string): void {
    DashAutonomyManager.rejectPendingAction(actionId);
  }
  
  /**
   * Get all pending actions
   */
  static getPendingActions() {
    return DashAutonomyManager.getPendingActions();
  }
  
  /**
   * Set autonomy mode
   */
  static async setAutonomyMode(mode: 'assistant' | 'copilot'): Promise<void> {
    await DashAutonomyManager.setMode(mode);
  }
  
  /**
   * Update language preference
   */
  static async updateLanguage(language: string): Promise<void> {
    await DashConversationState.updatePreferences({
      preferredLanguage: language
    });
  }
  
  /**
   * Validate database query for RLS compliance
   */
  static validateQuery(query: string): {
    valid: boolean;
    warnings: string[];
  } {
    return DashEduDashKnowledge.validateQuery(query);
  }
  
  /**
   * Get feature availability
   */
  static checkFeatureAvailability(
    featureId: string,
    role: string,
    tier: string
  ): {
    available: boolean;
    reason?: string;
    upgradeRequired?: string;
  } {
    return DashCapabilityDiscovery.checkAvailability(featureId, role, tier);
  }
  
  /**
   * Clean up - call when user logs out or app closes
   */
  static async cleanup(): Promise<void> {
    // Clear stale actions
    DashAutonomyManager.clearStaleActions();
    
    // End conversation session
    await DashConversationState.endSession();
  }
  
  /**
   * Get comprehensive stats for debugging
   */
  static async getDebugStats() {
    const sessionStats = DashConversationState.getSessionStats();
    const autonomyStats = DashAutonomyManager.getStats();
    const telemetryInsights = await DashTelemetry.getInsights();
    const discoveryStats = DashCapabilityDiscovery.getStats('teacher', 'premium');
    
    return {
      session: sessionStats,
      autonomy: autonomyStats,
      telemetry: telemetryInsights,
      discovery: discoveryStats,
      initialized: this.initialized
    };
  }
}
