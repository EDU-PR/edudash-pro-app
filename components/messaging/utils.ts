/**
 * Message Utilities
 * Shared helper functions for message formatting and processing
 */

/**
 * Format timestamp to time string (HH:MM)
 */
export const formatTime = (ts: string): string => {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

/**
 * Get date separator label (Today, Yesterday, weekday, or full date)
 */
export const getDateSeparatorLabel = (timestamp: string): string => {
  const messageDate = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const messageDateOnly = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
  
  if (messageDateOnly.getTime() === todayOnly.getTime()) return 'Today';
  if (messageDateOnly.getTime() === yesterdayOnly.getTime()) return 'Yesterday';
  
  const daysDiff = Math.floor((todayOnly.getTime() - messageDateOnly.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff < 7) {
    return messageDate.toLocaleDateString([], { weekday: 'long' });
  }
  return messageDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
};

/**
 * Get date key for grouping messages by day
 */
export const getDateKey = (timestamp: string): string => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

/**
 * Check if message content is a voice note
 */
export const isVoiceNote = (content: string): boolean => {
  return content.startsWith('🎤 Voice message') || 
         content.startsWith('🎤 Voice (') ||
         (content.includes('__media__') && content.includes('audio'));
};

/**
 * Extract voice note duration from content string
 */
export const getVoiceNoteDuration = (content: string): number => {
  const match = content.match(/\((\d+)s\)/);
  return match ? parseInt(match[1], 10) * 1000 : 30000;
};

/**
 * Get sender display name from message
 */
export const getSenderName = (sender?: { first_name?: string; last_name?: string }): string => {
  if (!sender) return 'User';
  return `${sender.first_name || ''} ${sender.last_name || ''}`.trim() || 'User';
};
