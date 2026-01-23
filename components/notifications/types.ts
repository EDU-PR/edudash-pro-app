/**
 * Notification Types
 * 
 * Shared type definitions for notification components and hooks
 */

export type NotificationType = 
  | 'message' 
  | 'call' 
  | 'announcement' 
  | 'system' 
  | 'homework' 
  | 'grade'
  | 'attendance'
  | 'registration'
  | 'billing'
  | 'calendar'
  | 'birthday';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  read: boolean;
  created_at: string;
  sender_name?: string;
}
