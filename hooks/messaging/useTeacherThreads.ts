/**
 * useTeacherThreads — Fetches all message threads where the teacher is a participant
 */

import { useQuery } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import type { MessageThread } from '@/lib/messaging/types';

export const useTeacherThreads = () => {
  const { user, profile } = useAuth();
  const organizationId = (profile as any)?.organization_id || (profile as any)?.preschool_id;
  
  return useQuery({
    queryKey: ['teacher', 'threads', user?.id, organizationId],
    queryFn: async (): Promise<MessageThread[]> => {
      if (!user?.id) throw new Error('User not authenticated');
      if (!organizationId) {
        logger.warn('useTeacherThreads', 'No organization ID, returning empty');
        return [];
      }
      
      const client = assertSupabase();
      
      try {
        const { data: threads, error: threadsError } = await client
          .from('message_threads')
          .select(`
            id,
            type,
            subject,
            student_id,
            preschool_id,
            is_group,
            group_name,
            group_type,
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
            logger.warn('useTeacherThreads', 'message_threads table not found');
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
          const isGroupThread = Boolean(
            thread.is_group ||
            ['class_group', 'parent_group', 'teacher_group', 'announcement', 'custom'].includes(String(thread.type || thread.group_type || ''))
          );
          const otherParticipant = thread.participants?.find(
            (p: any) => p.user_id !== user.id
          );
          const key = isGroupThread ? `group:${thread.id}` : (otherParticipant?.user_id || thread.id);
          
          const existing = uniqueThreadMap.get(key);
          if (!existing || new Date(thread.last_message_at) > new Date(existing.last_message_at)) {
            uniqueThreadMap.set(key, thread);
          }
        });
        
        return Array.from(uniqueThreadMap.values()).sort(
          (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
        );
        
      } catch (error) {
        logger.error('useTeacherThreads', 'Error:', error);
        throw error;
      }
    },
    enabled: !!user?.id && !!organizationId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
};
