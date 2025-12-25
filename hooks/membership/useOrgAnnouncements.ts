/**
 * useOrgAnnouncements - Hook for managing organization announcements
 * Provides reactive state for announcements with real-time updates
 */

import { useState, useEffect, useCallback } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import OrganizationAnnouncementService, {
  type OrganizationAnnouncement,
  type AnnouncementFilters,
  type CreateAnnouncementInput,
} from '@/lib/services/organizationAnnouncementService';

interface UseOrgAnnouncementsOptions {
  organizationId?: string | null;
  autoFetch?: boolean;
  filters?: AnnouncementFilters;
  limit?: number;
  enableRealtime?: boolean;
}

interface UseOrgAnnouncementsReturn {
  announcements: OrganizationAnnouncement[];
  loading: boolean;
  error: string | null;
  unreadCount: number;
  refresh: () => Promise<void>;
  create: (input: CreateAnnouncementInput) => Promise<{ success: boolean; error?: string }>;
  markAsRead: (announcementId: string) => Promise<void>;
  deleteAnnouncement: (announcementId: string) => Promise<{ success: boolean; error?: string }>;
}

export function useOrgAnnouncements(options: UseOrgAnnouncementsOptions = {}): UseOrgAnnouncementsReturn {
  const {
    organizationId: providedOrgId,
    autoFetch = true,
    filters,
    limit = 50,
    enableRealtime = true,
  } = options;

  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<OrganizationAnnouncement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [organizationId, setOrganizationId] = useState<string | null>(providedOrgId || null);

  // Fetch organization ID if not provided
  useEffect(() => {
    if (providedOrgId) {
      setOrganizationId(providedOrgId);
      return;
    }

    const fetchOrgId = async () => {
      if (!user?.id) return;
      
      try {
        const { data: member } = await assertSupabase()
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();
        
        if (member?.organization_id) {
          setOrganizationId(member.organization_id);
        }
      } catch (err) {
        console.error('[useOrgAnnouncements] Error fetching org ID:', err);
      }
    };

    fetchOrgId();
  }, [user?.id, providedOrgId]);

  // Fetch announcements
  const fetchAnnouncements = useCallback(async () => {
    if (!organizationId) return;
    
    setLoading(true);
    setError(null);

    try {
      const result = await OrganizationAnnouncementService.getAnnouncements(
        organizationId,
        filters,
        limit
      );

      if (result.success && result.data) {
        setAnnouncements(result.data);
      } else {
        setError(result.error || 'Failed to fetch announcements');
      }
    } catch (err) {
      console.error('[useOrgAnnouncements] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [organizationId, filters, limit]);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const result = await OrganizationAnnouncementService.getUnreadCount(user.id);
      if (result.success) {
        setUnreadCount(result.count || 0);
      }
    } catch (err) {
      console.error('[useOrgAnnouncements] Unread count error:', err);
    }
  }, [user?.id]);

  // Auto-fetch on mount and when dependencies change
  useEffect(() => {
    if (autoFetch && organizationId) {
      fetchAnnouncements();
      fetchUnreadCount();
    }
  }, [autoFetch, organizationId, fetchAnnouncements, fetchUnreadCount]);

  // Real-time subscription
  useEffect(() => {
    if (!enableRealtime || !organizationId) return;

    const channel = assertSupabase()
      .channel(`org-announcements-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'organization_announcements',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          console.log('[useOrgAnnouncements] Realtime update:', payload.eventType);
          
          if (payload.eventType === 'INSERT') {
            const newAnnouncement = payload.new as OrganizationAnnouncement;
            setAnnouncements((prev) => [newAnnouncement, ...prev]);
            setUnreadCount((prev) => prev + 1);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as OrganizationAnnouncement;
            setAnnouncements((prev) =>
              prev.map((a) => (a.id === updated.id ? updated : a))
            );
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string };
            setAnnouncements((prev) => prev.filter((a) => a.id !== deleted.id));
          }
        }
      )
      .subscribe();

    return () => {
      assertSupabase().removeChannel(channel);
    };
  }, [enableRealtime, organizationId]);

  // Create announcement
  const create = useCallback(async (input: CreateAnnouncementInput) => {
    if (!organizationId || !user?.id) {
      return { success: false, error: 'Not authenticated or no organization' };
    }

    const result = await OrganizationAnnouncementService.create(
      organizationId,
      user.id,
      input
    );

    if (result.success) {
      // Refresh to get the full announcement with joins
      await fetchAnnouncements();
    }

    return result;
  }, [organizationId, user?.id, fetchAnnouncements]);

  // Mark as read
  const markAsRead = useCallback(async (announcementId: string) => {
    if (!user?.id) return;

    const result = await OrganizationAnnouncementService.markAsRead(
      announcementId,
      user.id
    );

    if (result.success) {
      // Update local state
      setAnnouncements((prev) =>
        prev.map((a) =>
          a.id === announcementId
            ? { ...a, read_by: [...(a.read_by || []), user.id] }
            : a
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  }, [user?.id]);

  // Delete announcement
  const deleteAnnouncement = useCallback(async (announcementId: string) => {
    const result = await OrganizationAnnouncementService.delete(announcementId);

    if (result.success) {
      setAnnouncements((prev) => prev.filter((a) => a.id !== announcementId));
    }

    return result;
  }, []);

  // Refresh function
  const refresh = useCallback(async () => {
    await Promise.all([fetchAnnouncements(), fetchUnreadCount()]);
  }, [fetchAnnouncements, fetchUnreadCount]);

  return {
    announcements,
    loading,
    error,
    unreadCount,
    refresh,
    create,
    markAsRead,
    deleteAnnouncement,
  };
}

export default useOrgAnnouncements;
