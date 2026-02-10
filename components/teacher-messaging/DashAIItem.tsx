/**
 * DashAIItem — AI assistant entry that appears at the top of the teacher message list.
 * Styles use a useMemo factory to avoid re-creation on every render.
 */

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

interface DashAIItemProps {
  onPress: () => void;
  title: string;
  subtitle: string;
  description: string;
}

const AI_PURPLE = '#8B5CF6';

const createDashAIItemStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.surface,
      marginHorizontal: 16,
      marginBottom: 8,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: AI_PURPLE + '40',
      ...Platform.select({
        ios: {
          shadowColor: AI_PURPLE,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
        },
        android: { elevation: 3 },
      }),
    },
    inner: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    avatarGlow: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: AI_PURPLE + '20',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    avatarInner: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: AI_PURPLE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: { flex: 1 },
    topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    name: { fontSize: 16, fontWeight: '600', color: theme.text },
    sparkle: { marginLeft: 6 },
    aiBadge: {
      backgroundColor: AI_PURPLE + '20',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      marginLeft: 8,
    },
    aiBadgeText: { fontSize: 11, color: AI_PURPLE, fontWeight: '600' },
    subtitle: { fontSize: 13, color: AI_PURPLE, fontWeight: '500', marginBottom: 4 },
    description: { fontSize: 14, color: theme.textSecondary, lineHeight: 20 },
  });

const DashAIItem: React.FC<DashAIItemProps> = React.memo(({ onPress, title, subtitle, description }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createDashAIItemStyles(theme), [theme]);

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.inner}>
        <View style={styles.avatarGlow}>
          <View style={styles.avatarInner}>
            <Ionicons name="sparkles" size={24} color="white" />
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text style={styles.name}>{title}</Text>
            <Ionicons name="sparkles" size={14} color={AI_PURPLE} style={styles.sparkle} />
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>AI</Text>
            </View>
          </View>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <Text style={styles.description} numberOfLines={1}>
            {description}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default DashAIItem;
