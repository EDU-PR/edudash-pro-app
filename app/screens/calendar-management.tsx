/**
 * Calendar Management Screen
 * 
 * Allows principals to create, edit, and delete school calendar events.
 * Separate from the view-only calendar screen.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { DesktopLayout } from '@/components/layout/DesktopLayout';
import { useTranslation } from 'react-i18next';
import { extractOrganizationId } from '@/lib/tenant/compat';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import { logger } from '@/lib/logger';
import CalendarEventFormModal from '@/components/principal/CalendarEventFormModal';
const EVENT_TYPES = [
  { value: 'holiday', label: 'Holiday', icon: 'sunny-outline', color: '#EF4444' },
  { value: 'parent_meeting', label: 'Parent Meeting', icon: 'people-outline', color: '#8B5CF6' },
  { value: 'field_trip', label: 'Field Trip', icon: 'bus-outline', color: '#10B981' },
  { value: 'assembly', label: 'Assembly', icon: 'megaphone-outline', color: '#F59E0B' },
  { value: 'sports_day', label: 'Sports Day', icon: 'football-outline', color: '#3B82F6' },
  { value: 'graduation', label: 'Graduation', icon: 'school-outline', color: '#EC4899' },
  { value: 'fundraiser', label: 'Fundraiser', icon: 'cash-outline', color: '#14B8A6' },
  { value: 'workshop', label: 'Workshop', icon: 'construct-outline', color: '#8B5CF6' },
  { value: 'staff_meeting', label: 'Staff Meeting', icon: 'people-outline', color: '#6366F1' },
  { value: 'open_house', label: 'Open House', icon: 'home-outline', color: '#F59E0B' },
  { value: 'other', label: 'Other', icon: 'calendar-outline', color: '#6B7280' },
];



interface SchoolEvent {
  id: string;
  title: string;
  description?: string;
  event_type: string;
  start_date: string;
  end_date: string;
  all_day: boolean;
  location?: string;
  target_audience: string[];
  status: string;
  created_at: string;
}

export default function CalendarManagementScreen() {
  const { theme } = useTheme();
  const { profile, user } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { showAlert, alertProps } = useAlertModal();
  const styles = createStyles(theme, insets);
  
  const orgId = extractOrganizationId(profile);
  
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<SchoolEvent | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_type: 'other',
    startDate: new Date(),
    endDate: new Date(),
    startTime: new Date(),
    endTime: new Date(),
    all_day: false,
    location: '',
    target_audience: ['all'] as string[],
    send_notifications: true,
  });
  const [submitting, setSubmitting] = useState(false);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    if (!orgId) return;
    
    try {
      const supabase = assertSupabase();
      const { data, error } = await supabase
        .from('school_events')
        .select('*')
        .eq('preschool_id', orgId)
        .order('start_date', { ascending: true });
      
      if (error) throw error;
      setEvents(data || []);
    } catch (error: any) {
      logger.error('CalendarMgmt', 'Error fetching events', error);
      showAlert({ title: 'Error', message: 'Failed to load events' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchEvents();
  };

  // Open create modal
  const openCreateModal = () => {
    setFormData({
      title: '',
      description: '',
      event_type: 'other',
      startDate: new Date(),
      endDate: new Date(),
      startTime: new Date(),
      endTime: new Date(),
      all_day: false,
      location: '',
      target_audience: ['all'],
      send_notifications: true,
    });
    setEditingEvent(null);
    setShowCreateModal(true);
  };

  // Open edit modal
  const openEditModal = (event: SchoolEvent) => {
    const startDate = new Date(event.start_date);
    const endDate = new Date(event.end_date);
    setFormData({
      title: event.title,
      description: event.description || '',
      event_type: event.event_type,
      startDate,
      endDate,
      startTime: startDate,
      endTime: endDate,
      all_day: event.all_day,
      location: event.location || '',
      target_audience: event.target_audience || ['all'],
      send_notifications: true,
    });
    setEditingEvent(event);
    setShowCreateModal(true);
  };

  // Toggle target audience
  const toggleAudience = (audience: string) => {
    if (audience === 'all') {
      setFormData({ ...formData, target_audience: ['all'] });
    } else {
      const filtered = formData.target_audience.filter(a => a !== 'all');
      if (filtered.includes(audience)) {
        setFormData({ ...formData, target_audience: filtered.filter(a => a !== audience) });
      } else {
        setFormData({ ...formData, target_audience: [...filtered, audience] });
      }
    }
  };

  // Submit form
  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      showAlert({ title: 'Validation Error', message: 'Please enter an event title' });
      return;
    }

    if (!orgId || !user?.id) {
      showAlert({ title: 'Error', message: 'Organization or user not found' });
      return;
    }

    setSubmitting(true);
    try {
      const supabase = assertSupabase();
      
      // Build start and end timestamps
      const startDateTime = formData.all_day
        ? new Date(formData.startDate.getFullYear(), formData.startDate.getMonth(), formData.startDate.getDate(), 0, 0, 0)
        : new Date(
            formData.startDate.getFullYear(),
            formData.startDate.getMonth(),
            formData.startDate.getDate(),
            formData.startTime.getHours(),
            formData.startTime.getMinutes()
          );
      
      const endDateTime = formData.all_day
        ? new Date(formData.endDate.getFullYear(), formData.endDate.getMonth(), formData.endDate.getDate(), 23, 59, 59)
        : new Date(
            formData.endDate.getFullYear(),
            formData.endDate.getMonth(),
            formData.endDate.getDate(),
            formData.endTime.getHours(),
            formData.endTime.getMinutes()
          );

      const eventData = {
        preschool_id: orgId,
        created_by: user.id,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        event_type: formData.event_type,
        start_date: startDateTime.toISOString(),
        end_date: endDateTime.toISOString(),
        all_day: formData.all_day,
        location: formData.location.trim() || null,
        target_audience: formData.target_audience,
        send_notifications: formData.send_notifications,
        status: 'scheduled',
      };

      if (editingEvent) {
        // Update existing event
        const { error } = await supabase
          .from('school_events')
          .update(eventData)
          .eq('id', editingEvent.id);
        
        if (error) throw error;
        
        // Send update notification if notifications enabled
        if (formData.send_notifications) {
          try {
            await supabase.functions.invoke('notifications-dispatcher', {
              body: {
                event_type: 'school_event_updated',
                event_id: editingEvent.id,
                preschool_id: orgId,
                target_audience: formData.target_audience,
              }
            });
          } catch (notifyError) {
            logger.error('CalendarMgmt', 'Failed to send event notification', notifyError);
          }
        }
        
        showAlert({ title: 'Success', message: 'Event updated successfully' });
      } else {
        // Create new event
        const { data: newEvent, error } = await supabase
          .from('school_events')
          .insert(eventData)
          .select()
          .single();
        
        if (error) throw error;
        
        // Send notification for new event if notifications enabled
        if (formData.send_notifications && newEvent) {
          try {
            await supabase.functions.invoke('notifications-dispatcher', {
              body: {
                event_type: 'school_event_created',
                event_id: newEvent.id,
                preschool_id: orgId,
                target_audience: formData.target_audience,
              }
            });
            logger.debug('CalendarMgmt', 'Event notification sent to target audience');
          } catch (notifyError) {
            logger.error('CalendarMgmt', 'Failed to send create notification', notifyError);
          }
        }
        
        showAlert({ title: 'Success', message: 'Event created successfully' });
      }

      setShowCreateModal(false);
      fetchEvents();
    } catch (error: any) {
      logger.error('CalendarMgmt', 'Error saving event', error);
      showAlert({ title: 'Error', message: error.message || 'Failed to save event' });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete event
  const handleDelete = (event: SchoolEvent) => {
    showAlert({
      title: 'Delete Event',
      message: `Are you sure you want to delete "${event.title}"?`,
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const supabase = assertSupabase();
              const { error } = await supabase
                .from('school_events')
                .delete()
                .eq('id', event.id);
              if (error) throw error;
              showAlert({ title: 'Success', message: 'Event deleted successfully' });
              fetchEvents();
            } catch (error: any) {
              logger.error('CalendarMgmt', 'Error deleting event', error);
              showAlert({ title: 'Error', message: 'Failed to delete event' });
            }
          },
        },
      ],
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-ZA', { 
      weekday: 'short',
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-ZA', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const getEventTypeConfig = (type: string) => {
    return EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[EVENT_TYPES.length - 1];
  };

  return (
    <DesktopLayout role="principal" title={t('calendar.manage', { defaultValue: 'Manage Calendar' })}>
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        
        {/* Header with Create Button */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.createButton}
            onPress={openCreateModal}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.createButtonText}>Create Event</Text>
          </TouchableOpacity>
        </View>

        {/* Events List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <EduDashSpinner size="large" color={theme.primary} />
            <Text style={styles.loadingText}>Loading events...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.eventsList}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[theme.primary]}
              />
            }
          >
            {events.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="calendar-outline" size={64} color={theme.textSecondary} />
                <Text style={styles.emptyTitle}>No Events</Text>
                <Text style={styles.emptySubtitle}>Create your first event to get started</Text>
              </View>
            ) : (
              events.map((event) => {
                const config = getEventTypeConfig(event.event_type);
                const startDate = new Date(event.start_date);
                const endDate = new Date(event.end_date);
                
                return (
                  <View key={event.id} style={styles.eventCard}>
                    <View style={[styles.eventTypeIndicator, { backgroundColor: config.color }]} />
                    <View style={styles.eventContent}>
                      <View style={styles.eventHeader}>
                        <View style={styles.eventTitleRow}>
                          <Ionicons name={config.icon as any} size={20} color={config.color} />
                          <Text style={styles.eventTitle}>{event.title}</Text>
                        </View>
                        <View style={styles.eventActions}>
                          <TouchableOpacity
                            onPress={() => openEditModal(event)}
                            style={styles.actionButton}
                          >
                            <Ionicons name="pencil" size={18} color={theme.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDelete(event)}
                            style={styles.actionButton}
                          >
                            <Ionicons name="trash" size={18} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                      
                      <Text style={styles.eventDate}>
                        {formatDate(startDate)}
                        {!event.all_day && ` • ${formatTime(startDate)}`}
                        {endDate.getTime() !== startDate.getTime() && ` - ${formatDate(endDate)}`}
                      </Text>
                      
                      {event.location && (
                        <View style={styles.eventMeta}>
                          <Ionicons name="location-outline" size={14} color={theme.textSecondary} />
                          <Text style={styles.eventMetaText}>{event.location}</Text>
                        </View>
                      )}
                      
                      {event.description && (
                        <Text style={styles.eventDescription} numberOfLines={2}>
                          {event.description}
                        </Text>
                      )}
                      
                      <View style={styles.eventBadges}>
                        <View style={[styles.badge, { backgroundColor: config.color + '20' }]}>
                          <Text style={[styles.badgeText, { color: config.color }]}>
                            {config.label}
                          </Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: theme.primary + '20' }]}>
                          <Text style={[styles.badgeText, { color: theme.primary }]}>
                            {event.target_audience.join(', ')}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        <CalendarEventFormModal
          visible={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          isEditing={!!editingEvent}
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleSubmit}
          submitting={submitting}
          toggleAudience={toggleAudience}
          formatDate={formatDate}
          formatTime={formatTime}
          theme={theme}
          styles={styles}
        />
        <AlertModal {...alertProps} />
      </View>
    </DesktopLayout>
  );
}

const createStyles = (theme: any, insets: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: theme.textSecondary,
    fontSize: 14,
  },
  eventsList: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: theme.cardBackground,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.border,
  },
  eventTypeIndicator: {
    width: 4,
  },
  eventContent: {
    flex: 1,
    padding: 16,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    flex: 1,
  },
  eventActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 4,
  },
  eventDate: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 8,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  eventMetaText: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  eventDescription: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 8,
  },
  eventBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: insets.bottom,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.text,
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    maxHeight: 500,
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.cardBackground,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    padding: 12,
    color: theme.text,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  typeScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    marginRight: 8,
  },
  typeChipText: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.cardBackground,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    padding: 12,
  },
  dateButtonText: {
    fontSize: 16,
    color: theme.text,
  },
  audienceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  audienceChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.cardBackground,
  },
  audienceChipActive: {
    backgroundColor: theme.primary + '20',
    borderColor: theme.primary,
  },
  audienceChipText: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  audienceChipTextActive: {
    color: theme.primary,
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: theme.cardBackground,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cancelButtonText: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: theme.primary,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
