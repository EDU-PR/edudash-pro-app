// Activity Form Modal Component - Refactored for WARP.md compliance
// Create and edit activity templates

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ActivityFormData } from './types';
import { ACTIVITY_TYPES, DEVELOPMENTAL_DOMAINS, getInitialActivityFormData } from './types';
import { createStyles } from './ActivityFormModal.styles';

interface ActivityFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (formData: ActivityFormData) => Promise<boolean>;
}

export function ActivityFormModal({
  visible,
  onClose,
  onSave,
}: ActivityFormModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme, insets.bottom);

  const [formData, setFormData] = useState<ActivityFormData>(getInitialActivityFormData());
  const [newObjective, setNewObjective] = useState('');
  const [newMaterial, setNewMaterial] = useState('');
  const [newStep, setNewStep] = useState('');
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setFormData(getInitialActivityFormData());
    setNewObjective('');
    setNewMaterial('');
    setNewStep('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSave = async () => {
    setSaving(true);
    const success = await onSave(formData);
    setSaving(false);
    if (success) {
      handleClose();
    }
  };

  const toggleDomain = (domain: string) => {
    setFormData(prev => ({
      ...prev,
      developmental_domains: prev.developmental_domains.includes(domain)
        ? prev.developmental_domains.filter(d => d !== domain)
        : [...prev.developmental_domains, domain],
    }));
  };

  const addItem = (
    field: 'learning_objectives' | 'materials_needed' | 'theme_tags',
    value: string,
    setValue: (v: string) => void
  ) => {
    if (!value.trim()) return;
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], value.trim()],
    }));
    setValue('');
  };

  const addStep = () => {
    if (!newStep.trim()) return;
    setFormData(prev => ({
      ...prev,
      activity_steps: [
        ...prev.activity_steps,
        { step_number: prev.activity_steps.length + 1, description: newStep.trim() },
      ],
    }));
    setNewStep('');
  };

  const removeItem = (
    field: 'learning_objectives' | 'materials_needed' | 'theme_tags' | 'activity_steps',
    index: number
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.modalCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>New Activity</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[styles.modalSave, saving && { opacity: 0.5 }]}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
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
              placeholder="Activity title"
              placeholderTextColor={theme.textSecondary}
            />
          </View>
          
          {/* Activity Type */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Activity Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.typeSelector}>
                {ACTIVITY_TYPES.slice(0, -1).map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.typeOption,
                      formData.activity_type === type.value && {
                        backgroundColor: type.color + '30',
                        borderColor: type.color,
                      },
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, activity_type: type.value }))}
                  >
                    <Ionicons
                      name={type.icon as any}
                      size={20}
                      color={formData.activity_type === type.value ? type.color : theme.textSecondary}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
          
          {/* Duration */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Duration (minutes)</Text>
            <View style={styles.durationRow}>
              {[15, 20, 30, 45, 60].map((mins) => (
                <TouchableOpacity
                  key={mins}
                  style={[
                    styles.durationOption,
                    formData.duration_minutes === mins && styles.durationOptionActive,
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, duration_minutes: mins }))}
                >
                  <Text
                    style={[
                      styles.durationOptionText,
                      formData.duration_minutes === mins && styles.durationOptionTextActive,
                    ]}
                  >
                    {mins}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          {/* Developmental Domains */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Developmental Domains</Text>
            <View style={styles.domainsSelector}>
              {DEVELOPMENTAL_DOMAINS.map((domain) => (
                <TouchableOpacity
                  key={domain.value}
                  style={[
                    styles.domainOption,
                    formData.developmental_domains.includes(domain.value) && {
                      backgroundColor: domain.color + '30',
                      borderColor: domain.color,
                    },
                  ]}
                  onPress={() => toggleDomain(domain.value)}
                >
                  <Text
                    style={[
                      styles.domainOptionText,
                      formData.developmental_domains.includes(domain.value) && { color: domain.color },
                    ]}
                  >
                    {domain.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          {/* Description */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
              placeholder="Describe the activity..."
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={3}
            />
          </View>
          
          {/* Learning Objectives */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Learning Objectives</Text>
            <View style={styles.addItemRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={newObjective}
                onChangeText={setNewObjective}
                placeholder="Add objective"
                placeholderTextColor={theme.textSecondary}
                onSubmitEditing={() => addItem('learning_objectives', newObjective, setNewObjective)}
              />
              <TouchableOpacity
                style={styles.addItemButton}
                onPress={() => addItem('learning_objectives', newObjective, setNewObjective)}
              >
                <Ionicons name="add" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            {formData.learning_objectives.map((item, index) => (
              <View key={index} style={styles.addedItem}>
                <Text style={styles.addedItemText}>{item}</Text>
                <TouchableOpacity onPress={() => removeItem('learning_objectives', index)}>
                  <Ionicons name="close-circle" size={20} color={theme.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          
          {/* Materials */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Materials Needed</Text>
            <View style={styles.addItemRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={newMaterial}
                onChangeText={setNewMaterial}
                placeholder="Add material"
                placeholderTextColor={theme.textSecondary}
                onSubmitEditing={() => addItem('materials_needed', newMaterial, setNewMaterial)}
              />
              <TouchableOpacity
                style={styles.addItemButton}
                onPress={() => addItem('materials_needed', newMaterial, setNewMaterial)}
              >
                <Ionicons name="add" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            {formData.materials_needed.map((item, index) => (
              <View key={index} style={styles.addedItem}>
                <Text style={styles.addedItemText}>{item}</Text>
                <TouchableOpacity onPress={() => removeItem('materials_needed', index)}>
                  <Ionicons name="close-circle" size={20} color={theme.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          
          {/* Activity Steps */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Activity Steps</Text>
            <View style={styles.addItemRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={newStep}
                onChangeText={setNewStep}
                placeholder="Add step"
                placeholderTextColor={theme.textSecondary}
                onSubmitEditing={addStep}
              />
              <TouchableOpacity style={styles.addItemButton} onPress={addStep}>
                <Ionicons name="add" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            {formData.activity_steps.map((step, index) => (
              <View key={index} style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <Text style={[styles.stepText, { flex: 1 }]}>{step.description}</Text>
                <TouchableOpacity onPress={() => removeItem('activity_steps', index)}>
                  <Ionicons name="close-circle" size={20} color={theme.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
