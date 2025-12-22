/**
 * Collapsible section header component
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface SectionHeaderProps {
  title: string;
  icon?: string;
  expanded: boolean;
  onToggle: () => void;
  theme: any;
}

export function SectionHeader({ title, icon, expanded, onToggle, theme }: SectionHeaderProps) {
  return (
    <TouchableOpacity
      style={[styles.sectionHeader, { backgroundColor: theme.surface, borderColor: theme.border }]}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={`${title} section`}
    >
      <View style={styles.titleRow}>
        {icon ? <Text style={styles.icon}>{icon}</Text> : null}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      </View>
      <Text style={[styles.expandIcon, { color: theme.textSecondary }]}>
        {expanded ? '▼' : '▶'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  expandIcon: {
    fontSize: 16,
    fontWeight: '600',
  },
});
