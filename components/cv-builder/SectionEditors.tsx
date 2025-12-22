/**
 * CV Section Editors
 */
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';

interface EditorProps {
  data: any;
  onChange: (data: any) => void;
  theme: any;
  t: any;
}

export function ExperienceEditor({ data, onChange, theme, t }: EditorProps) {
  const items = data.items || [];
  const addItem = () => {
    onChange({ items: [...items, { company: '', position: '', startDate: '', endDate: '', description: '', current: false }] });
  };
  const updateItem = (index: number, updates: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updates };
    onChange({ items: newItems });
  };
  const removeItem = (index: number) => onChange({ items: items.filter((_: any, i: number) => i !== index) });

  return (
    <View>
      {items.map((item: any, index: number) => (
        <Card key={index} padding={16} margin={0} elevation="small" style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <Text style={[styles.itemNumber, { color: theme.textSecondary }]}>#{index + 1}</Text>
            <TouchableOpacity onPress={() => removeItem(index)}>
              <Ionicons name="trash-outline" size={20} color={theme.error || '#EF4444'} />
            </TouchableOpacity>
          </View>
          <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]} value={item.position} onChangeText={(text) => updateItem(index, { position: text })} placeholder={t('cv.position', { defaultValue: 'Position/Title' })} placeholderTextColor={theme.textSecondary} />
          <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]} value={item.company} onChangeText={(text) => updateItem(index, { company: text })} placeholder={t('cv.company', { defaultValue: 'Company' })} placeholderTextColor={theme.textSecondary} />
          <View style={styles.dateRow}>
            <TextInput style={[styles.input, styles.dateInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]} value={item.startDate} onChangeText={(text) => updateItem(index, { startDate: text })} placeholder={t('cv.start_date', { defaultValue: 'Start Date' })} placeholderTextColor={theme.textSecondary} />
            <TextInput style={[styles.input, styles.dateInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]} value={item.endDate} onChangeText={(text) => updateItem(index, { endDate: text })} placeholder={t('cv.end_date', { defaultValue: 'End Date' })} placeholderTextColor={theme.textSecondary} />
          </View>
          <TextInput style={[styles.input, styles.multiline, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]} value={item.description} onChangeText={(text) => updateItem(index, { description: text })} placeholder={t('cv.description', { defaultValue: 'Description' })} placeholderTextColor={theme.textSecondary} multiline />
        </Card>
      ))}
      <TouchableOpacity style={[styles.addButton, { borderColor: theme.border }]} onPress={addItem}>
        <Ionicons name="add" size={20} color={theme.primary} />
        <Text style={{ color: theme.primary }}>{t('cv.add_experience', { defaultValue: 'Add Experience' })}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function EducationEditor({ data, onChange, theme, t }: EditorProps) {
  const items = data.items || [];
  const addItem = () => onChange({ items: [...items, { institution: '', degree: '', field: '', startDate: '', endDate: '' }] });
  const updateItem = (index: number, updates: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updates };
    onChange({ items: newItems });
  };
  const removeItem = (index: number) => onChange({ items: items.filter((_: any, i: number) => i !== index) });

  return (
    <View>
      {items.map((item: any, index: number) => (
        <Card key={index} padding={16} margin={0} elevation="small" style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <Text style={[styles.itemNumber, { color: theme.textSecondary }]}>#{index + 1}</Text>
            <TouchableOpacity onPress={() => removeItem(index)}>
              <Ionicons name="trash-outline" size={20} color={theme.error || '#EF4444'} />
            </TouchableOpacity>
          </View>
          <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]} value={item.degree} onChangeText={(text) => updateItem(index, { degree: text })} placeholder={t('cv.degree', { defaultValue: 'Degree' })} placeholderTextColor={theme.textSecondary} />
          <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]} value={item.institution} onChangeText={(text) => updateItem(index, { institution: text })} placeholder={t('cv.institution', { defaultValue: 'Institution' })} placeholderTextColor={theme.textSecondary} />
          <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]} value={item.field} onChangeText={(text) => updateItem(index, { field: text })} placeholder={t('cv.field_of_study', { defaultValue: 'Field of Study' })} placeholderTextColor={theme.textSecondary} />
          <View style={styles.dateRow}>
            <TextInput style={[styles.input, styles.dateInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]} value={item.startDate} onChangeText={(text) => updateItem(index, { startDate: text })} placeholder={t('cv.start_date', { defaultValue: 'Start' })} placeholderTextColor={theme.textSecondary} />
            <TextInput style={[styles.input, styles.dateInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]} value={item.endDate} onChangeText={(text) => updateItem(index, { endDate: text })} placeholder={t('cv.end_date', { defaultValue: 'End' })} placeholderTextColor={theme.textSecondary} />
          </View>
        </Card>
      ))}
      <TouchableOpacity style={[styles.addButton, { borderColor: theme.border }]} onPress={addItem}>
        <Ionicons name="add" size={20} color={theme.primary} />
        <Text style={{ color: theme.primary }}>{t('cv.add_education', { defaultValue: 'Add Education' })}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function SkillsEditor({ data, onChange, theme, t }: EditorProps) {
  const skills = data.skills || [];
  const [newSkill, setNewSkill] = useState('');
  const addSkill = () => { if (newSkill.trim()) { onChange({ skills: [...skills, { name: newSkill.trim(), level: 'intermediate' }] }); setNewSkill(''); } };

  return (
    <View>
      <View style={styles.addRow}>
        <TextInput style={[styles.input, styles.addInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]} value={newSkill} onChangeText={setNewSkill} placeholder={t('cv.skill_name', { defaultValue: 'Skill name' })} placeholderTextColor={theme.textSecondary} onSubmitEditing={addSkill} />
        <TouchableOpacity style={[styles.addIconButton, { backgroundColor: theme.primary }]} onPress={addSkill}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      {skills.map((skill: any, index: number) => (
        <View key={index} style={styles.listItem}>
          <Text style={[styles.listItemText, { color: theme.text }]}>{skill.name}</Text>
          <TouchableOpacity onPress={() => onChange({ skills: skills.filter((_: any, i: number) => i !== index) })}>
            <Ionicons name="close-circle" size={24} color={theme.error || '#EF4444'} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

export function CertificationsEditor({ data, onChange, theme, t }: EditorProps) {
  const items = data.items || [];
  const addItem = () => onChange({ items: [...items, { name: '', issuer: '', date: '', expiryDate: '' }] });
  const updateItem = (index: number, updates: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updates };
    onChange({ items: newItems });
  };
  const removeItem = (index: number) => onChange({ items: items.filter((_: any, i: number) => i !== index) });

  return (
    <View>
      {items.map((item: any, index: number) => (
        <Card key={index} padding={16} margin={0} elevation="small" style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <Text style={[styles.itemNumber, { color: theme.textSecondary }]}>#{index + 1}</Text>
            <TouchableOpacity onPress={() => removeItem(index)}>
              <Ionicons name="trash-outline" size={20} color={theme.error || '#EF4444'} />
            </TouchableOpacity>
          </View>
          <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]} value={item.name} onChangeText={(text) => updateItem(index, { name: text })} placeholder={t('cv.certification_name', { defaultValue: 'Certification Name' })} placeholderTextColor={theme.textSecondary} />
          <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]} value={item.issuer} onChangeText={(text) => updateItem(index, { issuer: text })} placeholder={t('cv.issuer', { defaultValue: 'Issuing Organization' })} placeholderTextColor={theme.textSecondary} />
          <View style={styles.dateRow}>
            <TextInput style={[styles.input, styles.dateInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]} value={item.date} onChangeText={(text) => updateItem(index, { date: text })} placeholder={t('cv.date', { defaultValue: 'Date' })} placeholderTextColor={theme.textSecondary} />
            <TextInput style={[styles.input, styles.dateInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]} value={item.expiryDate} onChangeText={(text) => updateItem(index, { expiryDate: text })} placeholder={t('cv.expiry_date', { defaultValue: 'Expiry' })} placeholderTextColor={theme.textSecondary} />
          </View>
        </Card>
      ))}
      <TouchableOpacity style={[styles.addButton, { borderColor: theme.border }]} onPress={addItem}>
        <Ionicons name="add" size={20} color={theme.primary} />
        <Text style={{ color: theme.primary }}>{t('cv.add_certification', { defaultValue: 'Add Certification' })}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function LanguagesEditor({ data, onChange, theme, t }: EditorProps) {
  const languages = data.languages || [];
  const [newLanguage, setNewLanguage] = useState('');
  const addLanguage = () => { if (newLanguage.trim()) { onChange({ languages: [...languages, { name: newLanguage.trim(), proficiency: 'intermediate' }] }); setNewLanguage(''); } };

  return (
    <View>
      <View style={styles.addRow}>
        <TextInput style={[styles.input, styles.addInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]} value={newLanguage} onChangeText={setNewLanguage} placeholder={t('cv.language_name', { defaultValue: 'Language' })} placeholderTextColor={theme.textSecondary} onSubmitEditing={addLanguage} />
        <TouchableOpacity style={[styles.addIconButton, { backgroundColor: theme.primary }]} onPress={addLanguage}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      {languages.map((lang: any, index: number) => (
        <View key={index} style={styles.listItem}>
          <Text style={[styles.listItemText, { color: theme.text }]}>{lang.name}</Text>
          <TouchableOpacity onPress={() => onChange({ languages: languages.filter((_: any, i: number) => i !== index) })}>
            <Ionicons name="close-circle" size={24} color={theme.error || '#EF4444'} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  itemCard: { marginBottom: 12 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  itemNumber: { fontSize: 12, fontWeight: '600' },
  input: { height: 44, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, fontSize: 16, marginBottom: 12 },
  multiline: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
  dateRow: { flexDirection: 'row', gap: 12 },
  dateInput: { flex: 1 },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', gap: 8, marginTop: 8 },
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  addInput: { flex: 1 },
  addIconButton: { padding: 12, borderRadius: 8 },
  listItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  listItemText: { flex: 1 },
});
