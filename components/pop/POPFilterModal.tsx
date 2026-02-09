/**
 * POPFilterModal — extracted from parent-pop-history.tsx
 *
 * Radio-button filter modal for upload type and status.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';

export const UPLOAD_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'proof_of_payment', label: 'Proof of Payment' },
  { value: 'picture_of_progress', label: 'Picture of Progress' },
];

export const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'needs_revision', label: 'Needs Revision' },
];

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  currentType: string;
  currentStatus: string;
  onApply: (type: string, status: string) => void;
}

export const POPFilterModal: React.FC<FilterModalProps> = ({ visible, onClose, currentType, currentStatus, onApply }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState(currentType);
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);

  const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    content: { backgroundColor: theme.surface, borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 },
    title: { fontSize: 20, fontWeight: '700', color: theme.text, marginBottom: 20, textAlign: 'center' },
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: theme.text, marginBottom: 12 },
    option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, marginBottom: 8 },
    optionActive: { backgroundColor: theme.primary + '20' },
    optionText: { fontSize: 14, color: theme.text, marginLeft: 12 },
    optionTextActive: { color: theme.primary, fontWeight: '600' },
    buttons: { flexDirection: 'row', gap: 12 },
    button: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
    cancelButton: { backgroundColor: theme.textSecondary + '20' },
    applyButton: { backgroundColor: theme.primary },
    buttonText: { fontSize: 16, fontWeight: '600' },
    cancelButtonText: { color: theme.textSecondary },
    applyButtonText: { color: theme.onPrimary },
  });

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>{t('pop.filterBy')}</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('pop.type')}</Text>
            {UPLOAD_TYPES.map(type => (
              <TouchableOpacity key={type.value} style={[styles.option, selectedType === type.value && styles.optionActive]} onPress={() => setSelectedType(type.value)}>
                <Ionicons name={selectedType === type.value ? 'radio-button-on' : 'radio-button-off'} size={20} color={selectedType === type.value ? theme.primary : theme.textSecondary} />
                <Text style={[styles.optionText, selectedType === type.value && styles.optionTextActive]}>{type.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('pop.status')}</Text>
            {STATUS_OPTIONS.map(status => (
              <TouchableOpacity key={status.value} style={[styles.option, selectedStatus === status.value && styles.optionActive]} onPress={() => setSelectedStatus(status.value)}>
                <Ionicons name={selectedStatus === status.value ? 'radio-button-on' : 'radio-button-off'} size={20} color={selectedStatus === status.value ? theme.primary : theme.textSecondary} />
                <Text style={[styles.optionText, selectedStatus === status.value && styles.optionTextActive]}>{status.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
              <Text style={[styles.buttonText, styles.cancelButtonText]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.applyButton]} onPress={() => { onApply(selectedType, selectedStatus); onClose(); }}>
              <Text style={[styles.buttonText, styles.applyButtonText]}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
