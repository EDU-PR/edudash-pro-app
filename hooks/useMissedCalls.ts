/**
 * Hook for tracking missed calls count
 * 
 * Used by parent dashboard to show badge counter and glow effect
 * on the Calls metric tile.
 */

import { useQuery } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to get count of missed calls for the current user
 * Considers a call "missed" if:
 * - Status is 'missed'
 * - Status is 'ended' but duration is 0 (never answered)
 * - User was the callee (incoming call)
 */
export const useMissedCallsCount = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['missed-calls-count', user?.id],
    queryFn: async (): Promise<number> => {
      if (!user?.id) return 0;
      
      const client = assertSupabase();
      
      try {
        // Get incoming calls that were missed
        // Status 'missed' or status 'ended' with no duration
        const { data: calls, error } = await client
          .from('active_calls')
          .select('id, status, duration_seconds')
          .eq('callee_id', user.id)
          .or('status.eq.missed,and(status.eq.ended,duration_seconds.is.null),and(status.eq.ended,duration_seconds.eq.0)')
          .order('started_at', { ascending: false })
          .limit(100);
        
        if (error) {
          // Table might not exist yet
          if (error.code === '42P01' || error.message?.includes('does not exist')) {
            console.warn('[useMissedCallsCount] active_calls table not found');
            return 0;
          }
          console.error('[useMissedCallsCount] Error:', error);
          return 0;
        }
        
        return calls?.length ?? 0;
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
