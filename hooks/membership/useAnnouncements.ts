/**
 * useAnnouncements Hook - React Query for Announcements Management
 * Handles fetching and creating announcements for Youth President
 * 
 * Data Source: organization_announcements table
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'general' | 'event' | 'urgent' | 'update';
  audience: 'all' | 'members' | 'leaders';
  isPinned: boolean;
  createdAt: Date;
  author: string;
  readCount: number;
}

export function useAnnouncements(filter: string = 'all') {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;

  return useQuery({
    queryKey: ['announcements', filter, organizationId],
    queryFn: async (): Promise<Announcement[]> => {
      if (!organizationId) return [];
      
      const supabase = assertSupabase();
      
      // Build query
      let query = supabase
        .from('organization_announcements')
        .select(`
          id,
          title,
          content,
          announcement_type,
          target_audience,
          is_pinned,
          created_at,
          created_by,
          expires_at
        `)
        .eq('organization_id', organizationId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);

      // Apply filters
      if (filter === 'pinned') {
        query = query.eq('is_pinned', true);
      } else if (filter !== 'all' && ['general', 'event', 'urgent', 'update'].includes(filter)) {
        query = query.eq('announcement_type', filter);
      }

      const { data: announcements, error } = await query;

      if (error) {
        console.error('Error fetching announcements:', error);
        return [];
      }

      if (!announcements || announcements.length === 0) {
        return [];
      }

      // Get creator names
      const creatorIds = announcements
        .filter(a => a.created_by)
        .map(a => a.created_by);
      
      let creatorNames: Record<string, string> = {};
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', creatorIds);
        
        if (profiles) {
          creatorNames = profiles.reduce((acc, p) => {
            acc[p.id] = p.full_name || p.email || 'Unknown';
            return acc;
          }, {} as Record<string, string>);
        }
      }

      // Get read counts from organization_announcement_recipients
      const announcementIds = announcements.map(a => a.id);
      const { data: readData } = await supabase
        .from('organization_announcement_recipients')
        .select('announcement_id')
        .in('announcement_id', announcementIds)
        .eq('read', true);

      const readCounts: Record<string, number> = {};
      if (readData) {
        for (const r of readData) {
          readCounts[r.announcement_id] = (readCounts[r.announcement_id] || 0) + 1;
        }
      }

      return announcements.map(a => ({
        id: a.id,
        title: a.title || 'Untitled',
        content: a.content || '',
        type: mapAnnouncementType(a.announcement_type),
        audience: mapAudience(a.target_audience),
        isPinned: a.is_pinned || false,
        createdAt: new Date(a.created_at),
        author: a.created_by ? (creatorNames[a.created_by] || 'Unknown') : 'System',
        readCount: readCounts[a.id] || 0,
      }));
    },
    enabled: !!organizationId,
    staleTime: 30000,
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const organizationId = profile?.organization_id;
  
  return useMutation({
    mutationFn: async (announcement: Omit<Announcement, 'id' | 'createdAt' | 'readCount'>) => {
      if (!organizationId || !user?.id) {
        throw new Error('Not authenticated or no organization');
      }

      const supabase = assertSupabase();
      
      const { data, error } = await supabase
        .from('organization_announcements')
        .insert({
          organization_id: organizationId,
          title: announcement.title,
          content: announcement.content,
          announcement_type: announcement.type,
          target_audience: announcement.audience === 'all' ? ['all'] : [announcement.audience],
          is_pinned: announcement.isPinned,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      
      return {
        ...announcement,
        id: data.id,
        createdAt: new Date(data.created_at),
        readCount: 0,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });
}

// Helper functions
function mapAnnouncementType(type: string | null): 'general' | 'event' | 'urgent' | 'update' {
  if (!type) return 'general';
  if (['general', 'event', 'urgent', 'update'].includes(type)) {
    return type as 'general' | 'event' | 'urgent' | 'update';
  }
  return 'general';
}

function mapAudience(audience: string[] | null): 'all' | 'members' | 'leaders' {
  if (!audience || audience.length === 0 || audience.includes('all')) {
    return 'all';
  }
  if (audience.includes('leaders')) return 'leaders';
  if (audience.includes('members')) return 'members';
  return 'all';
}

export const ANNOUNCEMENT_TYPES = [
  { id: 'general', label: 'General', icon: 'information-circle', color: '#6366F1' },
  { id: 'event', label: 'Event', icon: 'calendar', color: '#10B981' },
  { id: 'urgent', label: 'Urgent', icon: 'alert-circle', color: '#EF4444' },
  { id: 'update', label: 'Update', icon: 'refresh-circle', color: '#F59E0B' },
] as const;

export const AUDIENCE_OPTIONS = [
  { id: 'all', label: 'Everyone' },
  { id: 'members', label: 'Members Only' },
  { id: 'leaders', label: 'Leaders Only' },
] as const;
