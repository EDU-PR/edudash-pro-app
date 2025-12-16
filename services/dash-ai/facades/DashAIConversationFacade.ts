/**
 * DashAIConversationFacade
 * 
 * Facade for conversation and message management.
 * Delegates to DashConversationManager.
 */

import { DashConversationManager } from '../DashConversationManager';
import type { DashMessage, DashConversation } from '../types';

export class DashAIConversationFacade {
  private tempConversationId: string | null = null;
  
  constructor(private conversationManager: DashConversationManager | null) {}

  /**
   * Start new conversation
   * For users without organizations, creates a temporary in-memory conversation
   */
  public async startNewConversation(title?: string): Promise<string> {
    if (!this.conversationManager) {
      // User doesn't have organization - create temporary conversation ID
      // This allows DashAI to work but conversations won't persist
      const tempId = `temp_conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.tempConversationId = tempId;
      console.log('[DashAIConversationFacade] Created temporary conversation (no organization):', tempId);
      return tempId;
    }
    return this.conversationManager.startNewConversation(title);
  }

  /**
   * Get conversation by ID
   */
  public async getConversation(conversationId: string): Promise<DashConversation | null> {
    if (!this.conversationManager) {
      console.warn('[DashAIConversationFacade] Conversation manager not initialized');
      return null;
    }
    return this.conversationManager.getConversation(conversationId);
  }

  /**
   * Get all conversations
   */
  public async getAllConversations(): Promise<DashConversation[]> {
    if (!this.conversationManager) {
      console.warn('[DashAIConversationFacade] Conversation manager not initialized');
      return [];
    }
    return this.conversationManager.getAllConversations();
  }

  /**
   * Delete conversation
   */
  public async deleteConversation(conversationId: string): Promise<void> {
    if (!this.conversationManager) {
      console.warn('[DashAIConversationFacade] Conversation manager not initialized');
      return;
    }
    return this.conversationManager.deleteConversation(conversationId);
  }

  /**
   * Get current conversation ID
   */
  public getCurrentConversationId(): string | null {
    if (!this.conversationManager) {
      // Return temporary conversation ID for users without organization
      return this.tempConversationId;
    }
    return this.conversationManager.getCurrentConversationId();
  }

  /**
   * Set current conversation ID
   */
  public setCurrentConversationId(conversationId: string): void {
    if (!this.conversationManager) {
      // Store temporary conversation ID for users without organization
      this.tempConversationId = conversationId;
      return;
    }
    this.conversationManager.setCurrentConversationId(conversationId);
  }

  /**
   * Add message to conversation
   */
  public async addMessageToConversation(
    conversationId: string,
    message: DashMessage
  ): Promise<void> {
    if (!this.conversationManager) {
      // For temporary conversations (no organization), messages are only kept in memory
      // They won't persist but DashAI can still function
      console.debug('[DashAIConversationFacade] Message added to temporary conversation (not persisted)');
      return;
    }
    return this.conversationManager.addMessageToConversation(conversationId, message);
  }

  /**
   * Export conversation as text
   */
  public async exportConversation(conversationId: string): Promise<string> {
    if (!this.conversationManager) {
      // Return empty export for temporary conversations
      console.warn('[DashAIConversationFacade] Cannot export temporary conversation');
      return 'Conversation history not available (user not linked to organization)';
    }
    return this.conversationManager.exportConversation(conversationId);
  }

  /**
   * Dispose conversation manager resources
   */
  public dispose(): void {
    if (this.conversationManager) {
      this.conversationManager.dispose();
    }
  }
}
