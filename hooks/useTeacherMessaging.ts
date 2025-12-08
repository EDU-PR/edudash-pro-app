import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { assertSupabase, supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// Types (shared with parent messaging)
export interface MessageThread {
  id: string;
  preschool_id: string;
  type: 'parent-teacher' | 'parent-principal' | 'general';
  student_id: string | null;
  subject: string;
  created_by: string;
  last_message_at: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  student?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  participants?: MessageParticipant[];
  last_message?: {
    content: string;
    sender_id: string;
    created_at: string;
  };
  unread_count?: number;
}

export interface MessageParticipant {
  id: string;
  thread_id: string;
  user_id: string;
  role: 'parent' | 'teacher' | 'principal' | 'admin';
  joined_at: string;
  is_muted: boolean;
  last_read_at: string;
  // Joined data
  user_profile?: {
    first_name: string;
    last_name: string;
    role: string;
  };
}

export interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  content_type: 'text' | 'system' | 'voice' | 'image';
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  read_by?: string[];
  voice_url?: string | null;
  voice_duration?: number | null;
  // Joined data
  sender?: {
    first_name: string;
    last_name: string;
    role: string;
  };
}

/**
 * Hook to get teacher's message threads
 * Fetches all threads where the teacher is a participant
 */
export const useTeacherThreads = () => {
  const { user, profile } = useAuth();
  const organizationId = (profile as any)?.organization_id || (profile as any)?.preschool_id;
  
  return useQuery({
    queryKey: ['teacher', 'threads', user?.id, organizationId],
    queryFn: async (): Promise<MessageThread[]> => {
      if (!user?.id) throw new Error('User not authenticated');
      if (!organizationId) {
        console.warn('[useTeacherThreads] No organization ID, returning empty');
        return [];
      }
      
      const client = assertSupabase();
      
      try {
        // First, get threads where teacher is a participant
        const { data: threads, error: threadsError } = await client
          .from('message_threads')
          .select(`
            id,
            type,
            subject,
            student_id,
            preschool_id,
            last_message_at,
            created_at,
            student:students(id, first_name, last_name),
            message_participants!inner(
              user_id,
              role,
              last_read_at
            )
          `)
          .eq('preschool_id', organizationId)
          .order('last_message_at', { ascending: false });
        
        if (threadsError) {
          if (threadsError.code === '42P01' || threadsError.message?.includes('does not exist')) {
            console.warn('[useTeacherThreads] message_threads table not found');
            return [];
          }
          throw threadsError;
        }
        
        if (!threads || threads.length === 0) return [];
        
        // Filter to only threads where teacher is a participant
        const teacherThreads = threads.filter((thread: any) =>
          thread.message_participants?.some((p: any) => 
            p.user_id === user.id && p.role === 'teacher'
          )
        );
        
        // Get all unique user IDs from participants
        const allUserIds = new Set<string>();
        teacherThreads.forEach((thread: any) => {
          (thread.message_participants || []).forEach((p: any) => {
            if (p.user_id) allUserIds.add(p.user_id);
          });
        });
        
        // Fetch profiles for all participants
        const { data: profiles } = await client
          .from('profiles')
          .select('id, first_name, last_name, role')
          .in('id', Array.from(allUserIds));
        
        const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]));
        
        // Enrich threads with profile data and fetch last message
        const enrichedThreads = await Promise.all(
          teacherThreads.map(async (thread: any) => {
            // Fetch last message
            const { data: lastMessage } = await client
              .from('messages')
              .select('content, created_at, sender_id')
              .eq('thread_id', thread.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            // Calculate unread count
            const teacherParticipant = thread.message_participants?.find(
              (p: any) => p.user_id === user.id && p.role === 'teacher'
            );
            
            let unreadCount = 0;
            if (teacherParticipant) {
              const lastReadAt = teacherParticipant.last_read_at || '2000-01-01';
              const { count } = await client
                .from('messages')
                .select('id', { count: 'exact', head: true })
                .eq('thread_id', thread.id)
                .neq('sender_id', user.id)
                .gt('created_at', lastReadAt);
              
              unreadCount = count || 0;
            }
            
            // Enrich participants with profiles
            const participants = (thread.message_participants || []).map((p: any) => ({
              ...p,
              user_profile: profilesMap.get(p.user_id) || null,
            }));
            
            return {
              ...thread,
              participants,
              last_message: lastMessage,
              unread_count: unreadCount,
            };
          })
        );
        
        // Deduplicate by contact (keep most recent thread per parent)
        const uniqueThreadMap = new Map<string, MessageThread>();
        enrichedThreads.forEach((thread) => {
          const otherParticipant = thread.participants?.find(
            (p: any) => p.user_id !== user.id
          );
          const key = otherParticipant?.user_id || thread.id;
          
          const existing = uniqueThreadMap.get(key);
          if (!existing || new Date(thread.last_message_at) > new Date(existing.last_message_at)) {
            uniqueThreadMap.set(key, thread);
          }
        });
        
        return Array.from(uniqueThreadMap.values()).sort(
          (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
        );
        
      } catch (error) {
        console.error('[useTeacherThreads] Error:', error);
        throw error;
      }
    },
    enabled: !!user?.id && !!organizationId,
    staleTime: 30_000, // 30 seconds
    refetchOnWindowFocus: true,
  });
};

/**
 * Hook to get messages for a specific thread
 */
export const useTeacherThreadMessages = (threadId: string | null) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['teacher', 'messages', threadId],
    queryFn: async (): Promise<Message[]> => {
      if (!threadId || !user?.id) return [];
      
      const client = assertSupabase();
      
      const { data, error } = await client
        .from('messages')
        .select(`
          id,
          thread_id,
          sender_id,
          content,
          content_type,
          created_at,
          read_by,
          deleted_at,
          voice_url,
          voice_duration
        `)
        .eq('thread_id', threadId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      // Fetch sender profiles
      const senderIds = [...new Set((data || []).map((m: any) => m.sender_id))];
      const { data: senderProfiles } = await client
        .from('profiles')
        .select('id, first_name, last_name, role')
        .in('id', senderIds);
      
      const profileMap = new Map((senderProfiles || []).map((p: any) => [p.id, p]));
      
      return (data || []).map((msg: any) => ({
        ...msg,
        sender: profileMap.get(msg.sender_id) || null,
      }));
    },
    enabled: !!threadId && !!user?.id,
    staleTime: 10_000,
  });
};

/**
 * Hook to send a message in a thread
 */
export const useTeacherSendMessage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      threadId, 
      content,
      voiceUrl,
      voiceDuration,
    }: { 
      threadId: string; 
      content: string;
      voiceUrl?: string;
      voiceDuration?: number;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const client = assertSupabase();
      
      const isVoice = !!voiceUrl;
      
      const { data, error } = await client
        .from('messages')
        .insert({
          thread_id: threadId,
          sender_id: user.id,
          content,
          content_type: isVoice ? 'voice' : 'text',
          voice_url: voiceUrl || null,
          voice_duration: voiceDuration || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Update thread's last_message_at
      await client
        .from('message_threads')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', threadId);
      
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teacher', 'messages', variables.threadId] });
      queryClient.invalidateQueries({ queryKey: ['teacher', 'threads'] });
    },
  });
};

/**
 * Hook to mark thread as read
 */
export const useTeacherMarkThreadRead = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (threadId: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const client = assertSupabase();
      
      // Try using the RPC function first
      const { error: rpcError } = await client.rpc('mark_thread_messages_as_read', {
        thread_id: threadId,
        reader_id: user.id,
      });
      
      if (rpcError) {
        // Fallback: update last_read_at directly
        await client
          .from('message_participants')
          .update({ last_read_at: new Date().toISOString() })
          .eq('thread_id', threadId)
          .eq('user_id', user.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher', 'threads'] });
      // Also invalidate unread count for badge updates
      queryClient.invalidateQueries({ queryKey: ['teacher', 'unread-count'] });
    },
  });
};

/**
 * Hook for real-time message updates in a thread
 * Subscribes to new messages and updates the query cache incrementally
 */
export const useTeacherMessagesRealtime = (threadId: string | null) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!threadId || !user?.id) return;

    const channel = supabase
      .channel(`messages:thread:${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${threadId}`,
        },
        async (payload) => {
          console.log('[MessagesRealtime] New message received:', payload.new.id);
          
          // Fetch sender profile for the new message
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, role')
            .eq('id', payload.new.sender_id)
            .single();
          
          const newMessage = {
            ...payload.new,
            sender: senderProfile,
          };
          
          // Update query cache incrementally (no full refetch)
          queryClient.setQueryData(
            ['teacher', 'messages', threadId],
            (old: Message[] | undefined) => {
              if (!old) return [newMessage];
              // Avoid duplicates
              if (old.some(m => m.id === newMessage.id)) return old;
              return [...old, newMessage];
            }
          );
          
          // Also update threads list to reflect new last_message
          queryClient.invalidateQueries({ queryKey: ['teacher', 'threads'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, user?.id, queryClient]);
};

/**
 * Hook for real-time thread list updates
 * Subscribes to thread changes (new threads, last_message_at updates)
 */
export const useTeacherThreadsRealtime = (organizationId: string | null) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!organizationId || !user?.id) return;

    const channel = supabase
      .channel(`threads:org:${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'message_threads',
          filter: `preschool_id=eq.${organizationId}`,
        },
        (payload) => {
          console.log('[ThreadsRealtime] Thread changed:', payload.eventType);
          // Invalidate threads query to refetch
          queryClient.invalidateQueries({ queryKey: ['teacher', 'threads'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, user?.id, queryClient]);
};
