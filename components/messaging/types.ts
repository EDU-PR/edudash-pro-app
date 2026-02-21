/**
 * Shared Message Types
 * Used by both parent and teacher message threads
 */

export interface MessageReaction {
  emoji: string;
  count: number;
  hasReacted: boolean;
  /** User IDs who reacted (for native long-press to show names) */
  reactedByUserIds?: string[];
  /** Resolved names for display (web and native when available) */
  reactedBy?: { id: string; first_name?: string; last_name?: string }[];
}

export interface Message {
  id: string;
  thread_id?: string;
  content: string;
  content_type?: string;
  sender_id: string;
  created_at: string;
  sender?: { 
    first_name?: string; 
    last_name?: string; 
    role?: string;
    avatar_url?: string | null;
  };
  read_by?: string[];
  delivered_at?: string; // Timestamp when message was delivered
  isTyping?: boolean;
  voice_url?: string;
  voice_duration?: number;
  reactions?: MessageReaction[];
  forwarded_from_id?: string; // Set when message was forwarded
  edited_at?: string; // Set when message was edited
  is_starred?: boolean;
  reply_to_id?: string | null;
  reply_to?: {
    id: string;
    content: string;
    content_type?: string;
    sender_id: string;
    sender?: { first_name?: string; last_name?: string };
  } | null;
}

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

export interface MessageThreadParams {
  threadId?: string;
  title?: string;
  teacherName?: string;
  parentName?: string;
}
