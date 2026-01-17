// Hook for managing meetings data and operations

import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { assertSupabase } from '@/lib/supabase';
import type { Meeting, MeetingFormData, MeetingStatus } from '@/components/principal/meetings/types';

interface UseMeetingsOptions {
  organizationId: string | null | undefined;
  userId: string | undefined;
}

export function useMeetings({ organizationId, userId }: UseMeetingsOptions) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  const fetchMeetings = useCallback(async () => {
    if (!organizationId) return;
    
    try {
      const supabase = assertSupabase();
      const today = new Date().toISOString().split('T')[0];
      
      let query = supabase
        .from('school_meetings')
        .select('*')
        .eq('preschool_id', organizationId);
      
      if (activeTab === 'upcoming') {
        query = query
          .gte('meeting_date', today)
          .not('status', 'in', '("cancelled","completed")')
          .order('meeting_date', { ascending: true })
          .order('start_time', { ascending: true });
      } else {
        query = query
          .or(`meeting_date.lt.${today},status.in.("cancelled","completed")`)
          .order('meeting_date', { ascending: false });
      }
      
      const { data, error } = await query.limit(50);
      
      if (error) throw error;
      setMeetings(data || []);
    } catch (error: any) {
      console.error('Error fetching meetings:', error);
      Alert.alert('Error', 'Failed to load meetings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [organizationId, activeTab]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMeetings();
  }, [fetchMeetings]);

  const saveMeeting = useCallback(async (
    formData: MeetingFormData,
    editingMeetingId?: string
  ): Promise<boolean> => {
    if (!formData.title.trim()) {
      Alert.alert('Validation Error', 'Please enter a meeting title');
      return false;
    }
    
    try {
      const supabase = assertSupabase();
      
      const formatTime = (date: Date) => {
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      };
      
      const meetingData = {
        preschool_id: organizationId,
        created_by: userId,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        meeting_type: formData.meeting_type,
        meeting_date: formData.meeting_date.toISOString().split('T')[0],
        start_time: formatTime(formData.start_time),
        end_time: formatTime(formData.end_time),
        duration_minutes: formData.duration_minutes,
        location: formData.location.trim() || null,
        is_virtual: formData.is_virtual,
        virtual_link: formData.is_virtual ? formData.virtual_link.trim() : null,
        agenda_items: formData.agenda_items,
        status: formData.status,
      };
      
      if (editingMeetingId) {
        const { error } = await supabase
          .from('school_meetings')
          .update(meetingData)
          .eq('id', editingMeetingId);
        
        if (error) throw error;
        Alert.alert('Success', 'Meeting updated successfully');
      } else {
        const { error } = await supabase
          .from('school_meetings')
          .insert(meetingData);
        
        if (error) throw error;
        Alert.alert('Success', 'Meeting created successfully');
      }
      
      fetchMeetings();
      return true;
    } catch (error: any) {
      console.error('Error saving meeting:', error);
      Alert.alert('Error', error.message || 'Failed to save meeting');
      return false;
    }
  }, [organizationId, userId, fetchMeetings]);

  const updateStatus = useCallback(async (
    meetingId: string,
    newStatus: MeetingStatus
  ): Promise<boolean> => {
    try {
      const supabase = assertSupabase();
      const { error } = await supabase
        .from('school_meetings')
        .update({ status: newStatus })
        .eq('id', meetingId);
      
      if (error) throw error;
      fetchMeetings();
      return true;
    } catch (error: any) {
      Alert.alert('Error', 'Failed to update status');
      return false;
    }
  }, [fetchMeetings]);

  const deleteMeeting = useCallback(async (meeting: Meeting): Promise<void> => {
    Alert.alert(
      'Delete Meeting',
      `Are you sure you want to delete "${meeting.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const supabase = assertSupabase();
              const { error } = await supabase
                .from('school_meetings')
                .delete()
                .eq('id', meeting.id);
              
              if (error) throw error;
              fetchMeetings();
            } catch (error: any) {
              Alert.alert('Error', 'Failed to delete meeting');
            }
          },
        },
      ]
    );
  }, [fetchMeetings]);

  return {
    meetings,
    loading,
    refreshing,
    activeTab,
    setActiveTab,
    handleRefresh,
    saveMeeting,
    updateStatus,
    deleteMeeting,
  };
}
