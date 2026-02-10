/**
 * AI Assistant chat — calls Edge Function with superadmin-ai / ai-proxy fallback
 */

import type { RefObject } from 'react';
import type { ScrollView } from 'react-native';
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { ChatMessage } from '@/lib/screen-styles/super-admin-ai-command-center.styles';
import { detectOCRTask, getOCRPromptForTask, isOCRIntent } from '@/lib/dash-ai/ocrPrompts';
import type { SetState } from './types';

export interface SendAssistantParams {
  message: string;
  chatHistory: ChatMessage[];
  setChatHistory: SetState<ChatMessage[]>;
  setAssistantMessage: SetState<string>;
  setAssistantLoading: SetState<boolean>;
  chatScrollRef: RefObject<ScrollView | null>;
}

function parseAiProxyContent(payload: any): string {
  if (typeof payload?.content === 'string') return payload.content;
  if (Array.isArray(payload?.content) && payload.content[0]?.text) return payload.content[0].text;
  if (typeof payload?.message?.content === 'string') return payload.message.content;
  if (typeof payload?.text === 'string') return payload.text;
  if (typeof payload?.response === 'string') return payload.response;
  return 'I received a response but could not parse it.';
}

export async function sendAssistantMessage(params: SendAssistantParams): Promise<void> {
  const { message, chatHistory, setChatHistory, setAssistantMessage, setAssistantLoading, chatScrollRef } = params;
  if (!message.trim()) return;

  const userMessage: ChatMessage = {
    role: 'user',
    content: message,
    timestamp: new Date().toISOString(),
  };

  setChatHistory(prev => [...prev, userMessage]);
  setAssistantMessage('');
  setAssistantLoading(true);
  setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);

  try {
    const supabase = assertSupabase();
    const session = (await supabase.auth.getSession()).data.session;
    if (!session?.access_token) throw new Error('No session');

    const traceId = `super_admin_ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const superAdminEndpoint = `${baseUrl}/functions/v1/superadmin-ai`;
    const aiProxyEndpoint = `${baseUrl}/functions/v1/ai-proxy`;

    const invoke = async (
      endpoint: string,
      body: Record<string, unknown>,
    ): Promise<{ ok: boolean; status: number; data: any }> => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, data };
    };

    const superAdminBody = { action: 'chat', message: userMessage.content };
    const detectedOCRTask = detectOCRTask(userMessage.content);
    const ocrMode = isOCRIntent(userMessage.content) || detectedOCRTask !== null;
    const aiProxyBody = {
      scope: 'admin',
      service_type: ocrMode ? 'image_analysis' : 'chat_message',
      payload: {
        prompt: userMessage.content,
        context: ocrMode ? getOCRPromptForTask(detectedOCRTask || 'document') : undefined,
        messages: chatHistory.slice(-8).map(m => ({ role: m.role, content: m.content })),
        ocr_mode: ocrMode || undefined,
        ocr_task: ocrMode ? (detectedOCRTask || 'document') : undefined,
        ocr_response_format: ocrMode ? 'json' : undefined,
      },
      stream: false,
      enable_tools: true,
      metadata: {
        role: 'super_admin',
        source: 'super_admin_command_center',
        ocr_mode: ocrMode,
        ocr_task: ocrMode ? (detectedOCRTask || 'document') : undefined,
        trace_id: traceId,
        tool_plan: {
          source: 'super_admin_command_center.sendToAssistant',
          history_count: chatHistory.length,
        },
      },
    };

    let mode: 'superadmin' | 'ai_proxy' = 'superadmin';
    let result = await invoke(superAdminEndpoint, superAdminBody);

    if (!result.ok) {
      const msg = String(result.data?.error || result.data?.message || `AI request failed: ${result.status}`);
      const lower = msg.toLowerCase();
      const fallback = result.status === 404 || result.status === 502 || result.status === 503
        || lower.includes('function not found') || lower.includes('superadmin-ai') || lower.includes('not deployed');

      if (fallback) {
        logger.warn('[SuperAdminAI] superadmin-ai unavailable, using ai-proxy fallback', {
          status: result.status, message: msg,
        });
        mode = 'ai_proxy';
        result = await invoke(aiProxyEndpoint, aiProxyBody);
      }
    }

    if (!result.ok) {
      throw new Error(result.data?.error || result.data?.message || 'AI request failed');
    }

    const assistantResponse: ChatMessage = {
      role: 'assistant',
      content: mode === 'superadmin' ? String(result.data?.response || '') : parseAiProxyContent(result.data),
      timestamp: new Date().toISOString(),
      tool_calls: result.data?.tool_calls,
    };

    setChatHistory(prev => [...prev, assistantResponse]);
    setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);
  } catch (error) {
    logger.error('AI Assistant error:', error);
    const errorMsg: ChatMessage = {
      role: 'assistant',
      content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
      timestamp: new Date().toISOString(),
    };
    setChatHistory(prev => [...prev, errorMsg]);
  } finally {
    setAssistantLoading(false);
  }
}
