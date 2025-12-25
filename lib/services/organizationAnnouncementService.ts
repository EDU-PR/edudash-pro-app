/**
 * Organization Announcement Service
 * Handles broadcasts/announcements from President to organization members
 * Supports: skills, membership, and similar organization types
 */

import { assertSupabase } from '@/lib/supabase';

// ============================================================================
// TYPES
// ============================================================================

export type TargetAudience = 'all' | 'regional_managers' | 'branch_managers' | 'members';
export type AnnouncementPriority = 'low' | 'normal' | 'high' | 'urgent';
export type AnnouncementType = 'general' | 'policy' | 'event' | 'financial' | 'strategic' | 'emergency';

export interface OrganizationAnnouncement {
  id: string;
  organization_id: string;
  author_id: string;
  title: string;
  content: string;
  target_audience: TargetAudience;
  target_region_id: string | null;
  priority: AnnouncementPriority;
  announcement_type: AnnouncementType;
  attachments: string[];
  is_published: boolean;
  published_at: string | null;
  expires_at: string | null;
  read_by: string[];
  created_at: string;
  updated_at: string;
  // Joined fields
  author?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  target_region?: {
    id: string;
    name: string;
  };
}

export interface CreateAnnouncementInput {
  title: string;
  content: string;
  target_audience?: TargetAudience;
  target_region_id?: string | null;
  priority?: AnnouncementPriority;
  announcement_type?: AnnouncementType;
  attachments?: string[];
  expires_at?: string | null;
}

export interface UpdateAnnouncementInput extends Partial<CreateAnnouncementInput> {
  is_published?: boolean;
}

export interface AnnouncementFilters {
  target_audience?: TargetAudience;
  announcement_type?: AnnouncementType;
  priority?: AnnouncementPriority;
  is_published?: boolean;
  include_expired?: boolean;
}

// ============================================================================
// SERVICE
// ============================================================================

export class OrganizationAnnouncementService {
  /**
   * Create a new organization announcement
   */
  static async create(
    organizationId: string,
    authorId: string,
    input: CreateAnnouncementInput
  ): Promise<{ success: boolean; data?: OrganizationAnnouncement; error?: string }> {
    try {
      console.log('📢 [OrgAnnouncement] Creating announcement:', input.title);

      const { data, error } = await assertSupabase()
        .from('organization_announcements')
        .insert({
          organization_id: organizationId,
          author_id: authorId,
          title: input.title,
          content: input.content,
          target_audience: input.target_audience || 'all',
          target_region_id: input.target_region_id || null,
          priority: input.priority || 'normal',
          announcement_type: input.announcement_type || 'general',
          attachments: input.attachments || [],
          expires_at: input.expires_at || null,
          is_published: true,
          published_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('❌ [OrgAnnouncement] Create error:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ [OrgAnnouncement] Created successfully:', data.id);
      return { success: true, data };
    } catch (err) {
      console.error('💥 [OrgAnnouncement] Unexpected error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Get announcements for an organization with optional filters
   */
  static async getAnnouncements(
    organizationId: string,
    filters?: AnnouncementFilters,
    limit = 50
  ): Promise<{ success: boolean; data?: OrganizationAnnouncement[]; error?: string }> {
    try {
      let query = assertSupabase()
        .from('organization_announcements')
        .select(`
          *,
          author:profiles!author_id(id, full_name, avatar_url),
          target_region:organization_regions!target_region_id(id, name)
        `)
        .eq('organization_id', organizationId)
        .order('published_at', { ascending: false })
        .limit(limit);

      // Apply filters
      if (filters?.target_audience) {
        query = query.eq('target_audience', filters.target_audience);
      }
      if (filters?.announcement_type) {
        query = query.eq('announcement_type', filters.announcement_type);
      }
      if (filters?.priority) {
        query = query.eq('priority', filters.priority);
      }
      if (filters?.is_published !== undefined) {
        query = query.eq('is_published', filters.is_published);
      }
      if (!filters?.include_expired) {
        query = query.or('expires_at.is.null,expires_at.gt.now()');
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ [OrgAnnouncement] Fetch error:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (err) {
      console.error('💥 [OrgAnnouncement] Unexpected error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Get a single announcement by ID
   */
  static async getById(
    announcementId: string
  ): Promise<{ success: boolean; data?: OrganizationAnnouncement; error?: string }> {
    try {
      const { data, error } = await assertSupabase()
        .from('organization_announcements')
        .select(`
          *,
          author:profiles!author_id(id, full_name, avatar_url),
          target_region:organization_regions!target_region_id(id, name)
        `)
        .eq('id', announcementId)
        .single();

      if (error) {
        console.error('❌ [OrgAnnouncement] Fetch by ID error:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err) {
      console.error('💥 [OrgAnnouncement] Unexpected error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Update an announcement
   */
  static async update(
    announcementId: string,
    input: UpdateAnnouncementInput
  ): Promise<{ success: boolean; data?: OrganizationAnnouncement; error?: string }> {
    try {
      console.log('📝 [OrgAnnouncement] Updating announcement:', announcementId);

      const { data, error } = await assertSupabase()
        .from('organization_announcements')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq('id', announcementId)
        .select()
        .single();

      if (error) {
        console.error('❌ [OrgAnnouncement] Update error:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ [OrgAnnouncement] Updated successfully');
      return { success: true, data };
    } catch (err) {
      console.error('💥 [OrgAnnouncement] Unexpected error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Delete an announcement
   */
  static async delete(
    announcementId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🗑️ [OrgAnnouncement] Deleting announcement:', announcementId);

      const { error } = await assertSupabase()
        .from('organization_announcements')
        .delete()
        .eq('id', announcementId);

      if (error) {
        console.error('❌ [OrgAnnouncement] Delete error:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ [OrgAnnouncement] Deleted successfully');
      return { success: true };
    } catch (err) {
      console.error('💥 [OrgAnnouncement] Unexpected error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Mark announcement as read by user
   */
  static async markAsRead(
    announcementId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await assertSupabase().rpc('mark_org_announcement_read', {
        p_announcement_id: announcementId,
        p_user_id: userId,
      });

      if (error) {
        console.error('❌ [OrgAnnouncement] Mark read error:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      console.error('💥 [OrgAnnouncement] Unexpected error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Get unread announcement count for user
   */
  static async getUnreadCount(
    userId: string
  ): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
      const { data, error } = await assertSupabase().rpc('get_unread_org_announcements_count', {
        p_user_id: userId,
      });

      if (error) {
        console.error('❌ [OrgAnnouncement] Unread count error:', error);
        return { success: false, error: error.message };
      }

      return { success: true, count: data || 0 };
    } catch (err) {
      console.error('💥 [OrgAnnouncement] Unexpected error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Get announcements for the current user (respects RLS and targeting)
   */
  static async getMyAnnouncements(
    limit = 20
  ): Promise<{ success: boolean; data?: OrganizationAnnouncement[]; error?: string }> {
    try {
      const { data, error } = await assertSupabase()
        .from('organization_announcements')
        .select(`
          *,
          author:profiles!author_id(id, full_name, avatar_url),
          target_region:organization_regions!target_region_id(id, name)
        `)
        .eq('is_published', true)
        .or('expires_at.is.null,expires_at.gt.now()')
        .order('published_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ [OrgAnnouncement] My announcements error:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (err) {
      console.error('💥 [OrgAnnouncement] Unexpected error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }
}

export default OrganizationAnnouncementService;
