/** Calendar event create/edit modal — extracted from calendar-management.tsx */
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import EduDashSpinner from '@/components/ui/EduDashSpinner';

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

export interface EventFormData {
  title: string;
  description: string;
  event_type: string;
  startDate: Date;
  endDate: Date;
  startTime: Date;
  endTime: Date;
  all_day: boolean;
  location: string;
  target_audience: string[];
  send_notifications: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  isEditing: boolean;
  formData: EventFormData;
  setFormData: (data: EventFormData) => void;
  onSubmit: () => void;
  submitting: boolean;
  toggleAudience: (audience: string) => void;
  formatDate: (date: Date) => string;
  formatTime: (date: Date) => string;
  theme: any;
  styles: any;
}

export default function CalendarEventFormModal({
  visible, onClose, isEditing, formData, setFormData,
  onSubmit, submitting, toggleAudience, formatDate, formatTime,
  theme, styles,
}: Props) {
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{isEditing ? 'Edit Event' : 'Create Event'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
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
                        borderColor: type.color,
                      },
                    ]}
                    onPress={() => setFormData({ ...formData, event_type: type.value })}
                  >
                    <Ionicons
                      name={type.icon as any}
                      size={16}
                      color={formData.event_type === type.value ? type.color : theme.textSecondary}
                    />
                    <Text style={[styles.typeChipText, formData.event_type === type.value && { color: type.color }]}>
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
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowStartDatePicker(true)}>
                <Ionicons name="calendar-outline" size={20} color={theme.primary} />
                <Text style={styles.dateButtonText}>{formatDate(formData.startDate)}</Text>
              </TouchableOpacity>
              {showStartDatePicker && (
                <DateTimePicker
                  value={formData.startDate}
                  mode="date"
                  display="default"
                  onChange={(_, date) => { setShowStartDatePicker(false); if (date) setFormData({ ...formData, startDate: date }); }}
                />
              )}
            </View>

            {/* Start Time */}
            {!formData.all_day && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Start Time</Text>
                <TouchableOpacity style={styles.dateButton} onPress={() => setShowStartTimePicker(true)}>
                  <Ionicons name="time-outline" size={20} color={theme.primary} />
                  <Text style={styles.dateButtonText}>{formatTime(formData.startTime)}</Text>
                </TouchableOpacity>
                {showStartTimePicker && (
                  <DateTimePicker
                    value={formData.startTime}
                    mode="time"
                    display="default"
                    onChange={(_, date) => { setShowStartTimePicker(false); if (date) setFormData({ ...formData, startTime: date }); }}
                  />
                )}
              </View>
            )}

            {/* End Date */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>End Date *</Text>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowEndDatePicker(true)}>
                <Ionicons name="calendar-outline" size={20} color={theme.primary} />
                <Text style={styles.dateButtonText}>{formatDate(formData.endDate)}</Text>
              </TouchableOpacity>
              {showEndDatePicker && (
                <DateTimePicker
                  value={formData.endDate}
                  mode="date"
                  display="default"
                  onChange={(_, date) => { setShowEndDatePicker(false); if (date) setFormData({ ...formData, endDate: date }); }}
                />
              )}
            </View>

            {/* End Time */}
            {!formData.all_day && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>End Time</Text>
                <TouchableOpacity style={styles.dateButton} onPress={() => setShowEndTimePicker(true)}>
                  <Ionicons name="time-outline" size={20} color={theme.primary} />
                  <Text style={styles.dateButtonText}>{formatTime(formData.endTime)}</Text>
                </TouchableOpacity>
                {showEndTimePicker && (
                  <DateTimePicker
                    value={formData.endTime}
                    mode="time"
                    display="default"
                    onChange={(_, date) => { setShowEndTimePicker(false); if (date) setFormData({ ...formData, endTime: date }); }}
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
                    style={[styles.audienceChip, formData.target_audience.includes(audience.value) && styles.audienceChipActive]}
                    onPress={() => toggleAudience(audience.value)}
                  >
                    <Text style={[styles.audienceChipText, formData.target_audience.includes(audience.value) && styles.audienceChipTextActive]}>
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

          {/* Footer */}
          <View style={styles.modalFooter}>
            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, styles.submitButton]} onPress={onSubmit} disabled={submitting}>
              {submitting ? (
                <EduDashSpinner size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>{isEditing ? 'Update' : 'Create'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
