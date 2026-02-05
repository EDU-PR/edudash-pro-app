/**
 * useDashAI Hook
 * 
 * Manages AI client, model selection, prompt building, and quota checking.
 * Handles streaming responses and context management.
 * 
 * Extracted from useDashAssistant.ts for WARP.md compliance (≤300 lines)
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { Alert } from 'react-native';
import type { DashMessage } from '@/services/dash-ai/types';
import type { DashAIClient } from '@/services/dash-ai/DashAIClient';
import type { AIModelId } from '@/lib/ai/models';
import { useAIModelSelection } from '@/hooks/useAIModelSelection';
import { checkAIQuota, showQuotaExceededAlert } from '@/lib/ai/guards';
import type { AIQuotaFeature } from '@/lib/ai/limits';
import { buildIntelligentSystemPrompt } from '@/lib/dash-ai/promptBuilder';
import type { LearnerContext } from '@/lib/dash-ai/learnerContext';
import { logger } from '@/lib/logger';
import { track } from '@/lib/analytics';

export interface UseDashAIReturn {
  // State
  isLoading: boolean;
  loadingStatus: 'uploading' | 'analyzing' | 'thinking' | 'responding' | null;
  selectedModel: AIModelId | null;
  
  // Actions
  sendMessage: (
    content: string,
    options?: {
      attachments?: any[];
      context?: LearnerContext;
      onStream?: (chunk: string) => void;
    }
  ) => Promise<string | null>;
  setSelectedModel: (model: AIModelId) => void;
  checkQuota: (feature: AIQuotaFeature) => Promise<boolean>;
  
  // Instance
  dashInstance: DashAIClient | null;
  initializeDash: () => Promise<DashAIClient | null>;
}

interface UseDashAIOptions {
  userId?: string;
  profile?: any;
  tier?: string;
  conversationId?: string;
}

export function useDashAI(options: UseDashAIOptions): UseDashAIReturn {
  const { userId, profile, tier, conversationId } = options;
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<'uploading' | 'analyzing' | 'thinking' | 'responding' | null>(null);
  const [dashInstance, setDashInstance] = useState<DashAIClient | null>(null);
  
  const { selectedModel, setSelectedModel } = useAIModelSelection();
  
  // Memoize system prompt to avoid rebuilding on every render
  const systemPromptCache = useRef<Map<string, string>>(new Map());

  /**
   * Get or build system prompt with caching
   */
  const getSystemPrompt = useCallback((context?: LearnerContext): string => {
    const cacheKey = JSON.stringify({
      userId,
      role: profile?.role,
      grade: context?.grade,
      subject: context?.subject || context?.subjects?.[0],
    });
    
    if (systemPromptCache.current.has(cacheKey)) {
      return systemPromptCache.current.get(cacheKey)!;
    }
    
    const prompt = buildIntelligentSystemPrompt({ learner: context });
    systemPromptCache.current.set(cacheKey, prompt);
    
    // Limit cache size to 10 entries
    if (systemPromptCache.current.size > 10) {
      const firstKey = systemPromptCache.current.keys().next().value;
      systemPromptCache.current.delete(firstKey);
    }
    
    return prompt;
  }, [userId, profile]);

  /**
   * Check AI quota before sending message
   */
  const checkQuota = useCallback(async (feature: AIQuotaFeature): Promise<boolean> => {
    if (!userId || !profile) return false;
    
    try {
      const quotaCheck = await checkAIQuota(feature, userId);
      if (!quotaCheck.allowed) {
        showQuotaExceededAlert(feature, quotaCheck.quotaInfo);
      }
      return quotaCheck.allowed;
    } catch (error) {
      logger.error('[DashAI] Quota check failed', { error });
      return false;
    }
  }, [userId, profile, tier]);

  /**
   * Initialize Dash AI instance (lazy loaded)
   */
  const initializeDash = useCallback(async (): Promise<DashAIClient | null> => {
    if (dashInstance) return dashInstance;
    
    try {
      // Lazy import AI client to reduce initial bundle size
      const { DashAIClient } = await import('@/services/dash-ai/DashAIClient');
      const { assertSupabase } = await import('@/lib/supabase');
      
      const supabase = assertSupabase();
      const instance = new DashAIClient({
        supabaseClient: supabase,
        getUserProfile: () => profile,
      });
      
      setDashInstance(instance);
      logger.info('[DashAI] Instance initialized');
      return instance;
    } catch (error) {
      logger.error('[DashAI] Failed to initialize', { error });
      Alert.alert('Error', 'Failed to initialize AI assistant. Please try again.');
      return null;
    }
  }, [dashInstance, profile]);

  /**
   * Send message to AI
   */
  const sendMessage = useCallback(async (
    content: string,
    options?: {
      attachments?: any[];
      context?: LearnerContext;
      onStream?: (chunk: string) => void;
    }
  ): Promise<string | null> => {
    const instance = dashInstance || (await initializeDash());
    if (!instance) return null;
    
    // Check quota
    const hasQuota = await checkQuota('homework_help');
    if (!hasQuota) return null;
    
    setIsLoading(true);
    setLoadingStatus('thinking');
    
    try {
      const systemPrompt = getSystemPrompt(options?.context);
      
      // Track analytics
      track('dash_ai_message_sent', {
        userId,
        model: selectedModel,
        hasAttachments: options?.attachments && options.attachments.length > 0,
        conversationId,
      });
      
      // Call AI service
      const startTime = Date.now();
      let response = '';
      
      // TODO: Implement actual AI call with streaming
      // For now, return placeholder
      response = 'AI response placeholder';
      
      if (options?.onStream) {
        // Simulate streaming for demo
        for (const chunk of response.split(' ')) {
          options.onStream(chunk + ' ');
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      const duration = Date.now() - startTime;
      
      track('dash_ai_response_received', {
        userId,
        model: selectedModel,
        duration,
        responseLength: response.length,
      });
      
      logger.info('[DashAI] Message sent', {
        model: selectedModel,
        duration,
        responseLength: response.length,
      });
      
      return response;
    } catch (error) {
      logger.error('[DashAI] Failed to send message', { error });
      Alert.alert('Error', 'Failed to send message. Please try again.');
      return null;
    } finally {
      setIsLoading(false);
      setLoadingStatus(null);
    }
  }, [
    dashInstance,
    initializeDash,
    checkQuota,
    getSystemPrompt,
    selectedModel,
    userId,
    conversationId,
  ]);

  return {
    isLoading,
    loadingStatus,
    selectedModel,
    sendMessage,
    setSelectedModel,
    checkQuota,
    dashInstance,
    initializeDash,
  };
}
