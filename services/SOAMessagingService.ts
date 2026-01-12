/**
 * SOA Messaging Service
 * Service layer for Soil of Africa messaging functionality
 */
import { assertSupabase } from '@/lib/supabase';
import type {
  SOAMessageThread,
  SOAMessage,
  SOAMessageParticipant,
  SOAThreadListItem,
  CreateSOAThreadParams,
  SendSOAMessageParams,
  SOAThreadFilters,
  SOAMessageFilters,
  SOAThreadStats,
} from '@/components/soa-messaging/types';

// ============================================================================
// Thread Operations
// ============================================================================

/**
 * Get threads for current user
 */
export async function getSOAThreads(
  filters: SOAThreadFilters
): Promise<SOAThreadListItem[]> {
  const supabase = assertSupabase();
  
  let query = supabase
    .from('soa_message_threads')
    .select(`
      *,
      region:organization_regions(id, name, code),
      creator:profiles!created_by(id, first_name, last_name, avatar_url),
      participants:soa_message_participants(
        unread_count,
        is_muted,
        user_id
      )
    `)
    .eq('organization_id', filters.organization_id)
    .order('last_message_at', { ascending: false });

  if (filters.region_id) {
    query = query.eq('region_id', filters.region_id);
  }
  
  if (filters.wing) {
    query = query.eq('wing', filters.wing);
  }
  
  if (filters.thread_type) {
    query = query.eq('thread_type', filters.thread_type);
  }
  
  if (filters.is_archived !== undefined) {
    query = query.eq('is_archived', filters.is_archived);
  }
  
  if (filters.search) {
    query = query.ilike('subject', `%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching SOA threads:', error);
    throw error;
  }

  // Get current user ID for unread count
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  // Transform to list items with user-specific data
  return (data || []).map((thread: any) => {
    const userParticipant = thread.participants?.find(
      (p: any) => p.user_id === userId
    );
    
    return {
      ...thread,
      unread_count: userParticipant?.unread_count || 0,
      is_muted: userParticipant?.is_muted || false,
      participant_count: thread.participants?.length || 0,
    };
  });
}

/**
 * Get single thread with full details
 */
export async function getSOAThread(threadId: string): Promise<SOAMessageThread | null> {
  const supabase = assertSupabase();
  
  const { data, error } = await supabase
    .from('soa_message_threads')
    .select(`
      *,
      region:organization_regions(id, name, code),
      creator:profiles!created_by(id, first_name, last_name, avatar_url)
    `)
    .eq('id', threadId)
    .single();

  if (error) {
    console.error('Error fetching SOA thread:', error);
    return null;
  }

  return data;
}

/**
 * Create a new thread
 */
export async function createSOAThread(
  params: CreateSOAThreadParams
): Promise<SOAMessageThread> {
  const supabase = assertSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Not authenticated');

  const { data: thread, error: threadError } = await supabase
    .from('soa_message_threads')
    .insert({
      organization_id: params.organization_id,
      region_id: params.region_id || null,
      wing: params.wing || null,
      thread_type: params.thread_type,
      subject: params.subject || null,
      description: params.description || null,
      participant_ids: params.participant_ids || [],
      created_by: user.id,
    })
    .select()
    .single();

  if (threadError) {
    console.error('Error creating SOA thread:', threadError);
    throw threadError;
  }

  // Add creator as admin participant
  await supabase
    .from('soa_message_participants')
    .insert({
      thread_id: thread.id,
      user_id: user.id,
      role: 'admin',
    });

  // Add other participants for direct messages
  if (params.thread_type === 'direct' && params.participant_ids) {
    const participantInserts = params.participant_ids
      .filter(id => id !== user.id)
      .map(userId => ({
        thread_id: thread.id,
        user_id: userId,
        role: 'member',
      }));

    if (participantInserts.length > 0) {
      await supabase
        .from('soa_message_participants')
        .insert(participantInserts);
    }
  }

  return thread;
}

/**
 * Archive/unarchive thread
 */
export async function archiveSOAThread(
  threadId: string,
  archive: boolean = true
): Promise<void> {
  const supabase = assertSupabase();
  
  const { error } = await supabase
    .from('soa_message_threads')
    .update({ is_archived: archive, updated_at: new Date().toISOString() })
    .eq('id', threadId);

  if (error) {
    console.error('Error archiving SOA thread:', error);
    throw error;
  }
}

/**
 * Pin/unpin thread
 */
export async function pinSOAThread(
  threadId: string,
  pin: boolean = true
): Promise<void> {
  const supabase = assertSupabase();
  
  const { error } = await supabase
    .from('soa_message_threads')
    .update({ is_pinned: pin, updated_at: new Date().toISOString() })
    .eq('id', threadId);

  if (error) {
    console.error('Error pinning SOA thread:', error);
    throw error;
  }
}

// ============================================================================
// Message Operations
// ============================================================================

/**
 * Get messages for a thread
 */
export async function getSOAMessages(
  filters: SOAMessageFilters
): Promise<SOAMessage[]> {
  const supabase = assertSupabase();
  
  let query = supabase
    .from('soa_messages')
    .select(`
      *,
      sender:profiles!sender_id(id, first_name, last_name, avatar_url),
      reactions:soa_message_reactions(id, emoji, user_id),
      reply_to:soa_messages!reply_to_id(
        id, content, sender:profiles!sender_id(first_name, last_name)
      )
    `)
    .eq('thread_id', filters.thread_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (filters.before) {
    query = query.lt('id', filters.before);
  }
  
  if (filters.after) {
    query = query.gt('id', filters.after);
  }
  
  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching SOA messages:', error);
    throw error;
  }

  return data || [];
}

/**
 * Send a message
 */
export async function sendSOAMessage(
  params: SendSOAMessageParams
): Promise<SOAMessage> {
  const supabase = assertSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('soa_messages')
    .insert({
      thread_id: params.thread_id,
      sender_id: user.id,
      content: params.content,
      content_type: params.content_type || 'text',
      attachment_url: params.attachment_url || null,
      attachment_type: params.attachment_type || null,
      attachment_name: params.attachment_name || null,
      attachment_size: params.attachment_size || null,
      voice_duration: params.voice_duration || null,
      reply_to_id: params.reply_to_id || null,
      metadata: params.metadata || {},
    })
    .select(`
      *,
      sender:profiles!sender_id(id, first_name, last_name, avatar_url)
    `)
    .single();

  if (error) {
    console.error('Error sending SOA message:', error);
    throw error;
  }

  return data;
}

/**
 * Edit a message
 */
export async function editSOAMessage(
  messageId: string,
  content: string
): Promise<SOAMessage> {
  const supabase = assertSupabase();
  
  const { data, error } = await supabase
    .from('soa_messages')
    .update({
      content,
      edited_at: new Date().toISOString(),
    })
    .eq('id', messageId)
    .select()
    .single();

  if (error) {
    console.error('Error editing SOA message:', error);
    throw error;
  }

  return data;
}

/**
 * Delete a message (soft delete)
 */
export async function deleteSOAMessage(messageId: string): Promise<void> {
  const supabase = assertSupabase();
  
  const { error } = await supabase
    .from('soa_messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId);

  if (error) {
    console.error('Error deleting SOA message:', error);
    throw error;
  }
}

// ============================================================================
// Reactions
// ============================================================================

/**
 * Add reaction to message
 */
export async function addSOAReaction(
  messageId: string,
  emoji: string
): Promise<void> {
  const supabase = assertSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('soa_message_reactions')
    .insert({
      message_id: messageId,
      user_id: user.id,
      emoji,
    });

  if (error && error.code !== '23505') { // Ignore duplicate key error
    console.error('Error adding SOA reaction:', error);
    throw error;
  }
}

/**
 * Remove reaction from message
 */
export async function removeSOAReaction(
  messageId: string,
  emoji: string
): Promise<void> {
  const supabase = assertSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('soa_message_reactions')
    .delete()
    .eq('message_id', messageId)
    .eq('user_id', user.id)
    .eq('emoji', emoji);

  if (error) {
    console.error('Error removing SOA reaction:', error);
    throw error;
  }
}

// ============================================================================
// Read Status
// ============================================================================

/**
 * Mark thread as read
 */
export async function markSOAThreadRead(threadId: string): Promise<void> {
  const supabase = assertSupabase();
  
  const { error } = await supabase.rpc('mark_soa_thread_read', {
    p_thread_id: threadId,
  });

  if (error) {
    console.error('Error marking SOA thread read:', error);
    throw error;
  }
}

// ============================================================================
// Participants
// ============================================================================

/**
 * Get thread participants
 */
export async function getSOAParticipants(
  threadId: string
): Promise<SOAMessageParticipant[]> {
  const supabase = assertSupabase();
  
  const { data, error } = await supabase
    .from('soa_message_participants')
    .select(`
      *,
      user:profiles!user_id(id, first_name, last_name, avatar_url),
      member:organization_members!member_id(id, member_number, member_type)
    `)
    .eq('thread_id', threadId)
    .is('left_at', null);

  if (error) {
    console.error('Error fetching SOA participants:', error);
    throw error;
  }

  return data || [];
}

/**
 * Add participant to thread
 */
export async function addSOAParticipant(
  threadId: string,
  userId: string,
  role: 'admin' | 'moderator' | 'member' | 'readonly' = 'member'
): Promise<void> {
  const supabase = assertSupabase();
  
  const { error } = await supabase
    .from('soa_message_participants')
    .insert({
      thread_id: threadId,
      user_id: userId,
      role,
    });

  if (error) {
    console.error('Error adding SOA participant:', error);
    throw error;
  }
}

/**
 * Remove participant from thread
 */
export async function removeSOAParticipant(
  threadId: string,
  userId: string
): Promise<void> {
  const supabase = assertSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  const { error } = await supabase
    .from('soa_message_participants')
    .update({
      left_at: new Date().toISOString(),
      removed_by: user?.id,
    })
    .eq('thread_id', threadId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error removing SOA participant:', error);
    throw error;
  }
}

/**
 * Update participant preferences
 */
export async function updateSOAParticipantPreferences(
  threadId: string,
  preferences: {
    is_muted?: boolean;
    is_pinned?: boolean;
    notification_preference?: 'all' | 'mentions' | 'none';
  }
): Promise<void> {
  const supabase = assertSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('soa_message_participants')
    .update(preferences)
    .eq('thread_id', threadId)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error updating SOA participant preferences:', error);
    throw error;
  }
}

// ============================================================================
// Stats
// ============================================================================

/**
 * Get messaging stats for user
 */
export async function getSOAMessagingStats(
  organizationId: string
): Promise<SOAThreadStats> {
  const supabase = assertSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Not authenticated');

  // Get total threads count
  const { count: totalThreads } = await supabase
    .from('soa_message_threads')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  // Get unread threads count
  const { data: participantData } = await supabase
    .from('soa_message_participants')
    .select('unread_count')
    .eq('user_id', user.id);

  const unreadThreads = participantData?.filter(p => p.unread_count > 0).length || 0;
  const totalUnread = participantData?.reduce((sum, p) => sum + p.unread_count, 0) || 0;

  // Get total messages (approximate)
  const { count: totalMessages } = await supabase
    .from('soa_messages')
    .select('id', { count: 'exact', head: true });

  return {
    total_threads: totalThreads || 0,
    unread_threads: unreadThreads,
    total_messages: totalMessages || 0,
    unread_messages: totalUnread,
  };
}

// ============================================================================
// Real-time Subscriptions
// ============================================================================

/**
 * Subscribe to thread messages
 */
export function subscribeToSOAMessages(
  threadId: string,
  onMessage: (message: SOAMessage) => void
) {
  const supabase = assertSupabase();
  
  const subscription = supabase
    .channel(`soa_messages:${threadId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'soa_messages',
        filter: `thread_id=eq.${threadId}`,
      },
      (payload) => {
        onMessage(payload.new as SOAMessage);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
}

/**
 * Subscribe to thread updates
 */
export function subscribeToSOAThread(
  threadId: string,
  onUpdate: (thread: Partial<SOAMessageThread>) => void
) {
  const supabase = assertSupabase();
  
  const subscription = supabase
    .channel(`soa_thread:${threadId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'soa_message_threads',
        filter: `id=eq.${threadId}`,
      },
      (payload) => {
        onUpdate(payload.new as Partial<SOAMessageThread>);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
}
