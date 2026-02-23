// Excursion Form Modal Component
// Create and edit excursions

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/contexts/ThemeContext';
import type { Excursion, ExcursionFormData, ExcursionPreflightChecks } from './types';
import { getInitialExcursionFormData, excursionToFormData, PREFLIGHT_CHECK_ITEMS, isPreflightComplete } from './types';

interface ExcursionFormModalProps {
  visible: boolean;
  excursion: Excursion | null;
  onClose: () => void;
  onSave: (formData: ExcursionFormData, editingId?: string) => Promise<boolean>;
}

export function ExcursionFormModal({
  visible,
  excursion,
  onClose,
  onSave,
}: ExcursionFormModalProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [formData, setFormData] = useState<ExcursionFormData>(getInitialExcursionFormData());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (excursion) {
      setFormData(excursionToFormData(excursion));
    } else {
      setFormData(getInitialExcursionFormData());
    }
  }, [excursion, visible]);

  const handleSave = async () => {
    setSaving(true);
    const success = await onSave(formData, excursion?.id);
    setSaving(false);
    if (success) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {excursion ? 'Edit Excursion' : 'New Excursion'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.inputLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              value={formData.title}
              onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
              placeholder="e.g., Visit to Local Farm"
              placeholderTextColor={theme.textSecondary}
            />

            <Text style={styles.inputLabel}>Destination *</Text>
            <TextInput
              style={styles.input}
              value={formData.destination}
              onChangeText={(text) => setFormData(prev => ({ ...prev, destination: text }))}
              placeholder="e.g., Sunny Acres Farm"
              placeholderTextColor={theme.textSecondary}
            />

            <Text style={styles.inputLabel}>Date *</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={{ color: theme.text }}>
                {formData.excursion_date.toLocaleDateString('en-ZA')}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={formData.excursion_date}
                mode="date"
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) setFormData(prev => ({ ...prev, excursion_date: date }));
                }}
              />
            )}

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={formData.description}
              onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
              placeholder="Describe the excursion..."
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.inputLabel}>Estimated Cost per Child (R)</Text>
            <TextInput
              style={styles.input}
              value={formData.estimated_cost_per_child}
              onChangeText={(text) => setFormData(prev => ({ ...prev, estimated_cost_per_child: text }))}
              placeholder="0"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
            />

            <Text style={styles.inputLabel}>Learning Objectives (comma-separated)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={formData.learning_objectives}
              onChangeText={(text) => setFormData(prev => ({ ...prev, learning_objectives: text }))}
              placeholder="e.g., Learn about farm animals, Understand food sources"
              placeholderTextColor={theme.textSecondary}
              multiline
            />

            <Text style={styles.inputLabel}>Items to Bring (comma-separated)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={formData.items_to_bring}
              onChangeText={(text) => setFormData(prev => ({ ...prev, items_to_bring: text }))}
              placeholder="e.g., Hat, Sunscreen, Packed lunch"
              placeholderTextColor={theme.textSecondary}
              multiline
            />

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setFormData(prev => ({ ...prev, consent_required: !prev.consent_required }))}
            >
              <Ionicons
                name={formData.consent_required ? 'checkbox' : 'square-outline'}
                size={24}
                color={theme.primary}
              />
              <Text style={styles.checkboxLabel}>Parent consent required</Text>
            </TouchableOpacity>

            {excursion && (
              <View style={styles.preflightSection}>
                <Text style={styles.preflightTitle}>Preflight Checklist (required before approval)</Text>
                {PREFLIGHT_CHECK_ITEMS.map((item) => {
                  const checked = formData.preflight_checks?.[item.id] ?? false;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.checkboxRow}
                      onPress={() =>
                        setFormData((prev) => {
                          const next: ExcursionPreflightChecks = {
                            ...(prev.preflight_checks ?? {}),
                            [item.id]: !checked,
                          } as ExcursionPreflightChecks;
                          return { ...prev, preflight_checks: next };
                        })
                      }
                    >
                      <Ionicons
                        name={checked ? 'checkmark-circle' : 'ellipse-outline'}
                        size={24}
                        color={checked ? '#10b981' : theme.textSecondary}
                      />
                      <Text style={[styles.checkboxLabel, !checked && styles.checkboxLabelIncomplete]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                {formData.preflight_checks && isPreflightComplete(formData.preflight_checks) && (
                  <Text style={styles.preflightComplete}>All checks complete. Ready to approve.</Text>
                )}
              </View>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonSecondary]}
              onPress={onClose}
            >
              <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonPrimary]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.modalButtonTextPrimary}>
                {saving ? 'Saving...' : excursion ? 'Update' : 'Create'}
              </Text>
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
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '90%',
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
      color: theme.text,
    },
    modalBody: {
      padding: 20,
      maxHeight: 500,
    },
    modalFooter: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      padding: 20,
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.text,
      marginBottom: 8,
      marginTop: 16,
    },
    input: {
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: theme.text,
    },
    inputMultiline: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 20,
    },
    checkboxLabel: {
      fontSize: 16,
      color: theme.text,
    },
    checkboxLabelIncomplete: {
      color: theme.textSecondary,
    },
    preflightSection: {
      marginTop: 24,
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    preflightTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 12,
    },
    preflightComplete: {
      fontSize: 13,
      color: '#10b981',
      marginTop: 12,
      fontWeight: '500',
    },
    modalButton: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    modalButtonSecondary: {
      backgroundColor: theme.background,
    },
    modalButtonPrimary: {
      backgroundColor: theme.primary,
    },
    modalButtonTextSecondary: {
      color: theme.text,
      fontWeight: '600',
    },
    modalButtonTextPrimary: {
      color: '#fff',
      fontWeight: '600',
    },
  });
