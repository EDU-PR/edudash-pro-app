/**
 * Chat Logic Hook
 * WARP.md compliant: ≤300 lines
 * 
 * Handles message sending, AI proxy calls, conversation management
 */

import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { dashAIThrottler } from '@/lib/dash-ai-throttle';
import type { ChatMessage, SelectedImage, ExamContext } from '@/components/dash-chat/types';

interface UseChatLogicProps {
  conversationId: string;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

export function useChatLogic({ conversationId, messages, setMessages }: UseChatLogicProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [examContext, setExamContext] = useState<ExamContext>({});
  const supabase = createClient();

  // Load conversation from database
  const loadConversation = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('messages')
        .eq('conversation_id', conversationId)
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('New conversation - no existing messages');
          return;
        }
        throw error;
      }

      if (data?.messages) {
        const parsedMessages = (data.messages as any[]).map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        setMessages(parsedMessages);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  }, [conversationId, supabase, setMessages]);

  // Save conversation to database
  const saveConversation = useCallback(async (updatedMessages: ChatMessage[]) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('preschool_id, organization_id')
        .eq('id', userData.user.id)
        .single();

      const preschoolId = profile?.preschool_id || profile?.organization_id || null;

      const { data: existing } = await supabase
        .from('ai_conversations')
        .select('id')
        .eq('conversation_id', conversationId)
        .maybeSingle();

      const conversationData = {
        user_id: userData.user.id,
        preschool_id: preschoolId,
        conversation_id: conversationId,
        title: updatedMessages[0]?.content.substring(0, 50) || 'New Chat',
        messages: updatedMessages,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        await supabase
          .from('ai_conversations')
          .update(conversationData)
          .eq('conversation_id', conversationId);
      } else {
        await supabase
          .from('ai_conversations')
          .insert(conversationData);
      }
    } catch (error) {
      console.error('Error saving conversation:', error);
    }
  }, [conversationId, supabase]);

  // Send message to AI
  const sendMessage = useCallback(async (
    textToSend: string,
    selectedImages: SelectedImage[],
    voiceData?: { blob: Blob; base64: string }
  ) => {
    if (!textToSend && selectedImages.length === 0 && !voiceData) return;

    // Check if request will be queued
    if (dashAIThrottler.wouldWait()) {
      const waitSeconds = Math.ceil(dashAIThrottler.getWaitTime() / 1000);
      const queueMessage: ChatMessage = {
        id: `msg-${Date.now()}-queue`,
        role: 'assistant',
        content: `⏳ Please wait ${waitSeconds} seconds... (Rate limit protection)`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, queueMessage]);
    }

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: textToSend || (voiceData ? '🎤 [Voice message]' : '📷 [Image attached]'),
      timestamp: new Date(),
      images: selectedImages.length > 0 ? selectedImages : undefined,
      audio: voiceData ? { 
        data: voiceData.base64, 
        media_type: 'audio/webm',
        duration: 0 
      } : undefined,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);
    setIsTyping(true);

    try {
      // Build conversation history
      const conversationHistory = newMessages.map((msg) => {
        const hasImages = msg.images && msg.images.length > 0;
        
        if (hasImages) {
          return {
            role: msg.role,
            content: [
              { type: 'text', text: msg.content },
              ...msg.images!.map((img) => ({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: img.media_type,
                  data: img.data,
                },
              })),
            ],
          };
        } else {
          return {
            role: msg.role,
            content: msg.content,
          };
        }
      });

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      // Prepare payload
      const payload: any = {
        prompt: textToSend || userMessage.content,
        conversationHistory: conversationHistory,
        enable_tools: true,
        prefer_openai: true,
        stream: false,
      };

      // Add images if present
      if (selectedImages.length > 0) {
        payload.images = selectedImages.map(img => ({
          data: img.data,
          media_type: img.media_type,
        }));
        payload.image_context = {
          has_images: true,
          image_count: selectedImages.length,
          hint: 'Images uploaded. If extractable as exam/homework material, identify grade/subject/topic and offer curriculum help.',
        };
      }

      // Add voice if present (for future transcription)
      if (voiceData) {
        payload.voice_data = {
          data: voiceData.base64,
          media_type: 'audio/webm',
        };
      }

      const result: any = await dashAIThrottler.enqueue(() =>
        supabase.functions.invoke('ai-proxy', {
          body: {
            scope: 'parent',
            service_type: 'dash_conversation',
            payload,
            metadata: {
              role: 'parent',
              supports_images: true,
              allow_diagrams: true,
            },
          },
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
      );

      const { data, error } = result as any;
      setIsTyping(false);

      // Check for function invocation errors
      if (error || !data) {
        console.error('AI proxy error:', error, 'Response data:', data);

        // Handle specific error types
        if (error?.message?.includes('daily_limit_exceeded')) {
          const dailyLimitMessage: ChatMessage = {
            id: `msg-${Date.now()}-daily-limit`,
            role: 'assistant',
            content: `📊 **Daily Image Limit Reached**\n\nFree tier allows **4 images per day**.\n\n${error.message.includes('remaining') ? error.message : 'You\'ve reached your daily limit. Upgrade to Starter for unlimited image analysis!'}`,
            timestamp: new Date(),
            isError: false,
          };
          setMessages(prev => [...prev, dailyLimitMessage]);
          setIsLoading(false);
          return;
        }

        // Handle 503 Service Unavailable
        if (error?.message?.includes('503') || error?.message?.includes('FunctionsHttpError')) {
          const serviceMessage: ChatMessage = {
            id: `msg-${Date.now()}-service`,
            role: 'assistant',
            content: `⚠️ **AI Service Temporarily Unavailable**\n\nThe AI service is currently experiencing high load or is being updated. Please try again in a moment.\n\nIf this persists, please contact support.`,
            timestamp: new Date(),
            isError: true,
          };
          setMessages(prev => [...prev, serviceMessage]);
          setIsLoading(false);
          return;
        }

        throw error || new Error('Empty response from AI service');
      }

      // Format response
      const rawContent = data?.content || data?.text || 'I apologize, but I received an empty response.';
      const content = formatAssistantContent(String(rawContent));
      const tokensIn = data?.usage?.tokens_in || data?.tokensIn || 0;
      const tokensOut = data?.usage?.tokens_out || data?.tokensOut || 0;

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content,
        timestamp: new Date(),
        meta: {
          tokensUsed: tokensIn + tokensOut,
          model: data?.model || 'unknown',
        },
      };

      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);

      // Check for exam request
      if (detectExamRequest(textToSend)) {
        const context = extractExamContext(textToSend);
        setExamContext(context);

        setTimeout(() => {
          const examBuilderPrompt: ChatMessage = {
            id: `msg-${Date.now()}-prompt`,
            role: 'assistant',
            content: `Would you like me to help you create a structured exam using the interactive exam builder? It provides a step-by-step process with CAPS-aligned questions.`,
            timestamp: new Date(),
          };
          setMessages([...finalMessages, examBuilderPrompt]);
        }, 500);
      }

      await saveConversation(finalMessages);

    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);

      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: formatErrorMessage(error),
        timestamp: new Date(),
        isError: true,
      };

      setMessages([...newMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, setMessages, supabase, saveConversation]);

  return {
    isLoading,
    isTyping,
    examContext,
    setExamContext,
    loadConversation,
    sendMessage,
  };
}

// Helper: Format assistant content
function formatAssistantContent(txt: string): string {
  try {
    const newlineCount = (txt.match(/\n/g) || []).length;
    if (newlineCount >= 2) return txt;
    if (txt.length < 180) return txt;
    
    const withBreaks = txt.replace(/([.?!])\s+(?=[A-Z0-9"])/g, '$1\n\n');
    return withBreaks;
  } catch (e) {
    return txt;
  }
}

// Helper: Detect exam request
function detectExamRequest(text: string): boolean {
  const examKeywords = [
    'exam', 'test', 'practice', 'assessment', 'questions',
    'quiz', 'worksheet', 'revision', 'prepare', 'study'
  ];
  
  const lowerText = text.toLowerCase();
  return examKeywords.some(keyword => lowerText.includes(keyword));
}

// Helper: Extract exam context
function extractExamContext(text: string): ExamContext {
  const lowerText = text.toLowerCase();
  
  let grade: string | undefined;
  const gradeMatch = lowerText.match(/grade\s*(\d+|r)/i);
  if (gradeMatch) {
    const gradeNum = gradeMatch[1];
    grade = gradeNum.toLowerCase() === 'r' ? 'grade_r' : `grade_${gradeNum}`;
  }
  
  let subject: string | undefined;
  const subjects = [
    'mathematics', 'math', 'maths',
    'english', 'home language', 'first additional',
    'physical sciences', 'physics', 'chemistry',
    'life sciences', 'biology',
    'geography', 'history',
    'accounting', 'business', 'economics',
    'life orientation'
  ];
  
  for (const subj of subjects) {
    if (lowerText.includes(subj)) {
      if (subj === 'math' || subj === 'maths') subject = 'Mathematics';
      else if (subj === 'physics' || subj === 'chemistry') subject = 'Physical Sciences';
      else if (subj === 'biology') subject = 'Life Sciences';
      else if (subj === 'business') subject = 'Business Studies';
      else subject = subj.charAt(0).toUpperCase() + subj.slice(1);
      break;
    }
  }
  
  const topics: string[] = [];
  const topicMatch = lowerText.match(/(?:about|on|covering)\s+([a-z\s]+?)(?:\.|,|$)/i);
  if (topicMatch) {
    topics.push(topicMatch[1].trim());
  }
  
  return { grade, subject, topics: topics.length > 0 ? topics : undefined };
}

// Helper: Format error message
function formatErrorMessage(error: any): string {
  let errorContent = '❌ Sorry, I encountered an error. Please try again.';
  
  if (error && typeof error === 'object' && 'message' in error) {
    const errorMsg = String(error.message).toLowerCase();
    
    // Check for Claude API quota limit
    if (errorMsg.includes('workspace api usage limits') || errorMsg.includes('regain access on')) {
      const dateMatch = String(error.message).match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        const resetDate = new Date(dateMatch[1]);
        const formattedDate = resetDate.toLocaleDateString('en-US', { 
          month: 'long', 
          day: 'numeric', 
          year: 'numeric' 
        });
        errorContent = `⚠️ **Claude API Quota Exceeded**\n\nThe AI service has reached its monthly usage limit. Service will resume on **${formattedDate}**.\n\nWe apologize for the inconvenience. Please check back after this date or contact support for alternatives.`;
      } else {
        errorContent = `⚠️ **Claude API Quota Exceeded**\n\nThe AI service has reached its usage limit. Please contact support for assistance.`;
      }
    } else if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
      errorContent = `⏳ **Too many requests right now.**\n\nThe AI service is busy. Please wait 30 seconds and try again.\n\n💡 **Tip**: Avoid sending multiple questions rapidly.`;
    } else if (errorMsg.includes('quota')) {
      errorContent = `📊 **Daily AI quota reached.**\n\nYou've used your free daily limit. Upgrade to Premium or try again tomorrow.`;
    } else if (errorMsg.includes('503') || errorMsg.includes('service unavailable')) {
      errorContent = '🔧 The AI service is temporarily unavailable. Please try again in a few moments.';
    } else if (errorMsg.includes('timeout')) {
      errorContent = '⏱️ Request took too long. Please try with a shorter message or without images.';
    } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
      errorContent = '🌐 Network error. Please check your connection and try again.';
    } else {
      const truncatedError = errorMsg.substring(0, 100);
      errorContent = `❌ **Error**: ${truncatedError}${errorMsg.length > 100 ? '...' : ''}\n\nPlease try again or contact support if this persists.`;
    }
  }
  
  return errorContent;
}
