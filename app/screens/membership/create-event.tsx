/**
 * Create Event Screen
 * Allows Youth President and executives to create events
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardWallpaperBackground } from '@/components/membership/dashboard';
import { useQueryClient } from '@tanstack/react-query';
import DateTimePicker from '@react-native-community/datetimepicker';

const EVENT_TYPES = [
  { value: 'meeting', label: 'Meeting', icon: 'people' },
  { value: 'workshop', label: 'Workshop', icon: 'construct' },
  { value: 'training', label: 'Training', icon: 'school' },
  { value: 'social', label: 'Social', icon: 'happy' },
  { value: 'deadline', label: 'Deadline', icon: 'calendar' },
  { value: 'webinar', label: 'Webinar', icon: 'videocam' },
];

export default function CreateEventScreen() {
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;
  const userId = user?.id;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState('meeting');
  const [location, setLocation] = useState('');
  const [isVirtual, setIsVirtual] = useState(false);
  const [virtualLink, setVirtualLink] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 3600000)); // 1 hour later
  const [allDay, setAllDay] = useState(false);
  const [maxAttendees, setMaxAttendees] = useState('');
  const [isMandatory, setIsMandatory] = useState(false);
  const [requiresRegistration, setRequiresRegistration] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Event title is required');
      return;
    }

    if (!orgId || !userId) {
      Alert.alert('Error', 'Organization or user information missing');
      return;
    }

    setSaving(true);
    try {
      const supabase = assertSupabase();

      // Create event
      const { data: newEvent, error } = await supabase
        .from('organization_events')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          event_type: eventType,
          location: location.trim() || null,
          is_virtual: isVirtual,
          virtual_link: virtualLink.trim() || null,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          all_day: allDay,
          max_attendees: maxAttendees ? parseInt(maxAttendees) : null,
          is_mandatory: isMandatory,
          requires_registration: requiresRegistration,
          organization_id: orgId,
          created_by: userId,
          status: 'upcoming',
        })
        .select('id, title')
        .single();

      if (error) throw error;

      // Invalidate queries to refresh events list
      queryClient.invalidateQueries({ queryKey: ['youth-events'] });
      queryClient.invalidateQueries({ queryKey: ['organization-events'] });

      Alert.alert(
        'Event Created!',
        `${newEvent.title} has been created successfully.`,
        [
          {
            text: 'Create Another',
            style: 'cancel',
            onPress: () => {
              // Reset form
              setTitle('');
              setDescription('');
              setEventType('meeting');
              setLocation('');
              setIsVirtual(false);
              setVirtualLink('');
              setStartDate(new Date());
              setEndDate(new Date(Date.now() + 3600000));
              setAllDay(false);
              setMaxAttendees('');
              setIsMandatory(false);
              setRequiresRegistration(false);
            },
          },
          {
            text: 'View Events',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error creating event:', error);
      Alert.alert('Error', error.message || 'Failed to create event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardWallpaperBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Create Event',
            headerStyle: { backgroundColor: theme.surface },
            headerTintColor: theme.text,
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </TouchableOpacity>
            ),
          }}
        />

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.text }]}>Event Title *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g., Youth Leadership Summit"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.text }]}>Description</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Describe the event..."
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.text }]}>Event Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
                {EVENT_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.typeChip,
                      {
                        backgroundColor: eventType === type.value ? '#06B6D4' : theme.card,
                        borderColor: eventType === type.value ? '#06B6D4' : theme.border,
                      },
                    ]}
                    onPress={() => setEventType(type.value)}
                  >
                    <Ionicons name={type.icon as any} size={18} color={eventType === type.value ? '#fff' : theme.text} />
                    <Text style={[styles.typeText, { color: eventType === type.value ? '#fff' : theme.text }]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.field}>
              <View style={styles.switchRow}>
                <Text style={[styles.label, { color: theme.text }]}>Virtual Event</Text>
                <Switch value={isVirtual} onValueChange={setIsVirtual} trackColor={{ false: theme.border, true: '#06B6D4' }} />
              </View>
              {isVirtual && (
                <TextInput
                  style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border, marginTop: 8 }]}
                  value={virtualLink}
                  onChangeText={setVirtualLink}
                  placeholder="Virtual meeting link (Zoom, Teams, etc.)"
                  placeholderTextColor={theme.textSecondary}
                />
              )}
            </View>

            {!isVirtual && (
              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.text }]}>Location</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Event location"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
            )}

            <View style={styles.row}>
              <View style={[styles.field, styles.halfField]}>
                <Text style={[styles.label, { color: theme.text }]}>Start Date & Time</Text>
                <TouchableOpacity
                  style={[styles.dateButton, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => setShowStartPicker(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color={theme.primary} />
                  <Text style={[styles.dateText, { color: theme.text }]}>
                    {startDate.toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}
                  </Text>
                </TouchableOpacity>
                {showStartPicker && (
                  <DateTimePicker
                    value={startDate}
                    mode={allDay ? 'date' : 'datetime'}
                    is24Hour={true}
                    onChange={(event, selectedDate) => {
                      setShowStartPicker(false);
                      if (selectedDate) setStartDate(selectedDate);
                    }}
                  />
                )}
              </View>

              <View style={[styles.field, styles.halfField]}>
                <Text style={[styles.label, { color: theme.text }]}>End Date & Time</Text>
                <TouchableOpacity
                  style={[styles.dateButton, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => setShowEndPicker(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color={theme.primary} />
                  <Text style={[styles.dateText, { color: theme.text }]}>
                    {endDate.toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}
                  </Text>
                </TouchableOpacity>
                {showEndPicker && (
                  <DateTimePicker
                    value={endDate}
                    mode={allDay ? 'date' : 'datetime'}
                    is24Hour={true}
                    onChange={(event, selectedDate) => {
                      setShowEndPicker(false);
                      if (selectedDate) setEndDate(selectedDate);
                    }}
                  />
                )}
              </View>
            </View>

            <View style={styles.field}>
              <View style={styles.switchRow}>
                <Text style={[styles.label, { color: theme.text }]}>All Day Event</Text>
                <Switch value={allDay} onValueChange={setAllDay} trackColor={{ false: theme.border, true: '#06B6D4' }} />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.text }]}>Max Attendees (Optional)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                value={maxAttendees}
                onChangeText={setMaxAttendees}
                placeholder="Unlimited"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.field}>
              <View style={styles.switchRow}>
                <Text style={[styles.label, { color: theme.text }]}>Mandatory Attendance</Text>
                <Switch value={isMandatory} onValueChange={setIsMandatory} trackColor={{ false: theme.border, true: '#EF4444' }} />
              </View>
            </View>

            <View style={styles.field}>
              <View style={styles.switchRow}>
                <Text style={[styles.label, { color: theme.text }]}>Requires Registration</Text>
                <Switch value={requiresRegistration} onValueChange={setRequiresRegistration} trackColor={{ false: theme.border, true: '#10B981' }} />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: '#06B6D4' }]}
              onPress={handleCreate}
              disabled={saving || !title.trim()}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.createButtonText}>Create Event</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </DashboardWallpaperBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  form: {
    gap: 20,
  },
  field: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  typeScroll: {
    marginTop: 8,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    gap: 6,
  },
  typeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  dateText: {
    fontSize: 16,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
