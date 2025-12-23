/**
 * Content Template Selector
 * Select pre-filled CV templates based on career type
 */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { ContentTemplate, CONTENT_TEMPLATES } from './sampleContent';

interface ContentTemplateSelectorProps {
  visible: boolean;
  onSelectTemplate: (templateId: ContentTemplate) => void;
  onClose: () => void;
  theme: any;
}

export function ContentTemplateSelector({
  visible,
  onSelectTemplate,
  onClose,
  theme,
}: ContentTemplateSelectorProps) {
  const templates = Object.values(CONTENT_TEMPLATES);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <BlurView intensity={20} style={styles.backdrop}>
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>
              Choose Your CV Template
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Select a template that matches your profile. You can edit everything after.
            </Text>
          </View>

          {/* Templates Grid */}
          <ScrollView 
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
          >
            {templates.map((template) => (
              <TouchableOpacity
                key={template.id}
                style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => onSelectTemplate(template.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconContainer, { backgroundColor: theme.primary + '15' }]}>
                  <Ionicons name={template.icon as any} size={32} color={theme.primary} />
                </View>
                <Text style={[styles.cardTitle, { color: theme.text }]}>
                  {template.name}
                </Text>
                <Text style={[styles.cardDescription, { color: theme.textSecondary }]}>
                  {template.description}
                </Text>
                <View style={styles.sectionCount}>
                  <Ionicons name="layers-outline" size={14} color={theme.textSecondary} />
                  <Text style={[styles.sectionCountText, { color: theme.textSecondary }]}>
                    {template.sections.length} sections
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Close Button */}
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={onClose}
          >
            <Text style={[styles.closeButtonText, { color: theme.text }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  container: {
    maxHeight: '90%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  grid: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '47%',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  sectionCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionCountText: {
    fontSize: 12,
  },
  closeButton: {
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ContentTemplateSelector;
