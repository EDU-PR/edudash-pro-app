/**
 * Chat Types
 * WARP.md compliant: ≤100 lines
 * 
 * Shared TypeScript types for chat components
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  images?: Array<{ data: string; media_type: string; preview?: string }>;
  audio?: { data: string; media_type: string; duration?: number };
  meta?: {
    tokensUsed?: number;
    model?: string;
  };
  isError?: boolean;
}

export interface SelectedImage {
  data: string;
  media_type: string;
  preview: string;
  url?: string;
}

export interface ExamContext {
  grade?: string;
  subject?: string;
  topics?: string[];
}
