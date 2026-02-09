/**
 * DashAIItem — Special AI assistant entry in message list
 * Extracted from parent-messages.tsx for WARP compliance
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

interface DashAIItemProps {
  onPress: () => void;
  title: string;
  subtitle: string;
  description: string;
}

export const DashAIItem: React.FC<DashAIItemProps> = React.memo(({ onPress, title, subtitle, description }) => {
  const { theme } = useTheme();

  const s = React.useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: theme.surface, marginHorizontal: 16, marginBottom: 8,
      borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#8B5CF640',
      ...Platform.select({
        ios: { shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8 },
        android: { elevation: 3 },
      }),
    },
    inner: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    avatarGlow: {
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: '#8B5CF620', alignItems: 'center', justifyContent: 'center', marginRight: 14,
    },
    avatarInner: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: '#8B5CF6', alignItems: 'center', justifyContent: 'center',
    },
    content: { flex: 1 },
    topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    name: { fontSize: 16, fontWeight: '600', color: theme.text },
    sparkle: { marginLeft: 6 },
    aiBadge: { backgroundColor: '#8B5CF620', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginLeft: 8 },
    aiBadgeText: { fontSize: 11, color: '#8B5CF6', fontWeight: '600' },
    subtitle: { fontSize: 13, color: '#8B5CF6', fontWeight: '500', marginBottom: 4 },
    description: { fontSize: 14, color: theme.textSecondary, lineHeight: 20 },
  }), [theme]);

  return (
    <TouchableOpacity style={s.container} onPress={onPress} activeOpacity={0.7}>
      <View style={s.inner}>
        <View style={s.avatarGlow}>
          <View style={s.avatarInner}>
            <Ionicons name="sparkles" size={24} color="white" />
          </View>
        </View>
        <View style={s.content}>
          <View style={s.topRow}>
            <Text style={s.name}>{title}</Text>
            <Ionicons name="sparkles" size={14} color="#8B5CF6" style={s.sparkle} />
            <View style={s.aiBadge}>
              <Text style={s.aiBadgeText}>AI</Text>
            </View>
          </View>
          <Text style={s.subtitle}>{subtitle}</Text>
          <Text style={s.description} numberOfLines={1}>{description}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});
