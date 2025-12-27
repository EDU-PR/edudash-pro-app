/**
 * Shared Message Types
 * Used by both parent and teacher message threads
 */

export interface MessageReaction {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

export interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  sender?: { 
    first_name?: string; 
    last_name?: string; 
    role?: string;
  };
  read_by?: string[];
  delivered_at?: string; // Timestamp when message was delivered
  isTyping?: boolean;
  voice_url?: string;
  voice_duration?: number;
  reactions?: MessageReaction[];
}

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

export interface MessageThreadParams {
  threadId?: string;
  title?: string;
  teacherName?: string;
  parentName?: string;
}
