/**
 * DashAIClient
 * 
 * Handles all AI service communication via Supabase Edge Functions.
 * Extracted from DashAICore for file size compliance (WARP.md).
 * 
 * Supports:
 * - Non-streaming HTTP requests
 * - SSE streaming (web)
 * - WebSocket streaming (React Native - Phase 2)
 * 
 * References:
 * - Supabase JS v2: https://supabase.com/docs/reference/javascript/introduction
 * - Fetch API: https://developer.mozilla.org/docs/Web/API/Fetch_API
 * - React Native 0.79 WebSocket: https://reactnative.dev/docs/0.79/network#websocket-support
 */

import { unifiedToolRegistry } from '@/services/tools/UnifiedToolRegistry';
import { getCapabilityTier, normalizeTierName } from '@/lib/tiers';

// Global declarations for React Native environment
// Reference: https://reactnative.dev/docs/javascript-environment
declare const __DEV__: boolean;

/**
 * AI service call parameters
 */
export interface AIServiceParams {
  action?: string;
  messages?: Array<{ role: string; content: string }>;
  content?: string;
  userInput?: string;
  context?: string;
  attachments?: any[];
  images?: Array<{ data: string; media_type: string }>;
  model?: string;
  serviceType?: string;
  ocrMode?: boolean;
  ocrTask?: 'homework' | 'document' | 'handwriting';
  ocrResponseFormat?: 'json' | 'text';
  stream?: boolean;
  onChunk?: (chunk: string) => void;
}

/**
 * AI service response
 */
export interface AIServiceResponse {
  content: string;
  metadata?: {
    usage?: {
      tokens_in?: number;
      tokens_out?: number;
      cost?: number;
    };
    tool_results?: any[];
    generated_images?: Array<{
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
    }>;
    resolution_status?: 'resolved' | 'needs_clarification' | 'escalated';
    confidence_score?: number;
    escalation_offer?: boolean;
    trace_id?: string;
    continuation_limit_reached?: boolean;
  };
  error?: string;
}

/**
 * User profile for scope determination
 */
export interface UserProfile {
  role?: string;
}

/**
 * DashAIClient configuration
 */
export interface DashAIClientConfig {
  supabaseClient: any;
  getUserProfile: () => UserProfile | undefined;
}

/**
 * DashAIClient
 * 
 * Handles AI service communication via ai-proxy Edge Function.
 */
export class DashAIClient {
  private supabaseClient: any;
  private getUserProfile: () => UserProfile | undefined;
  
  constructor(config: DashAIClientConfig) {
    this.supabaseClient = config.supabaseClient;
    this.getUserProfile = config.getUserProfile;
  }

  private createTraceId(prefix = 'dash_ai'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getRateLimitRetryDelayMs(): number {
    return this.parseIntegerEnv(
      process.env.EXPO_PUBLIC_DASH_AI_429_RETRY_MS,
      900,
      250,
      5000
    );
  }

  private async invokeAIProxyWith429Retry(
    body: Record<string, unknown>,
    traceId: string,
    phase: 'initial' | 'continuation'
  ): Promise<{ data: any; error: any }> {
    const first = await this.supabaseClient.functions.invoke('ai-proxy', { body });
    if (!first?.error) return first;

    const firstError = this.parseEdgeFunctionError(first.error);
    const code = String(firstError.code || '').toLowerCase();
    const isRateLimited = firstError.status === 429;
    const isHardQuota = code === 'quota_exceeded';

    // Quota exhausted is deterministic; no retry loop.
    if (!isRateLimited || isHardQuota) {
      return first;
    }

    const retryDelayMs = this.getRateLimitRetryDelayMs();
    console.warn('[DashAIClient] ai-proxy returned 429, retrying once', {
      phase,
      trace_id: traceId,
      delay_ms: retryDelayMs,
      code: firstError.code,
    });
    await this.sleep(retryDelayMs);

    return this.supabaseClient.functions.invoke('ai-proxy', { body });
  }

  private parseIntegerEnv(
    value: string | undefined,
    fallback: number,
    min: number,
    max: number
  ): number {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  }

  private parseFloatEnv(
    value: string | undefined,
    fallback: number,
    min: number,
    max: number
  ): number {
    const parsed = Number.parseFloat(String(value ?? ''));
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  }

  private getOrchestrationConfig(): {
    orchestration_mode: string;
    loop_budget: {
      max_continuation_passes: number;
      max_pending_tools_per_pass: number;
      timeout_ms: number;
    };
    confidence_threshold: number;
  } {
    return {
      orchestration_mode: process.env.EXPO_PUBLIC_DASH_ORCHESTRATION_MODE || 'bounded_two_pass',
      loop_budget: {
        max_continuation_passes: this.parseIntegerEnv(
          process.env.EXPO_PUBLIC_DASH_CONTINUATION_PASSES,
          2,
          1,
          4
        ),
        max_pending_tools_per_pass: this.parseIntegerEnv(
          process.env.EXPO_PUBLIC_DASH_MAX_PENDING_TOOLS_PER_PASS,
          6,
          1,
          20
        ),
        timeout_ms: this.parseIntegerEnv(
          process.env.EXPO_PUBLIC_DASH_ORCHESTRATION_TIMEOUT_MS,
          12000,
          2000,
          60000
        ),
      },
      confidence_threshold: this.parseFloatEnv(
        process.env.EXPO_PUBLIC_DASH_CONFIDENCE_THRESHOLD,
        0.68,
        0.05,
        0.99
      ),
    };
  }

  private normalizeRoleAndScope(roleValue?: string | null): {
    role: string;
    scope: 'teacher' | 'principal' | 'parent' | 'student';
  } {
    const role = String(roleValue || 'teacher').toLowerCase();
    const scope: 'teacher' | 'principal' | 'parent' | 'student' =
      (['teacher', 'principal', 'parent', 'student', 'learner'].includes(role)
        ? (role === 'learner' ? 'student' : role)
        : 'teacher') as any;
    return { role, scope };
  }

  private resolveUserTier(profile: any): string {
    const candidates = [
      profile?.tier,
      profile?.subscription_tier,
      profile?.current_tier,
      profile?.context?.subscription_tier,
      profile?.context?.tier,
      profile?.context?.capability_tier,
      profile?.preferences?.subscription_tier,
      profile?.preferences?.tier,
    ];

    for (const candidate of candidates) {
      const raw = String(candidate || '').trim().toLowerCase();
      if (!raw) continue;

      // Preserve direct capability tiers.
      if (raw === 'free' || raw === 'starter' || raw === 'premium' || raw === 'enterprise') {
        return raw;
      }

      // Legacy aliases still present in historic usage records.
      if (raw === 'basic' || raw === 'solo' || raw === 'group_5' || raw === 'trialing') {
        return 'starter';
      }
      if (raw === 'pro' || raw === 'group_10') {
        return 'premium';
      }

      try {
        return getCapabilityTier(normalizeTierName(raw));
      } catch {
        if (raw.includes('enterprise')) return 'enterprise';
        if (raw.includes('premium') || raw.includes('pro') || raw.includes('plus')) return 'premium';
        if (raw.includes('starter') || raw.includes('basic') || raw.includes('trial')) return 'starter';
      }
    }

    return 'free';
  }

  private getClientToolDefs(role: string, tier: string): Array<{
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  }> | undefined {
    const defs = unifiedToolRegistry.toClientToolDefs(role, tier);
    return defs.length > 0 ? defs : undefined;
  }

  private buildToolPlanMetadata(role: string, tier: string): {
    role: string;
    tier: string;
    tool_names: string[];
  } {
    const tools = unifiedToolRegistry.list(role, tier).map((tool) => tool.name);
    return {
      role,
      tier,
      tool_names: tools,
    };
  }

  private buildAttachmentContext(attachments?: any[]): string | null {
    if (!Array.isArray(attachments) || attachments.length === 0) return null;
    const lines = attachments.map((attachment: any) => {
      const name = attachment?.name || 'Attachment';
      const kind = attachment?.kind || 'file';
      const size = typeof attachment?.size === 'number' ? `${Math.round(attachment.size / 1024)} KB` : '';
      return `- ${name} (${kind}${size ? `, ${size}` : ''})`;
    });
    return [
      'ATTACHMENTS RECEIVED:',
      ...lines,
      'If you cannot view the attachments, ask the learner to type the exact question or summarize the document.',
    ].join('\n');
  }

  private buildImagePayloads(attachments?: any[], images?: Array<{ data: string; media_type: string }>) {
    if (Array.isArray(images) && images.length > 0) {
      return images;
    }
    if (!Array.isArray(attachments) || attachments.length === 0) return [];
    const payloads: Array<{ data: string; media_type: string }> = [];
    for (const attachment of attachments) {
      const meta = attachment?.meta || {};
      const data = meta.image_base64 as string | undefined;
      const mediaType = (meta.image_media_type as string | undefined) || attachment?.mimeType || 'image/jpeg';
      if (data && data.length <= 4_000_000) {
        payloads.push({ data, media_type: mediaType });
      }
    }
    return payloads;
  }
  
  /**
   * Call AI service with tool support (non-streaming)
   * 
   * References:
   * - Supabase Functions invoke: https://supabase.com/docs/reference/javascript/invoke
   */
  public async callAIService(params: AIServiceParams): Promise<AIServiceResponse> {
    try {
      // Tools enabled - Dash can now autonomously call tools like Claude Sonnet 4.5
      const ENABLE_TOOLS = true;
      
      if (__DEV__) {
        console.log('[DashAIClient] Calling AI service:', {
          action: params.action,
          streaming: params.stream || false,
          toolsEnabled: ENABLE_TOOLS,
        });
      }
      
      // If streaming requested, use streaming endpoint
      if (params.stream && params.onChunk) {
        // Build prompt from messages and delegate to streaming path
        const messagesArr = Array.isArray(params.messages) ? params.messages : [];
        const promptText = messagesArr.length > 0
          ? messagesArr.map((m: any) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content || ''}`).join('\n')
          : String(params.content || params.userInput || '');
        return await this.callAIServiceStreaming(
          {
            promptText,
            context: params.context || undefined,
            model: params.model,
            serviceType: params.serviceType,
            ocrMode: params.ocrMode,
            ocrTask: params.ocrTask,
            ocrResponseFormat: params.ocrResponseFormat,
            // Forward image data so streaming path can include vision payloads
            attachments: params.attachments,
            images: params.images,
          },
          params.onChunk
        );
      }
      
      // Non-streaming call to ai-proxy
      const messagesArr = Array.isArray(params.messages) ? params.messages : [];
      const promptText = messagesArr.length > 0
        ? messagesArr.map((m: any) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content || ''}`).join('\n')
        : String(params.content || params.userInput || '');
      const attachmentContext = params.context?.includes('ATTACHMENTS RECEIVED')
        ? null
        : this.buildAttachmentContext(params.attachments);
      const mergedContext = [params.context, attachmentContext].filter(Boolean).join('\n\n') || undefined;
      const images = this.buildImagePayloads(params.attachments, params.images);
      const profile = this.getUserProfile() as any;
      const { role, scope } = this.normalizeRoleAndScope(profile?.role);
      const userTier = this.resolveUserTier(profile);
      const traceId = this.createTraceId('dash_ai_client');
      const orchestration = this.getOrchestrationConfig();
      const effectiveServiceType = params.serviceType || (params.ocrMode ? 'image_analysis' : 'chat_message');

      // Canonical client tool inventory (shared with Dash Assistant/Tutor/ORB).
      const clientToolDefs = this.getClientToolDefs(role, userTier);
      const toolPlan = this.buildToolPlanMetadata(role, userTier);
      
      const initialRequestBody = {
        scope,
        service_type: effectiveServiceType,
        payload: {
          prompt: messagesArr.length > 0 ? undefined : promptText,
          context: mergedContext,
          messages: messagesArr.length > 0 ? messagesArr : undefined,
          images: images.length > 0 ? images : undefined,
          ocr_mode: params.ocrMode || undefined,
          ocr_task: params.ocrTask || undefined,
          ocr_response_format: params.ocrResponseFormat || undefined,
          model: params.model || undefined,
        },
        stream: false,
        enable_tools: ENABLE_TOOLS,
        client_tools: clientToolDefs,
        metadata: {
          role: scope,
          model: params.model || undefined,
          trace_id: traceId,
          tool_plan: toolPlan,
          orchestration_mode: orchestration.orchestration_mode,
          loop_budget: orchestration.loop_budget,
          confidence_threshold: orchestration.confidence_threshold,
        },
      } as const;

      const { data, error } = await this.invokeAIProxyWith429Retry(
        initialRequestBody as unknown as Record<string, unknown>,
        traceId,
        'initial'
      );
      
      if (error) {
        const errorDetails = this.parseEdgeFunctionError(error);
        const logPayload = {
          error,
          status: errorDetails.status,
          code: errorDetails.code,
          message: errorDetails.message,
          details: errorDetails.details,
        };
        if (errorDetails.status === 429) {
          console.warn('[DashAIClient] AI service rate-limited:', logPayload);
        } else {
          console.error('[DashAIClient] AI service error:', logPayload);
        }
        return {
          content: this.getFriendlyErrorMessage(errorDetails),
          error: errorDetails.message || 'AI service error',
        };
      }
      
      // Handle response with potential tool use
      let assistantContent = data?.content || '';
      const toolResults = Array.isArray(data?.tool_results) ? [...data.tool_results] : [];
      let pendingToolCalls = Array.isArray(data?.pending_tool_calls) ? [...data.pending_tool_calls] : [];
      let usage = data?.usage;
      let generatedImages = data?.generated_images || [];
      let resolutionStatus = data?.resolution_status as
        | 'resolved'
        | 'needs_clarification'
        | 'escalated'
        | undefined;
      let confidenceScore = typeof data?.confidence_score === 'number'
        ? data.confidence_score
        : undefined;
      let escalationOffer = typeof data?.escalation_offer === 'boolean'
        ? data.escalation_offer
        : undefined;

      if (__DEV__ && toolResults.length > 0) {
        console.log('[DashAIClient] Server-side tool calls executed:', toolResults.length);
      }

      // Execute client-side tools that the AI requested
      const baseMessages = messagesArr.length > 0
        ? [...messagesArr]
        : [{ role: 'user', content: promptText }];
      let continuationMessages = [...baseMessages];
      let continuationPass = 0;
      let continuationLimitReached = false;

      while (
        pendingToolCalls.length > 0 &&
        continuationPass < orchestration.loop_budget.max_continuation_passes
      ) {
        continuationPass += 1;
        const currentBatch = pendingToolCalls.slice(
          0,
          orchestration.loop_budget.max_pending_tools_per_pass
        );
        const overflow = pendingToolCalls.slice(orchestration.loop_budget.max_pending_tools_per_pass);

        if (__DEV__) {
          console.log('[DashAIClient] Executing client-side tools (pass):', {
            pass: continuationPass,
            tools: currentBatch.map((t: any) => t?.name),
          });
        }

        const executionContext = {
          userId: profile?.id || '',
          role: role,
          tier: userTier,
          organizationId: profile?.organization_id || profile?.preschool_id || '',
          hasOrganization: !!(profile?.organization_id || profile?.preschool_id),
          isGuest: !profile?.id,
          supabaseClient: this.supabaseClient,
          trace_id: traceId,
          tool_plan: {
            source: 'ai-proxy.pending_tool_calls',
            continuation_pass: continuationPass,
            requested_tool_names: currentBatch.map((call: any) => call?.name).filter(Boolean),
          },
        };

        const toolResultMessages: Array<{ role: string; content: string; tool_use_id?: string }> = [];
        for (const toolCall of currentBatch) {
          try {
            const result = await unifiedToolRegistry.execute(
              toolCall.name,
              toolCall.input || {},
              executionContext
            );
            const output = result.result || result.error || 'No output';
            toolResults.push({
              name: toolCall.name,
              input: toolCall.input,
              output,
              success: result.success,
              trace_id: result.trace_id || traceId,
            });
            toolResultMessages.push({
              role: 'user',
              content: `[Tool Result for ${toolCall.name}]: ${typeof output === 'string' ? output : JSON.stringify(output)}`,
              tool_use_id: toolCall.id,
            });
          } catch (toolError: any) {
            const message = toolError?.message || 'Unknown tool execution error';
            toolResults.push({
              name: toolCall.name,
              input: toolCall.input,
              output: `Tool execution error: ${message}`,
              success: false,
              trace_id: traceId,
            });
            toolResultMessages.push({
              role: 'user',
              content: `[Tool Result for ${toolCall.name}]: Error - ${message}`,
              tool_use_id: toolCall.id,
            });
          }
        }

        if (toolResultMessages.length === 0) {
          break;
        }

        continuationMessages = [
          ...continuationMessages,
          { role: 'assistant', content: assistantContent || 'I used the following tools to help you.' },
          ...toolResultMessages,
        ];

        try {
          const continuationBody = {
            scope,
            service_type: params.serviceType || 'chat_message',
            payload: {
              context: mergedContext,
              messages: continuationMessages,
              model: params.model || undefined,
            },
            stream: false,
            enable_tools: continuationPass < orchestration.loop_budget.max_continuation_passes,
            client_tools: clientToolDefs,
            metadata: {
              role: scope,
              continuation: true,
              trace_id: traceId,
              orchestration_mode: orchestration.orchestration_mode,
              loop_budget: orchestration.loop_budget,
              confidence_threshold: orchestration.confidence_threshold,
              tool_plan: {
                source: 'ai-proxy.continuation',
                continuation_pass: continuationPass,
                executed_tool_names: currentBatch.map((call: any) => call?.name).filter(Boolean),
              },
            },
          } as const;

          const { data: followUp, error: followUpError } = await this.invokeAIProxyWith429Retry(
            continuationBody as unknown as Record<string, unknown>,
            traceId,
            'continuation'
          );

          if (followUpError) {
            throw followUpError;
          }

          assistantContent = followUp?.content || assistantContent;
          usage = followUp?.usage || usage;
          generatedImages = followUp?.generated_images || generatedImages;
          resolutionStatus = (followUp?.resolution_status as any) || resolutionStatus;
          confidenceScore = typeof followUp?.confidence_score === 'number'
            ? followUp.confidence_score
            : confidenceScore;
          escalationOffer = typeof followUp?.escalation_offer === 'boolean'
            ? followUp.escalation_offer
            : escalationOffer;

          const followUpPending = Array.isArray(followUp?.pending_tool_calls)
            ? followUp.pending_tool_calls
            : [];
          pendingToolCalls = [...overflow, ...followUpPending];
        } catch (contError) {
          console.warn('[DashAIClient] Tool continuation call failed:', contError);
          pendingToolCalls = [];
          break;
        }
      }

      if (pendingToolCalls.length > 0) {
        continuationLimitReached = true;
        resolutionStatus = resolutionStatus || 'needs_clarification';
        escalationOffer = escalationOffer ?? true;
      }

      if (!data?.success) {
        return {
          content: assistantContent,
          metadata: {
            usage,
            tool_results: toolResults,
            generated_images: generatedImages,
            resolution_status: resolutionStatus,
            confidence_score: confidenceScore,
            escalation_offer: escalationOffer,
            trace_id: traceId,
            continuation_limit_reached: continuationLimitReached,
          },
        };
      }
      
      return { 
        content: assistantContent || data.content, 
        metadata: { 
          usage,
          tool_results: toolResults,
          generated_images: generatedImages,
          resolution_status: resolutionStatus,
          confidence_score: confidenceScore,
          escalation_offer: escalationOffer,
          trace_id: traceId,
          continuation_limit_reached: continuationLimitReached,
        } 
      };
    } catch (error) {
      console.error('[DashAIClient] AI service call failed:', error);
      return {
        content: 'I ran into a hiccup while preparing your help. Try again, or tell me what you need and I’ll guide you step-by-step.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private parseEdgeFunctionError(error: unknown): {
    status?: number;
    code?: string;
    message?: string;
    details?: unknown;
  } {
    const err = error as {
      status?: number;
      code?: string;
      message?: string;
      details?: unknown;
      context?: { status?: number; body?: string | object };
    };
    const status =
      (typeof err?.context?.status === 'number' ? err.context.status : undefined) ??
      (typeof err?.status === 'number' ? err.status : undefined);
    const body = err?.context?.body;
    let parsedBody: any = null;

    if (body && typeof body === 'string') {
      try {
        parsedBody = JSON.parse(body);
      } catch {
        parsedBody = { error: body };
      }
    } else if (body && typeof body === 'object') {
      parsedBody = body;
    }

    if (!parsedBody && err?.details && typeof err.details === 'object') {
      parsedBody = err.details;
    }

    const fallbackMessage =
      err?.message ||
      err?.context?.body ||
      'AI service error';

    const parsedError = parsedBody?.error;
    const code =
      (typeof parsedError === 'string' ? parsedError : undefined) ||
      (typeof parsedError?.code === 'string' ? parsedError.code : undefined) ||
      (typeof parsedBody?.code === 'string' ? parsedBody.code : undefined) ||
      (typeof err?.code === 'string' ? err.code : undefined);

    const message =
      (typeof parsedBody?.message === 'string' ? parsedBody.message : undefined) ||
      (typeof parsedError?.message === 'string' ? parsedError.message : undefined) ||
      (typeof parsedError === 'string' ? parsedError : undefined) ||
      fallbackMessage;

    return {
      status,
      code,
      message,
      details: parsedBody?.details || parsedBody || err?.details,
    };
  }

  private getFriendlyErrorMessage(error: {
    status?: number;
    code?: string;
    message?: string;
    details?: any;
  }): string {
    if (error.code === 'quota_exceeded') {
      const quotaInfo = error.details as { usage_count?: number; limit?: number; tier?: string } | undefined;
      if (quotaInfo?.usage_count && quotaInfo?.limit) {
        return `You've used ${quotaInfo.usage_count} of ${quotaInfo.limit} AI requests this month (${quotaInfo.tier || 'Free'} tier). Upgrade your plan for more requests!`;
      }
      return "You've reached your AI usage limit. Upgrade your plan for unlimited access, or contact support to increase your quota.";
    }
    if (error.status === 429) {
      return 'Dash is handling a lot of requests right now. Please try again in a few seconds.';
    }
    if (error.status === 401) {
      return 'Your session expired. Please sign in again to continue.';
    }
    if (error.status === 403) {
      return 'Your account needs to be linked to a school to use Dash AI.';
    }
    if (error.status === 503 || error.code === 'provider_not_configured') {
      return 'Dash AI is temporarily unavailable. Please try again in a moment.';
    }
    if (error.code === 'provider_error' || error.status === 502) {
      return 'Dash is temporarily unavailable. Please try again in a moment.';
    }
    if (error.code === 'streaming_not_supported') {
      return 'Live streaming isn’t available yet. Please try again without voice streaming.';
    }
    return 'Dash is having trouble right now. Please try again in a moment.';
  }
  
  /**
   * Call AI service with streaming support (SSE)
   * 
   * Note: Streaming is not fully supported on React Native due to fetch limitations.
   * For Phase 0, we fall back to parsing full response.
   * 
   * TODO (Phase 2): Implement WebSocket streaming for React Native
   * See: docs/features/DASH_AI_STREAMING_UPGRADE_PLAN.md
   * 
   * References:
   * - Supabase auth getSession: https://supabase.com/docs/reference/javascript/auth-getsession
   * - Fetch streaming: https://developer.mozilla.org/docs/Web/API/Streams_API/Using_readable_streams
   */
  private async callAIServiceStreaming(params: any, onChunk: (chunk: string) => void): Promise<AIServiceResponse> {
    // Feature flag: Use WebSocket streaming on React Native when enabled
    // Reference: https://reactnative.dev/docs/0.79/platform-specific-code
    const useWebSocket = process.env.EXPO_PUBLIC_USE_WEBSOCKET_STREAMING === 'true';
    
    if (useWebSocket) {
      try {
        return await this.callAIServiceStreamingWS(params, onChunk);
      } catch (error) {
        console.warn('[DashAIClient] WebSocket streaming failed, falling back to SSE:', error);
        // Fall through to SSE implementation below
      }
    }

    // Performance instrumentation (Phase 2)
    // References:
    // - Sentry Performance: https://docs.sentry.io/platforms/react-native/performance/
    // - PostHog Events: https://posthog.com/docs/libraries/react-native
    const startTime = Date.now();
    let firstTokenTime: number | null = null;
    let tokenCount = 0;

    try {
      const { data: sessionData } = await this.supabaseClient.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        throw new Error('No auth session for streaming');
      }
      
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('EXPO_PUBLIC_SUPABASE_URL not configured');
      }
      
      const url = `${supabaseUrl}/functions/v1/ai-proxy`;
      
      const userProfile = this.getUserProfile() as any;
      const { role: userRole, scope } = this.normalizeRoleAndScope(userProfile?.role || 'student');
      const userTier = this.resolveUserTier(userProfile);
      const clientToolDefs = this.getClientToolDefs(userRole, userTier);
      const traceId = this.createTraceId('dash_ai_stream');
      const toolPlan = this.buildToolPlanMetadata(userRole, userTier);
      const orchestration = this.getOrchestrationConfig();

      // Build image payloads for streaming (vision support)
      const streamImages = this.buildImagePayloads(params.attachments, params.images);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          scope: scope,
          service_type: params.serviceType || (params.ocrMode ? 'image_analysis' : 'chat_message'),
          payload: {
            prompt: params.promptText,
            context: params.context || undefined,
            images: streamImages.length > 0 ? streamImages : undefined,
            ocr_mode: params.ocrMode || undefined,
            ocr_task: params.ocrTask || undefined,
            ocr_response_format: params.ocrResponseFormat || undefined,
            model: params.model || undefined,
          },
          stream: true,
          enable_tools: true,
          client_tools: clientToolDefs,
          metadata: {
            role: userRole, // Use actual role, not default to teacher
            model: params.model || undefined,
            trace_id: traceId,
            tool_plan: toolPlan,
            orchestration_mode: orchestration.orchestration_mode,
            loop_budget: orchestration.loop_budget,
            confidence_threshold: orchestration.confidence_threshold,
          }
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Streaming failed: ${response.status}`);
      }
      
      // React Native fetch may expose a ReadableStream but its implementation
      // can be incomplete (RN 0.79+). Always use the full-text fallback on mobile
      // to avoid partial-stream bugs. On web, use the streaming ReadableStream path.
      const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
      const canStreamNatively = !isReactNative && response.body && typeof response.body.getReader === 'function';
      if (!canStreamNatively) {
        console.warn('[DashAIClient] Streaming not supported in this environment, parsing SSE from full response');
        const sseText = await response.text();
        
        // Parse SSE format to extract content_block_delta text chunks
        let accumulated = '';
        const lines = sseText.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                // Capture first token time
                if (firstTokenTime === null) {
                  firstTokenTime = Date.now();
                }
                tokenCount++;
                accumulated += parsed.delta.text;
                onChunk(parsed.delta.text); // Send only the clean text
              }
            } catch {
              console.warn('[DashAIClient] Failed to parse SSE line:', line.substring(0, 100));
            }
          }
        }
        
        if (__DEV__) {
          console.log('[DashAIClient] SSE fallback parsed, accumulated length:', accumulated.length);
        }
        
        // Emit performance metrics (production only)
        // Reference: https://posthog.com/docs/libraries/react-native
        if (!__DEV__ && firstTokenTime !== null) {
          const totalDuration = Date.now() - startTime;
          const firstTokenLatency = firstTokenTime - startTime;
          
          // PostHog event tracking
          try {
            // Note: PostHog instance should be imported and initialized
            // For now, we log the metrics. Integration with PostHog will be done separately.
            console.log('[DashAIClient] Performance metrics:', {
              first_token_ms: firstTokenLatency,
              total_duration_ms: totalDuration,
              token_count: tokenCount,
              platform: 'react-native',
            });
          } catch (error) {
            console.error('[DashAIClient] Failed to emit metrics:', error);
          }
        }
        
        return {
          content: accumulated || 'No content extracted from SSE stream',
          metadata: {},
        };
      }
      
      // Parse SSE stream (web environment)
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulated = '';
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                // Capture first token time
                if (firstTokenTime === null) {
                  firstTokenTime = Date.now();
                }
                tokenCount++;
                accumulated += parsed.delta.text;
                onChunk(parsed.delta.text);
              }
            } catch (e) {
              console.warn('[DashAIClient] Failed to parse SSE chunk:', e);
            }
          }
        }
      }
      
      // Process any remaining data left in the buffer after the stream ends
      if (buffer.trim()) {
        const remainingLine = buffer.trim();
        if (remainingLine.startsWith('data: ')) {
          const data = remainingLine.slice(6).trim();
          if (data !== '[DONE]') {
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                if (firstTokenTime === null) {
                  firstTokenTime = Date.now();
                }
                tokenCount++;
                accumulated += parsed.delta.text;
                onChunk(parsed.delta.text);
              }
            } catch (e) {
              console.warn('[DashAIClient] Failed to parse remaining SSE buffer:', e);
            }
          }
        }
      }
      
      // Emit performance metrics (production only)
      if (!__DEV__ && firstTokenTime !== null) {
        const totalDuration = Date.now() - startTime;
        const firstTokenLatency = firstTokenTime - startTime;
        
        try {
          console.log('[DashAIClient] Performance metrics:', {
            first_token_ms: firstTokenLatency,
            total_duration_ms: totalDuration,
            token_count: tokenCount,
            platform: 'web',
          });
        } catch (error) {
          console.error('[DashAIClient] Failed to emit metrics:', error);
        }
      }

      return {
        content: accumulated,
        metadata: {},
      };
    } catch (error) {
      console.error('[DashAIClient] Streaming failed:', error);
      throw error;
    }
  }

  /**
   * Call AI service with WebSocket streaming (React Native)
   * 
   * Feature flag controlled: EXPO_PUBLIC_USE_WEBSOCKET_STREAMING=true
   * 
   * References:
   * - React Native WebSocket (0.79): https://reactnative.dev/docs/0.79/network#websocket-support
   * - Supabase auth getSession: https://supabase.com/docs/reference/javascript/auth-getsession
   */
  private async callAIServiceStreamingWS(params: any, onChunk: (chunk: string) => void): Promise<AIServiceResponse> {
    // Performance instrumentation
    const startTime = Date.now();
    let firstTokenTime: number | null = null;
    let tokenCount = 0;

    // Get auth token before creating Promise
    const { data: sessionData } = await this.supabaseClient.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    
    if (!accessToken) {
      throw new Error('No auth session for WebSocket streaming');
    }
    
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('EXPO_PUBLIC_SUPABASE_URL not configured');
    }

    return new Promise((resolve, reject) => {
      try {
        // Build WebSocket URL
        const wsUrl = `${supabaseUrl.replace('https', 'wss')}/functions/v1/ai-proxy-ws`;
        const profile = this.getUserProfile() as any;
        const { role, scope } = this.normalizeRoleAndScope(profile?.role || 'teacher');
        const userTier = this.resolveUserTier(profile);
        const traceId = this.createTraceId('dash_ai_ws');
        const toolPlan = this.buildToolPlanMetadata(role, userTier);
        const clientTools = this.getClientToolDefs(role, userTier);
        const orchestration = this.getOrchestrationConfig();
        
        // Create WebSocket connection
        // Reference: https://reactnative.dev/docs/0.79/network#websocket-support
        const ws = new WebSocket(wsUrl);
        let accumulated = '';
        let hasError = false;
        
        ws.onopen = () => {
          // Send request payload
          const payload = {
            scope,
            service_type: params.serviceType || (params.ocrMode ? 'image_analysis' : 'chat_message'),
            payload: {
              prompt: params.promptText,
              context: params.context || undefined,
              ocr_mode: params.ocrMode || undefined,
              ocr_task: params.ocrTask || undefined,
              ocr_response_format: params.ocrResponseFormat || undefined,
              model: params.model || undefined,
            },
            enable_tools: true,
            client_tools: clientTools,
            metadata: {
              role,
              model: params.model || undefined,
              trace_id: traceId,
              tool_plan: toolPlan,
              orchestration_mode: orchestration.orchestration_mode,
              loop_budget: orchestration.loop_budget,
              confidence_threshold: orchestration.confidence_threshold,
            }
          };
          
          ws.send(JSON.stringify(payload));
        };
        
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            
            if (msg.type === 'start') {
              // Stream started
              if (__DEV__) {
                console.log('[DashAIClient] WebSocket stream started');
              }
            } else if (msg.type === 'delta' && msg.text) {
              // Capture first token time
              if (firstTokenTime === null) {
                firstTokenTime = Date.now();
              }
              tokenCount++;
              accumulated += msg.text;
              onChunk(msg.text);
            } else if (msg.type === 'done') {
              // Stream completed
              ws.close();
              
              // Emit performance metrics (production only)
              if (!__DEV__ && firstTokenTime !== null) {
                const totalDuration = Date.now() - startTime;
                const firstTokenLatency = firstTokenTime - startTime;
                
                try {
                  console.log('[DashAIClient] Performance metrics (WS):', {
                    first_token_ms: firstTokenLatency,
                    total_duration_ms: totalDuration,
                    token_count: tokenCount,
                    platform: 'react-native-ws',
                  });
                } catch (error) {
                  console.error('[DashAIClient] Failed to emit metrics:', error);
                }
              }
              
              resolve({
                content: accumulated || 'No content received from WebSocket stream',
                metadata: {},
              });
            } else if (msg.type === 'error') {
              hasError = true;
              reject(new Error(msg.message || 'WebSocket streaming error'));
            } else if (msg.type === 'cancelled') {
              hasError = true;
              reject(new Error('Stream cancelled'));
            }
          } catch (e) {
            console.error('[DashAIClient] Failed to parse WebSocket message:', e);
          }
        };
        
        ws.onerror = (error) => {
          if (!hasError) {
            hasError = true;
            console.error('[DashAIClient] WebSocket error:', error);
            reject(new Error('WebSocket connection error'));
          }
        };
        
        ws.onclose = (event) => {
          if (__DEV__) {
            console.log('[DashAIClient] WebSocket closed:', event.code, event.reason);
          }
          if (!hasError && accumulated.length === 0) {
            reject(new Error('WebSocket closed without receiving data'));
          }
        };
        
      } catch (error) {
        reject(error);
      }
    });
  }
}

export default DashAIClient;
