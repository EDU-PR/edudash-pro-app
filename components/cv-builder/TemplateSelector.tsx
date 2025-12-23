/**
 * Template Selector Component
 * Visual selector for CV templates with preview thumbnails
 */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CVTemplate, TEMPLATE_CONFIGS } from './templates';

interface TemplateSelectorProps {
  selectedTemplate: CVTemplate;
  onSelectTemplate: (template: CVTemplate) => void;
  theme: any;
  compact?: boolean;
}

export function TemplateSelector({ 
  selectedTemplate, 
  onSelectTemplate, 
  theme,
  compact = false,
}: TemplateSelectorProps) {
  const templates = Object.entries(TEMPLATE_CONFIGS) as [CVTemplate, typeof TEMPLATE_CONFIGS[CVTemplate]][];

  if (compact) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.compactContainer}
      >
        {templates.map(([key, config]) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.compactCard,
              selectedTemplate === key && styles.compactCardSelected,
              { 
                borderColor: selectedTemplate === key ? config.colors.primary : theme.colors.border,
                backgroundColor: theme.colors.card,
              }
            ]}
            onPress={() => onSelectTemplate(key)}
            activeOpacity={0.7}
          >
            <View style={[styles.compactPreview, { backgroundColor: config.colors.background }]}>
              <View style={[styles.compactHeader, { backgroundColor: config.colors.headerBg }]}>
                <LinearGradient
                  colors={[config.colors.primary, config.colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.compactStrip}
                />
              </View>
              <View style={styles.compactLines}>
                <View style={[styles.compactLine, { backgroundColor: config.colors.text + '40', width: '80%' }]} />
                <View style={[styles.compactLine, { backgroundColor: config.colors.primary + '40', width: '60%' }]} />
                <View style={[styles.compactLine, { backgroundColor: config.colors.textLight + '30', width: '90%' }]} />
                <View style={[styles.compactLine, { backgroundColor: config.colors.textLight + '30', width: '70%' }]} />
              </View>
            </View>
            <Text 
              style={[
                styles.compactLabel, 
                { color: selectedTemplate === key ? config.colors.primary : theme.colors.text }
              ]}
              numberOfLines={1}
            >
              {config.name}
            </Text>
            {selectedTemplate === key && (
              <View style={[styles.checkBadge, { backgroundColor: config.colors.primary }]}>
                <Ionicons name="checkmark" size={10} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.colors.text }]}>Choose Template</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
        Select a design that matches your style
      </Text>
      
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {templates.map(([key, config]) => {
          const isSelected = selectedTemplate === key;
          
          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.templateCard,
                isSelected && styles.templateCardSelected,
                { 
                  borderColor: isSelected ? config.colors.primary : theme.colors.border,
                  backgroundColor: theme.colors.card,
                }
              ]}
              onPress={() => onSelectTemplate(key)}
              activeOpacity={0.7}
            >
              {/* Mini Preview */}
              <View style={[styles.previewContainer, { backgroundColor: config.colors.background }]}>
                {/* Header preview */}
                <View style={[styles.previewHeader, { backgroundColor: config.colors.headerBg }]}>
                  <LinearGradient
                    colors={[config.colors.primary, config.colors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.previewStrip}
                  />
                  <View style={styles.previewHeaderContent}>
                    <View style={[styles.previewNameLine, { backgroundColor: config.colors.text }]} />
                    <View style={[styles.previewSubLine, { backgroundColor: config.colors.primary + '80' }]} />
                  </View>
                </View>
                
                {/* Body preview */}
                <View style={styles.previewBody}>
                  <View style={[styles.previewSectionTitle, { borderColor: config.colors.primary }]} />
                  <View style={[styles.previewLine, { backgroundColor: config.colors.textLight + '40' }]} />
                  <View style={[styles.previewLine, { backgroundColor: config.colors.textLight + '30', width: '80%' }]} />
                  <View style={[styles.previewLine, { backgroundColor: config.colors.textLight + '30', width: '60%' }]} />
                  
                  <View style={[styles.previewSectionTitle, { borderColor: config.colors.primary, marginTop: 8 }]} />
                  <View style={styles.previewSkillTags}>
                    {[1, 2, 3].map((i) => (
                      <View key={i} style={[styles.previewSkillTag, { backgroundColor: config.colors.primary + '20' }]} />
                    ))}
                  </View>
                </View>
              </View>
              
              {/* Template Info */}
              <View style={styles.templateInfo}>
                <Text style={[styles.templateName, { color: isSelected ? config.colors.primary : theme.colors.text }]}>
                  {config.name}
                </Text>
                <Text style={[styles.templateDesc, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                  {config.description}
                </Text>
              </View>
              
              {isSelected && (
                <View style={[styles.selectedBadge, { backgroundColor: config.colors.primary }]}>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 16,
  },
  scrollContent: {
    paddingHorizontal: 4,
    gap: 12,
  },
  templateCard: {
    width: 140,
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  templateCardSelected: {
    shadowOpacity: 0.15,
    elevation: 5,
  },
  previewContainer: {
    height: 160,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  previewHeader: {
    padding: 10,
    paddingTop: 8,
  },
  previewStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  previewHeaderContent: {
    marginTop: 4,
  },
  previewNameLine: {
    width: '60%',
    height: 8,
    borderRadius: 2,
    marginBottom: 4,
  },
  previewSubLine: {
    width: '40%',
    height: 5,
    borderRadius: 2,
  },
  previewBody: {
    padding: 10,
    paddingTop: 6,
  },
  previewSectionTitle: {
    width: '50%',
    height: 6,
    borderLeftWidth: 2,
    marginBottom: 6,
    paddingLeft: 4,
  },
  previewLine: {
    width: '100%',
    height: 4,
    borderRadius: 1,
    marginBottom: 3,
  },
  previewSkillTags: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  previewSkillTag: {
    width: 24,
    height: 10,
    borderRadius: 5,
  },
  templateInfo: {
    padding: 12,
    paddingTop: 10,
  },
  templateName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  templateDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  
  // Compact styles
  compactContainer: {
    paddingHorizontal: 4,
    gap: 10,
  },
  compactCard: {
    width: 80,
    borderRadius: 10,
    borderWidth: 2,
    overflow: 'hidden',
    padding: 4,
  },
  compactCardSelected: {},
  compactPreview: {
    height: 70,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 6,
  },
  compactHeader: {
    padding: 6,
    paddingTop: 4,
  },
  compactStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  compactLines: {
    padding: 6,
    paddingTop: 2,
    gap: 3,
  },
  compactLine: {
    height: 3,
    borderRadius: 1,
  },
  compactLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    paddingBottom: 4,
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default TemplateSelector;
