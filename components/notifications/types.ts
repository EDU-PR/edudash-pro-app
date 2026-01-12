/**
 * Notification Types
 * 
 * Shared type definitions for notification components and hooks
 */

export interface Notification {
  id: string;
  type: 'message' | 'call' | 'announcement' | 'system' | 'homework' | 'grade';
  title: string;
  body: string;
  data?: Record<string, unknown>;
  read: boolean;
  created_at: string;
  sender_name?: string;
}
