/**
 * Calendar Management Screen
 * 
 * Allows principals to create, edit, and delete school calendar events.
 * Separate from the view-only calendar screen.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Switch,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { DesktopLayout } from '@/components/layout/DesktopLayout';
import { useTranslation } from 'react-i18next';
import { extractOrganizationId } from '@/lib/tenant/compat';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

const TARGET_AUDIENCES = [
  { value: 'all', label: 'Everyone' },
  { value: 'parents', label: 'Parents' },
  { value: 'teachers', label: 'Teachers' },
  { value: 'students', label: 'Students' },
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
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
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
      console.error('Error fetching events:', error);
      Alert.alert('Error', 'Failed to load events');
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
      Alert.alert('Validation Error', 'Please enter an event title');
      return;
    }

    if (!orgId || !user?.id) {
      Alert.alert('Error', 'Organization or user not found');
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
        Alert.alert('Success', 'Event updated successfully');
      } else {
        // Create new event
        const { error } = await supabase
          .from('school_events')
          .insert(eventData);
        
        if (error) throw error;
        Alert.alert('Success', 'Event created successfully');
      }

      setShowCreateModal(false);
      fetchEvents();
    } catch (error: any) {
      console.error('Error saving event:', error);
      Alert.alert('Error', error.message || 'Failed to save event');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete event
  const handleDelete = (event: SchoolEvent) => {
    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete "${event.title}"?`,
      [
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
              Alert.alert('Success', 'Event deleted successfully');
              fetchEvents();
            } catch (error: any) {
              console.error('Error deleting event:', error);
              Alert.alert('Error', 'Failed to delete event');
            }
          },
        },
      ]
    );
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
            <ActivityIndicator size="large" color={theme.primary} />
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

        {/* Create/Edit Modal */}
        <Modal
          visible={showCreateModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowCreateModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingEvent ? 'Edit Event' : 'Create Event'}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowCreateModal(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Title */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Event Title *</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.title}
                    onChangeText={(text) => setFormData({ ...formData, title: text })}
                    placeholder="Enter event title"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>

                {/* Description */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Description</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={formData.description}
                    onChangeText={(text) => setFormData({ ...formData, description: text })}
                    placeholder="Enter event description"
                    placeholderTextColor={theme.textSecondary}
                    multiline
                    numberOfLines={4}
                  />
                </View>

                {/* Event Type */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Event Type *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
                    {EVENT_TYPES.map((type) => (
                      <TouchableOpacity
                        key={type.value}
                        style={[
                          styles.typeChip,
                          formData.event_type === type.value && { 
                            backgroundColor: type.color + '20',
                            borderColor: type.color 
                          }
                        ]}
                        onPress={() => setFormData({ ...formData, event_type: type.value })}
                      >
                        <Ionicons 
                          name={type.icon as any} 
                          size={16} 
                          color={formData.event_type === type.value ? type.color : theme.textSecondary} 
                        />
                        <Text style={[
                          styles.typeChipText,
                          formData.event_type === type.value && { color: type.color }
                        ]}>
                          {type.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* All Day Toggle */}
                <View style={styles.formGroup}>
                  <View style={styles.switchRow}>
                    <Text style={styles.label}>All Day Event</Text>
                    <Switch
                      value={formData.all_day}
                      onValueChange={(value) => setFormData({ ...formData, all_day: value })}
                      trackColor={{ false: theme.border, true: theme.primary }}
                      thumbColor="#fff"
                    />
                  </View>
                </View>

                {/* Start Date */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Start Date *</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowStartDatePicker(true)}
                  >
                    <Ionicons name="calendar-outline" size={20} color={theme.primary} />
                    <Text style={styles.dateButtonText}>{formatDate(formData.startDate)}</Text>
                  </TouchableOpacity>
                  {showStartDatePicker && (
                    <DateTimePicker
                      value={formData.startDate}
                      mode="date"
                      display="default"
                      onChange={(event, date) => {
                        setShowStartDatePicker(false);
                        if (date) setFormData({ ...formData, startDate: date });
                      }}
                    />
                  )}
                </View>

                {/* Start Time (if not all day) */}
                {!formData.all_day && (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Start Time</Text>
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={() => setShowStartTimePicker(true)}
                    >
                      <Ionicons name="time-outline" size={20} color={theme.primary} />
                      <Text style={styles.dateButtonText}>{formatTime(formData.startTime)}</Text>
                    </TouchableOpacity>
                    {showStartTimePicker && (
                      <DateTimePicker
                        value={formData.startTime}
                        mode="time"
                        display="default"
                        onChange={(event, date) => {
                          setShowStartTimePicker(false);
                          if (date) setFormData({ ...formData, startTime: date });
                        }}
                      />
                    )}
                  </View>
                )}

                {/* End Date */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>End Date *</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowEndDatePicker(true)}
                  >
                    <Ionicons name="calendar-outline" size={20} color={theme.primary} />
                    <Text style={styles.dateButtonText}>{formatDate(formData.endDate)}</Text>
                  </TouchableOpacity>
                  {showEndDatePicker && (
                    <DateTimePicker
                      value={formData.endDate}
                      mode="date"
                      display="default"
                      onChange={(event, date) => {
                        setShowEndDatePicker(false);
                        if (date) setFormData({ ...formData, endDate: date });
                      }}
                    />
                  )}
                </View>

                {/* End Time (if not all day) */}
                {!formData.all_day && (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>End Time</Text>
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={() => setShowEndTimePicker(true)}
                    >
                      <Ionicons name="time-outline" size={20} color={theme.primary} />
                      <Text style={styles.dateButtonText}>{formatTime(formData.endTime)}</Text>
                    </TouchableOpacity>
                    {showEndTimePicker && (
                      <DateTimePicker
                        value={formData.endTime}
                        mode="time"
                        display="default"
                        onChange={(event, date) => {
                          setShowEndTimePicker(false);
                          if (date) setFormData({ ...formData, endTime: date });
                        }}
                      />
                    )}
                  </View>
                )}

                {/* Location */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Location</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.location}
                    onChangeText={(text) => setFormData({ ...formData, location: text })}
                    placeholder="Enter location"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>

                {/* Target Audience */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Target Audience</Text>
                  <View style={styles.audienceRow}>
                    {TARGET_AUDIENCES.map((audience) => (
                      <TouchableOpacity
                        key={audience.value}
                        style={[
                          styles.audienceChip,
                          formData.target_audience.includes(audience.value) && styles.audienceChipActive
                        ]}
                        onPress={() => toggleAudience(audience.value)}
                      >
                        <Text style={[
                          styles.audienceChipText,
                          formData.target_audience.includes(audience.value) && styles.audienceChipTextActive
                        ]}>
                          {audience.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Send Notifications */}
                <View style={styles.formGroup}>
                  <View style={styles.switchRow}>
                    <Text style={styles.label}>Send Notifications</Text>
                    <Switch
                      value={formData.send_notifications}
                      onValueChange={(value) => setFormData({ ...formData, send_notifications: value })}
                      trackColor={{ false: theme.border, true: theme.primary }}
                      thumbColor="#fff"
                    />
                  </View>
                </View>
              </ScrollView>

              {/* Modal Footer */}
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowCreateModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.submitButton]}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>
                      {editingEvent ? 'Update' : 'Create'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
