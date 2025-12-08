/**
 * AI Proxy Edge Function - Refactored
 * 
 * Thin orchestration layer (≤200 lines)
 * 
 * Flow:
 * 1. Validate auth → 2. Check quota → 3. Redact PII → 4. Select model
 * 5. Call Claude → 6. Handle tools/streaming → 7. Log usage → 8. Return
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// Security
import { validateAuth } from './security/auth-validator.ts'
import { checkQuota, logUsage } from './security/quota-checker.ts'
import { redactPII } from './security/pii-redactor.ts'

// AI Client
import { selectModelForTier } from './ai-client/model-selector.ts'
import { callClaude } from './ai-client/anthropic-client.ts'

// Tools
import { getToolsForRole } from './tools/tool-registry.ts'

// Utilities
import { getCorsHeaders, handlePreflight, createErrorResponse, createSuccessResponse } from './utils/cors.ts'
import { createStreamingResponse } from './utils/streaming-handler.ts'
import { handleToolExecution } from './utils/tool-handler.ts'
import { aiRequestQueue, isRateLimitError, getRetryAfter } from './utils/request-queue.ts'

import type { AIProxyRequest, ToolContext, SubscriptionTier } from './types.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const ANTHROPIC_API_KEY_2 = Deno.env.get('ANTHROPIC_API_KEY_2')
const ZAI_API_KEY = Deno.env.get('ZAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Load balancer state for Anthropic keys
let anthropicKeyIndex = 0

/**
 * Get next Anthropic API key using round-robin load balancing
 */
function getAnthropicApiKey(): { key: string; keyName: string } {
  const keys = [
    { key: ANTHROPIC_API_KEY, name: 'anthropic_1' },
    { key: ANTHROPIC_API_KEY_2, name: 'anthropic_2' }
  ].filter(k => k.key) // Only include keys that are set

  if (keys.length === 0) {
    throw new Error('No Anthropic API keys configured')
  }

  // Round-robin: cycle through available keys
  const selected = keys[anthropicKeyIndex % keys.length]
  anthropicKeyIndex++
  
  return { key: selected.key!, keyName: selected.name }
}

// Log startup configuration (once)
console.log('[ai-proxy] Edge function starting up...')
console.log('[ai-proxy] Configuration check:', {
  hasAnthropicKey1: !!ANTHROPIC_API_KEY,
  hasAnthropicKey2: !!ANTHROPIC_API_KEY_2,
  hasZaiKey: !!ZAI_API_KEY,
  hasSupabaseUrl: !!SUPABASE_URL,
  hasServiceRoleKey: !!SUPABASE_SERVICE_ROLE_KEY,
  anthropicKey1Length: ANTHROPIC_API_KEY?.length || 0,
  anthropicKey2Length: ANTHROPIC_API_KEY_2?.length || 0,
  zaiKeyLength: ZAI_API_KEY?.length || 0,
  loadBalancing: `${[ANTHROPIC_API_KEY, ANTHROPIC_API_KEY_2].filter(k => k).length} Anthropic keys available`
})

serve(async (req: Request): Promise<Response> => {
  const requestId = crypto.randomUUID().substring(0, 8)
  console.log(`[ai-proxy:${requestId}] Incoming ${req.method} request from ${req.headers.get('origin') || 'unknown'}`)
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    console.log(`[ai-proxy:${requestId}] Handling CORS preflight`)
    return handlePreflight()
  }
  
  // Special endpoint to check queue status (for monitoring)
  if (req.method === 'GET' && req.url.includes('/health')) {
    const queueStatus = aiRequestQueue.getStatus();
    return new Response(JSON.stringify({
      status: 'healthy',
      queue: queueStatus,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' }
    });
  }
  
  if (req.method !== 'POST') {
    console.log(`[ai-proxy:${requestId}] Invalid method: ${req.method}`)
    return createErrorResponse('method_not_allowed', 'Only POST requests allowed', 405)
  }

  try {
    // Validate that at least one Anthropic key is configured
    if (!ANTHROPIC_API_KEY && !ANTHROPIC_API_KEY_2) {
      console.error(`[ai-proxy:${requestId}] CRITICAL: No Anthropic API keys configured`)
      return createErrorResponse('configuration_error', 'AI service is not configured (no Anthropic keys available)', 500)
    }
    
    console.log(`[ai-proxy:${requestId}] Starting request processing...`)
    // Parse and validate request
    let body: AIProxyRequest
    try {
      body = await req.json()
      console.log(`[ai-proxy:${requestId}] Request parsed:`, {
        scope: body.scope,
        service_type: body.service_type,
        enable_tools: body.enable_tools,
        stream: body.stream,
        hasPayload: !!body.payload,
        promptLength: body.payload?.prompt?.length || 0
      })
    } catch (parseError) {
      console.error(`[ai-proxy:${requestId}] JSON parse error:`, parseError)
      return createErrorResponse('invalid_json', 'Invalid JSON in request body', 400)
    }
    
    const { scope, payload, metadata = {}, stream = false, enable_tools = false, tool_choice } = body
    
    const VALID_TYPES = ['lesson_generation', 'homework_help', 'grading_assistance', 'general', 'dash_conversation', 'conversation']
    const service_type = body.service_type && VALID_TYPES.includes(body.service_type as string) 
      ? body.service_type 
      : 'dash_conversation'

    if (!scope || !service_type || !payload?.prompt) {
      return createErrorResponse('invalid_request', 'Missing required fields', 400)
    }

    // Initialize Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Authenticate
    const auth = await validateAuth(req.headers.get('Authorization'), supabase)
    console.log(`[ai-proxy:${requestId}] Auth result:`, { valid: auth.valid, hasUser: !!auth.user, hasProfile: !!auth.profile, error: auth.error })
    if (!auth.valid || !auth.user) {
      console.error(`[ai-proxy:${requestId}] Auth failed:`, auth.error)
      return createErrorResponse('unauthorized', 'Authentication failed', 401)
    }

    // Extract context
    const { user, profile } = auth
    console.log(`[ai-proxy:${requestId}] User context:`, { 
      userId: user.id, 
      email: user.email,
      hasProfile: !!profile,
      role: profile?.role,
      orgId: profile?.organization_id || profile?.preschool_id,
      subscriptionTier: profile?.subscription_tier,
      // User-level trial fields
      isTrial: profile?.is_trial,
      trialEndDate: profile?.trial_end_date,
      trialPlanTier: profile?.trial_plan_tier,
      // Org-level trial fields (legacy)
      trialEndsAt: profile?.trial_ends_at
    })
    const organizationId = profile?.organization_id || profile?.preschool_id || null
    
    // Determine effective tier (handle both org-level and user-level trials)
    let tier: string = 'free' // Default to free if no tier found
    
    try {
      // Check user-level trial (new system - for independent users)
      if (profile?.is_trial === true && profile?.trial_end_date) {
        const trialEndDate = new Date(profile.trial_end_date)
        const now = new Date()
        const trialExpired = trialEndDate < now
        
        if (trialExpired) {
          console.warn(`[ai-proxy:${requestId}] User trial expired on ${profile.trial_end_date}, using free tier`)
          tier = 'free'
        } else {
          // Active user trial - grant premium access
          const trialTier = profile?.trial_plan_tier?.toLowerCase() || 'premium'
          console.log(`[ai-proxy:${requestId}] Active user trial until ${profile.trial_end_date}, tier: ${trialTier}`)
          tier = trialTier
        }
      }
      // Check org-level trial (legacy system)
      else if (profile?.trial_ends_at) {
        const trialEndDate = new Date(profile.trial_ends_at)
        const now = new Date()
        const trialExpired = trialEndDate < now
        
        if (trialExpired) {
          console.warn(`[ai-proxy:${requestId}] Org trial expired on ${profile.trial_ends_at}, downgrading to free tier`)
          tier = 'free'
        } else {
          // Active org trial - use the tier from profile
          console.log(`[ai-proxy:${requestId}] Active org trial until ${profile.trial_ends_at}`)
          tier = profile?.subscription_tier || 'premium'
        }
      }
    } catch (tierError) {
      console.error(`[ai-proxy:${requestId}] Error determining tier:`, tierError)
      tier = 'free'
    }
    
    console.log(`[ai-proxy:${requestId}] Effective tier from trials/profile:`, tier)
    
    const role = profile?.role || metadata.role || scope
    const hasOrganization = !!organizationId
    const isGuest = !user.email_confirmed_at
    const startTime = Date.now()

    // Check quota (tier will be fetched from user_ai_usage if not provided)
    console.log(`[ai-proxy:${requestId}] Checking quota for user ${user.id}, service: ${service_type}, tier: ${tier || '(auto-detect)'}`)
    const quota = await checkQuota(supabase, user.id, organizationId, service_type, tier)
    console.log(`[ai-proxy:${requestId}] Quota check result:`, { allowed: quota.allowed, quotaInfo: quota.quotaInfo, error: quota.error })
    if (!quota.allowed) {
      console.warn(`[ai-proxy:${requestId}] Quota exceeded for ${service_type}`)
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'quota_exceeded', message: 'AI quota exceeded', quota_info: quota.quotaInfo }
      }), {
        status: 429,
        headers: { ...getCorsHeaders(), 'Content-Type': 'application/json', 'Retry-After': '3600' }
      })
    }

    // Redact PII
    const { redactedText, redactionCount } = redactPII(payload.prompt)

    // Get AI configuration (using hardcoded fallback for now)
    const hasImages = !!(payload.images && payload.images.length > 0)
    console.log(`[ai-proxy:${requestId}] Model selection:`, { service_type, tier, hasImages })
    
    // Use model selector to determine appropriate Claude model
    const model = selectModelForTier(tier as SubscriptionTier, hasImages)
    
    console.log(`[ai-proxy:${requestId}] Final provider/model:`, { provider: 'claude', model, hasImages })

    // Load tools if enabled
    const tools = enable_tools ? getToolsForRole(role, tier) : undefined
    if (tools) {
      console.log(`[ai-proxy] Loaded ${tools.length} tools for role: ${role}, tier: ${tier}`)
      console.log(`[ai-proxy] Available tools:`, tools.map(t => t.name))
    } else if (enable_tools) {
      console.warn(`[ai-proxy] Tools enabled but none loaded for role: ${role}, tier: ${tier}`)
    }

    // Build tool context
    const toolContext: ToolContext = {
      supabaseAdmin: supabase,
      userId: user.id,
      organizationId,
      role,
      tier,
      hasOrganization,
      isGuest
    }

    // Track which Anthropic key is used (needed for error handling)
    let anthropicKeyName = 'unknown';
    let anthropicKey = '';

    try {
      // Use Claude with load-balanced API key
      // Use request queue to prevent rate limiting from concurrent requests
      const apiKeySelection = getAnthropicApiKey();
      anthropicKey = apiKeySelection.key;
      anthropicKeyName = apiKeySelection.keyName;
      console.log(`[ai-proxy:${requestId}] Using ${anthropicKeyName}. Enqueuing request to Claude. Queue status before:`, aiRequestQueue.getStatus());
      
      const result = await aiRequestQueue.enqueue(() => callClaude({
        apiKey: anthropicKey,
        model,
        prompt: redactedText,
        images: payload.images,
        conversationHistory: payload.conversationHistory, // Pass conversation history
        stream,
        tools,
        tool_choice,
        maxTokens: hasImages ? 1536 : 4096
      }));

      console.log(`[ai-proxy:${requestId}] Request completed using ${anthropicKeyName}. Queue status after:`, aiRequestQueue.getStatus());

      // Handle streaming
      if (stream && result.response) {
        return createStreamingResponse(result.response, result.model, {
          supabaseAdmin: supabase,
          userId: user.id,
          organizationId,
          serviceType: service_type,
          inputText: redactedText,
          metadata,
          scope,
          tier,
          hasImages,
          imageCount: payload.images?.length || 0,
          redactionCount,
          startTime
        })
      }

      // Handle tool use
      if (result.tool_use && result.tool_use.length > 0) {
        return handleToolExecution(result, toolContext, {
          apiKey: anthropicKey,
          originalPrompt: redactedText,
          tier,
          hasImages,
          images: payload.images,
          availableTools: tools
        }, {
          supabaseAdmin: supabase,
          userId: user.id,
          organizationId,
          serviceType: service_type,
          metadata,
          scope,
          redactionCount,
          startTime
        })
      }

      // Log usage
      await logUsage(supabase, {
        userId: user.id,
        organizationId,
        serviceType: service_type,
        model: result.model,
        status: 'success',
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        cost: result.cost,
        processingTimeMs: Date.now() - startTime,
        inputText: redactedText,
        outputText: result.content,
        metadata: { ...metadata, scope, tier, has_images: hasImages, image_count: payload.images?.length || 0, redaction_count: redactionCount, api_key_used: anthropicKeyName }
      })

      // Return response
      return createSuccessResponse({
        content: result.content,
        usage: { tokens_in: result.tokensIn, tokens_out: result.tokensOut, cost: result.cost }
      })

    } catch (aiError) {
      console.error('[ai-proxy] Claude API error:', aiError)
      console.error('[ai-proxy] Error details:', {
        message: (aiError as Error).message,
        stack: (aiError as Error).stack,
        model,
        hasTools: !!tools,
        toolCount: tools?.length || 0,
        promptLength: redactedText.length,
        hasImages
      })

      // Log error
      await logUsage(supabase, {
        userId: user.id,
        organizationId,
        serviceType: service_type,
        model,
        status: 'error',
        tokensIn: 0,
        tokensOut: 0,
        cost: 0,
        processingTimeMs: Date.now() - startTime,
        errorMessage: (aiError as Error).message,
        inputText: redactedText,
        metadata: { ...metadata, scope, error: (aiError as Error).message, error_stack: (aiError as Error).stack, redaction_count: redactionCount }
      })

      // Handle rate limit and quota errors - try alternate Anthropic key if available
      const errorMessage = (aiError as Error).message || '';
      const isQuotaError = errorMessage.includes('usage limits') || errorMessage.includes('quota');
      const isRateLimit = isRateLimitError(aiError);
      
      if (isRateLimit || isQuotaError) {
        const retryMs = isRateLimit ? getRetryAfter(aiError) : 0;
        const retrySeconds = Math.ceil(retryMs / 1000);
        
        if (isQuotaError) {
          console.warn(`[ai-proxy:${requestId}] Claude quota exceeded for ${anthropicKeyName}.`);
        } else {
          console.warn(`[ai-proxy:${requestId}] Rate limit hit on ${anthropicKeyName}. Retry after ${retrySeconds}s`);
          console.warn(`[ai-proxy:${requestId}] Queue status:`, aiRequestQueue.getStatus());
        }
        
        // Try alternate Anthropic key if we have 2 keys configured
        const hasAlternateKey = ANTHROPIC_API_KEY && ANTHROPIC_API_KEY_2;
        if (hasAlternateKey && !stream && !tools) {
          console.log(`[ai-proxy:${requestId}] Attempting retry with alternate Anthropic key...`);
          
          try {
            // Get the OTHER Anthropic key (not the one that just failed)
            const { key: alternateKey, keyName: alternateKeyName } = getAnthropicApiKey();
            console.log(`[ai-proxy:${requestId}] Retrying with ${alternateKeyName}`);
            
            const fallbackResult = await callClaude({
              apiKey: alternateKey,
              model,
              prompt: redactedText,
              images: payload.images,
              conversationHistory: payload.conversationHistory,
              stream: false,
              tools: undefined, // Disable tools on retry to simplify
              maxTokens: hasImages ? 1536 : 4096
            });
            
            console.log(`[ai-proxy:${requestId}] Retry with ${alternateKeyName} succeeded`);
            
            // Log usage with fallback indicator
            await logUsage(supabase, {
              userId: user.id,
              organizationId,
              serviceType: service_type,
              model: `${fallbackResult.model} (retry)`,
              status: 'success',
              tokensIn: fallbackResult.tokensIn,
              tokensOut: fallbackResult.tokensOut,
              cost: fallbackResult.cost,
              processingTimeMs: Date.now() - startTime,
              inputText: redactedText,
              outputText: fallbackResult.content,
              metadata: { 
                ...metadata, 
                scope, 
                tier, 
                has_images: hasImages, 
                image_count: payload.images?.length || 0, 
                redaction_count: redactionCount,
                retry_key: alternateKeyName,
                original_key: anthropicKeyName,
                original_error: isQuotaError ? 'anthropic_quota_exceeded' : 'anthropic_rate_limit'
              }
            });
            
            // Return retry response
            return createSuccessResponse({
              content: fallbackResult.content,
              usage: { 
                tokens_in: fallbackResult.tokensIn, 
                tokens_out: fallbackResult.tokensOut, 
                cost: fallbackResult.cost 
              }
            });
            
          } catch (fallbackError) {
            console.error(`[ai-proxy:${requestId}] Alternate key retry also failed:`, fallbackError);
            // Continue to return rate limit error below
          }
        } else {
          if (!hasAlternateKey) {
            console.log(`[ai-proxy:${requestId}] No alternate Anthropic key available for retry`);
          } else if (stream) {
            console.log(`[ai-proxy:${requestId}] Retry not available for streaming requests`);
          } else if (tools) {
            console.log(`[ai-proxy:${requestId}] Retry not available for tool-calling requests`);
          }
        }
        
        // Return rate limit error if retry didn't work
        return new Response(JSON.stringify({
          success: false,
          error: { 
            code: 'rate_limit', 
            message: `Rate limit exceeded. Please retry in ${retrySeconds} seconds.`,
            retry_after: retrySeconds,
            queue_status: aiRequestQueue.getStatus() // Include queue info for debugging
          }
        }), {
          status: 429,
          headers: { 
            ...getCorsHeaders(), 
            'Content-Type': 'application/json', 
            'Retry-After': String(retrySeconds)
          }
        });
      }

      // Return more specific error
      const finalErrorMsg = (aiError as Error).message
      if (finalErrorMsg.includes('timeout') || finalErrorMsg.includes('ETIMEDOUT')) {
        return createErrorResponse('timeout', 'Request timed out. Please try again with a simpler request.', 504)
      }
      if (finalErrorMsg.includes('API key')) {
        return createErrorResponse('configuration_error', 'AI service configuration error', 500)
      }

      return createErrorResponse('ai_service_error', `AI service error: ${finalErrorMsg.substring(0, 100)}`, 503)
    }

  } catch (error) {
    console.error(`[ai-proxy:${requestId}] Unhandled error:`, error)
    console.error(`[ai-proxy:${requestId}] Error stack:`, (error as Error).stack)
    return createErrorResponse('internal_error', `Internal server error: ${(error as Error).message}`, 500)
  }
})

console.log('[ai-proxy] Edge function ready and listening for requests')
