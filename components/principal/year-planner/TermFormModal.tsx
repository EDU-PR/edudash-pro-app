// Term form modal - create/edit academic term

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { TermFormData } from './types';

interface TermFormModalProps {
  visible: boolean;
  isEditing: boolean;
  formData: TermFormData;
  setFormData: (data: TermFormData) => void;
  onSubmit: () => void;
  onClose: () => void;
  theme: any;
}

export function TermFormModal({
  visible,
  isEditing,
  formData,
  setFormData,
  onSubmit,
  onClose,
  theme,
}: TermFormModalProps) {
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {isEditing ? 'Edit Term' : 'Create New Term'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Term Name *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="e.g., Term 1, First Semester"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={[styles.label, { color: theme.text }]}>Academic Year</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
                  value={formData.academic_year.toString()}
                  onChangeText={(text) =>
                    setFormData({ ...formData, academic_year: Number(text) || new Date().getFullYear() })
                  }
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={[styles.label, { color: theme.text }]}>Term Number</Text>
                <View style={styles.pickerContainer}>
                  {[1, 2, 3, 4].map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[
                        styles.pickerOption,
                        formData.term_number === num && styles.pickerOptionSelected,
                        { backgroundColor: formData.term_number === num ? theme.primary : theme.background },
                      ]}
                      onPress={() => setFormData({ ...formData, term_number: num })}
                    >
                      <Text
                        style={[
                          styles.pickerOptionText,
                          { color: formData.term_number === num ? '#fff' : theme.text },
                        ]}
                      >
                        {num}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={[styles.label, { color: theme.text }]}>Start Date</Text>
                <TouchableOpacity
                  style={[styles.input, { backgroundColor: theme.background }]}
                  onPress={() => setShowStartDatePicker(true)}
                >
                  <Text style={{ color: theme.text }}>{formData.start_date.toLocaleDateString()}</Text>
                </TouchableOpacity>
                {showStartDatePicker && (
                  <DateTimePicker
                    value={formData.start_date}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                      setShowStartDatePicker(false);
                      if (date) setFormData({ ...formData, start_date: date });
                    }}
                  />
                )}
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={[styles.label, { color: theme.text }]}>End Date</Text>
                <TouchableOpacity
                  style={[styles.input, { backgroundColor: theme.background }]}
                  onPress={() => setShowEndDatePicker(true)}
                >
                  <Text style={{ color: theme.text }}>{formData.end_date.toLocaleDateString()}</Text>
                </TouchableOpacity>
                {showEndDatePicker && (
                  <DateTimePicker
                    value={formData.end_date}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                      setShowEndDatePicker(false);
                      if (date) setFormData({ ...formData, end_date: date });
                    }}
                  />
                )}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Description (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: theme.background, color: theme.text }]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Add any notes about this term..."
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.checkboxRow}>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => setFormData({ ...formData, is_active: !formData.is_active })}
              >
                <Ionicons
                  name={formData.is_active ? 'checkbox' : 'checkbox-outline'}
                  size={24}
                  color={formData.is_active ? theme.primary : theme.textSecondary}
                />
                <Text style={[styles.checkboxLabel, { color: theme.text }]}>Set as Active Term</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.checkboxRow}>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => setFormData({ ...formData, is_published: !formData.is_published })}
              >
                <Ionicons
                  name={formData.is_published ? 'checkbox' : 'checkbox-outline'}
                  size={24}
                  color={formData.is_published ? theme.primary : theme.textSecondary}
                />
                <Text style={[styles.checkboxLabel, { color: theme.text }]}>Publish to Teachers</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={onClose}>
              <Text style={styles.buttonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={onSubmit}>
              <Text style={styles.buttonPrimaryText}>{isEditing ? 'Update Term' : 'Create Term'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.8)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      width: '100%',
      maxWidth: 600,
      maxHeight: '90%',
      borderRadius: 16,
      overflow: 'hidden',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
    },
    modalBody: {
      padding: 20,
      maxHeight: 500,
    },
    formGroup: {
      marginBottom: 16,
    },
    formRow: {
      flexDirection: 'row',
      gap: 12,
    },
    label: {
      fontSize: 14,
      fontWeight: '500',
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    pickerContainer: {
      flexDirection: 'row',
      gap: 8,
    },
    pickerOption: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    pickerOptionSelected: {
      borderWidth: 2,
      borderColor: theme.primary,
    },
    pickerOptionText: {
      fontSize: 14,
      fontWeight: '500',
    },
    checkboxRow: {
      marginBottom: 12,
    },
    checkbox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    checkboxLabel: {
      fontSize: 14,
    },
    modalFooter: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    button: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    buttonPrimary: {
      backgroundColor: theme.primary,
    },
    buttonSecondary: {
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    buttonPrimaryText: {
      color: '#fff',
      fontWeight: '600',
    },
    buttonSecondaryText: {
      color: theme.text,
      fontWeight: '600',
    },
  });
