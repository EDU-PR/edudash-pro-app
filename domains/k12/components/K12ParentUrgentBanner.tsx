/**
 * K12ParentUrgentBanner
 *
 * Displays up to 3 urgent items at the top of the dashboard:
 * homework due, overdue fees, unread messages, attendance warnings.
 * Red/amber color coding by urgency. Tappable to navigate.
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ThemeColors } from '@/contexts/ThemeContext';
import type { UrgentItem } from '@/domains/k12/hooks/useK12ParentDashboard';
import { styles } from './K12ParentDashboard.styles';

interface K12ParentUrgentBannerProps {
  items: UrgentItem[];
  onPress: (actionRoute: string) => void;
  theme: ThemeColors;
}

export function K12ParentUrgentBanner({ items, onPress, theme }: K12ParentUrgentBannerProps) {
  if (items.length === 0) return null;

  return (
    <View style={styles.urgentBannerContainer}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={[
            styles.urgentItem,
            {
              backgroundColor: item.color + '12',
              borderColor: item.color + '30',
            },
          ]}
          activeOpacity={0.7}
          onPress={() => onPress(item.actionRoute)}
        >
          <View style={[styles.urgentIcon, { backgroundColor: item.color + '20' }]}>
            <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={20} color={item.color} />
          </View>
          <View style={styles.urgentTextWrap}>
            <Text style={[styles.urgentTitle, { color: theme.text }]}>{item.title}</Text>
            <Text style={[styles.urgentSubtitle, { color: theme.textSecondary }]}>
              {item.subtitle}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      ))}
    </View>
  );
}
