/**
 * GeneratedContentCard - Display generated lesson with actions
 * @module components/ai-lesson-generator/GeneratedContentCard
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import type { GeneratedContentCardProps } from './types';

/**
 * Parsed section component for structured display
 */
interface SectionProps {
  title: string;
  content: string | string[];
  icon: keyof typeof Ionicons.glyphMap;
}

function Section({ title, content, icon }: SectionProps) {
  const contentText = Array.isArray(content) ? content.join('\n• ') : content;
  if (!contentText || contentText.trim() === '') return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={16} color="#6366F1" />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Text style={styles.sectionContent}>
        {Array.isArray(content) ? `• ${contentText}` : contentText}
      </Text>
    </View>
  );
}

/**
 * Card component displaying the generated lesson content
 */
export function GeneratedContentCard({
  lesson,
  generatedContent,
  onSave,
  onCopy,
  onClear,
  isSaving = false,
  showActions = true,
}: GeneratedContentCardProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);

  if (!generatedContent && !lesson) {
    return null;
  }

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(generatedContent);
      setCopied(true);
      onCopy();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older Clipboard API
      onCopy();
    }
  };

  const displayContent = generatedContent || '';
  const wordCount = displayContent.split(/\s+/).filter(Boolean).length;
  const charCount = displayContent.length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Ionicons name="document-text" size={20} color="#10B981" />
          <Text style={styles.title}>Generated Lesson</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.statsContainer}>
            <Text style={styles.statsText}>
              {wordCount} words • {charCount} chars
            </Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#6B7280"
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <>
          {/* Structured sections if lesson object is available */}
          {lesson && (
            <View style={styles.structuredContent}>
              {lesson.title && (
                <Text style={styles.lessonTitle}>{lesson.title}</Text>
              )}
              <Section
                title="Objectives"
                content={lesson.objectives || []}
                icon="flag-outline"
              />
              <Section
                title="Materials"
                content={lesson.materials || []}
                icon="cube-outline"
              />
              <Section
                title="Activities"
                content={lesson.activities || []}
                icon="play-circle-outline"
              />
              <Section
                title="Assessment"
                content={lesson.assessment || ''}
                icon="clipboard-outline"
              />
            </View>
          )}

          {/* Raw content display */}
          <ScrollView
            style={styles.contentScrollView}
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            <Text style={styles.content} selectable>
              {displayContent}
            </Text>
          </ScrollView>

          {/* Action buttons */}
          {showActions && (
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.saveButton]}
                onPress={onSave}
                disabled={isSaving}
                activeOpacity={0.8}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="save" size={18} color="#FFFFFF" />
                )}
                <Text style={styles.saveButtonText}>
                  {isSaving ? 'Saving...' : 'Save Lesson'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.copyButton]}
                onPress={handleCopy}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={copied ? 'checkmark' : 'copy-outline'}
                  size={18}
                  color="#6366F1"
                />
                <Text style={styles.copyButtonText}>
                  {copied ? 'Copied!' : 'Copy'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.clearButton]}
                onPress={onClear}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {/* Success indicator */}
      <View style={styles.successBadge}>
        <Ionicons name="checkmark-circle" size={16} color="#10B981" />
        <Text style={styles.successText}>Generation complete</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#10B981',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#F0FDF4',
    borderBottomWidth: 1,
    borderBottomColor: '#D1FAE5',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
  },
  statsContainer: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statsText: {
    fontSize: 12,
    color: '#059669',
  },
  structuredContent: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  lessonTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  section: {
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  sectionContent: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginLeft: 22,
  },
  contentScrollView: {
    maxHeight: 300,
    padding: 16,
  },
  content: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 6,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#10B981',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  copyButton: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6366F1',
  },
  clearButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#EF4444',
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    paddingVertical: 8,
    gap: 6,
  },
  successText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
});

export default GeneratedContentCard;
