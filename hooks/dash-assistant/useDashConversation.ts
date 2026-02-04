/**
 * useDashConversation Hook
 * 
 * Manages conversation state, messages, and persistence for Dash AI.
 * Handles message CRUD, streaming, and conversation snapshots.
 * 
 * Extracted from useDashAssistant.ts for WARP.md compliance (≤200 lines)
 */

import { useState, useCallback, useRef } from 'react';
import type { DashMessage, DashConversation } from '@/services/dash-ai/types';
import {
  getConversationSnapshot,
  saveConversationSnapshot,
  getLastActiveConversationId,
  setLastActiveConversationId,
} from '@/services/conversationPersistence';
import { logger } from '@/lib/logger';

export interface UseDashConversationReturn {
  // State
  messages: DashMessage[];
  conversation: DashConversation | null;
  streamingMessageId: string | null;
  streamingContent: string;
  
  // Actions
  addMessage: (message: DashMessage) => void;
  updateMessage: (id: string, updates: Partial<DashMessage>) => void;
  deleteMessage: (id: string) => void;
  clearMessages: () => void;
  setConversation: (conv: DashConversation | null) => void;
  
  // Streaming
  startStreaming: (messageId: string) => void;
  appendStream: (chunk: string) => void;
  finishStreaming: () => DashMessage | null;
  
  // Persistence
  loadConversation: (conversationId: string) => Promise<void>;
  saveConversation: () => Promise<void>;
  createNewConversation: (title?: string) => DashConversation;
}

export function useDashConversation(userId?: string): UseDashConversationReturn {
  const [messages, setMessages] = useState<DashMessage[]>([]);
  const [conversation, setConversation] = useState<DashConversation | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState<string>('');
  
  // Debounce streaming updates for performance
  const streamBufferRef = useRef<string>('');
  const streamTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Add message to conversation
   */
  const addMessage = useCallback((message: DashMessage) => {
    setMessages(prev => [...prev, message]);
    logger.debug('[DashConversation] Message added', { id: message.id, role: message.role });
  }, []);

  /**
   * Update existing message
   */
  const updateMessage = useCallback((id: string, updates: Partial<DashMessage>) => {
    setMessages(prev => prev.map(msg => 
      msg.id === id ? { ...msg, ...updates } : msg
    ));
  }, []);

  /**
   * Delete message
   */
  const deleteMessage = useCallback((id: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== id));
  }, []);

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setStreamingContent('');
    setStreamingMessageId(null);
  }, []);

  /**
   * Start streaming a new message
   */
  const startStreaming = useCallback((messageId: string) => {
    setStreamingMessageId(messageId);
    setStreamingContent('');
    streamBufferRef.current = '';
  }, []);

  /**
   * Append chunk to streaming message (debounced for performance)
   */
  const appendStream = useCallback((chunk: string) => {
    streamBufferRef.current += chunk;
    
    // Debounce UI updates to every 50ms for better performance
    if (streamTimeoutRef.current) {
      clearTimeout(streamTimeoutRef.current);
    }
    
    streamTimeoutRef.current = setTimeout(() => {
      setStreamingContent(streamBufferRef.current);
    }, 50);
  }, []);

  /**
   * Finish streaming and create final message
   */
  const finishStreaming = useCallback((): DashMessage | null => {
    if (!streamingMessageId) return null;
    
    // Clear any pending timeouts
    if (streamTimeoutRef.current) {
      clearTimeout(streamTimeoutRef.current);
      streamTimeoutRef.current = null;
    }
    
    const finalContent = streamBufferRef.current;
    const message: DashMessage = {
      id: streamingMessageId,
      role: 'assistant',
      content: finalContent,
      timestamp: new Date().toISOString(),
    };
    
    addMessage(message);
    
    // Reset streaming state
    setStreamingMessageId(null);
    setStreamingContent('');
    streamBufferRef.current = '';
    
    return message;
  }, [streamingMessageId, addMessage]);

  /**
   * Load conversation from storage
   */
  const loadConversation = useCallback(async (conversationId: string) => {
    try {
      const snapshot = await getConversationSnapshot(conversationId, userId);
      if (snapshot) {
        setConversation(snapshot.conversation);
        setMessages(snapshot.messages);
        logger.info('[DashConversation] Loaded', { conversationId, messageCount: snapshot.messages.length });
      }
    } catch (error) {
      logger.error('[DashConversation] Failed to load', { conversationId, error });
    }
  }, [userId]);

  /**
   * Save conversation to storage
   */
  const saveConversation = useCallback(async () => {
    if (!conversation || !userId) return;
    
    try {
      await saveConversationSnapshot(
        conversation.id,
        { conversation, messages },
        userId
      );
      logger.debug('[DashConversation] Saved', { id: conversation.id, messageCount: messages.length });
    } catch (error) {
      logger.error('[DashConversation] Failed to save', { error });
    }
  }, [conversation, messages, userId]);

  /**
   * Create new conversation
   */
  const createNewConversation = useCallback((title?: string): DashConversation => {
    const newConversation: DashConversation = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: title || 'New Conversation',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: userId || '',
      metadata: {},
    };
    
    setConversation(newConversation);
    clearMessages();
    
    // Set as last active
    if (userId) {
      setLastActiveConversationId(newConversation.id, userId);
    }
    
    logger.info('[DashConversation] Created', { id: newConversation.id });
    return newConversation;
  }, [userId, clearMessages]);

  return {
    messages,
    conversation,
    streamingMessageId,
    streamingContent,
    addMessage,
    updateMessage,
    deleteMessage,
    clearMessages,
    setConversation,
    startStreaming,
    appendStream,
    finishStreaming,
    loadConversation,
    saveConversation,
    createNewConversation,
  };
}
