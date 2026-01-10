/**
 * STEM Integration Panel Component
 * 
 * Provides quick access to AI, Robotics, and Computer Literacy integration options
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

interface STEMIntegrationPanelProps {
  onSelectAI?: () => void;
  onSelectRobotics?: () => void;
  onSelectComputerLiteracy?: () => void;
  onSelectInteractive?: () => void;
}

export function STEMIntegrationPanel({
  onSelectAI,
  onSelectRobotics,
  onSelectComputerLiteracy,
  onSelectInteractive,
}: STEMIntegrationPanelProps) {
  const { theme } = useTheme();

  const options = [
    {
      id: 'ai',
      label: 'AI-Enhanced Lesson',
      icon: 'sparkles' as const,
      color: '#8b5cf6',
      onPress: onSelectAI,
    },
    {
      id: 'robotics',
      label: 'Robotics Activity',
      icon: 'hardware-chip' as const,
      color: '#f59e0b',
      onPress: onSelectRobotics,
    },
    {
      id: 'computer_literacy',
      label: 'Computer Literacy',
      icon: 'laptop' as const,
      color: '#06b6d4',
      onPress: onSelectComputerLiteracy,
    },
    {
      id: 'interactive',
      label: 'Interactive Activities',
      icon: 'game-controller' as const,
      color: '#10b981',
      onPress: onSelectInteractive,
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.text }]}>STEM Integration</Text>
      <View style={styles.grid}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={option.onPress}
          >
            <View style={[styles.iconContainer, { backgroundColor: `${option.color}20` }]}>
              <Ionicons name={option.icon} size={24} color={option.color} />
            </View>
            <Text style={[styles.label, { color: theme.text }]}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
