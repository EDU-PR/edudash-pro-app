// Meeting Form Modal Component - Refactored for WARP.md compliance

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/contexts/ThemeContext';
import type { Meeting, MeetingFormData, MeetingType } from './types';
import { MEETING_TYPES } from './types';
import { createStyles } from './MeetingFormModal.styles';

interface MeetingFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: MeetingFormData, editingId?: string) => Promise<boolean>;
  editingMeeting: Meeting | null;
  initialData: MeetingFormData;
  insetBottom: number;
}

export const MeetingFormModal: React.FC<MeetingFormModalProps> = ({
  visible,
  onClose,
  onSave,
  editingMeeting,
  initialData,
  insetBottom,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme, insetBottom);
  
  const [formData, setFormData] = useState<MeetingFormData>(initialData);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [newAgendaItem, setNewAgendaItem] = useState('');

  // Reset form when modal opens with new data
  useEffect(() => {
    setFormData(initialData);
  }, [initialData, visible]);

  const handleSave = async () => {
    const success = await onSave(formData, editingMeeting?.id);
    if (success) {
      onClose();
    }
  };

  const addAgendaItem = () => {
    if (!newAgendaItem.trim()) return;
    setFormData(prev => ({
      ...prev,
      agenda_items: [...prev.agenda_items, { title: newAgendaItem.trim() }],
    }));
    setNewAgendaItem('');
  };

  const removeAgendaItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      agenda_items: prev.agenda_items.filter((_, i) => i !== index),
    }));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {editingMeeting ? 'Edit Meeting' : 'New Meeting'}
          </Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={styles.modalSave}>Save</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentInner}>
          {/* Title */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              value={formData.title}
              onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
              placeholder="Enter meeting title"
              placeholderTextColor={theme.textSecondary}
            />
          </View>
          
          {/* Meeting Type */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Meeting Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.typeSelector}>
                {MEETING_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.typeOption,
                      formData.meeting_type === type.value && {
                        backgroundColor: type.color + '30',
                        borderColor: type.color,
                      },
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, meeting_type: type.value as MeetingType }))}
                  >
                    <Ionicons
                      name={type.icon as any}
                      size={20}
                      color={formData.meeting_type === type.value ? type.color : theme.textSecondary}
                    />
                    <Text
                      style={[
                        styles.typeOptionText,
                        formData.meeting_type === type.value && { color: type.color },
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
          
          {/* Date */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Date</Text>
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color={theme.textSecondary} />
              <Text style={styles.datePickerText}>
                {formData.meeting_date.toLocaleDateString()}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={formData.meeting_date}
                mode="date"
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) setFormData(prev => ({ ...prev, meeting_date: date }));
                }}
              />
            )}
          </View>
          
          {/* Time */}
          <View style={styles.formRow}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.formLabel}>Start Time</Text>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowStartTimePicker(true)}
              >
                <Ionicons name="time-outline" size={20} color={theme.textSecondary} />
                <Text style={styles.datePickerText}>
                  {formData.start_time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
              {showStartTimePicker && (
                <DateTimePicker
                  value={formData.start_time}
                  mode="time"
                  onChange={(event, time) => {
                    setShowStartTimePicker(false);
                    if (time) setFormData(prev => ({ ...prev, start_time: time }));
                  }}
                />
              )}
            </View>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.formLabel}>End Time</Text>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowEndTimePicker(true)}
              >
                <Ionicons name="time-outline" size={20} color={theme.textSecondary} />
                <Text style={styles.datePickerText}>
                  {formData.end_time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
              {showEndTimePicker && (
                <DateTimePicker
                  value={formData.end_time}
                  mode="time"
                  onChange={(event, time) => {
                    setShowEndTimePicker(false);
                    if (time) setFormData(prev => ({ ...prev, end_time: time }));
                  }}
                />
              )}
            </View>
          </View>
          
          {/* Location */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Location</Text>
            <TextInput
              style={styles.input}
              value={formData.location}
              onChangeText={(text) => setFormData(prev => ({ ...prev, location: text }))}
              placeholder="e.g., Staff Room, Hall, Online"
              placeholderTextColor={theme.textSecondary}
            />
          </View>
          
          {/* Virtual Meeting Toggle */}
          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => setFormData(prev => ({ ...prev, is_virtual: !prev.is_virtual }))}
          >
            <View style={styles.toggleInfo}>
              <Ionicons name="videocam-outline" size={20} color={theme.text} />
              <Text style={styles.toggleLabel}>Virtual Meeting</Text>
            </View>
            <View style={[styles.toggle, formData.is_virtual && styles.toggleActive]}>
              <View style={[styles.toggleThumb, formData.is_virtual && styles.toggleThumbActive]} />
            </View>
          </TouchableOpacity>
          
          {formData.is_virtual && (
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Meeting Link</Text>
              <TextInput
                style={styles.input}
                value={formData.virtual_link}
                onChangeText={(text) => setFormData(prev => ({ ...prev, virtual_link: text }))}
                placeholder="https://meet.google.com/..."
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>
          )}
          
          {/* Description */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
              placeholder="Add meeting details..."
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={3}
            />
          </View>
          
          {/* Agenda Items */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Agenda Items</Text>
            <View style={styles.agendaInput}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={newAgendaItem}
                onChangeText={setNewAgendaItem}
                placeholder="Add agenda item"
                placeholderTextColor={theme.textSecondary}
                onSubmitEditing={addAgendaItem}
              />
              <TouchableOpacity style={styles.addAgendaButton} onPress={addAgendaItem}>
                <Ionicons name="add" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            {formData.agenda_items.map((item, index) => (
              <View key={index} style={styles.agendaItem}>
                <View style={styles.agendaItemNumber}>
                  <Text style={styles.agendaItemNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.agendaItemText}>{item.title}</Text>
                <TouchableOpacity onPress={() => removeAgendaItem(index)}>
                  <Ionicons name="close-circle" size={20} color={theme.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

export default MeetingFormModal;
