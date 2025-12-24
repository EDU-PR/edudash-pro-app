/**
 * Action Cards Grid Component
 * Urgent action cards for regional dashboard
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { RegionalAction } from './types';

interface ActionCardsGridProps {
  actions: RegionalAction[];
  theme: any;
}

export function ActionCardsGrid({ actions, theme }: ActionCardsGridProps) {
  return (
    <View style={styles.urgentActionsGrid}>
      {actions.map((action) => (
        <TouchableOpacity
          key={action.id}
          style={[styles.urgentActionCard, { backgroundColor: theme.card }]}
          onPress={() => router.push(action.route as any)}
        >
          <View style={styles.urgentActionTop}>
            <View style={[styles.urgentActionIcon, { backgroundColor: action.color + '15' }]}>
              <Ionicons name={action.icon as any} size={28} color={action.color} />
            </View>
            {action.count && (
              <View style={[styles.urgentBadge, { backgroundColor: action.color }]}>
                <Text style={styles.urgentBadgeText}>{action.count}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.urgentActionLabel, { color: theme.text }]}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  urgentActionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  urgentActionCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  urgentActionTop: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  urgentActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  urgentBadge: {
    position: 'absolute',
    top: -4,
    right: 20,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  urgentBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  urgentActionLabel: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
