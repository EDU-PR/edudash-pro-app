// Quick Actions Component

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

export function QuickActions() {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.quickActionsRow}>
      <TouchableOpacity 
        style={[styles.quickAction, { backgroundColor: '#3B82F6' + '20', borderColor: '#3B82F6' }]}
        onPress={() => router.push('/screens/teacher-message-list')}
      >
        <View style={[styles.quickActionIcon, { backgroundColor: '#3B82F6' }]}>
          <Ionicons name="chatbubbles" size={20} color="#fff" />
        </View>
        <Text style={[styles.quickActionLabel, { color: '#3B82F6' }]}>Direct Messages</Text>
        <Ionicons name="chevron-forward" size={16} color="#3B82F6" />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.quickAction, { backgroundColor: '#10B981' + '20', borderColor: '#10B981' }]}
        onPress={() => router.push('/screens/calls')}
      >
        <View style={[styles.quickActionIcon, { backgroundColor: '#10B981' }]}>
          <Ionicons name="call" size={20} color="#fff" />
        </View>
        <Text style={[styles.quickActionLabel, { color: '#10B981' }]}>Voice & Video Calls</Text>
        <Ionicons name="chevron-forward" size={16} color="#10B981" />
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  quickActionsRow: {
    flexDirection: 'column',
    gap: 10,
    marginBottom: 16,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  quickActionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
});
