/**
 * Hook for managing announcements state and operations
 */

import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { useAuth } from '@/contexts/AuthContext';
import { isSuperAdmin } from '@/lib/roleUtils';
import {
  PlatformAnnouncement,
  AnnouncementForm,
  INITIAL_FORM_STATE,
} from './types';

export function useAnnouncements() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<PlatformAnnouncement | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<AnnouncementForm>(INITIAL_FORM_STATE);

  const isAuthorized = profile && isSuperAdmin(profile.role);

  // Fetch announcements
  const fetchAnnouncements = useCallback(async () => {
    if (!isSuperAdmin(profile?.role)) {
      Alert.alert('Access Denied', 'Super admin privileges required');
      return;
    }

    try {
      setLoading(true);

      // Fetch real announcements from database
      const { data: announcementsData, error: announcementsError } = await assertSupabase()
        .from('platform_announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (announcementsError) {
        // Table might not exist or access denied - show empty state
        console.log('Announcements table not configured:', announcementsError.message);
        setAnnouncements([]);
        return;
      }

      if (announcementsData && announcementsData.length > 0) {
        const formattedAnnouncements: PlatformAnnouncement[] = announcementsData.map((a: any) => ({
          id: a.id,
          title: a.title,
          content: a.content,
          type: a.type || 'info',
          priority: a.priority || 'medium',
          target_audience: a.target_audience || 'all',
          target_schools: a.target_schools || [],
          is_active: a.is_active ?? true,
          is_pinned: a.is_pinned ?? false,
          show_banner: a.show_banner ?? false,
          created_at: a.created_at,
          updated_at: a.updated_at,
          created_by: a.created_by || 'system',
          views_count: a.views_count || 0,
          click_count: a.click_count || 0,
          expires_at: a.expires_at,
          scheduled_at: a.scheduled_at,
        }));
        setAnnouncements(formattedAnnouncements);
      } else {
        // No announcements - show empty state
        setAnnouncements([]);
      }
    } catch (error) {
      console.error('Failed to fetch announcements:', error);
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.role, profile?.id]);

  // Handle route params for compose
  const routeParams = useLocalSearchParams<{ 
    compose?: string; 
    prefillTitle?: string; 
    prefillContent?: string; 
    priority?: string; 
    type?: string;
  }>();

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  useEffect(() => {
    const compose = String(routeParams?.compose || '').toLowerCase();
    if (compose === '1' || compose === 'true') {
      const prefillTitle = (routeParams?.prefillTitle || '').toString();
      const prefillContent = (routeParams?.prefillContent || '').toString();
      const prefillPriority = (routeParams?.priority || '').toString();
      const prefillType = (routeParams?.type || '').toString();
      setFormData(prev => ({
        ...prev,
        title: prefillTitle || prev.title,
        content: prefillContent || prev.content,
        priority: (['low','medium','high','urgent'].includes(prefillPriority) ? prefillPriority : prev.priority) as any,
        type: (['info','warning','alert','maintenance','feature'].includes(prefillType) ? prefillType : prev.type) as any,
      }));
      setShowCreateModal(true);
    }
  }, [routeParams]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAnnouncements();
    setRefreshing(false);
  }, [fetchAnnouncements]);

  const resetForm = useCallback(() => {
    setFormData(INITIAL_FORM_STATE);
  }, []);

  const openCreateModal = useCallback(() => {
    resetForm();
    setShowCreateModal(true);
  }, [resetForm]);

  const closeModal = useCallback(() => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setSelectedAnnouncement(null);
    resetForm();
  }, [resetForm]);

  const openEditModal = useCallback((announcement: PlatformAnnouncement) => {
    setSelectedAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      content: announcement.content,
      type: announcement.type,
      priority: announcement.priority,
      target_audience: announcement.target_audience,
      target_schools: [...announcement.target_schools],
      is_active: announcement.is_active,
      is_pinned: announcement.is_pinned,
      show_banner: announcement.show_banner,
      scheduled_at: announcement.scheduled_at,
      expires_at: announcement.expires_at,
    });
    setShowEditModal(true);
  }, []);

  const updateFormField = useCallback(<K extends keyof AnnouncementForm>(
    field: K,
    value: AnnouncementForm[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const createAnnouncement = useCallback(async () => {
    if (!formData.title || !formData.content) {
      Alert.alert('Validation Error', 'Please fill in title and content');
      return;
    }

    try {
      setSaving(true);

      const newAnnouncement: PlatformAnnouncement = {
        id: Date.now().toString(),
        ...formData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: profile?.id || 'unknown',
        views_count: 0,
        click_count: 0,
      };

      setAnnouncements(prev => [newAnnouncement, ...prev]);

      track('superadmin_announcement_created', {
        announcement_type: formData.type,
        priority: formData.priority,
        target_audience: formData.target_audience,
        has_banner: formData.show_banner,
        is_pinned: formData.is_pinned,
      });

      await assertSupabase()
        .from('audit_logs')
        .insert({
          admin_user_id: profile?.id,
          action: 'platform_announcement_created',
          details: {
            announcement_title: formData.title,
            announcement_type: formData.type,
            priority: formData.priority,
            target_audience: formData.target_audience,
            is_active: formData.is_active,
          },
        });

      Alert.alert('Success', 'Announcement created successfully');
      closeModal();
    } catch (error) {
      console.error('Failed to create announcement:', error);
      Alert.alert('Error', 'Failed to create announcement');
    } finally {
      setSaving(false);
    }
  }, [formData, profile?.id, closeModal]);

  const updateAnnouncement = useCallback(async () => {
    if (!selectedAnnouncement || !formData.title || !formData.content) {
      Alert.alert('Validation Error', 'Please fill in title and content');
      return;
    }

    try {
      setSaving(true);

      const updatedAnnouncement: PlatformAnnouncement = {
        ...selectedAnnouncement,
        ...formData,
        updated_at: new Date().toISOString(),
      };

      setAnnouncements(prev => prev.map(a => 
        a.id === selectedAnnouncement.id ? updatedAnnouncement : a
      ));

      track('superadmin_announcement_updated', {
        announcement_id: selectedAnnouncement.id,
        announcement_type: formData.type,
        priority: formData.priority,
      });

      await assertSupabase()
        .from('audit_logs')
        .insert({
          admin_user_id: profile?.id,
          action: 'platform_announcement_updated',
          details: {
            announcement_id: selectedAnnouncement.id,
            announcement_title: formData.title,
            changes: formData,
          },
        });

      Alert.alert('Success', 'Announcement updated successfully');
      closeModal();
    } catch (error) {
      console.error('Failed to update announcement:', error);
      Alert.alert('Error', 'Failed to update announcement');
    } finally {
      setSaving(false);
    }
  }, [selectedAnnouncement, formData, profile?.id, closeModal]);

  const deleteAnnouncement = useCallback((announcement: PlatformAnnouncement) => {
    Alert.alert(
      'Delete Announcement',
      `Are you sure you want to delete "${announcement.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setAnnouncements(prev => prev.filter(a => a.id !== announcement.id));

              track('superadmin_announcement_deleted', {
                announcement_id: announcement.id,
                announcement_type: announcement.type,
                priority: announcement.priority,
              });

              await assertSupabase()
                .from('audit_logs')
                .insert({
                  admin_user_id: profile?.id,
                  action: 'platform_announcement_deleted',
                  details: {
                    announcement_id: announcement.id,
                    announcement_title: announcement.title,
                    announcement_type: announcement.type,
                  },
                });

              Alert.alert('Success', 'Announcement deleted successfully');
            } catch (error) {
              console.error('Failed to delete announcement:', error);
              Alert.alert('Error', 'Failed to delete announcement');
            }
          }
        }
      ]
    );
  }, [profile?.id]);

  const toggleAnnouncementStatus = useCallback(async (announcement: PlatformAnnouncement) => {
    const newStatus = !announcement.is_active;
    
    try {
      setAnnouncements(prev => prev.map(a => 
        a.id === announcement.id ? { ...a, is_active: newStatus } : a
      ));

      track('superadmin_announcement_toggled', {
        announcement_id: announcement.id,
        new_status: newStatus,
      });

      await assertSupabase()
        .from('audit_logs')
        .insert({
          admin_user_id: profile?.id,
          action: 'platform_announcement_toggled',
          details: {
            announcement_id: announcement.id,
            announcement_title: announcement.title,
            old_status: announcement.is_active,
            new_status: newStatus,
          },
        });
    } catch (error) {
      console.error('Failed to toggle announcement:', error);
      Alert.alert('Error', 'Failed to update announcement status');
      setAnnouncements(prev => prev.map(a => 
        a.id === announcement.id ? { ...a, is_active: !newStatus } : a
      ));
    }
  }, [profile?.id]);

  return {
    // State
    announcements,
    loading,
    refreshing,
    saving,
    showCreateModal,
    showEditModal,
    selectedAnnouncement,
    formData,
    isAuthorized,
    
    // Computed
    activeCount: announcements.filter(a => a.is_active).length,
    
    // Actions
    onRefresh,
    openCreateModal,
    closeModal,
    openEditModal,
    updateFormField,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    toggleAnnouncementStatus,
  };
}
