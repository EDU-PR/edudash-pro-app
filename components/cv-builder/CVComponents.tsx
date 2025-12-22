/**
 * CV Builder sub-components
 */
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { CVSection } from './types';
import { ExperienceEditor, EducationEditor, SkillsEditor, CertificationsEditor, LanguagesEditor } from './SectionEditors';

interface PersonalInfoSectionProps {
  section?: CVSection;
  onUpdate: (data: any) => void;
  theme: any;
  t: any;
}

export function PersonalInfoSection({ section, onUpdate, theme, t }: PersonalInfoSectionProps) {
  const { profile } = useAuth();
  const [data, setData] = useState(
    section?.data || {
      fullName: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
      email: profile?.email || '',
      phone: '',
      address: '',
      summary: '',
    }
  );

  useEffect(() => { onUpdate(data); }, [data]);

  const fields = [
    { key: 'fullName', label: t('cv.full_name', { defaultValue: 'Full Name' }), placeholder: 'John Doe' },
    { key: 'email', label: t('cv.email', { defaultValue: 'Email' }), placeholder: 'john@example.com', keyboardType: 'email-address' },
    { key: 'phone', label: t('cv.phone', { defaultValue: 'Phone' }), placeholder: '+27 12 345 6789', keyboardType: 'phone-pad' },
    { key: 'address', label: t('cv.address', { defaultValue: 'Address' }), placeholder: 'City, Country' },
  ];

  return (
    <Card padding={16} margin={0} elevation="small" style={{ marginBottom: 12 }}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        {t('cv.personal_info', { defaultValue: 'Personal Information' })}
      </Text>
      {fields.map((field) => (
        <View key={field.key} style={{ marginBottom: 16 }}>
          <Text style={[styles.label, { color: theme.text }]}>{field.label}</Text>
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
            value={data[field.key]}
            onChangeText={(text) => setData({ ...data, [field.key]: text })}
            placeholder={field.placeholder}
            placeholderTextColor={theme.textSecondary}
            keyboardType={field.keyboardType as any}
          />
        </View>
      ))}
      <View style={{ marginBottom: 16 }}>
        <Text style={[styles.label, { color: theme.text }]}>
          {t('cv.summary', { defaultValue: 'Professional Summary' })}
        </Text>
        <TextInput
          style={[styles.input, styles.multiline, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
          value={data.summary}
          onChangeText={(text) => setData({ ...data, summary: text })}
          placeholder={t('cv.summary_placeholder', { defaultValue: 'Brief summary of your professional background...' })}
          placeholderTextColor={theme.textSecondary}
          multiline
          numberOfLines={4}
        />
      </View>
    </Card>
  );
}

interface SectionCardProps {
  section: CVSection;
  onEdit: () => void;
  onDelete: () => void;
  theme: any;
  t: any;
}

export function SectionCard({ section, onEdit, onDelete, theme, t }: SectionCardProps) {
  return (
    <Card padding={16} margin={0} elevation="small" style={{ marginBottom: 12 }}>
      <View style={styles.cardRow}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>{section.title}</Text>
        <View style={styles.cardActions}>
          <TouchableOpacity onPress={onEdit}>
            <Ionicons name="create-outline" size={20} color={theme.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete}>
            <Ionicons name="trash-outline" size={20} color={theme.error || '#EF4444'} />
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );
}

interface SectionEditorModalProps {
  section: CVSection;
  onUpdate: (data: any) => void;
  onClose: () => void;
  theme: any;
  t: any;
  insets: any;
}

export function SectionEditorModal({ section, onUpdate, onClose, theme, t, insets }: SectionEditorModalProps) {
  const [data, setData] = useState(section.data);

  const handleSave = () => { onUpdate(data); onClose(); };

  const renderEditor = () => {
    switch (section.type) {
      case 'experience':
      case 'projects':
      case 'references':
      case 'achievements':
      case 'volunteer':
        return <ExperienceEditor data={data} onChange={setData} theme={theme} t={t} />;
      case 'education':
        return <EducationEditor data={data} onChange={setData} theme={theme} t={t} />;
      case 'skills':
        return <SkillsEditor data={data} onChange={setData} theme={theme} t={t} />;
      case 'certifications':
        return <CertificationsEditor data={data} onChange={setData} theme={theme} t={t} />;
      case 'languages':
        return <LanguagesEditor data={data} onChange={setData} theme={theme} t={t} />;
      default:
        return null;
    }
  };

  return (
    <Modal visible={true} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'bottom']}>
        <View style={[styles.modalHeader, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>{section.title}</Text>
          <View style={styles.modalActions}>
            <TouchableOpacity onPress={handleSave}>
              <Text style={[styles.saveText, { color: theme.primary }]}>{t('common.save', { defaultValue: 'Save' })}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
          {renderEditor()}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { height: 44, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, fontSize: 16 },
  multiline: { minHeight: 100, textAlignVertical: 'top', paddingTop: 12 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardActions: { flexDirection: 'row', gap: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: 16 },
  saveText: { fontSize: 16, fontWeight: '600' },
});
