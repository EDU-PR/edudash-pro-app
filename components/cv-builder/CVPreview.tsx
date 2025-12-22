/**
 * CV Preview Component
 */
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CVSection } from './types';

interface CVPreviewProps {
  sections: CVSection[];
  cvTitle: string;
  profile: any;
  theme: any;
  insets: any;
  t: any;
}

export function CVPreview({ sections, cvTitle, profile, theme, insets, t }: CVPreviewProps) {
  const personalSection = sections.find((s) => s.type === 'personal');
  const personalData = personalSection?.data || {};

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.paper, { shadowColor: theme.shadow }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.primary }]}>
          <Text style={styles.title}>
            {personalData.fullName || `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Your Name'}
          </Text>
          <Text style={styles.subtitle}>
            {personalData.summary || t('cv.professional_summary_placeholder', { defaultValue: 'Professional summary...' })}
          </Text>
          <View style={styles.contact}>
            {personalData.email && (
              <Text style={styles.contactItem}>
                <Ionicons name="mail-outline" size={14} color="#666" /> {personalData.email}
              </Text>
            )}
            {personalData.phone && (
              <Text style={styles.contactItem}>
                <Ionicons name="call-outline" size={14} color="#666" /> {personalData.phone}
              </Text>
            )}
            {personalData.address && (
              <Text style={styles.contactItem}>
                <Ionicons name="location-outline" size={14} color="#666" /> {personalData.address}
              </Text>
            )}
          </View>
        </View>

        {/* Sections */}
        {sections.filter((s) => s.type !== 'personal').map((section) => (
          <View key={section.id} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {renderSection(section, theme, t)}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function renderSection(section: CVSection, theme: any, t: any) {
  switch (section.type) {
    case 'experience':
    case 'education':
      return (section.data.items || []).map((item: any, index: number) => (
        <View key={index} style={styles.item}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemTitle}>{item.position || item.degree || 'Title'}</Text>
            <Text style={styles.itemDate}>
              {item.startDate || ''} {item.endDate ? `- ${item.endDate}` : item.current ? '- Present' : ''}
            </Text>
          </View>
          <Text style={styles.itemCompany}>{item.company || item.institution || 'Organization'}</Text>
          {(item.description || item.field) && <Text style={styles.itemDescription}>{item.description || item.field}</Text>}
        </View>
      ));
    case 'skills':
      return (
        <View style={styles.skills}>
          {(section.data.skills || []).map((skill: any, index: number) => (
            <View key={index} style={[styles.skillTag, { backgroundColor: theme.primary + '20' }]}>
              <Text style={[styles.skillText, { color: theme.primary }]}>{skill.name}</Text>
            </View>
          ))}
        </View>
      );
    case 'certifications':
      return (section.data.items || []).map((item: any, index: number) => (
        <View key={index} style={styles.item}>
          <Text style={styles.itemTitle}>{item.name || 'Certification'}</Text>
          <Text style={styles.itemCompany}>{item.issuer || 'Issuer'}</Text>
          <Text style={styles.itemDate}>{item.date || ''}</Text>
        </View>
      ));
    case 'languages':
      return (
        <View style={styles.languages}>
          {(section.data.languages || []).map((lang: any, index: number) => (
            <View key={index} style={styles.languageItem}>
              <Text style={styles.languageName}>{lang.name}</Text>
              <Text style={styles.languageLevel}>{lang.proficiency || 'intermediate'}</Text>
            </View>
          ))}
        </View>
      );
    case 'projects':
    case 'references':
    case 'achievements':
    case 'volunteer':
      return (section.data.items || []).map((item: any, index: number) => (
        <View key={index} style={styles.item}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemTitle}>{item.name || item.title || item.role || 'Title'}</Text>
            {(item.date || item.startDate) && (
              <Text style={styles.itemDate}>
                {item.date || item.startDate}{item.endDate ? ` - ${item.endDate}` : ''}
              </Text>
            )}
          </View>
          {(item.company || item.organization || item.issuer) && (
            <Text style={styles.itemCompany}>{item.company || item.organization || item.issuer}</Text>
          )}
          {item.description && <Text style={styles.itemDescription}>{item.description}</Text>}
        </View>
      ));
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingTop: 8 },
  paper: { backgroundColor: '#fff', padding: 24, borderRadius: 8, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  header: { marginBottom: 24, borderBottomWidth: 2, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: '#333', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 12 },
  contact: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  contactItem: { fontSize: 12, color: '#666' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#ddd', paddingBottom: 8 },
  item: { marginBottom: 16 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  itemTitle: { fontSize: 16, fontWeight: '600', color: '#333', flex: 1 },
  itemDate: { fontSize: 12, color: '#666' },
  itemCompany: { fontSize: 14, color: '#555', marginBottom: 4 },
  itemDescription: { fontSize: 13, color: '#666', lineHeight: 18, marginTop: 4 },
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  skillText: { fontSize: 13, fontWeight: '500' },
  languages: { gap: 8 },
  languageItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  languageName: { fontSize: 14, color: '#333', fontWeight: '500' },
  languageLevel: { fontSize: 12, color: '#666' },
});
