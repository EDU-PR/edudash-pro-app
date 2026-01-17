// Activity Detail Modal Component
// Shows full details of an activity template

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ActivityTemplate } from './types';
import { DEVELOPMENTAL_DOMAINS, getActivityTypeInfo } from './types';

interface ActivityDetailModalProps {
  visible: boolean;
  activity: ActivityTemplate | null;
  onClose: () => void;
  onUse: (activity: ActivityTemplate) => void;
}

export function ActivityDetailModal({
  visible,
  activity,
  onClose,
  onUse,
}: ActivityDetailModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme, insets.bottom);

  if (!activity) return null;

  const typeInfo = getActivityTypeInfo(activity.activity_type);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle} numberOfLines={1}>{activity.title}</Text>
          <TouchableOpacity
            style={styles.useButton}
            onPress={() => onUse(activity)}
          >
            <Text style={styles.useButtonText}>Use</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentInner}>
          {/* Type & Duration */}
          <View style={styles.detailRow}>
            <View style={[styles.typeIcon, { backgroundColor: typeInfo.color + '20' }]}>
              <Ionicons
                name={typeInfo.icon as any}
                size={24}
                color={typeInfo.color}
              />
            </View>
            <View style={styles.detailInfo}>
              <Text style={styles.detailLabel}>{typeInfo.label}</Text>
              <Text style={styles.detailValue}>
                {activity.duration_minutes} minutes • {activity.group_size?.replace('_', ' ')}
              </Text>
            </View>
          </View>
          
          {/* Description */}
          {activity.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.descriptionText}>{activity.description}</Text>
            </View>
          )}
          
          {/* Developmental Domains */}
          {activity.developmental_domains?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Developmental Domains</Text>
              <View style={styles.domainsRow}>
                {activity.developmental_domains.map((domain) => {
                  const domainInfo = DEVELOPMENTAL_DOMAINS.find(d => d.value === domain);
                  return (
                    <View
                      key={domain}
                      style={[styles.domainBadge, { backgroundColor: (domainInfo?.color || '#6B7280') + '20' }]}
                    >
                      <Text style={[styles.domainText, { color: domainInfo?.color || '#6B7280' }]}>
                        {domainInfo?.label || domain}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
          
          {/* Learning Objectives */}
          {activity.learning_objectives?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Learning Objectives</Text>
              {activity.learning_objectives.map((objective, index) => (
                <View key={index} style={styles.listItem}>
                  <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                  <Text style={styles.listItemText}>{objective}</Text>
                </View>
              ))}
            </View>
          )}
          
          {/* Materials */}
          {activity.materials_needed?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Materials Needed</Text>
              {activity.materials_needed.map((material, index) => (
                <View key={index} style={styles.listItem}>
                  <Ionicons name="cube-outline" size={18} color={theme.textSecondary} />
                  <Text style={styles.listItemText}>{material}</Text>
                </View>
              ))}
            </View>
          )}
          
          {/* Steps */}
          {activity.activity_steps?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Activity Steps</Text>
              {activity.activity_steps.map((step, index) => (
                <View key={index} style={styles.stepItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{step.step_number || index + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step.description}</Text>
                </View>
              ))}
            </View>
          )}
          
          {/* Tags */}
          {activity.theme_tags?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Theme Tags</Text>
              <View style={styles.tagsRow}>
                {activity.theme_tags.map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>#{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const createStyles = (theme: any, insetBottom: number) =>
  StyleSheet.create({
    modalContainer: {
      flex: 1,
      backgroundColor: theme.background,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      flex: 1,
      textAlign: 'center',
      marginHorizontal: 12,
    },
    useButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
    },
    useButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    modalContent: {
      flex: 1,
    },
    modalContentInner: {
      padding: 16,
      paddingBottom: insetBottom + 24,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
    },
    typeIcon: {
      width: 48,
      height: 48,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailInfo: {
      marginLeft: 12,
    },
    detailLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    detailValue: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 2,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 10,
    },
    descriptionText: {
      fontSize: 15,
      color: theme.textSecondary,
      lineHeight: 22,
    },
    domainsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    domainBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    domainText: {
      fontSize: 12,
      fontWeight: '500',
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginBottom: 8,
    },
    listItemText: {
      flex: 1,
      fontSize: 15,
      color: theme.text,
      lineHeight: 20,
    },
    stepItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    stepNumber: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    stepNumberText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    stepText: {
      flex: 1,
      fontSize: 15,
      color: theme.text,
      lineHeight: 20,
    },
    tagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    tag: {
      backgroundColor: theme.card,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    tagText: {
      fontSize: 13,
      color: theme.textSecondary,
    },
  });
