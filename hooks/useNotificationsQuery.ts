/**
 * useNotificationsQuery Hook
 * 
 * Fetches and manages notification data from multiple sources:
 * - In-app notifications table
 * - Unread messages
 * - Missed calls
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { 
  getReadNotificationIds, 
  getClearedNotificationIds, 
  getClearedBeforeDate,
  isNotificationCleared,
} from './useNotificationStorage';
import { Notification } from '@/components/notifications/types';

/**
 * Fetch notifications from all sources
 */
async function fetchNotifications(userId: string): Promise<Notification[]> {
  const client = assertSupabase();
  
  // Get read and cleared notification data
  const readIds = await getReadNotificationIds(userId);
  const clearedIds = await getClearedNotificationIds(userId);
  const clearedBeforeDate = await getClearedBeforeDate(userId);
  
  const notifications: Notification[] = [];
  
  // 1. Fetch from in_app_notifications table
  try {
    const { data: inAppNotifs, error: inAppError } = await client
      .from('in_app_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);
    
    if (!inAppError && inAppNotifs?.length) {
      inAppNotifs.forEach((n: any) => {
        const notifId = `in-app-${n.id}`;
        if (!isNotificationCleared(notifId, n.created_at, clearedIds, clearedBeforeDate)) {
          notifications.push({
            id: notifId,
            type: n.type || 'system',
            title: n.title || 'Notification',
            body: n.body || n.message || '',
            data: n.data,
            read: n.read || readIds.has(notifId),
            created_at: n.created_at,
          });
        }
      });
    }
  } catch (e) {
    console.log('[useNotificationsQuery] in_app_notifications not available:', e);
  }
  
  // 2. Fetch unread messages
  try {
    const { data: participants } = await client
      .from('message_participants')
      .select('thread_id, last_read_at')
      .eq('user_id', userId);
    
    if (participants?.length) {
      for (const participant of participants.slice(0, 15)) {
        const { data: unreadMessages } = await client
          .from('messages')
          .select('id, content, created_at, sender_id, sender:profiles!sender_id(first_name, last_name)')
          .eq('thread_id', participant.thread_id)
          .gt('created_at', participant.last_read_at || '1970-01-01')
          .neq('sender_id', userId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (unreadMessages?.length) {
          const msg = unreadMessages[0];
          const senderName = msg.sender 
            ? `${(msg.sender as any).first_name || ''} ${(msg.sender as any).last_name || ''}`.trim()
            : 'Someone';
          const notifId = `msg-${participant.thread_id}`;
          
          if (!isNotificationCleared(notifId, msg.created_at, clearedIds, clearedBeforeDate)) {
            notifications.push({
              id: notifId,
              type: 'message',
              title: `New message from ${senderName}`,
              body: msg.content?.substring(0, 100) || 'New message',
              data: { threadId: participant.thread_id },
              read: readIds.has(notifId),
              created_at: msg.created_at,
              sender_name: senderName,
            });
          }
        }
      }
    }
  } catch (e) {
    console.log('[useNotificationsQuery] Error fetching messages:', e);
  }
  
  // 3. Fetch missed calls
  try {
    // Note: active_calls table doesn't have foreign keys to profiles,
    // so we fetch calls first, then separately fetch caller profiles
    const { data: calls } = await client
      .from('active_calls')
      .select('*')
      .eq('callee_id', userId)
      .or('status.eq.missed,and(status.eq.ended,duration_seconds.is.null),and(status.eq.ended,duration_seconds.eq.0)')
      .order('started_at', { ascending: false })
      .limit(10);
    
    if (calls?.length) {
      // Fetch caller profiles separately
      const callerIds = [...new Set(calls.map((c: any) => c.caller_id))];
      const { data: callerProfiles } = await client
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', callerIds);
      
      const profileMap = new Map(
        (callerProfiles || []).map((p: any) => [
          p.id,
          `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown'
        ])
      );
      
      calls.forEach((call: any) => {
        // Use caller_name from call record if available, otherwise look up profile
        const callerName = call.caller_name || profileMap.get(call.caller_id) || 'Unknown';
        const notifId = `call-${call.call_id}`;
        
        if (!isNotificationCleared(notifId, call.started_at, clearedIds, clearedBeforeDate)) {
          notifications.push({
            id: notifId,
            type: 'call',
            title: `Missed ${call.call_type || 'voice'} call`,
            body: `You missed a ${call.call_type || 'voice'} call from ${callerName}`,
            data: { callerId: call.caller_id, callType: call.call_type },
            read: readIds.has(notifId),
            created_at: call.started_at,
            sender_name: callerName,
          });
        }
      });
    }
  } catch (e) {
    console.log('[useNotificationsQuery] Error fetching calls:', e);
  }
  
  // Sort by date (newest first)
  notifications.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  
  return notifications;
}

/**
 * Hook to fetch all notifications for the current user
 */
export const useNotificationsQuery = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => fetchNotifications(user!.id),
    enabled: !!user?.id,
    staleTime: 1000 * 30, // 30 seconds
  });
};

export default useNotificationsQuery;
