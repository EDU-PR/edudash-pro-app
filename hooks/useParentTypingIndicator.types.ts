/** Shared types for useParentTypingIndicator */
export interface TypingUser {
  userId: string;
  userName: string;
  timestamp: number;
}
export interface UseTypingIndicatorOptions {
  throttleMs?: number;
  timeoutMs?: number;
}
export interface UseTypingIndicatorReturn {
  typingUsers: TypingUser[];
  typingText: string | null;
  startTyping: () => void;
  stopTyping: () => void;
  isTyping: boolean;
}
