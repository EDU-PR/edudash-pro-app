/**
 * Template Selector Component
 * Card style/template selector for ID card
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CARD_TEMPLATES, CardTemplate } from '@/components/membership/types';
import type { TemplateSelectorProps } from './types';

export function TemplateSelector({ selectedTemplate, onSelectTemplate, theme }: TemplateSelectorProps) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Card Style</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.templateRow}>
          {Object.entries(CARD_TEMPLATES).map(([key, config]) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.templateOption,
                { 
                  backgroundColor: theme.card,
                  borderColor: selectedTemplate === key ? theme.primary : theme.border,
                  borderWidth: selectedTemplate === key ? 2 : 1,
                },
              ]}
              onPress={() => onSelectTemplate(key as CardTemplate)}
            >
              <LinearGradient
                colors={config.gradientColors as [string, string]}
                style={styles.templatePreview}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="card" size={20} color="#fff" />
              </LinearGradient>
              <Text style={[styles.templateName, { color: theme.text }]}>
                {config.name}
              </Text>
              {selectedTemplate === key && (
                <View style={[styles.templateCheck, { backgroundColor: theme.primary }]}>
                  <Ionicons name="checkmark" size={12} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  templateRow: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 16,
  },
  templateOption: {
    width: 80,
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    position: 'relative',
  },
  templatePreview: {
    width: 64,
    height: 40,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateName: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
  },
  templateCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
