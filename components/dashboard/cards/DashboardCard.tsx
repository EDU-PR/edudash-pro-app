import React from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export interface DashboardCardProps {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  children: React.ReactNode;
  loading?: boolean;
  error?: string;
}

export function DashboardCard({
  title,
  icon,
  onPress,
  children,
  loading,
  error,
}: DashboardCardProps) {
  const { theme } = useTheme();

  const cardContent = (
    <View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors?.surface || theme.card || theme.background,
            borderColor: theme.colors?.border || theme.border || '#e5e7eb',
          },
        ]}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          {icon && (
            <Ionicons name={icon} size={20} color={theme.colors?.primary || theme.primary} style={styles.icon} />
          )}
          <Text
            style={[
              styles.title, 
              onPress && styles.linkTitle, 
              { color: onPress ? (theme.colors?.primary || theme.primary) : theme.text }
            ]}
            accessibilityRole={onPress ? 'link' : undefined}
          >
            {title}
          </Text>
          {onPress && (
            <Ionicons name="chevron-forward" size={16} color={theme.colors?.primary || theme.primary} style={styles.chevron} />
          )}
        </View>
      </View>

      <View style={styles.content}>
        {loading ? (
          <Text style={[styles.placeholder, { color: theme.textSecondary }]}>Loading...</Text>
        ) : error ? (
          <Text style={[styles.placeholder, { color: theme.colors?.error || theme.error || '#ef4444' }]}>
            {error}
          </Text>
        ) : (
          children
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
      >
        {cardContent}
      </Pressable>
    );
  }

  return cardContent;
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  linkTitle: {
    textDecorationLine: 'underline',
  },
  chevron: {
    marginLeft: 6,
  },
  content: {
    minHeight: 60,
  },
  placeholder: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
    paddingVertical: 20,
  },
});
