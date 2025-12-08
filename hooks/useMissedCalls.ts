/**
 * Hook for tracking missed calls count
 * 
 * Used by parent dashboard to show badge counter and glow effect
 * on the Calls metric tile.
 * 
 * Only counts UNSEEN missed calls - once user views the calls screen,
 * the count resets to 0.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CALLS_LAST_SEEN_KEY = 'calls_last_seen_at';

/**
 * Get the last time user viewed the calls screen
 */
const getLastSeenCalls = async (userId: string): Promise<string | null> => {
  try {
    const key = `${CALLS_LAST_SEEN_KEY}_${userId}`;
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
};

/**
 * Save the current time as last seen calls
 */
const setLastSeenCalls = async (userId: string): Promise<void> => {
  try {
    const key = `${CALLS_LAST_SEEN_KEY}_${userId}`;
    await AsyncStorage.setItem(key, new Date().toISOString());
  } catch (error) {
    console.error('[setLastSeenCalls] Error:', error);
  }
};

/**
 * Hook to get count of UNSEEN missed calls for the current user
 * Only counts missed calls that occurred after the user last viewed the calls screen.
 */
export const useMissedCallsCount = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['missed-calls-count', user?.id],
    queryFn: async (): Promise<number> => {
      if (!user?.id) return 0;
      
      const client = assertSupabase();
      
      try {
        // Get last seen timestamp
        const lastSeen = await getLastSeenCalls(user.id);
        
        // Build query for missed calls
        let query = client
          .from('active_calls')
          .select('id, status, duration_seconds, started_at', { count: 'exact', head: true })
          .eq('callee_id', user.id)
          .or('status.eq.missed,and(status.eq.ended,duration_seconds.is.null),and(status.eq.ended,duration_seconds.eq.0)');
        
        // Only count calls after last seen
        if (lastSeen) {
          query = query.gt('started_at', lastSeen);
        }
        
        const { count, error } = await query;
        
        if (error) {
          // Table might not exist yet
          if (error.code === '42P01' || error.message?.includes('does not exist')) {
            console.warn('[useMissedCallsCount] active_calls table not found');
            return 0;
          }
          console.error('[useMissedCallsCount] Error:', error);
          return 0;
        }
        
        return count ?? 0;
      } catch (error) {
        console.error('[useMissedCallsCount] Exception:', error);
        return 0;
      }
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60, // 1 minute
    refetchInterval: 1000 * 60 * 2, // Refetch every 2 minutes
  });
};

/**
 * Hook to mark calls as seen (when user views the calls screen)
 */
export const useMarkCallsSeen = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      await setLastSeenCalls(user.id);
    },
    onSuccess: () => {
      // Invalidate the count so badge updates
      queryClient.invalidateQueries({ queryKey: ['missed-calls-count'] });
    },
  });
};

/**
 * Hook to get recent missed calls (for notifications or quick view)
 */
export const useRecentMissedCalls = (limit: number = 5) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['recent-missed-calls', user?.id, limit],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const client = assertSupabase();
      
      try {
        const { data: calls, error } = await client
          .from('active_calls')
          .select(`
            *,
            caller:profiles!active_calls_caller_id_fkey(id, first_name, last_name)
          `)
          .eq('callee_id', user.id)
          .or('status.eq.missed,and(status.eq.ended,duration_seconds.is.null),and(status.eq.ended,duration_seconds.eq.0)')
          .order('started_at', { ascending: false })
          .limit(limit);
        
        if (error) {
          if (error.code === '42P01' || error.message?.includes('does not exist')) {
            return [];
          }
          console.error('[useRecentMissedCalls] Error:', error);
          return [];
        }
        
        return calls?.map(call => ({
          id: call.id,
          callerName: call.caller 
            ? `${call.caller.first_name || ''} ${call.caller.last_name || ''}`.trim() || 'Unknown'
            : 'Unknown',
          callType: call.call_type,
          startedAt: call.started_at,
        })) ?? [];
      } catch (error) {
        console.error('[useRecentMissedCalls] Exception:', error);
        return [];
      }
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60,
  });
};

export default useMissedCallsCount;
