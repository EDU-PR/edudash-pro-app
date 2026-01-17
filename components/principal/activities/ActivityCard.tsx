// Activity Card Component
// Displays individual activity template in a list

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import type { ActivityTemplate } from './types';
import { ACTIVITY_TYPES, DEVELOPMENTAL_DOMAINS, getActivityTypeInfo } from './types';

interface ActivityCardProps {
  activity: ActivityTemplate;
  onPress: (activity: ActivityTemplate) => void;
}

export function ActivityCard({ activity, onPress }: ActivityCardProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const typeInfo = getActivityTypeInfo(activity.activity_type);

  return (
    <TouchableOpacity
      style={styles.activityCard}
      onPress={() => onPress(activity)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.typeIcon, { backgroundColor: typeInfo.color + '20' }]}>
          <Ionicons name={typeInfo.icon as any} size={24} color={typeInfo.color} />
        </View>
        <View style={styles.cardTitleContainer}>
          <Text style={styles.activityTitle} numberOfLines={1}>{activity.title}</Text>
          <Text style={styles.activityType}>{typeInfo.label}</Text>
        </View>
        {activity.is_featured && (
          <View style={styles.featuredBadge}>
            <Ionicons name="star" size={14} color="#F59E0B" />
          </View>
        )}
      </View>
      
      {activity.description && (
        <Text style={styles.activityDescription} numberOfLines={2}>
          {activity.description}
        </Text>
      )}
      
      <View style={styles.cardMeta}>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
          <Text style={styles.metaText}>{activity.duration_minutes} min</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="people-outline" size={14} color={theme.textSecondary} />
          <Text style={styles.metaText}>{activity.age_groups?.join(', ') || '3-6'} yrs</Text>
        </View>
        {activity.usage_count > 0 && (
          <View style={styles.metaItem}>
            <Ionicons name="checkmark-circle-outline" size={14} color={theme.textSecondary} />
            <Text style={styles.metaText}>{activity.usage_count} uses</Text>
          </View>
        )}
      </View>
      
      {activity.developmental_domains?.length > 0 && (
        <View style={styles.domainsRow}>
          {activity.developmental_domains.slice(0, 3).map((domain) => {
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
      )}
    </TouchableOpacity>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    activityCard: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    typeIcon: {
      width: 48,
      height: 48,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    cardTitleContainer: {
      flex: 1,
    },
    activityTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.text,
    },
    activityType: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    featuredBadge: {
      padding: 4,
    },
    activityDescription: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 10,
      lineHeight: 20,
    },
    cardMeta: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 10,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaText: {
      fontSize: 13,
      color: theme.textSecondary,
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
  });
