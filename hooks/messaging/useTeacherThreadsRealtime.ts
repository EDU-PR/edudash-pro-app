/**
 * useTeacherThreadsRealtime — Real-time thread list updates
 * Subscribes to message_threads changes scoped to the organization
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

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
          event: '*',
          schema: 'public',
          table: 'message_threads',
          filter: `preschool_id=eq.${organizationId}`,
        },
        (payload) => {
          logger.debug('ThreadsRealtime', 'Thread changed:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['teacher', 'threads'] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [organizationId, user?.id, queryClient]);
};
