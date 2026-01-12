/**
 * SOA Messaging Types
 * Types for Soil of Africa organization messaging system
 */

// Thread types
export type SOAThreadType = 'broadcast' | 'regional_chat' | 'wing_chat' | 'direct' | 'national';
export type SOAWing = 'youth' | 'women' | 'men' | 'seniors' | 'national' | 'all';
export type SOAParticipantRole = 'admin' | 'moderator' | 'member' | 'readonly';
export type SOAMessageContentType = 'text' | 'image' | 'voice' | 'document' | 'system' | 'announcement';
export type SOANotificationPreference = 'all' | 'mentions' | 'none';

// Thread interface
export interface SOAMessageThread {
  id: string;
  organization_id: string;
  region_id: string | null;
  wing: SOAWing | null;
  thread_type: SOAThreadType;
  subject: string | null;
  description: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  is_muted_by_default: boolean;
  participant_ids: string[];
  created_by: string;
  last_message_at: string;
  message_count: number;
  created_at: string;
  updated_at: string;
  
  // Joined data
  creator?: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
  last_message?: SOAMessage;
  unread_count?: number;
  region?: {
    id: string;
    name: string;
    code: string;
  };
}

// Message interface
export interface SOAMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  content_type: SOAMessageContentType;
  attachment_url: string | null;
  attachment_type: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  voice_duration: number | null;
  reply_to_id: string | null;
  forwarded_from_id: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
  
  // Joined data
  sender?: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
    member_type?: string;
  };
  reply_to?: SOAMessage;
  reactions?: SOAMessageReaction[];
  read_by_count?: number;
  is_read?: boolean;
}

// Participant interface
export interface SOAMessageParticipant {
  id: string;
  thread_id: string;
  user_id: string;
  member_id: string | null;
  role: SOAParticipantRole;
  joined_at: string;
  is_muted: boolean;
  is_pinned: boolean;
  notification_preference: SOANotificationPreference;
  last_read_at: string;
  last_read_message_id: string | null;
  unread_count: number;
  left_at: string | null;
  removed_by: string | null;
  
  // Joined data
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
  member?: {
    id: string;
    member_number: string;
    member_type: string;
  };
}

// Reaction interface
export interface SOAMessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  user?: {
    first_name: string;
    last_name: string;
  };
}

// Read receipt interface
export interface SOAReadReceipt {
  id: string;
  message_id: string;
  user_id: string;
  read_at: string;
}

// Thread list item (for displaying in list)
export interface SOAThreadListItem extends SOAMessageThread {
  unread_count: number;
  is_muted: boolean;
  last_message_preview?: string;
  participant_count?: number;
}

// Create thread params
export interface CreateSOAThreadParams {
  organization_id: string;
  region_id?: string;
  wing?: SOAWing;
  thread_type: SOAThreadType;
  subject?: string;
  description?: string;
  participant_ids?: string[]; // For direct messages
}

// Send message params
export interface SendSOAMessageParams {
  thread_id: string;
  content: string;
  content_type?: SOAMessageContentType;
  attachment_url?: string;
  attachment_type?: string;
  attachment_name?: string;
  attachment_size?: number;
  voice_duration?: number;
  reply_to_id?: string;
  metadata?: Record<string, any>;
}

// Thread filter options
export interface SOAThreadFilters {
  organization_id: string;
  region_id?: string;
  wing?: SOAWing;
  thread_type?: SOAThreadType;
  is_archived?: boolean;
  search?: string;
}

// Message filter options
export interface SOAMessageFilters {
  thread_id: string;
  before?: string; // For pagination - messages before this ID
  after?: string; // For pagination - messages after this ID
  limit?: number;
}

// Thread stats
export interface SOAThreadStats {
  total_threads: number;
  unread_threads: number;
  total_messages: number;
  unread_messages: number;
}

// Typing indicator
export interface SOATypingIndicator {
  thread_id: string;
  user_id: string;
  user_name: string;
  started_at: string;
}

// Real-time events
export type SOAMessageEvent = 
  | { type: 'message_created'; payload: SOAMessage }
  | { type: 'message_updated'; payload: SOAMessage }
  | { type: 'message_deleted'; payload: { id: string; thread_id: string } }
  | { type: 'reaction_added'; payload: SOAMessageReaction }
  | { type: 'reaction_removed'; payload: { message_id: string; user_id: string; emoji: string } }
  | { type: 'thread_updated'; payload: Partial<SOAMessageThread> }
  | { type: 'typing_started'; payload: SOATypingIndicator }
  | { type: 'typing_stopped'; payload: { thread_id: string; user_id: string } }
  | { type: 'participant_added'; payload: SOAMessageParticipant }
  | { type: 'participant_removed'; payload: { thread_id: string; user_id: string } };

// Wing display configuration
export const WING_CONFIG: Record<SOAWing, { label: string; color: string; icon: string }> = {
  youth: { label: 'Youth Wing', color: '#10B981', icon: 'people' },
  women: { label: 'Women\'s Wing', color: '#EC4899', icon: 'woman' },
  men: { label: 'Men\'s Wing', color: '#3B82F6', icon: 'man' },
  seniors: { label: 'Seniors Wing', color: '#8B5CF6', icon: 'accessibility' },
  national: { label: 'National', color: '#F59E0B', icon: 'globe' },
  all: { label: 'All Members', color: '#6B7280', icon: 'people-circle' },
};

// Thread type display configuration
export const THREAD_TYPE_CONFIG: Record<SOAThreadType, { label: string; icon: string; description: string }> = {
  broadcast: { 
    label: 'Announcements', 
    icon: 'megaphone', 
    description: 'Official announcements from leadership' 
  },
  regional_chat: { 
    label: 'Regional Chat', 
    icon: 'location', 
    description: 'Discussion for your region' 
  },
  wing_chat: { 
    label: 'Wing Chat', 
    icon: 'chatbubbles', 
    description: 'Discussion for your wing' 
  },
  direct: { 
    label: 'Direct Message', 
    icon: 'chatbubble', 
    description: 'Private conversation' 
  },
  national: { 
    label: 'National', 
    icon: 'globe', 
    description: 'National level discussions' 
  },
};
