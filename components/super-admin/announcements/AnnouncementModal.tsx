/**
 * Announcement Create/Edit Modal Component
 */

import React from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  AnnouncementForm,
  AnnouncementType,
  AnnouncementPriority,
  TargetAudience,
  ANNOUNCEMENT_TYPES,
  PRIORITIES,
  AUDIENCES,
} from './types';
import { getTypeColor, getPriorityColor, getTypeIcon, getAudienceLabel, capitalize } from './utils';

interface AnnouncementModalProps {
  visible: boolean;
  isEditing: boolean;
  formData: AnnouncementForm;
  saving: boolean;
  theme: any;
  onClose: () => void;
  onSave: () => void;
  onUpdateField: <K extends keyof AnnouncementForm>(field: K, value: AnnouncementForm[K]) => void;
}

export function AnnouncementModal({
  visible,
  isEditing,
  formData,
  saving,
  theme,
  onClose,
  onSave,
  onUpdateField,
}: AnnouncementModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {isEditing ? 'Edit Announcement' : 'Create Announcement'}
          </Text>
          <TouchableOpacity onPress={onSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Title */}
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Title *</Text>
            <TextInput
              style={styles.formInput}
              value={formData.title}
              onChangeText={(text) => onUpdateField('title', text)}
              placeholder="Announcement title"
              placeholderTextColor="#9ca3af"
            />
          </View>

          {/* Content */}
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Content *</Text>
            <TextInput
              style={[styles.formInput, styles.textArea]}
              value={formData.content}
              onChangeText={(text) => onUpdateField('content', text)}
              placeholder="Announcement content..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={5}
            />
          </View>

          {/* Type */}
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Type</Text>
            <View style={styles.optionGrid}>
              {ANNOUNCEMENT_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.optionButton,
                    formData.type === type && styles.optionButtonActive,
                    { borderColor: getTypeColor(type) }
                  ]}
                  onPress={() => onUpdateField('type', type)}
                >
                  <Ionicons 
                    name={getTypeIcon(type) as any} 
                    size={16} 
                    color={formData.type === type ? getTypeColor(type) : '#9ca3af'} 
                  />
                  <Text style={[
                    styles.optionButtonText,
                    formData.type === type && { color: getTypeColor(type) }
                  ]}>
                    {capitalize(type)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Priority */}
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Priority</Text>
            <View style={styles.optionGrid}>
              {PRIORITIES.map((priority) => (
                <TouchableOpacity
                  key={priority}
                  style={[
                    styles.optionButton,
                    formData.priority === priority && styles.optionButtonActive,
                    { borderColor: getPriorityColor(priority) }
                  ]}
                  onPress={() => onUpdateField('priority', priority)}
                >
                  <Text style={[
                    styles.optionButtonText,
                    formData.priority === priority && { color: getPriorityColor(priority) }
                  ]}>
                    {capitalize(priority)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Target Audience */}
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Target Audience</Text>
            <View style={styles.optionGrid}>
              {AUDIENCES.map((audience) => (
                <TouchableOpacity
                  key={audience}
                  style={[
                    styles.optionButton,
                    formData.target_audience === audience && styles.optionButtonActive
                  ]}
                  onPress={() => onUpdateField('target_audience', audience)}
                >
                  <Text style={[
                    styles.optionButtonText,
                    formData.target_audience === audience && styles.optionButtonTextActive
                  ]}>
                    {getAudienceLabel(audience)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Settings */}
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Settings</Text>
            
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Active</Text>
              <Switch
                value={formData.is_active}
                onValueChange={(value) => onUpdateField('is_active', value)}
                trackColor={{ false: theme.border, true: theme.primary + '40' }}
                thumbColor={formData.is_active ? theme.primary : '#9ca3af'}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Pin to top</Text>
              <Switch
                value={formData.is_pinned}
                onValueChange={(value) => onUpdateField('is_pinned', value)}
                trackColor={{ false: '#374151', true: '#00f5ff40' }}
                thumbColor={formData.is_pinned ? '#00f5ff' : '#9ca3af'}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Show as banner</Text>
              <Switch
                value={formData.show_banner}
                onValueChange={(value) => onUpdateField('show_banner', value)}
                trackColor={{ false: '#374151', true: '#00f5ff40' }}
                thumbColor={formData.show_banner ? '#00f5ff' : '#9ca3af'}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#00f5ff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#111827',
  },
  formSection: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  formLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#1f2937',
    color: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    gap: 4,
    minWidth: 80,
  },
  optionButtonActive: {
    backgroundColor: 'transparent',
  },
  optionButtonText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
  optionButtonTextActive: {
    color: '#00f5ff',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
});
