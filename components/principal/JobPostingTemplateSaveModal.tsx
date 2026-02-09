/** Template save modal — extracted from job-posting-create screen */
import React from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import type { JobPostingTemplate } from '@/lib/hiring/jobPostingTemplates';
import EduDashSpinner from '@/components/ui/EduDashSpinner';

interface Props {
  visible: boolean;
  onClose: () => void;
  templateName: string;
  setTemplateName: (v: string) => void;
  templateCategory: JobPostingTemplate['category'];
  setTemplateCategory: (v: JobPostingTemplate['category']) => void;
  savingTemplate: boolean;
  handleSaveTemplate: () => Promise<void>;
  theme: any;
  styles: any;
}

export default function JobPostingTemplateSaveModal({
  visible, onClose, templateName, setTemplateName,
  templateCategory, setTemplateCategory, savingTemplate,
  handleSaveTemplate, theme, styles,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Ionicons name="bookmark" size={20} color={theme.primary} />
            <Text style={styles.modalTitle}>Save as Template</Text>
          </View>
          <Text style={styles.modalSubtitle}>Reuse this job post in one tap.</Text>

          <Text style={styles.modalLabel}>Template name</Text>
          <TextInput
            style={styles.modalInput}
            value={templateName}
            onChangeText={setTemplateName}
            placeholder="e.g. ECD Teacher (Full-Time)"
            placeholderTextColor={theme.textSecondary}
          />

          <Text style={styles.modalLabel}>Category</Text>
          <View style={[styles.modalPickerContainer, { backgroundColor: theme.surface }]}>
            <Picker
              selectedValue={templateCategory}
              onValueChange={(v) => setTemplateCategory(v as JobPostingTemplate['category'])}
              style={styles.picker}
              dropdownIconColor={theme.text}
            >
              <Picker.Item label="General" value="general" />
              <Picker.Item label="ECD" value="ecd" />
              <Picker.Item label="Assistant" value="assistant" />
              <Picker.Item label="Aftercare" value="aftercare" />
              <Picker.Item label="Admin" value="admin" />
            </Picker>
          </View>

          <View style={styles.modalButtonRow}>
            <TouchableOpacity style={styles.modalButtonSecondary} onPress={onClose}>
              <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButtonPrimary, savingTemplate && styles.modalButtonDisabled]}
              disabled={savingTemplate}
              onPress={() => void handleSaveTemplate()}
            >
              {savingTemplate ? (
                <EduDashSpinner size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="save-outline" size={18} color="#FFFFFF" />
              )}
              <Text style={styles.modalButtonPrimaryText}>{savingTemplate ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
