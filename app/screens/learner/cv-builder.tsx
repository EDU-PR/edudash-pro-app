import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { useLearnerCVs, useCreateCV } from '@/hooks/useLearnerData';

interface CVSection {
  id: string;
  type: 'personal' | 'experience' | 'education' | 'skills' | 'certifications' | 'languages';
  title: string;
  data: any;
}

export default function CVBuilderScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { profile } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const styles = createStyles(theme);

  const { data: cvs } = useLearnerCVs();
  const existingCV = cvs?.find((cv) => cv.id === id);
  const createCV = useCreateCV();

  const [cvTitle, setCvTitle] = useState(existingCV?.title || 'My CV');
  const [sections, setSections] = useState<CVSection[]>(
    existingCV?.cv_data?.sections || [
      { id: '1', type: 'personal', title: 'Personal Information', data: {} },
    ]
  );
  const [activeSection, setActiveSection] = useState<CVSection | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const addSection = (type: CVSection['type']) => {
    const newSection: CVSection = {
      id: Date.now().toString(),
      type,
      title: getSectionTitle(type, t),
      data: getDefaultSectionData(type),
    };
    setSections([...sections, newSection]);
    setActiveSection(newSection);
  };

  const updateSection = (sectionId: string, updates: Partial<CVSection>) => {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, ...updates } : s))
    );
  };

  const removeSection = (sectionId: string) => {
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
    if (activeSection?.id === sectionId) {
      setActiveSection(null);
    }
  };

  const handleSave = async () => {
    if (!cvTitle.trim()) {
      Alert.alert(t('common.error', { defaultValue: 'Error' }), t('cv.title_required', { defaultValue: 'Please enter a CV title' }));
      return;
    }

    setIsSaving(true);
    try {
      await createCV.mutateAsync({
        title: cvTitle,
        cv_data: { sections },
      });

      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        t('cv.saved', { defaultValue: 'CV saved successfully' }),
        [{ text: t('common.ok', { defaultValue: 'OK' }), onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert(t('common.error', { defaultValue: 'Error' }), error.message || t('common.save_failed', { defaultValue: 'Failed to save CV' }));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: existingCV ? t('cv.edit_cv', { defaultValue: 'Edit CV' }) : t('cv.create_cv', { defaultValue: 'Create CV' }),
          headerRight: () => (
            <TouchableOpacity onPress={handleSave} style={{ marginRight: 16 }}>
              {isSaving || createCV.isPending ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Text style={{ color: theme.primary, fontSize: 16, fontWeight: '600' }}>
                  {t('common.save', { defaultValue: 'Save' })}
                </Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {/* CV Title */}
        <Card padding={16} margin={0} elevation="small" style={styles.section}>
          <Text style={styles.label}>{t('cv.cv_title', { defaultValue: 'CV Title' })}</Text>
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
            value={cvTitle}
            onChangeText={setCvTitle}
            placeholder={t('cv.cv_title_placeholder', { defaultValue: 'e.g., Software Developer CV' })}
            placeholderTextColor={theme.textSecondary}
          />
        </Card>

        {/* Personal Information */}
        <PersonalInfoSection
          section={sections.find((s) => s.type === 'personal')}
          onUpdate={(data) => {
            const personalSection = sections.find((s) => s.type === 'personal');
            if (personalSection) {
              updateSection(personalSection.id, { data });
            }
          }}
          theme={theme}
          t={t}
        />

        {/* Other Sections */}
        {sections
          .filter((s) => s.type !== 'personal')
          .map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              onEdit={() => setActiveSection(section)}
              onDelete={() => removeSection(section.id)}
              theme={theme}
              t={t}
            />
          ))}

        {/* Add Section Button */}
        <TouchableOpacity
          style={[styles.addSectionButton, { borderColor: theme.border }]}
          onPress={() => {
            // Show section type picker
            Alert.alert(
              t('cv.add_section', { defaultValue: 'Add Section' }),
              t('cv.select_section_type', { defaultValue: 'Select section type' }),
              [
                { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
                {
                  text: t('cv.experience', { defaultValue: 'Experience' }),
                  onPress: () => addSection('experience'),
                },
                {
                  text: t('cv.education', { defaultValue: 'Education' }),
                  onPress: () => addSection('education'),
                },
                {
                  text: t('cv.skills', { defaultValue: 'Skills' }),
                  onPress: () => addSection('skills'),
                },
                {
                  text: t('cv.certifications', { defaultValue: 'Certifications' }),
                  onPress: () => addSection('certifications'),
                },
                {
                  text: t('cv.languages', { defaultValue: 'Languages' }),
                  onPress: () => addSection('languages'),
                },
              ]
            );
          }}
        >
          <Ionicons name="add-circle-outline" size={24} color={theme.primary} />
          <Text style={[styles.addSectionText, { color: theme.primary }]}>
            {t('cv.add_section', { defaultValue: 'Add Section' })}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Section Editor Modal */}
      {activeSection && (
        <SectionEditorModal
          section={activeSection}
          onUpdate={(data) => updateSection(activeSection.id, { data })}
          onClose={() => setActiveSection(null)}
          theme={theme}
          t={t}
        />
      )}
    </View>
  );
}

function PersonalInfoSection({
  section,
  onUpdate,
  theme,
  t,
}: {
  section?: CVSection;
  onUpdate: (data: any) => void;
  theme: any;
  t: any;
}) {
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

  React.useEffect(() => {
    onUpdate(data);
  }, [data]);

  return (
    <Card padding={16} margin={0} elevation="small" style={{ marginBottom: 12 }}>
      <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', marginBottom: 16 }}>
        {t('cv.personal_info', { defaultValue: 'Personal Information' })}
      </Text>
      {[
        { key: 'fullName', label: t('cv.full_name', { defaultValue: 'Full Name' }), placeholder: 'John Doe' },
        { key: 'email', label: t('cv.email', { defaultValue: 'Email' }), placeholder: 'john@example.com', keyboardType: 'email-address' },
        { key: 'phone', label: t('cv.phone', { defaultValue: 'Phone' }), placeholder: '+27 12 345 6789', keyboardType: 'phone-pad' },
        { key: 'address', label: t('cv.address', { defaultValue: 'Address' }), placeholder: 'City, Country' },
      ].map((field) => (
        <View key={field.key} style={{ marginBottom: 16 }}>
          <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>{field.label}</Text>
          <TextInput
            style={[createStyles(theme).input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
            value={data[field.key]}
            onChangeText={(text) => setData({ ...data, [field.key]: text })}
            placeholder={field.placeholder}
            placeholderTextColor={theme.textSecondary}
            keyboardType={field.keyboardType as any}
          />
        </View>
      ))}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
          {t('cv.summary', { defaultValue: 'Professional Summary' })}
        </Text>
        <TextInput
          style={[
            createStyles(theme).input,
            { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border, minHeight: 100, textAlignVertical: 'top' },
          ]}
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

function SectionCard({
  section,
  onEdit,
  onDelete,
  theme,
  t,
}: {
  section: CVSection;
  onEdit: () => void;
  onDelete: () => void;
  theme: any;
  t: any;
}) {
  return (
    <Card padding={16} margin={0} elevation="small" style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>{section.title}</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
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

function SectionEditorModal({
  section,
  onUpdate,
  onClose,
  theme,
  t,
}: {
  section: CVSection;
  onUpdate: (data: any) => void;
  onClose: () => void;
  theme: any;
  t: any;
}) {
  const [data, setData] = useState(section.data);

  const handleSave = () => {
    onUpdate(data);
    onClose();
  };

  const renderEditor = () => {
    switch (section.type) {
      case 'experience':
        return (
          <ExperienceEditor data={data} onChange={setData} theme={theme} t={t} />
        );
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
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border }}>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>{section.title}</Text>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <TouchableOpacity onPress={handleSave}>
              <Text style={{ color: theme.primary, fontSize: 16, fontWeight: '600' }}>{t('common.save', { defaultValue: 'Save' })}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView style={{ flex: 1, padding: 16 }}>{renderEditor()}</ScrollView>
      </View>
    </Modal>
  );
}

function ExperienceEditor({ data, onChange, theme, t }: { data: any; onChange: (data: any) => void; theme: any; t: any }) {
  const items = data.items || [];
  const addItem = () => {
    onChange({ items: [...items, { company: '', position: '', startDate: '', endDate: '', description: '', current: false }] });
  };
  const updateItem = (index: number, updates: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updates };
    onChange({ items: newItems });
  };
  return (
    <View>
      {items.map((item: any, index: number) => (
        <Card key={index} padding={16} margin={0} elevation="small" style={{ marginBottom: 12 }}>
          <TextInput
            style={[createStyles(theme).input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border, marginBottom: 12 }]}
            value={item.position}
            onChangeText={(text) => updateItem(index, { position: text })}
            placeholder={t('cv.position', { defaultValue: 'Position/Title' })}
            placeholderTextColor={theme.textSecondary}
          />
          <TextInput
            style={[createStyles(theme).input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border, marginBottom: 12 }]}
            value={item.company}
            onChangeText={(text) => updateItem(index, { company: text })}
            placeholder={t('cv.company', { defaultValue: 'Company' })}
            placeholderTextColor={theme.textSecondary}
          />
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
            <TextInput
              style={[createStyles(theme).input, { flex: 1, color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
              value={item.startDate}
              onChangeText={(text) => updateItem(index, { startDate: text })}
              placeholder={t('cv.start_date', { defaultValue: 'Start Date' })}
              placeholderTextColor={theme.textSecondary}
            />
            <TextInput
              style={[createStyles(theme).input, { flex: 1, color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
              value={item.endDate}
              onChangeText={(text) => updateItem(index, { endDate: text })}
              placeholder={t('cv.end_date', { defaultValue: 'End Date' })}
              placeholderTextColor={theme.textSecondary}
            />
          </View>
          <TextInput
            style={[
              createStyles(theme).input,
              { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border, minHeight: 80, textAlignVertical: 'top' },
            ]}
            value={item.description}
            onChangeText={(text) => updateItem(index, { description: text })}
            placeholder={t('cv.description', { defaultValue: 'Job Description' })}
            placeholderTextColor={theme.textSecondary}
            multiline
          />
        </Card>
      ))}
      <TouchableOpacity
        style={[createStyles(theme).addSectionButton, { borderColor: theme.border }]}
        onPress={addItem}
      >
        <Ionicons name="add" size={20} color={theme.primary} />
        <Text style={{ color: theme.primary }}>{t('cv.add_experience', { defaultValue: 'Add Experience' })}</Text>
      </TouchableOpacity>
    </View>
  );
}

function EducationEditor({ data, onChange, theme, t }: { data: any; onChange: (data: any) => void; theme: any; t: any }) {
  const items = data.items || [];
  const addItem = () => {
    onChange({ items: [...items, { institution: '', degree: '', field: '', startDate: '', endDate: '' }] });
  };
  const updateItem = (index: number, updates: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updates };
    onChange({ items: newItems });
  };
  return (
    <View>
      {items.map((item: any, index: number) => (
        <Card key={index} padding={16} margin={0} elevation="small" style={{ marginBottom: 12 }}>
          <TextInput
            style={[createStyles(theme).input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border, marginBottom: 12 }]}
            value={item.degree}
            onChangeText={(text) => updateItem(index, { degree: text })}
            placeholder={t('cv.degree', { defaultValue: 'Degree' })}
            placeholderTextColor={theme.textSecondary}
          />
          <TextInput
            style={[createStyles(theme).input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border, marginBottom: 12 }]}
            value={item.institution}
            onChangeText={(text) => updateItem(index, { institution: text })}
            placeholder={t('cv.institution', { defaultValue: 'Institution' })}
            placeholderTextColor={theme.textSecondary}
          />
          <TextInput
            style={[createStyles(theme).input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border, marginBottom: 12 }]}
            value={item.field}
            onChangeText={(text) => updateItem(index, { field: text })}
            placeholder={t('cv.field_of_study', { defaultValue: 'Field of Study' })}
            placeholderTextColor={theme.textSecondary}
          />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TextInput
              style={[createStyles(theme).input, { flex: 1, color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
              value={item.startDate}
              onChangeText={(text) => updateItem(index, { startDate: text })}
              placeholder={t('cv.start_date', { defaultValue: 'Start Date' })}
              placeholderTextColor={theme.textSecondary}
            />
            <TextInput
              style={[createStyles(theme).input, { flex: 1, color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
              value={item.endDate}
              onChangeText={(text) => updateItem(index, { endDate: text })}
              placeholder={t('cv.end_date', { defaultValue: 'End Date' })}
              placeholderTextColor={theme.textSecondary}
            />
          </View>
        </Card>
      ))}
      <TouchableOpacity
        style={[createStyles(theme).addSectionButton, { borderColor: theme.border }]}
        onPress={addItem}
      >
        <Ionicons name="add" size={20} color={theme.primary} />
        <Text style={{ color: theme.primary }}>{t('cv.add_education', { defaultValue: 'Add Education' })}</Text>
      </TouchableOpacity>
    </View>
  );
}

function SkillsEditor({ data, onChange, theme, t }: { data: any; onChange: (data: any) => void; theme: any; t: any }) {
  const skills = data.skills || [];
  const [newSkill, setNewSkill] = useState('');
  const addSkill = () => {
    if (newSkill.trim()) {
      onChange({ skills: [...skills, { name: newSkill.trim(), level: 'intermediate' }] });
      setNewSkill('');
    }
  };
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <TextInput
          style={[createStyles(theme).input, { flex: 1, color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
          value={newSkill}
          onChangeText={setNewSkill}
          placeholder={t('cv.skill_name', { defaultValue: 'Skill name' })}
          placeholderTextColor={theme.textSecondary}
          onSubmitEditing={addSkill}
        />
        <TouchableOpacity style={{ padding: 12, backgroundColor: theme.primary, borderRadius: 8 }} onPress={addSkill}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      {skills.map((skill: any, index: number) => (
        <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ flex: 1, color: theme.text }}>{skill.name}</Text>
          <TouchableOpacity onPress={() => onChange({ skills: skills.filter((_: any, i: number) => i !== index) })}>
            <Ionicons name="close-circle" size={24} color={theme.error || '#EF4444'} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

function CertificationsEditor({ data, onChange, theme, t }: { data: any; onChange: (data: any) => void; theme: any; t: any }) {
  const items = data.items || [];
  const addItem = () => {
    onChange({ items: [...items, { name: '', issuer: '', date: '', expiryDate: '' }] });
  };
  const updateItem = (index: number, updates: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updates };
    onChange({ items: newItems });
  };
  return (
    <View>
      {items.map((item: any, index: number) => (
        <Card key={index} padding={16} margin={0} elevation="small" style={{ marginBottom: 12 }}>
          <TextInput
            style={[createStyles(theme).input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border, marginBottom: 12 }]}
            value={item.name}
            onChangeText={(text) => updateItem(index, { name: text })}
            placeholder={t('cv.certification_name', { defaultValue: 'Certification Name' })}
            placeholderTextColor={theme.textSecondary}
          />
          <TextInput
            style={[createStyles(theme).input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border, marginBottom: 12 }]}
            value={item.issuer}
            onChangeText={(text) => updateItem(index, { issuer: text })}
            placeholder={t('cv.issuer', { defaultValue: 'Issuing Organization' })}
            placeholderTextColor={theme.textSecondary}
          />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TextInput
              style={[createStyles(theme).input, { flex: 1, color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
              value={item.date}
              onChangeText={(text) => updateItem(index, { date: text })}
              placeholder={t('cv.date', { defaultValue: 'Date' })}
              placeholderTextColor={theme.textSecondary}
            />
            <TextInput
              style={[createStyles(theme).input, { flex: 1, color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
              value={item.expiryDate}
              onChangeText={(text) => updateItem(index, { expiryDate: text })}
              placeholder={t('cv.expiry_date', { defaultValue: 'Expiry Date' })}
              placeholderTextColor={theme.textSecondary}
            />
          </View>
        </Card>
      ))}
      <TouchableOpacity
        style={[createStyles(theme).addSectionButton, { borderColor: theme.border }]}
        onPress={addItem}
      >
        <Ionicons name="add" size={20} color={theme.primary} />
        <Text style={{ color: theme.primary }}>{t('cv.add_certification', { defaultValue: 'Add Certification' })}</Text>
      </TouchableOpacity>
    </View>
  );
}

function LanguagesEditor({ data, onChange, theme, t }: { data: any; onChange: (data: any) => void; theme: any; t: any }) {
  const languages = data.languages || [];
  const [newLanguage, setNewLanguage] = useState('');
  const addLanguage = () => {
    if (newLanguage.trim()) {
      onChange({ languages: [...languages, { name: newLanguage.trim(), proficiency: 'intermediate' }] });
      setNewLanguage('');
    }
  };
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <TextInput
          style={[createStyles(theme).input, { flex: 1, color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
          value={newLanguage}
          onChangeText={setNewLanguage}
          placeholder={t('cv.language_name', { defaultValue: 'Language' })}
          placeholderTextColor={theme.textSecondary}
          onSubmitEditing={addLanguage}
        />
        <TouchableOpacity style={{ padding: 12, backgroundColor: theme.primary, borderRadius: 8 }} onPress={addLanguage}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      {languages.map((lang: any, index: number) => (
        <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ flex: 1, color: theme.text }}>{lang.name}</Text>
          <TouchableOpacity onPress={() => onChange({ languages: languages.filter((_: any, i: number) => i !== index) })}>
            <Ionicons name="close-circle" size={24} color={theme.error || '#EF4444'} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

function getSectionTitle(type: CVSection['type'], t: any): string {
  const titles: Record<CVSection['type'], string> = {
    personal: t('cv.personal_info', { defaultValue: 'Personal Information' }),
    experience: t('cv.experience', { defaultValue: 'Experience' }),
    education: t('cv.education', { defaultValue: 'Education' }),
    skills: t('cv.skills', { defaultValue: 'Skills' }),
    certifications: t('cv.certifications', { defaultValue: 'Certifications' }),
    languages: t('cv.languages', { defaultValue: 'Languages' }),
  };
  return titles[type];
}

function getDefaultSectionData(type: CVSection['type']): any {
  switch (type) {
    case 'experience':
      return { items: [] };
    case 'education':
      return { items: [] };
    case 'skills':
      return { skills: [] };
    case 'certifications':
      return { items: [] };
    case 'languages':
      return { languages: [] };
    default:
      return {};
  }
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  content: { padding: 16, paddingBottom: 32 },
  section: { marginBottom: 12 },
  label: { color: theme.text, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { height: 44, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, fontSize: 16 },
  addSectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    gap: 8,
    marginTop: 8,
  },
  addSectionText: { fontSize: 16, fontWeight: '600' },
});





